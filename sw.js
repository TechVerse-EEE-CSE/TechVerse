// ── Service Worker: sw.js ──
// ওয়েবসাইটের root-এ রাখুন

const CACHE_NAME = 'offline-v1';
const OFFLINE_PAGE = '/offline.html';

// ইন্সটলেশনে অফলাইন পেজ cache করা হয়
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll([OFFLINE_PAGE]);
    })
  );
  self.skipWaiting();
});

// পুরনো cache পরিষ্কার
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((k) => k !== CACHE_NAME)
          .map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch: navigate request fail হলে offline page দেখাও
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_PAGE).then((res) => res || new Response('Offline'))
    )
  );
});
