# What'sUpIndonesia

**Ada apa di Indonesia hari ini?** Peta live kejadian di seluruh Indonesia: gempa, titik panas (karhutla), banjir,
gunung api, angin, dan kualitas udara, lengkap dengan laporan warga dan berita media terkait, dalam satu peta.
Situs: **[whatsupindonesia.id](https://whatsupindonesia.id)** · bahasa Indonesia & English.

> Bukan sumber resmi. Info resmi: [BMKG](https://www.bmkg.go.id/), [BNPB](https://bnpb.go.id/),
> [PVMBG/MAGMA](https://magma.esdm.go.id/), [SiPongi](https://sipongi.menlhk.go.id/).
> Titik panas adalah deteksi panas satelit, belum tentu kebakaran.

## Fitur

| Lapisan | Isi | Sumber |
|---|---|---|
| **Gempa** (7 hari) | Dicek langsung ke BMKG tiap menit dari browser; radius guncangan (MMI), potensi tsunami, berita, laporan warga | BMKG (cadangan USGS) |
| **Titik panas** (24 jam) | Gradasi daya api (FRP), kabupaten terbanyak, berita karhutla, laporan kebakaran & kabut asap | NASA FIRMS, PetaBencana.id |
| **Banjir** | Tab Waspada (peringatan dini hujan lebat) · Terjadi (laporan warga, angin kencang, area tergenang) · Resmi (kejadian + dampak) | BMKG CAP, PetaBencana.id, BNPB |
| **Gunung** | Level aktivitas, laporan & rekomendasi PVMBG; tab Kondisi (cuaca puncak 3 hari, titik panas & gempa sekitar), Berita, Medsos; + 22 gunung pendakian | MAGMA Indonesia, Open-Meteo, OpenStreetMap |
| **Angin** (tombol) | Animasi partikel arah & kecepatan angin | Open-Meteo |
| **Kualitas udara** (tombol) | Heatmap PM2.5 (model CAMS dikoreksi stasiun ISPU resmi; stasiun menyimpang ditandai) + detail di titik mana pun | CAMS via Open-Meteo, ISPU KLH |
| **Layer** (tombol) | Sembunyikan semua titik kejadian (peta bersih) | — |

Lainnya: pencarian provinsi/kota/kelurahan/tempat/gunung (Photon/OpenStreetMap), ringkasan kejadian per kabupaten/kota,
ticker kabar terbaru, panduan untuk pengunjung baru, tema terang/gelap, bisa dipasang di HP (PWA),
statistik pengunjung tanpa cookie (Umami).

Berita dicari otomatis (tanpa AI) lewat RSS pencarian Google News, hanya dari media resmi; yang ditampilkan
hanya judul, nama media, waktu, dan tautan ke situs aslinya.

## Cara kerja

```
GitHub Actions (tiap ±15 menit) ─► scripts/fetch_data.py ─► site/data/live/*.json ─► GitHub Pages (whatsupindonesia.id)
                                                                                      │
Browser pengunjung (site/app.js) ◄─────────────────────────────────────────────────────┘
   └─ juga mengambil langsung: gempa BMKG (tiap menit), cuaca puncak gunung, pencarian tempat, peta dasar
```

Tanpa server sendiri, tanpa API key, biaya Rp0. Skrip hanya memakai pustaka standar Python.
Bila satu sumber gagal (mis. server BNPB mati), data terakhir yang berhasil tetap ditampilkan.

## Isi folder

```
WhatsUpIndonesia/
├── site/                      ← SITUS (yang diterbitkan ke whatsupindonesia.id)
│   ├── index.html             kerangka halaman: kepala, pengaturan, kotak cari, ticker, dock
│   ├── app.js                 semua logika: peta, lapisan, popup, panel, cari, panduan, bahasa, kualitas udara
│   ├── style.css              tampilan: warna tema terang/gelap, tata letak desktop & HP
│   ├── sw.js                  service worker: syarat "pasang di HP", selalu ambil versi terbaru
│   ├── manifest.webmanifest   identitas aplikasi saat dipasang di HP (nama, ikon, warna)
│   ├── icons/                 ikon aplikasi
│   └── data/
│       ├── wilayah.geojson            batas 519 kabupaten/kota (dibuat sekali)
│       ├── gunung_pendakian.geojson   22 gunung pendakian yang tidak dipantau PVMBG (dikurasi)
│       └── live/                      data hasil robot (dibuat otomatis, TIDAK disimpan di git)
│
├── scripts/                   ← ROBOT DATA (dijalankan GitHub Actions)
│   ├── fetch_data.py          skrip utama: ambil gempa, titik panas, banjir, gunung, angin, udara, ISPU, berita
│   ├── berita.py              pencarian & penyaringan berita media resmi
│   ├── geo.py                 alat bantu peta: titik → kabupaten/kota, jarak
│   ├── build_wilayah.py       membuat ulang wilayah.geojson (cukup sekali)
│   └── grid_udara_darat.json  daftar titik darat untuk prakiraan polusi (cache)
│
├── .github/workflows/update.yml   ← JADWAL ROBOT: jalankan skrip & terbitkan situs tiap ±15 menit / tiap push
├── docs/                      ← DOKUMEN: rencana awal (MVP) & riset sumber data banjir
├── pemasaran/                 ← draf postingan & materi promosi (hanya di laptop, tidak dikirim ke GitHub)
├── README.md                  dokumen ini
└── LICENSE                    hak cipta
```

Mulai belajar dari mana? Urutan yang disarankan:
1. `site/index.html`: lihat bagian-bagian halaman.
2. `.github/workflows/update.yml`: bagaimana robot dijadwalkan.
3. `scripts/fetch_data.py`: fungsi `main()` di bagian bawah, lalu satu per satu fungsi `fetch_…`.
4. `site/app.js`: cari judul bagian bertanda `// ---------- … ----------` (mis. `gempa realtime`, `polusi udara`, `panduan`).

## Jalankan lokal

```bash
python scripts/fetch_data.py                       # ambil data terbaru ke site/data/live/
python -m http.server 8000 --directory site        # jalankan situs
```

Buka http://localhost:8000 (mode HP: DevTools → toggle device). Tambahkan `?tanpa-panduan` di alamat
untuk mematikan panduan (berguna saat merekam video).

## Terbitkan

Push ke branch `main` → GitHub Actions menjalankan robot dan menerbitkan ke GitHub Pages (custom domain
whatsupindonesia.id). Setelah itu robot berjalan otomatis tiap ±15 menit.

## Hak cipta

© 2026 **Erick Jahja**. Seluruh hak dilindungi (*All rights reserved*): lihat [LICENSE](LICENSE).
Kode dipublikasikan untuk dilihat sebagai portofolio; penggunaan, penyalinan, atau penerbitan ulang
memerlukan izin tertulis.

## Atribusi data

BMKG · USGS · NASA FIRMS · PetaBencana.id · BNPB · MAGMA Indonesia/PVMBG · KLH (ISPU) · Copernicus CAMS &
Open-Meteo · media (Google News) · geoBoundaries (ODbL, © OpenStreetMap contributors) · Photon/komoot ·
OpenFreeMap / OpenMapTiles / © OpenStreetMap contributors (peta dasar).
