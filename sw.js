// FinRossi SW v9
const CACHE_NAME = 'finrossi-v9';
const ASSETS = ['/', '/index.html'];

// URLs que NUNCA devem ser interceptadas pelo SW
const BYPASS = [
  'firebase', 'firebaseio', 'firebaseapp', 'googleapis',
  'gstatic', 'railway.app', 'resend.com', 'cdnjs.cloudflare.com',
  'fonts.googleapis', 'fonts.gstatic'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.map(k => caches.delete(k))))
      .then(() => caches.open(CACHE_NAME).then(c => c.addAll(ASSETS).catch(()=>{})))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Ignora completamente tudo que não é do próprio site
  if (BYPASS.some(b => url.includes(b))) return;
  if (!url.startsWith(self.location.origin)) return;

  // index.html — sempre da rede
  if (url.endsWith('/') || url.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(r => {
          if (r && r.status === 200) {
            caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
          }
          return r;
        })
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // Demais assets locais
  e.respondWith(
    fetch(e.request)
      .then(r => {
        if (r && r.status === 200 && r.type === 'basic') {
          caches.open(CACHE_NAME).then(c => c.put(e.request, r.clone()));
        }
        return r;
      })
      .catch(() => caches.match(e.request))
  );
});

self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
