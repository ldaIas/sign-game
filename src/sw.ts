/// <reference lib="webworker" />
// Network-first service worker: always try for the latest deploy, and fall back
// to the last cached copy when offline so the installed app still opens.
//
// vite-plugin-pwa (injectManifest) builds this to /sw.js and replaces
// self.__WB_MANIFEST with the list of built files and their revisions.

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: Array<{ url: string; revision: string | null }>;
};

const MANIFEST = self.__WB_MANIFEST;
const SHELL = ["./", ...MANIFEST.map(entry => entry.url)];
// Named after the build, so each deploy fills a fresh cache and drops the old ones.
const CACHE = `zodle-${hash(JSON.stringify(MANIFEST))}`;
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

// FNV-1a, enough to tell builds apart.
function hash(text: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193);
  return (h >>> 0).toString(36);
}
