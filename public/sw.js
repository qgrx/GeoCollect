const CACHE = 'geocoins-v2'
const STATIC = ['/', '/index.html']

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting()))
})

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
  ).then(() => self.clients.claim()))
})

self.addEventListener('fetch', e => {
  const url = e.request.url
  // Ne pas intercepter : API, socket, cross-origin
  if (url.includes('/api/') || url.includes('socket.io') || !url.startsWith(self.location.origin)) return
  // Réseau d'abord ; fallback cache avec Response.error() si rien en cache (pas de rejet non géré)
  e.respondWith(
    fetch(e.request).catch(() =>
      caches.match(e.request).then(r => r || new Response('', { status: 404, statusText: 'Not Found' }))
    )
  )
})

// Notifications push
self.addEventListener('push', e => {
  const data = e.data?.json() || {}
  e.waitUntil(self.registration.showNotification(data.title || '🗺️ Geocoins', {
    body: data.body || 'Nouvelle carte disponible !',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: data.tag || 'geocards',
    data: { url: data.url || '/' },
  }))
})

self.addEventListener('notificationclick', e => {
  e.notification.close()
  e.waitUntil(clients.matchAll({ type: 'window' }).then(cs => {
    const c = cs.find(x => x.url === '/' && 'focus' in x)
    return c ? c.focus() : clients.openWindow('/')
  }))
})
