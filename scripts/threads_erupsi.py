"""Robot Threads What'sUpIndonesia: setiap erupsi gunung api baru dari MAGMA-VEN (Badan Geologi/PVMBG)
-> 1 posting Threads (foto resmi saat erupsi bila ada + teks ringkas).
Per gunung: posting pertama, lalu hanya bila status naik atau rekomendasi PVMBG berubah (lihat pilih()).

Jalan terus di VPS (systemd `wui-threads-erupsi`), cek MAGMA tiap 60 detik.
Memakai token & fungsi Threads dari threads_gempa.py (token diperbarui oleh robot gempa, bukan di sini).

Folder kerja (FOLDER, sama dengan robot gempa, bawaan /opt/wui/threads):
  mode_erupsi        "tahan" (bawaan: hanya draf, tidak posting) atau "terbit" (posting sungguhan)
  state_erupsi.json  erupsi yang sudah ditangani (agar tidak dobel) + waktu mulai robot

Pakai:
  python threads_erupsi.py              # jalan terus
  python threads_erupsi.py --sekali     # satu kali cek
  python threads_erupsi.py --draf N     # simulasi aturan pada N halaman VEN terakhir (uji), tidak posting, tidak menyentuh state
"""
import io
import json
import os
import re
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from html import unescape
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import _antara, _teks  # noqa: E402
from threads_gempa import FOLDER, GAMBAR, URL_GAMBAR, kini, log, panggil, terbitkan  # noqa: E402
from threads_teks import SINGKAT_PROV, BULAN  # noqa: E402

VEN = "https://magma.esdm.go.id/v1/gunung-api/informasi-letusan"
GUNUNG = os.environ.get("WUI_GUNUNG", "https://data.whatsupindonesia.id/data/live/gunung_api.geojson")
JEDA_CEK = 60                       # detik antar-cek MAGMA
UMUR_MAKS = timedelta(hours=3)      # erupsi lebih tua dari ini tidak diposting
MAKS_PER_HARI = 30                  # pengaman
# Aturan posting per gunung (untuk kesadaran masyarakat, bukan setiap letusan):
#   1. gunung belum pernah kita posting -> posting erupsi terbarunya;
#   2. status level naik dibanding erupsi sebelumnya -> posting;
#   3. rekomendasi PVMBG berubah (jarak/radius bahaya berganti) -> posting.
ZONA = {"WIB": 7, "WITA": 8, "WIT": 9}
BULAN_ID = {b: i + 1 for i, b in enumerate("januari februari maret april mei juni juli agustus september oktober "
                                           "november desember".split())}
PROVINSI = set(SINGKAT_PROV) | {"Aceh", "Riau", "Jambi", "Bengkulu", "Lampung", "Banten", "Bali", "Gorontalo",
                                 "Maluku", "Papua", "Papua Barat", "Papua Barat Daya", "Papua Tengah",
                                 "Papua Pegunungan", "Papua Selatan", "Daerah Istimewa Yogyakarta"}
LEVEL = {1: "Level I (Normal)", 2: "Level II (Waspada)", 3: "Level III (Siaga)", 4: "Level IV (Awas)"}


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (WhatsUpIndonesia)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


def bersih(html):
    return re.sub(r"\s+", " ", unescape(re.sub(r"<[^>]+>", " ", html))).strip()


# ---------------------------------------------------------------- MAGMA-VEN
def baca_ven(isi):
    """Daftar erupsi terbaru dari halaman Informasi Letusan (terbaru dulu)."""
    hasil = []
    for blk in isi.split('<div class="timeline-item">')[1:]:
        det = re.search(r'href="(https://magma\.esdm\.go\.id/v1/gunung-api/informasi-letusan/([0-9a-f-]+)/show)"', blk)
        nama = re.search(r'timeline-title">\s*<a[^>]*>([^<]+)', blk)
        teks = re.search(r'timeline-text">(.*?)</p>', blk, re.S)
        if not (det and nama and teks):
            continue
        t = bersih(teks.group(1))
        w = re.search(r"(\d{1,2}) (\w+) (\d{4}), pukul (\d{1,2})[:.](\d{2}) (WIB|WITA|WIT)", t)
        if not w or w.group(2).lower() not in BULAN_ID:
            continue
        lokal = datetime(int(w.group(3)), BULAN_ID[w.group(2).lower()], int(w.group(1)), int(w.group(4)), int(w.group(5)))
        img = re.search(r'<img class="bd img-fluid" src="(https?://[^"]+)"', blk)
        e = {"id": det.group(2), "tautan": det.group(1), "nama": nama.group(1).strip(), "teks": t,
             "waktu": (lokal - timedelta(hours=ZONA[w.group(6)])).replace(tzinfo=timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
             "jam_lokal": f"{lokal.day} {BULAN[lokal.month - 1]}, {lokal:%H.%M} {w.group(6)}",
             "foto": img.group(1) if img else None}
        if m := re.search(r"kolom abu teramati \S* ?([\d.,]+) m di atas puncak \(\S* ?([\d.,]+) m di atas permukaan laut\)", t):
            e["kolom_m"], e["kolom_mdpl"] = m.group(1), m.group(2)
        if m := re.search(r"Kolom abu teramati berwarna ([^.]+?) dengan intensitas (\w+(?: \w+)?) (?:condong )?ke arah ([\w ]+?)\.", t):
            e["warna"], e["intensitas"], e["arah"] = m.group(1), m.group(2), m.group(3)
        if m := re.search(r"amplitudo maksimum ([\d.,]+) mm dan durasi ([\d.,]+) detik", t):
            e["amplitudo"], e["durasi"] = m.group(1), m.group(2)
        e["tak_teramati"] = "tidak teramati" in t
        e["berlangsung"] = "masih berlangsung" in t
        hasil.append(e)
    return hasil


def info_gunung():
    """Nama gunung (huruf kecil) -> properti dari peta kita (level & lokasi resmi MAGMA)."""
    try:
        return {f["properties"]["nama"].lower(): f["properties"] for f in json.loads(get(GUNUNG))["features"]}
    except Exception as e:
        log("data gunung gagal:", type(e).__name__, str(e)[:120])
        return {}


def singkat_lokasi(lokasi):
    """'Lumajang, Malang, Jawa Timur' -> 'Lumajang, Malang, Jatim'; daftar panjang dipotong 2 kabupaten."""
    if not lokasi:
        return ""
    bagian = [x.strip() for x in re.split(r",| dan ", lokasi) if x.strip()]
    prov = [x for x in bagian if x in PROVINSI]
    kab = [x for x in bagian if x not in PROVINSI][:2]
    return ", ".join(kab + [SINGKAT_PROV.get(x, x) for x in prov])


def angka(s):
    """'1500' -> '1.500', '33.02' -> '33'."""
    try:
        return f"{round(float(s.replace(',', '.'))):,}".replace(",", ".")
    except ValueError:
        return s


def teks_erupsi(e, g, alasan=None, ke=1):
    lok = singkat_lokasi((g or {}).get("lokasi"))
    baris = [f"🌋 Erupsi G. {e['nama']}" + (f" · {lok}" if lok else ""), f"🕓 {e['jam_lokal']}"]
    if alasan:
        baris.append(f"🔺 {alasan}" + (f" · erupsi ke-{ke} dalam 24 jam" if ke > 1 else ""))
    if e.get("kolom_m"):
        k = f"💨 Kolom abu ±{angka(e['kolom_m'])} m di atas puncak (±{angka(e['kolom_mdpl'])} mdpl)"
        if e.get("arah"):
            k += f", condong ke {e['arah'].lower()}"
        baris.append(k)
    elif e["tak_teramati"]:
        baris.append("👁️ Visual letusan tidak teramati")
    if e.get("amplitudo"):
        baris.append(f"📈 Seismograf: amplitudo {angka(e['amplitudo'])} mm, durasi {angka(e['durasi'])} detik"
                     + (" · masih berlangsung" if e["berlangsung"] else ""))
    elif e["berlangsung"]:
        baris.append("📈 Saat laporan dibuat, erupsi masih berlangsung")
    if g and g.get("level") in LEVEL:
        baris.append(f"⚠️ Status {LEVEL[g['level']]}")
    akhir = ["", "Peta gunung api & status terkini 👇", "whatsupindonesia.id",
             "Sumber" + (" & foto" if e.get("foto") else "") + ": PVMBG / MAGMA Indonesia"]
    # rekomendasi utama (yang menyebut radius bahaya): utuh di posting bila muat (< 500 karakter; emoji bisa
    # dihitung 2), kalau kepanjangan -> semua rekomendasi PVMBG dipindah ke komentar di bawah posting.
    poin = rekomendasi_lengkap(g)
    rek = next((p for p in poin if re.search(r"\d+(?:[.,]\d+)?\s*(?:km|kilometer|meter)\b", p, re.I)), None)
    komentar = []
    if rek:
        if len("\n".join(baris + [f"📢 {rek}"] + akhir)) <= 470:
            baris.append(f"📢 {rek}")
        else:
            baris.append("📢 Rekomendasi PVMBG ada di komentar 👇")
            komentar = potong_komentar(f"📢 Rekomendasi PVMBG untuk G. {e['nama']}:", poin)
    return "\n".join(baris + akhir), komentar


def rekomendasi_lengkap(g):
    """Semua poin rekomendasi dari laporan aktivitas MAGMA terbaru (utuh); cadangan: versi ringkas di peta kita."""
    if g and g.get("tautan"):
        try:
            t = _teks(get(g["tautan"]).decode("utf-8", "replace"))
            rek = _antara(t, "Rekomendasi", ["Laporan Aktivitas Lainnya", "Tweet", "Copyright", "©"], maks=5000) or ""
            poin = [re.sub(r"^(?:\d{1,2}\.|\(\d{1,2}\))\s*", "", x).strip()
                    for x in re.split(r"\s(?=\d{1,2}\.\s)|(?=\(\d{1,2}\))", " " + rek)]
            poin = [x for x in poin if len(x) > 12 and x.lower() != "rekomendasi"]
            if poin:
                return poin
        except Exception as x:
            log("  laporan MAGMA gagal dibaca:", type(x).__name__, str(x)[:120])
    return [p.strip().rstrip("…") for r in (g or {}).get("rekomendasi") or [] for p in re.split(r"\(\d\)", r) if p.strip()]


def potong_komentar(judul, poin, batas=470, maks=3):
    """Poin bernomor dibagi ke beberapa komentar (masing-masing < 500 karakter), paling banyak `maks` komentar."""
    hasil, kini_ = [], judul
    for i, p in enumerate(poin, 1):
        b = f"{i}. {p}"
        if len(b) > batas - 10:
            b = b[:batas - 11].rsplit(" ", 1)[0].rstrip(",;") + "…"
        if len(kini_) + 2 + len(b) > batas:
            hasil.append(kini_)
            kini_ = b
        else:
            kini_ = f"{kini_}\n\n{b}" if kini_ else b
    if kini_:
        hasil.append(kini_)
    return hasil[:maks]


# ---------------------------------------------------------------- state & inti
def mode():
    p = FOLDER / "mode_erupsi"
    return p.read_text(encoding="utf-8").strip() if p.exists() else "tahan"


def baca_state():
    p = FOLDER / "state_erupsi.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    return {"mulai": kini().strftime("%Y-%m-%dT%H:%M:%SZ"), "erupsi": {}}   # erupsi lama TIDAK diposting


def simpan_state(st):
    p = FOLDER / "state_erupsi.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, p)


def simpan_foto(url, nama):
    """Foto VEN diunduh & disajikan ulang dari server kita (JPEG) agar Threads pasti bisa mengambilnya."""
    from PIL import Image
    im = Image.open(io.BytesIO(get(url, timeout=60))).convert("RGB")
    GAMBAR.mkdir(parents=True, exist_ok=True)
    f = GAMBAR / f"erupsi_{nama}.jpg"
    im.save(f, "JPEG", quality=90)
    return URL_GAMBAR + f.name


def kolom(x):
    try:
        return float(str(x.get("kolom_m") or 0).replace(".", "").replace(",", "."))
    except ValueError:
        return 0.0


def tanda_rekom(g):
    """Ciri rekomendasi PVMBG: semua jarak bahaya yang disebut (mis. '5km 13km 500m'). Berubah = rekomendasi berubah."""
    teks = " ".join((g or {}).get("rekomendasi") or [])
    jarak = re.findall(r"(\d+(?:[.,]\d+)?)\s*(km|kilometer|meter)\b", teks, re.I)
    return " ".join(sorted({a.replace(",", ".") + ("km" if b.lower().startswith("k") else "m") for a, b in jarak}))


def pilih(e, g, st):
    """(posting?, alasan, erupsi_ke_dalam_24_jam) untuk erupsi e — lihat aturan di atas."""
    t = datetime.fromisoformat(e["waktu"].replace("Z", "+00:00"))
    lalu = sorted((c for c in st["erupsi"].values() if c.get("nama") == e["nama"] and c["waktu"] <= e["waktu"]),
                  key=lambda c: c["waktu"])
    ke = 1 + sum(1 for c in lalu if t - datetime.fromisoformat(c["waktu"].replace("Z", "+00:00")) < timedelta(hours=24))
    if not any(c.get("status") in ("terbit", "draf") for c in lalu):
        return True, None, ke
    sebelum = lalu[-1]                      # dibanding erupsi terakhir gunung ini (diposting atau tidak)
    lv = (g or {}).get("level") or 0
    if lv > (sebelum.get("level") or 0) > 0:
        return True, f"Status naik ke {LEVEL.get(lv, lv)}", ke
    rk = tanda_rekom(g)
    if rk and sebelum.get("rekom") and rk != sebelum["rekom"]:
        return True, "Rekomendasi PVMBG berubah", ke
    return False, None, ke


def tangani(e, g, st, uji=False, alasan=None, ke=1):
    log(f"erupsi {e['nama']} {e['jam_lokal']} ({e['id'][:8]}) ...")
    url_foto = None
    for coba in range(3):                       # DNS/server MAGMA kadang gagal sesaat
        if not e.get("foto"):
            break
        try:
            url_foto = simpan_foto(e["foto"], e["id"][:8])
            break
        except Exception as x:
            log(f"  foto gagal (percobaan {coba + 1}):", type(x).__name__, str(x)[:120])
            time.sleep(5)
    teks, komentar = teks_erupsi({**e, "foto": url_foto}, g, alasan, ke)   # "Sumber & foto" hanya bila foto ikut
    GAMBAR.mkdir(parents=True, exist_ok=True)
    (GAMBAR / f"erupsi_{e['id'][:8]}.txt").write_text(
        "\n\n".join([teks] + [f"--- komentar {i} ---\n{k}" for i, k in enumerate(komentar, 1)]), encoding="utf-8")
    catatan = {"nama": e["nama"], "waktu": e["waktu"], "gambar": url_foto, "kolom": kolom(e),
               "level": (g or {}).get("level"), "rekom": tanda_rekom(g), "alasan": alasan,
               "ditangani": kini().strftime("%Y-%m-%dT%H:%M:%SZ")}
    if uji or mode() != "terbit":
        catatan["status"] = "draf"
        log("  draf saja (tidak diposting):", url_foto or "(tanpa foto)")
    else:
        pid, link = terbitkan(teks, url_foto)
        catatan.update(status="terbit", threads_id=pid, permalink=link)
        log("  TERBIT:", link or pid)
        for k in komentar:                     # posting utama sudah terbit; komentar gagal tidak diulang
            try:
                balas(pid, k)
            except Exception as x:
                log("  komentar rekomendasi GAGAL:", type(x).__name__, str(x)[:200])
                break
    st["erupsi"][e["id"]] = catatan
    if not uji:
        simpan_state(st)
    return "\n\n".join([teks] + [f"--- komentar {i} ---\n{k}" for i, k in enumerate(komentar, 1)])


def balas(pid, teks):
    """Komentar (balasan) teks di bawah posting kita sendiri."""
    cid = panggil("me/threads", {"media_type": "TEXT", "text": teks, "reply_to_id": pid})["id"]
    for _ in range(12):
        time.sleep(5)
        if panggil(cid, {"fields": "status"}, post=False).get("status") == "FINISHED":
            break
    return panggil("me/threads_publish", {"creation_id": cid})["id"]


def lewati(e, g, st, ke, uji=False):
    """Erupsi lanjutan tanpa perubahan status/rekomendasi: dicatat (untuk pembanding & 'erupsi ke-N'), tidak diposting."""
    log(f"erupsi {e['nama']} {e['jam_lokal']}: lewati (erupsi ke-{ke} dalam 24 jam; status & rekomendasi tetap)")
    st["erupsi"][e["id"]] = {"nama": e["nama"], "waktu": e["waktu"], "kolom": kolom(e), "level": (g or {}).get("level"),
                             "rekom": tanda_rekom(g), "status": "lewati", "ditangani": kini().strftime("%Y-%m-%dT%H:%M:%SZ")}
    if not uji:
        simpan_state(st)


def cek(st):
    daftar = baca_ven(get(VEN).decode("utf-8", "replace"))
    batas = max(datetime.fromisoformat(st["mulai"].replace("Z", "+00:00")), kini() - UMUR_MAKS)
    baru = [e for e in daftar if e["id"] not in st["erupsi"]
            and datetime.fromisoformat(e["waktu"].replace("Z", "+00:00")) > batas]
    if not baru:
        return
    gunung = info_gunung()
    sehari = sum(1 for c in st["erupsi"].values() if c.get("status") == "terbit"
                 and kini() - datetime.fromisoformat(c["ditangani"].replace("Z", "+00:00")) < timedelta(days=1))
    for e in sorted(baru, key=lambda x: x["waktu"]):
        if sehari >= MAKS_PER_HARI:
            log("batas harian tercapai, erupsi ditunda:", e["nama"], e["waktu"])
            break
        try:
            g = gunung.get(e["nama"].lower())
            pos, alasan, ke = pilih(e, g, st)
            if not pos:
                lewati(e, g, st, ke)
                continue
            tangani(e, g, st, alasan=alasan, ke=ke)
            sehari += st["erupsi"][e["id"]].get("status") == "terbit"
        except Exception as x:
            log("  GAGAL:", type(x).__name__, str(x)[:300])   # dicoba lagi pada cek berikutnya


def main():
    FOLDER.mkdir(parents=True, exist_ok=True)
    if "--draf" in sys.argv:
        # uji: simulasi aturan pada N halaman VEN terakhir (urut waktu), tidak posting, tidak menyentuh state
        n = int(sys.argv[sys.argv.index("--draf") + 1])
        gunung = info_gunung()
        daftar = [e for h in range(1, n + 1) for e in baca_ven(get(f"{VEN}?page={h}").decode("utf-8", "replace"))]
        st = {"erupsi": {}}
        for e in sorted({e["id"]: e for e in daftar}.values(), key=lambda x: x["waktu"]):
            g = gunung.get(e["nama"].lower())
            pos, alasan, ke = pilih(e, g, st)
            if pos:
                print("-" * 40)
                print(tangani(e, g, st, uji=True, alasan=alasan, ke=ke))
            else:
                lewati(e, g, st, ke, uji=True)
        return
    st = baca_state()
    simpan_state(st)
    log(f"robot Threads erupsi mulai · mode {mode()} · hanya erupsi setelah {st['mulai']}")
    while True:
        try:
            cek(st)
        except Exception as x:
            log("cek gagal:", type(x).__name__, str(x)[:200])
        if "--sekali" in sys.argv:
            return
        time.sleep(JEDA_CEK)


if __name__ == "__main__":
    main()
