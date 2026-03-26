const CACHE_NAME = 'auraprompt-v1-elite';

// Asset inti yang WAJIB dicache untuk offline fallback pertama kali
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  // CDN Resources
  'https://cdn.tailwindcss.com',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://unpkg.com/lucide@latest',
  'https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap'
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

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      // Return dari cache jika ada
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

      // Jika tidak ada di cache, coba fetch dari network
      return fetch(event.request).then((networkResponse) => {
        // Cache resources yang baru didapat agar offline siap sedia
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
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
        // Jika tidak, biarkan gagal (browser akan handle misal gambar rusak, dll)
      });
    })
  );
});