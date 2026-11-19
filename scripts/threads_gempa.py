"""Robot Threads What'sUpIndonesia: setiap gempa baru dari BMKG -> gambar kartu dari situs + teks -> posting Threads.

Jalan terus di VPS (systemd `wui-threads`), cek BMKG tiap 30 detik.

Folder kerja (FOLDER, bawaan /opt/wui/threads):
  token       token akses Threads (izin 600; diisi Erick sendiri, TIDAK pernah dicetak ke log)
  mode        "tahan" (bawaan: hanya membuat draf, tidak posting) atau "terbit" (posting sungguhan)
  state.json  gempa yang sudah ditangani (agar tidak dobel) + waktu mulai robot
Gambar disajikan nginx di GAMBAR (bawaan /var/www/wui/threads) = https://data.whatsupindonesia.id/threads/...

Pakai:
  python threads_gempa.py                 # jalan terus
  python threads_gempa.py --sekali        # satu kali cek
  python threads_gempa.py --draf <waktu>  # buat draf untuk satu gempa (uji), tidak posting
"""
import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import DATA, fetch_quakes_bmkg  # noqa: E402
from geo import RegionIndex  # noqa: E402
from threads_teks import teks_gempa  # noqa: E402

FOLDER = Path(os.environ.get("WUI_THREADS", "/opt/wui/threads"))
GAMBAR = Path(os.environ.get("WUI_THREADS_GAMBAR", "/var/www/wui/threads"))
URL_GAMBAR = os.environ.get("WUI_THREADS_URL", "https://data.whatsupindonesia.id/threads/")
SITUS = os.environ.get("WUI_SITUS", "https://whatsupindonesia.id/")
API = "https://graph.threads.net/v1.0/"
JEDA_CEK = 30                      # detik antar-cek BMKG
UMUR_MAKS = timedelta(hours=3)     # gempa lebih tua dari ini tidak diposting (mis. baru muncul belakangan di daftar)
MAKS_PER_HARI = 40                 # pengaman (batas Threads 250/hari)


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def kini():
    return datetime.now(timezone.utc)


# ---------------------------------------------------------------- state
def baca_state():
    p = FOLDER / "state.json"
    if p.exists():
        return json.loads(p.read_text(encoding="utf-8"))
    # pertama kali: gempa yang sudah ada TIDAK diposting (hanya gempa setelah robot mulai)
    return {"mulai": kini().strftime("%Y-%m-%dT%H:%M:%SZ"), "gempa": {}}


def simpan_state(st):
    p = FOLDER / "state.json"
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps(st, ensure_ascii=False, indent=1), encoding="utf-8")
    os.replace(tmp, p)


def mode():
    p = FOLDER / "mode"
    return p.read_text(encoding="utf-8").strip() if p.exists() else "tahan"


# ---------------------------------------------------------------- gambar
def foto_kartu(waktu, keluar):
    from playwright.sync_api import sync_playwright
    with sync_playwright() as p:
        b = p.chromium.launch(args=["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"])
        try:
            pg = b.new_page(viewport={"width": 540, "height": 675}, device_scale_factor=2, color_scheme="dark",
                            locale="id-ID", timezone_id="Asia/Jakarta")
            pg.goto(f"{SITUS}?kartu&tanpa-panduan&gempa={urllib.parse.quote(waktu)}", wait_until="networkidle", timeout=90000)
            pg.wait_for_function("document.body.dataset.siap", timeout=90000)
            status = pg.evaluate("document.body.dataset.siap")
            if status != "1":
                raise RuntimeError(f"kartu tidak siap: {status}")
            pg.screenshot(path=str(keluar))
        finally:
            b.close()


# ---------------------------------------------------------------- Threads API
def token():
    return (FOLDER / "token").read_text(encoding="utf-8").strip()


def panggil(path, params=None, post=True):
    params = dict(params or {}, access_token=token())
    data = urllib.parse.urlencode(params).encode()
    if post:
        req = urllib.request.Request(API + path, data=data, method="POST")
    else:
        req = urllib.request.Request(API + path + "?" + data.decode())
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            return json.loads(r.read())
    except urllib.error.HTTPError as e:
        isi = e.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"Threads API {path}: HTTP {e.code} {isi}") from None


def perbarui_token():
    """Token Threads berlaku 60 hari; perbarui bila sudah >7 hari sejak terakhir (minimal umur 24 jam)."""
    p = FOLDER / "token"
    if not p.exists() or time.time() - p.stat().st_mtime < 7 * 86400:
        return
    q = urllib.parse.urlencode({"grant_type": "th_refresh_token", "access_token": token()})
    try:
        with urllib.request.urlopen("https://graph.threads.net/refresh_access_token?" + q, timeout=60) as r:
            baru = json.loads(r.read())["access_token"]
        tmp = p.with_suffix(".tmp")
        tmp.write_text(baru, encoding="utf-8")
        os.chmod(tmp, 0o600)
        os.replace(tmp, p)
        log("token Threads diperbarui (berlaku 60 hari lagi)")
    except Exception as e:  # jangan cetak token
        log("GAGAL memperbarui token Threads:", type(e).__name__, str(e)[:200])


def terbitkan(teks, url_gambar):
    cid = panggil("me/threads", {"media_type": "IMAGE", "image_url": url_gambar, "text": teks})["id"]
    for _ in range(24):                       # tunggu Threads selesai mengambil gambar (maks ±2 menit)
        time.sleep(5)
        st = panggil(cid, {"fields": "status,error_message"}, post=False)
        if st.get("status") == "FINISHED":
            break
        if st.get("status") in ("ERROR", "EXPIRED"):
            raise RuntimeError(f"Threads menolak media: {st}")
    pid = panggil("me/threads_publish", {"creation_id": cid})["id"]
    try:
        return pid, panggil(pid, {"fields": "permalink"}, post=False).get("permalink")
    except Exception:
        return pid, None


# ---------------------------------------------------------------- inti
def nama_file(waktu):
    return waktu.replace(":", "").replace("-", "")


def tangani(p, st, uji=False):
    waktu = p["waktu"]
    teks = teks_gempa(p)
    GAMBAR.mkdir(parents=True, exist_ok=True)
    f = GAMBAR / f"{nama_file(waktu)}.png"
    log(f"gempa {waktu} M{p.get('magnitudo')} {p.get('kabupaten') or p.get('lokasi')}: membuat gambar ...")
    foto_kartu(waktu, f)
    (GAMBAR / f"{nama_file(waktu)}.txt").write_text(teks, encoding="utf-8")
    catatan = {"magnitudo": p.get("magnitudo"), "lokasi": p.get("lokasi"), "gambar": URL_GAMBAR + f.name,
               "ditangani": kini().strftime("%Y-%m-%dT%H:%M:%SZ")}
    if uji or mode() != "terbit":
        catatan["status"] = "draf"
        log("  draf saja (tidak diposting):", catatan["gambar"])
    else:
        pid, link = terbitkan(teks, catatan["gambar"])
        catatan.update(status="terbit", threads_id=pid, permalink=link)
        log("  TERBIT:", link or pid)
    st["gempa"][waktu] = catatan
    if not uji:
        simpan_state(st)


def cek(st, regions):
    gempa = [f["properties"] for f in fetch_quakes_bmkg(regions)]
    batas = max(datetime.fromisoformat(st["mulai"].replace("Z", "+00:00")), kini() - UMUR_MAKS)
    baru = [p for p in gempa if p["waktu"] not in st["gempa"]
            and datetime.fromisoformat(p["waktu"].replace("Z", "+00:00")) > batas]
    sehari = sum(1 for c in st["gempa"].values() if c.get("status") == "terbit"
                 and kini() - datetime.fromisoformat(c["ditangani"].replace("Z", "+00:00")) < timedelta(days=1))
    for p in sorted(baru, key=lambda x: x["waktu"]):
        if sehari >= MAKS_PER_HARI:
            log("batas harian tercapai, gempa ditunda:", p["waktu"])
            break
        try:
            tangani(p, st)
            sehari += st["gempa"][p["waktu"]].get("status") == "terbit"
        except Exception as e:
            log("  GAGAL:", type(e).__name__, str(e)[:300])   # dicoba lagi pada cek berikutnya


def main():
    FOLDER.mkdir(parents=True, exist_ok=True)
    st = baca_state()
    simpan_state(st)
    regions = RegionIndex(DATA / "wilayah.geojson")
    if "--draf" in sys.argv:
        waktu = sys.argv[sys.argv.index("--draf") + 1]
        p = next(f["properties"] for f in fetch_quakes_bmkg(regions) if f["properties"]["waktu"] == waktu)
        tangani(p, {"gempa": {}}, uji=True)   # uji: tidak posting, tidak menyentuh state.json
        return
    log(f"robot Threads mulai · mode {mode()} · hanya gempa setelah {st['mulai']}")
    while True:
        try:
            perbarui_token()
            cek(st, regions)
        except Exception as e:
            log("cek gagal:", type(e).__name__, str(e)[:200])
        if "--sekali" in sys.argv:
            return
        time.sleep(JEDA_CEK)


if __name__ == "__main__":
    main()
