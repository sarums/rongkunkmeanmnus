// ═══════════════════════════════════════════
//  Service Worker — RongKunKmeanMnus PWA
//  v5 — Network first for HTML, Cache first for assets
// ═══════════════════════════════════════════

const CACHE_NAME  = 'rkmn-v9';
const ASSET_CACHE = 'rkmn-assets-v9';

// Static assets to pre-cache
const STATIC_ASSETS = [
  '/assets/css/main.css',
  '/assets/js/app.js',
  '/assets/js/ads.js',
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

// ── Activate — delete old caches ──
self.addEventListener('activate', e=>{
  e.waitUntil(
    caches.keys().then(keys=>
      Promise.all(keys
        .filter(k=>k!==CACHE_NAME && k!==ASSET_CACHE)
        .map(k=>{ console.log('[SW] deleting old cache:', k); return caches.delete(k); })
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

  // Never cache admin
  if(url.pathname.startsWith('/admin') || url.pathname.endsWith('/admin.js')) return;

  // Skip external APIs — always network
  if(
    url.hostname.includes('firestore.googleapis.com') ||
    url.hostname.includes('firebase') ||
    url.hostname.includes('dailymotion.com') ||
    url.hostname.includes('rumble.com') ||
    url.hostname.includes('youtube.com') ||
    url.hostname.includes('vimeo.com') ||
    url.hostname.includes('googlesyndication.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('googleapis.com')
  ) return;

  // HTML pages — NETWORK FIRST
  // This ensures users always get fresh content on refresh
  if(
    req.mode==='navigate' ||
    url.pathname==='/' ||
    url.pathname.endsWith('.html')
  ){
    e.respondWith(
      fetch(req)
        .then(res=>{
          // Cache the fresh response
          if(res && res.status===200){
            const clone=res.clone();
            caches.open(CACHE_NAME).then(c=>c.put(req,clone));
          }
          return res;
        })
        .catch(()=>{
          // Offline fallback — serve cached version
          return caches.match(req) || caches.match('/');
        })
    );
    return;
  }

  // JS/CSS/Images — CACHE FIRST (fast load)
  // But revalidate in background to keep fresh
  if(
    url.pathname.startsWith('/assets/') ||
    url.pathname.endsWith('.png') ||
    url.pathname.endsWith('.jpg') ||
    url.pathname.endsWith('.svg') ||
    url.pathname.endsWith('.webp') ||
    url.pathname.endsWith('.woff2')
  ){
    e.respondWith(
      caches.open(ASSET_CACHE).then(cache=>
        cache.match(req).then(cached=>{
          const fetchPromise = fetch(req).then(res=>{
            if(res && res.status===200) cache.put(req, res.clone());
            return res;
          }).catch(()=>{});
          // Return cached immediately, update in background
          return cached || fetchPromise;
        })
      )
    );
    return;
  }

  // Everything else — network with cache fallback
  e.respondWith(
    fetch(req)
      .then(res=>{
        if(res && res.status===200){
          const clone=res.clone();
          caches.open(CACHE_NAME).then(c=>c.put(req,clone));
        }
        return res;
      })
      .catch(()=>caches.match(req))
  );
});
