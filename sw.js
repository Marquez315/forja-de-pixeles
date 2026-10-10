/* Service worker: deja la app disponible sin conexión.
   Cuando cambies cualquier archivo del sitio, sube el número de VERSION para que los dispositivos se actualicen. */
const VERSION = 'forja-pixel-v2-3';
const FILES = ['./', 'index.html', 'manifest.webmanifest', 'css/app.css', 'js/core.js', 'js/game.js', 'js/ia.js', 'js/app.js',
  'icons/icon-192.png', 'icons/icon-512.png', 'proyectos/index.json'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== VERSION).map(n => caches.delete(n)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const r = e.request;
  if (r.method !== 'GET') return;
  const u = new URL(r.url);
  const sameOrigin = u.origin === location.origin;
  const fonts = u.hostname === 'fonts.googleapis.com' || u.hostname === 'fonts.gstatic.com';
  if (!sameOrigin && !fonts) return;
  // Red primero (así ves los cambios al publicar) y, si no hay conexión, lo guardado.
  e.respondWith(fetch(r).then(res => {
    if (res.ok) { const cp = res.clone(); caches.open(VERSION).then(c => c.put(r, cp)); }
    return res;
  }).catch(() => caches.match(r, { ignoreSearch: true }).then(h => h || (r.mode === 'navigate' ? caches.match('index.html') : Response.error()))));
});
