# What'sUpIndonesia — Rancangan MVP (v1, 17 Nov 2026)

Status: **rancangan saja — kode belum dibuat.**

> "Ada apa di Indonesia hari ini?" — satu peta berbahasa Indonesia: karhutla, banjir, gempa, dan berita
> terkini per daerah. Pelengkap BNPB/BMKG/Kemenhut, **bukan sumber resmi**.

## 1. Posisi

Data bencananya sudah ada, tapi tersebar: SiPongi (karhutla), PetaBencana.id (banjir), BMKG (gempa),
InaRISK (risiko). Belum ditemukan satu peta yang menggabungkan semuanya **plus berita per wilayah**.
Nilai jual: *satu tempat, klik daerahmu, langsung tahu kondisinya.*

## 2. Fitur MVP

| # | Fitur | Isi di peta | Klik → panel |
|---|---|---|---|
| 1 | Karhutla | Titik panas 24 jam / 7 hari, warna = tingkat kepercayaan | Waktu deteksi, satelit, kabupaten |
| 2 | Banjir | Laporan warga 24 jam (PetaBencana.id) | Foto/teks laporan, waktu, sumber |
| 3 | Gempa | Lingkaran = magnitudo, warna = umur kejadian | Magnitudo, kedalaman, lokasi, waktu |
| 4 | Berita daerah | Choropleth kabupaten/kota = jumlah berita 24 jam | 10 berita terbaru wilayah itu (judul, media, jam, tautan) |

Panel atas: ringkasan nasional ("312 titik panas · 18 laporan banjir · 9 gempa ≥ M4 · 24 jam terakhir").

## 3. Sumber data (dicek 17 Nov 2026)

| Data | Sumber | Status cek | Catatan |
|---|---|---|---|
| Titik panas | NASA FIRMS API (VIIRS + MODIS) | Butuh MAP_KEY gratis | Erick daftar; batas ±5.000 transaksi/10 menit |
| Banjir | `data.petabencana.id/reports?timeperiod=86400` | ✅ 200, ada laporan hari ini | Format TopoJSON; endpoint `/floods` sempat error 500 |
| Gempa (utama) | BMKG `data.bmkg.go.id/DataMKG/TEWS/*.json` | ⚠️ 403 dari PC ini (curl) | Coba dari GitHub Actions / browser; pakai sesuai syarat BMKG + atribusi |
| Gempa (cadangan) | USGS FDSN GeoJSON, bbox Indonesia | ✅ 200 | Hanya ≥ M~4, sedikit lebih lambat dari BMKG |
| Berita | RSS Antara, CNN Indonesia, Detik, (Kompas: cek RSS) | ✅ Antara & CNN 200; Detik timeout sekali | Simpan judul + tautan saja, jangan salin isi artikel |
| Batas wilayah | geoBoundaries (CC BY) atau BIG | — | Kabupaten/kota untuk klik & pencocokan berita |
| Peta dasar | OpenStreetMap / CARTO | — | Wajib atribusi |

Media sosial (X/IG/TikTok): **ditunda** — API mahal & dibatasi. Fase lanjut bisa lewat PetaBencana (sudah mengolah laporan sosmed).

## 4. Cara kerja fitur berita (bagian tersulit)

1. Ambil RSS tiap 30 menit → judul, ringkasan, tautan, waktu.
2. Cari nama kabupaten/kota/provinsi di judul + ringkasan (kamus ±514 kab/kota + alias: "Jaksel", "Kota Bogor" vs "Kab. Bogor").
3. Aturan sederhana: ambil nama wilayah pertama yang paling spesifik; abaikan berita tanpa lokasi.
4. Simpan per kode wilayah → `news/<kode>.json` (maks 20 berita, 72 jam).
5. Fase 2: perbaiki ketepatan dengan Claude API (klasifikasi lokasi + kategori: bencana/politik/kriminal/…).

Target awal: ketepatan lokasi ≥ 80% pada sampel 100 berita (dicek manual).

## 5. Arsitektur (biaya Rp0)

```
GitHub Actions (cron)
  ├─ tiap 15 menit : gempa (BMKG → cadangan USGS), banjir (PetaBencana)
  ├─ tiap 30 menit : berita RSS → geotag → news/<kode>.json
  └─ tiap 3 jam    : FIRMS titik panas → gabung kabupaten
        ↓ commit data/*.json
GitHub Pages (situs statis)
  └─ MapLibre GL JS: 4 toggle layer, klik kabupaten → panel berita + ringkasan bencana wilayah itu
```

Kode karhutla bisa memakai ulang rencana di
`C:\Users\WINDOWS10\Projects\GeoAI\output\09_webgis_karhutla\RENCANA_WEBGIS_KARHUTLA.md`
(What'sUpIndonesia = versi multi-bencana + berita dari ide itu).

## 6. Roadmap

| Fase | Durasi kira-kira | Isi | Selesai bila |
|---|---|---|---|
| 0 · Persiapan | 1 hari | MAP_KEY FIRMS, repo GitHub, cek syarat BMKG & lisensi batas wilayah, cek domain/nama | Semua sumber bisa diambil |
| 1 · Peta bencana | 1 akhir pekan | Gempa + banjir + titik panas + ringkasan nasional, online di GitHub Pages | Jalan otomatis 3 hari tanpa error |
| 2 · Berita daerah | 1 akhir pekan | RSS → geotag → klik kabupaten muncul berita | Ketepatan ≥ 80% sampel |
| 3 · Poles | berjalan | Tampilan HP, filter waktu, bagikan wilayah, infografis harian, kategori berita (AI) | — |
| 4 · Lanjut | nanti | Notifikasi Telegram per kabupaten, cuaca ekstrem BMKG, gunung api (MAGMA) | — |

## 7. Risiko

| Risiko | Mitigasi |
|---|---|
| Disangka sumber resmi | Label "bukan sumber resmi" + tautan BNPB/BMKG/SiPongi di tiap panel |
| Titik panas ≠ kebakaran pasti | Teks penjelas + tingkat kepercayaan |
| Berita salah tempat | Tampilkan "lokasi dideteksi otomatis"; tombol lapor salah |
| Hak cipta berita | Hanya judul + tautan ke sumber, tanpa isi artikel |
| Akses BMKG ditolak | Cadangan USGS; minta izin/akses resmi BMKG bila perlu |
| Nama mirip "WhatsApp" | Cek PDKI/merek sebelum dipakai publik/komersial; siapkan nama cadangan |

## 8. Butuh dari Erick
1. ~~Daftar NASA FIRMS MAP_KEY~~ — tidak perlu untuk Fase 1: file publik 24 jam FIRMS bisa diambil tanpa key.
2. Setuju repo GitHub publik baru `whatsupindonesia` (akun sudah ada: dipakai untuk cek-lahan).
3. ~~Lampu hijau mulai Fase 1~~ — diberikan 17 Nov 2026.

## 9. Status Fase 1 (17 Nov 2026)
Selesai & diuji lokal: peta gempa (BMKG, 7 hari), titik panas (FIRMS 24 jam, 3.058 titik di Indonesia saat uji),
laporan warga (PetaBencana 7 hari), klik kabupaten → ringkasan, tampilan HP. Belum online: menunggu repo GitHub.
