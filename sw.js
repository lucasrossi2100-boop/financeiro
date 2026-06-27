const CACHE_NAME = 'finrossi-v5';
const ASSETS = [
  '/',
  '/index.html',
  '/landing.html',
  'https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:opsz,wght@9..40,300;9..40,400;9..40,500&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js'
];

// Instala e faz cache
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(ASSETS).catch(() => {}))
      .then(() => self.skipWaiting()) // ativa imediatamente sem esperar
  );
});

// Limpa caches antigos e assume controle imediato
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim()) // assume controle de todas as abas abertas
  );
});

// Busca rede primeiro, cache como fallback
self.addEventListener('fetch', e => {
  const url = e.request.url;

  // Nunca faz cache de Firebase, auth, APIs externas
  if (url.includes('firebase') || url.includes('gstatic') ||
      url.includes('googleapis.com') || url.includes('railway.app') ||
      url.includes('resend.com')) {
    return;
  }

  // Para o index.html — sempre busca da rede primeiro
  if (url.endsWith('/') || url.includes('index.html')) {
    e.respondWith(
      fetch(e.request)
        .then(response => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
          return response;
        })
        .catch(() => caches.match(e.request))
    );
    return;
  }

  // Demais assets: cache primeiro, atualiza em background
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetchPromise = fetch(e.request).then(response => {
        if (response && response.status === 200 && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return response;
      });
      return cached || fetchPromise;
    })
  );
});

// Recebe mensagem do app para pular espera
self.addEventListener('message', e => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
