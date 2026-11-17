"""Utilitas geometri sederhana (tanpa dependensi) untuk What'sUpIndonesia."""
import json
import math
from pathlib import Path


def iter_polygons(geom):
    """Kembalikan list polygon; tiap polygon = list ring; ring = list [lon, lat]."""
    if geom["type"] == "Polygon":
        return [geom["coordinates"]]
    if geom["type"] == "MultiPolygon":
        return geom["coordinates"]
    return []


def ring_bbox(ring):
    xs = [p[0] for p in ring]
    ys = [p[1] for p in ring]
    return min(xs), min(ys), max(xs), max(ys)


def point_in_ring(x, y, ring):
    inside = False
    n = len(ring)
    j = n - 1
    for i in range(n):
        xi, yi = ring[i][0], ring[i][1]
        xj, yj = ring[j][0], ring[j][1]
        if (yi > y) != (yj > y) and x < (xj - xi) * (y - yi) / (yj - yi + 1e-15) + xi:
            inside = not inside
        j = i
    return inside


def point_in_polygon(x, y, polygon):
    if not point_in_ring(x, y, polygon[0]):
        return False
    return not any(point_in_ring(x, y, hole) for hole in polygon[1:])


def _seg_dist2(px, py, ax, ay, bx, by):
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return (px - ax) ** 2 + (py - ay) ** 2
    t = max(0.0, min(1.0, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    qx, qy = ax + t * dx, ay + t * dy
    return (px - qx) ** 2 + (py - qy) ** 2


class RegionIndex:
    """Indeks kabupaten/kota untuk mencari wilayah sebuah titik."""

    def __init__(self, geojson_path):
        data = json.loads(Path(geojson_path).read_text(encoding="utf-8"))
        self.items = []  # (bbox, polygon, props)
        for f in data["features"]:
            for poly in iter_polygons(f["geometry"]):
                self.items.append((ring_bbox(poly[0]), poly, f["properties"]))

    def locate(self, lon, lat, coast_tolerance=0.04):
        """Wilayah yang memuat titik. Bila di luar semua poligon (mis. pantai yang
        tersederhanakan), ambil wilayah terdekat dalam batas toleransi (derajat)."""
        for (x0, y0, x1, y1), poly, props in self.items:
            if x0 <= lon <= x1 and y0 <= lat <= y1 and point_in_polygon(lon, lat, poly):
                return props
        best, best_d = None, coast_tolerance ** 2
        t = coast_tolerance
        for (x0, y0, x1, y1), poly, props in self.items:
            if not (x0 - t <= lon <= x1 + t and y0 - t <= lat <= y1 + t):
                continue
            ring = poly[0]
            for i in range(len(ring) - 1):
                d = _seg_dist2(lon, lat, ring[i][0], ring[i][1], ring[i + 1][0], ring[i + 1][1])
                if d < best_d:
                    best, best_d = props, d
        return best


def haversine_km(lon1, lat1, lon2, lat2):
    r = 6371.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lon2 - lon1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))
