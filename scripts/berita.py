"""Berita terkait untuk tiap laporan warga, dari kanal berita resmi.

Cara kerja: untuk setiap laporan, susun kata kunci (jenis bencana + nama tempat di teks laporan
+ kabupaten/kota), cari lewat RSS pencarian Google News dengan jendela tanggal sekitar waktu
laporan, lalu saring:
  - hanya media/kanal resmi (daftar DOMAIN_RESMI),
  - judul harus memuat kata jenis bencana DAN nama tempat/kabupaten.
Yang disimpan hanya judul, nama media, waktu terbit, dan tautan (bukan isi artikel).
Hasil disimpan per laporan dan dipakai ulang antar-run (cache).
"""
import re
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from email.utils import parsedate_to_datetime
from html import unescape

GNEWS = "https://news.google.com/rss/search?q={q}&hl=id&gl=ID&ceid=ID:id"

DOMAIN_RESMI = [
    "kompas.com", "kompas.tv", "kompas.id", "detik.com", "antaranews.com", "cnnindonesia.com",
    "tempo.co", "liputan6.com", "tribunnews.com", "kumparan.com", "republika.co.id", "okezone.com",
    "sindonews.com", "suara.com", "cnbcindonesia.com", "mediaindonesia.com", "beritasatu.com",
    "idntimes.com", "merdeka.com", "inews.id", "metrotvnews.com", "rri.co.id", "tvrinews.com",
    "jawapos.com", "bisnis.com", "katadata.co.id", "viva.co.id", "medcom.id", "pikiran-rakyat.com",
    "tvonenews.com", "kompasiana.com", "beritajakarta.id", ".go.id",
]
DOMAIN_RESMI = [d for d in DOMAIN_RESMI if d != "kompasiana.com"]  # blog warga, bukan redaksi

# Kata kunci pencarian & akar kata yang wajib ada di judul, per jenis laporan.
JENIS = {
    "kebakaran": ("kebakaran OR terbakar", ("kebakaran", "terbakar", "dilalap", "hangus", "ludes", "api", "karhutla")),
    "banjir": ("banjir", ("banjir", "genang", "terendam", "luapan")),
    "angin kencang": ("angin OR \"puting beliung\" OR \"pohon tumbang\"", ("angin", "puting", "pohon tumbang", "beliung")),
    "gempa": ("gempa", ("gempa",)),
    "kabut asap": ("\"kabut asap\"", ("asap",)),
    "gunung api": ("erupsi OR \"gunung api\"", ("erupsi", "gunung", "awan panas")),
}

ADMIN_DEPAN = {"jalan", "jl", "jln", "desa", "kelurahan", "kecamatan", "dusun", "kampung", "kota",
               "kabupaten", "kab", "kawasan", "daerah", "wilayah", "komplek", "kompleks", "perumahan",
               "gang", "gg", "rt", "rw"}
PENANDA_LOKASI = r"\b(di|ke|kawasan|daerah|wilayah|sekitar|dekat|depan|seberang|area|lokasi)\s+$"
ADMIN_BELAKANG = {"raya", "utara", "selatan", "barat", "timur", "tengah"}  # hanya dibuang bila sisa >= 2 kata
ABAIKAN = {"senin", "selasa", "rabu", "kamis", "jumat", "sabtu", "minggu", "januari", "februari", "maret",
           "april", "mei", "juni", "juli", "agustus", "september", "oktober", "november", "desember",
           "indonesia", "kebakaran", "banjir", "hujan", "gempa", "angin", "karhutla", "bpbd", "damkar",
           "polsek", "polres", "pemadam", "tim", "warga", "pada", "sementara", "selain", "akibat"}


def _short_kab(nama):
    return re.sub(r"^(Kota|Kab\.)\s+", "", nama or "").strip()


def _place_phrases(text, kab_short, provinsi):
    """Nama tempat bercetak kapital di teks laporan, mis. 'Teluk Gong', 'Lawanggintung'."""
    found = []
    skip = {kab_short.lower(), (provinsi or "").lower()}
    text = text or ""
    for m in re.finditer(r"[A-Z][\w'\-]*(?:\s+(?:[A-Z][\w'\-]*|\d+))*", text):
        words = m.group().split()
        # Hanya frasa yang jelas menunjuk tempat: diawali kata administratif (Jalan, Desa, ...)
        # atau didahului penanda lokasi ("di", "kawasan", ...). Kata kapital di awal kalimat diabaikan.
        before = text[max(0, m.start() - 12):m.start()].lower()
        if not (words[0].lower().rstrip(".") in ADMIN_DEPAN or re.search(PENANDA_LOKASI, before)):
            continue
        while words and words[0].lower().rstrip(".") in ADMIN_DEPAN:
            words = words[1:]
        while len(words) > 2 and words[-1].lower() in ADMIN_BELAKANG:
            words = words[:-1]
        words = [w for w in words if w.lower() not in ABAIKAN]
        phrase = " ".join(words[:3]).strip(" ,.()")
        if len(phrase) < 4 or phrase.lower() in skip or phrase.lower() in found:
            continue
        if phrase.lower() in {"kota", "kabupaten"} or phrase.isupper() and len(phrase) <= 4:
            continue
        found.append(phrase.lower())
    return found


def _resmi(url):
    host = urllib.parse.urlparse(url or "").netloc.lower()
    return any(host == d or host.endswith("." + d.lstrip(".")) or (d.startswith(".") and host.endswith(d))
               for d in DOMAIN_RESMI)


def _search(get, query):
    raw = get(GNEWS.format(q=urllib.parse.quote(query)), timeout=30).decode("utf-8", "replace")
    out = []
    for item in re.findall(r"<item>(.*?)</item>", raw, re.S):
        def tag(name):
            m = re.search(rf"<{name}(?:\s[^>]*)?>(.*?)</{name}>", item, re.S)
            return unescape(m.group(1).strip()) if m else ""
        src_m = re.search(r'<source url="([^"]+)">(.*?)</source>', item, re.S)
        media = unescape(src_m.group(2)).strip() if src_m else ""
        judul = tag("title").replace("�", "–")
        if media and judul.endswith(" - " + media):
            judul = judul[: -len(media) - 3]
        try:
            terbit = parsedate_to_datetime(tag("pubDate")).astimezone(timezone.utc)
        except Exception:
            continue
        out.append({"judul": judul.strip(), "media": media, "situs": src_m.group(1) if src_m else "",
                    "tautan": tag("link"), "terbit": terbit})
    return out


def berita_untuk_laporan(get, lap):
    """lap = properties laporan (sudah berisi waktu, jenis, teks, kabupaten, provinsi)."""
    if lap["jenis"] not in JENIS:
        return []
    kw, akar = JENIS[lap["jenis"]]
    kab = _short_kab(lap.get("kabupaten"))
    tempat = _place_phrases(lap.get("teks"), kab, lap.get("provinsi"))[:2]
    waktu = datetime.fromisoformat(lap["waktu"].replace("Z", "+00:00"))
    after = (waktu - timedelta(days=1)).strftime("%Y-%m-%d")
    before = (waktu + timedelta(days=3)).strftime("%Y-%m-%d")

    queries = [(f'({kw}) "{t}"', t, "tempat") for t in tempat]
    if kab:
        queries.append((f'({kw}) "{kab}"', kab.lower(), "wilayah"))

    hasil, seen = [], set()
    for q, wajib, cocok in queries:
        try:
            items = _search(get, f"{q} after:{after} before:{before}")
        except Exception as e:
            print("    gagal cari:", q, e)
            continue
        finally:
            time.sleep(1.0)  # sopan ke server
        for it in items:
            j = it["judul"].lower()
            if not _resmi(it["situs"]):
                continue
            if not any(a in j for a in akar):
                continue
            kena_tempat = any(t in j for t in tempat)
            if wajib not in j and not kena_tempat and kab.lower() not in j:
                continue
            if not (waktu - timedelta(days=1) <= it["terbit"] <= waktu + timedelta(days=3)):
                continue
            key = re.sub(r"\W+", "", j)[:60]
            if key in seen:
                continue
            seen.add(key)
            # "tempat" = judul menyebut nama tempat dari laporan (kuat); "wilayah" = hanya kabupaten/kota
            hasil.append({**it, "cocok": "tempat" if (kena_tempat or cocok == "tempat") else "wilayah"})
        if len(hasil) >= 5:
            break
    hasil.sort(key=lambda x: (x["cocok"] != "tempat", x["terbit"]))
    return [{**h, "terbit": h["terbit"].strftime("%Y-%m-%dT%H:%M:%SZ")} for h in hasil[:6]]


# ======================================================================
# Berita untuk kejadian: gempa, banjir (BMKG/BNPB), karhutla (titik panas)
# ======================================================================
class Dibatasi(Exception):
    """Google News sedang membatasi (HTTP 429): hentikan pencarian di run ini, coba lagi nanti."""


_MAG_RE = re.compile(r"(?:\bm\s?|magnitud[eo]\s?|bermagnitudo\s?|gempa\s)(\d{1,2}[.,]\d)\b")


def cari(get, queries, akar, tempat, t0, t1, maks=6, tambahan=(), tolak=(), magnitudo=None):
    """Cari berita resmi yang judulnya memuat salah satu `akar` (jenis kejadian) DAN salah satu
    `tempat` (atau salah satu `tambahan`, mis. angka magnitudo), terbit di antara t0..t1.
    `tolak`: kata yang membuat judul ditolak. `magnitudo`: judul yang menyebut magnitudo lain ditolak."""
    tempat = [t.lower() for t in tempat if t and len(t) >= 3]
    tambahan = [t.lower() for t in tambahan if t]
    after = (t0 - timedelta(days=1)).strftime("%Y-%m-%d")
    before = (t1 + timedelta(days=1)).strftime("%Y-%m-%d")
    hasil, seen = [], set()
    for q in queries:
        try:
            items = _search(get, f"{q} after:{after} before:{before}")
        except Exception as e:
            if "429" in str(e):
                raise Dibatasi(str(e))
            print("    gagal cari:", q, e)
            continue
        finally:
            time.sleep(1.6)  # sopan ke server (Google News membatasi permintaan beruntun)
        for it in items:
            j = it["judul"].lower()
            if not _resmi(it["situs"]) or not any(a in j for a in akar):
                continue
            if any(w in j for w in tolak):
                continue
            if magnitudo is not None:
                lain = [float(x.replace(",", ".")) for x in _MAG_RE.findall(j)]
                if lain and all(abs(x - magnitudo) > 0.2 for x in lain):
                    continue  # berita gempa lain (magnitudo berbeda)
                # judul tanpa magnitudo: hanya bila terbit ≤ 24 jam setelah gempa (daerah rawan sering gempa lagi)
                if not lain and it["terbit"] > t0 + timedelta(hours=25):
                    continue
            if not (any(t in j for t in tempat) or any(t in j for t in tambahan)):
                continue
            if not (t0 <= it["terbit"] <= t1):
                continue
            key = re.sub(r"\W+", "", j)[:60]
            if key in seen:
                continue
            seen.add(key)
            hasil.append(it)
        if len(hasil) >= maks:
            break
    hasil.sort(key=lambda x: x["terbit"], reverse=True)  # terbaru dulu
    return [{**h, "terbit": h["terbit"].strftime("%Y-%m-%dT%H:%M:%SZ")} for h in hasil[:maks]]


_ARAH = r"(?:barat\s*daya|barat\s*laut|timur\s*laut|tenggara|barat|timur|utara|selatan)"


def tempat_gempa(lokasi, nama_wilayah):
    """'Pusat gempa berada di laut 49 km timur laut Ruteng, Manggarai' -> ['Ruteng', 'Manggarai'];
    '130 km BaratDaya MALUKUTENGGARA' -> ['Maluku Tenggara'] (dicocokkan ke daftar nama wilayah)."""
    s = lokasi or ""
    m = re.search(rf"\d+\s*km\s+{_ARAH}\s+(.+)$", s, re.I) or re.search(r"\bof\s+(.+)$", s, re.I)
    bagian = m.group(1) if m else s
    hasil = []
    for tok in re.split(r"[,\-–/]", bagian):
        tok = re.sub(r"^(kota|kab\.?|kabupaten)\s+", "", tok.strip(), flags=re.I)
        if not tok or tok.lower() in {"indonesia"}:
            continue
        kunci = re.sub(r"[^a-z]", "", tok.lower())
        nama = nama_wilayah.get(kunci) or (tok.title() if not tok.isupper() or " " in tok else None)
        if nama and nama not in hasil:
            hasil.append(nama)
    return hasil


def berita_gempa(get, p, nama_wilayah):
    M = p.get("magnitudo")
    if not M:
        return []
    waktu = datetime.fromisoformat(p["waktu"].replace("Z", "+00:00"))
    tempat = tempat_gempa(p.get("lokasi"), nama_wilayah)
    if p.get("kabupaten"):
        kab = _short_kab(p["kabupaten"])
        if kab not in tempat:
            tempat.append(kab)
    mag = [f"{M:.1f}".replace(".", ","), f"{M:.1f}"]
    queries = []
    if tempat:
        queries.append(f"gempa {mag[0]} {tempat[0]}")
        queries.append(f'gempa "{tempat[0]}"')
    else:
        queries.append(f'gempa "magnitudo {mag[0]}"')
    return cari(get, queries, ("gempa",), tempat, waktu - timedelta(hours=1), waktu + timedelta(days=3),
                tambahan=[f"m{mag[0]}", f"m {mag[0]}", f"m{mag[1]}", f"magnitudo {mag[0]}", f"m {mag[1]}"],
                magnitudo=M)


AKAR_BANJIR = ("banjir", "genang", "terendam", "luapan")
# Berita kebijakan/proyek (bukan kejadian) disaring keluar
TOLAK_BANJIR = ("anggaran", "dianggarkan", "apbd", "talud", "drainase", "pengendalian banjir", "proyek",
                "dicuri", "lelang", "tender", "normalisasi", "pengerukan", "dikeruk")
AKAR_KARHUTLA = ("karhutla", "kebakaran hutan", "kebakaran lahan", "lahan terbakar", "hutan terbakar",
                 "titik panas", "hotspot", "kabut asap", "lahan gambut")


def berita_banjir(get, tempat, t0, t1):
    tempat = [t for t in tempat if t][:8]
    if not tempat:
        return []
    ors = " OR ".join(f'"{t}"' for t in tempat)
    return cari(get, [f"(banjir OR genangan OR terendam) ({ors})"], AKAR_BANJIR, tempat, t0, t1, tolak=TOLAK_BANJIR)


def berita_karhutla(get, kab, t0, t1):
    kab = _short_kab(kab)
    if not kab:
        return []
    return cari(get, [f'(karhutla OR "kebakaran hutan" OR "kebakaran lahan" OR "lahan terbakar") "{kab}"'],
                AKAR_KARHUTLA, [kab], t0, t1)
