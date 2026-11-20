"""Ambil data live What'sUpIndonesia -> site/data/live/*.json

    python scripts/fetch_data.py

Sumber:
- Gempa   : BMKG (data.bmkg.go.id, utama) -> cadangan USGS FDSN bila BMKG tidak bisa diakses
- Titik panas: NASA FIRMS, file publik 24 jam VIIRS (S-NPP, NOAA-20, NOAA-21) + MODIS, wilayah Asia Tenggara
- Laporan warga (banjir, kebakaran, angin, gempa, dll.): PetaBencana.id
Hanya pustaka standar Python. Setiap sumber gagal tidak menghentikan sumber lain;
bila gagal, data lama (jika ada) dipertahankan dan statusnya ditandai di meta.json.
"""
import csv
import io
import json
import os
import re
import sys
import time
import traceback
import urllib.request
from html import unescape
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from geo import RegionIndex  # noqa: E402
from berita import (berita_untuk_laporan, berita_gempa, berita_banjir, berita_karhutla, berita_gunung,  # noqa: E402
                    _short_kab, Dibatasi)

ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / "site" / "data"
LIVE = DATA / "live"
UA = "WhatsUpIndonesia/0.1 (peta pemantauan bencana nonkomersial)"
BBOX = (94.5, -11.5, 141.5, 6.5)  # lon_min, lat_min, lon_max, lat_max
NOW = datetime.now(timezone.utc)

FIRMS = "https://firms.modaps.eosdis.nasa.gov/data/active_fire/"
FIRMS_FILES = {
    "VIIRS NOAA-20": "noaa-20-viirs-c2/csv/J1_VIIRS_C2_SouthEast_Asia_24h.csv",
    "VIIRS NOAA-21": "noaa-21-viirs-c2/csv/J2_VIIRS_C2_SouthEast_Asia_24h.csv",
    "VIIRS S-NPP": "suomi-npp-viirs-c2/csv/SUOMI_VIIRS_C2_SouthEast_Asia_24h.csv",
    "MODIS": "modis-c6.1/csv/MODIS_C6_1_SouthEast_Asia_24h.csv",
}
BMKG = "https://data.bmkg.go.id/DataMKG/TEWS/"
USGS = ("https://earthquake.usgs.gov/fdsnws/event/1/query?format=geojson"
        "&minlatitude={1}&maxlatitude={3}&minlongitude={0}&maxlongitude={2}"
        "&minmagnitude=3&orderby=time&starttime={start}")
PETABENCANA = "https://data.petabencana.id/reports?timeperiod=604800&geoformat=geojson"


def get(url, timeout=60):
    req = urllib.request.Request(url, headers={"User-Agent": UA})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def in_bbox(lon, lat):
    return BBOX[0] <= lon <= BBOX[2] and BBOX[1] <= lat <= BBOX[3]


def iso(dt):
    return dt.astimezone(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def fc(features):
    return {"type": "FeatureCollection", "features": features}


def point(lon, lat, props):
    return {"type": "Feature", "geometry": {"type": "Point", "coordinates": [round(lon, 4), round(lat, 4)]},
            "properties": props}


def wilayah_props(region):
    if not region:
        return {"wilayah_id": None, "kabupaten": None, "provinsi": None}
    return {"wilayah_id": region["id"], "kabupaten": region["nama"], "provinsi": region["provinsi"]}


# ---------------------------------------------------------------- titik panas
def fetch_hotspots(regions):
    feats, per_sat = [], {}
    for sat, path in FIRMS_FILES.items():
        try:
            text = get(FIRMS + path, timeout=90).decode("utf-8", "replace")
        except Exception as e:  # satu satelit gagal tidak masalah
            per_sat[sat] = f"gagal: {e}"
            continue
        n = 0
        for row in csv.DictReader(io.StringIO(text)):
            try:
                lat, lon = float(row["latitude"]), float(row["longitude"])
            except (KeyError, ValueError):
                continue
            if not in_bbox(lon, lat):
                continue
            region = regions.locate(lon, lat)
            if not region:  # di luar Indonesia (Malaysia, PNG, Timor Leste, laut)
                continue
            conf_raw = row.get("confidence", "")
            if conf_raw.isdigit():  # MODIS 0-100
                c = int(conf_raw)
                conf = "tinggi" if c >= 80 else "rendah" if c < 30 else "sedang"
            else:  # VIIRS l/n/h
                conf = {"h": "tinggi", "n": "sedang", "l": "rendah"}.get(conf_raw[:1].lower(), "sedang")
            t = row.get("acq_time", "0000").zfill(4)
            waktu = datetime.strptime(f'{row["acq_date"]} {t}', "%Y-%m-%d %H%M").replace(tzinfo=timezone.utc)
            frp = row.get("frp")
            feats.append(point(lon, lat, {
                "waktu": iso(waktu), "satelit": sat, "keyakinan": conf,
                "frp": round(float(frp), 1) if frp else None,
                "siang": row.get("daynight") == "D",
                **wilayah_props(region),
            }))
            n += 1
        per_sat[sat] = n
    feats.sort(key=lambda f: f["properties"]["waktu"], reverse=True)
    return fc(feats), {"per_satelit": per_sat}


# ---------------------------------------------------------------------- gempa
def _bmkg_list(name):
    data = json.loads(get(BMKG + name))
    g = data["Infogempa"]["gempa"]
    return g if isinstance(g, list) else [g]


def _num(text):
    m = re.search(r"-?\d+(?:[.,]\d+)?", str(text))
    return float(m.group().replace(",", ".")) if m else None


def fetch_quakes_bmkg(regions):
    seen, feats = set(), []
    for name, dirasakan in (("gempaterkini.json", False), ("gempadirasakan.json", True), ("autogempa.json", None)):
        for q in _bmkg_list(name):
            lat_s, lon_s = q["Coordinates"].split(",")
            lat, lon = float(lat_s), float(lon_s)
            waktu = datetime.fromisoformat(q["DateTime"].replace("Z", "+00:00"))
            key = (round(lat, 2), round(lon, 2), q["DateTime"][:16])
            if key in seen:
                if dirasakan is True or q.get("Dirasakan"):
                    for f in feats:
                        if f["properties"]["_key"] == key:
                            f["properties"]["dirasakan"] = q.get("Dirasakan") or f["properties"]["dirasakan"]
                continue
            seen.add(key)
            feats.append(point(lon, lat, {
                "_key": key, "waktu": iso(waktu), "magnitudo": _num(q.get("Magnitude")),
                "kedalaman_km": _num(q.get("Kedalaman")), "lokasi": q.get("Wilayah"),
                "potensi": q.get("Potensi"), "dirasakan": q.get("Dirasakan"),
                "shakemap": ("https://data.bmkg.go.id/DataMKG/TEWS/" + q["Shakemap"]) if q.get("Shakemap") else None,
                "sumber": "BMKG", **wilayah_props(regions.locate(lon, lat, 0.0)),
            }))
    for f in feats:
        f["properties"].pop("_key", None)
    return feats


def fetch_quakes_usgs(regions):
    start = (NOW - timedelta(days=7)).strftime("%Y-%m-%d")
    data = json.loads(get(USGS.format(*BBOX, start=start)))
    feats = []
    for q in data["features"]:
        lon, lat, depth = q["geometry"]["coordinates"]
        p = q["properties"]
        feats.append(point(lon, lat, {
            "waktu": iso(datetime.fromtimestamp(p["time"] / 1000, timezone.utc)),
            "magnitudo": round(p["mag"], 1) if p.get("mag") is not None else None,
            "kedalaman_km": round(depth, 1) if depth is not None else None,
            "lokasi": p.get("place"), "potensi": None, "dirasakan": None,
            "tautan": p.get("url"), "sumber": "USGS",
            **wilayah_props(regions.locate(lon, lat, 0.0)),
        }))
    return feats


def fetch_quakes(regions):
    try:
        feats = fetch_quakes_bmkg(regions)
        sumber = "BMKG"
    except Exception as e:
        print("  BMKG gagal, pakai USGS:", e)
        feats = fetch_quakes_usgs(regions)
        sumber = "USGS (cadangan; BMKG tidak dapat diakses)"
    batas = iso(NOW - timedelta(days=7))
    feats = [f for f in feats if f["properties"]["waktu"] >= batas]
    for f in feats:  # kunci stabil untuk berita terkait
        f["properties"]["id"] = f'{f["properties"]["waktu"]}|{f["properties"]["magnitudo"]}'
    feats.sort(key=lambda f: f["properties"]["waktu"], reverse=True)
    return fc(feats), {"sumber": sumber}


# ------------------------------------------------------------- laporan warga
JENIS = {"flood": "banjir", "fire": "kebakaran", "haze": "kabut asap", "wind": "angin kencang",
         "earthquake": "gempa", "volcano": "gunung api"}


def fetch_reports(regions):
    data = json.loads(get(PETABENCANA))
    feats = []
    for r in data["result"]["features"]:
        lon, lat = r["geometry"]["coordinates"][:2]
        p = r["properties"]
        rd = p.get("report_data") or {}
        tinggi = rd.get("flood_depth")
        feats.append(point(lon, lat, {
            "id": str(p.get("pkey") or ""),
            "waktu": iso(datetime.fromisoformat(p["created_at"].replace("Z", "+00:00"))),
            "jenis": JENIS.get(p.get("disaster_type"), p.get("disaster_type") or "lainnya"),
            "teks": (p.get("text") or "").strip()[:400] or None,
            "foto": p.get("image_url"),
            "tinggi_air_cm": tinggi,
            "tautan": f'https://petabencana.id/map?report={p["pkey"]}' if p.get("pkey") else None,
            "sumber": "PetaBencana.id",
            **wilayah_props(regions.locate(lon, lat)),
        }))
    feats.sort(key=lambda f: f["properties"]["waktu"], reverse=True)
    return fc(feats), {}


# ------------------------------------------------------------------ banjir
BMKG_CAP_RSS = "https://cuaca.bmkg.go.id/data/public/cap/feed/id/rss.xml"
CAP_NS = {"c": "urn:oasis:names:tc:emergency:cap:1.2"}
BNPB_MINGGUAN = ("https://gis.bnpb.go.id/server/rest/services/Kejadian_Bencana_Mingguan/FeatureServer/25/query"
                 "?where={w}&outFields={o}&returnGeometry=true&maxAllowableOffset=0.02&outSR=4326&f=json")
BNPB_FIELDS = ("kabupaten,kategori_bencana,dt,tgl,bulan,tahun,meninggal,hilang,luka_sakit,mengungsi,"
               "menderita,rumah_terendam,rumah_rusak,kronologis,kondisi_mutakhir,upaya_,id")


def _judul(s):
    """'BATHIN II PELAYANG' -> 'Bathin II Pelayang' (angka romawi tetap kapital)."""
    out = []
    for w in s.strip().split():
        out.append(w.upper() if re.fullmatch(r"[IVX]+", w.upper()) and len(w) <= 4 else w.capitalize())
    return " ".join(out)


def fetch_flood_warnings(regions):
    """Peringatan dini cuaca BMKG (CAP) yang masih berlaku: poligon kecamatan berpotensi hujan lebat/banjir lokal."""
    import xml.etree.ElementTree as ET
    rss = get(BMKG_CAP_RSS).decode("utf-8", "replace")
    links = list(dict.fromkeys(re.findall(r"<link>(https://[^<]+_alert\.xml)</link>", rss)))
    feats, gagal = [], 0
    for url in links[:60]:
        try:
            root = ET.fromstring(get(url, timeout=30))
        except Exception:
            gagal += 1
            continue
        if (root.findtext("c:msgType", "", CAP_NS) or "").lower() == "cancel":
            continue
        info = root.find("c:info", CAP_NS)
        if info is None:
            continue
        t = lambda k: (info.findtext(f"c:{k}", "", CAP_NS) or "").strip()  # noqa: E731
        try:
            berakhir = datetime.fromisoformat(t("expires"))
        except ValueError:
            continue
        if berakhir < NOW:
            continue  # sudah kedaluwarsa
        polys = []
        for area in info.findall("c:area", CAP_NS):
            for pg in area.findall("c:polygon", CAP_NS):
                ring = []
                for pair in (pg.text or "").split():
                    try:
                        la, lo = pair.split(",")
                        ring.append([round(float(lo), 3), round(float(la), 3)])
                    except ValueError:
                        pass
                if len(ring) >= 4:
                    if ring[0] != ring[-1]:
                        ring.append(ring[0])
                    polys.append([ring])
        if not polys:
            continue
        desk = t("description")
        m = re.search(r"khususnya di (.+?)\.\s", desk + " ")
        kec = [_judul(k) for k in m.group(1).split(",") if k.strip()] if m else []
        # Kabupaten/kota yang tercakup: cari wilayah untuk titik tengah tiap poligon
        area_desc = (info.find("c:area", CAP_NS).findtext("c:areaDesc", "", CAP_NS) or "").strip()
        found = []
        for p in polys:
            ring = p[0]
            px = sum(q[0] for q in ring) / len(ring)
            py = sum(q[1] for q in ring) / len(ring)
            r = regions.locate(px, py, 0.1)
            if r and r["id"] not in [x["id"] for x in found]:
                found.append(r)
        # buang kabupaten provinsi tetangga (titik tengah poligon kecamatan di perbatasan)
        same = [r for r in found if r["provinsi"].lower() == area_desc.lower()]
        found = same or found
        kabs, ids = [r["nama"] for r in found], [r["id"] for r in found]
        big = max(polys, key=lambda p: len(p[0]))[0]
        cx = sum(p[0] for p in big) / len(big)
        cy = sum(p[1] for p in big) / len(big)
        feats.append({
            "type": "Feature",
            "geometry": {"type": "MultiPolygon", "coordinates": polys},
            "properties": {
                "id": root.findtext("c:identifier", "", CAP_NS),
                "judul": t("headline"), "kejadian": t("event"), "tingkat": t("severity"),
                "mulai": iso(datetime.fromisoformat(t("effective"))) if t("effective") else None,
                "berakhir": iso(berakhir), "provinsi": area_desc, "kecamatan": kec[:40],
                "banjir": "banjir" in desk.lower(),
                "dampak": (re.search(r"berpotensi menimbulkan dampak berupa ([^.]+)\.", desk) or [None, None])[1],
                "infografis": t("web") or None, "tautan": url,
                "kabupaten_list": kabs, "wilayah_ids": ids,
                "x": round(cx, 4), "y": round(cy, 4),
            },
        })
    feats.sort(key=lambda f: f["properties"]["berakhir"])
    return fc(feats), {"peringatan_rss": len(links), "gagal_unduh": gagal}


def _norm_kab(s):
    s = (s or "").lower()
    s = re.sub(r"^(kota adm\.?|kota administrasi|kab\.?|kabupaten|kota)\s+", "", s)
    return re.sub(r"[^a-z]", "", s)


def fetch_flood_bnpb(regions):
    """Kejadian banjir resmi BNPB (layanan 'Kejadian Bencana Mingguan')."""
    import urllib.parse
    url = BNPB_MINGGUAN.format(w=urllib.parse.quote("kategori_bencana LIKE '%anjir%'"), o=BNPB_FIELDS)
    data = json.loads(get(url, timeout=60))
    if "error" in data:
        raise RuntimeError(data["error"])
    wil = json.loads((DATA / "wilayah.geojson").read_text(encoding="utf-8"))["features"]
    by_name = {}
    for w in wil:
        by_name.setdefault(_norm_kab(w["properties"]["nama"]), w["properties"])
    feats = []
    for f in data.get("features", []):
        a, g = f["attributes"], f.get("geometry") or {}
        rings = g.get("rings") or []
        reg, pt = None, None
        if rings:
            big = max(rings, key=len)
            pt = (sum(p[0] for p in big) / len(big), sum(p[1] for p in big) / len(big))
            reg = regions.locate(pt[0], pt[1], 0.1)
        nama_bnpb = a.get("kabupaten") or ""
        cand = by_name.get(_norm_kab(nama_bnpb))
        if cand and (not reg or _norm_kab(reg["nama"]) != _norm_kab(nama_bnpb)):
            reg = cand  # nama dari BNPB lebih bisa dipercaya daripada titik tengah poligon
        if not pt:
            continue
        tanggal = (datetime.fromtimestamp(a["dt"] / 1000, timezone.utc).strftime("%Y-%m-%d")
                   if a.get("dt") else f'{a.get("tahun")}-{a.get("bulan"):02d}-{a.get("tgl"):02d}')
        feats.append(point(pt[0], pt[1], {
            "id": a.get("id"), "tanggal": tanggal, "kategori": a.get("kategori_bencana"),
            "kabupaten_bnpb": nama_bnpb,
            "meninggal": a.get("meninggal") or 0, "hilang": a.get("hilang") or 0,
            "luka": a.get("luka_sakit") or 0, "mengungsi": a.get("mengungsi") or 0,
            "menderita": a.get("menderita") or 0, "rumah_terendam": a.get("rumah_terendam") or 0,
            "rumah_rusak": a.get("rumah_rusak") or 0,
            "kronologis": (a.get("kronologis") or "").strip()[:600] or None,
            "kondisi": (a.get("kondisi_mutakhir") or "").strip()[:400] or None,
            "sumber": "BNPB",
            **wilayah_props(reg),
        }))
    feats.sort(key=lambda f: f["properties"]["tanggal"], reverse=True)
    return fc(feats), {}


# --------------------------------------------------------------- gunung api
MAGMA = "https://magma.esdm.go.id/"
MAGMA_LEVEL = "https://magma.esdm.go.id/v1/gunung-api/tingkat-aktivitas"
STATUS_GUNUNG = {1: "Normal", 2: "Waspada", 3: "Siaga", 4: "Awas"}
LAPORAN_KEYS = ("periode", "visual", "lainnya", "kegempaan", "rekomendasi")


def _json_array_after(text, marker):
    """Ambil array JSON yang dimulai setelah `marker` (mis. 'var markersGunungApi')."""
    i = text.find(marker)
    if i < 0:
        raise ValueError(f"penanda {marker!r} tidak ditemukan")
    s = text.find("[", i)
    d = 0
    for j in range(s, len(text)):
        if text[j] == "[":
            d += 1
        elif text[j] == "]":
            d -= 1
            if d == 0:
                return json.loads(text[s:j + 1])
    raise ValueError("array tidak tertutup")


def _teks(html):
    t = re.sub(r"<script.*?</script>|<style.*?</style>", " ", html, flags=re.S)
    t = re.sub(r"<[^>]+>", " ", t)
    return re.sub(r"\s+", " ", unescape(t)).strip()


def _antara(t, awal, akhir_list, maks=420):
    """Teks di antara judul bagian `awal` dan judul bagian berikutnya."""
    i = t.find(awal)
    if i < 0:
        return None
    i += len(awal)
    j = min([k for k in (t.find(a, i) for a in akhir_list) if k > 0] or [len(t)])
    v = t[i:j].strip(" :.-")
    if len(v) > maks:
        v = v[:maks].rsplit(" ", 1)[0] + "…"
    return v or None


def _laporan_gunung(url):
    t = _teks(get(url, timeout=40).decode("utf-8", "replace"))
    periode = re.search(r"periode ([0-9:]+ - [0-9:]+ W(?:IB|ITA|IT))", t)
    tanggal = re.search(r"Laporan Aktivitas [^,]+, (\w+ - \d{1,2} \w+ \d{4})", t)
    rek = _antara(t, "Rekomendasi", ["Laporan Aktivitas Lainnya", "Tweet", "Copyright", "©"], maks=1600) or ""
    poin = [x.strip() for x in re.split(r"\s(?=\d{1,2}\.\s)", " " + rek) if x.strip()]
    poin = [re.sub(r"^\d{1,2}\.\s*", "", x) for x in poin]
    poin = [(x[:320].rsplit(" ", 1)[0] + "…") if len(x) > 320 else x
            for x in poin if len(x) > 12 and x.lower() != "rekomendasi"][:3]
    waktu = " · ".join(x for x in ((tanggal.group(1).replace(" - ", ", ") if tanggal else None),
                                   (periode.group(1) if periode else None)) if x)
    return {
        "periode": waktu or None,
        "visual": _antara(t, "Pengamatan Visual", ["Keterangan Lainnya", "Klimatologi", "Pengamatan Kegempaan"]),
        "lainnya": None if (lain := _antara(t, "Keterangan Lainnya", ["Klimatologi", "Pengamatan Kegempaan"],
                                              maks=300)) in (None, "Nihil", "nihil", "-") else lain,
        "kegempaan": _antara(t, "Pengamatan Kegempaan", ["Rekomendasi"], maks=360),
        "rekomendasi": poin,
    }


def fetch_volcanoes(regions):
    """Tingkat aktivitas gunung api dari MAGMA Indonesia (Badan Geologi/PVMBG). Laporan terbaru dibaca
    untuk gunung berstatus Waspada ke atas; dipakai ulang selama nomor laporannya belum berganti."""
    home = get(MAGMA, timeout=60).decode("utf-8", "replace")
    gunung = _json_array_after(home, "var markersGunungApi")
    level_html = get(MAGMA_LEVEL, timeout=60).decode("utf-8", "replace")
    tautan = {}
    pola = r'<td>\s*([^<]+?)\s+-\s+[^<]*?<a href="(https://magma\.esdm\.go\.id/v1/gunung-api/laporan/\d+\?signature=[0-9a-f]+)"'
    for nama, url in re.findall(pola, level_html):
        tautan[nama.strip().lower()] = unescape(url)
    lama = {f["properties"]["id"]: f["properties"] for f in load_previous("gunung_api.geojson").get("features", [])}
    feats, dibaca, gagal = [], 0, 0
    for g in gunung:
        lon, lat = g.get("ga_lon_gapi"), g.get("ga_lat_gapi")
        if lon is None or lat is None:
            continue
        lv = int(g.get("ga_status") or 1)
        nama = (g.get("ga_nama_gapi") or "").strip()
        url = tautan.get(nama.lower())
        lid = re.search(r"laporan/(\d+)", url).group(1) if url else None
        props = {
            "id": g.get("ga_code") or nama, "nama": nama, "level": lv, "status": STATUS_GUNUNG.get(lv, "?"),
            "elevasi": g.get("ga_elev_gapi"), "erupsi": bool(g.get("erupt_icon")), "vona": bool(g.get("has_vona")),
            "lokasi": ", ".join(x for x in (g.get("ga_kab_gapi"), g.get("ga_prov_gapi")) if x),
            "tautan": url, "laporan_id": lid,
            **wilayah_props(regions.locate(lon, lat)),
        }
        if lv >= 2 and url:
            old = lama.get(props["id"])
            if old and old.get("laporan_id") == lid and old.get("periode"):
                props.update({k: old.get(k) for k in LAPORAN_KEYS})
            else:
                try:
                    props.update(_laporan_gunung(url))
                    dibaca += 1
                except Exception as e:
                    gagal += 1
                    print("    laporan gunung gagal:", nama, e)
                    if old:
                        props.update({k: old.get(k) for k in LAPORAN_KEYS})
        feats.append(point(lon, lat, props))
    feats.sort(key=lambda f: (-f["properties"]["level"], f["properties"]["nama"]))
    return fc(feats), {"waspada_ke_atas": sum(1 for f in feats if f["properties"]["level"] >= 2),
                       "laporan_dibaca": dibaca, "laporan_gagal": gagal}


# ------------------------------------------------- area banjir (PetaBencana)
PB_FLOODS = "https://data.petabencana.id/floods?minimum_state=1&geoformat=geojson"
TINGGI_BANJIR = {1: "hati-hati", 2: "10–70 cm", 3: "71–150 cm", 4: "lebih dari 150 cm"}


def fetch_flood_areas(regions):
    """Area (RT/RW) yang ditandai tergenang di PetaBencana.id, hanya yang diperbarui ≤ 48 jam terakhir."""
    data = json.loads(get(PB_FLOODS, timeout=60))
    feats, lewat = [], 0
    for f in (data.get("result") or {}).get("features", []):
        p = f.get("properties") or {}
        try:
            t = datetime.fromisoformat(p["last_updated"].replace("Z", "+00:00"))
        except Exception:
            continue
        if NOW - t > timedelta(hours=48):
            lewat += 1
            continue
        a = p.get("attributes") or {}
        lv = int(p.get("state") or 1)
        kel = (a.get("Kelurahan/Village") or p.get("parent_name") or "").title()
        kec = (a.get("Kecamatan/Subdistrict") or p.get("city_name") or "").title()
        feats.append({"type": "Feature", "geometry": f["geometry"], "properties": {
            "id": str(p.get("area_id") or p.get("geom_id")), "level": lv, "tinggi": TINGGI_BANJIR.get(lv, "?"),
            "nama": " · ".join(x for x in (p.get("area_name"), kel, kec) if x),
            "kota": (a.get("District") or "").title() or None, "waktu": iso(t),
        }})
    return fc(feats), {"kedaluwarsa_dibuang": lewat}


# ------------------------------------------------------------------- angin
OPEN_METEO = ("https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}"
              "&hourly=wind_speed_10m,wind_direction_10m,wind_gusts_10m&forecast_hours=12"
              "&timezone=GMT&wind_speed_unit=kmh")
ANGIN_LANGKAH = 1.5   # jarak grid (derajat), ~165 km
ANGIN_ULANG = timedelta(hours=2)  # model cuaca diperbarui per jam; hemat kuota gratis Open-Meteo


def fetch_wind(regions):
    """Arah & kecepatan angin 10 m (prakiraan per jam, 12 jam ke depan) di grid seluruh Indonesia,
    dari Open-Meteo (gratis, tanpa API key, CC BY 4.0). Diambil ulang paling cepat tiap 2 jam."""
    lama = load_previous("angin.json")
    if lama.get("diambil"):
        umur = NOW - datetime.fromisoformat(lama["diambil"].replace("Z", "+00:00"))
        jam_terakhir = datetime.fromisoformat(lama["jam"][-1] + "+00:00") if lama.get("jam") else NOW
        if umur < ANGIN_ULANG and jam_terakhir > NOW + timedelta(hours=6):
            return lama, {"dipakai_ulang": True, "titik": len(lama.get("titik", []))}
    grid = []
    lat = BBOX[1] + 0.5
    while lat <= BBOX[3]:
        lon = BBOX[0] + 0.5
        while lon <= BBOX[2]:
            grid.append((round(lon, 2), round(lat, 2)))
            lon += ANGIN_LANGKAH
        lat += ANGIN_LANGKAH
    titik, jam = [], None
    for i in range(0, len(grid), 100):
        chunk = grid[i:i + 100]
        url = OPEN_METEO.format(lat=",".join(str(c[1]) for c in chunk), lon=",".join(str(c[0]) for c in chunk))
        for coba in range(4):  # koneksi ke Open-Meteo dari server GitHub kadang timeout: ulangi
            try:
                data = json.loads(get(url, timeout=60))
                break
            except Exception as e:
                if coba == 3:
                    raise
                print(f"    angin: percobaan {coba + 1} gagal ({e}), ulangi")
                time.sleep(5 * (coba + 1))
        if isinstance(data, dict):
            data = [data]
        for (lon, lat), d in zip(chunk, data):
            h = d.get("hourly") or {}
            jam = jam or h.get("time")
            spd, arah, gust = h.get("wind_speed_10m"), h.get("wind_direction_10m"), h.get("wind_gusts_10m")
            if not spd or not arah:
                continue
            titik.append([lon, lat, [round(x or 0) for x in spd], [round(x or 0) for x in arah],
                          [round(x or 0) for x in (gust or [])]])
    if not titik:
        raise ValueError("Open-Meteo tidak mengembalikan data angin")
    return {"diambil": iso(NOW), "sumber": "Open-Meteo", "jam": jam, "titik": titik}, {"dipakai_ulang": False, "titik": len(titik)}


# ------------------------------------------------------------ polusi udara
OPEN_METEO_UDARA = ("https://air-quality-api.open-meteo.com/v1/air-quality?latitude={lat}&longitude={lon}"
                    "&hourly=pm2_5&forecast_hours=18&timezone=GMT")
# Kuota gratis Open-Meteo ±10.000 lokasi/hari: angin 384 titik tiap 2 jam (±4.600) + udara ±1.000 titik tiap 6 jam
# (±4.000). Model CAMS global sendiri hanya diperbarui 2× sehari, jadi 6 jam tidak kehilangan apa-apa.
UDARA_ULANG = timedelta(hours=6)
UDARA_LANGKAH = 0.5  # derajat (±55 km); hanya titik di darat / dekat pantai
UDARA_GRID = Path(__file__).with_name("grid_udara_darat.json")


def grid_udara(regions):
    """Titik grid 0,5° yang berada di darat Indonesia atau dekat pantai (salah satu dari 9 titik di sekitarnya
    jatuh di dalam kabupaten/kota). Mahal dihitung (±20 dtk), jadi disimpan di file dan dipakai ulang."""
    if UDARA_GRID.exists():
        return [tuple(p) for p in json.loads(UDARA_GRID.read_text(encoding="utf-8"))]
    regions = regions or RegionIndex(DATA / "wilayah.geojson")
    s, grid, lat = UDARA_LANGKAH, [], BBOX[1] + UDARA_LANGKAH / 2
    while lat <= BBOX[3]:
        lon = BBOX[0] + UDARA_LANGKAH / 2
        while lon <= BBOX[2]:
            if any(regions.locate(lon + dx, lat + dy, coast_tolerance=0) for dx in (-s / 2, 0, s / 2) for dy in (-s / 2, 0, s / 2)):
                grid.append((round(lon, 2), round(lat, 2)))
            lon += UDARA_LANGKAH
        lat += UDARA_LANGKAH
    UDARA_GRID.write_text(json.dumps(grid, separators=(",", ":")), encoding="utf-8")
    return grid


def fetch_air(regions):
    """PM2.5 (prakiraan model CAMS, per jam, 18 jam ke depan) di grid darat 0,5°, dari Open-Meteo.
    Diambil ulang paling cepat tiap 6 jam."""
    lama = load_previous("udara.json")
    grid = grid_udara(regions)
    if lama.get("diambil") and len(lama.get("titik", [])) == len(grid):
        umur = NOW - datetime.fromisoformat(lama["diambil"].replace("Z", "+00:00"))
        jam_terakhir = datetime.fromisoformat(lama["jam"][-1] + "+00:00") if lama.get("jam") else NOW
        if umur < UDARA_ULANG and jam_terakhir > NOW + timedelta(hours=6):
            return lama, {"dipakai_ulang": True, "titik": len(lama.get("titik", []))}
    titik, jam = [], None
    for i in range(0, len(grid), 100):
        if i:
            time.sleep(15)  # batas Open-Meteo ±600 lokasi/menit: 100 lokasi tiap 15 dtk = 400/menit
        chunk = grid[i:i + 100]
        url = OPEN_METEO_UDARA.format(lat=",".join(str(c[1]) for c in chunk), lon=",".join(str(c[0]) for c in chunk))
        for coba in range(4):
            try:
                data = json.loads(get(url, timeout=60))
                break
            except Exception as e:
                if coba == 3:
                    raise
                print(f"    udara: percobaan {coba + 1} gagal ({e}), ulangi")
                time.sleep(30 * (coba + 1))  # 429 = kuota per menit habis: tunggu lebih lama
        if isinstance(data, dict):
            data = [data]
        for (lon, lat), d in zip(chunk, data):
            h = d.get("hourly") or {}
            jam = jam or h.get("time")
            pm = h.get("pm2_5")
            if not pm:
                continue
            titik.append([lon, lat, [round(x, 1) if x is not None else None for x in pm]])
    if not titik:
        raise ValueError("Open-Meteo tidak mengembalikan data polusi udara")
    return {"diambil": iso(NOW), "sumber": "Open-Meteo (CAMS)", "jam": jam, "titik": titik}, {"dipakai_ulang": False, "titik": len(titik)}


# ------------------------------------------------ ISPU resmi (stasiun KLH)
ISPU_KLH = "https://ispu.kemenlh.go.id/apimobile/v1/getStations"
ISPU_ZONA = {"WIB": 7, "WITA": 8, "WIT": 9}
ISPU_PARAM = {"pm25": "PM2.5", "pm10": "PM10", "so2": "SO2", "co": "CO", "o3": "O3", "no2": "NO2", "hc": "HC"}


METAR_URL = ("https://aviationweather.gov/api/data/metar?bbox={1},{0},{3},{2}&format=json&hours=3")
# kode cuaca METAR -> intensitas hujan di bandara (perkiraan mm/jam): ringan, sedang, lebat, sangat lebat
_HUJAN_KODE = ("RA", "DZ", "SH", "TS", "GR", "GS", "UP")


def nilai_hujan_metar(wx):
    """Ubah kode cuaca METAR (mis. '-RA', 'TSRA', '+SHRA VCTS') jadi (mm/jam perkiraan, label, petir di sekitar)."""
    wx = (wx or "").upper()
    sekitar = "VCTS" in wx or "VCSH" in wx or "TS" in wx.split()
    mm, label = 0.0, "Tidak hujan"
    for tok in wx.split():
        if tok.startswith("VC") or not any(k in tok for k in _HUJAN_KODE):
            continue
        if tok in ("TS",):                      # guntur tanpa hujan di bandara
            continue
        ringan, lebat, badai = tok.startswith("-"), tok.startswith("+"), "TS" in tok
        if "DZ" in tok and "RA" not in tok:
            v, l = 0.5, "Gerimis"
        elif badai:
            v, l = (25.0, "Hujan badai lebat") if lebat else (10.0, "Hujan badai")
        elif lebat:
            v, l = 10.0, "Hujan lebat"
        elif ringan:
            v, l = 1.0, "Hujan ringan"
        else:
            v, l = 4.0, "Hujan sedang"
        if v > mm:
            mm, label = v, l
    return mm, label, sekitar


def fetch_metar():
    """Pengamatan cuaca bandara (METAR) 3 jam terakhir dari NOAA Aviation Weather Center.
    (Robot hujan scripts/hujan.py memakai METAR_URL & nilai_hujan_metar langsung.)"""
    data = json.loads(get(METAR_URL.format(*BBOX), timeout=40))
    st = {}
    for m in data:
        if not str(m.get("icaoId", "")).startswith("W") or m.get("lat") is None or not m.get("reportTime"):
            continue                              # hanya bandara Indonesia/Malaysia/Singapura/Brunei (kode W...)
        mm, label, sekitar = nilai_hujan_metar(m.get("wxString"))
        s_ = st.setdefault(m["icaoId"], {"id": m["icaoId"], "nama": re.sub(r",.*$", "", m.get("name") or m["icaoId"]),
                                          "lat": round(m["lat"], 4), "lon": round(m["lon"], 4), "obs": []})
        s_["obs"].append({"t": m["reportTime"][:19] + "Z", "mm": mm, "label": label, "sekitar": sekitar,
                          "wx": m.get("wxString") or "", "awan": m.get("cover") or "", "raw": m.get("rawOb") or ""})
    for s_ in st.values():
        s_["obs"].sort(key=lambda o: o["t"], reverse=True)
        s_["obs"] = s_["obs"][:8]
    stasiun = sorted(st.values(), key=lambda x: x["id"])
    return {"diambil": iso(NOW), "stasiun": stasiun}, {"jumlah_stasiun": len(stasiun),
                                                        "hujan": sum(1 for x in stasiun if x["obs"][0]["mm"] > 0)}


def fetch_ispu():
    """Stasiun pemantau kualitas udara resmi (ISPU, Kementerian Lingkungan Hidup), nilai per jam.
    Data sama dengan peta ispu.kemenlh.go.id / aplikasi ISPUNet."""
    rows = json.loads(get(ISPU_KLH, timeout=40)).get("rows") or []
    features = []
    for r in rows:
        try:
            lon, lat, val = float(r["lon"]), float(r["lat"]), int(float(r["val"]))
        except (KeyError, TypeError, ValueError):
            continue
        if r.get("stasiun_show") != "1" or r.get("is_maintenance") == "1" or r.get("stasiun_uji") == "1":
            continue
        if not in_bbox(lon, lat) or val <= 0:
            continue
        zona = (r.get("time_z") or "WIB").upper()
        try:
            lokal = datetime.strptime(r["waktu"], "%Y-%m-%d %H:%M:%S")
            waktu = iso(lokal.replace(tzinfo=timezone(timedelta(hours=ISPU_ZONA.get(zona, 7)))))
        except (KeyError, ValueError):
            continue
        sub = {}
        for k, nama in ISPU_PARAM.items():
            try:
                v = int(float(r.get(f"t_{k}") or 0))
            except ValueError:
                v = 0
            if v > 0:
                sub[nama] = v
        param = re.sub(r"<[^>]+>", "", r.get("param") or "").replace(",", ", ")
        kat = r.get("kategori") or {}
        features.append(point(lon, lat, {
            "id": r.get("id_stasiun"), "nama": (r.get("nama") or "").strip(),
            "kota": (r.get("kota") or "").strip(), "provinsi": (r.get("provinsi") or "").strip(),
            "ispu": val, "kategori": (r.get("cat") or "").strip().capitalize(),
            "keterangan": (kat.get("keterangan") or "").strip(),
            "kritis": param, "sub": sub, "waktu": waktu, "zona": zona,
            "pengelola": r.get("tipe_text") or "",
        }))
    if not features:
        raise ValueError("ISPU KLH tidak mengembalikan stasiun")
    return fc(features), {"stasiun": len(features)}


# ------------------------------------------------- berita terkait laporan
def load_previous(name):
    """Data run sebelumnya: file lokal, atau (di GitHub Actions) salinan dari situs yang sudah terbit."""
    local = LIVE / name
    if local.exists():
        return json.loads(local.read_text(encoding="utf-8"))
    site = os.environ.get("SITE_URL", "").rstrip("/")
    if site:
        try:
            return json.loads(get(f"{site}/data/live/{name}", timeout=30))
        except Exception as e:
            print(f"  tidak ada {name} sebelumnya di situs: {e}")
    return {}


def pertahankan(name, kosong):
    """Sumber gagal: pakai data terakhir yang berhasil (lokal, atau dari situs yang sudah terbit), jangan
    menimpanya dengan data kosong. Di GitHub Actions folder data selalu kosong di awal, jadi data lama
    harus diambil dari situs. Bila memang tidak ada sama sekali, tulis `kosong` (None = jangan tulis)."""
    if (LIVE / name).exists():
        return
    lama = load_previous(name)
    if lama:
        print(f"  pakai {name} terakhir yang berhasil")
        (LIVE / name).write_text(json.dumps(lama, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    elif kosong is not None:
        (LIVE / name).write_text(json.dumps(kosong), encoding="utf-8")


def fetch_report_news(reports):
    cache = load_previous("berita_laporan.json")
    out, dicari = {}, 0
    for f in reports["features"]:
        p = f["properties"]
        rid = p.get("id")
        if not rid:
            continue
        lama = cache.get(rid)
        umur_laporan = NOW - datetime.fromisoformat(p["waktu"].replace("Z", "+00:00"))
        perlu = lama is None or (
            umur_laporan < timedelta(days=3)
            and NOW - datetime.fromisoformat(lama["diperiksa"].replace("Z", "+00:00")) > timedelta(hours=3))
        if perlu and dicari < 40:  # batasi permintaan per run
            dicari += 1
            out[rid] = {"diperiksa": iso(NOW), "berita": berita_untuk_laporan(get, p)}
            print(f"    {rid} {p['jenis']} {p.get('kabupaten')}: {len(out[rid]['berita'])} berita")
        elif lama is not None:
            out[rid] = lama
    jumlah = sum(len(v["berita"]) for v in out.values())
    return out, {"dicari_run_ini": dicari, "laporan_dengan_berita": sum(1 for v in out.values() if v["berita"]),
                 "jumlah_berita": jumlah}


# ------------------------------------------------- berita kejadian (tanpa AI)
def _cek_cache(cache, key, umur_kejadian, maks_umur=timedelta(days=3), ulang=timedelta(hours=3)):
    """True bila kunci perlu dicari (belum ada, atau kejadian masih baru & sudah lama tidak dicek)."""
    lama = cache.get(key)
    if lama is None:
        return True
    dicek = datetime.fromisoformat(lama["diperiksa"].replace("Z", "+00:00"))
    return umur_kejadian < maks_umur and NOW - dicek > ulang


def fetch_event_news():
    """Berita untuk gempa, banjir (peringatan BMKG & BNPB), dan karhutla (kabupaten titik panas terbanyak).
    Disimpan per kunci kejadian & dipakai ulang antar-run; jumlah pencarian per run dibatasi."""
    wil = json.loads((DATA / "wilayah.geojson").read_text(encoding="utf-8"))["features"]
    nama_wilayah = {}
    for w in wil:
        for n in (_short_kab(w["properties"]["nama"]), w["properties"]["provinsi"]):
            nama_wilayah.setdefault(re.sub(r"[^a-z]", "", n.lower()), n)
    load = lambda n: json.loads((LIVE / n).read_text(encoding="utf-8")) if (LIVE / n).exists() else {"features": []}  # noqa: E731
    info = {}
    stop = {"v": False}

    def coba(fn, *args):
        """Jalankan pencarian; None bila sedang dibatasi Google News (hasil lama dipertahankan)."""
        if stop["v"]:
            return None
        try:
            return fn(*args)
        except Dibatasi as e:
            print("  Google News membatasi permintaan, sisa pencarian ditunda ke run berikutnya:", e)
            stop["v"] = True
            return None

    # --- gempa: hanya yang cukup besar / dirasakan (yang lain jarang diberitakan)
    cache, out, n = load_previous("berita_gempa.json"), {}, 0
    for f in load("gempa.geojson")["features"]:
        p = f["properties"]
        if not ((p.get("magnitudo") or 0) >= 4.5 or p.get("dirasakan")):
            continue
        umur = NOW - datetime.fromisoformat(p["waktu"].replace("Z", "+00:00"))
        if _cek_cache(cache, p["id"], umur) and n < 20:
            n += 1
            r = coba(berita_gempa, get, p, nama_wilayah)
            if r is not None:
                out[p["id"]] = {"diperiksa": iso(NOW), "berita": r}
                continue
        if p["id"] in cache:
            out[p["id"]] = cache[p["id"]]
    (LIVE / "berita_gempa.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    info["gempa"] = {"dicari": n, "dengan_berita": sum(1 for v in out.values() if v["berita"])}

    # --- banjir: per provinsi peringatan BMKG (hari ini) + per kejadian BNPB
    cache, out, n = load_previous("berita_banjir.json"), {}, 0
    hari = (NOW + timedelta(hours=7)).strftime("%Y-%m-%d")  # tanggal WIB
    per_prov = {}
    for f in load("peringatan.geojson")["features"]:
        p = f["properties"]
        per_prov.setdefault(p.get("provinsi") or "?", []).extend(_short_kab(k) for k in p.get("kabupaten_list", []))
    for prov, kabs in per_prov.items():
        key = f"bmkg|{prov}|{hari}"
        if _cek_cache(cache, key, timedelta(0)) and n < 24:
            n += 1
            tempat = list(dict.fromkeys(kabs)) + [prov]
            r = coba(berita_banjir, get, tempat, NOW - timedelta(hours=36), NOW)
            if r is not None:
                out[key] = {"diperiksa": iso(NOW), "berita": r}
                continue
        if key in cache:
            out[key] = cache[key]
    for f in load("banjir_bnpb.geojson")["features"]:
        p = f["properties"]
        key = f"bnpb|{p['id']}"
        t = datetime.fromisoformat(p["tanggal"] + "T00:00:00+00:00")
        if _cek_cache(cache, key, NOW - t, maks_umur=timedelta(days=5)) and n < 30:
            n += 1
            tempat = [_short_kab(p.get("kabupaten") or ""), re.sub(r"^(Kota Adm\.|Kota|Kab\.)\s*", "", p.get("kabupaten_bnpb") or "")]
            r = coba(berita_banjir, get, tempat, t - timedelta(days=1), t + timedelta(days=4))
            if r is not None:
                out[key] = {"diperiksa": iso(NOW), "berita": r}
                continue
        if key in cache:
            out[key] = cache[key]
    (LIVE / "berita_banjir.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    info["banjir"] = {"dicari": n, "dengan_berita": sum(1 for v in out.values() if v["berita"])}

    # --- karhutla: 8 kabupaten/kota dengan titik panas terbanyak hari ini
    cache, out, n = load_previous("berita_api.json"), {}, 0
    hitung = {}
    for f in load("titik_panas.geojson")["features"]:
        p = f["properties"]
        if p.get("wilayah_id"):
            k = (p["wilayah_id"], p["kabupaten"])
            hitung[k] = hitung.get(k, 0) + 1
    for (wid, kab), _ in sorted(hitung.items(), key=lambda x: -x[1])[:8]:
        key = f"{wid}|{hari}"
        if _cek_cache(cache, key, timedelta(0)) and n < 8:
            n += 1
            r = coba(berita_karhutla, get, kab, NOW - timedelta(days=3), NOW)
            if r is not None:
                out[key] = {"diperiksa": iso(NOW), "berita": r}
                continue
        if key in cache:
            out[key] = cache[key]
    (LIVE / "berita_api.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    info["karhutla"] = {"dicari": n, "dengan_berita": sum(1 for v in out.values() if v["berita"])}

    # --- gunung api: gunung berstatus Waspada ke atas, berita 3 hari terakhir
    cache, out, n = load_previous("berita_gunung.json"), {}, 0
    for f in load("gunung_api.geojson")["features"]:
        p = f["properties"]
        if p.get("level", 1) < 2:
            continue
        key = f"{p['id']}|{hari}"
        if _cek_cache(cache, key, timedelta(0)) and n < 14:
            n += 1
            r = coba(berita_gunung, get, p["nama"], NOW - timedelta(days=3), NOW)
            if r is not None:
                out[key] = {"diperiksa": iso(NOW), "berita": r}
                continue
        if key in cache:
            out[key] = cache[key]
    (LIVE / "berita_gunung.json").write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    info["gunung_api"] = {"dicari": n, "dengan_berita": sum(1 for v in out.values() if v["berita"])}
    return info


# ----------------------------------------------------------------------- main
def main():
    LIVE.mkdir(parents=True, exist_ok=True)
    regions = RegionIndex(DATA / "wilayah.geojson")
    meta_path = LIVE / "meta.json"
    old_meta = load_previous("meta.json")   # lokal, atau (di GitHub Actions) dari situs yang sudah terbit
    meta = {"diperbarui": iso(NOW), "lapisan": {}}

    for key, fn in (("gempa", fetch_quakes), ("titik_panas", fetch_hotspots), ("laporan", fetch_reports),
                    ("peringatan", fetch_flood_warnings), ("banjir_bnpb", fetch_flood_bnpb),
                    ("gunung_api", fetch_volcanoes), ("banjir_area", fetch_flood_areas)):
        print(f"- {key} ...")
        try:
            geo, info = fn(regions)
            (LIVE / f"{key}.geojson").write_text(
                json.dumps(geo, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
            meta["lapisan"][key] = {"ok": True, "jumlah": len(geo["features"]), "diambil": iso(NOW), **info}
            print(f"  {len(geo['features'])} fitur {info}")
        except Exception as e:
            traceback.print_exc()
            prev = old_meta.get("lapisan", {}).get(key, {})
            meta["lapisan"][key] = {**prev, "ok": False, "galat": str(e)[:200]}
            pertahankan(f"{key}.geojson", fc([]))

    print("- angin ...")
    try:
        angin, info = fetch_wind(None)
        (LIVE / "angin.json").write_text(json.dumps(angin, separators=(",", ":")), encoding="utf-8")
        meta["lapisan"]["angin"] = {"ok": True, "jumlah": len(angin["titik"]), "diambil": angin["diambil"], **info}
        print(f"  {info}")
    except Exception as e:
        traceback.print_exc()
        prev = old_meta.get("lapisan", {}).get("angin", {})
        meta["lapisan"]["angin"] = {**prev, "ok": False, "galat": str(e)[:200]}
        pertahankan("angin.json", None)

    print("- polusi udara ...")
    try:
        udara, info = fetch_air(regions)
        (LIVE / "udara.json").write_text(json.dumps(udara, separators=(",", ":")), encoding="utf-8")
        meta["lapisan"]["udara"] = {"ok": True, "jumlah": len(udara["titik"]), "diambil": udara["diambil"], **info}
        print(f"  {info}")
    except Exception as e:
        traceback.print_exc()
        prev = old_meta.get("lapisan", {}).get("udara", {})
        meta["lapisan"]["udara"] = {**prev, "ok": False, "galat": str(e)[:200]}
        pertahankan("udara.json", None)

    print("- ISPU stasiun resmi ...")
    try:
        ispu, info = fetch_ispu()
        (LIVE / "ispu.geojson").write_text(json.dumps(ispu, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        meta["lapisan"]["ispu"] = {"ok": True, "jumlah": len(ispu["features"]), "diambil": iso(NOW), **info}
        print(f"  {info}")
    except Exception as e:
        traceback.print_exc()
        prev = old_meta.get("lapisan", {}).get("ispu", {})
        meta["lapisan"]["ispu"] = {**prev, "ok": False, "galat": str(e)[:200]}
        pertahankan("ispu.geojson", fc([]))

    print("- berita terkait laporan ...")
    try:
        laporan = json.loads((LIVE / "laporan.geojson").read_text(encoding="utf-8"))
        berita, info = fetch_report_news(laporan)
        (LIVE / "berita_laporan.json").write_text(
            json.dumps(berita, separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
        meta["lapisan"]["berita_laporan"] = {"ok": True, "diambil": iso(NOW), **info}
        print(f"  {info}")
    except Exception as e:
        traceback.print_exc()
        meta["lapisan"]["berita_laporan"] = {"ok": False, "galat": str(e)[:200]}
        pertahankan("berita_laporan.json", {})

    print("- arsip RSS media ...")
    try:
        import berita as _b
        lama = load_previous("berita_arsip.json")
        arsip, n_ok = _b.perbarui_arsip(get, lama if isinstance(lama, list) else [], NOW)
        _b.ARSIP = arsip
        _b.GOOGLE_OFF = bool(os.environ.get("NO_GOOGLE"))  # uji: hanya arsip RSS
        (LIVE / "berita_arsip.json").write_text(json.dumps(arsip, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
        meta["lapisan"]["arsip_rss"] = {"ok": n_ok > 0, "diambil": iso(NOW), "media_ok": n_ok, "jumlah": len(arsip)}
        print(f"  {len(arsip)} berita dari {n_ok} feed")
    except Exception as e:
        traceback.print_exc()
        meta["lapisan"]["arsip_rss"] = {"ok": False, "galat": str(e)[:200]}

    print("- berita kejadian (gempa, banjir, karhutla) ...")
    try:
        info = fetch_event_news()
        meta["lapisan"]["berita_kejadian"] = {"ok": True, "diambil": iso(NOW), **info}
        print(f"  {info}")
    except Exception as e:
        traceback.print_exc()
        meta["lapisan"]["berita_kejadian"] = {"ok": False, "galat": str(e)[:200]}

    meta_path.write_text(json.dumps(meta, ensure_ascii=False, indent=1), encoding="utf-8")
    if not any(v.get("ok") for v in meta["lapisan"].values()):
        sys.exit("Semua sumber gagal")


if __name__ == "__main__":
    main()
