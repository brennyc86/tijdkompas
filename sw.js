// Tijdkompas service worker: netwerk eerst, cache als terugval (offline bruikbaar)
const CACHE = "tijdkompas-v54";
const SCHIL = ["./", "index.html", "style.css", "js/app.js", "js/data.js", "js/plan.js", "js/koppeling.js", "js/sync.js", "js/takensync.js", "js/cloud.js", "js/schijf.js", "js/emoji.js", "js/config.js", "js/veilig.js", "js/vendor/msal-browser-3.28.1.min.js", "auth.html", "icon.svg", "manifest.webmanifest"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SCHIL))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(x => x !== CACHE).map(x => caches.delete(x))))); self.clients.claim(); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET" || new URL(e.request.url).origin !== location.origin) return;
  // altijd bij de server navragen (niet de 10 minuten browsercache van GitHub Pages), zodat een update meteen zichtbaar is
  const vers = e.request.mode === "navigate" ? fetch(e.request.url, { cache: "no-cache" }) : fetch(new Request(e.request, { cache: "no-cache" }));
  // Alleen geslaagde antwoorden van de eigen site bewaren: nooit een foutpagina (404/500) of doorverwijzing in de cache,
  // en bij een fout van de server liever de laatst goede versie tonen.
  e.respondWith(vers.then(r => {
    if (r.ok && r.type === "basic" && !r.redirected) { const kopie = r.clone(); caches.open(CACHE).then(c => c.put(e.request, kopie)); return r; }
    return caches.match(e.request, { ignoreSearch: true }).then(oud => oud || r);
  }).catch(() => caches.match(e.request, { ignoreSearch: true })));
});
