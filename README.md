# What'sUpIndonesia

**Ada apa di Indonesia hari ini?** Peta live gempa, titik panas karhutla, banjir, dan laporan bencana warga
di seluruh Indonesia, lengkap dengan berita media terkait — dalam satu peta.

> Bukan sumber resmi. Info resmi: [BMKG](https://www.bmkg.go.id/), [BNPB](https://bnpb.go.id/),
> [SiPongi](https://sipongi.menlhk.go.id/). Titik panas adalah deteksi panas satelit, belum tentu kebakaran.

## Fitur
| Lapisan | Isi | Sumber |
|---|---|---|
| **Gempa** (7 hari) | Titik gempa, gempa terbesar 24 jam berdenyut; klik → lokasi, kedalaman, potensi tsunami, perkiraan radius guncangan (MMI) & berita | BMKG (cadangan USGS) |
| **Titik panas** (24 jam) | Gradasi oranye→merah sesuai daya api (FRP), peringkat kabupaten, berita karhutla | NASA FIRMS |
| **Banjir** | Waspada (poligon peringatan dini hujan lebat), terjadi (laporan warga), resmi (kejadian + dampak) | BMKG CAP, PetaBencana.id, BNPB |
| **Laporan warga** (7 hari) | Banjir, kebakaran, angin, gempa, dll. + foto + berita media terkait | PetaBencana.id |

Tampilan: peta penuh, ticker live, dock lapisan, panel daftar (bisa ditutup), popup dengan tab Detail/Berita,
tampilan HP (geser panel/dock). Klik kabupaten/kota untuk ringkasan daerah.

Berita dicari otomatis (tanpa AI) lewat RSS pencarian Google News, hanya dari media resmi; yang ditampilkan
hanya judul, nama media, waktu, dan tautan ke situs aslinya.

## Cara kerja
```
GitHub Actions (tiap 15 menit) → scripts/fetch_data.py → site/data/live/*.json → GitHub Pages
```
Tanpa server, tanpa API key, biaya Rp0. Hanya pustaka standar Python.

## Jalankan lokal
```bash
python scripts/fetch_data.py
python -m http.server 8000 --directory site
```
Buka http://localhost:8000 (mode HP: DevTools → toggle device).

`scripts/build_wilayah.py` membangun ulang `site/data/wilayah.geojson` (519 kabupaten/kota) dari geoBoundaries;
cukup dijalankan sekali.

## Terbitkan ke GitHub Pages
1. Push ke branch `main`.
2. Settings → Pages → Source: **GitHub Actions**.
3. Actions → "Perbarui data & terbitkan situs" → Run workflow. Setelah itu berjalan otomatis tiap 15 menit.

## Hak cipta
© 2026 **Erick Jahja**. Seluruh hak dilindungi (*All rights reserved*) — lihat [LICENSE](LICENSE).
Kode dipublikasikan untuk dilihat sebagai portofolio; penggunaan, penyalinan, atau penerbitan ulang
memerlukan izin tertulis.

## Atribusi data
BMKG · USGS · NASA FIRMS · PetaBencana.id · BNPB · media (Google News) · geoBoundaries (ODbL, © OpenStreetMap
contributors) · OpenFreeMap / OpenMapTiles / © OpenStreetMap contributors (peta dasar).
