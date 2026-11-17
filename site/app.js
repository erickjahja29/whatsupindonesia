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
      layers: ["peringatan-fill", "peringatan-line", "bnpb-fill", "bnpb-line"], only: ["banjir-lapor-glow", "banjir-lapor"] },
  };
  const WARNA_WASPADA = "#fbbf24", WARNA_BNPB = "#22d3ee";

  const state = {
    data: { gempa: null, titik_panas: null, laporan: null, peringatan: null, banjir_bnpb: null, banjir: null },
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

  // ---------- peta ----------
  const map = new maplibregl.Map({
    container: "map",
    style: "https://tiles.openfreemap.org/styles/dark", // gratis, tanpa API key (data OpenStreetMap)
    center: [118, -2], zoom: REDUCED ? 3.6 : 1.4,        // intro: mulai jauh lalu terbang ke Indonesia
    maxBounds: [[40, -60], [200, 55]],
    attributionControl: { compact: true },
  });
  map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "bottom-right");
  map.addControl(new maplibregl.GeolocateControl({ trackUserLocation: false }), "bottom-right");

  map.on("load", () => {
    map.addSource("wilayah", { type: "geojson", data: `${DATA}wilayah.geojson`, promoteId: "id" });
    const below = map.getLayer("highway_name_other") ? "highway_name_other" : undefined;
    map.addLayer({
      id: "wilayah-fill", type: "fill", source: "wilayah",
      paint: { "fill-color": "#ffffff",
        "fill-opacity": ["case", ["boolean", ["feature-state", "hover"], false], 0.07, 0.0] },
    }, below);
    map.addLayer({
      id: "wilayah-line", type: "line", source: "wilayah",
      paint: { "line-color": "#5b6b7c", "line-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.2, 8, 0.55],
        "line-width": ["interpolate", ["linear"], ["zoom"], 4, 0.3, 9, 1.2] },
    }, below);

    const empty = { type: "FeatureCollection", features: [] };
    for (const s of ["titik_panas", "gempa", "laporan", "guncangan", "guncangan-label", "gelombang", "peringatan"]) {
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

    // Lingkaran perkiraan guncangan + gelombang kejut (muncul saat gempa diklik)
    map.addLayer({ id: "guncangan-fill", type: "fill", source: "guncangan",
      paint: { "fill-color": ["get", "warna"], "fill-opacity": 0.1 } });
    map.addLayer({ id: "guncangan-line", type: "line", source: "guncangan",
      paint: { "line-color": ["get", "warna"], "line-width": 1.6, "line-opacity": 0.9, "line-dasharray": [3, 2] } });
    map.addLayer({ id: "gelombang", type: "line", source: "gelombang",
      paint: { "line-color": "#ffffff", "line-width": 2.2, "line-opacity": ["get", "o"], "line-blur": 1 } });
    map.addLayer({ id: "guncangan-label", type: "symbol", source: "guncangan-label",
      layout: { "text-field": ["get", "label"], "text-font": ["Noto Sans Bold"], "text-size": 11,
        "text-anchor": "bottom", "text-allow-overlap": true },
      paint: { "text-color": ["get", "warna"], "text-halo-color": "#07090d", "text-halo-width": 1.6 } });

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
      paint: { "text-color": "#fff", "text-halo-color": "#07090d", "text-halo-width": 1.4 },
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
    // Intro: terbang dari jauh ke Indonesia
    setTimeout(() => map.fitBounds(INDONESIA, { padding: viewPadding(), duration: REDUCED ? 0 : 2600,
      curve: 1.6, essential: true }), REDUCED ? 0 : 250);
  });

  // ---------- data ----------
  async function loadLive() {
    try {
      const kosong = { type: "FeatureCollection", features: [] };
      const [meta, gempa, titik_panas, laporan, berita, peringatan, banjir_bnpb, bGempa, bBanjir, bApi] = await Promise.all([
        getJSON("live/meta.json"), getJSON("live/gempa.geojson"),
        getJSON("live/titik_panas.geojson"), getJSON("live/laporan.geojson"),
        getJSON("live/berita_laporan.json").catch(() => ({})),
        getJSON("live/peringatan.geojson").catch(() => kosong),
        getJSON("live/banjir_bnpb.geojson").catch(() => kosong),
        getJSON("live/berita_gempa.json").catch(() => ({})),
        getJSON("live/berita_banjir.json").catch(() => ({})),
        getJSON("live/berita_api.json").catch(() => ({})),
      ]);
      state.beritaGempa = bGempa;
      state.beritaBanjir = bBanjir;
      state.beritaApi = bApi;
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
      if (state.mapReady) applyToMap();
      state.firstLoad = false;
    } catch (e) {
      console.error(e);
      $("#updated").textContent = "Gagal memuat data. Coba muat ulang halaman.";
    }
  }

  function applyToMap() {
    for (const k of ["gempa", "titik_panas", "laporan", "peringatan"]) map.getSource(k).setData(state.data[k]);
    const ids = [...new Set(state.data.banjir_bnpb.features.map((f) => f.properties.wilayah_id).filter(Boolean))];
    for (const l of ["bnpb-fill", "bnpb-line"]) map.setFilter(l, ["in", ["get", "id"], ["literal", ids]]);
    renderPulses();
  }

  // ---------- brand & dock ----------
  function renderBrand() {
    const m = state.meta;
    const bad = Object.entries(m.lapisan).filter(([, v]) => !v.ok).map(([k]) => k.replace("_", " "));
    $("#updated").innerHTML = `Diperbarui <b>${esc(ago(m.diperbarui))}</b> · ${esc(fmtWIB(m.diperbarui))}` +
      (bad.length ? `<br><span style="color:#ffb3b4">Sumber bermasalah: ${esc(bad.join(", "))}</span>` : "");
  }
  function renderDock() {
    for (const k of Object.keys(MODES)) countUp($(`#n-${k}`), state.data[k].features.length);
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
      const n = state.data[mode] ? ` <b>${num(state.data[mode].features.length)}</b>` : "";
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
    $("#p-count").textContent = num(state.data[mode].features.length);
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
        <span class="key" style="--c:${WARNA_BNPB}44;--b:${WARNA_BNPB}"><i></i>Resmi (BNPB)</span></div>`;
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
        else focusFeature("laporan", r.f);
      } else focusFeature(t, r);
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
    for (const id of ["banjir-lapor", "peringatan-fill", "bnpb-fill"]) {
      map.on("mouseenter", id, () => { map.getCanvas().style.cursor = "pointer"; });
      map.on("mouseleave", id, () => { map.getCanvas().style.cursor = ""; });
    }
    map.on("click", (e) => {
      const layers = ["laporan", "banjir-lapor", "gempa", "titik_panas", "bnpb-fill", "peringatan-fill", "wilayah-fill"]
        .filter((id) => map.getLayoutProperty(id, "visibility") !== "none");
      const hits = map.queryRenderedFeatures(e.point, { layers });
      if (!hits.length) return;
      let f = hits[0], layer = f.layer.id;
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
    const infoBtn = $("#info-btn");
    infoBtn.addEventListener("click", () => {
      const show = $("#info").hidden;
      $("#info").hidden = !show;
      infoBtn.setAttribute("aria-expanded", String(show));
      updateTopUI();
    });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape" && state.mode) setMode(null); });
    wireTicker();
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

  // ---------- wilayah ----------
  function regionStats(id) {
    const c = (x) => x.features.filter((f) => f.properties.wilayah_id === id).length;
    return { api: c(state.data.titik_panas), gempa: c(state.data.gempa), lapor: c(state.data.laporan) };
  }
  function showRegionPopup(p, lngLat) {
    const s = regionStats(p.id);
    const reps = state.data.laporan.features.filter((f) => f.properties.wilayah_id === p.id);
    // berita kejadian di wilayah ini: laporan warga + karhutla + gempa yang pusatnya di sini
    const seen = new Set();
    const news = [
      ...reps.flatMap((f) => state.berita[f.properties.id]?.berita || []),
      ...beritaApi(p.id),
      ...state.data.gempa.features.filter((f) => f.properties.wilayah_id === p.id).flatMap((f) => beritaGempa(f.properties)),
    ].filter((b) => !seen.has(b.judul) && seen.add(b.judul))
      .sort((a, b) => b.terbit.localeCompare(a.terbit)).slice(0, 8);
    popupAt(lngLat, `<div class="pop"><h3>${esc(p.nama)}</h3><div class="sub">${esc(p.provinsi)}</div>
      <div class="grid3"><div><b>${num(s.api)}</b><span>titik panas<br>24 jam</span></div>
      <div><b>${num(s.gempa)}</b><span>gempa<br>7 hari</span></div>
      <div><b>${num(s.lapor)}</b><span>laporan<br>7 hari</span></div></div>
      ${tabsHTML([{ id: "b", ic: "berita", label: "Berita kejadian", n: news.length,
        html: newsHTML(news, `Belum ada berita kejadian di ${p.nama}.`) }])}</div>`);
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
