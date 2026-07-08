// VitalSync Service Worker - versão mínima compatível iOS
const CACHE_NAME = 'vitalsync-v1';

// Instalar - não faz cache no install (deixa o fetch fazer)
self.addEventListener('install', function(event) {
  self.skipWaiting();
});

// Ativar - limpa caches antigos
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(function() {
      return self.clients.claim();
    })
  );
});

// Fetch - estratégia: network first, cache fallback
self.addEventListener('fetch', function(event) {
  // Só cachear requests GET
  if (event.request.method !== 'GET') return;
  
  event.respondWith(
    fetch(event.request)
      .then(function(response) {
        // Se a resposta é válida, guardar em cache
        if (response && response.status === 200 && response.type === 'basic') {
          var responseClone = response.clone();
          caches.open(CACHE_NAME).then(function(cache) {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(function() {
        // Se falhar (offline), tenta o cache
        return caches.match(event.request);
      })
  );
});

