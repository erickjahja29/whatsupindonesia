"""Bangun site/data/wilayah.geojson (batas kabupaten/kota, ringan) dari geoBoundaries.

Dijalankan sekali (atau saat batas wilayah diperbarui):
    python scripts/build_wilayah.py

Sumber: geoBoundaries gbOpen IDN ADM1 & ADM2 (simplified), lisensi ODbL 1.0
(OpenStreetMap contributors / Wambacher). Wajib atribusi di situs.
"""
import json
import sys
import urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from geo import iter_polygons, point_in_polygon, ring_bbox  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "site" / "data" / "wilayah.geojson"
URL = ("https://github.com/wmgeolab/geoBoundaries/raw/9469f09/releaseData/gbOpen/IDN/"
       "{adm}/geoBoundaries-IDN-{adm}_simplified.geojson")
TOLERANCE = 0.006  # derajat (~650 m) untuk penyederhanaan Douglas-Peucker
DECIMALS = 3       # ~110 m

PROVINSI = {
    "Bali": "Bali", "West Nusa Tenggara": "Nusa Tenggara Barat", "Banten": "Banten",
    "Central Java": "Jawa Tengah", "West Java": "Jawa Barat",
    "Central Kalimantan": "Kalimantan Tengah", "South Kalimantan": "Kalimantan Selatan",
    "West Kalimantan": "Kalimantan Barat", "Central Sulawesi": "Sulawesi Tengah",
    "Gorontalo": "Gorontalo", "North Sulawesi": "Sulawesi Utara",
    "South Sulawesi": "Sulawesi Selatan", "Southeast Sulawesi": "Sulawesi Tenggara",
    "West Sulawesi": "Sulawesi Barat", "Aceh": "Aceh", "Bengkulu": "Bengkulu",
    "Jambi": "Jambi", "Lampung": "Lampung", "Riau": "Riau", "West Sumatra": "Sumatera Barat",
    "South Sumatra": "Sumatera Selatan", "North Sumatra": "Sumatera Utara",
    "East Nusa Tenggara": "Nusa Tenggara Timur", "Maluku": "Maluku",
    "North Maluku": "Maluku Utara", "East Java": "Jawa Timur",
    "Bangka-Belitung Islands": "Kepulauan Bangka Belitung", "Riau Islands": "Kepulauan Riau",
    "Papua": "Papua", "West Papua": "Papua Barat", "East Kalimantan": "Kalimantan Timur",
    "North Kalimantan": "Kalimantan Utara", "Special Region of Yogyakarta": "DI Yogyakarta",
    "Jakarta Special Capital Region": "DKI Jakarta",
}
# Kekhasan penamaan sumber: "Kota Baru" sebenarnya Kabupaten Kotabaru (Kalsel).
NAMA_KHUSUS = {"Kota Baru": "Kab. Kotabaru"}
# Pulau kecil yang tidak jatuh di poligon provinsi tersederhanakan.
PROVINSI_KHUSUS = {"Kepulauan Seribu": "DKI Jakarta"}


def fetch(adm):
    with urllib.request.urlopen(URL.format(adm=adm), timeout=120) as r:
        return json.load(r)


def simplify(points, tol):
    if len(points) < 3:
        return points
    keep = [False] * len(points)
    keep[0] = keep[-1] = True
    stack = [(0, len(points) - 1)]
    while stack:
        a, b = stack.pop()
        ax, ay = points[a]
        bx, by = points[b]
        dx, dy = bx - ax, by - ay
        norm = (dx * dx + dy * dy) ** 0.5
        best, idx = 0.0, None
        for i in range(a + 1, b):
            px, py = points[i]
            if norm == 0:
                d = ((px - ax) ** 2 + (py - ay) ** 2) ** 0.5
            else:
                d = abs(dy * px - dx * py + bx * ay - by * ax) / norm
            if d > best:
                best, idx = d, i
        if idx is not None and best > tol:
            keep[idx] = True
            stack += [(a, idx), (idx, b)]
    return [p for p, k in zip(points, keep) if k]


def clean_ring(ring):
    pts = simplify(ring, TOLERANCE)
    out = []
    for x, y in pts:
        p = [round(x, DECIMALS), round(y, DECIMALS)]
        if not out or out[-1] != p:
            out.append(p)
    if out and out[0] != out[-1]:
        out.append(out[0])
    return out if len(out) >= 4 else None


def ring_area(ring):
    return abs(sum(ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1]
                   for i in range(len(ring) - 1))) / 2


def main():
    adm1 = fetch("ADM1")
    adm2 = fetch("ADM2")
    prov_polys = []
    for f in adm1["features"]:
        name = PROVINSI.get(f["properties"]["shapeName"], f["properties"]["shapeName"])
        for poly in iter_polygons(f["geometry"]):
            prov_polys.append((ring_bbox(poly[0]), poly, name))

    def province_of(points):
        votes = {}
        for x, y in points:
            for (x0, y0, x1, y1), poly, name in prov_polys:
                if x0 <= x <= x1 and y0 <= y <= y1 and point_in_polygon(x, y, poly):
                    votes[name] = votes.get(name, 0) + 1
                    break
        return max(votes, key=votes.get) if votes else "?"

    features = []
    for i, f in enumerate(adm2["features"]):
        raw = f["properties"]["shapeName"].strip()
        polys = iter_polygons(f["geometry"])
        biggest = max(polys, key=lambda p: ring_area(p[0]))[0]
        # Sampel titik untuk menebak provinsi: pusat bbox + titik-titik di batas.
        x0, y0, x1, y1 = ring_bbox(biggest)
        step = max(1, len(biggest) // 25)
        sample = [((x0 + x1) / 2, (y0 + y1) / 2)] + [tuple(p[:2]) for p in biggest[::step]]
        prov = PROVINSI_KHUSUS.get(raw) or province_of(sample)

        new_polys = []
        for poly in polys:
            outer = clean_ring(poly[0])
            if not outer:
                continue
            holes = [h for h in (clean_ring(r) for r in poly[1:]) if h]
            new_polys.append([outer] + holes)
        if not new_polys:  # pulau kecil: simpan bbox ring asli yang dibulatkan
            new_polys = [[[[round(p[0], DECIMALS), round(p[1], DECIMALS)] for p in biggest]]]

        if raw in NAMA_KHUSUS:
            nama = NAMA_KHUSUS[raw]
        elif raw.startswith("Kota "):
            nama = raw
        else:
            nama = "Kab. " + raw
        features.append({
            "type": "Feature",
            "id": i + 1,
            "properties": {"id": i + 1, "nama": nama, "provinsi": prov},
            "geometry": {"type": "MultiPolygon", "coordinates": new_polys},
        })

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"type": "FeatureCollection", "features": features},
                              separators=(",", ":"), ensure_ascii=False), encoding="utf-8")
    unknown = [f["properties"]["nama"] for f in features if f["properties"]["provinsi"] == "?"]
    print(f"{len(features)} wilayah -> {OUT} ({OUT.stat().st_size / 1e6:.2f} MB)")
    print("Provinsi tidak terdeteksi:", unknown or "-")


if __name__ == "__main__":
    main()
