/* What'sUpIndonesia — peta sebagai fokus: brand (kiri atas), ticker live (atas), dock lapisan (bawah),
   panel khusus per lapisan (gempa, titik panas, laporan warga). */
(() => {
  "use strict";

  const DATA = "data/";
  const REFRESH_MS = 5 * 60 * 1000;
  const HOUR = 3600 * 1000;
  const INDONESIA = [[94.5, -11.5], [141.5, 6.5]];
  const TICK_MS = 6000;
  const KARTU = /[?&]kartu\b/.test(location.search);   // ?kartu: tampilan untuk screenshot otomatis
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches || KARTU;   // kartu: tanpa animasi agar screenshot tajam
  // Bahasa: pilihan pengguna di Pengaturan; kalau belum memilih, perangkat di zona waktu Indonesia → Indonesia
  // (banyak orang Indonesia memakai HP berbahasa Inggris), selain itu ikut bahasa browser.
  const BAHASA = (() => {
    let b = null;
    try { b = localStorage.getItem("wui-bahasa"); } catch { /* mode privat */ }
    if (b === "id" || b === "en") return b;
    let zona = "";
    try { zona = Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { /* abaikan */ }
    if (/^Asia\/(Jakarta|Pontianak|Makassar|Jayapura)$/.test(zona)) return "id";
    return /^(id|ms)\b/i.test(navigator.language || "") ? "id" : "en";
  })();
  const LOKAL = BAHASA === "en" ? "en-GB" : "id-ID";
  // Pengunjung lama (datang sebelum ada panduan) dikenali dari jejak kunjungan sebelumnya: pengaturan tersimpan
  // (wui-…) atau service worker yang sudah terpasang. Dicek di awal, sebelum situs ini menulis apa pun.
  const PERNAH_DATANG = (() => {
    try { for (let k = 0; k < localStorage.length; k++) if (/^wui-/.test(localStorage.key(k) || "")) return true; } catch { /* mode privat */ }
    return false;
  })();
  const SW_LAMA = ("serviceWorker" in navigator ? navigator.serviceWorker.getRegistration().then((r) => !!r) : Promise.resolve(false))
    .catch(() => false);
  // ---------- bahasa: Indonesia / English ----------
  // Teks ditulis dalam bahasa Indonesia di kode. Saat bahasa Inggris dipilih, teks yang tampil di layar diterjemahkan
  // lewat kamus (cocok persis), frasa (potongan kalimat), dan pola (teks dengan angka/nama). Konten asli dari sumber
  // (judul berita, isi laporan warga, laporan & rekomendasi PVMBG, kronologi BNPB) sengaja TIDAK diterjemahkan.
  const KAMUS_EN = {
    // kepala & pengaturan
    "LIVE": "LIVE", "Memuat data…": "Loading data…", "Pengaturan": "Settings", "Tampilan": "Appearance", "Tema": "Theme",
    "Gelap": "Dark", "Terang": "Light", "Bahasa": "Language", "Pasang di HP": "Install on phone",
    "Pasang What'sUpIndonesia": "Install What'sUpIndonesia", "Sudah terpasang": "Already installed",
    "Info & sumber data": "Info & data sources", "Lihat panduan": "View guide", "Sumber data": "Data sources",
    "Bukan sumber resmi.": "Not an official source.", "Info resmi:": "Official info:",
    "Peringatan tsunami resmi hanya dari": "Official tsunami warnings only from",
    "Gagal memuat data. Coba muat ulang halaman.": "Failed to load data. Try reloading the page.",
    "Sumber bermasalah:": "Source problems:",
    // dock & panel
    "rumah": "houses", "terendam": "flooded", "orang": "people", "mengungsi": "displaced", "meninggal/": "dead/", "hilang": "missing",
    "gempa": "earthquakes", "titik panas": "hotspots", "banjir": "floods", "aktif": "active", "gunung": "volcanoes", "waspada": "advisory+",
    "laporan": "reports", "7 hari": "7 days", "24 jam": "24 h", "Waspada": "Advisory", "Siaga": "Watch", "Awas": "Warning",
    "berita": "news", "dari": "than", "provinsi": "provinces",
    "Gempa": "Earthquakes", "Titik panas": "Hotspots", "Hotspot": "Hotspots", "Banjir": "Floods", "Gunung": "Volcanoes",
    "Gunung api": "Volcanoes", "Gempa · 7 hari": "Earthquakes · 7 days", "Titik panas · 24 jam": "Hotspots · 24 h",
    "Banjir · waspada": "Floods · alerts", "Gunung api · waspada+": "Volcanoes · advisory+", "Semua lapisan": "All layers",
    "Sembunyikan daftar": "Hide list", "Tampilkan daftar": "Show list", "Daftar": "List",
    "Belum ada data untuk saat ini.": "No data at the moment.",
    "7 hari terakhir · BMKG, dicek tiap menit · laporan warga": "Last 7 days · BMKG, checked every minute · citizen reports",
    "24 jam terakhir · satelit NASA FIRMS · laporan warga": "Last 24 hours · NASA FIRMS satellites · citizen reports",
    "Peringatan BMKG · laporan warga (banjir, angin kencang) · data resmi BNPB": "BMKG warnings · citizen reports (floods, strong winds) · official BNPB data",
    "Tingkat aktivitas · MAGMA Indonesia (PVMBG, Badan Geologi)": "Activity level · MAGMA Indonesia (PVMBG, Geological Agency)",
    "Daya api kecil": "Low fire power", "besar": "high",
    "Warna = daya radiasi api (FRP). Titik pudar = keyakinan rendah. Bulatan bergaris putih = laporan warga.":
      "Color = fire radiative power (FRP). Faded dots = low confidence. White-outlined circles = citizen reports.",
    "Waspada (BMKG)": "Alert (BMKG)", "Terjadi (warga)": "Happening (citizens)", "Resmi (BNPB)": "Official (BNPB)",
    "Area tergenang": "Flooded area",
    "Level I Normal sampai IV Awas. Ikuti rekomendasi dan jarak aman dari PVMBG.": "Level I Normal to IV Warning. Follow PVMBG recommendations and safe distances.",
    "Waspada sekarang · BMKG": "Active alerts · BMKG", "Banjir terjadi · laporan warga 7 hari": "Floods happening · citizen reports, 7 days",
    "Angin kencang · laporan warga 7 hari": "Strong winds · citizen reports, 7 days", "Data resmi · BNPB minggu ini": "Official data · BNPB this week",
    "Area tergenang · PetaBencana 48 jam": "Flooded areas · PetaBencana, 48 h",
    "Tidak ada peringatan hujan lebat aktif saat ini.": "No active heavy-rain warnings right now.",
    "Belum ada laporan banjir dari warga.": "No flood reports from citizens yet.",
    "Data resmi diperbarui mingguan, bisa tertinggal beberapa hari.": "Official data is updated weekly and may lag by a few days.",
    "Belum ada kejadian banjir tercatat BNPB minggu ini.": "No floods recorded by BNPB this week.",
    "Kabupaten/kota dengan titik panas terbanyak (24 jam)": "Regencies/cities with the most hotspots (24 h)",
    "Laporan warga · 7 hari": "Citizen reports · 7 days", "Laporan warga · kebakaran & asap 7 hari": "Citizen reports · fires & haze, 7 days",
    "Gunung pendakian · tidak dipantau PVMBG": "Hiking mountains · not monitored by PVMBG", "Erupsi tercatat": "Eruption recorded",
    // ticker
    "Gempa terbaru · BMKG": "Latest earthquake · BMKG", "Gempa terbesar 24 jam": "Largest earthquake, 24 h",
    "Titik panas 24 jam": "Hotspots, 24 h", "Waspada banjir · peringatan BMKG": "Flood alert · BMKG warning",
    "Gunung api · MAGMA Indonesia": "Volcanoes · MAGMA Indonesia", "BARU": "NEW",
    // popup umum
    "Detail": "Details", "Berita": "News", "Kondisi": "Conditions", "Laporan": "Report", "Rekomendasi": "Recommendations",
    "Medsos": "Social media", "Kronologi": "Chronology", "Kecamatan": "Districts", "Kejadian": "Events",
    "Berita karhutla": "Forest fire news", "Berita banjir": "Flood news", "Detail guncangan": "Shaking details",
    "Lokasi": "Location", "Kedalaman": "Depth", "Potensi": "Potential", "Wilayah": "Area", "Dirasakan": "Felt",
    "(laporan BMKG)": "(BMKG report)", "Keyakinan": "Confidence", "Satelit": "Satellite", "Daya api": "Fire power",
    "Tinggi air": "Water height", "Dampak": "Impact", "Visual": "Visual", "Lainnya": "Other", "Kegempaan": "Seismicity",
    "Perkiraan radius guncangan (skala MMI)": "Estimated shaking radius (MMI scale)", "Peta guncangan BMKG": "BMKG shakemap",
    "Waspada hujan lebat": "Heavy rain alert", "Infografis BMKG": "BMKG infographic", "laporan lengkap": "full report",
    "lihat laporan": "see report", "lihat": "see", "Foto laporan warga": "Citizen report photo",
    "Belum ada berita media untuk gempa ini.": "No media coverage for this earthquake yet.",
    "Gempa kecil ini jarang diberitakan media.": "Small earthquakes like this are rarely covered by the media.",
    "Belum ada berita media untuk kejadian ini.": "No media coverage for this event yet.",
    "Belum ditemukan berita media untuk kejadian ini.": "No media coverage found for this event.",
    "Tidak ada kejadian yang tercatat di wilayah ini saat ini.": "No events recorded in this area right now.",
    "Erupsi tercatat di MAGMA": "Eruption recorded in MAGMA", "Peringatan abu penerbangan (VONA)": "Aviation ash warning (VONA)",
    "Gunung pendakian": "Hiking mountain",
    "Tidak termasuk gunung api yang dipantau PVMBG, jadi tidak ada status level aktivitas.": "Not a volcano monitored by PVMBG, so there is no activity level.",
    "Status Normal: tidak ada peningkatan aktivitas yang dilaporkan.": "Normal status: no increase in activity reported.",
    "Memuat prakiraan…": "Loading forecast…", "Prakiraan cuaca gagal dimuat. Coba buka lagi nanti.": "Weather forecast failed to load. Try again later.",
    "Foto & Video Aktivitas Terbaru": "Latest Photos & Videos", "Hari ini": "Today",
 "Besok": "Tomorrow", "hembusan": "gusts", "Instagram": "Instagram",
    "Cerah": "Clear", "Cerah berawan": "Partly cloudy", "Berawan": "Cloudy", "Berkabut": "Foggy", "Gerimis": "Drizzle",
    "Hujan": "Rain", "Salju/es": "Snow/ice", "Hujan lokal": "Showers", "Hujan es": "Hail", "Badai petir": "Thunderstorm",
    "Senin": "Monday", "Selasa": "Tuesday", "Rabu": "Wednesday", "Kamis": "Thursday", "Jumat": "Friday", "Sabtu": "Saturday", "Minggu": "Sunday",
    // kualitas udara & angin
    "Kualitas udara": "Air quality", "Baik": "Good", "Sedang": "Moderate", "Tidak sehat": "Unhealthy",
    "Sangat tidak sehat": "Very unhealthy", "Berbahaya": "Hazardous", "Stasiun tanpa sensor PM2.5": "Station without a PM2.5 sensor",
    "Tanpa PM2.5": "No PM2.5", "Indeks per polutan": "Index per pollutant", "Polutan penentu": "Dominant pollutant",
    "Stasiun terdekat": "Nearest stations", "Perkiraan berikutnya": "Next forecasts", "data lama": "old data",
    "Udara bersih, aman untuk aktivitas luar ruangan.": "Clean air, safe for outdoor activities.",
    "Masih dapat diterima. Kelompok sensitif kurangi aktivitas berat di luar.": "Acceptable. Sensitive groups should reduce heavy outdoor activity.",
    "Kurangi aktivitas luar ruangan; pakai masker bila perlu keluar.": "Reduce outdoor activity; wear a mask if you need to go out.",
    "Hindari aktivitas luar ruangan; tutup jendela.": "Avoid outdoor activities; close the windows.",
    "Tetap di dalam ruangan. Kelompok sensitif cari ruangan berudara bersih.": "Stay indoors. Sensitive groups should find a room with clean air.",
    "Perkiraan = model CAMS (Open-Meteo) yang dikoreksi stasiun PM2.5 terdekat; bukan alat ukur.": "Estimate = CAMS model (Open-Meteo) corrected by nearby PM2.5 stations; not a measurement.",
    "Angin 10 m di atas permukaan, titik grid ±165 km · model cuaca via Open-Meteo. Bukan peringatan resmi BMKG.": "Wind 10 m above ground, grid points ±165 km apart · weather model via Open-Meteo. Not an official BMKG warning.",
    "Prakiraan berikutnya (km/jam)": "Next forecasts (km/h)",
    // cari
    "Cari daerah, kelurahan, tempat, atau gunung": "Search areas, villages, places, or volcanoes",
    "Contoh: Bandung, Jawa Timur, Bromo, GBK, Kartini": "Examples: Bandung, East Java, Bromo, GBK, Kartini",
    "Memuat daftar wilayah…": "Loading the list of areas…", "Daftar wilayah gagal dimuat.": "Failed to load the list of areas.",
    "Mencari…": "Searching…", "Mencari tempat…": "Searching places…", "Tempat · OpenStreetMap": "Places · OpenStreetMap",
    "Provinsi": "Province", "Kota": "City", "Kabupaten": "Regency", "Desa/kelurahan": "Village", "Kelurahan": "Urban village",
    "Lingkungan": "Neighbourhood", "Kawasan": "Quarter", "Dusun": "Hamlet", "Kota kecil": "Town", "Pulau": "Island",
    "Stadion": "Stadium", "Pusat olahraga": "Sports centre", "Kawasan olahraga": "Sports ground", "Taman": "Park",
    "Tempat wisata": "Attraction", "Museum": "Museum", "Monumen": "Monument", "Kebun binatang": "Zoo", "Taman hiburan": "Theme park",
    "Pantai": "Beach", "Puncak": "Peak", "Stasiun": "Station", "Bandara": "Airport", "Kampus": "Campus", "Rumah sakit": "Hospital",
    "Mal": "Mall", "Pasar": "Market", "Tempat ibadah": "Place of worship", "Lapangan golf": "Golf course", "Teluk": "Bay",
    "Danau": "Lake", "Air terjun": "Waterfall", "Bangunan bersejarah": "Historic building", "Jalan": "Street", "Tempat": "Place",
    // panduan
    "Lewati": "Skip", "Kembali": "Back", "Lanjut": "Next", "Selesai": "Done",
    "Selamat datang di What'sUpIndonesia": "Welcome to What'sUpIndonesia",
    "Kejadian di Indonesia dalam satu peta. Ikuti panduan singkat ini, kurang dari 1 menit.": "Events across Indonesia on one map. Take this short tour, under a minute.",
    "Kabar terbaru": "Latest news",
    "Kabar penting berganti tiap beberapa detik. Ketuk untuk langsung melihatnya di peta.": "Key updates rotate every few seconds. Tap one to see it on the map.",
    "Lapisan kejadian": "Event layers",
    "Pilih Gempa, Titik panas, Banjir, atau Gunung untuk melihat daftar dan lokasinya. Ketuk titik di peta untuk detail, berita, dan sumber datanya.":
      "Choose Earthquakes, Hotspots, Floods, or Volcanoes to see the list and locations. Tap a point on the map for details, news, and data sources.",
    "Cari daerah & tempat": "Search areas & places",
    "Cari provinsi, kota, kelurahan, atau nama tempat. Peta langsung menuju ke sana.": "Search for a province, city, village, or place name. The map takes you straight there.",
    "Angin & kualitas udara": "Wind & air quality",
    "Nyalakan animasi arah angin atau peta kualitas udara. Saat aktif, ketuk titik mana pun di peta untuk melihat detailnya.":
      "Turn on the wind animation or the air quality map. While on, tap anywhere on the map for details.",
    "Layer": "Layer", "Untuk menyembunyikan semua titik kejadian.": "Hides all event points.",
    "Ringkasan per daerah": "Summary by area",
    "Ketuk kabupaten atau kota mana pun di peta untuk melihat ringkasan kejadian dan berita di daerah itu, seperti contoh Kota Jakarta Pusat ini.":
      "Tap any regency or city on the map to see a summary of events and news there, like this example of Central Jakarta.",
    "Ganti tema terang/gelap, pasang situs ini di HP, dan lihat sumber data. Panduan ini bisa diputar lagi dari sini.":
      "Switch light/dark theme, change language, install this site on your phone, and see data sources. You can replay this tour from here.",
    "Muat ulang": "Reload", "Ambil data dan versi situs terbaru kapan saja.": "Get the latest data and site version at any time.",
    // label & tombol (atribut)
    "Muat ulang halaman": "Reload page", "Muat ulang halaman (data & versi terbaru)": "Reload page (latest data & version)",
    "Cari wilayah (/)": "Search (/)", "Tutup pencarian": "Close search", "Kembali ke pengaturan": "Back to settings",
    "Kembali ke semua lapisan": "Back to all layers", "Angin: nyala/mati": "Wind: on/off", "Polusi udara (PM2.5): nyala/mati": "Air pollution (PM2.5): on/off",
    "Lapisan angin": "Wind layer", "Lapisan polusi udara": "Air pollution layer", "Lapisan peta": "Map layers",
    "Sembunyikan semua lapisan kejadian": "Hide all event layers",
    "Sembunyikan semua titik kejadian (gempa, titik panas, banjir, gunung, laporan)": "Hide all event points (earthquakes, hotspots, floods, volcanoes, reports)",
    "Tampilkan lagi semua titik kejadian": "Show all event points again", "Peta Indonesia": "Map of Indonesia",
    "What'sUpIndonesia — kembali ke semua lapisan": "What'sUpIndonesia — back to all layers",
    "Cari kabupaten, kota, atau provinsi": "Search regencies, cities, or provinces",
    "Cari kota, kabupaten, atau provinsi": "Search cities, regencies, or provinces",
  };
  // potongan kalimat (diganti di dalam teks yang lebih panjang); yang panjang didahulukan
  const FRASA_EN = Object.entries({
    "Gempa (7 hari)": "Earthquakes (7 days)", "Titik panas (24 jam)": "Hotspots (24 h)", "Banjir (waspada)": "Floods (alerts)",
    "Gunung api (waspada+)": "Volcanoes (advisory+)", "Diperbarui": "Updated", "Laporan warga": "Citizen report",
    "laporan warga": "citizen reports", "Diukur pukul": "Measured at", "berlaku hingga": "valid until", "hingga": "until",
    "Prakiraan cuaca di puncak": "Weather forecast at the summit", "Dalam radius": "Within",
    "Udara di sini": "Air here", "Perkiraan PM2.5": "Estimated PM2.5", "setara ISPU": "equivalent to ISPU",
    "Ringkasan": "Summary of", "Kejadian di": "Events in", "Belum ada berita banjir di": "No flood news yet in",
    "Belum ada berita kebakaran hutan/lahan di": "No forest/land fire news yet in", "Belum ada berita kejadian di": "No event news yet in",
    "Belum ada berita tentang Gunung": "No news yet about Mount", "(36 jam terakhir)": "(last 36 hours)", "(3 hari terakhir)": "(last 3 days)",
    "Sumber: satelit NASA FIRMS. Titik panas = deteksi panas, belum tentu kebakaran.": "Source: NASA FIRMS satellites. Hotspot = heat detection, not necessarily a fire.",
    "Sumber: peringatan dini cuaca BMKG": "Source: BMKG early weather warning", "potensi": "potential", "bukan banjir pasti.": "not a confirmed flood.",
    "Sumber: BNPB (Kejadian Bencana Mingguan) — bisa tertinggal beberapa hari.": "Source: BNPB (weekly disaster events) — may lag by a few days.",
    "Sumber: laporan warga via PetaBencana.id": "Source: citizen reports via PetaBencana.id", "Sumber: MAGMA Indonesia (PVMBG, Badan Geologi)": "Source: MAGMA Indonesia (PVMBG, Geological Agency)",
    "Sumber: PVMBG via MAGMA Indonesia": "Source: PVMBG via MAGMA Indonesia", "Sumber:": "Source:",
    "Radius guncangan: perkiraan kasar dari magnitudo & kedalaman (rumus atenuasi Allen dkk. 2012), bukan pengukuran. Dirasakan & peta guncangan: BMKG.":
      "Shaking radius: rough estimate from magnitude & depth (Allen et al. 2012 attenuation), not a measurement. Felt reports & shakemap: BMKG.",
    "Cuaca puncak: model Open-Meteo": "Summit weather: Open-Meteo model", "titik panas: NASA FIRMS": "hotspots: NASA FIRMS",
    "gempa: BMKG": "earthquakes: BMKG", "level: MAGMA Indonesia (PVMBG)": "level: MAGMA Indonesia (PVMBG)",
    "lokasi & ketinggian: OpenStreetMap": "location & elevation: OpenStreetMap", "Lokasi: OpenStreetMap (pencarian Photon)": "Location: OpenStreetMap (Photon search)",
    "Stasiun resmi ISPU Kementerian Lingkungan Hidup": "Official ISPU station, Ministry of Environment",
    "Diperkirakan": "Estimated to be", "tidak terasa": "not felt", "di permukaan": "at the surface",
    "pusat gempa sangat dalam": "very deep hypocentre", "magnitudo kecil": "small magnitude",
    "dan BMKG tidak mencatatnya sebagai gempa dirasakan": "and BMKG did not record it as felt",
    "Sangat kuat — kerusakan ringan-sedang": "Very strong — light to moderate damage", "Kuat — benda jatuh, retak ringan": "Strong — objects fall, light cracks",
    "Cukup kuat — dirasakan hampir semua orang": "Fairly strong — felt by almost everyone", "Terasa — jendela & pintu bergetar": "Felt — windows & doors rattle",
    "Lemah — terasa di dalam rumah": "Weak — felt indoors", "Sangat lemah — dirasakan sebagian orang": "Very weak — felt by some people",
    "Stasiun ini": "This station", "tidak mengukur PM2.5": "does not measure PM2.5", "(debu halus), polutan utama di kota.": "(fine dust), the main urban pollutant.",
    "Angkanya tidak bisa dibandingkan dengan stasiun lain. Lihat warna heatmap di sekitarnya.": "Its number can't be compared with other stations. Check the heatmap colors around it.",
    "Angka ini jauh": "This value is much", "lebih rendah": "lower", "lebih tinggi": "higher",
    "stasiun sekitarnya": "nearby stations", "nilai tengah ISPU": "median ISPU", "Bisa karena lokasi alat": "Possibly due to the sensor location",
    "mis. di taman": "e.g. in a park", "mis. dekat sumber asap": "e.g. near a smoke source",
    "atau gangguan alat, jadi tidak dipakai untuk warna heatmap.": "or a sensor fault, so it is not used for the heatmap colors.",
    "tanpa sensor PM2.5": "no PM2.5 sensor", "dari sekitar": "than its surroundings", "jauh lebih": "much",
    "keyakinan tinggi": "high confidence", "berita karhutla": "forest fire news", "rumah terendam": "houses flooded",
    "gunung lain berstatus Normal (segitiga hijau di peta).": "other volcanoes are at Normal status (green triangles on the map).",
    "gunung berstatus": "volcanoes at", "Hujan lebat di": "Heavy rain in", "terbanyak": "most in",
    "Kota ·": "City ·", "Kabupaten ·": "Regency ·", "tidak ditemukan.": "not found.", "Tidak hujan": "No rain",
    "Gagal": "Failed", "Bukan peringatan resmi": "Not an official warning",
  }).sort((a, b) => b[0].length - a[0].length).map(([id, en]) => [new RegExp(
    (/^[\p{L}\d]/u.test(id) ? String.raw`(?<![\p{L}\d])` : "") + id.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`)
      + (/[\p{L}\d]$/u.test(id) ? String.raw`(?![\p{L}\d])` : ""), "gu"), en]);
  const POLA_EN = [
    [/^baru saja$/, "just now"], [/(?<!\d)1 hari lalu/g, "1 day ago"], [/(\d+) menit lalu/g, "$1 min ago"], [/(\d+) jam lalu/g, "$1 h ago"], [/(\d+) hari lalu/g, "$1 days ago"],
    [/(\d+) menit lagi/g, "in $1 min"], [/(\d+) jam lagi/g, "in $1 h"], [/^berakhir$/, "ended"],
    [/(\d[\d.,]*) kejadian/g, "$1 events"], [/(\d[\d.,]*) berita/g, "$1 news"], [/(\d+) dari (\d+)/g, "$1 of $2"],
    [/(\d[\d.,]*) km (barat daya|barat laut|timur laut|tenggara|barat|timur|utara|selatan)\b/g, (m, km, a) =>
      `${km} km ${{ "barat daya": "southwest of", "barat laut": "northwest of", "timur laut": "northeast of", tenggara: "southeast of",
        barat: "west of", timur: "east of", utara: "north of", selatan: "south of" }[a]}`],
    [/Level (IV|III|II|I) · (Awas|Siaga|Waspada|Normal)/g, (m, r, n) => `Level ${r} · ${{ Awas: "Warning", Siaga: "Watch", Waspada: "Advisory", Normal: "Normal" }[n]}`],
    [/\b(Awas|Siaga|Waspada) \(Level (IV|III|II)\)/g, (m, n, r) => `${{ Awas: "Warning", Siaga: "Watch", Waspada: "Advisory" }[n]} (Level ${r})`],
    [/^Level (IV|III|II|I) · /, "Level $1 · "], [/^Daftar (.+)$/, "List: $1"], [/^Kedalaman (\d)/, "Depth $1"],
    [/kedalaman ([\d.,?]+) km/g, "depth $1 km"], [/(\d+) mdpl/g, "$1 m asl"], [/±(\d[\d.,]*) mdpl/g, "±$1 m asl"],
    [/Tidak berpotensi tsunami/g, "No tsunami potential"], [/Berpotensi tsunami/g, "Tsunami potential"],
    [/Pusat gempa berada di (laut|darat) /g, ""], [/(\d+) km lalu/g, "$1 km ago"],
    [/^Satelit (.+) · terbaru$/, "Satellite $1 · latest"],
    [/^Gempa M(\S+)$/, "Earthquake M$1"],
    [/^Laporan warga · (banjir|kebakaran|angin kencang|gempa|kabut asap|gunung api)$/, (m, j) => `Citizen report · ${{ banjir: "flood",
      kebakaran: "fire", "angin kencang": "strong wind", gempa: "earthquake", "kabut asap": "haze", "gunung api": "volcano" }[j]}`],
    [/· Banjir( ·|$)/g, "· Flood$1"],
    [/^Laporan (banjir|kebakaran|angin kencang|gempa|kabut asap|gunung api)$/, (m, j) => `Report: ${{ banjir: "flood", kebakaran: "fire",
      "angin kencang": "strong wind", gempa: "earthquake", "kabut asap": "haze", "gunung api": "volcano" }[j]}`],
    [/(: |· )(Sangat tidak sehat|Tidak sehat|Berbahaya|Sedang|Baik)$/, (m, a, k) => a + { Baik: "Good", Sedang: "Moderate",
      "Tidak sehat": "Unhealthy", "Sangat tidak sehat": "Very unhealthy", Berbahaya: "Hazardous" }[k]],
    [/· laporan (Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu),/g, "· report $1,"],
    [/\b(Senin|Selasa|Rabu|Kamis|Jumat|Sabtu|Minggu)\b(?=,? \d)/g, (m, h) => ({ Senin: "Monday", Selasa: "Tuesday", Rabu: "Wednesday",
      Kamis: "Thursday", Jumat: "Friday", Sabtu: "Saturday", Minggu: "Sunday" }[h])],
    [/\b(\d{1,2}) (Januari|Februari|Maret|April|Mei|Juni|Juli|Agustus|September|Oktober|November|Desember) (\d{4})/g, (m, d, b, y) =>
      `${d} ${{ Januari: "January", Februari: "February", Maret: "March", April: "April", Mei: "May", Juni: "June", Juli: "July",
        Agustus: "August", September: "September", Oktober: "October", November: "November", Desember: "December" }[b]} ${y}`],
    [/Provinsi · (\d+) kabupaten\/kota/g, "Province · $1 regencies/cities"],
    [/^Perkiraan dari citra satelit pukul/, "Estimate from satellite image at"],
  ];
  const JANGAN_TERJEMAH = ".nt, .dl-stack dd, .rek, .asli, .maplibregl-ctrl-attrib, [data-asli]";
  function terjemahTeks(t) {
    const inti = t.trim();
    if (!inti || !/[A-Za-z]/.test(inti)) return t;
    if (KAMUS_EN[inti]) return t.replace(inti, KAMUS_EN[inti]);
    let h = t;
    for (const [re, ganti] of POLA_EN) h = h.replace(re, ganti);
    for (const [re, en] of FRASA_EN) h = h.replace(re, en);
    const inti2 = h.trim();
    return KAMUS_EN[inti2] ? h.replace(inti2, KAMUS_EN[inti2]) : h;
  }
  function terjemahNode(akar) {
    if (akar.nodeType === 3) {
      const p = akar.parentElement;
      if (p && !p.closest(JANGAN_TERJEMAH) && !/^(SCRIPT|STYLE)$/.test(p.tagName)) {
        const baru = terjemahTeks(akar.nodeValue);
        if (baru !== akar.nodeValue) akar.nodeValue = baru;
      }
      return;
    }
    if (akar.nodeType !== 1 || akar.closest?.(JANGAN_TERJEMAH)) return;
    for (const at of ["title", "aria-label", "placeholder", "alt"]) {
      const v = akar.getAttribute?.(at);
      if (v) { const b = terjemahTeks(v); if (b !== v) akar.setAttribute(at, b); }
    }
    const jalan = document.createTreeWalker(akar, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    let n = jalan.nextNode();
    while (n) { if (n !== akar) terjemahNode(n); n = jalan.nextNode(); }
  }
  if (BAHASA === "en") {
    document.documentElement.lang = "en";
    document.title = "What'sUpIndonesia — What's happening in Indonesia today?";
    terjemahNode(document.body);
    new MutationObserver((ms) => {
      for (const m of ms) {
        if (m.type === "characterData") terjemahNode(m.target);
        else { m.addedNodes.forEach(terjemahNode); if (m.type === "attributes") terjemahNode(m.target); }
      }
    }).observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["title", "aria-label", "placeholder"] });
  }


  // Statistik pemakaian fitur (Umami, tanpa cookie). Diam saja kalau skrip analitik tidak termuat.
  function lacak(nama, data) {
    try { if (window.umami && typeof window.umami.track === "function") window.umami.track(nama, data); } catch { /* abaikan */ }
  }

  // Ikon garis (gaya Lucide, ISC) agar tampil konsisten di semua perangkat (bukan emoji)
  const P = {
    gempa: '<path d="M22 12h-4l-3 9L9 3l-3 9H2"/>',
    api: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.4-.5-2-1-3-1.1-2.1-.2-4 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.2.4-2.3 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    lapor: '<path d="m3 11 18-5v12L3 14v-3z"/><path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>',
    banjir: '<path d="M2 6c.6.5 1.2 1 2.5 1C7 7 7 5 9.5 5c2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 12c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/><path d="M2 18c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 2.6 0 2.4 2 5 2 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1"/>',
    angin: '<path d="M17.7 7.7a2.5 2.5 0 1 1 1.8 4.3H2"/><path d="M9.6 4.6A2 2 0 1 1 11 8H2"/><path d="M12.6 19.4A2 2 0 1 0 14 16H2"/>',
    asap: '<path d="M17.5 19H9a7 7 0 1 1 6.7-9h1.8a4.5 4.5 0 1 1 0 9Z"/>',
    gunung: '<path d="m8 3 4 8 5-5 5 15H2L8 3z"/>',
    berita: '<path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9c0-1.1.9-2 2-2h2"/><path d="M18 14h-8M15 18h-5M10 6h8v4h-8z"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
    lapisan: '<path d="m12 2 10 5-10 5L2 7l10-5Z"/><path d="m2 17 10 5 10-5"/><path d="m2 12 10 5 10-5"/>',
    lapisanMati: '<path d="m12 2 10 5-3.5 1.75"/><path d="M8.6 9.7 2 7l4-2"/><path d="m2 17 10 5 6-3"/><path d="m2 12 10 5 3-1.5"/><path d="M2 2l20 20"/>',
  };
  const icon = (k) => `<svg viewBox="0 0 24 24">${P[k] || P.pin}</svg>`;

  const JENIS = {
    banjir: { warna: "#3ea6ff", ic: "banjir" }, kebakaran: { warna: "#ff7a00", ic: "api" },
    "kabut asap": { warna: "#9aa0a6", ic: "asap" }, "angin kencang": { warna: "#2dd4bf", ic: "angin" },
    gempa: { warna: "#b37feb", ic: "gempa" }, "gunung api": { warna: "#e55353", ic: "gunung" },
  };
  const jWarna = (j) => JENIS[j]?.warna || "#cfd8e3";
  // Laporan warga (PetaBencana.id) tidak punya dock sendiri: tampil di lapisan sesuai jenis bencananya
  const LAPORAN_KE = { banjir: "banjir", "angin kencang": "banjir", kebakaran: "titik_panas", "kabut asap": "titik_panas",
    gempa: "gempa", "gunung api": "gunung_api" };
  const jenisLaporanDi = (mode) => Object.keys(LAPORAN_KE).filter((j) => LAPORAN_KE[j] === mode);
  const jIcon = (j) => icon(JENIS[j]?.ic || "pin");

  // Titik panas: oranye (daya api kecil) → merah tua (daya api besar), berdasarkan FRP (MW)
  const FRP_RAMP = [0, "#ffa53a", 5, "#ff7a1a", 15, "#ff4013", 40, "#e0121b", 120, "#b0001a"];
  // Skala intensitas guncangan (MMI) untuk lingkaran perkiraan
  const MMI = [
    { lv: 7, rom: "VII", warna: "#b91c1c", ket: "Sangat kuat — kerusakan ringan-sedang" },
    { lv: 6, rom: "VI", warna: "#ef4444", ket: "Kuat — benda jatuh, retak ringan" },
    { lv: 5, rom: "V", warna: "#fb923c", ket: "Cukup kuat — dirasakan hampir semua orang" },
    { lv: 4, rom: "IV", warna: "#facc15", ket: "Terasa — jendela & pintu bergetar" },
    { lv: 3, rom: "III", warna: "#7dd3fc", ket: "Lemah — terasa di dalam rumah" },
    { lv: 2, rom: "II", warna: "#a5b4fc", ket: "Sangat lemah — dirasakan sebagian orang" },
  ];
  const ROMAWI = { I: 1, II: 2, III: 3, IV: 4, V: 5, VI: 6, VII: 7, VIII: 8, IX: 9 };

  const MODES = {
    gempa: { title: "Gempa", sub: "7 hari terakhir · BMKG, dicek tiap menit · laporan warga", c: "#ff4d4f", ic: "gempa", layers: ["gempa", "gempa-label"] },
    titik_panas: { title: "Titik panas", sub: "24 jam terakhir · satelit NASA FIRMS · laporan warga", c: "#ff6a1a", ic: "api", layers: ["titik_panas", "titik_panas-glow"] },
    // only = lapisan yang hanya tampil di mode ini (tidak di beranda)
    banjir: { title: "Banjir", sub: "Peringatan BMKG · laporan warga (banjir, angin kencang) · data resmi BNPB", c: "#22d3ee", ic: "banjir",
      layers: ["peringatan-fill", "peringatan-line", "bnpb-fill", "bnpb-line", "banjir-area-fill", "banjir-area-line"],
      only: ["banjir-lapor-glow", "banjir-lapor"] },
    gunung_api: { title: "Gunung api", sub: "Tingkat aktivitas · MAGMA Indonesia (PVMBG, Badan Geologi)", c: "#f59e0b", ic: "gunung",
      layers: ["gunung_api", "gunung_api-label"] },
  };
  // Tingkat aktivitas gunung api (PVMBG)
  const LEVEL_GUNUNG = {
    4: { nama: "Awas", rom: "IV", warna: "#ef4444" }, 3: { nama: "Siaga", rom: "III", warna: "#fb923c" },
    2: { nama: "Waspada", rom: "II", warna: "#facc15" }, 1: { nama: "Normal", rom: "I", warna: "#22c55e" }, // hijau = warna resmi PVMBG Level I
    0: { nama: "Pendakian", rom: "–", warna: "#22c55e" }, // gunung pendakian (tidak dipantau PVMBG): warna sama dgn Normal, label beda di popup
  };
  const segitiga = (c) => `<svg viewBox="0 0 24 24" style="fill:${c};stroke:none"><path d="M12 3 22.5 20.5h-21z"/></svg>`;
  const WARNA_WASPADA = "#fbbf24", WARNA_BNPB = "#22d3ee";

  const state = {
    data: { gempa: null, titik_panas: null, laporan: null, peringatan: null, banjir_bnpb: null, banjir: null,
      gunung_api: null, banjir_area: null },
    berita: {}, meta: null, mode: null, jenis: "semua",
    pulseMarkers: [], popup: null, mapReady: false, ringsOwner: null, anim: 0,
    tick: { items: [], i: 0, timer: null }, lastQuake: null, firstLoad: true,
  };

  // ---------- util ----------
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const safeUrl = (u) => (/^https:\/\//i.test(u || "") ? u : null);
  const fmtWIB = (iso) => new Intl.DateTimeFormat(LOKAL, {
    timeZone: "Asia/Jakarta", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  }).format(new Date(iso)) + " WIB";
  function ago(iso) {
    const m = Math.round((Date.now() - new Date(iso)) / 60000);
    if (m < 1) return "baru saja";
    if (m < 60) return `${m} menit lalu`;
    const h = Math.round(m / 60);
    if (h < 24) return `${h} jam lalu`;
    return `${Math.round(h / 24)} hari lalu`;
  }
  const num = (n) => new Intl.NumberFormat(LOKAL).format(n);
  // Angka di dock/panel per lapisan
  function hitung(mode) {
    if (mode === "gunung_api") return (state.data.gunung_api?.features || []).filter((f) => f.properties.level >= 2).length;
    return state.data[mode]?.features.length || 0;
  }
  // Rapikan teks lokasi BMKG: "130 km BaratDaya MALUKUTENGGARA" -> "130 km barat daya Maluku Tenggara"
  function rapiLokasi(s) {
    if (!s) return s;
    let t = String(s).replace(/^Pusat gempa berada di (laut|darat)\s+/i, "");
    // nama wilayah huruf kapital semua: pisah kata yang menempel, lalu Huruf Awal Kapital
    t = t.replace(/\b[A-Z]{4,}(?:-[A-Z]{4,})*\b/g, (w) => w.split("-").map((x) =>
      x.replace(/^(PULAU|KEPULAUAN|KOTA)(?=[A-Z]{3,})/, "$1 ")
        .replace(/([A-Z]{3,}?)(UTARA|SELATAN|TIMUR|BARAT|TENGGARA|TENGAH)$/, "$1 $2")
        .toLowerCase().replace(/(^|\s)([a-z])/g, (_, a, c) => a + c.toUpperCase())).join(", "));
    // arah mata angin huruf kecil: "BaratDaya" -> "barat daya"
    t = t.replace(/\b([Bb]arat|[Tt]imur) ?([Ll]aut|[Dd]aya)\b/g, (_, a, b) => `${a.toLowerCase()} ${b.toLowerCase()}`)
      .replace(/(\d+ km )(Utara|Selatan|Timur|Barat|Tenggara)\b/g, (_, k, w) => k + w.toLowerCase())
      .replace(/([a-z])-([A-Z])/g, "$1, $2");
    return t;
  }
  const jamWIB = (iso) => new Intl.DateTimeFormat(LOKAL, { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso)) + " WIB";
  function sisa(iso) {
    const m = Math.round((new Date(iso) - Date.now()) / 60000);
    if (m <= 0) return "berakhir";
    return m < 60 ? `${m} menit lagi` : `${Math.round(m / 60)} jam lagi`;
  }
  const tglID = (ymd) => new Intl.DateTimeFormat(LOKAL, { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(ymd + "T00:00:00Z"));
  const where = (p) => [p.kabupaten, p.provinsi].filter(Boolean).join(", ");
  const isMobile = () => window.innerWidth <= 760;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  // Data live diambil dulu dari VPS (robot tiap 5 menit). Bila VPS tidak menjawab, atau datanya basi
  // (robot VPS berhenti), pakai salinan dari GitHub Pages (robot GitHub) selama 5 menit berikutnya.
  // Di localhost tetap memakai data lokal, kecuali alamat diberi ?vps.
  const DATA_VPS = "https://data.whatsupindonesia.id/data/";
  const PAKAI_VPS = !/^(localhost|127\.|\[::1\])/.test(location.hostname) || /[?&]vps\b/.test(location.search);
  let vpsMatiSampai = 0;
  async function getJSON(path) {
    const q = `${path}?t=${Math.floor(Date.now() / 60000)}`;
    if (PAKAI_VPS && path.startsWith("live/") && Date.now() > vpsMatiSampai) {
      try {
        const r = await fetch(DATA_VPS + q, AbortSignal.timeout ? { signal: AbortSignal.timeout(8000) } : {});
        if (r.ok) {
          const j = await r.json();
          const basi = path === "live/meta.json" && Date.now() - Date.parse(j.diperbarui) > 40 * 60000;
          if (!basi) return j;
        }
      } catch { /* VPS tidak menjawab */ }
      vpsMatiSampai = Date.now() + 5 * 60000;
    }
    const r = await fetch(`${DATA}${q}`);
    if (!r.ok) throw new Error(`${path}: ${r.status}`);
    return r.json();
  }

  // Angka menghitung naik (dari nilai sebelumnya ke nilai baru)
  function countUp(el, to) {
    const from = +(el.dataset.v || 0);
    el.dataset.v = to;
    if (REDUCED || from === to) { el.textContent = num(to); return; }
    const t0 = performance.now(), dur = 1200;
    const step = (t) => {
      const k = Math.min(1, (t - t0) / dur);
      el.textContent = num(Math.round(from + (to - from) * easeOut(k)));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    setTimeout(() => { el.textContent = num(to); }, dur + 400); // jaga-jaga bila tab tidak aktif
  }

  // Ruang kosong peta (dikurangi UI yang menutupi), untuk fitBounds/flyTo
  function viewPadding() {
    const H = window.innerHeight;
    const tk = $("#ticker"), dock = $("#dock"), panel = $("#panel");
    const top = (tk && !tk.hidden ? tk.getBoundingClientRect().bottom : 70) + 16;
    let bottomTop = dock.offsetHeight ? dock.getBoundingClientRect().top : H;   // dock tersembunyi (mode kartu) = tak memakan tempat
    if (isMobile() && !panel.hidden && panel.offsetHeight) bottomTop = Math.min(bottomTop, panel.getBoundingClientRect().top);
    let bottom = Math.max(H - bottomTop + 16, 40);
    // pengaman: sisakan minimal 120 px peta, kalau tidak MapLibre gagal menghitung kamera (NaN)
    if (top + bottom > H - 120) bottom = Math.max(H - 120 - top, 20);
    const left = !isMobile() && state.mode && !state.listHidden ? 420 : 30;
    return { top, bottom, left, right: 30 };
  }

  // ---------- tema terang/gelap & pilihan pengguna (disimpan di browser) ----------
  const GAYA = { gelap: "https://tiles.openfreemap.org/styles/dark", terang: "https://tiles.openfreemap.org/styles/positron" };
  const simpan = (k, v) => { try { localStorage.setItem(k, v); } catch (_) { /* mode privat */ } };
  const baca = (k) => { try { return localStorage.getItem(k); } catch (_) { return null; } };
  state.tema = document.documentElement.dataset.theme === "light" ? "terang" : "gelap";
  state.angin = baca("wui-angin") === "1";
  state.udara = baca("wui-udara") === "1";
  const warnaTema = () => (state.tema === "terang"
    ? { halo: "#ffffff", teks: "#0f172a", gelombang: "#334155", garis: "#7c8a9c", hover: "#0f172a" }
    : { halo: "#07090d", teks: "#ffffff", gelombang: "#ffffff", garis: "#5b6b7c", hover: "#ffffff" });

  // ---------- peta ----------
  const map = new maplibregl.Map({
    container: "map",
    style: GAYA[state.tema], // gratis, tanpa API key (data OpenStreetMap)
    center: [118, -2], zoom: REDUCED ? 3.6 : 1.4,        // intro: mulai jauh lalu terbang ke Indonesia
    maxBounds: [[40, -60], [200, 55]],
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "bottom-right");
  class KontrolAngin {
    onAdd() {
      const d = document.createElement("div");
      d.className = "maplibregl-ctrl maplibregl-ctrl-group";
      d.innerHTML = `<button type="button" id="sembunyi-btn" class="ctrl-sembunyi" aria-pressed="false"
        title="Sembunyikan semua titik kejadian (gempa, titik panas, banjir, gunung, laporan)" aria-label="Sembunyikan semua lapisan kejadian">${icon("lapisan")}</button>
        <button type="button" id="angin-btn" class="ctrl-angin" aria-pressed="false" title="Angin: nyala/mati"
        aria-label="Lapisan angin">${icon("angin")}</button>
        <button type="button" id="udara-btn" class="ctrl-udara" aria-pressed="false" title="Polusi udara (PM2.5): nyala/mati"
        aria-label="Lapisan polusi udara"><svg viewBox="0 0 24 24"><path d="M4 14.9A7 7 0 1 1 15.7 8h1.8a4.5 4.5 0 0 1 2.5 8.2"/><path d="M16 17H7"/><path d="M17 21H9"/></svg></button>`;
      d.querySelector("#sembunyi-btn").addEventListener("click", () => {
        setSembunyi(!state.sembunyi);
        if (state.sembunyi) lacak("Sembunyikan semua lapisan");
      });
      d.querySelector("#angin-btn").addEventListener("click", () => { setAngin(!state.angin); if (state.angin) lacak("Nyalakan angin"); });
      d.querySelector("#udara-btn").addEventListener("click", () => { setUdara(!state.udara); if (state.udara) lacak("Nyalakan kualitas udara"); });
      return d;
    }
    onRemove() { /* tidak dipakai */ }
  }
  map.addControl(new KontrolAngin(), "bottom-right");

  // ---------- pemulihan peta dasar ----------
  // MapLibre tidak mengulang ubin peta yang gagal diunduh (sinyal lemah / server sibuk), sehingga peta dasar
  // bisa tetap hitam. Bila ubin peta dasar gagal, muat ulang gaya peta (lapisan data dipasang ulang otomatis).
  const SUMBER_KITA = new Set(["wilayah", "titik_panas", "gempa", "laporan", "guncangan", "guncangan-label", "gelombang",
    "peringatan", "gunung_api", "banjir_area", "angin", "udara-img", "ispu"]);
  const pulih = { gagal: 0, coba: 0, t: null };
  map.on("error", (e) => {
    if (e.sourceId ? SUMBER_KITA.has(e.sourceId) : map.isStyleLoaded()) return;
    pulih.gagal++;
    clearTimeout(pulih.t);
    pulih.t = setTimeout(() => {
      if (!pulih.gagal || pulih.coba >= 3) return;   // paling banyak 3 kali berturut-turut
      pulih.coba++; pulih.gagal = 0;
      map.setStyle(GAYA[state.tema], { diff: false });
    }, 3000 * (pulih.coba + 1));
  });
  map.on("idle", () => { if (!pulih.gagal) pulih.coba = 0; });

  // Tombol muat ulang: muat ulang SELURUH halaman (kode terbaru + peta + semua data).
  // Posisi lapisan (#gempa dst.) & pengaturan tetap, karena tersimpan di URL & localStorage.
  function segarkan() {
    const b = $("#segar-btn");
    if (b.classList.contains("putar")) return;
    b.classList.add("putar");
    lacak("Muat ulang");
    location.reload();
  }
  // Apakah situs sudah diperbarui sejak halaman ini dibuka? (bandingkan versi app.js di index.html terbaru)
  const VERSI_INI = (document.querySelector('script[src*="app.js"]')?.getAttribute("src").match(/v=(\d+)/) || [])[1];
  async function adaVersiBaru() {
    try {
      const html = await fetch(`./?cek=${Date.now()}`, { cache: "no-store" }).then((r) => (r.ok ? r.text() : ""));
      const v = (html.match(/app\.js\?v=(\d+)/) || [])[1];
      return !!(v && VERSI_INI && v !== VERSI_INI);
    } catch { return false; }
  }
  // Kembali ke tab / aplikasi terpasang (dari latar belakang, tombol kembali, atau setelah offline):
  // versi baru → muat ulang penuh; kalau tidak, langsung ambil data & gempa terbaru.
  let tSembunyi = 0, sedangSegar = false;
  async function segarkanSaatKembali() {
    if (sedangSegar) return;
    sedangSegar = true;
    try {
      state.swReg?.update().catch(() => {});
      if (await adaVersiBaru()) return location.reload();
      cekGempaRealtime();
      await loadLive();
    } finally { sedangSegar = false; }
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) { tSembunyi = Date.now(); return; }
    const lama = tSembunyi ? Date.now() - tSembunyi : 0;
    tSembunyi = 0;
    if (lama >= 30 * 1000) segarkanSaatKembali();     // ditinggal ≥ 30 detik
  });
  window.addEventListener("pageshow", (e) => { if (e.persisted) segarkanSaatKembali(); }); // halaman dipulihkan dari memori browser
  window.addEventListener("online", segarkanSaatKembali);                                // internet tersambung lagi

  // Lapisan data di atas peta dasar. Dipasang ulang setiap gaya peta berganti (tema terang/gelap).
  function pasangLapisan() {
    const W = warnaTema();
    map.addSource("wilayah", { type: "geojson", data: `${DATA}wilayah.geojson`, promoteId: "id" });
    const below = map.getLayer("highway_name_other") ? "highway_name_other" : undefined;
    map.addLayer({
      id: "wilayah-fill", type: "fill", source: "wilayah",
      paint: { "fill-color": W.hover,
        "fill-opacity": 0 },   // tak terlihat: hanya untuk menangkap klik wilayah (tanpa efek sorot saat kursor lewat)
    }, below);
    map.addLayer({
      id: "wilayah-line", type: "line", source: "wilayah",
      // batas kabupaten/kota tipis & samar agar label peta dasar tetap mudah dibaca (area tetap bisa diklik)
      paint: { "line-color": W.garis, "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.1, 8, 0.25, 11, 0.32],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.25, 9, 0.7, 12, 0.9] },
    }, below);

    const empty = { type: "FeatureCollection", features: [] };
    for (const s of ["titik_panas", "gempa", "laporan", "guncangan", "guncangan-label", "gelombang", "peringatan",
      "gunung_api", "banjir_area"]) {
      map.addSource(s, { type: "geojson", data: empty });
    }

    // Banjir: area peringatan dini BMKG (waspada) + kabupaten tercatat banjir oleh BNPB (resmi)
    map.addLayer({ id: "peringatan-fill", type: "fill", source: "peringatan",
      paint: { "fill-color": WARNA_WASPADA, "fill-opacity": 0.16 } });
    map.addLayer({ id: "peringatan-line", type: "line", source: "peringatan",
      paint: { "line-color": WARNA_WASPADA, "line-width": 1, "line-opacity": 0.75 } });
    map.addLayer({ id: "bnpb-fill", type: "fill", source: "wilayah", filter: ["in", ["get", "id"], ["literal", []]],
      paint: { "fill-color": WARNA_BNPB, "fill-opacity": 0.22 } });
    map.addLayer({ id: "bnpb-line", type: "line", source: "wilayah", filter: ["in", ["get", "id"], ["literal", []]],
      paint: { "line-color": WARNA_BNPB, "line-width": 2.2 } });
    // Garis tepi wilayah hasil pencarian / yang sedang dilihat ringkasannya
    map.addLayer({ id: "sorot-line", type: "line", source: "wilayah",
      filter: ["in", ["get", "id"], ["literal", state.sorot || []]],
      paint: { "line-color": state.tema === "terang" ? "#0f172a" : "#ffd166", "line-width": 2.4, "line-dasharray": [2, 1.2] } });
    // Area RT/RW tergenang (PetaBencana.id), warna menurut tinggi air
    const warnaArea = ["match", ["get", "level"], 4, "#1d4ed8", 3, "#2563eb", 2, "#3b82f6", "#93c5fd"];
    map.addLayer({ id: "banjir-area-fill", type: "fill", source: "banjir_area", paint: { "fill-color": warnaArea, "fill-opacity": 0.45 } });
    map.addLayer({ id: "banjir-area-line", type: "line", source: "banjir_area", paint: { "line-color": warnaArea, "line-width": 1.2 } });

    // Lingkaran perkiraan guncangan + gelombang kejut (muncul saat gempa diklik)
    map.addLayer({ id: "guncangan-fill", type: "fill", source: "guncangan",
      paint: { "fill-color": ["get", "warna"], "fill-opacity": 0.1 } });
    map.addLayer({ id: "guncangan-line", type: "line", source: "guncangan",
      paint: { "line-color": ["get", "warna"], "line-width": 1.6, "line-opacity": 0.9, "line-dasharray": [3, 2] } });
    map.addLayer({ id: "gelombang", type: "line", source: "gelombang",
      paint: { "line-color": W.gelombang, "line-width": 2.2, "line-opacity": ["get", "o"], "line-blur": 1 } });
    map.addLayer({ id: "guncangan-label", type: "symbol", source: "guncangan-label",
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 11,
        "text-anchor": "bottom", "text-allow-overlap": true },
      paint: { "text-color": ["get", "warna"], "text-halo-color": W.halo, "text-halo-width": 1.6 } });

    map.addLayer({
      id: "titik_panas-glow", type: "heatmap", source: "titik_panas", maxzoom: 9,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 1], 0, 0.3, 50, 1],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 4, 7, 9, 20],
        "heatmap-intensity": 0.7,
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 5, 0.6, 9, 0],
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"],
          0, "rgba(255,165,58,0)", 0.25, "rgba(255,165,58,.35)", 0.5, "rgba(255,90,20,.55)",
          0.8, "rgba(224,18,27,.7)", 1, "rgba(176,0,26,.85)"],
      },
    });
    map.addLayer({
      id: "titik_panas", type: "circle", source: "titik_panas",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 1.8, 8, 3.5, 12, 6],
        "circle-color": ["interpolate", ["linear"], ["coalesce", ["get", "frp"], 0], ...FRP_RAMP],
        "circle-opacity": ["match", ["get", "keyakinan"], "rendah", 0.55, 0.95],
        "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 6, 0, 9, 0.6],
        "circle-stroke-color": "#2a0000",
      },
    });
    // Gunung api: segitiga (gambar SDF agar bisa diwarnai per tingkat aktivitas)
    if (!map.hasImage("segitiga")) {
      const n = 48, cv = document.createElement("canvas");
      cv.width = cv.height = n;
      const cx = cv.getContext("2d");
      cx.fillStyle = "#fff";
      cx.beginPath(); cx.moveTo(n / 2, 4); cx.lineTo(n - 3, n - 6); cx.lineTo(3, n - 6); cx.closePath(); cx.fill();
      map.addImage("segitiga", cx.getImageData(0, 0, n, n), { sdf: true, pixelRatio: 2 });
    }
    const warnaLevel = ["match", ["get", "level"], 4, LEVEL_GUNUNG[4].warna, 3, LEVEL_GUNUNG[3].warna,
      2, LEVEL_GUNUNG[2].warna, 1, LEVEL_GUNUNG[1].warna, LEVEL_GUNUNG[0].warna];
    map.addLayer({
      id: "gunung_api", type: "symbol", source: "gunung_api",
      layout: { "icon-image": "segitiga", "icon-allow-overlap": true, "symbol-sort-key": ["get", "level"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "level"], [0, 1], 0.55, 2, 0.75, 1], 9,
          ["match", ["get", "level"], [0, 1], 0.9, 2, 1.1, 1.4]] },
      paint: { "icon-color": warnaLevel, "icon-opacity": ["match", ["get", "level"], [0, 1], 0.85, 1],
        "icon-halo-color": W.halo, "icon-halo-width": 1.5 },
    });
    map.addLayer({
      id: "gunung_api-label", type: "symbol", source: "gunung_api",
      filter: ["step", ["zoom"], [">=", ["get", "level"], 3], 6.5, [">=", ["get", "level"], 2], 8.5, true],
      layout: { "text-field": ["get", "nama"], "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, 1.1],
        "text-anchor": "top", "text-optional": true },
      paint: { "text-color": warnaLevel, "text-halo-color": W.halo, "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "gempa", type: "circle", source: "gempa",
      paint: {
        "circle-radius": ["interpolate", ["exponential", 1.6], ["coalesce", ["get", "magnitudo"], 3], 2, 3, 5, 9, 7.5, 26],
        "circle-color": ["step", ["get", "jam_lalu"], "#ff4d4f", 24, "#ff9f43", 72, "#ffd166"],
        "circle-opacity": ["step", ["get", "jam_lalu"], 0.55, 24, 0.4, 72, 0.3],
        "circle-stroke-color": ["step", ["get", "jam_lalu"], "#ff4d4f", 24, "#ff9f43", 72, "#ffd166"],
        "circle-stroke-width": 1.5,
      },
    });
    map.addLayer({
      id: "gempa-label", type: "symbol", source: "gempa",
      filter: [">=", ["coalesce", ["get", "magnitudo"], 0], 5],
      layout: { "text-field": ["concat", "M", ["to-string", ["get", "magnitudo"]]],
        "text-font": ["Noto Sans Bold"], "text-size": 11, "text-offset": [0, -1.9] },
      paint: { "text-color": W.teks, "text-halo-color": W.halo, "text-halo-width": 1.4 },
    });
    map.addLayer({
      id: "laporan", type: "circle", source: "laporan",
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 5, 10, 9],
        "circle-color": ["match", ["get", "jenis"], ...Object.entries(JENIS).flatMap(([k, v]) => [k, v.warna]), "#cfd8e3"],
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2,
      },
    });
    // Laporan banjir warga, ditonjolkan di lapisan Banjir
    const banjirOnly = ["==", ["get", "jenis"], "banjir"];
    map.addLayer({ id: "banjir-lapor-glow", type: "circle", source: "laporan", filter: banjirOnly,
      layout: { visibility: "none" },
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 12, 10, 22], "circle-color": "#3ea6ff",
        "circle-opacity": 0.25, "circle-blur": 0.8 } });
    map.addLayer({ id: "banjir-lapor", type: "circle", source: "laporan", filter: banjirOnly,
      layout: { visibility: "none" },
      paint: { "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 6, 10, 10], "circle-color": "#3ea6ff",
        "circle-stroke-color": "#ffffff", "circle-stroke-width": 2 } });

    // Angin: panah menunjuk ke arah angin bertiup, warna = kecepatan (km/jam)
    if (!map.hasImage("panah")) {
      const n = 40, cv = document.createElement("canvas");
      cv.width = cv.height = n;
      const cx = cv.getContext("2d");
      cx.fillStyle = "#fff";
      cx.beginPath(); cx.moveTo(20, 2); cx.lineTo(31, 16); cx.lineTo(23.5, 16); cx.lineTo(23.5, 38); cx.lineTo(16.5, 38);
      cx.lineTo(16.5, 16); cx.lineTo(9, 16); cx.closePath(); cx.fill();
      map.addImage("panah", cx.getImageData(0, 0, n, n), { sdf: true, pixelRatio: 2 });
    }
    // Polusi udara: grid PM2.5 digambar ke kanvas kecil, lalu ditampilkan sebagai raster yang dihaluskan
    map.addSource("udara-img", { type: "image", url: GAMBAR_KOSONG, coordinates: [[94, 7], [142, 7], [142, -12], [94, -12]] });
    map.addLayer({ id: "udara-img", type: "raster", source: "udara-img",
      layout: { visibility: state.udara ? "visible" : "none" },
      paint: { "raster-opacity": 1, "raster-resampling": "linear", "raster-fade-duration": 0 } },
    // di BAWAH label peta dasar (nama jalan/kota/negara tetap terbaca di atas warna heatmap)
    map.getLayer("highway_name_other") ? "highway_name_other" : "peringatan-fill");
    // Stasiun ISPU resmi KLH: bulatan berwarna kategori + angka ISPU
    map.addSource("ispu", { type: "geojson", data: empty });
    // Warna = palet yang sama dengan heatmap & legenda. Stasiun tanpa sensor PM2.5 = abu-abu pudar (tidak sebanding).
    const warnaIspu = ["case", ["to-boolean", ["get", "tanpaPM"]], WARNA_TANPA_PM, ["step", ["get", "ispu"], ISPU_RESMI[0].warna,
      51, ISPU_RESMI[1].warna, 101, ISPU_RESMI[2].warna, 201, ISPU_RESMI[3].warna, 301, ISPU_RESMI[4].warna]];
    map.addLayer({ id: "ispu", type: "circle", source: "ispu",
      layout: { visibility: state.udara ? "visible" : "none", "circle-sort-key": ["case", ["to-boolean", ["get", "tanpaPM"]], -1, ["get", "ispu"]] },
      // zoom jauh: titik kecil tanpa angka (tidak penuh); zoom dekat (≥6): bulatan besar + angka ISPU
      paint: { "circle-color": warnaIspu, "circle-radius": ["interpolate", ["linear"], ["zoom"], 4, 4, 5.9, 6, 6, 10, 8, 13, 12, 16],
        "circle-opacity": ["case", ["to-boolean", ["get", "tanpaPM"]], 0.55, 1],
        "circle-stroke-color": "#ffffff", "circle-stroke-width": ["interpolate", ["linear"], ["zoom"], 4, 1, 6, 1.5],
        "circle-stroke-opacity": ["case", ["to-boolean", ["get", "tanpaPM"]], 0.4, 0.85] } });
    map.addLayer({ id: "ispu-label", type: "symbol", source: "ispu", minzoom: 6,
      layout: { visibility: state.udara ? "visible" : "none", "text-field": ["to-string", ["get", "ispu"]],
        "text-font": ["Noto Sans Bold"], "text-size": ["interpolate", ["linear"], ["zoom"], 4, 9, 8, 11, 12, 13],
        "text-allow-overlap": true, "text-ignore-placement": true, "symbol-sort-key": ["get", "ispu"] },
      paint: { "text-color": ["case", ["to-boolean", ["get", "tanpaPM"]], "#e2e8f0",
          ["all", [">", ["get", "ispu"], 50], ["<=", ["get", "ispu"], 200]], "#1a1200", "#ffffff"],
        "text-opacity": ["case", ["to-boolean", ["get", "tanpaPM"]], 0.75, 1] } });
    map.addSource("angin", { type: "geojson", data: empty });
    // Titik grid tak terlihat: target klik untuk info angin (animasinya digambar di kanvas terpisah)
    map.addLayer({ id: "angin-hit", type: "circle", source: "angin",
      layout: { visibility: state.angin ? "visible" : "none" },
      paint: { "circle-radius": 14, "circle-opacity": 0, "circle-stroke-opacity": 0 } });
    // Panah statis hanya untuk pengguna yang mematikan animasi (prefers-reduced-motion)
    map.addLayer({
      id: "angin", type: "symbol", source: "angin",
      layout: { visibility: state.angin && REDUCED ? "visible" : "none", "icon-image": "panah", "icon-rotate": ["get", "ke"],
        "icon-rotation-alignment": "map", "icon-allow-overlap": true, "icon-ignore-placement": true,
        "icon-size": ["interpolate", ["linear"], ["get", "v"], 0, 0.55, 40, 1.1] },
      paint: { "icon-color": ["interpolate", ["linear"], ["get", "v"], ...SKALA_ANGIN.flat()],
        "icon-opacity": 0.85, "icon-halo-color": state.tema === "terang" ? "rgba(15,23,42,.55)" : W.halo,
        "icon-halo-width": state.tema === "terang" ? 0.8 : 1 },
    }, "titik_panas-glow");
  }

  map.on("style.load", () => {
    pasangLapisan();
    if (!state.mapReady) return;      // muat pertama: sisanya di handler "load"
    if (state.data.gempa) applyToMap();
    applyMode(false);
    terapkanAngin();
    terapkanUdara();
  });

  map.on("load", () => {
    // Atribusi peta (ⓘ): MapLibre membukanya otomatis saat awal; tutup, buka hanya bila diklik
    const tutupAtribusi = () => document.querySelector(".maplibregl-ctrl-attrib.maplibregl-compact")
      ?.classList.remove("maplibregl-compact-show");
    tutupAtribusi();
    setTimeout(tutupAtribusi, 300);
    map.once("idle", tutupAtribusi);

    // Pengaman: bila kamera sempat rusak (NaN), kembalikan ke Indonesia
    map.on("moveend", () => {
      const c = map.getCenter();
      if (!isFinite(c.lng) || !isFinite(c.lat) || !isFinite(map.getZoom())) {
        map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        map.jumpTo({ center: [118, -2], zoom: 4 });
      }
    });

    wireMap();
    state.mapReady = true;
    if (state.data.gempa) applyToMap();
    applyMode(false);
    terapkanAngin();
    terapkanUdara();
    // Intro: terbang dari jauh ke Indonesia
    // tautan ?gempa= / mode kartu: kamera diatur oleh bukaGempaTautan, jangan ditimpa animasi pembuka
    if (!KARTU && !/[?&]gempa=/.test(location.search)) setTimeout(() => map.fitBounds(INDONESIA, { padding: viewPadding(), duration: REDUCED ? 0 : 2600,
      curve: 1.6, essential: true }), REDUCED ? 0 : 250);
  });

  // ---------- data ----------
  async function loadLive() {
    try {
      const kosong = { type: "FeatureCollection", features: [] };
      const [meta, gempa, titik_panas, laporan, berita, peringatan, banjir_bnpb, bGempa, bBanjir, bApi,
        gunung_api, banjir_area, bGunung, angin, udara, ispu] = await Promise.all([
        getJSON("live/meta.json"), getJSON("live/gempa.geojson"),
        getJSON("live/titik_panas.geojson"), getJSON("live/laporan.geojson"),
        getJSON("live/berita_laporan.json").catch(() => ({})),
        getJSON("live/peringatan.geojson").catch(() => kosong),
        getJSON("live/banjir_bnpb.geojson").catch(() => kosong),
        getJSON("live/berita_gempa.json").catch(() => ({})),
        getJSON("live/berita_banjir.json").catch(() => ({})),
        getJSON("live/berita_api.json").catch(() => ({})),
        getJSON("live/gunung_api.geojson").catch(() => kosong),
        getJSON("live/banjir_area.geojson").catch(() => kosong),
        getJSON("live/berita_gunung.json").catch(() => ({})),
        getJSON("live/angin.json").catch(() => null),
        getJSON("live/udara.json").catch(() => null),
        getJSON("live/ispu.geojson").catch(() => kosong),
      ]);
      for (const f of gempa.features) f.properties.lokasi = rapiLokasi(f.properties.lokasi);
      gabungGempaRT(gempa);   // file statis bisa lebih lama dari data BMKG langsung: jangan sampai gempa baru hilang
      state.beritaGempa = bGempa;
      state.beritaBanjir = bBanjir;
      state.beritaApi = bApi;
      state.beritaGunung = bGunung;
      state.anginData = angin;
      state.udaraData = udara;
      state.data.ispu = ispu;
      // + gunung pendakian populer yang tidak dipantau PVMBG (file statis, level 0)
      const daki = await getJSON("gunung_pendakian.geojson").catch(() => kosong);
      gunung_api.features = gunung_api.features.filter((f) => f.properties.level !== 0).concat(daki.features);
      state.data.gunung_api = gunung_api;
      state.data.banjir_area = banjir_area;      // peringatan BMKG cepat kedaluwarsa (1–3 jam): buang yang sudah lewat
      peringatan.features = peringatan.features.filter((f) => new Date(f.properties.berakhir) > Date.now());
      state.data.peringatan = peringatan;
      state.data.banjir_bnpb = banjir_bnpb;
      // "banjir" = jumlah area waspada (dipakai dock & judul panel)
      state.data.banjir = peringatan;
      const now = Date.now();
      for (const fc of [gempa, titik_panas, laporan]) {
        for (const f of fc.features) f.properties.jam_lalu = (now - new Date(f.properties.waktu)) / HOUR;
      }
      for (const f of laporan.features) f.properties.n_berita = (berita[f.properties.id]?.berita || []).length;
      Object.assign(state.data, { gempa, titik_panas, laporan });
      state.berita = berita;
      state.meta = meta;
      renderBrand();
      renderDock();
      renderTicker();
      if (state.mode) { renderPanel(); applyListVisibility(); }
      updateCtrl();
      if (state.mapReady) { applyToMap(); terapkanAngin(); terapkanUdara(); }
      state.firstLoad = false;
    } catch (e) {
      console.error(e);
      $("#updated").textContent = "Gagal memuat data. Coba muat ulang halaman.";
    }
  }

  // ---------- gempa realtime: langsung dari BMKG (mengizinkan akses dari browser, diperbarui tiap 60 detik) ----------
  const BMKG_TEWS = "https://data.bmkg.go.id/DataMKG/TEWS/";
  const GEMPA_RT_MS = 60 * 1000;
  const kunciGempa = (waktu, [lng, lat]) => `${waktu.slice(0, 16)}|${lat.toFixed(2)}|${lng.toFixed(2)}`;
  const angkaBMKG = (t) => { const m = String(t ?? "").match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(",", ".")) : null; };
  async function ambilBMKG(nama) {
    const r = await fetch(`${BMKG_TEWS}${nama}?t=${Math.floor(Date.now() / 60000)}`, { cache: "no-store" });
    if (!r.ok) throw new Error(`${nama}: ${r.status}`);
    const g = (await r.json()).Infogempa.gempa;
    return Array.isArray(g) ? g : [g];
  }
  // Poligon kabupaten/kota untuk mengisi wilayah gempa baru (sama seperti skrip Python)
  async function petaWilayah() {
    if (!state.wilayahPoly) {
      const geo = await fetch(`${DATA}wilayah.geojson`).then((r) => r.json());
      state.wilayahPoly = geo.features.map((f) => {
        const polys = f.geometry.type === "Polygon" ? [f.geometry.coordinates] : f.geometry.coordinates;
        let b = [180, 90, -180, -90];
        for (const poly of polys) for (const [x, y] of poly[0]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
        return { b, polys, p: f.properties };
      });
    }
    return state.wilayahPoly;
  }
  function diDalamCincin(x, y, ring) {
    let dalam = false;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) dalam = !dalam;
    }
    return dalam;
  }
  function wilayahTitik(daftar, lng, lat) {
    for (const w of daftar) {
      if (lng < w.b[0] || lng > w.b[2] || lat < w.b[1] || lat > w.b[3]) continue;
      for (const poly of w.polys) {
        if (diDalamCincin(lng, lat, poly[0]) && !poly.slice(1).some((h) => diDalamCincin(lng, lat, h))) {
          return { wilayah_id: w.p.id, kabupaten: w.p.nama, provinsi: w.p.provinsi };
        }
      }
    }
    return { wilayah_id: null, kabupaten: null, provinsi: null };
  }
  // Ambil 3 daftar BMKG (M5+ terbaru, dirasakan, terkini) → fitur dengan bentuk sama seperti gempa.geojson
  async function ambilGempaBMKG() {
    const [terkini, dirasakan, auto] = await Promise.all(
      ["gempaterkini.json", "gempadirasakan.json", "autogempa.json"].map((n) => ambilBMKG(n).catch(() => [])));
    const peta = new Map();
    for (const q of [...terkini, ...dirasakan, ...auto]) {
      if (!q || !q.Coordinates || !q.DateTime) continue;
      const [lat, lng] = q.Coordinates.split(",").map(Number);
      if (!isFinite(lat) || !isFinite(lng)) continue;
      const waktu = new Date(q.DateTime).toISOString().replace(/\.\d{3}Z$/, "Z");
      const k = kunciGempa(waktu, [lng, lat]);
      const ada = peta.get(k);
      if (ada) { if (q.Dirasakan && q.Dirasakan !== "-") ada.properties.dirasakan = q.Dirasakan; continue; }
      const mag = angkaBMKG(q.Magnitude);
      peta.set(k, { type: "Feature", geometry: { type: "Point", coordinates: [lng, lat] }, properties: {
        waktu, magnitudo: mag, kedalaman_km: angkaBMKG(q.Kedalaman), lokasi: rapiLokasi(q.Wilayah),
        potensi: q.Potensi || null, dirasakan: q.Dirasakan || null,
        shakemap: q.Shakemap ? BMKG_TEWS + q.Shakemap : null, sumber: "BMKG", id: `${waktu}|${mag}`,
      } });
    }
    // wilayah hanya dihitung untuk gempa yang belum ada di data kita (file wilayah ±1 MB dimuat seperlunya)
    const ada = new Set((state.data.gempa?.features || []).map((f) => kunciGempa(f.properties.waktu, f.geometry.coordinates)));
    const baru = [...peta].filter(([k]) => !ada.has(k)).map(([, f]) => f);
    if (baru.length) {
      const wil = await petaWilayah();
      for (const f of baru) Object.assign(f.properties, wilayahTitik(wil, ...f.geometry.coordinates));
    }
    return [...peta.values()];
  }
  // Gabungkan gempa BMKG langsung ke koleksi (tambah yang belum ada; perbarui info "dirasakan")
  function gabungGempaRT(fc) {
    const rt = state.gempaRT || [];
    if (!rt.length) return false;
    const batas = new Date(Date.now() - 7 * 24 * HOUR).toISOString();
    const idx = new Map(fc.features.map((f) => [kunciGempa(f.properties.waktu, f.geometry.coordinates), f]));
    let berubah = false;
    for (const f of rt) {
      if (f.properties.waktu < batas) continue;
      const ada = idx.get(kunciGempa(f.properties.waktu, f.geometry.coordinates));
      if (!ada) {
        const baru = { ...f, properties: { ...f.properties, jam_lalu: (Date.now() - new Date(f.properties.waktu)) / HOUR } };
        fc.features.push(baru); idx.set(kunciGempa(f.properties.waktu, f.geometry.coordinates), baru); berubah = true;
      } else if (f.properties.dirasakan && f.properties.dirasakan !== "-" && ada.properties.dirasakan !== f.properties.dirasakan) {
        ada.properties.dirasakan = f.properties.dirasakan; berubah = true;
      }
    }
    if (berubah) fc.features.sort((a, b) => b.properties.waktu.localeCompare(a.properties.waktu));
    return berubah;
  }
  async function cekGempaRealtime() {
    if (document.hidden || !state.data.gempa || state.cekGempa) return;
    state.cekGempa = true;
    try {
      const [auto] = await ambilBMKG("autogempa.json");   // file kecil: hanya gempa terakhir
      const kunci = auto ? `${auto.DateTime}|${auto.Coordinates}|${auto.Dirasakan || ""}` : null;
      if (!kunci || kunci === state.kunciAuto) return;
      const pertama = !state.kunciAuto;
      state.kunciAuto = kunci;
      state.gempaRT = await ambilGempaBMKG();
      if (!gabungGempaRT(state.data.gempa)) return;
      if (!pertama) lacak("Gempa baru realtime");
      renderDock();
      const awal = state.firstLoad;
      if (pertama) state.firstLoad = true;   // cek pertama hanya menyusulkan data: jangan beri label "BARU"
      renderTicker();
      state.firstLoad = awal;
      if (state.mode === "gempa") { renderPanel(); applyListVisibility(); }
      if (state.mapReady) { map.getSource("gempa").setData(state.data.gempa); renderPulses(); }
    } catch (e) {
      console.warn("Gempa realtime BMKG gagal dicek:", e);
    } finally {
      state.cekGempa = false;
    }
  }

  function applyToMap() {
    for (const k of ["gempa", "titik_panas", "laporan", "peringatan", "gunung_api", "banjir_area"]) map.getSource(k).setData(state.data[k]);
    const ids = [...new Set(state.data.banjir_bnpb.features.map((f) => f.properties.wilayah_id).filter(Boolean))];
    for (const l of ["bnpb-fill", "bnpb-line"]) map.setFilter(l, ["in", ["get", "id"], ["literal", ids]]);
    renderPulses();
  }

  // ---------- brand & dock ----------
  function renderBrand() {
    const m = state.meta;
    const bad = Object.entries(m.lapisan).filter(([, v]) => !v.ok).map(([k]) => k.replace("_", " "));
    $("#updated").innerHTML = `Diperbarui <b>${esc(ago(m.diperbarui))}</b> · ${esc(fmtWIB(m.diperbarui))}` +
      (bad.length ? `<br><span class="warn">Sumber bermasalah: ${esc(bad.join(", "))}</span>` : "");
  }
  function renderDock() {
    for (const k of Object.keys(MODES)) { const el = $(`#n-${k}`); if (el) countUp(el, hitung(k)); }
  }

  // ---------- ticker live ----------
  function newestQuake() {
    return [...state.data.gempa.features].sort((a, b) => b.properties.waktu.localeCompare(a.properties.waktu))[0];
  }
  function buildTickerItems() {
    const items = [];
    const g = newestQuake();
    if (g) {
      const p = g.properties;
      items.push({ c: "#ff4d4f", badge: `M${p.magnitudo}`, kicker: "Gempa terbaru · BMKG", isNew: state.newQuake,
        main: `${p.lokasi || where(p)}`, sub: ago(p.waktu), go: () => { setMode("gempa"); setTimeout(() => focusFeature("gempa", g), 80); } });
    }
    const big = state.data.gempa.features
      .filter((f) => f.properties.jam_lalu <= 24 && (f.properties.magnitudo || 0) >= 5)
      .sort((a, b) => b.properties.magnitudo - a.properties.magnitudo)[0];
    if (big && big !== g) {
      const p = big.properties;
      items.push({ c: "#e11d48", badge: `M${p.magnitudo}`, kicker: "Gempa terbesar 24 jam",
        main: `${p.lokasi || where(p)}`, sub: p.potensi || ago(p.waktu), go: () => { setMode("gempa"); setTimeout(() => focusFeature("gempa", big), 80); } });
    }
    const hot = state.data.titik_panas.features;
    if (hot.length) {
      const by = {};
      for (const f of hot) { const k = f.properties.kabupaten; if (k) by[k] = (by[k] || 0) + 1; }
      const [topKab, topN] = Object.entries(by).sort((a, b) => b[1] - a[1])[0] || [];
      const topId = hot.find((f) => f.properties.kabupaten === topKab)?.properties.wilayah_id;
      items.push({ c: "#ff6a1a", badge: icon("api"), kicker: "Titik panas 24 jam",
        main: `${num(hot.length)} titik panas`, sub: topKab ? `terbanyak ${topKab} (${num(topN)})` : "",
        go: () => { setMode("titik_panas"); if (topId) setTimeout(() => focusRegion(topId), 80); } });
    }
    const wasp = state.data.peringatan.features;
    if (wasp.length) {
      const prov = [...new Set(wasp.map((f) => f.properties.provinsi).filter(Boolean))];
      items.push({ c: WARNA_WASPADA, badge: icon("banjir"), kicker: "Waspada banjir · peringatan BMKG",
        main: `Hujan lebat di ${num(prov.length)} provinsi`, sub: prov.slice(0, 3).join(", ") + (prov.length > 3 ? ", …" : ""),
        go: () => setMode("banjir") });
    }
    const gTinggi = (state.data.gunung_api?.features || []).filter((f) => f.properties.level >= 3);
    if (gTinggi.length) {
      const lv = Math.max(...gTinggi.map((f) => f.properties.level)), L = LEVEL_GUNUNG[lv];
      const atas = gTinggi.filter((f) => f.properties.level === lv);
      items.push({ c: L.warna, badge: icon("gunung"), kicker: "Gunung api · MAGMA Indonesia",
        main: `${num(atas.length)} gunung berstatus ${L.nama} (Level ${L.rom})`,
        sub: atas.map((f) => f.properties.nama).slice(0, 3).join(", ") + (atas.length > 3 ? ", …" : ""),
        go: () => { setMode("gunung_api"); if (atas.length === 1) setTimeout(() => focusVolcano(atas[0]), 80); } });
    }
    const lap = state.data.laporan.features[0];
    if (lap) {
      const p = lap.properties;
      items.push({ c: jWarna(p.jenis), badge: jIcon(p.jenis), kicker: `Laporan warga · ${p.jenis}`,
        main: `${p.kabupaten || "Lokasi"}${p.provinsi ? ", " + p.provinsi : ""}`,
        sub: `${ago(p.waktu)}${p.n_berita ? ` · ${p.n_berita} berita` : ""}`,
        go: () => { setMode(LAPORAN_KE[p.jenis] || null); setTimeout(() => focusFeature("laporan", lap), 80); } });
    }
    return items;
  }
  function renderTicker() {
    const g = newestQuake();
    const key = g ? `${g.properties.waktu}|${g.geometry.coordinates}` : null;
    state.newQuake = !state.firstLoad && key && key !== state.lastQuake;
    state.lastQuake = key;
    state.tick.items = buildTickerItems();
    const tk = $("#ticker");
    tk.hidden = !state.tick.items.length;
    updateTopUI();
    if (state.newQuake || state.firstLoad) state.tick.i = 0; // gempa baru langsung ditampilkan
    showTick(state.tick.i % Math.max(state.tick.items.length, 1), true);
  }
  function showTick(i, instant) {
    const items = state.tick.items;
    if (!items.length) return;
    state.tick.i = i;
    const it = items[i], body = $("#tk-body");
    const old = body.querySelector(".tk-item:not(.out)");
    if (old && !instant) { old.classList.add("out"); setTimeout(() => old.remove(), 420); } else if (old) old.remove();
    const el = document.createElement("div");
    el.className = "tk-item";
    el.style.setProperty("--c", it.c);
    el.innerHTML = `<span class="tk-badge" style="--c:${it.c}">${it.badge.startsWith("<svg") ? it.badge : esc(it.badge)}</span>
      <span class="tk-text"><div class="tk-kicker" style="--c:${it.c}">${esc(it.kicker)}${it.isNew ? '<span class="new">BARU</span>' : ""}</div>
      <div class="tk-main">${esc(it.main)} <span>· ${esc(it.sub)}</span></div></span>`;
    body.appendChild(el);
    $("#tk-dots").innerHTML = items.map((_, k) => `<i class="${k === i ? "on" : ""}"></i>`).join("");
    const bar = $("#tk-bar");
    bar.style.setProperty("--c", it.c);
    bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run");
    bar.style.setProperty("--dur", `${TICK_MS}ms`);
    // Pergantian diatur timer, bukan akhir animasi garis progres: pengguna yang mematikan animasi di perangkatnya
    // (prefers-reduced-motion) membuat animasi "selesai" seketika → dulu ticker berganti tiap frame.
    clearTimeout(state.tick.t);
    state.tick.t = setTimeout(lanjutTick, TICK_MS);
  }
  function lanjutTick() {
    if (state.tick.jeda || state.tick.items.length < 2) {   // kursor di atas ticker / hanya satu kabar: tunggu lagi
      const bar = $("#tk-bar");
      bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run");
      clearTimeout(state.tick.t);
      state.tick.t = setTimeout(lanjutTick, TICK_MS);
      return;
    }
    showTick((state.tick.i + 1) % state.tick.items.length);
  }
  function wireTicker() {
    const tk = $("#ticker");
    tk.addEventListener("mouseenter", () => { state.tick.jeda = true; });
    tk.addEventListener("mouseleave", () => { state.tick.jeda = false; });
    const go = () => state.tick.items[state.tick.i]?.go();
    tk.addEventListener("click", go);
    tk.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
  }

  function renderPulses() {
    state.pulseMarkers.forEach((m) => m.remove());
    state.pulseMarkers = state.data.gempa.features
      .filter((f) => f.properties.jam_lalu <= 24 && (f.properties.magnitudo || 0) >= 5)
      .map((f) => {
        const el = document.createElement("div");
        el.className = "pulse";
        return new maplibregl.Marker({ element: el }).setLngLat(f.geometry.coordinates).addTo(map);
      });
    const show = !state.sembunyi && (!state.mode || state.mode === "gempa");
    state.pulseMarkers.forEach((m) => { m.getElement().style.display = show ? "" : "none"; });
  }

  // ---------- mode / lapisan khusus ----------
  function setSembunyi(on) {
    state.sembunyi = on;
    const b = $("#sembunyi-btn");
    if (b) {
      b.setAttribute("aria-pressed", String(on));
      b.innerHTML = icon(on ? "lapisanMati" : "lapisan");
      b.title = on ? "Tampilkan lagi semua titik kejadian" : "Sembunyikan semua titik kejadian (gempa, titik panas, banjir, gunung, laporan)";
    }
    document.body.classList.toggle("lapisan-sembunyi", on);
    applyMode(false);
  }
  function setMode(mode) {
    if (state.sembunyi && mode) { state.sembunyi = false; setSembunyi(false); }   // memilih lapisan = tampilkan lagi
    state.mode = MODES[mode] ? mode : null;
    state.jenis = "semua";
    const want = state.mode ? `#${state.mode}` : " ";
    if ((location.hash || " ") !== want) history.pushState(null, "", state.mode ? want : location.pathname + location.search);
    applyMode(true);
  }

  // Daftar di kiri bisa disembunyikan (pilihan berlaku untuk semua lapisan selama sesi)
  function applyListVisibility() {
    const mode = state.mode, hide = !!state.listHidden;
    document.body.classList.toggle("mode-on", !!mode && !hide);
    $("#panel").hidden = !mode || hide;
    const btn = $("#show-list");
    btn.hidden = !mode || !hide;
    if (mode) {
      btn.style.setProperty("--c", MODES[mode].c);
      const n = state.data.gempa ? ` <b>${num(hitung(mode))}</b>` : "";
      $("#show-list-txt").innerHTML = `Daftar ${esc(MODES[mode].title.toLowerCase())}${n}`;
    }
  }
  function setListHidden(hide) {
    state.listHidden = hide;
    applyListVisibility();
    if (!hide && state.mode) renderPanel();
    updateCtrl();
  }

  function applyMode(fly) {
    const mode = state.mode;
    applyListVisibility();
    $("#panel").classList.remove("open");
    document.querySelectorAll(".dock-btn").forEach((b) => {
      const aktif = b.dataset.mode === mode;
      if (aktif && b.getAttribute("aria-pressed") !== "true") {   // animasi pantul saat baru dipilih
        b.classList.remove("just"); void b.offsetWidth; b.classList.add("just");
        setTimeout(() => b.classList.remove("just"), 650);
      }
      b.setAttribute("aria-pressed", String(aktif));
    });
    geserSorotan();
    if (mode) renderPanel();
    updateCtrl();
    if (!state.mapReady) return;
    for (const [k, cfg] of Object.entries(MODES)) {
      const on = !mode || mode === k;
      cfg.layers.forEach((id) => map.setLayoutProperty(id, "visibility", on ? "visible" : "none"));
      (cfg.only || []).forEach((id) => map.setLayoutProperty(id, "visibility", mode === k ? "visible" : "none"));
    }
    // titik laporan warga: semua jenis di beranda; di tiap lapisan hanya jenis yang sesuai
    // (laporan banjir di lapisan Banjir sudah punya gaya sendiri: banjir-lapor)
    const jl = mode ? jenisLaporanDi(mode).filter((j) => !(mode === "banjir" && j === "banjir")) : null;
    map.setFilter("laporan", jl ? ["in", ["get", "jenis"], ["literal", jl]] : null);
    map.setLayoutProperty("laporan", "visibility", !jl || jl.length ? "visible" : "none");
    // tombol "sembunyikan semua lapisan": peta bersih, hanya peta dasar + angin/kualitas udara
    if (state.sembunyi) {
      for (const cfg of Object.values(MODES)) [...cfg.layers, ...(cfg.only || [])].forEach((id) => map.setLayoutProperty(id, "visibility", "none"));
      map.setLayoutProperty("laporan", "visibility", "none");
    }
    clearRings();
    if (state.popup) state.popup.remove();
    if (state.data.gempa) renderPulses();
    if (fly) setTimeout(() => map.fitBounds(INDONESIA, { padding: viewPadding(), duration: REDUCED ? 0 : 900 }), 30);
  }

  window.addEventListener("popstate", () => {
    state.mode = MODES[location.hash.slice(1)] ? location.hash.slice(1) : null;
    state.jenis = "semua";
    applyMode(true);
  });

  function renderPanel() {
    const mode = state.mode, cfg = MODES[mode];
    const panel = $("#panel");
    panel.style.animation = "none"; void panel.offsetWidth; panel.style.animation = ""; // ulangi animasi masuk
    $("#p-title").textContent = cfg.title;
    const ic = $("#p-ic");
    ic.style.setProperty("--c", cfg.c);
    ic.innerHTML = icon(cfg.ic);
    $("#p-sub").textContent = cfg.sub;
    if (!state.data.gempa) return;
    $("#p-count").textContent = num(hitung(mode));
    const legend = legendHTML(mode);
    $("#legend").innerHTML = legend;
    $("#legend").hidden = !legend;
    renderChips();
    renderList();
  }

  function legendHTML(mode) {
    if (mode === "titik_panas") {
      return `<div class="row"><span>Daya api kecil</span><span class="ramp"></span><span>besar</span></div>
        <div class="note">Warna = daya radiasi api (FRP). Titik pudar = keyakinan rendah. Bulatan bergaris putih = laporan warga.</div>`;
    }
    if (mode === "banjir") return "";   // keterangan warna = tombol tab di atas daftar
    if (mode === "gunung_api") {
      return `<div class="row">${[4, 3, 2, 1].map((lv) => `<span class="key tri">${segitiga(LEVEL_GUNUNG[lv].warna)}${LEVEL_GUNUNG[lv].nama}</span>`).join("")}</div>
        <div class="note">Level I Normal sampai IV Awas. Ikuti rekomendasi dan jarak aman dari PVMBG.</div>`;
    }
    return ""; // gempa: cukup daftar
  }

  // Lapisan Banjir: keterangan Waspada/Terjadi/Resmi sekaligus tombol tab daftar (warnanya = warna di peta)
  function tabBanjir() {
    const d = state.data;
    const n = { waspada: d.peringatan.features.length,
      terjadi: d.laporan.features.filter((f) => ["banjir", "angin kencang"].includes(f.properties.jenis)).length + (d.banjir_area?.features.length || 0),
      resmi: d.banjir_bnpb.features.length };
    if (!state.banjirTab) state.banjirTab = n.waspada ? "waspada" : n.terjadi ? "terjadi" : "resmi";
    return state.banjirTab;
  }
  function renderChips() {
    const box = $("#chips");
    box.classList.toggle("tab3", state.mode === "banjir");
    if (state.mode !== "banjir" || !state.data.gempa) { box.hidden = true; return; }
    const d = state.data, tab = tabBanjir();
    const daftar = [
      ["waspada", "Waspada (BMKG)", WARNA_WASPADA, d.peringatan.features.length],
      ["terjadi", "Terjadi (warga)", "#3ea6ff", d.laporan.features.filter((f) => ["banjir", "angin kencang"].includes(f.properties.jenis)).length + (d.banjir_area?.features.length || 0)],
      ["resmi", "Resmi (BNPB)", WARNA_BNPB, d.banjir_bnpb.features.length],
    ];
    box.hidden = false;
    box.innerHTML = daftar.map(([id, label, c, n]) =>
      `<button class="chip" data-bt="${id}" style="--c:${c}" aria-pressed="${tab === id}"><i></i>${esc(label)} <b>${num(n)}</b></button>`).join("");
    box.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      state.banjirTab = b.dataset.bt;
      lacak("Tab banjir", { tab: b.dataset.bt });
      renderChips(); renderList();
    }));
  }

  // Bagian "Laporan warga" di daftar tiap lapisan (baris ditambahkan ke `rows` dengan kind "lapor")
  function seksiLaporan(jenis, judul, rows, mulai) {
    const fs = state.data.laporan.features.filter((f) => jenis.includes(f.properties.jenis));
    if (!fs.length) return "";
    let i = mulai;
    return `<div class="sec-title" style="--c:${jWarna(jenis[0])};margin-top:12px"><i></i>${esc(judul)}<span>${num(fs.length)}</span></div>` +
      fs.map((f) => {
        const p = f.properties, c = jWarna(p.jenis); rows.push({ kind: "lapor", f });
        return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${c}26;color:${c}">${jIcon(p.jenis)}</span>
          <span class="item-main"><div class="item-title">${jenis.length > 1 ? `<span class="tag">${esc(p.jenis)}</span> ` : ""}${esc(where(p) || "Lokasi")}</div>
          <div class="item-sub">${esc(ago(p.waktu))}${p.teks ? ` · <span class="asli">${esc(p.teks.slice(0, 90)) + (p.teks.length > 90 ? "…" : "")}</span>` : ""}</div>
          ${p.n_berita ? `<span class="item-news">${icon("berita")} ${p.n_berita} berita</span>` : ""}</span></button>`;
      }).join("");
  }
  function renderList() {
    const list = $("#list"), t = state.mode;
    let rows = [], html = "";
    if (t === "gempa") {
      rows = state.data.gempa.features;
      html = rows.map((f, i) => {
        const p = f.properties, m = p.magnitudo ?? "?";
        const cls = m >= 5 ? "m-tinggi" : m >= 4 ? "m-sedang" : "";
        return `<button class="item" data-i="${i}" style="--i:${i}"><span class="badge ${cls}">${esc(m)}</span>
          <span class="item-main"><div class="item-title">${esc(p.lokasi || where(p) || "Lokasi tidak diketahui")}</div>
          <div class="item-sub">${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))} · kedalaman ${esc(p.kedalaman_km ?? "?")} km</div>
          ${beritaGempa(p).length ? `<span class="item-news">${icon("berita")} ${beritaGempa(p).length} berita</span>` : ""}</span></button>`;
      }).join("");
      rows = [...rows];
      html += seksiLaporan(["gempa"], "Laporan warga · 7 hari", rows, rows.length);
    } else if (t === "titik_panas") {
      const by = new Map();
      for (const f of state.data.titik_panas.features) {
        const p = f.properties, k = p.wilayah_id;
        if (!by.has(k)) by.set(k, { n: 0, tinggi: 0, p });
        const o = by.get(k); o.n++; if (p.keyakinan === "tinggi") o.tinggi++;
      }
      rows = [...by.values()].sort((a, b) => b.n - a.n).slice(0, 30);
      const max = rows[0]?.n || 1, nKab = rows.length;
      html = rows.length ? `<div class="item-sub" style="padding:4px 10px 6px">Kabupaten/kota dengan titik panas terbanyak (24 jam)</div>` +
        rows.map((r, i) => `<button class="item" data-i="${i}" style="--i:${i}"><span class="badge">${num(r.n)}</span>
          <span class="item-main"><div class="item-title">${esc(r.p.kabupaten)}</div>
          <div class="item-sub">${esc(r.p.provinsi)} · ${num(r.tinggi)} keyakinan tinggi</div>
          <div class="bar"><i style="width:${(100 * r.n / max).toFixed(1)}%"></i></div>
          ${beritaApi(r.p.wilayah_id).length ? `<span class="item-news">${icon("berita")} ${beritaApi(r.p.wilayah_id).length} berita karhutla</span>` : ""}</span></button>`).join("") : "";
      html += seksiLaporan(["kebakaran", "kabut asap"], "Laporan warga · kebakaran & asap 7 hari", rows, nKab);
    } else if (t === "banjir") {
      // Tab: Waspada (BMKG) · Terjadi (laporan warga + area tergenang) · Resmi (BNPB) — hanya tab terpilih yang tampil
      const tab = tabBanjir();
      const waspada = state.data.peringatan.features;
      const terjadi = state.data.laporan.features.filter((f) => f.properties.jenis === "banjir");
      const resmi = state.data.banjir_bnpb.features;
      const area = state.data.banjir_area?.features || [];
      let i = 0;
      const sec = (title, c, n) => `<div class="sec-title" style="--c:${c}"><i></i>${title}<span>${num(n)}</span></div>`;
      if (tab === "waspada") {
        html += waspada.length ? waspada.map((f) => {
          const p = f.properties; rows.push({ kind: "waspada", f });
          const kab = (p.kabupaten_list || []).slice(0, 3).join(", ") + ((p.kabupaten_list || []).length > 3 ? ` +${p.kabupaten_list.length - 3}` : "");
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${WARNA_WASPADA}26;color:${WARNA_WASPADA}">${icon("banjir")}</span>
            <span class="item-main"><div class="item-title">${esc(p.provinsi || "Peringatan")}</div>
            <div class="item-sub">${esc(kab || "")}${kab ? " · " : ""}hingga ${esc(jamWIB(p.berakhir))} (${esc(sisa(p.berakhir))})</div></span></button>`;
        }).join("") : `<div class="sec-note">Tidak ada peringatan hujan lebat aktif saat ini.</div>`;
      } else if (tab === "terjadi") {
        html += sec("Banjir terjadi · laporan warga 7 hari", "#3ea6ff", terjadi.length);
        html += terjadi.length ? terjadi.map((f) => {
          const p = f.properties; rows.push({ kind: "terjadi", f });
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:#3ea6ff26;color:#3ea6ff">${icon("banjir")}</span>
            <span class="item-main"><div class="item-title">${esc(where(p) || "Lokasi")}</div>
            <div class="item-sub">${esc(ago(p.waktu))}${p.teks ? ` · <span class="asli">${esc(p.teks.slice(0, 90)) + (p.teks.length > 90 ? "…" : "")}</span>` : ""}</div>
            ${p.n_berita ? `<span class="item-news">${icon("berita")} ${p.n_berita} berita</span>` : ""}</span></button>`;
        }).join("") : `<div class="sec-note">Belum ada laporan banjir dari warga.</div>`;
        { const sA = seksiLaporan(["angin kencang"], "Angin kencang · laporan warga 7 hari", rows, i); i = rows.length; html += sA; }
        if (area.length) {
          html += sec("Area tergenang · PetaBencana 48 jam", "#3b82f6", area.length);
          html += area.map((f) => {
            const p = f.properties; rows.push({ kind: "area", f });
            return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:#3b82f626;color:#60a5fa">${icon("banjir")}</span>
              <span class="item-main"><div class="item-title">${esc(p.nama)}</div>
              <div class="item-sub">${esc(p.kota || "")}${p.kota ? " · " : ""}tinggi air ${esc(p.tinggi)} · ${esc(ago(p.waktu))}</div></span></button>`;
          }).join("");
        }
      } else {
        html += resmi.length ? resmi.map((f) => {
          const p = f.properties; rows.push({ kind: "resmi", f });
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${WARNA_BNPB}22;color:${WARNA_BNPB};font-size:11px">BNPB</span>
            <span class="item-main"><div class="item-title">${esc(p.kabupaten || p.kabupaten_bnpb)}</div>
            <div class="item-sub">${esc(tglID(p.tanggal))} · ${esc(p.kategori)}${p.rumah_terendam ? ` · ${num(p.rumah_terendam)} rumah terendam` : ""}${p.mengungsi ? ` · ${num(p.mengungsi)} mengungsi` : ""}</div></span></button>`;
        }).join("") + `<div class="sec-note">Data resmi diperbarui mingguan, bisa tertinggal beberapa hari.</div>`
          : `<div class="sec-note">Belum ada kejadian banjir tercatat BNPB minggu ini.</div>`;
      }
    } else if (t === "gunung_api") {
      const semua = state.data.gunung_api?.features || [];
      let i = 0;
      for (const lv of [4, 3, 2]) {
        const g = semua.filter((f) => f.properties.level === lv);
        if (!g.length) continue;
        const L = LEVEL_GUNUNG[lv];
        html += `<div class="sec-title" style="--c:${L.warna}"><i></i>Level ${L.rom} · ${L.nama}<span>${num(g.length)}</span></div>`;
        html += g.map((f) => {
          const p = f.properties, nb = beritaGunung(p).length; rows.push(f);
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${L.warna}22">${segitiga(L.warna)}</span>
            <span class="item-main"><div class="item-title">${esc(p.nama)}</div>
            <div class="item-sub">${esc(p.lokasi || where(p))}${p.periode ? ` · laporan ${esc(p.periode.split(" · ")[0])}` : ""}</div>
            ${p.erupsi ? `<span class="item-flag">Erupsi tercatat</span>` : ""}
            ${nb ? `<span class="item-news">${icon("berita")} ${nb} berita</span>` : ""}</span></button>`;
        }).join("");
      }
      { const sG = seksiLaporan(["gunung api"], "Laporan warga · 7 hari", rows, i); i = rows.length; html += sG; }
      const normal = semua.filter((f) => f.properties.level === 1).length;
      html += normal ? `<div class="sec-note" style="margin-top:10px">${num(normal)} gunung lain berstatus Normal (segitiga hijau di peta).</div>` : "";
      const daki = semua.filter((f) => f.properties.level === 0).sort((a, b) => a.properties.nama.localeCompare(b.properties.nama));
      if (daki.length) {
        const L = LEVEL_GUNUNG[0];
        html += `<div class="sec-title" style="--c:${L.warna};margin-top:14px"><i></i>Gunung pendakian · tidak dipantau PVMBG<span>${num(daki.length)}</span></div>`;
        html += daki.map((f) => {
          const p = f.properties; rows.push(f);
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${L.warna}22">${segitiga(L.warna)}</span>
            <span class="item-main"><div class="item-title">${esc(p.nama)}</div>
            <div class="item-sub">${esc(p.lokasi || where(p))}${p.elevasi ? ` · ${num(p.elevasi)} mdpl` : ""}</div></span></button>`;
        }).join("");
      }
    }
    list.innerHTML = html || `<div class="empty">Belum ada data untuk saat ini.</div>`;
    list.scrollTop = 0;
    list.querySelectorAll(".item").forEach((el) => el.addEventListener("click", () => {
      const r = rows[+el.dataset.i];
      if (r?.kind === "lapor") return focusFeature("laporan", r.f);
      if (t === "titik_panas") focusRegion(r.p.wilayah_id);
      else if (t === "banjir") {
        if (r.kind === "waspada") focusWarning(r.f);
        else if (r.kind === "resmi") focusBnpb(r.f.properties.wilayah_id, r.f);
        else if (r.kind === "area") focusArea(r.f);
        else focusFeature("laporan", r.f);
      } else if (t === "gunung_api") focusVolcano(r);
      else focusFeature(t, r);
    }));
  }

  // ---------- interaksi ----------
  function wireMap() {
    let hoverId = null;
    map.on("mousemove", "wilayah-fill", (e) => {
      const id = e.features[0]?.id;
      if (hoverId !== null && hoverId !== id) map.setFeatureState({ source: "wilayah", id: hoverId }, { hover: false });
      hoverId = id;
      if (id != null) map.setFeatureState({ source: "wilayah", id }, { hover: true });
    });
    map.on("mouseleave", "wilayah-fill", () => {
      if (hoverId !== null) map.setFeatureState({ source: "wilayah", id: hoverId }, { hover: false });
      hoverId = null;
    });
    for (const id of ["gempa", "titik_panas", "laporan"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
    }
    for (const id of ["banjir-lapor", "peringatan-fill", "bnpb-fill", "gunung_api", "banjir-area-fill", "ispu"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
    }
    map.on("click", (e) => {
      const layers = ["ispu", "gunung_api", "laporan", "banjir-lapor", "gempa", "titik_panas", "banjir-area-fill", "bnpb-fill",
        "peringatan-fill", "angin", "angin-hit", "wilayah-fill"].filter((id) => map.getLayoutProperty(id, "visibility") !== "none");
      const hits = map.queryRenderedFeatures(e.point, { layers });
      // Polusi udara aktif: klik di mana saja (selain titik kejadian) = kualitas udara di titik itu
      if (state.udara && state.udaraData && (!hits.length || hits[0].layer.id === "wilayah-fill")) {
        clearRings(); return showAirPopup(e.lngLat, hits[0]?.properties);
      }
      if (!hits.length) return;
      let f = hits[0], layer = f.layer.id;
      if (layer === "gunung_api") {
        clearRings();
        const full = state.data.gunung_api.features.find((x) => x.properties.id === f.properties.id) || f;
        return showVolcano(full, { lng: full.geometry.coordinates[0], lat: full.geometry.coordinates[1] });
      }
      if (layer === "banjir-area-fill") { clearRings(); return showAreaPopup(f, e.lngLat); }
      if (layer === "ispu") { clearRings(); return showIspuPopup(f); }
      if (layer === "angin" || layer === "angin-hit") { clearRings(); return showWindPopup(f); }
      if (layer === "banjir-lapor") layer = "laporan";
      if (layer === "wilayah-fill") { clearRings(); return showRegionPopup(f.properties, e.lngLat); }
      if (layer === "bnpb-fill") { clearRings(); return showBnpbPopup(f.properties.id, e.lngLat); }
      if (layer === "peringatan-fill") {
        clearRings();
        const full = state.data.peringatan.features.find((x) => x.properties.id === f.properties.id) || f;
        return showWarningPopup(full, e.lngLat);
      }
      if (layer === "gempa") {
        const full = state.data.gempa.features.find((x) => x.properties.waktu === f.properties.waktu) || f;
        return showQuake(full, false);
      }
      clearRings();
      const full = layer === "laporan" ? state.data.laporan.features.find((x) => x.properties.id === f.properties.id) || f : f;
      showPopup(layer, full, e.lngLat);
    });
  }

  // ---------- dock: sorotan meluncur + geser (HP) ----------
  function geserSorotan() {
    const dock = $("#dock");
    let ind = dock.querySelector(".dock-ind");
    if (!ind) { ind = document.createElement("span"); ind.className = "dock-ind"; dock.prepend(ind); }
    const btn = state.mode && dock.querySelector(`.dock-btn[data-mode="${state.mode}"]`);
    if (!btn) { ind.classList.remove("on"); return; }
    ind.style.left = `${btn.offsetLeft}px`;
    ind.style.width = `${btn.offsetWidth}px`;
    ind.style.setProperty("--c", MODES[state.mode].c);
    ind.classList.add("on");
  }
  window.addEventListener("resize", geserSorotan);

  function wireDockSwipe() {
    const dock = $("#dock");
    const urutan = () => [...dock.querySelectorAll(".dock-btn")].map((b) => b.dataset.mode);
    let x0 = null, y0 = 0, dx = 0, swiped = false;
    dock.addEventListener("pointerdown", (e) => {
      if (!isMobile()) return;
      x0 = e.clientX; y0 = e.clientY; dx = 0; swiped = false;
    });
    dock.addEventListener("pointermove", (e) => {
      if (x0 == null) return;
      dx = e.clientX - x0;
      if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(e.clientY - y0)) dock.classList.add("swiping");
    });
    const end = () => {
      if (x0 == null) return;
      dock.classList.remove("swiping");
      if (Math.abs(dx) > 45) {
        const list = urutan(), i = list.indexOf(state.mode);
        // jari ke kanan = sorotan ikut ke kanan (lapisan berikutnya), ke kiri = sebelumnya
        const j = dx > 0 ? (i < 0 ? 0 : Math.min(i + 1, list.length - 1)) : (i < 0 ? list.length - 1 : Math.max(i - 1, 0));
        if (list[j] !== state.mode) setMode(list[j]);
        swiped = true;
      }
      x0 = null;
    };
    dock.addEventListener("pointerup", end);
    dock.addEventListener("pointercancel", () => { x0 = null; dock.classList.remove("swiping"); });
    // klik yang mengakhiri geseran jangan ikut memilih tombol
    dock.addEventListener("click", (e) => { if (swiped) { e.stopPropagation(); e.preventDefault(); swiped = false; } }, true);
  }

  function wireUI() {
    document.querySelectorAll(".dock-btn").forEach((b) => b.addEventListener("click", () => {
      const buka = state.mode !== b.dataset.mode;
      setMode(buka ? b.dataset.mode : null);
      if (buka) lacak("Buka lapisan", { lapisan: b.dataset.mode });
    }));
    wireDockSwipe();
    setTimeout(geserSorotan, 1300); // setelah animasi masuk dock
    $("#back").addEventListener("click", () => setMode(null));
    // Klik judul = kembali ke semua lapisan (berguna saat daftar kiri disembunyikan)
    $("#logo").addEventListener("click", () => setMode(null));
    $("#hide-list").addEventListener("click", () => setListHidden(true));
    wireSwipe();
    $("#show-list").addEventListener("click", () => setListHidden(false));
    const panel = $("#panel"), grip = $("#grip");
    grip.addEventListener("click", () => {
      const open = panel.classList.toggle("open");
      grip.setAttribute("aria-expanded", String(open));
      updateCtrl();
    });
    wireSetelan();
    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (panelTerbuka()) return bukaSetelan(false);
      if (state.mode) setMode(null);
    });
    wireTicker();
    wireCari();
  }

  function popupAt(lngLat, html, onClose, anchor) {
    if (state.popup) { const old = state.popup; state.popup = null; old.remove(); }
    // HP: lembar daftar menutupi popup -> turunkan dulu (buka lagi lewat tombol "Daftar …")
    if (isMobile() && state.mode && !state.listHidden) setListHidden(true);
    updatePopMax();
    state.popup = new maplibregl.Popup({ maxWidth: "320px", focusAfterOpen: false, ...(anchor ? { anchor } : {}) })
      .setLngLat(lngLat).setHTML(html).addTo(map);
    if (onClose) state.popup.on("close", onClose);
    const p = state.popup;
    setTimeout(() => { if (state.popup === p) fitPopup(); }, 60);
    map.once("moveend", () => { if (state.popup === p) fitPopup(); });
  }

  // Area layar yang tidak tertutup UI (ticker di atas, dock di bawah, panel di kiri)
  function safeArea() {
    const tk = $("#ticker"), dock = $("#dock"), panel = $("#panel"), brand = $("#brand");
    let top = 12;
    if (tk && !tk.hidden) top = Math.max(top, tk.getBoundingClientRect().bottom);
    let bottom = Math.min(window.innerHeight, dock.getBoundingClientRect().top);
    let left = 0;
    if (!panel.hidden) {
      const r = panel.getBoundingClientRect();
      if (isMobile()) bottom = Math.min(bottom, r.top); else left = r.right;
    }
    if (isMobile()) top = Math.max(top, brand.getBoundingClientRect().bottom);
    // tombol "Daftar …" (HP: di atas dock; desktop: kiri atas di bawah brand)
    const show = $("#show-list");
    if (show && !show.hidden) {
      const r = show.getBoundingClientRect();
      if (isMobile()) bottom = Math.min(bottom, r.top); else top = Math.max(top, r.bottom);
    }
    return { top: top + 10, bottom: bottom - 10, left: left + 10, right: window.innerWidth - 10 };
  }
  // Tinggi maksimal popup = tinggi area aman (isi lebih panjang bisa digulir)
  function updatePopMax() {
    const s = safeArea();
    document.documentElement.style.setProperty("--pop-max", `${Math.max(180, Math.min(560, s.bottom - s.top - 40))}px`);
  }
  // Geser peta sedikit bila popup keluar dari area aman
  function fitPopup() {
    const el = state.popup?.getElement();
    if (!el || KARTU) return;   // kartu: popup sudah tetap di bawah, peta jangan digeser
    // Jangan geser di tengah animasi kamera (akan saling menimpa): tunggu sampai berhenti
    if (map.isMoving()) { map.once("moveend", () => setTimeout(fitPopup, 0)); return; }
    updatePopMax();
    const r = el.getBoundingClientRect(), s = safeArea();
    let dx = 0, dy = 0;
    if (r.top < s.top) dy = r.top - s.top;
    else if (r.bottom > s.bottom) dy = Math.min(r.bottom - s.bottom, r.top - s.top);
    if (r.left < s.left) dx = r.left - s.left;
    else if (r.right > s.right) dx = Math.min(r.right - s.right, r.left - s.left);
    if (Math.abs(dx) > 2 || Math.abs(dy) > 2) map.panBy([dx, dy], { duration: REDUCED ? 0 : 350 });
  }
  // Dropdown di popup dibuka/ditutup -> tinggi popup berubah -> pastikan tetap terlihat
  document.addEventListener("toggle", (e) => {
    if (e.target.closest && e.target.closest(".maplibregl-popup")) setTimeout(fitPopup, 30);
  }, true);

  // Isi tab "Berita" untuk laporan warga
  function beritaListHTML(id) {
    const list = state.berita[id]?.berita || [];
    if (!list.length) return `<div class="nm">Belum ditemukan berita media untuk kejadian ini.</div>`;
    return list.map((b) => {
      const url = safeUrl(b.tautan);
      const tag = url ? "a" : "div";
      return `<${tag} class="news" ${url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : ""}>
        <div class="nt">${esc(b.judul)}</div>
        <div class="nm">${esc(b.media)} · ${esc(ago(b.terbit))}${b.cocok === "wilayah" ? " · <em>berita sekitar wilayah</em>" : ""}</div></${tag}>`;
    }).join("");
  }
  window.addEventListener("pop-resize", () => setTimeout(fitPopup, 30));

  // ---------- berita kejadian (tab "Berita" di popup) ----------
  const hariWIB = (offsetHari = 0) => new Date(Date.now() + 7 * HOUR - offsetHari * 24 * HOUR).toISOString().slice(0, 10);
  const beritaGempa = (p) => state.beritaGempa?.[p.id]?.berita || [];
  function beritaBmkg(prov) {
    for (const d of [0, 1]) { const v = state.beritaBanjir?.[`bmkg|${prov}|${hariWIB(d)}`]; if (v) return v.berita; }
    return [];
  }
  const beritaBnpb = (id) => state.beritaBanjir?.[`bnpb|${id}`]?.berita || [];
  function beritaApi(wid) {
    for (const d of [0, 1]) { const v = state.beritaApi?.[`${wid}|${hariWIB(d)}`]; if (v) return v.berita; }
    return [];
  }
  function newsHTML(list, kosong) {
    if (!list.length) return `<div class="nm">${esc(kosong)}</div>`;
    return list.map((b) => {
      const url = safeUrl(b.tautan), tag = url ? "a" : "div";
      return `<${tag} class="news" ${url ? `href="${esc(url)}" target="_blank" rel="noopener noreferrer"` : ""}>
        <div class="nt">${esc(b.judul)}</div><div class="nm">${esc(b.media)} · ${esc(ago(b.terbit))}</div></${tag}>`;
    }).join("");
  }
  // Tab di popup (tertutup sampai diklik; klik tab aktif = tutup lagi)
  // `buka` = id tab yang langsung terbuka (opsional). Hanya isi tab (.ppane) yang bisa digulir.
  function tabsHTML(tabs, buka) {
    tabs = tabs.filter(Boolean);
    if (!tabs.length) return "";
    return `<div class="ptabs">${tabs.map((t) => `<button class="ptab" data-t="${t.id}" aria-expanded="${t.id === buka}">${t.ic ? icon(t.ic) : ""}${esc(t.label)}${t.n != null ? ` <b>${num(t.n)}</b>` : ""}</button>`).join("")}</div>` +
      tabs.map((t) => `<div class="ppane" data-t="${t.id}"${t.id === buka ? "" : " hidden"}>${t.html}${t.src ? `<div class="src">${t.src}</div>` : ""}</div>`).join("");
  }
  document.addEventListener("click", (e) => {
    const ig = e.target.closest && e.target.closest(".ms-ig");
    if (ig) lacak("Klik Instagram", { tagar: decodeURIComponent(ig.pathname.split("/").filter(Boolean).pop() || "") });
  });
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".ptab");
    if (!btn) return;
    const pop = btn.closest(".pop");
    const open = btn.getAttribute("aria-expanded") !== "true";
    pop.querySelectorAll(".ptab").forEach((b) => b.setAttribute("aria-expanded", String(open && b === btn)));
    pop.querySelectorAll(".ppane").forEach((p) => { p.hidden = !(open && p.dataset.t === btn.dataset.t); });
    setTimeout(fitPopup, 30);
    if (open) lacak("Buka tab", { tab: btn.textContent.replace(/\d[\d.,]*/g, "").trim(), popup: (pop.querySelector("h3")?.textContent || "").trim().slice(0, 40) });
  });

  function showPopup(layer, f, lngLat, anchor) {
    const p = f.properties;
    let html = "";
    if (layer === "titik_panas") {
      html = `<div class="pop"><h3><span class="hi" style="--c:#ff6a1a">${icon("api")}</span>Titik panas</h3>
        <div class="sub">${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))}</div>
        <dl><dt>Wilayah</dt><dd>${esc(where(p) || "-")}</dd>
        <dt>Keyakinan</dt><dd>${esc(p.keyakinan)}</dd>
        <dt>Satelit</dt><dd>${esc(p.satelit)}${p.siang === true || p.siang === "true" ? " · siang" : " · malam"}</dd>
        ${p.frp != null ? `<dt>Daya api</dt><dd>${esc(p.frp)} MW (FRP)</dd>` : ""}</dl>
        <div class="src">Sumber: satelit NASA FIRMS. Titik panas = deteksi panas, belum tentu kebakaran.</div>
        ${(() => { const bl = beritaApi(p.wilayah_id); return tabsHTML([{ id: "b", ic: "berita", label: "Berita karhutla", n: bl.length,
          html: newsHTML(bl, `Belum ada berita kebakaran hutan/lahan di ${p.kabupaten || "wilayah ini"} (3 hari terakhir).`) }]); })()}</div>`;
    } else {
      const foto = safeUrl(p.foto), link = safeUrl(p.tautan);
      html = `<div class="pop"><h3><span class="hi" style="--c:${jWarna(p.jenis)}">${jIcon(p.jenis)}</span>Laporan ${esc(p.jenis)}</h3>
        <div class="sub">${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))}<br>${esc(where(p) || "")}</div>
        ${tabsHTML([{ id: "d", label: "Detail", html: `
          ${p.teks ? `<div class="asli">${esc(p.teks)}</div>` : ""}
          ${p.tinggi_air_cm ? `<dl style="margin-top:6px"><dt>Tinggi air</dt><dd>${esc(p.tinggi_air_cm)} cm</dd></dl>` : ""}
          ${foto ? `<img src="${esc(foto)}" alt="Foto laporan warga" loading="lazy" onerror="this.remove()" onload="this.closest('.maplibregl-popup') && window.dispatchEvent(new Event('pop-resize'))">` : ""}`,
          src: `Sumber: laporan warga via PetaBencana.id${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">lihat laporan</a>` : ""}` },
          { id: "b", ic: "berita", label: "Berita", n: (state.berita[p.id]?.berita || []).length, html: beritaListHTML(p.id) }], "d")}</div>`;
    }
    popupAt(lngLat, html, null, anchor);
  }

  // ---------- radius guncangan gempa ----------
  // Perkiraan kasar dengan persamaan atenuasi intensitas global (bentuk Allen, Wald & Worden 2012,
  // jarak hiposenter). Bukan peta guncangan resmi BMKG.
  function mmiAt(M, rHypo) {
    const R = Math.max(rHypo, 10);
    const rm = -0.209 + 2.042 * Math.exp(M - 5);
    let i = 2.085 + 1.428 * M - 1.402 * Math.log(Math.sqrt(R * R + rm * rm));
    if (R > 50) i += 0.078 * Math.log(R / 50);
    return i;
  }
  // Intensitas tertinggi yang dilaporkan BMKG di kolom "dirasakan", mis. "III-IV Gayo Lues, II Aceh" -> 4
  function maxDirasakan(text) {
    const m = String(text || "").match(/\b(IX|VIII|VII|VI|IV|V|III|II|I)\b/g) || [];
    return Math.max(0, ...m.map((r) => ROMAWI[r]));
  }
  // Radius tiap level MMI. Bila BMKG melaporkan gempa terasa lebih kuat dari perkiraan rumus
  // (sering pada gempa dalam), perkiraan dinaikkan agar sesuai laporan tersebut (kalibrasi).
  function ringRadii(p) {
    const M = p.magnitudo, d = Math.max(p.kedalaman_km || 10, 1);
    if (!M) return { rings: [], kalibrasi: false };
    const lapor = maxDirasakan(p.dirasakan);
    const delta = lapor ? Math.max(0, lapor + 0.5 - mmiAt(M, d)) : 0;
    const f = (r) => mmiAt(M, r) + delta;
    let rings = MMI.map((m) => {
      if (f(d) < m.lv) return null;
      let lo = d, hi = 3000;
      if (f(hi) >= m.lv) return { ...m, km: hi };
      for (let k = 0; k < 40; k++) { const mid = (lo + hi) / 2; if (f(mid) >= m.lv) lo = mid; else hi = mid; }
      const epi = Math.sqrt(Math.max(lo * lo - d * d, 0));
      return epi >= 3 ? { ...m, km: epi } : null;
    }).filter(Boolean);
    // Level II hanya untuk gempa lemah (yang tidak punya lingkaran III ke atas).
    // Gempa yang tidak terasa sama sekali sengaja tanpa lingkaran agar tidak terkesan besar.
    if (rings.some((r) => r.lv >= 3)) rings = rings.filter((r) => r.lv >= 3);
    return { rings, kalibrasi: delta > 0.05 };
  }
  function circle(lng, lat, km, steps = 96) {
    const R = 6371, d = km / R, la = lat * Math.PI / 180, lo = lng * Math.PI / 180, pts = [];
    for (let i = 0; i <= steps; i++) {
      const b = (i / steps) * 2 * Math.PI;
      const la2 = Math.asin(Math.sin(la) * Math.cos(d) + Math.cos(la) * Math.sin(d) * Math.cos(b));
      const lo2 = lo + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(la), Math.cos(d) - Math.sin(la) * Math.sin(la2));
      pts.push([lo2 * 180 / Math.PI, la2 * 180 / Math.PI]);
    }
    return pts;
  }
  const fc = (features) => ({ type: "FeatureCollection", features });
  function ringPolys(lng, lat, rings, scale) {
    return [...rings].sort((a, b) => b.km - a.km).map((r) => ({
      type: "Feature", properties: { warna: r.warna },
      geometry: { type: "Polygon", coordinates: [circle(lng, lat, Math.max(r.km * scale, 0.5), 72)] },
    }));
  }
  // owner = gempa yang lingkarannya sedang tampil. Popup gempa lama yang tertutup hanya boleh
  // menghapus lingkarannya sendiri (bukan lingkaran gempa baru yang baru saja diklik).
  function clearRings(owner) {
    if (!state.mapReady) return;
    if (owner !== undefined && owner !== state.ringsOwner) return;
    state.ringsOwner = null;
    cancelAnimationFrame(state.anim);
    for (const s of ["guncangan", "guncangan-label", "gelombang"]) map.getSource(s).setData(fc([]));
  }
  const fmtKm = (km) => (km >= 100 ? Math.round(km / 10) * 10 : Math.round(km));

  // Animasi: lingkaran tumbuh dari pusat gempa, lalu gelombang kejut berulang
  function animateRings(owner, lng, lat, rings) {
    cancelAnimationFrame(state.anim);
    const labels = fc(rings.map((r) => ({
      type: "Feature", properties: { warna: r.warna, label: `${r.rom} · ±${fmtKm(r.km)} km` },
      geometry: { type: "Point", coordinates: circle(lng, lat, r.km, 4)[0] },
    })));
    if (REDUCED || !rings.length) {
      map.getSource("guncangan").setData(fc(ringPolys(lng, lat, rings, 1)));
      map.getSource("guncangan-label").setData(rings.length ? labels : fc([]));
      return;
    }
    const maxKm = Math.max(...rings.map((r) => r.km));
    const t0 = performance.now(), GROW = 1100, WAVE = 2600;
    let labelsOn = false;
    const frame = (t) => {
      if (state.ringsOwner !== owner) return;
      const e = t - t0;
      if (e < GROW) {
        map.getSource("guncangan").setData(fc(ringPolys(lng, lat, rings, easeOut(e / GROW))));
      } else if (!labelsOn) {
        map.getSource("guncangan").setData(fc(ringPolys(lng, lat, rings, 1)));
        map.getSource("guncangan-label").setData(labels);
        labelsOn = true;
      }
      const w = ((e % WAVE) / WAVE);
      map.getSource("gelombang").setData(fc([{ type: "Feature", properties: { o: 0.75 * (1 - w) },
        geometry: { type: "LineString", coordinates: circle(lng, lat, Math.max(maxKm * easeOut(w), 0.5), 72) } }]));
      state.anim = requestAnimationFrame(frame);
    };
    // bila tab tidak aktif (rAF berhenti), tetap tampilkan lingkaran akhirnya
    setTimeout(() => {
      if (state.ringsOwner === owner && !labelsOn) {
        map.getSource("guncangan").setData(fc(ringPolys(lng, lat, rings, 1)));
        map.getSource("guncangan-label").setData(labels);
      }
    }, GROW + 300);
    state.anim = requestAnimationFrame(frame);
  }

  function showQuake(f, fly) {
    const p = f.properties, [lng, lat] = f.geometry.coordinates;
    const { rings } = ringRadii(p);
    const shake = safeUrl(p.shakemap);
    const html = `<div class="pop"><h3><span class="hi" style="--c:#ff4d4f">${icon("gempa")}</span>Gempa M${esc(p.magnitudo ?? "?")}</h3>
      <div class="sub">${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))}</div>
      <dl><dt>Lokasi</dt><dd>${esc(p.lokasi || "-")}</dd>
      <dt>Kedalaman</dt><dd>${esc(p.kedalaman_km ?? "?")} km</dd>
      ${p.potensi ? `<dt>Potensi</dt><dd>${esc(p.potensi)}</dd>` : ""}</dl>
      <div class="src">Sumber: ${esc(p.sumber || "BMKG")}</div>
      ${tabsHTML([{ id: "d", label: "Detail guncangan", src: "Radius guncangan: perkiraan kasar dari magnitudo &amp; kedalaman (rumus atenuasi Allen dkk. 2012), bukan pengukuran. Dirasakan &amp; peta guncangan: BMKG.", html: `
      ${p.kabupaten || p.dirasakan ? `<dl style="margin-bottom:8px">
        ${p.kabupaten ? `<dt>Wilayah</dt><dd>${esc(where(p))}</dd>` : ""}
        ${p.dirasakan ? `<dt>Dirasakan</dt><dd>${esc(p.dirasakan)} <span style="color:var(--muted)">(laporan BMKG)</span></dd>` : ""}</dl>` : ""}
      <div class="sec-h">Perkiraan radius guncangan (skala MMI)</div>
      ${rings.length ? `<div class="rings">${rings.map((r) => `<i style="background:${r.warna}"></i><b>${r.rom} · ±${fmtKm(r.km)} km</b><span>${esc(r.ket)}</span>`).join("")}</div>`
        : `<div class="nm">Diperkirakan <b>tidak terasa</b> di permukaan${(p.kedalaman_km || 0) >= 100 ? ` — pusat gempa sangat dalam (${esc(p.kedalaman_km)} km)` : " — magnitudo kecil"}${p.dirasakan ? "" : ", dan BMKG tidak mencatatnya sebagai gempa dirasakan"}.</div>`}
      ${shake ? `<div class="nm" style="margin-top:6px"><a href="${esc(shake)}" target="_blank" rel="noopener">Peta guncangan BMKG</a></div>` : ""}` },
      { id: "b", ic: "berita", label: "Berita", n: beritaGempa(p).length,
        html: newsHTML(beritaGempa(p), (p.magnitudo || 0) >= 4.5 || p.dirasakan ? "Belum ada berita media untuk gempa ini." : "Gempa kecil ini jarang diberitakan media.") },
      { id: "m", ic: "lapor", label: "Medsos", html: medsosGempaHTML(p) }])}</div>`;

    const owner = `${p.waktu}|${lng}|${lat}`;
    state.ringsOwner = owner;
    animateRings(owner, lng, lat, rings);
    // Tanpa lingkaran: tampilkan ±150 km di sekitarnya agar pulau terdekat terlihat
    const biggest = rings.length ? Math.max(...rings.map((r) => r.km)) : 150;
    const pts = circle(lng, lat, Math.max(biggest, 30), 16);
    const b = pts.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0]));
    // Ditunda sampai klik selesai diproses, agar popup lama ditutup oleh klik peta lebih dulu.
    setTimeout(() => {
      if (state.ringsOwner !== owner) return; // sudah diganti gempa lain
      // Desktop: tutup popup = hapus lingkaran. HP: lingkaran tetap tampil sampai gempa lain diklik.
      popupAt({ lng, lat }, html, () => { if (!isMobile()) clearRings(owner); });
      if (!KARTU) map.fitBounds(b, { padding: viewPadding(), maxZoom: 9, duration: REDUCED ? 0 : fly === false ? 700 : 1100 });
    }, 0);
  }

  // ---------- banjir ----------
  function showWarningPopup(f, lngLat) {
    const p = f.properties;
    const kabs = Array.isArray(p.kabupaten_list) ? p.kabupaten_list : [];
    const kec = Array.isArray(p.kecamatan) ? p.kecamatan : [];
    const info = safeUrl(p.infografis);
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:${WARNA_WASPADA};color:#1a1200">${icon("banjir")}</span>Waspada hujan lebat</h3>
      <div class="sub">${esc(p.provinsi || "")} · berlaku hingga ${esc(jamWIB(p.berakhir))} (${esc(sisa(p.berakhir))})</div>
      <dl>${kabs.length ? `<dt>Wilayah</dt><dd>${esc(kabs.slice(0, 6).join(", "))}${kabs.length > 6 ? ` +${kabs.length - 6}` : ""}</dd>` : ""}
      ${p.dampak ? `<dt>Dampak</dt><dd>${esc(p.dampak)}</dd>` : ""}</dl>
      <div class="src">Sumber: peringatan dini cuaca BMKG — <b>potensi</b>, bukan banjir pasti.${info ? ` <a href="${esc(info)}" target="_blank" rel="noopener">Infografis BMKG</a>` : ""}</div>
      ${tabsHTML([kec.length ? { id: "k", label: "Kecamatan", n: kec.length, html: `<div class="chips-mini">${kec.map((k) => `<span>${esc(k)}</span>`).join("")}</div>`, src: "Sumber: BMKG" } : null,
        { id: "b", ic: "berita", label: "Berita banjir", n: beritaBmkg(p.provinsi).length,
          html: newsHTML(beritaBmkg(p.provinsi), `Belum ada berita banjir di ${p.provinsi || "provinsi ini"} (36 jam terakhir).`) }])}</div>`);
  }
  function showBnpbPopup(wilayahId, lngLat) {
    const evs = state.data.banjir_bnpb.features.filter((x) => x.properties.wilayah_id === wilayahId);
    if (!evs.length) return;
    const p0 = evs[0].properties;
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:${WARNA_BNPB};color:#00222a">${icon("banjir")}</span>Banjir · ${esc(p0.kabupaten || p0.kabupaten_bnpb)}</h3>
      <div class="sub">${esc(p0.provinsi || "")} · data resmi BNPB</div>
      ${evs.map((e) => { const p = e.properties; return `
        <div class="sec"><div class="sec-h">${esc(tglID(p.tanggal))} · ${esc(p.kategori)}</div>
        <div class="grid3"><div><b>${num(p.rumah_terendam)}</b><span>rumah<br>terendam</span></div>
        <div><b>${num(p.mengungsi)}</b><span>orang<br>mengungsi</span></div>
        <div><b>${num(p.meninggal + p.hilang)}</b><span>meninggal/<br>hilang</span></div></div>
        </div>`; }).join("")}
      ${(() => {
        const kron = evs.filter((e) => e.properties.kronologis || e.properties.kondisi).map((e) => { const p = e.properties;
          return `<div class="sec-h">${esc(tglID(p.tanggal))}</div>${p.kronologis ? `<div class="asli">${esc(p.kronologis)}</div>` : ""}${p.kondisi ? `<div class="nm asli" style="margin:6px 0 8px">${esc(p.kondisi)}</div>` : ""}`; }).join("");
        const bl = evs.flatMap((e) => beritaBnpb(e.properties.id));
        return `<div class="src">Sumber: BNPB (Kejadian Bencana Mingguan) — bisa tertinggal beberapa hari.</div>` +
          tabsHTML([kron ? { id: "k", label: "Kronologi", html: kron, src: "Sumber: BNPB" } : null,
          { id: "b", ic: "berita", label: "Berita", n: bl.length, html: newsHTML(bl, "Belum ada berita media untuk kejadian ini.") }]);
      })()}</div>`);
  }
  function boundsOf(coordsList) {
    const b = new maplibregl.LngLatBounds(coordsList[0], coordsList[0]);
    coordsList.forEach((c) => b.extend(c));
    return b;
  }
  function focusWarning(f) {
    if (!state.mapReady) return;
    closeSheet();
    clearRings();
    const pts = f.geometry.coordinates.flatMap((poly) => poly[0]);
    const b = boundsOf(pts);
    map.fitBounds(b, { padding: viewPadding(), maxZoom: 9, duration: REDUCED ? 0 : 1000 });
    setTimeout(() => showWarningPopup(f, { lng: f.properties.x, lat: f.properties.y }), 0);
  }
  function focusBnpb(wilayahId, f) {
    if (!state.mapReady) return;
    closeSheet();
    clearRings();
    const [lng, lat] = f.geometry.coordinates;
    terbangKe([lng, lat], 8, 0, { duration: REDUCED ? 0 : 1000 });
    setTimeout(() => showBnpbPopup(wilayahId, { lng, lat }), 0);
  }

  function showAreaPopup(f, lngLat) {
    const p = f.properties;
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:#3b82f6">${icon("banjir")}</span>Area tergenang</h3>
      <div class="sub">${esc(p.nama)}${p.kota ? ` · ${esc(p.kota)}` : ""}</div>
      <dl><dt>Tinggi air</dt><dd>${esc(p.tinggi)}</dd><dt>Diperbarui</dt><dd>${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))}</dd></dl>
      <div class="src">Sumber: PetaBencana.id (laporan warga &amp; petugas yang sudah diverifikasi).</div></div>`);
  }
  function focusArea(f) {
    if (!state.mapReady) return;
    closeSheet(); clearRings();
    const pts = f.geometry.type === "MultiPolygon" ? f.geometry.coordinates.flatMap((poly) => poly[0]) : f.geometry.coordinates[0];
    const b = boundsOf(pts);
    map.fitBounds(b, { padding: viewPadding(), maxZoom: 15, duration: REDUCED ? 0 : 1000 });
    setTimeout(() => showAreaPopup(f, b.getCenter()), 0);
  }

  // ---------- angin (Open-Meteo, prakiraan per jam) ----------
  const SKALA_ANGIN = [[0, "#93c5fd"], [10, "#5eead4"], [20, "#a3e635"], [30, "#facc15"], [40, "#fb923c"], [55, "#ef4444"]];
  const ARAH = ["utara", "timur laut", "timur", "tenggara", "selatan", "barat daya", "barat", "barat laut"];
  const namaArah = (deg) => ARAH[Math.round(((deg % 360) + 360) % 360 / 45) % 8];
  // indeks jam prakiraan yang sedang berlaku (jam dalam UTC tanpa zona)
  function jamAngin() {
    const jam = state.anginData?.jam || [];
    let i = 0;
    jam.forEach((t, k) => { if (Date.parse(t + ":00Z") <= Date.now()) i = k; });
    return i;
  }
  function anginGeo() {
    const d = state.anginData;
    if (!d) return { type: "FeatureCollection", features: [] };
    const i = jamAngin();
    return { type: "FeatureCollection", features: d.titik.map(([lon, lat, v, arah, g], k) => ({
      type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] },
      properties: { k, v: v[i], dari: arah[i], ke: (arah[i] + 180) % 360, g: g?.[i] ?? null } })) };
  }
  function terapkanAngin() {
    const btn = $("#angin-btn");
    if (btn) btn.setAttribute("aria-pressed", String(state.angin));
    const ada = !!state.anginData;
    if (!state.mapReady || !map.getSource("angin")) return;
    map.getSource("angin").setData(state.angin ? anginGeo() : { type: "FeatureCollection", features: [] });
    map.setLayoutProperty("angin", "visibility", state.angin && REDUCED ? "visible" : "none");
    map.setLayoutProperty("angin-hit", "visibility", state.angin ? "visible" : "none");
    if (state.angin && ada && !REDUCED) mulaiAngin(); else hentikanAngin();
    updateCtrl();
  }

  // ---------- polusi udara (PM2.5: model CAMS via Open-Meteo, dikoreksi stasiun ISPU) ----------
  // 1×1 piksel transparan (placeholder sebelum data polusi termuat; sebelumnya piksel biru → kotak biru menutupi peta)
  const GAMBAR_KOSONG = (() => { const c = document.createElement("canvas"); c.width = c.height = 1; return c.toDataURL(); })();
  // Kategori ISPU (Permen LHK P.14/2020). Warna = palet What'sUpIndonesia, sama untuk heatmap, stasiun, popup & legenda.
  const ISPU_RESMI = [
    { maks: 50, nama: "Baik", warna: "#22c55e", saran: "Udara bersih, aman untuk aktivitas luar ruangan." },
    { maks: 100, nama: "Sedang", warna: "#fbbf24", saran: "Masih dapat diterima. Kelompok sensitif kurangi aktivitas berat di luar." },
    { maks: 200, nama: "Tidak sehat", warna: "#f97316", saran: "Kurangi aktivitas luar ruangan; pakai masker bila perlu keluar." },
    { maks: 300, nama: "Sangat tidak sehat", warna: "#ef4444", saran: "Hindari aktivitas luar ruangan; tutup jendela." },
    { maks: Infinity, nama: "Berbahaya", warna: "#a855f7", saran: "Tetap di dalam ruangan. Kelompok sensitif cari ruangan berudara bersih." },
  ];
  const WARNA_TANPA_PM = "#64748b";
  const kategoriIspu = (v) => ISPU_RESMI.find((k) => v <= k.maks) || ISPU_RESMI[ISPU_RESMI.length - 1];
  const rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  // Konversi PM2.5 (µg/m³) <-> indeks ISPU, tabel batas Permen LHK P.14/2020
  const BATAS_PM = [0, 15.5, 55.4, 150.4, 250.4, 500], BATAS_I = [0, 50, 100, 200, 300, 500];
  const antara = (v, dari, ke) => {
    for (let k = 1; k < dari.length; k++) if (v <= dari[k]) return ke[k - 1] + (v - dari[k - 1]) / (dari[k] - dari[k - 1]) * (ke[k] - ke[k - 1]);
    return ke[ke.length - 1];
  };
  const pmKeIspu = (pm) => antara(Math.max(0, pm), BATAS_PM, BATAS_I);
  const ispuKePm = (i) => antara(Math.max(0, i), BATAS_I, BATAS_PM);
  const kategoriPM = (pm) => kategoriIspu(pmKeIspu(pm));
  const jamUdara = () => {
    const jam = state.udaraData?.jam || [];
    let i = 0;
    jam.forEach((t, k) => { if (Date.parse(t + ":00Z") <= Date.now()) i = k; });
    return i;
  };
  // Heatmap: gradasi warna + transparansi menurut PM2.5. Udara bersih nyaris transparan, makin kotor makin pekat.
  // Warna berganti tepat di sekitar batas kategori ISPU (15,5 · 55,4 · 150,4 · 250,4 µg/m³),
  // jadi warna heatmap = warna stasiun & legenda untuk kategori yang sama.
  const GRADASI_PM = [
    // [PM2.5 µg/m³, warna, kepekatan]. Batas kategori ISPU: 15,5 · 55,4 · 150,4 · 250,4 µg/m³.
    // Tiap kategori bergradasi di dalamnya (makin pekat = makin buruk) dan antar-kategori dibuat kontras:
    // hijau → kuning muda → amber | oranye → oranye tua | merah → merah tua | ungu
    [0, [34, 197, 94], 0], [5, [34, 197, 94], 0.3], [15, [74, 222, 128], 0.45],
    [17, [253, 224, 71], 0.68], [54, [245, 158, 11], 0.76],
    [57, [251, 113, 33], 0.78], [148, [234, 88, 12], 0.82],
    [153, [239, 68, 68], 0.82], [248, [153, 27, 27], 0.86],
    [253, [168, 85, 247], 0.88], [400, [126, 34, 206], 0.9],
  ];
  function warnaPM(v) {
    const g = GRADASI_PM;
    if (v <= g[0][0]) return [...g[0][1], g[0][2]];
    for (let k = 1; k < g.length; k++) {
      if (v <= g[k][0]) {
        const [a, b] = [g[k - 1], g[k]], t = (v - a[0]) / (b[0] - a[0]);
        return [0, 1, 2].map((c) => a[1][c] + (b[1][c] - a[1][c]) * t).concat(a[2] + (b[2] - a[2]) * t);
      }
    }
    const z = g[g.length - 1]; return [...z[1], z[2]];
  }
  const mulus = (t) => t * t * (3 - 2 * t);
  const kmXY = (lon1, lat1, lon2, lat2) => {
    const x = (lon2 - lon1) * 111.32 * Math.cos(((lat1 + lat2) / 2) * Math.PI / 180), y = (lat2 - lat1) * 110.57;
    return x * x + y * y; // kuadrat jarak (km²)
  };
  const median = (a) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };

  // Grid model per jam. Titik yang tidak ada (mis. laut lepas) = NaN.
  function gridModel() {
    const d = state.udaraData;
    if (state.UM?.d === d) return state.UM;
    const lons = [...new Set(d.titik.map((t) => t[0]))].sort((a, b) => a - b);
    const lats = [...new Set(d.titik.map((t) => t[1]))].sort((a, b) => b - a);
    let dx = Infinity;
    for (let k = 1; k < lons.length; k++) dx = Math.min(dx, lons[k] - lons[k - 1]);
    const x0 = lons[0], y0 = lats[0], nx = Math.round((lons[lons.length - 1] - x0) / dx) + 1, ny = Math.round((y0 - lats[lats.length - 1]) / dx) + 1;
    const jam = d.jam.map((_, h) => {
      const g = new Float32Array(nx * ny).fill(NaN);
      for (const [lon, lat, pm] of d.titik) if (pm[h] != null) g[Math.round((y0 - lat) / dx) * nx + Math.round((lon - x0) / dx)] = pm[h];
      return g;
    });
    return (state.UM = { d, dx, x0, y0, nx, ny, jam, xE: x0 + (nx - 1) * dx, yS: y0 - (ny - 1) * dx });
  }
  // Nilai model di titik mana pun (interpolasi mulus; sudut yang kosong diabaikan). cov = bobot data yang ada (0..1).
  function sampelModel(M, g, lon, lat) {
    const fx = (lon - M.x0) / M.dx, fy = (M.y0 - lat) / M.dx;
    if (fx < 0 || fy < 0 || fx > M.nx - 1 || fy > M.ny - 1) return null;
    const gx = Math.min(Math.floor(fx), M.nx - 2), gy = Math.min(Math.floor(fy), M.ny - 2);
    const tx = mulus(fx - gx), ty = mulus(fy - gy), o = gy * M.nx + gx;
    let s = 0, w = 0;
    for (const [k, b] of [[o, (1 - tx) * (1 - ty)], [o + 1, tx * (1 - ty)], [o + M.nx, (1 - tx) * ty], [o + M.nx + 1, tx * ty]]) {
      if (!Number.isNaN(g[k])) { s += g[k] * b; w += b; }
    }
    return w > 0.001 ? { v: s / w, cov: w } : null;
  }

  // Stasiun ISPU: siapa yang punya sensor PM2.5, siapa yang menyimpang jauh dari tetangganya,
  // lalu medan koreksi (model × faktor) di sekitar stasiun yang layak dipakai.
  const KOREKSI_RES = 0.1, KOREKSI_L = 35, TETANGGA_KM = 25; // derajat, km, km
  function olahUdara() {
    const M = gridModel(), h = jamUdara(), ispu = state.data.ispu?.features || [];
    const key = `${state.udaraData.diambil}|${h}|${ispu.length}|${ispu[0]?.properties.waktu || ""}`;
    if (state.UK?.key === key) return state.UK;
    const st = ispu.map((f) => {
      const p = f.properties, sub = typeof p.sub === "string" ? JSON.parse(p.sub) : (p.sub || {});
      const [lon, lat] = f.geometry.coordinates, iPM = sub["PM2.5"];
      return { f, lon, lat, iPM: typeof iPM === "number" ? iPM : null, obs: typeof iPM === "number" ? ispuKePm(iPM) : null };
    });
    const pm = st.filter((s) => s.obs != null);
    for (const s of pm) {
      const tg = pm.filter((t) => t !== s && kmXY(s.lon, s.lat, t.lon, t.lat) <= TETANGGA_KM ** 2);
      if (tg.length >= 2) {
        s.medTetangga = median(tg.map((t) => t.iPM)); s.nTetangga = tg.length;
        const r = s.obs / Math.max(1, median(tg.map((t) => t.obs)));
        s.menyimpang = r < 0.65 ? "rendah" : r > 1.55 ? "tinggi" : null; // beda >35% / >55% dari tetangga
      }
      const m = sampelModel(M, M.jam[h], s.lon, s.lat);
      if (m && !s.menyimpang) s.lr = Math.max(-1.8, Math.min(1.8, Math.log((s.obs + 5) / (m.v + 5))));
    }
    // medan koreksi log (0 = tanpa koreksi) di grid halus; tiap stasiun hanya menyentuh sel dalam radius 3L
    const cw = Math.round((M.xE - M.x0) / KOREKSI_RES) + 1, ch = Math.round((M.y0 - M.yS) / KOREKSI_RES) + 1;
    const nu = new Float32Array(cw * ch), de = new Float32Array(cw * ch);
    for (const s of pm) {
      if (s.lr == null) continue;
      const rDeg = (3 * KOREKSI_L) / 105, cx = (s.lon - M.x0) / KOREKSI_RES, cy = (M.y0 - s.lat) / KOREKSI_RES, rc = Math.ceil(rDeg / KOREKSI_RES);
      for (let y = Math.max(0, Math.floor(cy - rc)); y <= Math.min(ch - 1, Math.ceil(cy + rc)); y++) {
        for (let x = Math.max(0, Math.floor(cx - rc)); x <= Math.min(cw - 1, Math.ceil(cx + rc)); x++) {
          const w = Math.exp(-kmXY(s.lon, s.lat, M.x0 + x * KOREKSI_RES, M.y0 - y * KOREKSI_RES) / KOREKSI_L ** 2);
          nu[y * cw + x] += w * s.lr; de[y * cw + x] += w;
        }
      }
    }
    const kor = new Float32Array(cw * ch);
    for (let k = 0; k < kor.length; k++) kor[k] = de[k] ? nu[k] / (de[k] + 0.15) : 0;
    // data stasiun untuk peta (tanda tanpa PM2.5 / menyimpang) dan popup
    const info = new Map(st.map((s) => [s.f.properties.id, s]));
    const fc = { type: "FeatureCollection", features: st.map((s) => ({ ...s.f,
      properties: { ...s.f.properties, tanpaPM: s.obs == null, menyimpang: s.menyimpang || "" } })) };
    return (state.UK = { key, M, h, cw, ch, kor, info, st, fc });
  }
  const koreksiDi = (K, lon, lat) => {
    const x = Math.round((lon - K.M.x0) / KOREKSI_RES), y = Math.round((K.M.y0 - lat) / KOREKSI_RES);
    return x < 0 || y < 0 || x >= K.cw || y >= K.ch ? 0 : K.kor[y * K.cw + x];
  };
  // PM2.5 perkiraan (model × koreksi stasiun) di titik mana pun, untuk jam ke-h
  function pmDi(lon, lat, h) {
    const K = olahUdara(), s = sampelModel(K.M, K.M.jam[h], lon, lat);
    return s ? s.v * Math.exp(koreksiDi(K, lon, lat)) : null;
  }
  // Blur kotak 3 lintasan (≈ gaussian) pada warna premultiplied: tepi grid & pantai jadi lembut tanpa pinggiran gelap.
  // Dikerjakan manual karena ctx.filter belum didukung semua browser (Safari).
  function blurRGBA(px, W, H, r) {
    const n = W * H, buf = [0, 1, 2, 3].map(() => new Float32Array(n)), tmp = new Float32Array(Math.max(W, H));
    for (let k = 0; k < n; k++) {
      const a = px[k * 4 + 3] / 255;
      buf[0][k] = px[k * 4] * a; buf[1][k] = px[k * 4 + 1] * a; buf[2][k] = px[k * 4 + 2] * a; buf[3][k] = a;
    }
    const lewat = (ch, len, count, stride, step) => {
      for (let c = 0; c < count; c++) {
        const base = c * stride;
        let s = 0;
        for (let i = -r; i <= r; i++) s += ch[base + Math.min(len - 1, Math.max(0, i)) * step];
        for (let i = 0; i < len; i++) {
          tmp[i] = s / (2 * r + 1);
          s += ch[base + Math.min(len - 1, i + r + 1) * step] - ch[base + Math.max(0, i - r) * step];
        }
        for (let i = 0; i < len; i++) ch[base + i * step] = tmp[i];
      }
    };
    for (const ch of buf) for (let p = 0; p < 3; p++) { lewat(ch, W, H, W, 1); lewat(ch, H, W, 1, W); }
    for (let k = 0; k < n; k++) {
      const a = buf[3][k];
      px[k * 4 + 3] = Math.round(a * 255);
      if (a > 0.001) { px[k * 4] = buf[0][k] / a; px[k * 4 + 1] = buf[1][k] / a; px[k * 4 + 2] = buf[2][k] / a; }
    }
  }
  function gambarUdara() {
    const K = olahUdara(), M = K.M, g = M.jam[K.h], W = K.cw, H = K.ch;
    const cv = document.createElement("canvas"); cv.width = W; cv.height = H;
    const cx = cv.getContext("2d"), img = cx.createImageData(W, H), pudar = 2 * M.dx;
    const kuat = state.tema === "gelap" ? 0.8 : 1;   // peta dasar gelap: warna sedikit lebih tipis agar jalan & batas tetap terlihat
    for (let y = 0; y < H; y++) {
      const lat = M.y0 - y * KOREKSI_RES;
      for (let x = 0; x < W; x++) {
        const lon = M.x0 + x * KOREKSI_RES, s = sampelModel(M, g, lon, lat);
        if (!s) continue;
        const [r, gg, b, a] = warnaPM(s.v * Math.exp(K.kor[y * W + x])), o = (y * W + x) * 4;
        // tepi kotak data memudar, juga ke arah laut lepas yang tidak punya data
        const tepi = mulus(Math.min(1, Math.min(lon - M.x0, M.xE - lon, M.y0 - lat, lat - M.yS) / pudar)) * mulus(Math.min(1, s.cov));
        img.data[o] = r; img.data[o + 1] = gg; img.data[o + 2] = b; img.data[o + 3] = Math.round(a * kuat * tepi * 255);
      }
    }
    blurRGBA(img.data, W, H, 3);
    cx.putImageData(img, 0, 0);
    return { url: cv.toDataURL(), coordinates: [[M.x0, M.y0], [M.xE, M.y0], [M.xE, M.yS], [M.x0, M.yS]] };
  }
  function terapkanUdara() {
    const btn = $("#udara-btn");
    if (btn) btn.setAttribute("aria-pressed", String(state.udara));
    const leg = $("#legenda-udara");
    if (leg) leg.hidden = !state.udara;
    document.body.classList.toggle("udara-on", !!state.udara);
    if (!state.mapReady || !map.getSource("udara-img")) return;
    const ada = !!state.udaraData && state.udara;
    if (ada) {
      const K = olahUdara(), key = `${K.key}|${state.tema}`;
      const src = map.getSource("udara-img");
      if (state.udaraKey !== key || state.udaraSrc !== src) {   // sumber baru setelah ganti tema / muat ulang
        src.updateImage(gambarUdara());
        state.udaraKey = key; state.udaraSrc = src;
      }
    }
    map.setLayoutProperty("udara-img", "visibility", ada ? "visible" : "none");
    const adaSt = state.udara && !!state.data.ispu?.features?.length;
    if (adaSt) map.getSource("ispu").setData(state.udaraData ? olahUdara().fc : state.data.ispu);
    for (const l of ["ispu", "ispu-label"]) map.setLayoutProperty(l, "visibility", adaSt ? "visible" : "none");
  }
  function setUdara(on) {
    state.udara = on;
    simpan("wui-udara", on ? "1" : "0");
    state.udaraKey = null;
    if (!on && state.popup && state.popupUdara) state.popup.remove();
    terapkanUdara();
  }
  // Legenda: muncul hanya saat tombol polusi udara aktif
  class LegendaUdara {
    onAdd() {
      const d = document.createElement("div");
      d.className = "maplibregl-ctrl legenda-udara"; d.id = "legenda-udara"; d.hidden = !state.udara;
      d.innerHTML = `<div class="lu-judul">Kualitas udara</div><div class="lu-isi"><i class="lu-bar"></i><ul>
        ${[...ISPU_RESMI].reverse().map((k) => `<li><span style="--c:${k.warna}"></span>${esc(k.nama)}</li>`).join("")}</ul></div>
        <div class="lu-cat"><span style="--c:${WARNA_TANPA_PM}"></span>Stasiun tanpa sensor PM2.5</div>`;
      return d;
    }
    onRemove() { /* tidak dipakai */ }
  }
  map.addControl(new LegendaUdara(), "bottom-right");

  function catatanStasiun(s) {
    if (!s) return "";
    if (s.obs == null) return `<div class="warn">Stasiun ini <b>tidak mengukur PM2.5</b> (debu halus), polutan utama di kota.
      Angkanya tidak bisa dibandingkan dengan stasiun lain. Lihat warna heatmap di sekitarnya.</div>`;
    if (s.menyimpang) return `<div class="warn">Angka ini jauh <b>lebih ${s.menyimpang}</b> dari ${num(s.nTetangga)} stasiun sekitarnya
      (nilai tengah ISPU ${num(Math.round(s.medTetangga))}). Bisa karena lokasi alat ${s.menyimpang === "rendah" ? "(mis. di taman)" : "(mis. dekat sumber asap)"}
      atau gangguan alat, jadi tidak dipakai untuk warna heatmap.</div>`;
    return "";
  }
  function showIspuPopup(f) {
    const full = state.data.ispu.features.find((x) => x.properties.id === f.properties.id) || f;
    const p = full.properties, K = kategoriIspu(p.ispu), s = state.udaraData ? olahUdara().info.get(p.id) : null;
    const tanpaPM = s ? s.obs == null : false, warna = tanpaPM ? WARNA_TANPA_PM : K.warna;
    const sub = typeof p.sub === "string" ? JSON.parse(p.sub) : (p.sub || {});
    const subHTML = Object.entries(sub).sort((a, b) => b[1] - a[1]).map(([n, v]) =>
      `<div><b style="color:${kategoriIspu(v).warna}">${num(v)}</b><span>${esc(n)}</span></div>`).join("");
    const skala = ISPU_RESMI.map((k) => `<span class="ispu${k === K && !tanpaPM ? " on" : ""}" style="--c:${k.warna}"><i></i>${esc(k.nama)}</span>`).join("");
    const umurJam = (Date.now() - Date.parse(p.waktu)) / HOUR;
    const [lng, lat] = full.geometry.coordinates;
    popupAt({ lng, lat }, `<div class="pop"><h3><span class="hi" style="--c:${warna}">${icon("asap")}</span>ISPU ${num(p.ispu)} · ${tanpaPM ? "Tanpa PM2.5" : esc(K.nama)}</h3>
      <div class="sub"><b>${esc(p.nama)}</b>${p.kota ? ` · ${esc(p.kota)}` : ""}${p.provinsi ? `, ${esc(p.provinsi)}` : ""}</div>
      <div class="sub">Diukur pukul <b>${esc(jamWIB(p.waktu))}</b> · ${esc(ago(p.waktu))}${umurJam > 6 ? " · <b>data lama</b>" : ""}</div>
      ${catatanStasiun(s)}
      <div class="ispu-skala" style="margin-top:6px">${skala}</div>
      ${tanpaPM ? "" : `<div class="sub" style="margin-top:6px">${esc(K.saran)}</div>`}
      ${p.kritis ? `<div class="sub">Polutan penentu: <b>${esc(p.kritis)}</b></div>` : ""}
      ${subHTML ? `<div class="sec-h" style="margin-top:8px">Indeks per polutan</div><div class="grid3">${subHTML}</div>` : ""}
      <div class="src">Stasiun resmi ISPU Kementerian Lingkungan Hidup${p.pengelola ? ` (${esc(p.pengelola)})` : ""}.
        Sumber: <a href="https://ispu.kemenlh.go.id/" target="_blank" rel="noopener">ispu.kemenlh.go.id</a></div></div>`);
    state.popupUdara = true;
    state.popup.on("close", () => { state.popupUdara = false; });
  }
  // Klik di mana saja saat lapisan aktif: perkiraan kualitas udara di titik itu + stasiun terdekat
  function showAirPopup(lngLat, wilayah) {
    const d = state.udaraData, K = olahUdara(), i = K.h, { lng, lat } = lngLat;
    const v = pmDi(lng, lat, i);
    if (v == null) return;
    const Ki = kategoriPM(v);
    lacak("Cek udara di titik", { wilayah: (wilayah && (wilayah.nama || wilayah.name)) || "" });
    const lanjut = [3, 6, 9].filter((h) => d.jam[i + h]).map((h) => {
      const w = pmDi(lng, lat, i + h), kk = w == null ? null : kategoriPM(w);
      return kk ? `<div><b style="color:${kk.warna}">${esc(kk.nama)}</b><span>${esc(jamWIB(d.jam[i + h] + ":00Z"))}</span></div>` : "";
    }).join("");
    const dekat = K.st.map((s) => ({ s, km: Math.sqrt(kmXY(lng, lat, s.lon, s.lat)) })).filter((x) => x.km <= 30)
      .sort((a, b) => a.km - b.km).slice(0, 3).map(({ s, km }) => {
        const p = s.f.properties, kk = kategoriIspu(p.ispu), tanda = s.obs == null ? "tanpa sensor PM2.5" : s.menyimpang ? `jauh lebih ${s.menyimpang} dari sekitar` : "";
        return `<div class="st-row"><i style="--c:${s.obs == null ? WARNA_TANPA_PM : kk.warna}"></i><span><b>${esc(p.nama)}</b> · ISPU ${num(p.ispu)}
          <small>${num(Math.round(km))} km${tanda ? ` · ${esc(tanda)}` : ""}</small></span></div>`;
      }).join("");
    state.udaraWilayah = wilayah?.id != null ? { p: wilayah, lngLat } : null;
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:${Ki.warna}">${icon("asap")}</span>Udara di sini: ${esc(Ki.nama)}</h3>
      <div class="sub">Perkiraan PM2.5 ±<b>${num(Math.round(v))} µg/m³</b> (setara ISPU ±${num(Math.round(pmKeIspu(v)))})</div>
      <div class="sub">${esc(Ki.saran)}</div>
      ${lanjut ? `<div class="sec-h" style="margin-top:8px">Perkiraan berikutnya</div><div class="grid3">${lanjut}</div>` : ""}
      ${dekat ? `<div class="sec-h" style="margin-top:8px">Stasiun terdekat</div>${dekat}` : ""}
      ${state.udaraWilayah ? `<button type="button" class="lnk" data-ringkas>Ringkasan ${esc(wilayah.nama)} ›</button>` : ""}
      <div class="src">Perkiraan = model CAMS (Open-Meteo) yang dikoreksi stasiun PM2.5 terdekat; bukan alat ukur.</div></div>`);
    state.popupUdara = true;
    state.popup.on("close", () => { state.popupUdara = false; });
  }
  document.addEventListener("click", (e) => {
    if (!e.target.closest || !e.target.closest(".pop [data-ringkas]") || !state.udaraWilayah) return;
    const { p, lngLat } = state.udaraWilayah;
    showRegionPopup(p, lngLat);
  });

  // ---------- animasi partikel angin ----------
  // Partikel hanyut mengikuti angin (u/v diinterpolasi bilinear dari grid), meninggalkan jejak yang memudar.
  // Satu warna netral (abu-abu) agar tidak ramai; kecepatan angin terlihat dari laju gerak partikel
  const WARNA_PARTIKEL = { gelap: "rgba(214, 222, 232, 0.55)", terang: "rgba(30, 41, 59, 0.5)" };
  const AG = { cv: null, ctx: null, grid: null, p: [], raf: 0, gerak: false, w: 0, h: 0 };
  function siapkanGrid() {
    const d = state.anginData, i = jamAngin();
    const key = `${d.diambil}|${i}`;
    if (AG.grid?.key === key) return;
    const lons = [...new Set(d.titik.map((t) => t[0]))].sort((a, b) => a - b);
    const lats = [...new Set(d.titik.map((t) => t[1]))].sort((a, b) => a - b);
    const nx = lons.length, ny = lats.length, U = new Float32Array(nx * ny), V = new Float32Array(nx * ny);
    const ix = new Map(lons.map((v, k) => [v, k])), iy = new Map(lats.map((v, k) => [v, k]));
    for (const [lon, lat, s, a] of d.titik) {
      const k = iy.get(lat) * nx + ix.get(lon), r = a[i] * Math.PI / 180;
      U[k] = -s[i] * Math.sin(r); V[k] = -s[i] * Math.cos(r);   // arah = asal angin -> vektor ke arah tiupan
    }
    AG.grid = { key, x0: lons[0], y0: lats[0], dx: lons[1] - lons[0], dy: lats[1] - lats[0], nx, ny, U, V };
  }
  function anginDi(lon, lat) {
    const g = AG.grid, fx = (lon - g.x0) / g.dx, fy = (lat - g.y0) / g.dy;
    if (fx < 0 || fy < 0 || fx > g.nx - 1 || fy > g.ny - 1) return null;
    const i = Math.floor(fx), j = Math.floor(fy), i1 = Math.min(i + 1, g.nx - 1), j1 = Math.min(j + 1, g.ny - 1);
    const tx = fx - i, ty = fy - j;
    const b = (A) => A[j * g.nx + i] * (1 - tx) * (1 - ty) + A[j * g.nx + i1] * tx * (1 - ty)
      + A[j1 * g.nx + i] * (1 - tx) * ty + A[j1 * g.nx + i1] * tx * ty;
    return [b(g.U), b(g.V)];
  }
  function lahir(pt) {
    const b = map.getBounds(), g = AG.grid;
    const w = Math.max(b.getWest(), g.x0), e = Math.min(b.getEast(), g.x0 + g.dx * (g.nx - 1));
    const s = Math.max(b.getSouth(), g.y0), n = Math.min(b.getNorth(), g.y0 + g.dy * (g.ny - 1));
    pt.mati = w >= e || s >= n;
    if (!pt.mati) { pt.lon = w + Math.random() * (e - w); pt.lat = s + Math.random() * (n - s); }
    pt.umur = 80 + Math.floor(Math.random() * 100);
    return pt;
  }
  function ukurKanvas() {
    const c = map.getContainer(), dpr = Math.min(window.devicePixelRatio || 1, 2);
    AG.w = c.clientWidth; AG.h = c.clientHeight;
    AG.cv.width = AG.w * dpr; AG.cv.height = AG.h * dpr;
    AG.cv.style.width = `${AG.w}px`; AG.cv.style.height = `${AG.h}px`;
    AG.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function isiPartikel() {
    if (!AG.grid) return;
    // jarang: kira-kira 1 partikel per 55×55 px layar
    const n = Math.round(Math.min(isMobile() ? 320 : 900, Math.max(150, AG.w * AG.h / 3000)));
    AG.p = Array.from({ length: n }, () => lahir({}));
    AG.p.forEach((pt) => { pt.umur = Math.floor(Math.random() * 180); }); // tidak lahir & mati serempak
  }
  const bersihkanKanvas = () => AG.ctx && AG.ctx.clearRect(0, 0, AG.w, AG.h);
  function frameAngin() {
    AG.raf = requestAnimationFrame(frameAngin);
    if (AG.gerak || !AG.grid || document.hidden) return;
    const c = AG.ctx;
    c.globalCompositeOperation = "destination-in";       // jejak lama memudar
    c.fillStyle = "rgba(0,0,0,0.94)";
    c.fillRect(0, 0, AG.w, AG.h);
    c.globalCompositeOperation = "source-over";
    // Laju sebanding kecepatan angin: 10 km/jam ≈ 0,4 px/frame, 40 km/jam ≈ 1,6 px/frame (sama di semua zoom)
    const k = 0.0018 * Math.pow(2, 4 - map.getZoom());
    const jalur = new Path2D();
    for (const pt of AG.p) {
      if (pt.mati || --pt.umur < 0) { lahir(pt); continue; }
      const uv = anginDi(pt.lon, pt.lat);
      if (!uv) { lahir(pt); continue; }
      const a = map.project([pt.lon, pt.lat]);
      pt.lon += uv[0] * k / Math.cos(pt.lat * Math.PI / 180);
      pt.lat += uv[1] * k;
      const b = map.project([pt.lon, pt.lat]);
      jalur.moveTo(a.x, a.y); jalur.lineTo(b.x, b.y);
    }
    c.lineWidth = 1.3; c.lineCap = "round";
    c.strokeStyle = WARNA_PARTIKEL[state.tema];
    c.stroke(jalur);
  }
  function mulaiAngin() {
    if (!AG.cv) {
      AG.cv = document.createElement("canvas");
      AG.cv.className = "angin-kanvas";
      AG.ctx = AG.cv.getContext("2d");
      map.getCanvas().after(AG.cv);   // tepat di atas peta, di bawah penanda & UI
      map.on("movestart", () => { AG.gerak = true; bersihkanKanvas(); });
      map.on("moveend", () => { AG.gerak = false; if (AG.raf) isiPartikel(); });
      map.on("resize", () => { if (AG.raf) { ukurKanvas(); isiPartikel(); } });
    }
    AG.cv.hidden = false;
    const baru = !AG.raf;
    siapkanGrid();
    if (baru) { ukurKanvas(); isiPartikel(); AG.raf = requestAnimationFrame(frameAngin); }
  }
  function hentikanAngin() {
    if (AG.raf) cancelAnimationFrame(AG.raf);
    AG.raf = 0;
    if (AG.cv) { bersihkanKanvas(); AG.cv.hidden = true; }
  }
  function setAngin(on) {
    state.angin = on;
    simpan("wui-angin", on ? "1" : "0");
    if (!on && state.popup && state.popupAngin) state.popup.remove();
    terapkanAngin();
  }
  function showWindPopup(f) {
    const d = state.anginData, p = f.properties, i = jamAngin(), row = d.titik[p.k];
    const lanjut = [3, 6, 9].filter((h) => row[2][i + h] != null).map((h) => {
      const v = row[2][i + h], a = row[3][i + h];
      return `<div><b>${num(v)}</b><span>${esc(jamWIB(d.jam[i + h] + ":00Z").replace(" WIB", ""))}<br>dari ${esc(namaArah(a))}</span></div>`;
    }).join("");
    const [lng, lat] = f.geometry.coordinates;
    popupAt({ lng, lat }, `<div class="pop"><h3><span class="hi" style="--c:#14b8a6">${icon("angin")}</span>Angin ${num(p.v)} km/jam</h3>
      <div class="sub">Bertiup <b>dari ${esc(namaArah(p.dari))}</b> (${p.dari}°)${p.g != null ? ` · hembusan hingga ${num(p.g)} km/jam` : ""}</div>
      ${lanjut ? `<div class="sec-h" style="margin-top:4px">Prakiraan berikutnya (km/jam)</div><div class="grid3">${lanjut}</div>` : ""}
      <div class="src">Angin 10 m di atas permukaan, titik grid ±165 km · model cuaca via Open-Meteo. Bukan peringatan resmi BMKG.</div></div>`);
    state.popupAngin = true;
    state.popup.on("close", () => { state.popupAngin = false; });
  }

  function setTema(t) {
    state.tema = t;
    simpan("wui-tema", t);
    document.documentElement.dataset.theme = t === "terang" ? "light" : "dark";
    document.querySelector('meta[name="theme-color"]').setAttribute("content", t === "terang" ? "#eef1f5" : "#07090d");
    tandaiTema();
    if (state.popup) state.popup.remove();
    map.setStyle(GAYA[t], { diff: false });
  }

  // ---------- pengaturan: tema, pasang di HP, sumber data ----------
  function tandaiTema() {
    document.querySelectorAll(".seg-btn[data-tema]").forEach((b) => b.setAttribute("aria-checked", String(b.dataset.tema === state.tema)));
  }
  // Satu panel di kotak judul terbuka pada satu waktu: "setelan" (pengaturan) atau "sumber" (info & sumber data)
  function bukaSetelan(buka, id = "setelan") {
    for (const p of ["setelan", "sumber"]) {
      const on = buka && p === id;
      $(`#${p}`).hidden = !on;
      $(`#${p}-btn`).setAttribute("aria-expanded", String(p === "setelan" ? buka : on));
    }
    if (buka && id === "setelan") { $("#setelan-btn").classList.remove("titik"); simpan("wui-lihat-setelan", "1"); perbaruiPasang(); }
    updateTopUI();
  }
  const panelTerbuka = () => !$("#setelan").hidden || !$("#sumber").hidden;
  const diPasang = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const iOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function perbaruiPasang() {
    const b = $("#pasang-btn"), t = $("#pasang-txt"), info = $("#pasang-info");
    b.disabled = false;
    if (diPasang()) {
      b.disabled = true; t.textContent = "Sudah terpasang";
      info.hidden = true;
    } else if (state.pasangPrompt) {
      t.textContent = "Pasang What'sUpIndonesia";
      info.hidden = true;
    }
  }
  // iPhone/iPad: semua browser memakai mesin Safari, tapi letak tombol "Bagikan" berbeda per aplikasi
  function browserIOS() {
    const ua = navigator.userAgent;
    if (/Instagram|FBAN|FBAV|FB_IAB|Line\/|TikTok|musical_ly|Bytedance|Twitter|LinkedInApp|Snapchat/i.test(ua)) return "dalam-aplikasi";
    if (/CriOS/.test(ua)) return "chrome";
    if (/FxiOS/.test(ua)) return "firefox";
    if (/EdgiOS/.test(ua)) return "edge";
    return "safari";
  }
  const KOTAK_BAGIKAN = "(kotak dengan panah ke atas)";
  function langkahPasangIOS() {
    switch (browserIOS()) {
      case "chrome":
        return `Di <b>Chrome</b>: ketuk ikon <b>Bagikan</b> ${KOTAK_BAGIKAN} di kanan kolom alamat. Kalau tidak ada, buka menu <b>⋯</b> lalu <b>Bagikan</b>. Setelah itu pilih <b>Tambahkan ke Layar Utama</b>.`;
      case "firefox":
        return `Di <b>Firefox</b>: buka menu <b>☰</b>, pilih <b>Bagikan</b>, lalu <b>Tambahkan ke Layar Utama</b>.`;
      case "edge":
        return `Di <b>Edge</b>: buka menu <b>⋯</b>, pilih <b>Bagikan</b>, lalu <b>Tambahkan ke Layar Utama</b>.`;
      case "dalam-aplikasi":
        return `Kamu sedang membuka situs ini dari dalam aplikasi lain (mis. Instagram), yang tidak bisa memasang ke layar utama. Buka menu <b>⋯</b> lalu pilih <b>Buka di browser</b> (Safari/Chrome), kemudian tekan tombol ini lagi.`;
      default:
        return `Di <b>Safari</b>: ketuk tombol <b>Bagikan</b> ${KOTAK_BAGIKAN}, lalu pilih <b>Tambahkan ke Layar Utama</b>. Kalau tombolnya tidak terlihat, ketuk menu <b>⋯</b> di kolom alamat lebih dulu.`;
    }
  }
  function pasangAplikasi() {
    lacak("Pasang aplikasi", iOS() ? { perangkat: "iOS", browser: browserIOS() } : { perangkat: state.pasangPrompt ? "Android/desktop (otomatis)" : "lainnya" });
    const info = $("#pasang-info");
    if (state.pasangPrompt) {
      const ev = state.pasangPrompt;
      state.pasangPrompt = null;
      ev.prompt();
      ev.userChoice.then((r) => { if (r.outcome !== "accepted") state.pasangPrompt = ev; perbaruiPasang(); });
    } else if (iOS()) {
      info.innerHTML = langkahPasangIOS();
      info.hidden = false;
    } else {
      info.innerHTML = "Buka menu browser (<b>⋮</b>), lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.";
      info.hidden = false;
    }
    updateTopUI();
  }
  function wireSetelan() {
    $("#setelan-btn").addEventListener("click", () => bukaSetelan(!panelTerbuka(), "setelan"));
    $("#sumber-btn").addEventListener("click", () => bukaSetelan(true, "sumber"));
    $("#panduan-btn").addEventListener("click", () => { bukaSetelan(false); setTimeout(() => mulaiPanduan(true), 150); });
    $("#sumber-kembali").addEventListener("click", () => bukaSetelan(true, "setelan"));
    $("#segar-btn").addEventListener("click", segarkan);
    document.querySelectorAll(".seg-btn[data-tema]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.tema !== state.tema) { setTema(b.dataset.tema); lacak("Ganti tema", { tema: b.dataset.tema }); }
    }));
    tandaiTema();
    document.querySelectorAll(".seg-btn[data-bahasa]").forEach((b) => {
      b.setAttribute("aria-checked", String(b.dataset.bahasa === BAHASA));
      b.addEventListener("click", () => {
        if (b.dataset.bahasa === BAHASA) return;
        simpan("wui-bahasa", b.dataset.bahasa);
        lacak("Ganti bahasa", { bahasa: b.dataset.bahasa });
        location.reload();
      });
    });
    $("#pasang-btn").addEventListener("click", pasangAplikasi);
    // klik di luar kotak judul = tutup pengaturan
    document.addEventListener("pointerdown", (e) => {
      if (panelTerbuka() && !e.target.closest("#brand")) bukaSetelan(false);
    });
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.pasangPrompt = e; perbaruiPasang(); });
    window.addEventListener("appinstalled", () => { state.pasangPrompt = null; perbaruiPasang(); });
    // tanda kecil di tombol pengaturan untuk pengunjung HP yang belum pernah membukanya
    if (isMobile() && !diPasang() && !baca("wui-lihat-setelan")) $("#setelan-btn").classList.add("titik");
    if ("serviceWorker" in navigator) {
      // updateViaCache "none": file sw.js selalu dicek ke server, jadi perbaikan service worker cepat sampai ke HP
      navigator.serviceWorker.register("sw.js", { updateViaCache: "none" })
        .then((r) => { state.swReg = r; }).catch(() => { /* opsional */ });
    }
  }

  // ---------- gunung api ----------
  function beritaGunung(p) {
    for (const d of [0, 1]) { const v = state.beritaGunung?.[`${p.id}|${hariWIB(d)}`]; if (v) return v.berita; }
    return [];
  }
  function showVolcano(f, lngLat, buka) {
    const p = f.properties, L = LEVEL_GUNUNG[p.level] || LEVEL_GUNUNG[1];
    const url = safeUrl(p.tautan), bl = beritaGunung(p);
    const lap = p.level >= 2 && (p.visual || p.kegempaan) ? `<dl class="dl-stack">
        ${p.visual ? `<dt>Visual</dt><dd>${esc(p.visual)}</dd>` : ""}
        ${p.lainnya ? `<dt>Lainnya</dt><dd>${esc(p.lainnya)}</dd>` : ""}
        ${p.kegempaan ? `<dt>Kegempaan</dt><dd>${esc(p.kegempaan)}</dd>` : ""}</dl>` : "";
    const rek = (p.rekomendasi || []).length ? `<ol class="rek">${p.rekomendasi.map((r) => `<li>${esc(r)}</li>`).join("")}</ol>` : "";
    const daki = p.level === 0;
    lacak("Buka gunung", { gunung: p.nama || p.id, jenis: daki ? "pendakian" : `level ${p.level}` });
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:${L.warna};color:#1a1200">${icon("gunung")}</span>${judulGunung(p)}</h3>
      <div class="sub"><span class="lv" style="--c:${L.warna}">${daki ? "Gunung pendakian" : `Level ${L.rom} · ${L.nama}`}</span> ${esc(p.lokasi || where(p))}${p.elevasi ? ` · ${num(p.elevasi)} mdpl` : ""}</div>
      ${p.erupsi || p.vona ? `<div class="flags">${p.erupsi ? `<span>Erupsi tercatat di MAGMA</span>` : ""}${p.vona ? `<span>Peringatan abu penerbangan (VONA)</span>` : ""}</div>` : ""}
      ${daki ? `<div class="nm">Tidak termasuk gunung api yang dipantau PVMBG, jadi tidak ada status level aktivitas.</div>`
        : p.level >= 2 ? "" : `<div class="nm">Status Normal: tidak ada peningkatan aktivitas yang dilaporkan.</div>`}
      ${tabsHTML([
        { id: "k", ic: "gunung", label: "Kondisi", html: kondisiHTML(f),
          src: `Cuaca puncak: model Open-Meteo · titik panas: NASA FIRMS · gempa: BMKG${daki ? " · lokasi &amp; ketinggian: OpenStreetMap" : " · level: MAGMA Indonesia (PVMBG)"}` },
        lap ? { id: "l", label: "Laporan", html: `${p.periode ? `<div class="nm" style="margin-bottom:6px">${esc(p.periode)}</div>` : ""}${lap}`,
          src: `Sumber: MAGMA Indonesia (PVMBG, Badan Geologi)${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">laporan lengkap</a>` : ""}` } : null,
        rek ? { id: "r", label: "Rekomendasi", html: rek, src: "Sumber: PVMBG via MAGMA Indonesia" } : null,
        p.level >= 2 ? { id: "b", ic: "berita", label: "Berita", n: bl.length, html: newsHTML(bl, `Belum ada berita tentang Gunung ${p.nama} (3 hari terakhir).`) } : null,
        { id: "m", ic: "lapor", label: "Medsos", html: medsosHTML(p) },
      ], buka)}</div>`);
  }
  const judulGunung = (p) => (/^Puncak\b/.test(p.nama) ? esc(p.nama) : `Gunung ${esc(p.nama)}`);
  // ---------- kondisi gunung untuk pendaki / trail runner ----------
  const RADIUS_SEKITAR = 25; // km
  function kmAntara([lo1, la1], [lo2, la2]) {
    const r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r;
    const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2;
    return 12742 * Math.asin(Math.sqrt(a));
  }
  const CUACA = (c) => c === 0 ? "Cerah" : c <= 2 ? "Cerah berawan" : c === 3 ? "Berawan" : c <= 48 ? "Berkabut"
    : c <= 57 ? "Gerimis" : c <= 67 ? "Hujan" : c <= 77 ? "Salju/es" : c <= 82 ? "Hujan lokal" : c <= 86 ? "Hujan es" : "Badai petir";
  function kondisiHTML(f) {
    const p = f.properties, xy = f.geometry.coordinates, dekat = (g) => kmAntara(xy, g.geometry.coordinates) <= RADIUS_SEKITAR;
    const api = (state.data.titik_panas?.features || []).filter(dekat).length;
    const gempa = (state.data.gempa?.features || []).filter(dekat).length;
    setTimeout(() => isiCuaca(f), 0);
    return `<div class="sec-h" style="margin-top:0">Prakiraan cuaca di puncak${p.elevasi ? ` (±${num(p.elevasi)} mdpl)` : ""}</div>
      <div class="cuaca" data-cuaca="${esc(p.id)}"><div class="nm">Memuat prakiraan…</div></div>
      <div class="sec-h" style="margin-top:10px">Dalam radius ${RADIUS_SEKITAR} km</div>
      <div class="grid3">
        <div><b>${esc(LEVEL_GUNUNG[p.level]?.rom || "I")}</b><span>level gunung</span></div>
        <div><b>${num(api)}</b><span>titik panas 24 jam</span></div>
        <div><b>${num(gempa)}</b><span>gempa 7 hari</span></div></div>`;
  }
  async function isiCuaca(f) {
    const p = f.properties, [lng, lat] = f.geometry.coordinates;
    state.cuaca = state.cuaca || {};
    let c = state.cuaca[p.id];
    if (!c || Date.now() - c.t > 30 * 60000) {
      try {
        const u = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}${p.elevasi ? `&elevation=${p.elevasi}` : ""}`
          + "&daily=weather_code,temperature_2m_min,temperature_2m_max,wind_gusts_10m_max"
          + "&forecast_days=3&timezone=Asia%2FJakarta";
        const r = await fetch(u); if (!r.ok) throw new Error(r.status);
        c = state.cuaca[p.id] = { t: Date.now(), d: (await r.json()).daily };
      } catch { c = null; }
    }
    const el = document.querySelector(`.pop [data-cuaca="${CSS.escape(String(p.id))}"]`);
    if (!el) return;
    if (!c) { el.innerHTML = `<div class="nm">Prakiraan cuaca gagal dimuat. Coba buka lagi nanti.</div>`; return; }
    const d = c.d, hari = (i) => i === 0 ? "Hari ini" : i === 1 ? "Besok"
      : new Intl.DateTimeFormat(LOKAL, { weekday: "long", timeZone: "UTC" }).format(new Date(d.time[i]));
    el.innerHTML = d.time.map((_, i) => {
      const angin = Math.round(d.wind_gusts_10m_max[i]);
      return `<div class="cu-row"><span class="cu-hari">${hari(i)}</span>
        <span>${esc(CUACA(d.weather_code[i]))}<br><small>${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C</small></span>
        <span class="${angin >= 40 ? "cu-awas" : ""}">${angin} km/j<br><small>hembusan</small></span></div>`;
    }).join("");
  }

  // Medsos: tombol ke hashtag Instagram gunung (foto & video dari pengunjung). Dibuka di aplikasi/akun IG pengguna sendiri.
  function medsosHTML(p) {
    const dasar = p.nama.split(" (")[0], tag = (/^Puncak\b/.test(dasar) ? dasar : `gunung${dasar}`).toLowerCase().replace(/[^a-z0-9]/g, "");
    return `<div class="sec-h" style="margin-top:0">Foto &amp; Video Aktivitas Terbaru</div>
      <a class="ms-btn ms-ig" href="https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>
        Instagram</a>`;
  }

  // Medsos gempa: hashtag Instagram "#gempa<tempat>" agar pengunjung bisa melihat kondisi lokasi
  // dari unggahan warga. Hanya tautan keluar (dibuka di aplikasi/akun pengguna sendiri), tidak ada API/data yang diambil.
  // Arah di depan nama tempat, BMKG ("BaratDaya", "barat daya", "Tenggara") maupun USGS ("ENE of"), tanpa peduli huruf besar/kecil
  const ARAH_LOKASI = /^\d+(?:[.,]\d+)?\s*km\s+(?:(?:barat|timur)\s*(?:laut|daya)|utara|selatan|timur|barat|tenggara|[nsew]{1,3})(?:\s+of)?\s+/i;
  // Nama tempat dari teks lokasi gempa (null bila tak terurai):
  // "Pusat gempa berada di laut 49 km timur laut Ruteng, Manggarai" -> "Ruteng"; "130 km BaratDaya MALUKUTENGGARA" -> "Maluku Tenggara";
  // "114 km BaratDaya NIASBARAT-SUMUT" -> "Nias Barat"; "123 km ENE of Tobelo, Indonesia" -> "Tobelo"; "Banda Sea" -> "Banda Sea"
  function namaTempatLokasi(s) {
    const t = rapiLokasi(String(s || "").trim().replace(/^Pusat gempa berada di\s+(?:(?:laut|darat)\s+(?=\d))?/i, "")) || "";
    const nama = t.replace(ARAH_LOKASI, "").split(",")[0].trim();
    // sisa angka/"km" berarti format tak dikenal; "Indonesia" saja terlalu umum untuk pencarian
    if (!nama || /\d|\bkm\b/i.test(nama) || /^indonesia$/i.test(nama)) return null;
    return nama;
  }
  function tempatGempa(p) {
    const bersih = (s) => String(s || "").replace(/^(?:Kab\.\s*|(?:Kabupaten|Kota)\s+)/i, "").trim();
    if (p.kabupaten) return bersih(p.kabupaten);
    // nama tempat dari lokasi; bila tak terurai (atau lokasi kosong), pakai provinsi
    return bersih(namaTempatLokasi(p.lokasi)) || bersih(p.provinsi);
  }
  function medsosGempaHTML(p) {
    const tempat = tempatGempa(p);
    const tag = `gempa${tempat}`.toLowerCase().replace(/[^a-z0-9]/g, "");
    return `<div class="sec-h" style="margin-top:0">Foto &amp; Video Aktivitas Terbaru</div>
      <a class="ms-btn ms-ig" href="https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/" target="_blank" rel="noopener noreferrer">
        <svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r=".6"/></svg>
        Instagram</a>`;
  }

  function focusVolcano(f, buka) {
    if (!state.mapReady) return;
    closeSheet(); clearRings();
    const [lng, lat] = f.geometry.coordinates;
    const down = isMobile() ? 0 : Math.round(window.innerHeight * 0.22);
    terbangKe([lng, lat], Math.max(map.getZoom(), 9), down, { speed: 1.4, ...(REDUCED ? { duration: 0 } : {}) });
    setTimeout(() => showVolcano(f, { lng, lat }, buka), 0);
  }

  // ---------- wilayah ----------
  function regionStats(id) {
    const c = (x) => x.features.filter((f) => f.properties.wilayah_id === id).length;
    return { api: c(state.data.titik_panas), gempa: c(state.data.gempa), lapor: c(state.data.laporan) };
  }
  function showRegionPopup(p, lngLat) {
    ringkasWilayah({ ids: new Set([p.id]), judul: p.nama, sub: p.provinsi }, lngLat);
  }

  // Semua kejadian di sekumpulan kabupaten/kota (satu kab/kota, atau satu provinsi)
  function kejadianDi(ids) {
    const d = state.data, di = (f) => ids.has(f.properties.wilayah_id);
    return {
      gempa: d.gempa.features.filter(di),
      api: d.titik_panas.features.filter(di),
      waspada: d.peringatan.features.filter((f) => (f.properties.wilayah_ids || []).some((x) => ids.has(x))),
      bnpb: d.banjir_bnpb.features.filter(di),
      gunung: (d.gunung_api?.features || []).filter(di),
      lapor: d.laporan.features.filter(di),
    };
  }
  const jumlahKejadian = (k) => k.gempa.length + (k.api.length ? 1 : 0) + k.waspada.length + k.bnpb.length
    + k.gunung.filter((f) => f.properties.level >= 2).length + k.lapor.length;

  function ringkasWilayah(w, lngLat) {
    const k = kejadianDi(w.ids), aksi = [];
    const baris = (c, ic, judul, sub, go) => {
      aksi.push(go);
      return `<button class="ev" data-a="${aksi.length - 1}"><span class="ev-ic" style="--c:${c}">${ic}</span>
        <span class="ev-t"><b>${esc(judul)}</b><span>${esc(sub)}</span></span></button>`;
    };
    const rows = [];
    for (const f of k.waspada) {
      const p = f.properties;
      rows.push(baris(WARNA_WASPADA, icon("banjir"), "Waspada hujan lebat (BMKG)", `hingga ${jamWIB(p.berakhir)} · ${sisa(p.berakhir)}`, () => focusWarning(f)));
    }
    for (const f of k.gunung.filter((x) => x.properties.level >= 2)) {
      const p = f.properties, L = LEVEL_GUNUNG[p.level];
      rows.push(baris(L.warna, icon("gunung"), `Gunung ${p.nama} · ${L.nama}`, `Level ${L.rom} · MAGMA Indonesia`, () => focusVolcano(f)));
    }
    for (const f of k.bnpb) {
      const p = f.properties;
      rows.push(baris(WARNA_BNPB, icon("banjir"), `Banjir · ${p.kabupaten || p.kabupaten_bnpb}`,
        `${tglID(p.tanggal)} · data resmi BNPB${p.rumah_terendam ? ` · ${num(p.rumah_terendam)} rumah terendam` : ""}`,
        () => focusBnpb(p.wilayah_id, f)));
    }
    for (const f of [...k.gempa].sort((a, b) => b.properties.waktu.localeCompare(a.properties.waktu))) {
      const p = f.properties;
      rows.push(baris("#ff4d4f", icon("gempa"), `Gempa M${p.magnitudo}`, `${ago(p.waktu)} · ${p.lokasi || where(p)}`, () => focusFeature("gempa", f)));
    }
    if (k.api.length) {
      const per = new Set(k.api.map((f) => f.properties.wilayah_id));
      rows.push(baris("#ff6a1a", icon("api"), `${num(k.api.length)} titik panas (24 jam)`,
        per.size > 1 ? `di ${num(per.size)} kabupaten/kota` : (k.api[0].properties.kabupaten || ""), () => {
          if (per.size === 1) return focusRegion([...per][0]);
          const pts = k.api.map((f) => f.geometry.coordinates);
          map.fitBounds(boundsOf(pts), { padding: viewPadding(), maxZoom: 9.5, duration: REDUCED ? 0 : 1000 });
        }));
    }
    for (const f of k.lapor) {
      const p = f.properties;
      rows.push(baris(jWarna(p.jenis), jIcon(p.jenis), `Laporan ${p.jenis}`, `${ago(p.waktu)} · ${p.kabupaten || ""}`, () => focusFeature("laporan", f)));
    }
    // berita dari semua kejadian di wilayah ini
    const seen = new Set();
    const news = [
      ...k.lapor.flatMap((f) => state.berita[f.properties.id]?.berita || []),
      ...[...new Set(k.api.map((f) => f.properties.wilayah_id))].flatMap((id) => beritaApi(id)),
      ...k.gempa.flatMap((f) => beritaGempa(f.properties)),
      ...k.gunung.flatMap((f) => beritaGunung(f.properties)),
      ...k.bnpb.flatMap((f) => beritaBnpb(f.properties.id)),
      ...[...new Set(k.waspada.map((f) => f.properties.provinsi))].flatMap((p) => beritaBmkg(p)),
    ].filter((b) => !seen.has(b.judul) && seen.add(b.judul))
      .sort((a, b) => b.terbit.localeCompare(a.terbit)).slice(0, 10);
    const stat = (n, label) => `<div${n ? "" : ' class="nol"'}><b>${num(n)}</b><span>${label}</span></div>`;
    popupAt(lngLat, `<div class="pop"><h3>${esc(w.judul)}</h3><div class="sub">${esc(w.sub || "")}</div>
      <div class="grid5">${stat(k.gempa.length, "gempa<br>7 hari")}${stat(k.api.length, "titik panas<br>24 jam")}
        ${stat(k.waspada.length + k.bnpb.length, "banjir<br>aktif")}${stat(k.gunung.filter((f) => f.properties.level >= 2).length, "gunung<br>waspada")}
        ${stat(k.lapor.length, "laporan<br>7 hari")}</div>
      ${tabsHTML([
        rows.length ? { id: "k", label: "Kejadian", n: rows.length, html: `<div class="evs">${rows.join("")}</div>` } : null,
        { id: "b", ic: "berita", label: "Berita", n: news.length, html: newsHTML(news, `Belum ada berita kejadian di ${w.judul}.`) },
      ], w.buka && rows.length ? "k" : undefined)}
      ${rows.length ? "" : `<div class="nm" style="margin-top:8px">Tidak ada kejadian yang tercatat di wilayah ini saat ini.</div>`}</div>`,
      () => sorotWilayah(null));
    state.popup.getElement().querySelectorAll(".ev").forEach((b) => b.addEventListener("click", () => aksi[+b.dataset.a]()));
    sorotWilayah(w.ids);
  }
  // Garis tepi wilayah yang sedang dilihat
  function sorotWilayah(ids) {
    state.sorot = ids ? [...ids] : null;
    if (!state.mapReady || !map.getLayer("sorot-line")) return;
    map.setFilter("sorot-line", ["in", ["get", "id"], ["literal", state.sorot || []]]);
  }

  // ---------- pencarian kabupaten/kota & provinsi ----------
  const normCari = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/\b(kab\.?|kabupaten|kota adm\.?|kota|provinsi|prov\.?)\s+/g, "").replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim();
  async function indeksWilayah() {
    if (state.indeks) return state.indeks;
    const geo = await fetch(`${DATA}wilayah.geojson`).then((r) => r.json());
    const kab = [], prov = new Map();
    for (const f of geo.features) {
      const p = f.properties, g = f.geometry;
      // "Kab. Danau" di data batas = kumpulan danau dari Sumatra s.d. Sulawesi (bukan kabupaten); kalau ikut,
      // mencarinya (dan provinsi Sumatera Selatan) membuat peta memperkecil ke separuh Indonesia
      if (p.nama === "Kab. Danau") continue;
      const polys = g.type === "Polygon" ? [g.coordinates] : g.coordinates;
      let b = [180, 90, -180, -90];
      for (const poly of polys) for (const [x, y] of poly[0]) b = [Math.min(b[0], x), Math.min(b[1], y), Math.max(b[2], x), Math.max(b[3], y)];
      const tipe = /^Kota\b/.test(p.nama) ? "kota" : "kab";
      kab.push({ tipe, id: p.id, nama: p.nama, provinsi: p.provinsi, n: normCari(p.nama), b });
      const pv = prov.get(p.provinsi) || { tipe: "prov", nama: p.provinsi, n: normCari(p.provinsi), ids: [], b: [180, 90, -180, -90] };
      pv.ids.push(p.id);
      pv.b = [Math.min(pv.b[0], b[0]), Math.min(pv.b[1], b[1]), Math.max(pv.b[2], b[2]), Math.max(pv.b[3], b[3])];
      prov.set(p.provinsi, pv);
    }
    state.indeks = [...prov.values(), ...kab];
    return state.indeks;
  }
  // Gunung (MAGMA + pendakian) ikut dicari; awalan "gunung/gn/mount" di nama & kata kunci diabaikan
  const normGunung = (s) => normCari(s).replace(/^(gunung|gn|g|mount|mt)\s+/, "").replace(/\s*\(.*$/, "");
  function indeksGunung() {
    const fs = state.data.gunung_api?.features || [];
    if (state.indeksGunung?.src === fs) return state.indeksGunung.list;
    const list = fs.map((f) => ({ tipe: "gunung", f, nama: f.properties.nama,
      n: normCari(f.properties.nama.replace(/[()]/g, " ")) }));
    state.indeksGunung = { src: fs, list };
    return list;
  }
  function cariWilayah(q) {
    const raw = q.toLowerCase(), mauGunung = /\b(gunung|gn|mount|mt)\b/.test(raw);
    const n = mauGunung ? normGunung(q) : normCari(q);
    if (!n) return [];
    const mau = mauGunung ? "gunung" : /\bkota\b/.test(raw) ? "kota" : /\bkab/.test(raw) ? "kab" : /\bprov/.test(raw) ? "prov" : null;
    const hasil = [];
    for (const e of [...state.indeks, ...indeksGunung()]) {
      let s = e.n === n ? 100 : e.n.startsWith(n) ? 80 : e.n.split(" ").some((w) => w.startsWith(n)) ? 60 : e.n.includes(n) ? 40 : 0;
      if (!s) continue;
      if (mau && e.tipe === mau) s += 15;
      if (e.tipe === "prov") s += 3;
      hasil.push([s, e]);
    }
    return hasil.sort((a, b) => b[0] - a[0] || a[1].nama.length - b[1].nama.length).slice(0, 8).map((x) => x[1]);
  }
  function pilihWilayah(e) {
    tutupCari();
    lacak("Cari", { tipe: e.tipe, hasil: e.nama || (e.f && e.f.properties.nama) || "" });
    if (e.tipe === "tempat") return pilihTempat(e);
    if (e.tipe === "gunung") {   // langsung terbang ke gunung & buka tab Kondisi
      if (state.mode && state.mode !== "gunung_api") setMode(null);
      return focusVolcano(e.f, "k");
    }
    if (state.mode) setMode(null);
    const ids = new Set(e.tipe === "prov" ? e.ids : [e.id]);
    const bb = [[e.b[0], e.b[1]], [e.b[2], e.b[3]]];
    clearRings();
    map.fitBounds(bb, { padding: viewPadding(), maxZoom: e.tipe === "prov" ? 9 : 13, duration: REDUCED ? 0 : 1100 });
    const tengah = { lng: (e.b[0] + e.b[2]) / 2, lat: (e.b[1] + e.b[3]) / 2 };
    const sub = e.tipe === "prov" ? `Provinsi · ${num(e.ids.length)} kabupaten/kota` : `${e.tipe === "kota" ? "Kota" : "Kabupaten"} · ${e.provinsi}`;
    map.once("moveend", () => ringkasWilayah({ ids, judul: e.nama, sub, buka: true }, tengah));
  }
  function renderHasilCari() {
    const box = $("#cari-hasil"), q = $("#cari-input").value;
    if (!state.indeks) { box.innerHTML = `<div class="cari-kosong">Memuat daftar wilayah…</div>`; return; }
    if (!q.trim()) { state.cariHasil = []; box.innerHTML = `<div class="cari-kosong">Contoh: Bandung, Jawa Timur, Bromo, GBK, Kartini</div>`; return; }
    const hasil = cariWilayah(q);
    const tempat = q.trim().length < 3 ? [] : CT.cache.get(kunciTempat(q));   // undefined = sedang dicari
    if (tempat === undefined) jadwalCariTempat(q);
    const semua = [...hasil, ...(tempat || [])];
    state.cariHasil = semua; state.cariAktif = 0;
    if (!semua.length) {
      box.innerHTML = `<div class="cari-kosong">${tempat === undefined ? "Mencari…" : `"${esc(q)}" tidak ditemukan.`}</div>`;
      return;
    }
    let i = 0;
    box.innerHTML = hasil.map((e) => {
      const sel = i === 0, k = i++;
      if (e.tipe === "gunung") {
        const p = e.f.properties, L = LEVEL_GUNUNG[p.level] || LEVEL_GUNUNG[1];
        const jenis = `${p.level === 0 ? "Gunung pendakian" : "Gunung api"} · ${p.lokasi || where(p)}`;
        return `<button class="cari-item" role="option" data-i="${k}" aria-selected="${sel}">
          <span class="ci-t"><b>${judulGunung(p)}</b><span>${esc(jenis)}</span></span>
          <span class="ci-n ci-lv" style="--c:${L.warna}">${p.level === 0 ? `${num(p.elevasi || 0)} mdpl` : `Level ${L.rom}`}</span></button>`;
      }
      const n = state.data.gempa ? jumlahKejadian(kejadianDi(new Set(e.tipe === "prov" ? e.ids : [e.id]))) : 0;
      const jenis = e.tipe === "prov" ? "Provinsi" : `${e.tipe === "kota" ? "Kota" : "Kabupaten"} · ${e.provinsi}`;
      return `<button class="cari-item" role="option" data-i="${k}" aria-selected="${sel}">
        <span class="ci-t"><b>${esc(e.nama)}</b><span>${esc(jenis)}</span></span>
        <span class="ci-n${n ? " ada" : ""}">${num(n)} kejadian</span></button>`;
    }).join("") + (tempat === undefined ? `<div class="cari-sub">Mencari tempat…</div>`
      : tempat.length ? `<div class="cari-sub">Tempat · OpenStreetMap</div>` + tempat.map((e) => {
        const sel = i === 0, k = i++;
        return `<button class="cari-item" role="option" data-i="${k}" aria-selected="${sel}">
          <span class="ci-t"><b>${esc(e.nama)}</b><span>${esc([e.jenis, e.alamat].filter(Boolean).join(" · "))}</span></span>
          <span class="ci-n">${icon("pin")}</span></button>`;
      }).join("") : "");
    box.querySelectorAll(".cari-item").forEach((b) => b.addEventListener("click", () => pilihWilayah(semua[+b.dataset.i])));
  }

  // ---------- pencarian tempat: kelurahan, kecamatan, tempat terkenal (GBK, Monas…) ----------
  // Photon (komoot) = mesin cari berbasis OpenStreetMap, gratis & memang dibuat untuk kotak cari "sambil mengetik".
  // Dipanggil hemat: minimal 3 huruf, jeda 350 ms setelah berhenti mengetik, hasil disimpan per kata kunci.
  const PHOTON = "https://photon.komoot.io/api/";
  const CT = { cache: new Map(), t: 0, ctrl: null };
  const kunciTempat = (q) => q.trim().toLowerCase().replace(/\s+/g, " ");
  const JENIS_TEMPAT = {
    village: "Desa/kelurahan", suburb: "Kelurahan", neighbourhood: "Lingkungan", quarter: "Kawasan", hamlet: "Dusun",
    town: "Kota kecil", city: "Kota", municipality: "Kecamatan", district: "Kecamatan", county: "Kabupaten",
    island: "Pulau", islet: "Pulau", stadium: "Stadion", sports_centre: "Pusat olahraga", recreation_ground: "Kawasan olahraga",
    park: "Taman", garden: "Taman", attraction: "Tempat wisata", museum: "Museum", monument: "Monumen", memorial: "Monumen",
    viewpoint: "Tempat wisata", zoo: "Kebun binatang", theme_park: "Taman hiburan", beach: "Pantai", peak: "Puncak",
    volcano: "Gunung", station: "Stasiun", halt: "Stasiun", aerodrome: "Bandara", university: "Kampus", college: "Kampus",
    hospital: "Rumah sakit", mall: "Mal", marketplace: "Pasar", place_of_worship: "Tempat ibadah", golf_course: "Lapangan golf",
    bay: "Teluk", lake: "Danau", water: "Danau", waterfall: "Air terjun", administrative: "Wilayah", castle: "Bangunan bersejarah",
  };
  // Buang hasil yang jarang dicari orang di peta bencana: halte, toko, rumah makan, dsb.
  function tempatBerguna(p) {
    const k = p.osm_key, v = p.osm_value;
    // provinsi/kabupaten/kota sudah ada di daftar wilayah kita sendiri → jangan dobel
    if (k === "boundary" || (k === "place" && ["country", "state", "province", "region", "county", "city"].includes(v))) return false;
    if (k === "tourism" && ["hotel", "guest_house", "hostel", "motel", "apartment", "chalet", "information"].includes(v)) return false;
    if (["place", "leisure", "tourism", "historic", "natural", "aeroway"].includes(k)) return v !== "yes" || k === "historic";
    if (k === "railway") return v === "station" || v === "halt";
    if (k === "amenity") return ["university", "college", "hospital", "marketplace", "place_of_worship"].includes(v);
    if (k === "landuse") return v === "recreation_ground";
    if (k === "shop") return v === "mall";
    if (k === "highway") return p.type === "street" && !["bus_stop", "platform", "bus_station"].includes(v);
    return false;
  }
  function jadwalCariTempat(q) {
    clearTimeout(CT.t);
    CT.t = setTimeout(async () => {
      const kunci = kunciTempat(q);
      if (CT.cache.has(kunci)) return;
      CT.ctrl?.abort();
      const ctrl = CT.ctrl = new AbortController();
      let hasil = [];
      try {
        const c = map.getCenter();
        const u = `${PHOTON}?q=${encodeURIComponent(q.trim())}&limit=15&lang=default&bbox=94.5,-11.5,141.5,6.5`
          + `&lat=${c.lat.toFixed(3)}&lon=${c.lng.toFixed(3)}&zoom=${Math.max(5, Math.round(map.getZoom()))}`;
        const d = await fetch(u, { signal: ctrl.signal }).then((r) => (r.ok ? r.json() : { features: [] }));
        const lihat = new Set();
        for (const f of d.features || []) {
          const p = f.properties || {};
          if (!p.name || !tempatBerguna(p)) continue;
          const alamat = [p.district || p.locality, p.city || p.county, p.state].filter((x, i, a) => x && x !== p.name && a.indexOf(x) === i).join(", ");
          const kunciSama = `${p.name.toLowerCase()}|${alamat.toLowerCase()}`;
          if (lihat.has(kunciSama)) continue;
          lihat.add(kunciSama);
          hasil.push({ tipe: "tempat", nama: p.name, alamat, c: f.geometry.coordinates, ext: p.extent || null,
            jenis: p.osm_key === "highway" ? "Jalan" : JENIS_TEMPAT[p.osm_value] || "Tempat" });
          if (hasil.length >= 6) break;
        }
      } catch (e) {
        if (e.name === "AbortError") return;
        hasil = [];
      }
      CT.cache.set(kunci, hasil);
      if (!$("#cari").hidden && kunciTempat($("#cari-input").value) === kunci) renderHasilCari();
    }, 350);
  }
  function pilihTempat(e) {
    if (state.mode) setMode(null);
    clearRings();
    const [lng, lat] = e.c, durasi = REDUCED ? 0 : 1100;
    if (e.ext) map.fitBounds([[e.ext[0], e.ext[3]], [e.ext[2], e.ext[1]]], { padding: viewPadding(), maxZoom: 16, duration: durasi });
    else terbangKe([lng, lat], 15, 0, REDUCED ? { duration: 0 } : {});
    map.once("moveend", () => showTempatPopup(e));
  }
  async function showTempatPopup(e) {
    const [lng, lat] = e.c;
    popupAt({ lng, lat }, `<div class="pop"><h3><span class="hi" style="--c:#3ea6ff">${icon("pin")}</span>${esc(e.nama)}</h3>
      <div class="sub">${esc([e.jenis, e.alamat].filter(Boolean).join(" · "))}</div>
      <div data-ringkas-tempat></div>
      <div class="src">Lokasi: OpenStreetMap (pencarian Photon)</div></div>`);
    try {
      const w = wilayahTitik(await petaWilayah(), lng, lat);
      const el = document.querySelector(".pop [data-ringkas-tempat]");
      if (!w.wilayah_id || !el) return;
      el.innerHTML = `<button type="button" class="lnk">Kejadian di ${esc(w.kabupaten)} ›</button>`;
      el.querySelector("button").addEventListener("click", () => {
        const sub = `${/^Kota\b/.test(w.kabupaten) ? "Kota" : "Kabupaten"} · ${w.provinsi}`;
        ringkasWilayah({ ids: new Set([w.wilayah_id]), judul: w.kabupaten, sub, buka: true }, { lng, lat });
      });
    } catch { /* ringkasan wilayah opsional */ }
  }
  function bukaCari() {
    $("#cari").hidden = false;
    $("#cari-btn").setAttribute("aria-expanded", "true");
    const inp = $("#cari-input");
    inp.focus(); inp.select();
    renderHasilCari();
    indeksWilayah().then(renderHasilCari).catch(() => { $("#cari-hasil").innerHTML = `<div class="cari-kosong">Daftar wilayah gagal dimuat.</div>`; });
  }
  function tutupCari() {
    $("#cari").hidden = true;
    $("#cari-btn").setAttribute("aria-expanded", "false");
  }
  function wireCari() {
    $("#cari-btn").addEventListener("click", () => ($("#cari").hidden ? bukaCari() : tutupCari()));
    $("#cari-tutup").addEventListener("click", tutupCari);
    const inp = $("#cari-input");
    inp.addEventListener("input", renderHasilCari);
    inp.addEventListener("keydown", (e) => {
      const n = state.cariHasil?.length || 0;
      if (e.key === "Escape") { e.stopPropagation(); tutupCari(); return; }
      if (!n) return;
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        state.cariAktif = (state.cariAktif + (e.key === "ArrowDown" ? 1 : n - 1)) % n;
        document.querySelectorAll(".cari-item").forEach((b, i) => b.setAttribute("aria-selected", String(i === state.cariAktif)));
      } else if (e.key === "Enter") { e.preventDefault(); pilihWilayah(state.cariHasil[state.cariAktif]); }
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement?.tagName !== "INPUT") { e.preventDefault(); bukaCari(); }
    });
  }

  // flyTo TANPA opsi `padding`: di MapLibre padding dari flyTo/easeTo tersimpan permanen di kamera dan
  // menumpuk dengan padding fitBounds berikutnya sampai kamera rusak (NaN). Ruang UI dihitung sebagai offset.
  function terbangKe(center, zoom, turun = 0, opsi = {}) {
    const p = viewPadding();
    map.flyTo({ center, zoom, offset: [(p.left - p.right) / 2, (p.top - p.bottom) / 2 + turun], ...opsi });
  }

  function focusFeature(layer, f) {
    if (!state.mapReady) return;
    closeSheet();
    if (layer === "gempa") return showQuake(f, true);
    const [lng, lat] = f.geometry.coordinates;
    clearRings();
    // Taruh titik agak ke bawah agar popup (yang cukup tinggi karena berita) muat di atasnya.
    const down = isMobile() ? 0 : Math.round(window.innerHeight * 0.22);
    terbangKe([lng, lat], Math.max(map.getZoom(), 10), down, { speed: 1.4, ...(REDUCED ? { duration: 0 } : {}) });
    setTimeout(() => showPopup(layer, f, { lng, lat }, isMobile() ? undefined : "bottom"), 0);
  }

  function focusRegion(id) {
    if (!state.mapReady) return;
    closeSheet();
    const hot = state.data.titik_panas.features.filter((x) => x.properties.wilayah_id === id);
    if (!hot.length) return;
    const pts = hot.map((x) => x.geometry.coordinates);
    const b = pts.reduce((bb, c) => bb.extend(c), new maplibregl.LngLatBounds(pts[0], pts[0]));
    const f = map.querySourceFeatures("wilayah").find((x) => x.id === id);
    const props = f ? f.properties : { id, nama: hot[0].properties.kabupaten, provinsi: hot[0].properties.provinsi };
    map.fitBounds(b, { padding: viewPadding(), maxZoom: 9.5, duration: REDUCED ? 0 : 1000 });
    setTimeout(() => showRegionPopup(props, b.getCenter()), 0);
  }

  $("#dock").addEventListener("animationend", () => updateCtrl());   // hitung ulang setelah dock selesai masuk
  function closeSheet() {
    $("#panel").classList.remove("open");
    $("#grip").setAttribute("aria-expanded", "false");
    updateCtrl();
  }

  // Tombol zoom selalu di atas dock/panel bawah; tinggi dock dipakai panel HP.
  function updateCtrl() {
    const set = () => {
      const dock = $("#dock"), panel = $("#panel"), H = window.innerHeight;
      // tinggi dock dari ukuran aslinya (bukan posisi di layar): tidak terpengaruh animasi masuk dock
      // (dulu tombol "Daftar …" bisa menumpuk ke dock bila dihitung saat dock masih bergeser turun)
      const dockH = (parseFloat(getComputedStyle(dock).bottom) || 0) + dock.offsetHeight;
      document.documentElement.style.setProperty("--dock-h", `${Math.round(dockH + 8)}px`);
      let topMost = dock.getBoundingClientRect().top;
      if (isMobile() && !panel.hidden) topMost = Math.min(topMost, panel.getBoundingClientRect().top);
      const show = $("#show-list");
      if (isMobile() && !show.hidden) topMost = Math.min(topMost, show.getBoundingClientRect().top);
      const overlap = isMobile() || dock.getBoundingClientRect().right > window.innerWidth - 70;
      document.documentElement.style.setProperty("--ctrl-bottom", overlap ? `${H - topMost + 6}px` : "0px");
    };
    set();
    setTimeout(set, 350);
  }
  window.addEventListener("resize", updateCtrl);

  // HP: geser lembar daftar ke bawah = tutup (atau kecilkan bila sedang dibesarkan), ke atas = besarkan.
  // Gestur dimulai dari kepala panel / pegangan, atau dari daftar yang sudah di posisi paling atas.
  function wireSwipe() {
    // Pointer events: berlaku untuk jari (HP) maupun mouse (mode HP di browser desktop).
    const panel = $("#panel");
    let y0 = null, dy = 0, fromList = false, pid = null, moved = false;
    panel.addEventListener("pointerdown", (e) => {
      if (!isMobile() || (e.pointerType === "mouse" && e.button !== 0)) return;
      const list = $("#list");
      fromList = list.contains(e.target);
      // Seluruh bagian panel di luar daftar = pegangan; dari daftar hanya jari & saat daftar di paling atas
      if (fromList && !(e.pointerType === "touch" && list.scrollTop <= 0)) return;
      y0 = e.clientY; dy = 0; pid = e.pointerId; moved = false;
      panel.classList.add("dragging");
    });
    panel.addEventListener("pointermove", (e) => {
      if (y0 == null || e.pointerId !== pid) return;
      dy = e.clientY - y0;
      if (!moved && Math.abs(dy) > 6) {
        moved = true;
        // tangkap pointer baru setelah benar-benar menggeser (klik biasa pada tombol tetap jalan)
        if (!fromList) { try { panel.setPointerCapture(pid); } catch (_) { /* abaikan */ } }
        window.getSelection()?.removeAllRanges();
      }
      if (fromList && dy < 0) { cancel(); return; }
      panel.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
    });
    const cancel = () => { y0 = null; panel.style.transform = ""; panel.classList.remove("dragging"); };
    const end = (e) => {
      if (y0 == null || (e && e.pointerId !== pid)) return;
      const d = dy, fl = fromList;
      cancel();
      if (d > 60) {
        if (panel.classList.contains("open")) { panel.classList.remove("open"); updateCtrl(); }
        else setListHidden(true);
      } else if (d < -40 && !fl) {
        panel.classList.add("open"); updateCtrl();
      }
    };
    panel.addEventListener("pointerup", end);
    panel.addEventListener("pointercancel", () => cancel());
    // klik pada pegangan setelah menggeser jangan ikut membuka/menutup
    $("#grip").addEventListener("click", (e) => { if (moved) { e.stopImmediatePropagation(); moved = false; } }, true);

    // geser tombol "Daftar" ke atas = buka lagi (klik biasa juga membuka)
    const show = $("#show-list");
    let sy = null;
    show.addEventListener("pointerdown", (e) => { sy = e.clientY; });
    show.addEventListener("pointerup", (e) => {
      if (sy != null && e.clientY - sy < -30) setListHidden(false);
      sy = null;
    });
  }

  // Panel & tombol "Daftar" selalu di bawah kotak brand (yang memanjang saat info (i) dibuka)
  function updateTopUI() {
    const b = $("#brand").getBoundingClientRect().bottom;
    document.documentElement.style.setProperty("--top-ui", `${Math.round(b + 12)}px`);
    // batas atas lembar daftar di HP saat dibesarkan = bawah ticker (atau brand bila ticker tersembunyi)
    const tk = $("#ticker");
    const atas = tk && !tk.hidden ? tk.getBoundingClientRect().bottom : b;
    document.documentElement.style.setProperty("--tk-bottom", `${Math.round(atas + 8)}px`);
  }
  window.addEventListener("resize", updateTopUI);
  new ResizeObserver(updateTopUI).observe($("#brand"));
  $("#brand").addEventListener("animationend", updateTopUI);

  // ---------- panduan singkat (tur) untuk pengunjung baru & fitur baru ----------
  // Tiap langkah punya `id` tetap. Browser mengingat id yang sudah dilihat (localStorage "wui-panduan").
  // Pengunjung baru: semua langkah. Pengunjung lama: hanya langkah yang belum pernah dilihat (= fitur baru),
  // diberi label BARU. Cara menambah fitur baru: tambahkan satu objek di PANDUAN dengan id baru.
  const PANDUAN = [
    { id: "sambut", judul: "Selamat datang di What'sUpIndonesia",
      teks: "Kejadian di Indonesia dalam satu peta. Ikuti panduan singkat ini, kurang dari 1 menit." },
    { id: "ticker", el: () => $("#ticker"), judul: "Kabar terbaru",
      teks: "Kabar penting berganti tiap beberapa detik. Ketuk untuk langsung melihatnya di peta." },
    { id: "dock", el: () => $("#dock"), judul: "Lapisan kejadian",
      teks: "Pilih Gempa, Titik panas, Banjir, atau Gunung untuk melihat daftar dan lokasinya. Ketuk titik di peta untuk detail, berita, dan sumber datanya." },
    { id: "cari", el: () => $("#cari-btn"), judul: "Cari daerah & tempat",
      teks: "Cari provinsi, kota, kelurahan, atau nama tempat. Peta langsung menuju ke sana." },
    { id: "lapisan-cuaca", el: () => [$("#angin-btn"), $("#udara-btn")], judul: "Angin & kualitas udara",
      teks: "Nyalakan animasi arah angin atau peta kualitas udara. Saat aktif, ketuk titik mana pun di peta untuk melihat detailnya." },
    { id: "sembunyi", el: () => $("#sembunyi-btn"), judul: "Layer",
      teks: "Untuk menyembunyikan semua titik kejadian." },
    { id: "wilayah", judul: "Ringkasan per daerah", el: () => document.querySelector(".maplibregl-popup"),
      teks: "Ketuk kabupaten atau kota mana pun di peta untuk melihat ringkasan kejadian dan berita di daerah itu, seperti contoh Kota Jakarta Pusat ini.",
      masuk: contohWilayahMasuk, keluar: contohWilayahKeluar },
    { id: "setelan", el: () => $("#setelan-btn"), judul: "Pengaturan",
      teks: "Ganti tema terang/gelap, pasang situs ini di HP, dan lihat sumber data. Panduan ini bisa diputar lagi dari sini." },
    { id: "segar", el: () => $("#segar-btn"), judul: "Muat ulang",
      teks: "Ambil data dan versi situs terbaru kapan saja." },
  ];
  const TUR = { antre: [], i: 0, baru: false, root: null, aktif: null, kamera: null };
  // Langkah dasar (sudah ada sebelum panduan dibuat). Pengunjung lama tanpa catatan panduan dianggap sudah tahu ini,
  // jadi mereka hanya melihat langkah fitur yang lebih baru (Cari tempat, Layer, dst.).
  const PANDUAN_DASAR = ["sambut", "ticker", "dock", "lapisan-cuaca", "wilayah", "setelan", "segar"];
  async function contohWilayahMasuk() {
    TUR.kamera = { center: map.getCenter(), zoom: map.getZoom() };
    const e = (await indeksWilayah()).find((x) => x.nama === "Kota Jakarta Pusat");
    if (!e || TUR.aktif?.id !== "wilayah") return;
    await new Promise((selesai) => {
      map.once("moveend", selesai); setTimeout(selesai, 2500);
      map.fitBounds([[e.b[0], e.b[1]], [e.b[2], e.b[3]]], { padding: viewPadding(), maxZoom: 12, duration: REDUCED ? 0 : 1200 });
    });
    if (TUR.aktif?.id !== "wilayah") return;   // pengguna sudah pindah langkah saat peta terbang
    ringkasWilayah({ ids: new Set([e.id]), judul: e.nama, sub: `Kota · ${e.provinsi}`, buka: true },
      { lng: (e.b[0] + e.b[2]) / 2, lat: (e.b[1] + e.b[3]) / 2 });
    [80, 400, 900].forEach((ms) => setTimeout(posisiPanduan, ms));   // popup menyesuaikan posisi peta sebentar
  }
  function contohWilayahKeluar() {
    if (state.popup) state.popup.remove();
    sorotWilayah(null);
    if (TUR.kamera) { map.easeTo({ ...TUR.kamera, duration: REDUCED ? 0 : 800 }); TUR.kamera = null; }
  }
  function panduanDilihat() {
    try { return new Set(JSON.parse(baca("wui-panduan") || "[]")); } catch { return new Set(); }
  }
  function tandaiPanduan(ids) {
    const s = panduanDilihat();
    ids.forEach((id) => s.add(id));
    simpan("wui-panduan", JSON.stringify([...s]));
  }
  const tampakSatu = (el) => !!el && el.getClientRects().length > 0 && el.getBoundingClientRect().width > 0 && !el.closest("[hidden]");
  const tampakEl = (el) => (Array.isArray(el) ? el.length > 0 && el.every(tampakSatu) : tampakSatu(el));
  function kotakEl(el) {   // satu elemen, atau gabungan kotak beberapa elemen
    if (!Array.isArray(el)) return el.getBoundingClientRect();
    const k = el.map((e) => e.getBoundingClientRect());
    const left = Math.min(...k.map((b) => b.left)), top = Math.min(...k.map((b) => b.top));
    const right = Math.max(...k.map((b) => b.right)), bottom = Math.max(...k.map((b) => b.bottom));
    return { left, top, right, bottom, width: right - left, height: bottom - top };
  }
  // semua = putar ulang dari Pengaturan (semua langkah)
  function mulaiPanduan(semua) {
    if (TUR.root) return;
    const dilihat = panduanDilihat();
    TUR.baru = !semua && dilihat.size > 0;   // pengunjung lama → hanya fitur baru
    TUR.antre = PANDUAN.filter((l) => semua || !dilihat.has(l.id)).filter((l) => !TUR.baru || l.id !== "sambut");
    if (!TUR.antre.length) return;
    if (state.popup) state.popup.remove();
    tutupCari();
    if (panelTerbuka()) bukaSetelan(false);
    const d = document.createElement("div");
    d.className = "tur"; d.setAttribute("role", "dialog"); d.setAttribute("aria-modal", "true"); d.setAttribute("aria-labelledby", "tur-judul");
    d.innerHTML = `<div class="tur-sorot"></div>
      <div class="tur-kartu"><div class="tur-atas"><span class="tur-no"></span><span class="tur-baru">BARU</span></div>
        <h3 id="tur-judul"></h3><p class="tur-teks"></p>
        <div class="tur-aksi"><button type="button" class="tur-lewati">Lewati</button><span class="tur-isi"></span>
          <button type="button" class="tur-kembali">Kembali</button><button type="button" class="tur-lanjut">Lanjut</button></div></div>`;
    document.body.appendChild(d);
    TUR.root = d; TUR.i = 0;
    d.querySelector(".tur-lewati").addEventListener("click", () => tutupPanduan("lewati"));
    d.querySelector(".tur-kembali").addEventListener("click", () => langkahPanduan(TUR.i - 1, -1));
    d.querySelector(".tur-lanjut").addEventListener("click", () => {
      if (TUR.i >= TUR.antre.length - 1) tutupPanduan("selesai"); else langkahPanduan(TUR.i + 1, 1);
    });
    document.addEventListener("keydown", tombolPanduan, true);
    window.addEventListener("resize", posisiPanduan);
    map.on("move", posisiPanduan);   // sorotan ikut bergeser saat peta bergerak (peragaan)
    langkahPanduan(0, 1);
    d.querySelector(".tur-lanjut").focus();
  }
  function tombolPanduan(e) {
    if (!TUR.root) return;
    if (e.key === "Escape") { e.stopPropagation(); e.preventDefault(); tutupPanduan("lewati"); }
    else if (e.key === "ArrowRight") { e.preventDefault(); TUR.root.querySelector(".tur-lanjut").click(); }
    else if (e.key === "ArrowLeft" && TUR.i > 0) { e.preventDefault(); langkahPanduan(TUR.i - 1, -1); }
  }
  // arah: lewati langkah yang tombolnya sedang tidak terlihat (mis. ticker kosong)
  function langkahPanduan(i, arah) {
    while (i >= 0 && i < TUR.antre.length && TUR.antre[i].el && !TUR.antre[i].masuk && !tampakEl(TUR.antre[i].el())) i += arah;
    if (i < 0) return;
    if (i >= TUR.antre.length) return tutupPanduan("selesai");
    TUR.i = i;
    const l = TUR.antre[i], r = TUR.root;
    if (TUR.aktif && TUR.aktif !== l) TUR.aktif.keluar?.();
    TUR.aktif = l;
    tandaiPanduan([l.id]);
    r.querySelector("#tur-judul").textContent = l.judul;
    r.querySelector(".tur-teks").textContent = l.teks;
    r.querySelector(".tur-no").textContent = TUR.antre.length > 1 ? `${i + 1} dari ${TUR.antre.length}` : "";
    r.querySelector(".tur-baru").hidden = !TUR.baru;
    r.querySelector(".tur-kembali").hidden = i === 0;
    r.querySelector(".tur-lanjut").textContent = i === TUR.antre.length - 1 ? "Selesai" : "Lanjut";
    posisiPanduan();
    l.masuk?.();
  }
  function posisiPanduan() {
    if (!TUR.root) return;
    const l = TUR.antre[TUR.i], el = l.el?.(), sorot = TUR.root.querySelector(".tur-sorot"), kartu = TUR.root.querySelector(".tur-kartu");
    const W = window.innerWidth, H = window.innerHeight, M = 16;
    kartu.style.maxWidth = `${Math.min(340, W - 2 * M)}px`;
    if (!el || !tampakEl(el)) {        // langkah tanpa tombol: kartu di tengah, layar digelapkan merata
      TUR.root.classList.add("tanpa-sorot");
      kartu.style.left = `${(W - kartu.offsetWidth) / 2}px`;
      kartu.style.top = `${Math.max(M, (H - kartu.offsetHeight) / 2)}px`;
      return;
    }
    TUR.root.classList.remove("tanpa-sorot");
    const b = kotakEl(el), pad = 6;
    Object.assign(sorot.style, { left: `${b.left - pad}px`, top: `${b.top - pad}px`, width: `${b.width + 2 * pad}px`, height: `${b.height + 2 * pad}px` });
    const kw = kartu.offsetWidth, kh = kartu.offsetHeight;
    // kartu di bawah tombol kalau muat; kalau tidak di atas; kalau tidak juga, di samping kiri (tombol peta di kanan)
    let top, left = Math.min(W - M - kw, Math.max(M, b.left + b.width / 2 - kw / 2));
    if (b.bottom + pad + 12 + kh <= H - M) top = b.bottom + pad + 12;
    else if (b.top - pad - 12 - kh >= M) top = b.top - pad - 12 - kh;
    else { top = Math.min(H - M - kh, Math.max(M, b.top + b.height / 2 - kh / 2)); left = Math.max(M, b.left - pad - 12 - kw); }
    kartu.style.left = `${left}px`; kartu.style.top = `${top}px`;
  }
  function tutupPanduan(aksi) {
    if (!TUR.root) return;
    if (aksi === "lewati") tandaiPanduan(TUR.antre.map((l) => l.id));   // dilewati = dianggap sudah dilihat
    lacak("Panduan", { aksi, langkah: TUR.i + 1, jenis: TUR.baru ? "fitur baru" : "lengkap" });
    document.removeEventListener("keydown", tombolPanduan, true);
    window.removeEventListener("resize", posisiPanduan);
    map.off("move", posisiPanduan);
    TUR.aktif?.keluar?.(); TUR.aktif = null;
    TUR.root.remove(); TUR.root = null;
  }
  // Mulai otomatis setelah peta & data siap dan animasi pembuka selesai (sekali per kunjungan)
  async function jadwalkanPanduan() {
    if (new URLSearchParams(location.search).has("tanpa-panduan")) return;
    if (!panduanDilihat().size && (PERNAH_DATANG || await SW_LAMA)) tandaiPanduan(PANDUAN_DASAR);
    const tunggu = () => (state.mapReady && state.data.gempa ? setTimeout(() => mulaiPanduan(false), REDUCED ? 300 : 3200) : setTimeout(tunggu, 400));
    tunggu();
  }

  // ---------- tautan langsung ke satu gempa ----------
  // ?gempa=<waktu UTC, mis. 2026-11-18T03:24:03Z> membuka gempa itu (tautan di postingan Threads).
  // ?kartu = tampilan bersih untuk screenshot otomatis (tanpa ticker, dock, tombol); <body data-siap> saat siap difoto.
  const TAUTAN = new URLSearchParams(location.search);
  const GEMPA_TAUTAN = TAUTAN.get("gempa");
  if (TAUTAN.has("kartu")) document.body.classList.add("kartu");
  async function bukaGempaTautan() {
    if (!GEMPA_TAUTAN) return;
    for (let i = 0; i < 60; i++) {   // gempa yang baru terjadi mungkin baru muncul setelah cek BMKG langsung
      const f = state.mapReady && state.data.gempa?.features.find((x) => x.properties.waktu === GEMPA_TAUTAN);
      if (f) {
        if (state.mode !== "gempa") { state.mode = "gempa"; applyMode(false); }
        if (TAUTAN.has("kartu") || isMobile()) setListHidden(true);
        showQuake(f, false);
        if (!TAUTAN.has("kartu")) return;
        // Kartu: detail di bawah (CSS), peta zoom ke gempa di ruang atasnya, lalu tandai siap difoto
        setTimeout(() => {
          const pop = document.querySelector(".maplibregl-popup");
          const bawah = (pop ? pop.offsetHeight : 260) + 40;
          const [lng, lat] = f.geometry.coordinates;
          const { rings } = ringRadii(f.properties);
          const r = Math.max(rings.length ? Math.max(...rings.map((x) => x.km)) : 60, 70);   // min. 70 km: pulau sekitar ikut terlihat
          // zoom agar lingkaran guncangan terbesar (min. 30 km) muat di ruang peta di atas kartu
          const tinggi = Math.max(window.innerHeight - 90 - bawah, 120), lebar = window.innerWidth - 60;
          const mPerPx = (2 * r * 1000) / Math.min(tinggi, lebar);
          const zoom = Math.min(8.5, Math.log2((78271.52 * Math.cos(lat * Math.PI / 180)) / mPerPx));
          map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
          map.jumpTo({ center: [lng, lat], zoom });
          // pusat gempa ke tengah ruang di atas kartu (posisi mutlak, aman bila terpanggil berulang)
          const c = map.getCanvas();
          map.jumpTo({ center: map.unproject([c.clientWidth / 2, c.clientHeight / 2 + (bawah - 90) / 2]) });
          // titik gempa berdenyut terus, jadi peta tak pernah "idle": tunggu semua ubin peta termuat
          let n = 0;
          const cek = setInterval(() => {
            if ((map.areTilesLoaded() && map.isStyleLoaded()) || ++n > 40) {
              clearInterval(cek);
              setTimeout(() => { document.body.dataset.siap = "1"; }, 1500);
            }
          }, 250);
        }, 300);
        return;
      }
      if (i % 10 === 9) { state.kunciAuto = null; cekGempaRealtime(); }
      await new Promise((r) => setTimeout(r, 500));
    }
    document.body.dataset.siap = "tidak-ketemu";
  }

  // ---------- mulai ----------
  state.mode = MODES[location.hash.slice(1)] ? location.hash.slice(1) : null;
  wireUI();
  applyMode(false);
  loadLive().then(cekGempaRealtime).then(bukaGempaTautan);
  jadwalkanPanduan();
  setInterval(async () => {
    // tab terbuka lama tanpa disentuh: muat ulang hanya bila ada versi baru & tidak ada popup yang sedang dibaca
    if (!state.popup && await adaVersiBaru()) return location.reload();
    loadLive();
  }, REFRESH_MS);
  setInterval(cekGempaRealtime, GEMPA_RT_MS);
})();
