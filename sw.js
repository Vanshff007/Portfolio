/* ── Service worker: offline support ─────────────────────────────
   Network first for every same-origin GET, so visitors always get the
   latest deploy when online; the cached copy is the fallback when the
   network fails or takes longer than NET_TIMEOUT. The page sends the list
   of files it loaded (see core.js), so the cache needs no hand-kept list.
   Cross-origin requests (GitHub API, Spotify, fonts CDN…) are left alone.
────────────────────────────────────────────────────────────────── */
const CACHE = 'site-v1';
const NET_TIMEOUT = 4000;

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.add('./')).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// The page posts the same-origin URLs it already loaded, to be cached for offline use
self.addEventListener('message', e => {
  if (e.data?.type !== 'cache-urls') return;
  const urls = e.data.urls.filter(u => new URL(u).origin === location.origin);
  e.waitUntil(caches.open(CACHE).then(c => Promise.all(urls.map(u => c.add(u).catch(() => {})))));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const net = fetch(req);
  // Save fresh copies in the background. The clone happens before the page reads the body.
  e.waitUntil(net.then(res => {
    if (!res.ok || res.type !== 'basic') return;
    const copy = res.clone();
    return caches.open(CACHE).then(c => c.put(req, copy));
  }).catch(() => {}));
  e.respondWith(respond(req, net));
});

async function respond(req, net) {
  const cached = () => caches.match(req, { ignoreSearch: true });
  try {
    // Slow network: serve the cached copy if there is one, else keep waiting
    const fast = await Promise.race([net, new Promise(r => setTimeout(r, NET_TIMEOUT))]);
    return fast || (await cached()) || await net;
  } catch {
    const hit = await cached();
    if (hit) return hit;
    // Offline navigation to a page that isn't cached: fall back to the home page
    if (req.mode === 'navigate') return (await caches.match('./')) || Response.error();
    return Response.error();
  }
}
