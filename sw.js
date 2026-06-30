/* ════════════════════════════════════════════════════════
   sw.js  —  Service Worker
   Place this file at your website ROOT (e.g. /sw.js)
════════════════════════════════════════════════════════ */

const CACHE_VERSION = 'tv-cache-v1';

// ── নিজের অ্যাপের ফাইল (app shell) ──
const APP_SHELL = [
   '/offline.html';
   '/style.css';
   '/config.js';
   '/script.js';
   '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/192x192.png',
  '/512x512.png',

/* ── INSTALL: pre-cache the offline page ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll([OFFLINE_URL]))
      .then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: remove stale caches ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k !== CACHE_NAME)
            .map((k)   => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/* ── FETCH: intercept page navigations ── */
self.addEventListener('fetch', (event) => {
  // Only handle full-page navigations (GET)
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Successful fetch  —  tell the offline page we're back online
        notifyClients('SW_ONLINE');
        return response;
      })
      .catch(() => {
        // Network failed  —  serve the cached offline page
        return caches.match(OFFLINE_URL)
          .then((cached) => cached || new Response('You are offline.', {
            status: 503,
            headers: { 'Content-Type': 'text/plain' }
          }));
      })
  );
});

/* ── Helper: broadcast a message to all open tabs ── */
function notifyClients(type) {
  self.clients.matchAll({ includeUncontrolled: true, type: 'window' })
    .then((clients) => clients.forEach((c) => c.postMessage({ type })));
}
