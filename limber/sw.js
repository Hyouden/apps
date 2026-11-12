// Limber moved to ../method/. This worker deletes the old offline copy and removes itself.
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith("limber-")).map(k => caches.delete(k))))
    .then(() => self.registration.unregister()));
});
