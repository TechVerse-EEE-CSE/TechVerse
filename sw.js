// আপনার sw.js-এ এটা দিন:
self.addEventListener('fetch', e => {
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match('/offline.html')
    )
  );
});