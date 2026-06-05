const CACHE_NAME = 'diganta-pathagar-v4';
const OFFLINE_URL = '/Diganta-Pathagar/offline.html';

const STATIC_ASSETS = [
  '/Diganta-Pathagar/',
  '/Diganta-Pathagar/index.html',
  '/Diganta-Pathagar/manifest.json',
  '/Diganta-Pathagar/icon-192.png',
  '/Diganta-Pathagar/icon-512.png',
  OFFLINE_URL,
];

const NETWORK_ONLY = [
  'firebase',
  'firebaseio.com',
  'googleapis.com',
  'gstatic.com',
  'firebaseapp.com',
  'anthropic.com',
];

const isNetworkOnly = (url) => NETWORK_ONLY.some(h => url.includes(h));

// ── INSTALL ──
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(STATIC_ASSETS).catch(() => {})
    )
  );
  self.skipWaiting();
});

// ── ACTIVATE — clean old caches ──
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── FETCH ──
self.addEventListener('fetch', e => {
  const { request } = e;

  // GET only
  if (request.method !== 'GET') return;

  // Firebase, Google APIs — always network, no cache
  if (isNetworkOnly(request.url)) return;

  // HTML pages — Network first, fallback to cache, then offline page
  if (request.headers.get('accept')?.includes('text/html')) {
    e.respondWith(
      fetch(request)
        .then(res => {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
          return res;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached || caches.match(OFFLINE_URL);
        })
    );
    return;
  }

  // Static assets (icons, manifest, fonts) — Cache first, then network
  e.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(res => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(request, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});

// ── PUSH NOTIFICATION ──
self.addEventListener('push', e => {
  if (!e.data) return;
  let data = {};
  try { data = e.data.json(); } catch { data = { title: 'দিগন্ত পাঠাগার', body: e.data.text() }; }

  e.waitUntil(
    self.registration.showNotification(data.title || 'দিগন্ত পাঠাগার', {
      body: data.body || '',
      icon: '/Diganta-Pathagar/icon-192.png',
      badge: '/Diganta-Pathagar/icon-192.png',
      vibrate: [200, 100, 200],
      data: { url: data.url || '/Diganta-Pathagar/' },
      actions: [
        { action: 'open', title: 'দেখুন' },
        { action: 'close', title: 'বন্ধ করুন' },
      ],
    })
  );
});

// ── NOTIFICATION CLICK ──
self.addEventListener('notificationclick', e => {
  e.notification.close();
  if (e.action === 'close') return;
  const url = e.notification.data?.url || '/Diganta-Pathagar/';
  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const existing = list.find(c => c.url.includes('Diganta-Pathagar'));
      if (existing) return existing.focus();
      return clients.openWindow(url);
    })
  );
});
