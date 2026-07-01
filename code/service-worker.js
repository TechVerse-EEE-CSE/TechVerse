// ══════════════════════════════════════
//  SERVICE WORKER — service-worker.js
//  অফলাইন সাপোর্ট: অ্যাপ + CDN লাইব্রেরি ক্যাশ করে
//  Firebase (Auth/Firestore) রিকোয়েস্ট সবসময় নেটওয়ার্কেই যাবে
// ══════════════════════════════════════

const CACHE_VERSION = 'tv-cache-v3'; // ← v3: username ফিল্ড যোগ হয়েছে, তাই ভার্সন বাম্প করা হলো

// ── নিজের অ্যাপের ফাইল (app shell) ──
const APP_SHELL = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.png',
  '/192x192.png',
  '/512x512.png',
  '/css/styles.css',
  '/css/toolbar.css',
  '/css/profile.css',
  '/css/share.css',
  '/css/privacy-policy.css',
  '/js/idb-store.js',
  '/js/editor.js',
  '/js/toolbar.js',
  '/js/auth.js',
  '/js/auth-ui.js',
  '/js/firestore-sync.js',
  '/js/pro-editor.js',
  '/js/project-manager.js',
  '/js/profile.js',
  '/js/username.js',
  '/js/share-ui.js',
  '/config/firebase-config.js',
];

// ── বাইরের CDN লাইব্রেরি (CodeMirror, Font Awesome, Google Fonts) ──
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
  // Firebase SDK (এগুলো static module ফাইল — না থাকলে offline এ import fail করে পুরো অ্যাপ ভেঙে যাবে)
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js',
  'https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js',
];

// ── এই ডোমেইনগুলো কখনো ক্যাশ করব না — সবসময় লাইভ নেটওয়ার্কে যাবে ──
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

// ══ INSTALL — app shell + CDN ফাইল ক্যাশ করো ══
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then(async (cache) => {
      // নিজের ফাইল — fail হলে পুরো ইনস্টল আটকে যাবে, তাই সাবধানে
      await cache.addAll(APP_SHELL).catch(err => console.warn('App shell cache failed:', err));
      // CDN ফাইল — একটাও fail করলেও বাকিগুলো যেন বাদ না যায়
      await Promise.all(
        CDN_SHELL.map(url =>
          fetch(url, { mode: 'cors' })
            .then(res => res.ok && cache.put(url, res))
            .catch(() => {/* অফলাইনে install হলে CDN ফাইল মিস হতে পারে, সমস্যা নেই */})
        )
      );
    })
  );
  self.skipWaiting();
});

// ══ ACTIVATE — পুরনো ক্যাশ ভার্সন মুছে ফেলো ══
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

  // Firebase/Firestore কল — কখনো ক্যাশ ইন্টারসেপ্ট করব না, সরাসরি নেটওয়ার্কে যাক
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

      // ক্যাশে থাকলে সাথে সাথে সেটা দেখাও (instant load), পেছনে আপডেট হতে থাকুক
      if (cached) {
        networkFetch; // fire and forget — পরের বার আপডেট ভার্সন পাওয়া যাবে
        return cached;
      }

      // ক্যাশে না থাকলে নেটওয়ার্ক চেষ্টা করো
      return networkFetch.then((res) => {
        if (res) return res;
        // অফলাইন এবং ক্যাশেও নেই — পেজ navigation হলে index.html ফেরত দাও
        if (request.mode === 'navigate') {
          return caches.match('/index.html');
        }
        return new Response('অফলাইন — এটি আগে থেকে নেই', { status: 503 });
      });
    })
  );
});
