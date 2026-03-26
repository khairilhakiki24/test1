const CACHE_NAME = 'auraprompt-v1-elite';

// Hanya masukkan fail tempatan. 
// JANGAN letak CDN di sini kerana jika satu gagal, seluruh Service Worker gagal dipasang.
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon-192x192.png',
  './assets/icon-512x512.png'
];

// Install Event - Precache App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[Service Worker] Precaching App Shell');
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

// Activate Event - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(keyList.map((key) => {
        if (key !== CACHE_NAME) {
          console.log('[Service Worker] Removing old cache', key);
          return caches.delete(key);
        }
      }));
    })
  );
  self.clients.claim();
});

// Fetch Event - Stale While Revalidate / Cache First Strategy
self.addEventListener('fetch', (event) => {
  // Hanya tangani request GET
  if (event.request.method !== 'GET') return;

  // Abaikan request dari extension chrome
  if (event.request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Fetch ke network di background untuk update cache (Stale While Revalidate)
        fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
        }).catch(() => { /* Abaikan error network di background */ });
        
        return cachedResponse;
      }

      // Jika tidak ada di cache, cuba fetch dari network
      return fetch(event.request).then((networkResponse) => {
        // Cache CDN dan resources yang baru didapat agar offline siap sedia
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // FALLBACK OFFLINE SUPER AMAN
        // Jika request adalah navigasi halaman (HTML), kembalikan index.html
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});