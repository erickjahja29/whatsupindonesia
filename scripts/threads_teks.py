"""Teks postingan Threads untuk satu gempa (dipakai robot Threads di VPS).

Masukan: properties satu fitur gempa (bentuk sama seperti site/data/live/gempa.geojson).
Batas Threads 500 karakter; teks ini ±200–300 karakter.
"""
import re
from datetime import datetime, timedelta

SINGKAT_PROV = {
    "Nanggroe Aceh Darussalam": "Aceh", "Sumatera Utara": "Sumut", "Sumatera Barat": "Sumbar",
    "Sumatera Selatan": "Sumsel", "Kepulauan Bangka Belitung": "Babel", "Kepulauan Riau": "Kepri",
    "DKI Jakarta": "Jakarta", "Jawa Barat": "Jabar", "Jawa Tengah": "Jateng", "Jawa Timur": "Jatim",
    "Daerah Istimewa Yogyakarta": "DIY", "Nusa Tenggara Barat": "NTB", "Nusa Tenggara Timur": "NTT",
    "Kalimantan Barat": "Kalbar", "Kalimantan Tengah": "Kalteng", "Kalimantan Selatan": "Kalsel",
    "Kalimantan Timur": "Kaltim", "Kalimantan Utara": "Kaltara", "Sulawesi Utara": "Sulut",
    "Sulawesi Tengah": "Sulteng", "Sulawesi Selatan": "Sulsel", "Sulawesi Tenggara": "Sultra",
    "Sulawesi Barat": "Sulbar", "Maluku Utara": "Malut",
}
BULAN = "Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des".split()


def rapi_lokasi(s):
    """Sama dengan rapiLokasi() di site/app.js: '114 km BaratDaya NIASBARAT-SUMUT' -> '114 km barat daya Nias Barat, Sumut'."""
    if not s:
        return s
    t = re.sub(r"^Pusat gempa berada di (laut|darat)\s+", "", str(s), flags=re.I)

    def kata(m):
        bagian = []
        for x in m.group(0).split("-"):
            x = re.sub(r"^(PULAU|KEPULAUAN|KOTA)(?=[A-Z]{3,})", r"\1 ", x)
            x = re.sub(r"([A-Z]{3,}?)(UTARA|SELATAN|TIMUR|BARAT|TENGGARA|TENGAH)$", r"\1 \2", x)
            bagian.append(re.sub(r"(^|\s)([a-z])", lambda k: k.group(1) + k.group(2).upper(), x.lower()))
        return ", ".join(bagian)

    t = re.sub(r"\b[A-Z]{4,}(?:-[A-Z]{4,})*\b", kata, t)
    t = re.sub(r"\b([Bb]arat|[Tt]imur) ?([Ll]aut|[Dd]aya)\b", lambda m: f"{m.group(1).lower()} {m.group(2).lower()}", t)
    t = re.sub(r"(\d+ km )(Utara|Selatan|Timur|Barat|Tenggara)\b", lambda m: m.group(1) + m.group(2).lower(), t)
    t = re.sub(r"([a-z])-([A-Z])", r"\1, \2", t)
    t = re.sub(r"^(\d+ km) (?=[A-Z])", r"\1 dari ", t)   # BMKG kadang tanpa arah: "48 km Ruteng" -> "48 km dari Ruteng"
    return t.replace("Kab ", "Kab. ")


def angka(x):
    return f"{x:g}".replace(".", ",")


def teks_gempa(p):
    t = datetime.fromisoformat(p["waktu"].replace("Z", "+00:00")) + timedelta(hours=7)
    lok = rapi_lokasi(p.get("lokasi") or "")
    prov = SINGKAT_PROV.get(p.get("provinsi") or "", p.get("provinsi") or "")
    wilayah = ", ".join(x for x in (p.get("kabupaten"), prov) if x)
    if not wilayah:   # pusat gempa di laut: sebut "laut" dan provinsi terdekat
        judul = ("laut " if re.search(r"di laut", p.get("lokasi") or "", re.I) else "") + lok
        dekat = SINGKAT_PROV.get(p.get("provinsi_dekat") or "", p.get("provinsi_dekat") or "")
        if dekat and dekat not in judul:
            judul += f" ({dekat})"
    baris = [f"🔴 Gempa M{angka(p.get('magnitudo') or 0)} · {wilayah or judul}"]
    if wilayah and lok:
        baris.append(f"📍 {lok}")
    baris.append(f"🕓 {t.day} {BULAN[t.month - 1]}, {t:%H.%M} WIB · kedalaman {angka(p.get('kedalaman_km') or 0)} km")
    dirasakan = (p.get("dirasakan") or "").strip()
    if dirasakan and dirasakan != "-":
        rapi = re.sub(r"\s*-\s*", "–", dirasakan)
        baris.append(f"🏠 Dirasakan (MMI): {rapi}")
    potensi = (p.get("potensi") or "").lower()
    if "tsunami" in potensi and "tidak" not in potensi:
        baris.append("🌊 BERPOTENSI TSUNAMI: jauhi pantai, ikuti arahan BMKG & BPBD")
    baris += ["", "Peta & radius guncangan 👇", f"whatsupindonesia.id/?gempa={p['waktu']}", "Sumber: BMKG"]
    return "\n".join(baris)
