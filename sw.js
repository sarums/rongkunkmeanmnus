// ═══════════════════════════════════════════
//  Service Worker — RongKunKmeanMnus PWA
//  v4 — Cache-first for assets, network-first for pages
// ═══════════════════════════════════════════

const CACHE_NAME   = 'rkmn-v4';
const ASSET_CACHE  = 'rkmn-assets-v4';

// Static assets — cache forever (immutable)
const STATIC_ASSETS = [
  '/',
  '/assets/css/main.css',
  '/assets/js/app.js',
  '/assets/js/ads.js',
  '/assets/img/og-default.png',
  '/manifest.json',
];

// ── Install ──
self.addEventListener('install', e=>{
  e.waitUntil(
    caches.open(ASSET_CACHE)
      .then(cache=>cache.addAll(STATIC_ASSETS).catch(()=>{}))
      .then(()=>self.skipWaiting())
  );
});

// ── Activate ──
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys
        .filter(k=>k!==CACHE_NAME && k!==ASSET_CACHE)
        .map(k=>caches.delete(k))
      )
    ).then(()=>self.clients.claim())
  );
});

// ── Fetch ──
self.addEventListener('fetch', e=>{
  const req = e.request;
  const url = new URL(req.url);

  // Skip non-GET
  if(req.method!=='GET') return;

  // Skip external APIs — always network
  if(
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebaseapp.com') ||
    url.hostname.includes('dailymotion.com') ||
    url.hostname.includes('rumble.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('vimeo.com') ||
    url.hostname.includes('pagead2.googlesyndication.com') ||
    url.hostname.includes('gstatic.com')
  ) return;

  // CSS/JS/Images — cache first, then network
  if(
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2')
  ){
    e.respondWith(
      caches.match(req).then(cached=>{
        if(cached) return cached;
        return fetch(req).then(res=>{
          if(res && res.status===200){
            const clone=res.clone();
            caches.open(ASSET_CACHE).then(c=>c.put(req,clone));
          }
          return res;
        });
      })
    );
    return;
  }

  // HTML pages — network first, fallback to cache
  e.respondWith(
    fetch(req)
      .then(res=>{
        if(res && res.status===200){
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(req,clone));
        }
        return res;
      })
      .catch(()=>{
        return caches.match(req).then(cached=>{
          if(cached) return cached;
          if(req.mode==='navigate') return caches.match('/');
        });
      })
  );
});
