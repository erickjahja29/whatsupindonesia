# Riset sumber data banjir (17 Nov 2026)

Semua dicek langsung dari PC rumah (bukan hanya dari artikel).

| # | Sumber | Isi | Akses | Kesegaran | Cocok untuk |
|---|---|---|---|---|---|
| 1 | **BMKG Peringatan Dini Cuaca (CAP)** — `cuaca.bmkg.go.id/data/public/cap/feed/id/rss.xml` | Peringatan hujan lebat/petir/angin per kecamatan, **dengan poligon wilayah**, jam berlaku & kedaluwarsa. Teks dampak menyebut "banjir lokal" | ✅ Terbuka, RSS + XML CAP standar internasional | Live (22 peringatan aktif saat uji, 1–3 jam ke depan) | Lapisan **"Waspada banjir"**: area yang berpotensi banjir sekarang |
| 2 | **PetaBencana.id laporan warga** (sudah dipakai) | Titik laporan banjir + foto + tinggi air | ✅ Terbuka | Live | Banjir yang **sedang terjadi** (13 laporan/7 hari) |
| 3 | **BNPB Kejadian Bencana Mingguan** — ArcGIS `gis.bnpb.go.id/server/rest/services/Kejadian_Bencana_Mingguan/FeatureServer/25` | Kejadian resmi per kabupaten: kategori, tanggal, meninggal, mengungsi, **rumah terendam**, kronologis, upaya | ✅ Terbuka (query tanpa token) | Tertinggal: saat uji isinya 11 kejadian minggu ke-46, terbaru 11 Nov (2 banjir: Jakarta Selatan, Aceh Barat Daya) | Data **resmi + dampak** di popup kabupaten / label "terverifikasi BNPB" |
| 4 | Copernicus GFM (satelit Sentinel-1) | Poligon genangan dari radar satelit, global | WMS gratis; API perlu daftar. **Belum diuji** | ±8 jam setelah satelit lewat; satelit lewat tiap beberapa hari | Banjir besar (luas genangan), fase lanjut |
| 5 | Tinggi muka air pintu air Jakarta (BPBD/DSDA) | Status siaga pintu air (Katulampa, Manggarai, dst.) | ❌ API BPBD menolak akses langsung (403); DSDA memakai server pihak ketiga. Perlu izin resmi | Live | Khusus Jakarta — minta akses ke BPBD/Dinas SDA DKI |
| 6 | PetaBencana area banjir (`/floods`) | Poligon RT tergenang | ✅ Terbuka | ❌ Basi (satu-satunya area terakhir diperbarui 2024) | Tidak dipakai |

## Rekomendasi
Lapisan **Banjir** baru = gabungan:
1. **Waspada** (BMKG CAP): poligon kuning/oranye area hujan lebat yang berpotensi banjir, dengan jam berlaku.
2. **Terjadi** (PetaBencana): titik laporan warga + berita terkait (sudah ada).
3. **Resmi** (BNPB): kabupaten yang tercatat banjir minggu ini + dampak (rumah terendam, pengungsi).

Catatan jujur di UI: BMKG = *potensi*, bukan banjir pasti; BNPB = data resmi tapi tertinggal beberapa hari.
Fase lanjut: GFM satelit untuk banjir besar; TMA Jakarta bila dapat izin.
