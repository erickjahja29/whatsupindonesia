/* Service worker What'sUpIndonesia: syarat "pasang di HP".
   Selalu tanya server dulu, tanpa memakai simpanan HTTP browser (GitHub Pages menyuruh simpan 10 menit),
   supaya pengguna — termasuk yang memasang aplikasi — selalu mendapat versi & data terbaru.
   Server cukup menjawab "tidak berubah" (304) bila memang tidak ada yang baru, jadi tetap hemat kuota.
   Salinan terakhir hanya dipakai saat offline. */
const CACHE = "wui-v2";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const u = new URL(req.url);
  if (req.method !== "GET" || u.origin !== self.location.origin) return;
  // halaman, kode, data: selalu periksa ke server (no-cache = boleh pakai simpanan hanya setelah server bilang belum berubah)
  // (pakai URL, bukan objek request: request navigasi halaman tidak boleh dibuat ulang dengan opsi baru)
  e.respondWith(fetch(req.url, { cache: "no-cache" }).then((r) => {
    // halaman yang dialihkan server: teruskan sebagai pengalihan (browser menolak jawaban "sudah dialihkan" untuk navigasi)
    if (r.redirected && req.mode === "navigate") return Response.redirect(r.url, 302);
    if (r.ok) { const c = r.clone(); caches.open(CACHE).then((x) => x.put(req, c)); }
    return r;
  }).catch(() => caches.match(req, { ignoreSearch: true })));
});
