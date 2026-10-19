// A single worker for the whole origin. No offline cache until versioning is designed.
self.addEventListener('install', event => event.waitUntil(self.skipWaiting()));
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => /^(polymath-os-|studio-polymath-|leo-|library-|rpg-)/.test(key))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
// Intentionally no fetch handler: Chromium uses the current server response.
