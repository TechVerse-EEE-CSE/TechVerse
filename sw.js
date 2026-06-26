const CACHE_NAME = 'offline-cache-v1';
const OFFLINE_URL = 'offline.html';

// ১. ইনস্টল করার সময় offline.html ক্যাশ করে রাখা
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.add(OFFLINE_URL);
        })
    );
});

// ২. ইন্টারনেট না থাকলে ক্যাশ থেকে offline.html দেখানো
self.addEventListener('fetch', (event) => {
    if (event.request.mode === 'navigate') {
        event.respondWith(
            fetch(event.request).catch(() => {
                return caches.match(OFFLINE_URL);
            })
        );
    }
});
