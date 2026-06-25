const CACHE_NAME = 'finrossi-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Nunca faz cache de Firebase, auth, APIs
  const url = e.request.url;
  if (url.includes('firebase') || url.includes('gstatic') || 
      url.includes('googleapis.com/identitytoolkit') ||
      url.includes('railway.app') || url.includes('api.')) {
    return;
  }
  e.respondWith(
    caches.match(e.request).then(cached => {
      return fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      }).catch(() => cached || new Response('Offline', {status: 503}));
    })
  );
});
