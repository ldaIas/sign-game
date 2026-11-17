// Network-first service worker: always try for the latest deploy, and fall back
// to the last cached copy when offline so the installed app still opens.
const CACHE = "zodle-v2";
const SHELL = [
  "./", "index.html", "style.css", "signs.js", "sky.js", "daily.js", "game.js",
  "install.js", "about.js", "favicon.svg", "manifest.webmanifest", "icon-192.png",
];
// Files for crawlers and link previews. The worker leaves these to the network, so
// they're never answered from a stale cache or with the index.html offline fallback.
const BYPASS = ["/robots.txt", "/sitemap.xml", "/og-image.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const { request } = event;
  const url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== location.origin) return;
  if (BYPASS.includes(url.pathname)) return;
  event.respondWith(
    fetch(request)
      .then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then(hit => hit || (request.mode === "navigate" ? caches.match("index.html") : undefined))
        .then(hit => hit || Response.error()))
  );
});
