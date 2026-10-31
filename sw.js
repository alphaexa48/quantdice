const CACHE = 'diceforge-shell-v2';
const CORE = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon-32.png'
];
const OFFLINE_HTML = `<!doctype html><html lang="id"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>DiceForge · Offline</title><style>html,body{height:100%;margin:0}body{display:grid;place-items:center;background:#161616;color:#f0f2f5;font:15px/1.6 system-ui,sans-serif;text-align:center;padding:24px}.box{max-width:420px}.mark{width:64px;height:64px;margin:0 auto 20px;display:grid;place-items:center;border-radius:18px;background:#ffc928;color:#171717;font-size:34px;font-weight:700}h1{font-size:22px;margin:0 0 8px}p{color:#a7a7a7;margin:0 0 20px}button{height:42px;padding:0 20px;border:0;border-radius:10px;background:#ffc928;color:#171717;font-weight:700;cursor:pointer}</style></head><body><div class="box"><div class="mark">⚄</div><h1>You're offline</h1><p>DiceForge needs a connection for live rolls and account data. Reconnect, then try again.</p><button onclick="location.reload()">Retry</button></div></body></html>`;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(CORE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put('/index.html', response.clone());
    return response;
  } catch {
    return (await caches.match(request)) ||
      (await cache.match('/index.html')) ||
      (await cache.match('/')) ||
      new Response(OFFLINE_HTML, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const url = new URL(request.url);
  let cached = await cache.match(request);
  if (!cached) cached = await cache.match(url.pathname);
  const network = fetch(request)
    .then(response => {
      if (response && response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => cached);
  return cached || network;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }

  event.respondWith(staleWhileRevalidate(request));
});
