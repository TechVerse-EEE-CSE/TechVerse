// ══════════════════════════════════════
//  SERVICE WORKER — service-worker.js
//  Offline support: caches the app + CDN libraries
//  Firebase (Auth/Firestore) requests always go straight to the network
// ══════════════════════════════════════

const CACHE_VERSION = 'tv-cache-v7';

// ── This app's own files (app shell) ──
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/192x192.png',
  '/512x512.png',
  '/css/styles.css',
  '/css/toolbar.css',
  '/js/idb-store.js',
  '/js/editor.js',
  '/js/toolbar.js',
  '/js/auth.js',
  '/js/auth-ui.js',
  '/js/firestore-sync.js',
  '/js/pro-editor.js',
  '/config/firebase-config.js',
];

// ── External CDN libraries (CodeMirror, Font Awesome, Google Fonts) ──
const CDN_SHELL = [
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Fira+Code:wght@400;500&family=JetBrains+Mono:wght@400;500&family=Inter:wght@300;400;500;600;700&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/material-ocean.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/dracula.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/monokai.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/nord.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/solarized.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/theme/night.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/codemirror.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/xml/xml.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/css/css.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/mode/javascript/javascript.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/edit/closetag.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/edit/closebrackets.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/search/search.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/search/searchcursor.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/codemirror/5.65.13/addon/edit/matchbrackets.min.js',
  // Firebase SDK (these are static module files — without them, imports fail offline and break the whole app)
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js',
];

// ── Never cache these domains — always go to the live network ──
const NEVER_CACHE = [
  'firestore.googleapis.com',
  'identitytoolkit.googleapis.com',
  'securetoken.googleapis.com',
  'firebasestorage.googleapis.com',
  'googleapis.com/identitytoolkit',
];

function isNeverCache(url) {
  return NEVER_CACHE.some(host => url.includes(host));
}

// ══ INSTALL — cache the app shell + CDN files ══
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // Own files — a failure here blocks the entire install, so be careful
      await cache.addAll(APP_SHELL).catch(err => console.warn('App shell cache failed:', err));
      // CDN files — don't let a single failure drop the rest
      await Promise.all(
        CDN_SHELL.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => res.ok && cache.put(url, res))
            .catch(() => {/* CDN files may be missed if installing offline, that's fine */})
        )
      );
    })
  );
  self.skipWaiting();
});

// ══ ACTIVATE — delete old cache versions ══
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// ══ FETCH — cache-first + background update (stale-while-revalidate) ══
self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = request.url;

  // Firebase/Firestore calls — never intercept with cache, go straight to the network
  if (isNeverCache(url)) return;

  event.respondWith(
    caches.match(request).then((cached) => {
      const networkFetch = fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(CACHE_VERSION).then(cache => cache.put(request, clone));
          }
          return res;
        })
        .catch(() => null);

      // If it's in the cache, show it immediately (instant load), and keep updating in the background
      if (cached) {
        networkFetch; // fire and forget — the updated version will be available next time
        return cached;
      }

      // If not in the cache, try the network
      return networkFetch.then((res) => {
        if (res) return res;
        // Offline and not in the cache either — return index.html for page navigation
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('Offline — this is not available', { status: 503 });
      });
    })
  );
});
