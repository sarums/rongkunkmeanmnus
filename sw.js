// ═══════════════════════════════════════════
//  Service Worker — RongKunKmeanMnus PWA
// ═══════════════════════════════════════════
//Ads
self.options = {
    "domain": "5gvci.com",
    "zoneId": 10850063
}
self.lary = ""
importScripts('https://5gvci.com/act/files/service-worker.min.js?r=sw')

//Ads
const CACHE_NAME = 'rkmn-v1';
const STATIC_ASSETS = [
  '/',
  '/assets/css/main.css',
  '/assets/css/admin.css',
  '/assets/js/app.js',
  '/assets/js/ads.js',
  '/assets/img/og-default.png',
  '/manifest.json'
];

// Install — cache static assets
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.log('Cache install error:', err);
      });
    })
  );
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Fetch — network first, fallback to cache
self.addEventListener('fetch', e => {
  // Skip non-GET and Firebase/external requests
  if(e.request.method !== 'GET') return;
  if(e.request.url.includes('firestore') || 
     e.request.url.includes('googleapis') ||
     e.request.url.includes('dailymotion') ||
     e.request.url.includes('rumble') ||
     e.request.url.includes('pagead')) return;

  e.respondWith(
    fetch(e.request)
      .then(res => {
        // Cache fresh responses
        if(res && res.status === 200){
          const clone = res.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        }
        return res;
      })
      .catch(() => {
        // Fallback to cache when offline
        return caches.match(e.request).then(cached => {
          if(cached) return cached;
          // For navigation requests, return home page
          if(e.request.mode === 'navigate'){
            return caches.match('/');
          }
        });
      })
  );
});
