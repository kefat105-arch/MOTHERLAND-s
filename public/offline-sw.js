// MOTHERLAND Lightweight Offline Service Worker (handles app shell, Range video requests, and cached API feeds)
const SHELL_CACHE = 'motherland-app-shell-v1';
const MEDIA_CACHE = 'motherland-offline-media-v1';
const API_CACHE = 'motherland-api-feed-v1';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(['/', '/index.html', '/icon.svg', '/pwa-192x192.png']).catch(() => {});
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

async function buildRangeResponse(request, cachedResponse) {
  const rangeHeader = request.headers.get('range');
  if (!rangeHeader || !cachedResponse) return cachedResponse;

  try {
    const buf = await cachedResponse.arrayBuffer();
    const total = buf.byteLength;
    const match = /bytes=(\d+)-(\d*)/.exec(rangeHeader);
    if (!match) return cachedResponse;

    const start = Number(match[1]);
    const end = match[2] ? Math.min(Number(match[2]), total - 1) : total - 1;
    if (Number.isNaN(start) || start >= total || start > end) {
      return new Response(null, {
        status: 416,
        headers: { 'Content-Range': `bytes */${total}` },
      });
    }

    const sliced = buf.slice(start, end + 1);
    const headers = new Headers(cachedResponse.headers);
    headers.set('Content-Range', `bytes ${start}-${end}/${total}`);
    headers.set('Content-Length', String(sliced.byteLength));
    headers.set('Accept-Ranges', 'bytes');
    if (!headers.get('Content-Type')) {
      headers.set('Content-Type', 'video/mp4');
    }

    return new Response(sliced, {
      status: 206,
      statusText: 'Partial Content',
      headers,
    });
  } catch {
    return cachedResponse;
  }
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);

  // Skip WebSockets, Vite HMR pings, and Chrome extensions
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;
  if (url.pathname.startsWith('/ws') || url.searchParams.has('t') && url.pathname.includes('@vite')) return;

  // 1. Uploaded & Offline Media Video Files (/uploads/, /api/media/file/, /api/helper-bd/stream)
  if (
    url.pathname.startsWith('/uploads/') ||
    url.pathname.startsWith('/api/media/') ||
    url.pathname.startsWith('/api/helper-bd/stream')
  ) {
    event.respondWith(
      (async () => {
        const mediaCache = await caches.open(MEDIA_CACHE);
        const cacheKey = url.pathname + url.search;
        const cached =
          (await mediaCache.match(cacheKey)) ||
          (await mediaCache.match(url.pathname)) ||
          (await mediaCache.match(req));

        try {
          const networkRes = await fetch(req);
          // Cache full 200 OK responses automatically (skip 206 partial streams unless full fetch done)
          if (networkRes && networkRes.status === 200 && !req.headers.get('range')) {
            mediaCache.put(cacheKey, networkRes.clone()).catch(() => {});
          }
          return networkRes;
        } catch {
          if (cached) {
            return buildRangeResponse(req, cached);
          }
          return new Response('Offline media unavailable', { status: 503 });
        }
      })()
    );
    return;
  }

  // 2. Read-only Offline Feed APIs (Posts, Stories, Videos)
  if (
    url.origin === self.location.origin &&
    (url.pathname === '/api/posts' ||
      url.pathname === '/api/stories' ||
      url.pathname.startsWith('/api/videos/') ||
      url.pathname === '/api/auth/me')
  ) {
    event.respondWith(
      (async () => {
        const apiCache = await caches.open(API_CACHE);
        try {
          const res = await fetch(req);
          if (res && res.ok) {
            apiCache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await apiCache.match(req);
          if (cached) return cached;
          return new Response(JSON.stringify({ offline: true }), {
            status: 503,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      })()
    );
    return;
  }

  // Skip other /api/ calls
  if (url.origin === self.location.origin && url.pathname.startsWith('/api/')) {
    return;
  }

  // 3. App Shell & Static Assets (Same-Origin NetworkFirst so dev + offline reload both work)
  if (url.origin === self.location.origin) {
    event.respondWith(
      (async () => {
        const shellCache = await caches.open(SHELL_CACHE);
        try {
          const res = await fetch(req);
          if (res && res.status === 200) {
            shellCache.put(req, res.clone()).catch(() => {});
          }
          return res;
        } catch {
          const cached = await shellCache.match(req);
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return (
              (await shellCache.match('/')) ||
              (await shellCache.match('/index.html')) ||
              new Response('Offline', { status: 503 })
            );
          }
          return new Response('', { status: 503 });
        }
      })()
    );
  }
});
