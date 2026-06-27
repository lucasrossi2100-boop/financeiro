// FinRossi SW v7 — força limpeza completa de cache
const CACHE_NAME = 'finrossi-v7';
const ASSETS = ['/', '/index.html'];

self.addEventListener('install', e => {
  // Limpa TODOS os caches antigos na instalação
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => caches.delete(k)))
    ).then(() =>
      caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(() => {}))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;
  if (url.includes('firebase') || url.includes('gstatic') ||
      url.includes('googleapis') || url.includes('railway.app')) return;

  // Sempre busca da rede para index.html
  if (url.endsWith('/') || url.includes('index.html') || url === self.registration.scope) {
    e.respondWith(
      fetch(e.request).then(r => {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        return r;
      }).catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais assets: rede primeiro
  e.respondWith(
    fetch(e.request).then(r => {
      if (r && r.status === 200 && r.type === 'basic') {
        const clone = r.clone();
        caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
