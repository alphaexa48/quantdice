const CACHE_NAME = 'diceforge-shell-v2';
const APP_SHELL = [
  '/',
  '/index.html',
  '/styles.css',
  '/app.js?v=20261027-01',
  '/pwa.js?v=2',
  '/manifest.webmanifest',
  '/icons/icon.svg',
  '/icons/icon-180.png',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/maskable-512.png'
];

const OFFLINE_PAGE = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="theme-color" content="#202020">
  <title>DiceForge · Offline</title>
  <style>
    :root{color-scheme:dark}
    body{margin:0;min-height:100vh;display:grid;place-items:center;background:linear-gradient(150deg,#111,#252525 55%,#191919);color:#f0f2f5;font-family:system-ui,sans-serif}
    main{max-width:420px;margin:24px;padding:28px;border:1px solid #565656;border-radius:18px;background:#242424;box-shadow:0 18px 50px #0008;text-align:center}
    span{font-size:42px}
    h1{font-size:22px;margin:14px 0 8px}
    p{color:#aaa;font-size:13px;line-height:1.6}
    button{margin-top:14px;padding:12px 18px;border:1px solid #ffc928;border-radius:10px;background:#ffc928;color:#171717;font-weight:700;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <span>⚄</span>
    <h1>Koneksi terputus</h1>
    <p>DiceForge perlu koneksi untuk memperbarui saldo dan menjalankan bot. App shell tetap tersedia dan akan tersambung kembali saat jaringan pulih.</p>
    <button type="button" onclick="location.reload()">COBA LAGI</button>
  </main>
</body>
</html>`;

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(APP_SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)));
    await self.clients.claim();
  })());
});

async function offlineResponse() {
  return (await caches.match('/index.html'))
    || (await caches.match('/'))
    || new Response(OFFLINE_PAGE, { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

async function networkFirstNavigation(request) {
  try {
    const response = await fetch(request);
    if (response && response.ok) {
      try {
        const cache = await caches.open(CACHE_NAME);
        await cache.put('/index.html', response.clone());
      } catch {
        // A failed cache write must not block the live page.
      }
    }
    return response;
  } catch {
    return offlineResponse();
  }
}

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirstNavigation(request));
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    const update = fetch(request)
      .then(async (response) => {
        if (response && response.ok && response.type === 'basic') {
          try { await cache.put(request, response.clone()); } catch {}
        }
        return response;
      })
      .catch(() => null);
    if (cached) {
      event.waitUntil(update);
      return cached;
    }
    return (await update) || new Response('', { status: 503, statusText: 'Offline' });
  })());
});

self.addEventListener('message', (event) => {
  if (event.data === 'SKIP_WAITING') self.skipWaiting();
});
