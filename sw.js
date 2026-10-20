/* Service worker: simpan app, pustaka MediaPipe dan model AI supaya boleh guna tanpa internet. */
const APP = "cpr-app-v1";
const RUNTIME = "cpr-runtime-v1";
const SHELL = ["./", "index.html", "cpr-core.js", "manifest.webmanifest", "icon-192.png", "icon-512.png"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(APP).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => ![APP, RUNTIME].includes(k)).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET") return;

  // Pustaka & model (versi dipin, tidak berubah): cache dahulu
  if (url.hostname === "cdn.jsdelivr.net" || url.hostname === "storage.googleapis.com") {
    e.respondWith(caches.open(RUNTIME).then(async (c) => {
      const hit = await c.match(e.request);
      if (hit) return hit;
      const res = await fetch(e.request);
      if (res.ok) c.put(e.request, res.clone());
      return res;
    }));
    return;
  }

  // Fail app: rangkaian dahulu (dapat kemas kini), jatuh balik ke cache bila luar talian
  if (url.origin === self.location.origin) {
    e.respondWith(fetch(e.request)
      .then((res) => { const copy = res.clone(); caches.open(APP).then((c) => c.put(e.request, copy)); return res; })
      .catch(() => caches.match(e.request).then((r) => r || caches.match("index.html"))));
  }
});
