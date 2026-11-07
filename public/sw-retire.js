// Retires the service worker on the OLD domain (frotzsmith.com, www too).
// public/_redirects serves this file for https://frotzsmith.com/sw.js; every
// other path there 301s to https://frotzsmith.frotzinc.com. Without it, a
// browser that visited frotzsmith.com before the move keeps its old worker,
// which answers navigations from the precache (navigateFallback) so the 301
// is never reached; and its update check can't help, since a sw.js that
// redirects to another origin fails. This worker installs as that update,
// clears the old caches, unregisters, and reloads open tabs: the reload goes
// to the network, which 301s to the new domain.
// Never registered by the app and never precached (nuxt.config.ts globIgnores).
self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) await caches.delete(key)
      await self.registration.unregister()
      for (const client of await self.clients.matchAll({ type: 'window' })) client.navigate(client.url)
    })(),
  )
})
