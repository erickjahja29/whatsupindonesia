"""Robot hujan What'sUpIndonesia: perkiraan "di mana sedang hujan sekarang" untuk seluruh Indonesia.

Jalan di VPS (systemd `wui-hujan.timer`, tiap 2 menit; hanya bekerja bila ada citra satelit baru, tiap 10 menit).

Langkah per citra:
 1. Satelit Himawari kanal 13 (inframerah, suhu puncak awan) dari JMA (badan cuaca Jepang), ubin peta zoom 5 (±5 km),
    tersedia ±6–10 menit setelah pemindaian. Abu-abu JPEG -> suhu (°C) memakai tabel kalibrasi terhadap NASA GIBS.
 2. Suhu -> intensitas hujan (Auto-Estimator, Vicente dkk. 1998), lalu disaring:
    - inti konvektif: piksel yang lebih dingin dari sekitarnya (±60 km) dapat hujan penuh, sisanya dikurangi
      (cara Hydro-Estimator NOAA; mengurangi "hujan palsu" di bentangan awan cirrus/landasan),
    - siang hari: awan dingin tapi tipis (pantulan kanal 3 rendah) = cirrus, bukan awan hujan.
 3. Koreksi parallax: awan tinggi tampak bergeser menjauhi titik bawah satelit (140,7° BT); digeser balik.
 4. Frame terbaru: gerak awan dari dua citra berurutan -> hujan digeser ke posisi perkiraan "sekarang".
 5. Koreksi pengamatan bandara (METAR): di sekitar bandara (L = 15 km) perkiraan ditarik ke laporan bandara.
 6. Masker daratan Indonesia (+±5 km pantai) disimpan terpisah (darat.png): animasi rintik hanya di darat.
Keluaran (nginx /data/hujan/): <waktu>.png (abu-abu: mm/jam = (v/40)^2) + hujan.json (daftar frame, batas peta, bandara).
"""
import io
import json
import math
import os
import sys
import time
import urllib.request
from datetime import datetime, timedelta, timezone
from pathlib import Path

import numpy as np
from PIL import Image

sys.path.insert(0, str(Path(__file__).resolve().parent))
from fetch_data import BBOX, DATA, METAR_URL, nilai_hujan_metar  # noqa: E402
from geo import iter_polygons  # noqa: E402

KELUAR = Path(os.environ.get("WUI_HUJAN", "/var/www/wui/data/hujan"))
VALIDASI = Path(os.environ.get("WUI_HUJAN_VALIDASI", "/opt/wui/hujan_validasi.jsonl"))   # catatan akurasi (tidak publik)
JMA = "https://www.jma.go.jp/bosai/himawari/data/satimg/"
Z, X0, X1, Y0, Y1 = 5, 24, 28, 15, 16                 # ubin zoom 5 yang menutupi Indonesia (90–146,25° BT, ±11,18°)
W, H = (X1 - X0 + 1) * 256, (Y1 - Y0 + 1) * 256
N_FRAME = 6                                            # 1 jam terakhir (tiap 10 menit)
SUB_LON = 140.7                                        # titik bawah satelit Himawari-9
L_KM, W0 = 15.0, 0.25                                  # koreksi bandara: jangkauan & bobot satelit

# Kalibrasi abu-abu JMA B13 -> suhu puncak awan (°C), median terhadap NASA GIBS (3 waktu, ±360 ribu piksel, 20 Nov 2026)
KAL_ABU = [0, 30, 60, 100, 140, 160, 180, 200, 220, 235, 255]
KAL_C = [35, 19, 8, -6, -14, -22, -32, -46, -57, -66, -80]


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


def get(url, timeout=40):
    req = urllib.request.Request(url, headers={"User-Agent": "WhatsUpIndonesia/1.0 (hujan)"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read()


# ---------------------------------------------------------------- geometri piksel (Web Mercator zoom 5)
def _lon_lat_grid():
    n = 2 ** Z * 256
    x = (np.arange(W) + X0 * 256 + 0.5) / n
    y = (np.arange(H) + Y0 * 256 + 0.5) / n
    lon = x * 360 - 180
    lat = np.degrees(np.arctan(np.sinh(np.pi * (1 - 2 * y))))
    return np.meshgrid(lon, lat)


LON, LAT = _lon_lat_grid()
KM_PX = 40075.0 * np.cos(np.radians(LAT)) / (2 ** Z * 256)          # km per piksel (berubah menurut lintang)


def batas():
    n = 2 ** Z
    lon = lambda x: x / n * 360 - 180  # noqa: E731
    lat = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))  # noqa: E731
    w, e, u, s = lon(X0), lon(X1 + 1), lat(Y0), lat(Y1 + 1)
    return [[w, u], [e, u], [e, s], [w, s]]


# ---------------------------------------------------------------- citra JMA
def waktu_tersedia():
    d = json.loads(get(JMA + "targetTimes_fd.json"))
    return sorted({x["validtime"] for x in d})


def mosaik(t, band, kind):
    img = np.zeros((H, W), dtype=np.float32)
    for x in range(X0, X1 + 1):
        for y in range(Y0, Y1 + 1):
            b = get(f"{JMA}{t}/fd/{t}/{band}/{kind}/{Z}/{x}/{y}.jpg")
            img[(y - Y0) * 256:(y - Y0 + 1) * 256, (x - X0) * 256:(x - X0 + 1) * 256] = \
                np.asarray(Image.open(io.BytesIO(b)).convert("L"), dtype=np.float32)
    return img


def suhu(abu):
    return np.interp(abu, KAL_ABU, KAL_C).astype(np.float32)


# ---------------------------------------------------------------- suhu -> hujan
AMBANG_C = -25.0   # puncak awan lebih dingin dari ini = hujan (kalibrasi METAR 20 Nov 2026: POD 0,74, FAR 0,53, CSI 0,40)


def hujan_dari_suhu(T):
    """Suhu puncak awan (°C) -> perkiraan hujan (mm/jam).
    Di Indonesia banyak hujan ringan turun dari awan yang puncaknya 'hangat' (−10 s.d. −30 °C), yang luput dari
    Auto-Estimator murni (ambang −23 °C, nilai kecil). Jadi: di bawah AMBANG_C minimal hujan ringan (0,5 → 2 mm/jam
    sampai −40 °C), dan untuk awan sangat dingin dipakai Auto-Estimator (Vicente dkk. 1998)."""
    K = T + 273.15
    ae = 1.1183e11 * np.exp(-3.6382e-2 * np.power(K, 1.2))
    landai = 0.5 + 1.5 * np.clip((AMBANG_C - T) / 15.0, 0, 1)
    R = np.where(T < AMBANG_C, np.maximum(ae, landai), 0)
    return np.minimum(R, 80).astype(np.float32)


HANGAT_C, HANGAT_ALB, HANGAT_ELEV = 5.0, 190.0, 20.0


def elevasi_matahari(t):
    """Sudut tinggi matahari (derajat) di tiap piksel pada waktu citra t."""
    w = datetime.strptime(t, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc) + timedelta(minutes=6)
    hari = w.timetuple().tm_yday
    dek = np.radians(-23.44 * math.cos(2 * math.pi / 365 * (hari + 10)))
    sudut_jam = np.radians(15 * (w.hour + w.minute / 60 + LON / 15 - 12))
    la = np.radians(LAT)
    return np.degrees(np.arcsin(np.sin(la) * np.sin(dek) + np.cos(la) * np.cos(dek) * np.cos(sudut_jam)))


def hujan_awan_hangat(t, T):
    """Siang hari: awan tebal (sangat terang di kanal tampak B03) yang puncaknya 'hangat' (< 5 °C) sering
    menurunkan hujan ringan, terutama di pegunungan (mis. Bromo), dan luput dari ambang IR −25 °C.
    Kecerahan dinormalkan dengan sudut matahari lalu dirata-rata 3×3 piksel.
    Kalibrasi METAR siang 18–20 Nov 2026 (351 pasangan): CSI 0,48 → 0,50, POD 0,76 → 0,90, FAR 0,44 → 0,47
    (ambang 190, sedikit di bawah optimum 195–200, supaya hujan orografis seperti di Bromo 20 Nov 10.20 WIB ikut tertangkap)."""
    el = elevasi_matahari(t)
    if el.max() < HANGAT_ELEV:
        return np.zeros_like(T)
    A = mosaik(t, "B03", "ALBD") / np.sin(np.radians(np.clip(el, HANGAT_ELEV, 90)))
    p = np.pad(A, 1, mode="edge")
    A = sum(p[1 + dy:1 + dy + H, 1 + dx:1 + dx + W] for dy in (-1, 0, 1) for dx in (-1, 0, 1)) / 9
    ya = (T < HANGAT_C) & (A >= HANGAT_ALB) & (el >= HANGAT_ELEV)
    return np.where(ya, 0.5 + 1.0 * np.clip((A - HANGAT_ALB) / 60, 0, 1), 0).astype(np.float32)


def koreksi_parallax(R, T):
    """Geser hujan dari posisi tampak (awan tinggi) ke posisi di atas tanah."""
    tinggi = np.clip((27 - T) / 6.5, 0, 17)                            # km, laju penurunan suhu 6,5 °C/km
    la, lo = np.radians(LAT), np.radians(LON - SUB_LON)
    cosg = np.cos(la) * np.cos(lo)
    sing = np.sqrt(np.maximum(1 - cosg ** 2, 1e-9))
    tanz = sing / np.maximum(cosg - 6378.0 / 42164.0, 1e-3)
    geser_km = tinggi * tanz
    # geser menuju titik bawah satelit (posisi tampak awan tinggi selalu menjauhi titik itu)
    ke_x, ke_y = (SUB_LON - LON) * np.cos(la), -LAT                # timur +, utara + (derajat)
    pjg = np.maximum(np.hypot(ke_x, ke_y), 1e-6)
    dx = geser_km / KM_PX * (ke_x / pjg)
    dy = -geser_km / KM_PX * (ke_y / pjg)                          # sumbu y piksel mengarah ke selatan
    yy, xx = np.nonzero(R > 0)
    if not len(yy):
        return R
    ty = np.clip(np.rint(yy + dy[yy, xx]).astype(int), 0, H - 1)
    tx = np.clip(np.rint(xx + dx[yy, xx]).astype(int), 0, W - 1)
    out = np.zeros_like(R)
    np.maximum.at(out, (ty, tx), R[yy, xx])
    # isi lubang 1 piksel akibat penggeseran (hanya bila diapit >= 2 tetangga berhujan)
    tet = [np.roll(out, sh, ax) for sh in (-1, 1) for ax in (0, 1)]
    n = sum((t > 0).astype(np.int8) for t in tet)
    isi = np.maximum.reduce(tet)
    return np.where((out == 0) & (n >= 2), isi, out)


def gerak_awan(T0, T1, blok=32, cari=4):
    """Vektor gerak (px per 10 menit) per blok dari dua citra suhu berurutan (pencocokan blok, awan dingin saja)."""
    ny, nx = H // blok, W // blok
    vx, vy = np.zeros((ny, nx), np.float32), np.zeros((ny, nx), np.float32)
    ok = np.zeros((ny, nx), bool)
    A = np.minimum(T0, -10)
    B = np.minimum(T1, -10)
    for j in range(ny):
        for i in range(nx):
            y0, x0 = j * blok, i * blok
            b = B[y0:y0 + blok, x0:x0 + blok]
            if (b < -30).mean() < 0.08:
                continue
            best, arg = None, (0, 0)
            for dy in range(-cari, cari + 1):
                for dx in range(-cari, cari + 1):
                    ys, xs = y0 - dy, x0 - dx
                    if ys < 0 or xs < 0 or ys + blok > H or xs + blok > W:
                        continue
                    e = float(np.mean((A[ys:ys + blok, xs:xs + blok] - b) ** 2))
                    if best is None or e < best:
                        best, arg = e, (dx, dy)
            vx[j, i], vy[j, i], ok[j, i] = arg[0], arg[1], True
    if ok.sum() < 3:
        return 0.0, 0.0, vx, vy, ok
    return float(np.median(vx[ok])), float(np.median(vy[ok])), vx, vy, ok


def geser(R, dx, dy):
    if abs(dx) < 0.5 and abs(dy) < 0.5:
        return R
    sx, sy = int(round(dx)), int(round(dy))
    out = np.zeros_like(R)
    ys = slice(max(sy, 0), H + min(sy, 0))
    yd = slice(max(-sy, 0), H + min(-sy, 0))
    xs = slice(max(sx, 0), W + min(sx, 0))
    xd = slice(max(-sx, 0), W + min(-sx, 0))
    out[ys, xs] = R[yd, xd]
    return out


def geser_blok(R, vx, vy, ok, faktor, blok=32):
    """Geser hujan per blok sesuai gerak awan setempat (blok tanpa awan memakai median)."""
    if not ok.any() or faktor <= 0:
        return R
    mx, my = np.median(vx[ok]), np.median(vy[ok])
    vx = np.where(ok, vx, mx) * faktor
    vy = np.where(ok, vy, my) * faktor
    yy, xx = np.nonzero(R > 0)
    if not len(yy):
        return R
    j = np.minimum(yy // blok, vx.shape[0] - 1)
    i = np.minimum(xx // blok, vx.shape[1] - 1)
    ty = np.clip(np.rint(yy + vy[j, i]).astype(int), 0, H - 1)
    tx = np.clip(np.rint(xx + vx[j, i]).astype(int), 0, W - 1)
    out = np.zeros_like(R)
    np.maximum.at(out, (ty, tx), R[yy, xx])
    return out


# ---------------------------------------------------------------- bandara
def metar():
    data = json.loads(get(METAR_URL.format(*BBOX), timeout=40))
    st = {}
    for m in data:
        if not str(m.get("icaoId", "")).startswith("W") or m.get("lat") is None or not m.get("reportTime"):
            continue
        t = datetime.fromisoformat(m["reportTime"][:19] + "+00:00")
        if m["icaoId"] in st and st[m["icaoId"]]["t"] >= t:
            continue
        mm, label, sekitar = nilai_hujan_metar(m.get("wxString"))
        st[m["icaoId"]] = {"id": m["icaoId"], "nama": (m.get("name") or m["icaoId"]).split(",")[0], "lat": m["lat"],
                           "lon": m["lon"], "t": t, "mm": mm, "label": label, "sekitar": sekitar, "wx": m.get("wxString") or ""}
    return list(st.values())


def px_dari(lon, lat):
    n = 2 ** Z * 256
    x = (lon + 180) / 360 * n - X0 * 256
    r = math.radians(lat)
    y = (1 - math.log(math.tan(r) + 1 / math.cos(r)) / math.pi) / 2 * n - Y0 * 256
    return x, y


def koreksi_bandara(R, stasiun, t_citra):
    Wsum = np.zeros_like(R)
    WS = np.zeros_like(R)
    pakai = []
    for s in stasiun:
        umur = abs((t_citra - s["t"]).total_seconds()) / 60
        if umur > 75:
            continue
        x, y = px_dari(s["lon"], s["lat"])
        if not (0 <= x < W and 0 <= y < H):
            continue
        xi, yi = int(x), int(y)
        sat = float(R[max(yi - 1, 0):yi + 2, max(xi - 1, 0):xi + 2].mean())
        if s["mm"] == 0 and s["sekitar"]:
            pakai.append({**s, "sat": sat, "dipakai": False})
            continue                      # bandara kering tapi ada hujan/petir di sekitarnya: jangan hapus hujan satelit
        kpx = L_KM / float(KM_PX[yi, xi])
        r = int(3 * kpx) + 1
        ys, xs = slice(max(yi - r, 0), min(yi + r + 1, H)), slice(max(xi - r, 0), min(xi + r + 1, W))
        gy, gx = np.mgrid[ys, xs]
        d2 = ((gx - x) ** 2 + (gy - y) ** 2) / kpx ** 2
        wt = np.exp(-d2 / 2) * math.exp(-umur / 60)
        Wsum[ys, xs] += wt
        WS[ys, xs] += wt * s["mm"]
        pakai.append({**s, "sat": sat, "dipakai": True})
    akhir = np.where(Wsum > 0, (W0 * R + WS) / (W0 + Wsum), R).astype(np.float32)
    return akhir, pakai


def catat_validasi(t, R, stasiun):
    """Satelit (sebelum dikoreksi bandara) vs laporan bandara pada waktu yang sama: untuk memantau akurasi."""
    tc = datetime.strptime(t, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc) + timedelta(minutes=6)
    hit = miss = fa = cn = 0
    for s in stasiun:
        if abs((s["t"] - tc).total_seconds()) > 20 * 60:
            continue
        x, y = px_dari(s["lon"], s["lat"])
        if not (0 <= x < W and 0 <= y < H):
            continue
        xi, yi = int(x), int(y)
        sat = float(R[max(yi - 1, 0):yi + 2, max(xi - 1, 0):xi + 2].max()) >= 0.3
        if s["mm"] > 0:
            hit, miss = hit + sat, miss + (not sat)
        elif not s["sekitar"]:
            fa, cn = fa + sat, cn + (not sat)
    if hit + miss + fa + cn == 0:
        return
    try:
        with VALIDASI.open("a", encoding="utf-8") as f:
            f.write(json.dumps({"t": t, "hit": hit, "miss": miss, "fa": fa, "cn": cn}) + "\n")
    except OSError:
        pass


def masker_darat():
    """Daratan Indonesia (poligon kabupaten/kota) di grid citra, dilebarkan ±1 piksel (±5 km) agar pantai ikut.
    Dipakai situs agar animasi rintik hanya di darat (warna hujan tetap tampil di laut)."""
    from PIL import ImageDraw
    img = Image.new("L", (W, H), 0)
    d = ImageDraw.Draw(img)
    gj = json.loads((DATA / "wilayah.geojson").read_text(encoding="utf-8"))
    for f in gj["features"]:
        for poly in iter_polygons(f["geometry"]):
            pts = [px_dari(lon, lat) for lon, lat in poly[0]]
            if len(pts) >= 3:
                d.polygon(pts, fill=1)
    m = np.asarray(img, dtype=bool)
    return np.logical_or.reduce([m] + [np.roll(m, sh, ax) for sh in (-1, 1) for ax in (0, 1)])


def simpan_darat():
    p = KELUAR / "darat.png"
    if p.exists() and time.time() - p.stat().st_mtime < 7 * 86400:
        return
    m = masker_darat().astype(np.uint8) * 255
    tmp = p.with_suffix(".tmp.png")
    Image.fromarray(m, "L").save(tmp, optimize=True)
    os.replace(tmp, p)


# ---------------------------------------------------------------- utama
def simpan_png(R, path):
    v = np.clip(np.rint(np.sqrt(np.maximum(R, 0)) * 40), 0, 255).astype(np.uint8)
    v[R < 0.2] = 0
    tmp = path.with_suffix(".tmp.png")
    Image.fromarray(v, "L").save(tmp, optimize=True)
    os.replace(tmp, path)


def proses(t, t_sebelum, terbaru, stasiun):
    abu = mosaik(t, "B13", "TBB")
    T = suhu(abu)
    R = hujan_dari_suhu(T)
    R = koreksi_parallax(R, T)
    try:
        R = np.maximum(R, hujan_awan_hangat(t, T))
    except Exception as e:                       # kanal B03 gagal diunduh: tetap pakai IR saja
        log("B03 gagal:", e)
    if terbaru:
        catat_validasi(t, R, stasiun)
    info = {"t": datetime.strptime(t, "%Y%m%d%H%M%S").strftime("%Y-%m-%dT%H:%M:%SZ")}
    t_citra = datetime.strptime(t, "%Y%m%d%H%M%S").replace(tzinfo=timezone.utc) + timedelta(minutes=6)
    if terbaru and t_sebelum:
        T0 = suhu(mosaik(t_sebelum, "B13", "TBB"))
        mx, my, vx, vy, ok = gerak_awan(T0, T)
        maju = max(0.0, (datetime.now(timezone.utc) + timedelta(minutes=5) - t_citra).total_seconds() / 600)
        maju = min(maju, 2.0)
        R = geser_blok(R, vx, vy, ok, maju)
        info.update(gerak_px=[round(mx, 1), round(my, 1)], maju_menit=round(maju * 10))
        t_citra = t_citra + timedelta(minutes=maju * 10)
    R, pakai = koreksi_bandara(R, stasiun, t_citra)
    info["sah"] = t_citra.strftime("%Y-%m-%dT%H:%M:%SZ")
    info["png"] = f"{t}.png"
    simpan_png(R, KELUAR / info["png"])
    info["persen_hujan"] = round(float((R >= 0.3).mean()) * 100, 2)
    return info, pakai


def main():
    KELUAR.mkdir(parents=True, exist_ok=True)
    try:
        simpan_darat()
    except Exception as e:  # noqa: BLE001
        log("masker darat gagal:", e)
    jp = KELUAR / "hujan.json"
    lama = json.loads(jp.read_text(encoding="utf-8")) if jp.exists() else {"frame": []}
    sudah = {f["png"][:-4]: f for f in lama.get("frame", [])}
    ts = waktu_tersedia()[-N_FRAME - 1:]
    if ts[-1] in sudah and "--paksa" not in sys.argv:
        return
    try:
        stasiun = metar()
    except Exception as e:  # noqa: BLE001
        log("METAR gagal:", e)
        stasiun = []
    frame, pakai_baru = [], []
    for k, t in enumerate(ts[1:], start=1):
        terbaru = t == ts[-1]
        if t in sudah and not terbaru and "--paksa" not in sys.argv:
            frame.append(sudah[t])
            continue
        try:
            info, pakai = proses(t, ts[k - 1], terbaru, stasiun)
            if terbaru:
                pakai_baru = pakai
            frame.append(info)
            log(f"{t}: hujan {info['persen_hujan']}% wilayah", info.get("gerak_px", ""))
        except Exception as e:  # noqa: BLE001
            log(f"{t} gagal:", type(e).__name__, str(e)[:200])
            if t in sudah:
                frame.append(sudah[t])
    if not frame:
        return
    bandara = [{"id": s["id"], "nama": s["nama"], "lat": round(s["lat"], 4), "lon": round(s["lon"], 4),
                "t": s["t"].strftime("%Y-%m-%dT%H:%M:%SZ"), "mm": s["mm"], "label": s["label"], "sekitar": s["sekitar"],
                "wx": s["wx"], "sat": round(s.get("sat", 0), 2)} for s in pakai_baru]
    hasil = {"diperbarui": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"), "batas": batas(),
             "skala": "mm_per_jam = (nilai/40)^2", "sumber": "Himawari-9 B13 (JMA) + METAR (NOAA AWC)",
             "frame": frame[-N_FRAME:], "bandara": bandara, "darat": "darat.png"}
    tmp = jp.with_suffix(".tmp")
    tmp.write_text(json.dumps(hasil, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    os.replace(tmp, jp)
    simpan = {f["png"] for f in hasil["frame"]}
    for p in KELUAR.glob("*.png"):
        if p.name not in simpan and p.name != "darat.png" and time.time() - p.stat().st_mtime > 3600:
            p.unlink()


if __name__ == "__main__":
    main()
