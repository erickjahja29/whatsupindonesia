/* What'sUpIndonesia — peta sebagai fokus: brand (kiri atas), ticker live (atas), dock lapisan (bawah),
   panel khusus per lapisan (gempa, titik panas, laporan warga). */
(() => {
  "use strict";

  const DATA = "data/";
  const REFRESH_MS = 5 * 60 * 1000;
  const HOUR = 3600 * 1000;
  const INDONESIA = [[94.5, -11.5], [141.5, 6.5]];
  const TICK_MS = 6000;
  const REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

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
  };
  const icon = (k) => `<svg viewBox="0 0 24 24">${P[k] || P.pin}</svg>`;

  const JENIS = {
    banjir: { warna: "#3ea6ff", ic: "banjir" }, kebakaran: { warna: "#ff7a00", ic: "api" },
    "kabut asap": { warna: "#9aa0a6", ic: "asap" }, "angin kencang": { warna: "#2dd4bf", ic: "angin" },
    gempa: { warna: "#b37feb", ic: "gempa" }, "gunung api": { warna: "#e55353", ic: "gunung" },
  };
  const jWarna = (j) => JENIS[j]?.warna || "#cfd8e3";
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
    gempa: { title: "Gempa", sub: "7 hari terakhir · BMKG (cadangan USGS)", c: "#ff4d4f", ic: "gempa", layers: ["gempa", "gempa-label"] },
    titik_panas: { title: "Titik panas", sub: "24 jam terakhir · satelit NASA FIRMS", c: "#ff6a1a", ic: "api", layers: ["titik_panas", "titik_panas-glow"] },
    laporan: { title: "Laporan warga", sub: "7 hari terakhir · PetaBencana.id + berita media", c: "#3ea6ff", ic: "lapor", layers: ["laporan"] },
    // only = lapisan yang hanya tampil di mode ini (tidak di beranda)
    banjir: { title: "Banjir", sub: "Peringatan BMKG · laporan warga · data resmi BNPB", c: "#22d3ee", ic: "banjir",
      layers: ["peringatan-fill", "peringatan-line", "bnpb-fill", "bnpb-line", "banjir-area-fill", "banjir-area-line"],
      only: ["banjir-lapor-glow", "banjir-lapor"] },
    gunung_api: { title: "Gunung api", sub: "Tingkat aktivitas · MAGMA Indonesia (PVMBG, Badan Geologi)", c: "#f59e0b", ic: "gunung",
      layers: ["gunung_api", "gunung_api-label"] },
  };
  // Tingkat aktivitas gunung api (PVMBG)
  const LEVEL_GUNUNG = {
    4: { nama: "Awas", rom: "IV", warna: "#ef4444" }, 3: { nama: "Siaga", rom: "III", warna: "#fb923c" },
    2: { nama: "Waspada", rom: "II", warna: "#facc15" }, 1: { nama: "Normal", rom: "I", warna: "#94a3b8" },
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
  const fmtWIB = (iso) => new Intl.DateTimeFormat("id-ID", {
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
  const num = (n) => new Intl.NumberFormat("id-ID").format(n);
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
  const jamWIB = (iso) => new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", hour: "2-digit", minute: "2-digit" })
    .format(new Date(iso)) + " WIB";
  function sisa(iso) {
    const m = Math.round((new Date(iso) - Date.now()) / 60000);
    if (m <= 0) return "berakhir";
    return m < 60 ? `${m} menit lagi` : `${Math.round(m / 60)} jam lagi`;
  }
  const tglID = (ymd) => new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(ymd + "T00:00:00Z"));
  const where = (p) => [p.kabupaten, p.provinsi].filter(Boolean).join(", ");
  const isMobile = () => window.innerWidth <= 760;
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  async function getJSON(path) {
    const r = await fetch(`${DATA}${path}?t=${Math.floor(Date.now() / 60000)}`);
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
    let bottomTop = dock.getBoundingClientRect().top;
    if (isMobile() && !panel.hidden) bottomTop = Math.min(bottomTop, panel.getBoundingClientRect().top);
    const bottom = Math.max(H - bottomTop + 16, 40);
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
      d.innerHTML = `<button type="button" id="segar-btn" class="ctrl-segar" title="Muat ulang peta &amp; data"
        aria-label="Muat ulang peta dan data"><svg viewBox="0 0 24 24"><path d="M21 12a9 9 0 1 1-2.64-6.36L21 8"/><path d="M21 3v5h-5"/></svg></button>
        <button type="button" id="angin-btn" class="ctrl-angin" aria-pressed="false" title="Angin: nyala/mati"
        aria-label="Lapisan angin">${icon("angin")}</button>
        <button type="button" id="udara-btn" class="ctrl-udara" aria-pressed="false" title="Polusi udara (PM2.5): nyala/mati"
        aria-label="Lapisan polusi udara"><svg viewBox="0 0 24 24"><path d="M3 8h11a3 3 0 1 0-3-3"/><path d="M3 12h16a3 3 0 1 1-3 3"/><path d="M3 16h7"/><circle cx="17" cy="6" r=".6"/><circle cx="20" cy="9" r=".6"/></svg></button>`;
      d.querySelector("#angin-btn").addEventListener("click", () => setAngin(!state.angin));
      d.querySelector("#udara-btn").addEventListener("click", () => setUdara(!state.udara));
      d.querySelector("#segar-btn").addEventListener("click", segarkan);
      return d;
    }
    onRemove() { /* tidak dipakai */ }
  }
  map.addControl(new KontrolAngin(), "bottom-right");

  // ---------- pemulihan peta dasar ----------
  // MapLibre tidak mengulang ubin peta yang gagal diunduh (sinyal lemah / server sibuk), sehingga peta dasar
  // bisa tetap hitam. Bila ubin peta dasar gagal, muat ulang gaya peta (lapisan data dipasang ulang otomatis).
  const SUMBER_KITA = new Set(["wilayah", "titik_panas", "gempa", "laporan", "guncangan", "guncangan-label", "gelombang",
    "peringatan", "gunung_api", "banjir_area", "angin", "udara", "udara-img"]);
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

  // Tombol muat ulang: peta dasar + semua data, tanpa memuat ulang halaman
  function segarkan() {
    const b = $("#segar-btn");
    if (b.classList.contains("putar")) return;
    b.classList.add("putar");
    if (state.popup) state.popup.remove();
    pulih.gagal = 0; pulih.coba = 0;
    map.setStyle(GAYA[state.tema], { diff: false });
    Promise.all([loadLive(), new Promise((r) => { map.once("idle", r); setTimeout(r, 8000); })])
      .finally(() => b.classList.remove("putar"));
  }
  // Kembali ke tab setelah lama ditinggal: ambil data terbaru
  let tSembunyi = 0;
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) tSembunyi = Date.now();
    else if (tSembunyi && Date.now() - tSembunyi > 5 * 60 * 1000) loadLive();
  });

  // Lapisan data di atas peta dasar. Dipasang ulang setiap gaya peta berganti (tema terang/gelap).
  function pasangLapisan() {
    const W = warnaTema();
    map.addSource("wilayah", { type: "geojson", data: `${DATA}wilayah.geojson`, promoteId: "id" });
    const below = map.getLayer("highway_name_other") ? "highway_name_other" : undefined;
    map.addLayer({
      id: "wilayah-fill", type: "fill", source: "wilayah",
      paint: { "fill-color": W.hover,
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.07, 0.0] },
    }, below);
    map.addLayer({
      id: "wilayah-line", type: "line", source: "wilayah",
      paint: { "line-color": W.garis, "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.55],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 9, 1.2] },
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
      2, LEVEL_GUNUNG[2].warna, LEVEL_GUNUNG[1].warna];
    map.addLayer({
      id: "gunung_api", type: "symbol", source: "gunung_api",
      layout: { "icon-image": "segitiga", "icon-allow-overlap": true, "symbol-sort-key": ["get", "level"],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 4, ["match", ["get", "level"], 1, 0.55, 2, 0.75, 1], 9,
          ["match", ["get", "level"], 1, 0.9, 2, 1.1, 1.4]] },
      paint: { "icon-color": warnaLevel, "icon-opacity": ["match", ["get", "level"], 1, 0.55, 1],
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
      paint: { "raster-opacity": state.tema === "terang" ? 0.75 : 0.7, "raster-resampling": "linear", "raster-fade-duration": 0 } },
    "peringatan-fill");
    map.addSource("udara", { type: "geojson", data: empty });
    map.addLayer({ id: "udara-hit", type: "circle", source: "udara",
      layout: { visibility: state.udara ? "visible" : "none" },
      paint: { "circle-radius": 14, "circle-opacity": 0, "circle-stroke-opacity": 0 } });
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
    setTimeout(() => map.fitBounds(INDONESIA, { padding: viewPadding(), duration: REDUCED ? 0 : 2600,
      curve: 1.6, essential: true }), REDUCED ? 0 : 250);
  });

  // ---------- data ----------
  async function loadLive() {
    try {
      const kosong = { type: "FeatureCollection", features: [] };
      const [meta, gempa, titik_panas, laporan, berita, peringatan, banjir_bnpb, bGempa, bBanjir, bApi,
        gunung_api, banjir_area, bGunung, angin, udara] = await Promise.all([
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
      ]);
      for (const f of gempa.features) f.properties.lokasi = rapiLokasi(f.properties.lokasi);
      state.beritaGempa = bGempa;
      state.beritaBanjir = bBanjir;
      state.beritaApi = bApi;
      state.beritaGunung = bGunung;
      state.anginData = angin;
      state.udaraData = udara;
      state.data.gunung_api = gunung_api;
      state.data.banjir_area = banjir_area;
      // peringatan BMKG cepat kedaluwarsa (1–3 jam): buang yang sudah lewat
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
        go: () => { setMode("laporan"); setTimeout(() => focusFeature("laporan", lap), 80); } });
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
  }
  function wireTicker() {
    const tk = $("#ticker"), bar = $("#tk-bar");
    let paused = false;
    tk.addEventListener("mouseenter", () => { paused = true; });
    tk.addEventListener("mouseleave", () => { paused = false; });
    bar.addEventListener("animationend", () => {
      if (!paused && state.tick.items.length > 1) showTick((state.tick.i + 1) % state.tick.items.length);
      else { bar.classList.remove("run"); void bar.offsetWidth; bar.classList.add("run"); }
    });
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
    const show = !state.mode || state.mode === "gempa";
    state.pulseMarkers.forEach((m) => { m.getElement().style.display = show ? "" : "none"; });
  }

  // ---------- mode / lapisan khusus ----------
  function setMode(mode) {
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
    map.setFilter("laporan", null);
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
        <div class="note">Warna = daya radiasi api (FRP). Titik pudar = keyakinan rendah.</div>`;
    }
    if (mode === "banjir") {
      return `<div class="row"><span class="key" style="--c:${WARNA_WASPADA}55;--b:${WARNA_WASPADA}"><i></i>Waspada (BMKG)</span>
        <span class="key" style="--c:#3ea6ff;--b:#fff"><i style="border-radius:50%"></i>Terjadi (warga)</span>
        <span class="key" style="--c:${WARNA_BNPB}44;--b:${WARNA_BNPB}"><i></i>Resmi (BNPB)</span>
        ${state.data.banjir_area?.features.length ? `<span class="key" style="--c:#3b82f688;--b:#3b82f6"><i></i>Area tergenang</span>` : ""}</div>`;
    }
    if (mode === "gunung_api") {
      return `<div class="row">${[4, 3, 2, 1].map((lv) => `<span class="key tri">${segitiga(LEVEL_GUNUNG[lv].warna)}${LEVEL_GUNUNG[lv].nama}</span>`).join("")}</div>
        <div class="note">Level I Normal sampai IV Awas. Ikuti rekomendasi dan jarak aman dari PVMBG.</div>`;
    }
    return ""; // gempa & laporan: cukup daftar
  }

  function renderChips() {
    const box = $("#chips");
    if (state.mode !== "laporan") { box.hidden = true; return; }
    const counts = {};
    for (const f of state.data.laporan.features) counts[f.properties.jenis] = (counts[f.properties.jenis] || 0) + 1;
    const order = ["banjir", "kebakaran", "angin kencang", "gempa", "kabut asap", "gunung api"];
    const jenisList = [...order.filter((j) => counts[j]), ...Object.keys(counts).filter((j) => !order.includes(j))];
    box.hidden = false;
    box.innerHTML = [`<button class="chip" data-j="semua" style="--c:#ffffff" aria-pressed="${state.jenis === "semua"}">Semua <b>${num(state.data.laporan.features.length)}</b></button>`,
      ...jenisList.map((j) => `<button class="chip" data-j="${esc(j)}" style="--c:${jWarna(j)}" aria-pressed="${state.jenis === j}"><i></i>${esc(j[0].toUpperCase() + j.slice(1))} <b>${num(counts[j])}</b></button>`)].join("");
    box.querySelectorAll(".chip").forEach((b) => b.addEventListener("click", () => {
      state.jenis = b.dataset.j;
      if (state.mapReady) map.setFilter("laporan", state.jenis === "semua" ? null : ["==", ["get", "jenis"], state.jenis]);
      renderChips();
      renderList();
    }));
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
    } else if (t === "titik_panas") {
      const by = new Map();
      for (const f of state.data.titik_panas.features) {
        const p = f.properties, k = p.wilayah_id;
        if (!by.has(k)) by.set(k, { n: 0, tinggi: 0, p });
        const o = by.get(k); o.n++; if (p.keyakinan === "tinggi") o.tinggi++;
      }
      rows = [...by.values()].sort((a, b) => b.n - a.n).slice(0, 30);
      const max = rows[0]?.n || 1;
      html = rows.length ? `<div class="item-sub" style="padding:4px 10px 6px">Kabupaten/kota dengan titik panas terbanyak (24 jam)</div>` +
        rows.map((r, i) => `<button class="item" data-i="${i}" style="--i:${i}"><span class="badge">${num(r.n)}</span>
          <span class="item-main"><div class="item-title">${esc(r.p.kabupaten)}</div>
          <div class="item-sub">${esc(r.p.provinsi)} · ${num(r.tinggi)} keyakinan tinggi</div>
          <div class="bar"><i style="width:${(100 * r.n / max).toFixed(1)}%"></i></div>
          ${beritaApi(r.p.wilayah_id).length ? `<span class="item-news">${icon("berita")} ${beritaApi(r.p.wilayah_id).length} berita karhutla</span>` : ""}</span></button>`).join("") : "";
    } else if (t === "banjir") {
      // Tiga bagian: waspada (BMKG), terjadi (warga), resmi (BNPB)
      const waspada = state.data.peringatan.features;
      const terjadi = state.data.laporan.features.filter((f) => f.properties.jenis === "banjir");
      const resmi = state.data.banjir_bnpb.features;
      let i = 0;
      const sec = (title, c, n) => `<div class="sec-title" style="--c:${c}"><i></i>${title}<span>${num(n)}</span></div>`;
      html += sec("Waspada sekarang · BMKG", WARNA_WASPADA, waspada.length);
      html += waspada.length ? waspada.map((f) => {
        const p = f.properties; rows.push({ kind: "waspada", f });
        const kab = (p.kabupaten_list || []).slice(0, 3).join(", ") + ((p.kabupaten_list || []).length > 3 ? ` +${p.kabupaten_list.length - 3}` : "");
        return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${WARNA_WASPADA}26;color:${WARNA_WASPADA}">${icon("banjir")}</span>
          <span class="item-main"><div class="item-title">${esc(p.provinsi || "Peringatan")}</div>
          <div class="item-sub">${esc(kab || "")}${kab ? " · " : ""}hingga ${esc(jamWIB(p.berakhir))} (${esc(sisa(p.berakhir))})</div></span></button>`;
      }).join("") : `<div class="sec-note">Tidak ada peringatan hujan lebat aktif saat ini.</div>`;
      html += sec("Banjir terjadi · laporan warga 7 hari", "#3ea6ff", terjadi.length);
      html += terjadi.length ? terjadi.map((f) => {
        const p = f.properties; rows.push({ kind: "terjadi", f });
        return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:#3ea6ff26;color:#3ea6ff">${icon("banjir")}</span>
          <span class="item-main"><div class="item-title">${esc(where(p) || "Lokasi")}</div>
          <div class="item-sub">${esc(ago(p.waktu))}${p.teks ? " · " + esc(p.teks.slice(0, 90)) + (p.teks.length > 90 ? "…" : "") : ""}</div>
          ${p.n_berita ? `<span class="item-news">${icon("berita")} ${p.n_berita} berita</span>` : ""}</span></button>`;
      }).join("") : `<div class="sec-note">Belum ada laporan banjir dari warga.</div>`;
      html += sec("Data resmi · BNPB minggu ini", WARNA_BNPB, resmi.length);
      html += resmi.length ? resmi.map((f) => {
        const p = f.properties; rows.push({ kind: "resmi", f });
        return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:${WARNA_BNPB}22;color:${WARNA_BNPB};font-size:11px">BNPB</span>
          <span class="item-main"><div class="item-title">${esc(p.kabupaten || p.kabupaten_bnpb)}</div>
          <div class="item-sub">${esc(tglID(p.tanggal))} · ${esc(p.kategori)}${p.rumah_terendam ? ` · ${num(p.rumah_terendam)} rumah terendam` : ""}${p.mengungsi ? ` · ${num(p.mengungsi)} mengungsi` : ""}</div></span></button>`;
      }).join("") + `<div class="sec-note">Data resmi diperbarui mingguan, bisa tertinggal beberapa hari.</div>`
        : `<div class="sec-note">Belum ada kejadian banjir tercatat BNPB minggu ini.</div>`;
      const area = state.data.banjir_area?.features || [];
      if (area.length) {
        html += sec("Area tergenang · PetaBencana 48 jam", "#3b82f6", area.length);
        html += area.map((f) => {
          const p = f.properties; rows.push({ kind: "area", f });
          return `<button class="item" data-i="${i++}" style="--i:${i}"><span class="badge" style="background:#3b82f626;color:#60a5fa">${icon("banjir")}</span>
            <span class="item-main"><div class="item-title">${esc(p.nama)}</div>
            <div class="item-sub">${esc(p.kota || "")}${p.kota ? " · " : ""}tinggi air ${esc(p.tinggi)} · ${esc(ago(p.waktu))}</div></span></button>`;
        }).join("");
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
      const normal = semua.filter((f) => f.properties.level === 1).length;
      html += normal ? `<div class="sec-note" style="margin-top:10px">${num(normal)} gunung lain berstatus Normal (segitiga abu-abu di peta).</div>` : "";
    } else {
      rows = state.data.laporan.features.filter((f) => state.jenis === "semua" || f.properties.jenis === state.jenis);
      html = rows.map((f, i) => {
        const p = f.properties, c = jWarna(p.jenis);
        return `<button class="item" data-i="${i}" style="--i:${i}"><span class="badge" style="background:${c}26;color:${c}">${jIcon(p.jenis)}</span>
          <span class="item-main"><div class="item-title"><span class="tag">${esc(p.jenis)}</span> ${esc(where(p) || "")}</div>
          <div class="item-sub">${esc(ago(p.waktu))}${p.teks ? " · " + esc(p.teks.slice(0, 110)) + (p.teks.length > 110 ? "…" : "") : ""}</div>
          ${p.n_berita ? `<span class="item-news">${icon("berita")} ${p.n_berita} berita</span>` : ""}</span></button>`;
      }).join("");
    }
    list.innerHTML = html || `<div class="empty">Belum ada data untuk saat ini.</div>`;
    list.scrollTop = 0;
    list.querySelectorAll(".item").forEach((el) => el.addEventListener("click", () => {
      const r = rows[+el.dataset.i];
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
    for (const id of ["banjir-lapor", "peringatan-fill", "bnpb-fill", "gunung_api", "banjir-area-fill"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
    }
    map.on("click", (e) => {
      const layers = ["gunung_api", "laporan", "banjir-lapor", "gempa", "titik_panas", "banjir-area-fill", "bnpb-fill",
        "peringatan-fill", "udara-hit", "angin", "angin-hit", "wilayah-fill"].filter((id) => map.getLayoutProperty(id, "visibility") !== "none");
      const hits = map.queryRenderedFeatures(e.point, { layers });
      if (!hits.length) return;
      let f = hits[0], layer = f.layer.id;
      if (layer === "gunung_api") {
        clearRings();
        const full = state.data.gunung_api.features.find((x) => x.properties.id === f.properties.id) || f;
        return showVolcano(full, { lng: full.geometry.coordinates[0], lat: full.geometry.coordinates[1] });
      }
      if (layer === "banjir-area-fill") { clearRings(); return showAreaPopup(f, e.lngLat); }
      if (layer === "udara-hit") { clearRings(); return showAirPopup(f); }
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
    document.querySelectorAll(".dock-btn").forEach((b) => b.addEventListener("click", () =>
      setMode(state.mode === b.dataset.mode ? null : b.dataset.mode)));
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
      if (!$("#setelan").hidden) return bukaSetelan(false);
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
    if (!el) return;
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
      tabs.map((t) => `<div class="ppane" data-t="${t.id}"${t.id === buka ? "" : " hidden"}>${t.html}</div>`).join("");
  }
  document.addEventListener("click", (e) => {
    const btn = e.target.closest && e.target.closest(".ptab");
    if (!btn) return;
    const pop = btn.closest(".pop");
    const open = btn.getAttribute("aria-expanded") !== "true";
    pop.querySelectorAll(".ptab").forEach((b) => b.setAttribute("aria-expanded", String(open && b === btn)));
    pop.querySelectorAll(".ppane").forEach((p) => { p.hidden = !(open && p.dataset.t === btn.dataset.t); });
    setTimeout(fitPopup, 30);
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
        ${(() => { const bl = beritaApi(p.wilayah_id); return tabsHTML([{ id: "b", ic: "berita", label: "Berita karhutla", n: bl.length,
          html: newsHTML(bl, `Belum ada berita kebakaran hutan/lahan di ${p.kabupaten || "wilayah ini"} (3 hari terakhir).`) }]); })()}
        <div class="src">Titik panas = deteksi panas satelit, belum tentu kebakaran.</div></div>`;
    } else {
      const foto = safeUrl(p.foto), link = safeUrl(p.tautan);
      html = `<div class="pop"><h3><span class="hi" style="--c:${jWarna(p.jenis)}">${jIcon(p.jenis)}</span>Laporan ${esc(p.jenis)}</h3>
        <div class="sub">${esc(ago(p.waktu))} · ${esc(fmtWIB(p.waktu))}<br>${esc(where(p) || "")}</div>
        ${tabsHTML([{ id: "d", label: "Detail", html: `
          ${p.teks ? `<div>${esc(p.teks)}</div>` : ""}
          ${p.tinggi_air_cm ? `<dl style="margin-top:6px"><dt>Tinggi air</dt><dd>${esc(p.tinggi_air_cm)} cm</dd></dl>` : ""}
          ${foto ? `<img src="${esc(foto)}" alt="Foto laporan warga" loading="lazy" onerror="this.remove()" onload="this.closest('.maplibregl-popup') && window.dispatchEvent(new Event('pop-resize'))">` : ""}
          <div class="src">Laporan warga via PetaBencana.id${link ? ` · <a href="${esc(link)}" target="_blank" rel="noopener">lihat</a>` : ""}</div>` },
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
      ${tabsHTML([{ id: "d", label: "Detail guncangan", html: `
      ${p.kabupaten || p.dirasakan ? `<dl style="margin-bottom:8px">
        ${p.kabupaten ? `<dt>Wilayah</dt><dd>${esc(where(p))}</dd>` : ""}
        ${p.dirasakan ? `<dt>Dirasakan</dt><dd>${esc(p.dirasakan)} <span style="color:var(--muted)">(laporan BMKG)</span></dd>` : ""}</dl>` : ""}
      <div class="sec-h">Perkiraan radius guncangan (skala MMI)</div>
      ${rings.length ? `<div class="rings">${rings.map((r) => `<i style="background:${r.warna}"></i><b>${r.rom} · ±${fmtKm(r.km)} km</b><span>${esc(r.ket)}</span>`).join("")}</div>`
        : `<div class="nm">Diperkirakan <b>tidak terasa</b> di permukaan${(p.kedalaman_km || 0) >= 100 ? ` — pusat gempa sangat dalam (${esc(p.kedalaman_km)} km)` : " — magnitudo kecil"}${p.dirasakan ? "" : ", dan BMKG tidak mencatatnya sebagai gempa dirasakan"}.</div>`}
      ${shake ? `<div class="nm" style="margin-top:6px"><a href="${esc(shake)}" target="_blank" rel="noopener">Peta guncangan BMKG</a></div>` : ""}` },
      { id: "b", ic: "berita", label: "Berita", n: beritaGempa(p).length,
        html: newsHTML(beritaGempa(p), (p.magnitudo || 0) >= 4.5 || p.dirasakan ? "Belum ada berita media untuk gempa ini." : "Gempa kecil ini jarang diberitakan media.") }])}</div>`;

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
      map.fitBounds(b, { padding: viewPadding(), maxZoom: 9, duration: REDUCED ? 0 : fly === false ? 700 : 1100 });
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
      ${tabsHTML([kec.length ? { id: "k", label: "Kecamatan", n: kec.length, html: `<div class="chips-mini">${kec.map((k) => `<span>${esc(k)}</span>`).join("")}</div>` } : null,
        { id: "b", ic: "berita", label: "Berita banjir", n: beritaBmkg(p.provinsi).length,
          html: newsHTML(beritaBmkg(p.provinsi), `Belum ada berita banjir di ${p.provinsi || "provinsi ini"} (36 jam terakhir).`) }])}
      <div class="src">Peringatan dini cuaca BMKG — <b>potensi</b>, bukan banjir pasti.${info ? ` <a href="${esc(info)}" target="_blank" rel="noopener">Infografis BMKG</a>` : ""}</div></div>`);
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
          return `<div class="sec-h">${esc(tglID(p.tanggal))}</div>${p.kronologis ? `<div>${esc(p.kronologis)}</div>` : ""}${p.kondisi ? `<div class="nm" style="margin:6px 0 8px">${esc(p.kondisi)}</div>` : ""}`; }).join("");
        const bl = evs.flatMap((e) => beritaBnpb(e.properties.id));
        return tabsHTML([kron ? { id: "k", label: "Kronologi", html: kron } : null,
          { id: "b", ic: "berita", label: "Berita", n: bl.length, html: newsHTML(bl, "Belum ada berita media untuk kejadian ini.") }]);
      })()}
      <div class="src">Sumber: BNPB (Kejadian Bencana Mingguan) — bisa tertinggal beberapa hari.</div></div>`);
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

  // ---------- polusi udara (PM2.5, prakiraan model CAMS via Open-Meteo) ----------
  const GAMBAR_KOSONG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";
  // Kategori ISPU untuk PM2.5 (µg/m³, Permen LHK P.14/2020) dengan warna resminya
  const ISPU = [
    { maks: 15.5, nama: "Baik", warna: [34, 197, 94], a: 0 },        // udara baik: tidak diwarnai (peta tetap bersih)
    { maks: 55.4, nama: "Sedang", warna: [59, 130, 246], a: 0.42 },
    { maks: 150.4, nama: "Tidak sehat", warna: [250, 204, 21], a: 0.62 },
    { maks: 250.4, nama: "Sangat tidak sehat", warna: [239, 68, 68], a: 0.72 },
    { maks: Infinity, nama: "Berbahaya", warna: [30, 30, 30], a: 0.8 },
  ];
  const kategoriPM = (v) => ISPU.find((k) => v <= k.maks) || ISPU[ISPU.length - 1];
  const jamUdara = () => {
    const jam = state.udaraData?.jam || [];
    let i = 0;
    jam.forEach((t, k) => { if (Date.parse(t + ":00Z") <= Date.now()) i = k; });
    return i;
  };
  function gambarUdara() {
    const d = state.udaraData, i = jamUdara();
    const lons = [...new Set(d.titik.map((t) => t[0]))].sort((a, b) => a - b);
    const lats = [...new Set(d.titik.map((t) => t[1]))].sort((a, b) => b - a); // utara di atas
    const ix = new Map(lons.map((v, k) => [v, k])), iy = new Map(lats.map((v, k) => [v, k]));
    const cv = document.createElement("canvas");
    cv.width = lons.length; cv.height = lats.length;
    const cx = cv.getContext("2d"), img = cx.createImageData(cv.width, cv.height);
    for (const [lon, lat, pm] of d.titik) {
      const v = pm[i];
      if (v == null) continue;
      const k = kategoriPM(v), o = (iy.get(lat) * cv.width + ix.get(lon)) * 4;
      img.data[o] = k.warna[0]; img.data[o + 1] = k.warna[1]; img.data[o + 2] = k.warna[2];
      img.data[o + 3] = Math.round(k.a * 255);
    }
    cx.putImageData(img, 0, 0);
    const dx = (lons[1] - lons[0]) / 2, dy = (lats[0] - lats[1]) / 2;
    const W = lons[0] - dx, E = lons[lons.length - 1] + dx, N = lats[0] + dy, S = lats[lats.length - 1] - dy;
    return { url: cv.toDataURL(), coordinates: [[W, N], [E, N], [E, S], [W, S]] };
  }
  function terapkanUdara() {
    const btn = $("#udara-btn");
    if (btn) btn.setAttribute("aria-pressed", String(state.udara));
    if (!state.mapReady || !map.getSource("udara-img")) return;
    const ada = !!state.udaraData && state.udara;
    if (ada) {
      const i = jamUdara(), key = `${state.udaraData.diambil}|${i}|${state.tema}`;
      const src = map.getSource("udara-img");
      if (state.udaraKey !== key || state.udaraSrc !== src) {   // sumber baru setelah ganti tema / muat ulang
        src.updateImage(gambarUdara());
        state.udaraKey = key; state.udaraSrc = src;
      }
      map.getSource("udara").setData({ type: "FeatureCollection", features: state.udaraData.titik.map(([lon, lat], k) => ({
        type: "Feature", geometry: { type: "Point", coordinates: [lon, lat] }, properties: { k } })) });
    }
    for (const l of ["udara-img", "udara-hit"]) map.setLayoutProperty(l, "visibility", ada ? "visible" : "none");
  }
  function setUdara(on) {
    state.udara = on;
    simpan("wui-udara", on ? "1" : "0");
    state.udaraKey = null;
    if (!on && state.popup && state.popupUdara) state.popup.remove();
    terapkanUdara();
  }
  function showAirPopup(f) {
    const d = state.udaraData, i = jamUdara(), row = d.titik[f.properties.k];
    const v = row[2][i], K = kategoriPM(v);
    const lanjut = [3, 6, 9].filter((h) => row[2][i + h] != null).map((h) => {
      const w = row[2][i + h], kk = kategoriPM(w);
      return `<div><b style="color:rgb(${kk.warna})">${num(Math.round(w))}</b><span>${esc(jamWIB(d.jam[i + h] + ":00Z").replace(" WIB", ""))}<br>${esc(kk.nama.toLowerCase())}</span></div>`;
    }).join("");
    const skala = ISPU.map((k) => `<span class="ispu${k === K ? " on" : ""}" style="--c:rgb(${k.warna})"><i></i>${esc(k.nama)}</span>`).join("");
    const [lng, lat] = f.geometry.coordinates;
    popupAt({ lng, lat }, `<div class="pop"><h3><span class="hi" style="--c:rgb(${K.warna})">${icon("asap")}</span>Udara: ${esc(K.nama)}</h3>
      <div class="sub">PM2.5 sekitar <b>${num(Math.round(v))} µg/m³</b> · kategori ISPU</div>
      <div class="ispu-skala">${skala}</div>
      ${lanjut ? `<div class="sec-h" style="margin-top:8px">Prakiraan berikutnya (µg/m³)</div><div class="grid3">${lanjut}</div>` : ""}
      <div class="src">Prakiraan model CAMS via Open-Meteo, rata-rata area ±165 km (bukan alat ukur). Nilai di kota bisa jauh lebih tinggi. Data resmi: ISPU KLHK.</div></div>`);
    state.popupUdara = true;
    state.popup.on("close", () => { state.popupUdara = false; });
  }

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
  function bukaSetelan(buka) {
    $("#setelan").hidden = !buka;
    $("#setelan-btn").setAttribute("aria-expanded", String(buka));
    if (buka) { $("#setelan-btn").classList.remove("titik"); simpan("wui-lihat-setelan", "1"); perbaruiPasang(); }
    updateTopUI();
  }
  const diPasang = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const iOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function perbaruiPasang() {
    const b = $("#pasang-btn"), t = $("#pasang-txt"), info = $("#pasang-info");
    b.disabled = false;
    if (diPasang()) {
      b.disabled = true; t.textContent = "Sudah terpasang";
      info.textContent = "Kamu sedang membuka versi aplikasi dari layar HP.";
    } else if (state.pasangPrompt) {
      t.textContent = "Pasang What'sUpIndonesia";
      info.textContent = "Buka dari ikon di layar HP seperti aplikasi, tanpa toko aplikasi.";
    }
  }
  function pasangAplikasi() {
    const info = $("#pasang-info");
    if (state.pasangPrompt) {
      const ev = state.pasangPrompt;
      state.pasangPrompt = null;
      ev.prompt();
      ev.userChoice.then((r) => { if (r.outcome !== "accepted") state.pasangPrompt = ev; perbaruiPasang(); });
    } else if (iOS()) {
      info.innerHTML = "Di <b>Safari</b>: ketuk tombol <b>Bagikan</b> (kotak dengan panah ke atas), lalu pilih <b>Tambahkan ke Layar Utama</b>.";
    } else {
      info.innerHTML = "Buka menu browser (<b>⋮</b>), lalu pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.";
    }
    updateTopUI();
  }
  function wireSetelan() {
    $("#setelan-btn").addEventListener("click", () => bukaSetelan($("#setelan").hidden));
    document.querySelectorAll(".seg-btn[data-tema]").forEach((b) => b.addEventListener("click", () => {
      if (b.dataset.tema !== state.tema) setTema(b.dataset.tema);
    }));
    tandaiTema();
    $("#pasang-btn").addEventListener("click", pasangAplikasi);
    // klik di luar kotak judul = tutup pengaturan
    document.addEventListener("pointerdown", (e) => {
      if (!$("#setelan").hidden && !e.target.closest("#brand")) bukaSetelan(false);
    });
    window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); state.pasangPrompt = e; perbaruiPasang(); });
    window.addEventListener("appinstalled", () => { state.pasangPrompt = null; perbaruiPasang(); });
    // tanda kecil di tombol pengaturan untuk pengunjung HP yang belum pernah membukanya
    if (isMobile() && !diPasang() && !baca("wui-lihat-setelan")) $("#setelan-btn").classList.add("titik");
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => { /* opsional */ });
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
    popupAt(lngLat, `<div class="pop"><h3><span class="hi" style="--c:${L.warna};color:#1a1200">${icon("gunung")}</span>Gunung ${esc(p.nama)}</h3>
      <div class="sub"><span class="lv" style="--c:${L.warna}">Level ${L.rom} · ${L.nama}</span> ${esc(p.lokasi || where(p))}${p.elevasi ? ` · ${num(p.elevasi)} mdpl` : ""}</div>
      ${p.erupsi || p.vona ? `<div class="flags">${p.erupsi ? `<span>Erupsi tercatat di MAGMA</span>` : ""}${p.vona ? `<span>Peringatan abu penerbangan (VONA)</span>` : ""}</div>` : ""}
      ${p.level >= 2 ? tabsHTML([
        lap ? { id: "l", label: "Laporan", html: `${p.periode ? `<div class="nm" style="margin-bottom:6px">${esc(p.periode)}</div>` : ""}${lap}` } : null,
        rek ? { id: "r", label: "Rekomendasi", html: rek } : null,
        { id: "b", ic: "berita", label: "Berita", n: bl.length, html: newsHTML(bl, `Belum ada berita tentang Gunung ${p.nama} (3 hari terakhir).`) },
      ], buka || (lap ? "l" : undefined)) : `<div class="nm">Status Normal: tidak ada peningkatan aktivitas yang dilaporkan.</div>`}
      <div class="src">Sumber: MAGMA Indonesia (PVMBG, Badan Geologi)${url ? ` · <a href="${esc(url)}" target="_blank" rel="noopener">laporan lengkap</a>` : ""}</div></div>`);
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
  function cariWilayah(q) {
    const raw = q.toLowerCase(), n = normCari(q);
    if (!n) return [];
    const mau = /\bkota\b/.test(raw) ? "kota" : /\bkab/.test(raw) ? "kab" : /\bprov/.test(raw) ? "prov" : null;
    const hasil = [];
    for (const e of state.indeks) {
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
    if (state.mode) setMode(null);
    const ids = new Set(e.tipe === "prov" ? e.ids : [e.id]);
    const bb = [[e.b[0], e.b[1]], [e.b[2], e.b[3]]];
    clearRings();
    map.fitBounds(bb, { padding: viewPadding(), maxZoom: e.tipe === "prov" ? 8 : 10, duration: REDUCED ? 0 : 1100 });
    const tengah = { lng: (e.b[0] + e.b[2]) / 2, lat: (e.b[1] + e.b[3]) / 2 };
    const sub = e.tipe === "prov" ? `Provinsi · ${num(e.ids.length)} kabupaten/kota` : `${e.tipe === "kota" ? "Kota" : "Kabupaten"} · ${e.provinsi}`;
    map.once("moveend", () => ringkasWilayah({ ids, judul: e.nama, sub, buka: true }, tengah));
  }
  function renderHasilCari() {
    const box = $("#cari-hasil"), q = $("#cari-input").value;
    if (!state.indeks) { box.innerHTML = `<div class="cari-kosong">Memuat daftar wilayah…</div>`; return; }
    const hasil = cariWilayah(q);
    state.cariHasil = hasil; state.cariAktif = 0;
    if (!q.trim()) { box.innerHTML = `<div class="cari-kosong">Contoh: Bandung, Kab. Bogor, Jawa Timur</div>`; return; }
    if (!hasil.length) { box.innerHTML = `<div class="cari-kosong">Wilayah "${esc(q)}" tidak ditemukan.</div>`; return; }
    box.innerHTML = hasil.map((e, i) => {
      const n = state.data.gempa ? jumlahKejadian(kejadianDi(new Set(e.tipe === "prov" ? e.ids : [e.id]))) : 0;
      const jenis = e.tipe === "prov" ? "Provinsi" : `${e.tipe === "kota" ? "Kota" : "Kabupaten"} · ${e.provinsi}`;
      return `<button class="cari-item" role="option" data-i="${i}" aria-selected="${i === 0}">
        <span class="ci-t"><b>${esc(e.nama)}</b><span>${esc(jenis)}</span></span>
        <span class="ci-n${n ? " ada" : ""}">${num(n)} kejadian</span></button>`;
    }).join("");
    box.querySelectorAll(".cari-item").forEach((b) => b.addEventListener("click", () => pilihWilayah(hasil[+b.dataset.i])));
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

  function closeSheet() {
    $("#panel").classList.remove("open");
    $("#grip").setAttribute("aria-expanded", "false");
    updateCtrl();
  }

  // Tombol zoom selalu di atas dock/panel bawah; tinggi dock dipakai panel HP.
  function updateCtrl() {
    const set = () => {
      const dock = $("#dock"), panel = $("#panel"), H = window.innerHeight;
      document.documentElement.style.setProperty("--dock-h", `${H - dock.getBoundingClientRect().top + 8}px`);
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

  // ---------- mulai ----------
  state.mode = MODES[location.hash.slice(1)] ? location.hash.slice(1) : null;
  wireUI();
  applyMode(false);
  loadLive();
  setInterval(loadLive, REFRESH_MS);
})();
