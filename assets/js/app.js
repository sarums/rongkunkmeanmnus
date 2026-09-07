// ═══════════════════════════════════════════════════
//  app.js — Main application file
//
//  SECTIONS (search by section name):
//  § FIREBASE CONFIG     line ~5
//  § STATE               line ~11
//  § HISTORY             line ~18
//  § HELPERS             line ~35
//  § TOAST               line ~77
//  § SEO                 line ~86
//  § SCROLL / SEARCH     line ~149
//  § PAGES / ROUTING     line ~213
//  § LOAD DATA           line ~373
//  § NAV                 line ~460
//  § CARDS               line ~517
//  § AD CARDS            line ~546
//  § HERO                line ~633
//  § SECTIONS            line ~692
//  § INFINITE SCROLL     line ~833
//  § WATCH PAGE          line ~913
//  § COMMENTS            line ~1241
//  § KEYBOARD SHORTCUTS  line ~1438
// ═══════════════════════════════════════════════════

import{initializeApp}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import{getFirestore,collection,getDocs,addDoc,deleteDoc,doc,updateDoc,increment,query,orderBy,getDoc,serverTimestamp,onSnapshot,where}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Firebase Config ──
const firebaseConfig={apiKey:"AIzaSyAnXxuc92620WOz_bVkovnUEQ_LL4YFPp8",authDomain:"streamhub-ce717.firebaseapp.com",projectId:"streamhub-ce717",storageBucket:"streamhub-ce717.firebasestorage.app",messagingSenderId:"223272731262",appId:"1:223272731262:web:d17866d4a12f610c864e2f"};
const siteDefaults={name:"RongKunKmeanMnus",footer:"Your ultimate destination for curated video content from Dailymotion and Rumble."};

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

// ── State ──
let videos=[],playlists=[],categories=[],sections=[],allBlogPosts=[];
let heroVideos=[],heroIndex=0,heroTimer=null;
let playlistQueue=[],plQueueIdx=0;
let previousPage="home",lastScrollY=0,searchOpen=false,mobileMenuOpen=false;
let siteName="RongKunKmeanMnus";

// ── Watch History (localStorage) ──
const HISTORY_KEY='rkmn_history';
function getHistory(){ try{ return JSON.parse(localStorage.getItem(HISTORY_KEY)||'[]'); }catch{ return []; } }
function addToHistory(id){ const h=getHistory().filter(x=>x!==id); h.unshift(id); localStorage.setItem(HISTORY_KEY,JSON.stringify(h.slice(0,50))); }
window.clearHistory=()=>{ localStorage.removeItem(HISTORY_KEY); showHistoryPage(); showToast('History cleared'); };
window.showHistoryPage=()=>{
  NP.start();
  showPage('history');
  const ids=getHistory();
  const list=ids.map(id=>videos.find(v=>v.id===id)).filter(Boolean);
  const grid=$('history-grid');
  if(!list.length){ grid.innerHTML=''; $('history-empty').style.display=''; NP.done(); return; }
  $('history-empty').style.display='none';
  grid.innerHTML=list.map(v=>buildCard(v)).join('');
  NP.done();
};

// ── CACHE INVALIDATION LISTENER ──────────────────────────
// Listens for cache clear signal from admin panel
// When admin adds/edits video, site auto-reloads fresh data
window.addEventListener('storage', e=>{
  if(e.key === 'rkmn_cache_bust'){
    // Admin cleared cache — reload fresh data silently
    silentRefresh();
  }
});

// ── Helpers ──
const $=id=>document.getElementById(id);
function toSlug(s){ return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80); }
// Returns best URL slug for a video — uses title if latin, else uses ID
// Always use Firestore ID for URLs — unique, stable, indexable
function videoSlug(v){ return v.id; }
function playlistSlug(pl){ return pl.id; }
const fmtViews=n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n||0);
function isNewVideo(v){
  try{
    const t=v.createdAt?.toDate?v.createdAt.toDate():v.createdAt?.seconds?new Date(v.createdAt.seconds*1000):null;
    return t&&(Date.now()-t.getTime())<3*24*60*60*1000;
  }catch(e){return false;}
}
function timeAgo(ts){
  if(!ts) return '';
  const date=ts?.toDate?ts.toDate():new Date(ts?.seconds?ts.seconds*1000:ts);
  if(isNaN(date)) return '';
  const sec=Math.floor((Date.now()-date)/1000);
  if(sec<60) return 'Just now';
  if(sec<3600) return Math.floor(sec/60)+' min ago';
  if(sec<86400) return Math.floor(sec/3600)+' hr ago';
  if(sec<2592000) return Math.floor(sec/86400)+' days ago';
  if(sec<31536000) return Math.floor(sec/2592000)+' months ago';
  return Math.floor(sec/31536000)+' years ago';
}

const getThumb=v=>{
  if(v.customThumb||v.thumbnail) return v.customThumb||v.thumbnail;
  const src=v.platform||v.source||"";
  const id=v.videoId||"";
  if(src==="dailymotion") return`https://www.dailymotion.com/thumbnail/video/${id}`;
  if(src==="youtube")     return`https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  if(src==="vimeo")       return`https://vumbnail.com/${id}.jpg`;
  if(src==="odysee")      return`https://thumbnails.lbry.com/v1/stream/signed/${id}`;
  if(src==="facebook")    return`https://picsum.photos/seed/${v.id}/800/450`;
  return `https://picsum.photos/seed/${v.id}/800/450`;
};

const getEmbedUrl=v=>{
  const src=v.platform||v.source||"";
  const id=(v.videoId||(v.url||"").split("/").pop()||"");
  if(src==="dailymotion") return`https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  if(src==="rumble")      return`https://rumble.com/embed/${id}/?pub=4`;
  if(src==="youtube")     return`https://www.youtube.com/embed/${id}?autoplay=1&rel=0`;
  if(src==="vimeo")       return`https://player.vimeo.com/video/${id}?autoplay=1`;
  if(src==="odysee")      return`https://odysee.com/$/embed/${id}?autoplay=1`;
  if(src==="facebook")    return`https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.videoId||v.url||"")}&autoplay=1&show_text=false`;
  return v.url||"";
};

const ICONS={Flame:"🔥",Sparkles:"✨",Dices:"🎲",Video:"🎬",Music:"🎵",TrendingUp:"📈",Star:"⭐",List:"📋",Grid:"▦",Eye:"👁"};

// ── Toast ──
window.showToast=(msg,type="ok")=>{
  const el=document.createElement("div");
  el.className=`toast-item ${type}`;el.textContent=msg;
  $("toast").appendChild(el);
  requestAnimationFrame(()=>setTimeout(()=>el.classList.add("show"),10));
  setTimeout(()=>{el.classList.remove("show");setTimeout(()=>el.remove(),300);},3200);
};

// ── SEO Meta Updater ──
function updateMeta({title, desc, image, url, type='website', videoId='', vid=null}){
  const sn = siteName||'RongKunKmeanMnus';
  const fullTitle = title ? `${title} | ${sn}` : `${sn} - Watch Videos Online`;
  const fullDesc  = desc  || 'Watch Khmer drama, series and entertainment videos online.';
  const fullUrl   = url   || location.href;
  const fullImg   = image || 'https://www.rongkunkmeanmnus.com/assets/img/og-default.png';

  document.title = fullTitle;

  const set=(id,attr,val)=>{ const el=$(id); if(el) el.setAttribute(attr,val); };
  const setName=(name,attr,val)=>{ const el=document.querySelector(`meta[name="${name}"]`); if(el) el.setAttribute(attr,val); };
  const setProp=(prop,attr,val)=>{ const el=document.querySelector(`meta[property="${prop}"]`); if(el) el.setAttribute(attr,val); };

  // Primary
  set('meta-desc','content', fullDesc);
  set('canonical','href', fullUrl);

  // Open Graph
  setProp('og:type','content', type);
  set('og-title','content', fullTitle);
  set('og-desc','content',  fullDesc);
  set('og-image','content', fullImg);
  set('og-url','content',   fullUrl);
  set('og-image-alt','content', title||sn);

  // Twitter
  set('tw-title','content', fullTitle);
  set('tw-desc','content',  fullDesc);
  set('tw-image','content', fullImg);

  // JSON-LD — update dynamically for video pages
  const jsonld = document.getElementById('jsonld-main');
  if(jsonld && type === 'video.other' && title && videoId){
    // Find video data for accurate schema
    const schemaVid = videos.find(x=>x.id===videoId);
    const uploadDate = schemaVid?.createdAt?.toDate
      ? schemaVid.createdAt.toDate().toISOString()
      : new Date().toISOString();
    const embedUrl = schemaVid ? getEmbedUrl(schemaVid) : fullUrl;
    const duration = schemaVid?.duration ? 'PT' + schemaVid.duration.replace(':','M') + 'S' : undefined;

    const schema = {
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": title,
      "description": fullDesc.replace(/<[^>]*>/g,''), // strip HTML tags
      "thumbnailUrl": [fullImg],
      "uploadDate": uploadDate,
      "url": fullUrl,
      "embedUrl": embedUrl,
      "inLanguage": "km",
      "publisher": {
        "@type": "Organization",
        "name": "រោងកុនគ្មានមនុស្ស",
        "url": "https://www.rongkunkmeanmnus.com"
      }
    };
    if(duration) schema.duration = duration;
    jsonld.textContent = JSON.stringify(schema);
  } else if(jsonld && type === 'website'){
    jsonld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": sn,
      "url": "https://www.rongkunkmeanmnus.com",
      "description": fullDesc,
      "inLanguage": "en",
      "potentialAction": {
        "@type": "SearchAction",
        "target": { "@type": "EntryPoint", "urlTemplate": "https://www.rongkunkmeanmnus.com/search?q={search_term_string}" },
        "query-input": "required name=search_term_string"
      }
    });
  }
}

// ── Scroll ──
window.addEventListener("scroll",()=>{
  const sy=window.scrollY;

  $("nav-inner").classList.toggle("solid",sy>70);
  $("scroll-top")?.classList.toggle("visible",sy>400);
  lastScrollY=sy;
});


window.toggleMobileMenu=()=>{
  mobileMenuOpen=!mobileMenuOpen;
  const sheet   = $("mobile-menu");
  const backdrop= $("sheet-backdrop");
  if(mobileMenuOpen){
    // Lock body scroll
    document.body.style.overflow='hidden';
    document.body.style.position='fixed';
    document.body.style.width='100%';
    backdrop.style.display='block';
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        backdrop.style.background='rgba(0,0,0,.65)';
        sheet.style.transform='translateY(0)';
      });
    });
  } else {
    // Restore body scroll
    document.body.style.overflow='';
    document.body.style.position='';
    document.body.style.width='';
    backdrop.style.background='rgba(0,0,0,0)';
    sheet.style.transform='translateY(100%)';
    setTimeout(()=>{ backdrop.style.display='none'; }, 400);
  }
};
window.toggleMoreMenu=()=>{
  const menu    = $("nav-more-menu");
  const chevron = $("nav-more-chevron");
  if(!menu) return;
  const isOpen = menu.style.display !== 'none';
  menu.style.display = isOpen ? 'none' : 'block';
  if(chevron) chevron.style.transform = isOpen ? '' : 'rotate(180deg)';
};

window.closeMoreMenu=()=>{
  const menu    = $("nav-more-menu");
  const chevron = $("nav-more-chevron");
  if(menu) menu.style.display='none';
  if(chevron) chevron.style.transform='';
};

// Close More menu when clicking outside
document.addEventListener('click', e=>{
  const wrap = $("nav-more-wrap");
  if(wrap && !wrap.contains(e.target)) closeMoreMenu();
});

window.doSearch=(q2)=>{
  const q=(q2!=null?q2:($("search-input")?.value||$("mobile-search-input")?.value||"")).trim();
  if(!q)return;
  NP.start();
  ensureSearchBlogCache(); // load blog cache for search
  if(mobileMenuOpen){ mobileMenuOpen=false; document.body.style.overflow=''; document.body.style.position=''; document.body.style.width=''; const s=$("mobile-menu"),b=$("sheet-backdrop"); if(s)s.style.transform='translateY(100%)'; if(b){b.style.background='rgba(0,0,0,0)';setTimeout(()=>b.style.display='none',350);} }

  history.pushState({page:'search',q},"",`/search?q=${encodeURIComponent(q)}`);
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-search"));
  window.scrollTo(0,0);
  updateMeta({title:`Search: ${q} | រោងកុនគ្មានមនុស្ស`, desc:`Search results for "${q}" — Watch free drama and entertainment videos on រោងកុនគ្មានមនុស្ស.`});
  // Search videos
  const vidResults = videos.filter(v=>matchSearch(v,q));

  // Search articles
  const blogResults = _searchBlogCache.filter(p=>
    (p.title||'').toLowerCase().includes(q.toLowerCase()) ||
    (p.category||'').toLowerCase().includes(q.toLowerCase()) ||
    (p.excerpt||'').toLowerCase().includes(q.toLowerCase())
  );

  const total = vidResults.length + blogResults.length;
  $("search-info").textContent=`${total} results for "${q}"`;

  // Build combined results grid
  const grid=$("search-grid");
  if(!total){
    grid.innerHTML=`<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🔍</div><p>No results found for "${q}"</p></div>`;
  } else {
    // Article cards first if any, then videos
    const articleHtml = blogResults.map(p=>`
      <a class="vcard" href="/blog/${p.slug||p.id}" onclick="event.preventDefault();showBlogPost('${p.slug||p.id}')">
        <div class="vcard-thumb" style="position:relative;">
          ${p.cover?`<img src="${p.cover}" loading="lazy" onerror="this.parentElement.style.background='#111'">`
            :`<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:2rem;">📝</div>`}
          <div class="vcard-overlay"></div>
          <div style="position:absolute;top:6px;left:6px;background:#f27d26;color:#000;font-size:.58rem;font-weight:900;padding:2px 7px;border-radius:9999px;text-transform:uppercase;">Article</div>
          ${p.category?`<div class="vcard-duration">${p.category}</div>`:''}
        </div>
        <div class="vcard-title">${p.title||''}</div>
        <div class="vcard-sub">${p.excerpt?p.excerpt.replace(/<[^>]*>/g,'').slice(0,60)+'…':''}</div>
      </a>`).join('');
    grid.innerHTML = articleHtml + buildFeedWithAds(vidResults,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6);
  }
  NP.done();
};
// ── LIVE SEARCH WITH PREVIEW ────────────────────────────
let _searchBlogCache = [];
let _searchTimer = null;

async function ensureSearchBlogCache(){
  if(_searchBlogCache.length) return;
  try{
    const snap = await getDocs(query(collection(db,'blog_posts'), orderBy('createdAt','desc')));
    _searchBlogCache = snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status==='published');
  }catch(e){}
}

window.openDesktopSearch=()=>{
  let overlay=$('desktop-search-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='desktop-search-overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.82);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding-top:100px;backdrop-filter:blur(6px);';
    overlay.innerHTML=`
      <div style="width:100%;max-width:620px;padding:0 20px;">
        <div style="background:#1a1a1a;border:1px solid rgba(255,255,255,.12);border-radius:14px;overflow:hidden;">
          <!-- Search input -->
          <div style="display:flex;align-items:center;gap:12px;padding:14px 18px;border-bottom:1px solid rgba(255,255,255,.06);">
            <svg width="18" height="18" fill="none" stroke="#f27d26" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
            <input id="desktop-search-input" type="text" placeholder="Search videos and articles..." autofocus
              style="flex:1;background:none;border:none;outline:none;color:#fff;font-size:1rem;font-family:inherit;"
              oninput="liveSearch(this.value)"
              onkeydown="if(event.key==='Enter'){closeDesktopSearch();doSearch(this.value);} if(event.key==='Escape') closeDesktopSearch();">
            <button onclick="closeDesktopSearch()" style="background:none;border:none;color:#555;cursor:pointer;font-size:1.2rem;line-height:1;padding:0;">✕</button>
          </div>
          <!-- Live results dropdown -->
          <div id="search-preview-results" style="max-height:460px;overflow-y:auto;"></div>
        </div>
        <p style="text-align:center;color:#333;font-size:.72rem;margin-top:10px;">Press Enter for all results · Esc to close</p>
      </div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) closeDesktopSearch(); });
    document.body.appendChild(overlay);
  } else {
    overlay.style.display='flex';
    $('search-preview-results').innerHTML='';
    $('desktop-search-input').value='';
  }
  setTimeout(()=>$('desktop-search-input')?.focus(),50);
  ensureSearchBlogCache();
};

window.closeDesktopSearch=()=>{
  const o=$('desktop-search-overlay');
  if(o) o.style.display='none';
};

window.liveSearch=(q)=>{
  clearTimeout(_searchTimer);
  const box=$('search-preview-results');
  if(!box) return;

  if(!q || q.trim().length < 2){
    box.innerHTML='<div style="padding:1.25rem;text-align:center;color:#444;font-size:.8rem;">Start typing to search videos and articles...</div>';
    return;
  }

  _searchTimer = setTimeout(()=>{
    const lq = q.toLowerCase().trim();

    // Search videos
    const matchVids = videos.filter(v=>
      (v.title||'').toLowerCase().includes(lq) ||
      (v.category||'').toLowerCase().includes(lq) ||
      (v.description||'').toLowerCase().includes(lq)
    ).slice(0,4);

    // Search articles
    const matchPosts = _searchBlogCache.filter(p=>
      (p.title||'').toLowerCase().includes(lq) ||
      (p.category||'').toLowerCase().includes(lq) ||
      (p.excerpt||'').toLowerCase().includes(lq)
    ).slice(0,2);

    if(!matchVids.length && !matchPosts.length){
      box.innerHTML=`<div style="padding:1.5rem;text-align:center;color:#444;font-size:.82rem;">No results for "<strong style="color:#888">${q}</strong>"</div>`;
      return;
    }

    let html='';

    // Videos section
    if(matchVids.length){
      html+=`<div style="padding:8px 16px 4px;font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#555;">🎬 Videos</div>`;
      html+=matchVids.map(v=>{
        const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
        const url=pl?`/watch/${playlistSlug(pl)}/ep-${(pl.videos||[]).indexOf(v.id)+1}`:`/watch/${videoSlug(v)}`;
        const click=pl?`openPlaylist('${pl.id}','${v.id}')`:`openVideo('${v.id}')`;
        const thumb=getThumb(v);
        return `<div onclick="closeDesktopSearch();${click}"
          style="display:flex;align-items:center;gap:10px;padding:8px 16px;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,.04)'"
          onmouseout="this.style.background=''">
          <div style="width:72px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#111;flex-shrink:0;position:relative;">
            <img src="${thumb}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
              onerror="this.src='https://picsum.photos/seed/${v.id}/160/90'">
            ${v.episodeNum?`<div style="position:absolute;top:3px;left:3px;width:17px;height:17px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.5rem;font-weight:900;color:#000;">${v.episodeNum}</div>`:''}
            ${v.duration?`<div style="position:absolute;bottom:2px;right:3px;background:rgba(0,0,0,.8);color:#fff;font-size:.55rem;font-weight:700;padding:1px 4px;border-radius:2px;">${v.duration}</div>`:''}
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:.8rem;font-weight:700;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${v.title||''}</div>
            <div style="font-size:.67rem;color:#555;margin-top:2px;">${v.category||''} · ${fmtViews(v.views||0)} views${pl?' · Series':''}</div>
          </div>
        </div>`;
      }).join('');
    }

    // Articles section
    if(matchPosts.length){
      html+=`<div style="padding:8px 16px 4px;margin-top:4px;font-size:.62rem;font-weight:800;letter-spacing:.1em;text-transform:uppercase;color:#555;border-top:1px solid rgba(255,255,255,.04);">📝 Articles</div>`;
      html+=matchPosts.map(p=>`
        <div onclick="closeDesktopSearch();showBlogPost('${p.slug||p.id}')"
          style="display:flex;align-items:center;gap:10px;padding:8px 16px;cursor:pointer;transition:background .15s;"
          onmouseover="this.style.background='rgba(255,255,255,.04)'"
          onmouseout="this.style.background=''">
          <div style="width:72px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#111;flex-shrink:0;">
            ${p.cover
              ?`<img src="${p.cover}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
              :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.3rem;">📝</div>`}
          </div>
          <div style="min-width:0;flex:1;">
            <div style="font-size:.8rem;font-weight:700;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.title||''}</div>
            <div style="font-size:.67rem;color:#f27d26;margin-top:2px;">${p.category||'Article'}</div>
          </div>
        </div>`).join('');
    }

    // See all results button
    html+=`<div style="border-top:1px solid rgba(255,255,255,.06);padding:10px 16px;">
      <div onclick="closeDesktopSearch();doSearch('${q.replace(/'/g,"\'")}');"
        style="display:flex;align-items:center;gap:10px;cursor:pointer;padding:6px 8px;border-radius:8px;transition:background .15s;"
        onmouseover="this.style.background='rgba(242,125,38,.08)'"
        onmouseout="this.style.background=''">
        <svg width="14" height="14" fill="none" stroke="#f27d26" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
        <span style="font-size:.78rem;font-weight:700;color:#f27d26;">See all results for "<strong>${q}</strong>"</span>
      </div>
    </div>`;

    box.innerHTML=html;
  }, 200);
};

function matchSearch(v,q){
  const lq=q.toLowerCase();
  return (v.title||'').toLowerCase().includes(lq)||(v.category||'').toLowerCase().includes(lq)||(v.description||'').toLowerCase().includes(lq);
}

// ── Pages ──
// ── PROGRESS BAR ENGINE ──────────────────────────────
const NP = {
  _timer: null, _val: 0, _fake: null,
  bar: null, spin: null,
  init(){
    this.bar  = document.getElementById('nprogress-bar');
    this.spin = document.getElementById('nprogress-spinner');
  },
  set(n){
    if(!this.bar) this.init();
    this._val = Math.min(n, 0.994);
    this.bar.style.width = (this._val * 100) + '%';
    this.bar.classList.add('running');
    this.spin.classList.add('running');
  },
  start(){
    if(!this.bar) this.init();
    clearInterval(this._fake);
    this.set(0.08);
    // Fake trickle
    this._fake = setInterval(()=>{
      const gap = 1 - this._val;
      const inc = gap > .5 ? .1 : gap > .2 ? .04 : gap > .05 ? .01 : 0.005;
      this.set(this._val + inc);
    }, 300);
  },
  done(){
    if(!this.bar) this.init();
    clearInterval(this._fake);
    this.set(1);
    setTimeout(()=>{
      this.bar.style.opacity = '0';
      this.spin.classList.remove('running');
      setTimeout(()=>{
        this.bar.style.width = '0%';
        this.bar.classList.remove('running');
        this.bar.style.opacity = '';
        this._val = 0;
      }, 400);
    }, 200);
  }
};

function showPage(id,push=true){
  if(id!=="watch"){
    previousPage=id;
    const iframe = document.getElementById('player-iframe');
    if(iframe) iframe.src='';
    // Clear overlay banner if any
    if(window.clearOverlayBanner) clearOverlayBanner();
    // Clear pull-to-refresh timer
    if(window._overlayTimer) clearTimeout(window._overlayTimer);
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${id}`));
  if(push){
    if(id==='home'){
      history.replaceState({page:'home'},'','/');
    } else {
      history.pushState({page:id},'','/'+id);
    }
  }
  window.scrollTo(0,0);
  // Update bottom nav
  document.querySelectorAll('#bottom-nav a').forEach(a=>a.classList.remove('active'));
  const bnMap={home:'bn-home',search:'bn-search',history:'bn-history'};
  if(bnMap[id]) $(bnMap[id])?.classList.add('active');
  // Reset meta for non-video pages
  if(id==='home') updateMeta({title:'រោងកុនគ្មានមនុស្ស | Watch Chinese Drama, Khmer Drama Free Online', desc:'Watch Chinese Drama, Khmer Drama and Khmer dubbed series online for free. រោងកុនគ្មានមនុស្ស — your free streaming destination. No subscription needed.', url:'https://www.rongkunkmeanmnus.com'});
}
window.goHome=e=>{
  e?.preventDefault();
  // Stop video
  $('player-iframe').src='';
  showPage("home");
  buildNav('home');
  // Footer home active
  document.querySelectorAll('#footer-links a').forEach(a=>{
    a.classList.toggle('active', a.getAttribute('href')==='/');
  });
  // Silent background refresh
  silentRefresh();
};

async function silentRefresh(){
  try{
    const[vidSnap,plSnap,secSnap]=await Promise.all([
      getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
      getDocs(collection(db,"playlists")),
      getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
    ]);
    const newVideos   = vidSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');
    const newPlaylists= plSnap.docs.map(d=>({id:d.id,...d.data()}));
    const newSections = secSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.display_order||0)-(b.display_order||0));

    // Check if anything changed
    const vidChanged = JSON.stringify(newVideos.map(v=>v.id)) !== JSON.stringify(videos.map(v=>v.id));
    const plChanged  = JSON.stringify(newPlaylists.map(p=>p.id+(p.videos||[]).join(',')))
                    !== JSON.stringify(playlists.map(p=>p.id+(p.videos||[]).join(',')));
    const secChanged = newSections.length !== sections.length;

    if(vidChanged || plChanged || secChanged){
      videos    = newVideos;
      playlists = newPlaylists;
      sections  = newSections;
      buildHero();
      buildSections();
      initRecommended();
    }
  }catch(e){}
}
window.goBack=()=>{
  if(history.length > 1){
    history.back();
  } else {
    // No history — go home
    $('player-iframe').src='';
    showPage('home');
    buildNav('home');
  }
};

function routeFromUrl(push=false){
  const path=location.pathname;
  if(path==="/"||path===""){ showPage("home",false); return; }

  // /watch/playlist-slug/ep-N  or  /watch/video-slug
  if(path.startsWith("/watch/")){
    const parts=path.slice(7).split("/"); // remove '/watch/'
    const idPart = parts[0];

    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      // /watch/PLAYLIST_ID/ep-N → play episode N of playlist
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      const pl = playlists.find(p=>p.id===idPart);
      if(pl&&(pl.videos||[]).length){
        const vidId=pl.videos[epNum-1];
        if(!vidId){ show404(); return; }
        const vid=videos.find(v=>v.id===vidId);
        if(vid){ openVideo(vid.id,false); return; }
      }
      show404(); return;
    }

    if(parts.length===1){
      // /watch/ID → could be playlist ID or video ID

      // 1. Check if it's a playlist ID → 404 (must use /ep-N)
      const pl = playlists.find(p=>p.id===idPart);
      if(pl){ show404(); return; }

      // 2. Check if it's a video ID
      const vid = videos.find(v=>v.id===idPart);
      if(vid){
        // Check if this video belongs to a playlist → redirect to playlist URL
        const ownerPl = playlists.find(p=>(p.videos||[]).includes(idPart));
        if(ownerPl){
          const epNum = (ownerPl.videos||[]).indexOf(idPart)+1;
          // Redirect to proper playlist URL
          history.replaceState(
            {page:'watch',videoId:idPart},'',
            `/watch/${ownerPl.id}/ep-${epNum}`
          );
        }
        openVideo(vid.id,false);
        return;
      }
    }
    show404(); return;  // /watch/ URL didn't match any video or playlist
  }

  // Category slug
  const slug=path.replace(/^\//, '');
  const cat=categories.find(c=>toSlug(c.name)===slug);
  if(cat){ showCatPage(cat); return; }

  // Search: /search?q=...
  if(path==='/search'){
    const q=new URLSearchParams(location.search).get('q')||'';
    if(q) doSearch(q);
    else showPage('home',false);
    return;
  }

  // Drama detail
  if(path.startsWith('/drama/')){
    const slug = path.replace('/drama/','');
    const pl = playlists.find(p=>playlistSlug(p)===slug||p.id===slug);
    if(pl){ openDramaDetail(pl.id); return; }
    show404(); return;
  }
  // For You
  if(path==='/for-you'){ showForYouPage(); return; }
  // Blog
  if(path==='/blog'){ showBlogPage(); return; }
  if(path.startsWith('/blog/')){
    const slug=path.replace('/blog/','');
    showBlogPost(slug); return;
  }
  // History
  if(path==='/history'){ showHistoryPage(); return; }

  // Nothing matched — show 404
  show404();
}

function show404(){
  NP.done();
  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  const p=$('page-404');
  if(p) p.classList.add('active');
  window.scrollTo(0,0);
  updateMeta({title:'404 — Page Not Found', desc:'The page you are looking for does not exist.'});
}


window.addEventListener("popstate",e=>{
  const state = e.state;
  if(!state){ routeFromUrl(false); return; }

  if(state.page==='watch' && state.videoId){
    $('player-iframe').src='';
    openVideo(state.videoId, false);
  } else if(state.page==='cat' && state.catId){
    const cat = categories.find(c=>c.id===state.catId);
    if(cat) showCatPage(cat);
    else showPage('home',false);
  } else if(state.page==='cat' && state.secId){
    // seeAll section page
    seeAll(state.secId);
  } else if(state.page==='search' && state.q){
    doSearch(state.q);
  } else if(state.page==='history'){
    showHistoryPage();
  } else if(state.page==='drama' && state.plId){
    openDramaDetail(state.plId);
  } else if(state.page==='for-you'){
    showForYouPage();
  } else if(state.page==='blog'){
    showBlogPage();
  } else if(state.page==='blog-post' && state.slug){
    showBlogPost(state.slug);
  } else if(state.page==='home'){
    showPage('home',false);
    // Stop video when going back to home
    $('player-iframe').src='';
  } else {
    routeFromUrl(false);
  }
});

// ── Load Data ──
// ── MARKDOWN PARSER (bold, italic, links) ─────────────────
function parseMd(text){
  if(!text) return '';
  return text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') // escape HTML
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#e4e4e7;font-weight:700;">$1</strong>') // **bold**
    .replace(/\*(.+?)\*/g,'<em style="color:#aaa;">$1</em>') // *italic*
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:#f27d26;text-decoration:none;">$1</a>'); // [link](url)
}

// ── WATCH DESCRIPTION RENDERER ───────────────────────────
function renderWatchDescription(v){
  const rawDesc = v.description||'';
  const parsed  = parseStructuredDesc(rawDesc);
  const synEl   = $('watch-synopsis');
  const synWrap = $('watch-synopsis-wrap');
  const card    = $('watch-info-card');
  const descEl  = $('watch-desc');
  const toggle  = $('watch-desc-toggle');

  if(parsed){
    // Show synopsis
    if(synEl && parsed.synopsis){
      synEl.innerHTML = parseMd(parsed.synopsis);
      if(synWrap) synWrap.style.display='block';
      if(toggle){
        toggle.style.display = parsed.synopsis.length>150 ? '' : 'none';
        toggle.textContent = 'Show more ▾';
        synEl.style.webkitLineClamp='3';
        synEl.style.overflow='hidden';
      }
    }
    // Show info card
    if(card && parsed.fields && parsed.fields.length){
      $('watch-drama-title').textContent = parsed.dramaTitle||v.title||'';
      $('watch-drama-year').textContent  = parsed.year||'';
      const rows = $('watch-info-rows');
      if(rows){
        rows.innerHTML = parsed.fields.map(f=>`
          <div class="watch-info-row${f.full?' full':''}">
            <span class="watch-info-label">${f.icon} ${f.label}</span>
            <span class="watch-info-value">${parseMd(f.value)}</span>
          </div>`).join('');
      }
      card.style.display='block';
    }
    if(descEl) descEl.style.display='none';
  } else {
    // Fallback plain text
    const platform = v.platform||v.source||'';
    const cat = v.category||'';
    const epText = v.episodeNum?`Episode ${v.episodeNum}`:'';
    const fallback = rawDesc.trim().length>20 ? rawDesc :
      [v.title?`Watch "${v.title}"${epText?' - '+epText:''} online for free on រោងកុនគ្មានមនុស្ស.`:'',
       cat?`This is a ${cat} video.`:'',
       `Stream free ${cat||'drama'} content on រោងកុនគ្មានមនុស្ស. No subscription needed.`
      ].filter(Boolean).join(' ');
    if(descEl){ descEl.style.display=''; descEl.innerHTML=parseMd(fallback); }
    if(synWrap) synWrap.style.display='none';
    if(card) card.style.display='none';
    if(toggle){
      toggle.style.display=fallback.length>150?'':'none';
      toggle.textContent='Show more ▾';
      if(descEl){ descEl.style.webkitLineClamp='3'; descEl.style.overflow='hidden'; }
    }
  }
}

// Parse structured description text into fields
function parseStructuredDesc(text){
  if(!text||text.trim().length<30) return null;
  const lines = text.split('\n').map(l=>l.trim()).filter(Boolean);

  // Detect structured format — look for "Key: Value" lines
  const fieldLines = lines.filter(l=>/^(Title|Type|Format|Country|Episodes|Aired|Duration|Network|Content Rating|Cast|Genre|Director)\s*:/i.test(l));
  if(fieldLines.length < 2) return null; // not structured enough

  // Extract synopsis — lines before first field
  const firstFieldIdx = lines.findIndex(l=>/^(Title|Type|Format|Country|Episodes|Aired|Duration|Network)\s*:/i.test(l));
  const synopsisLines = firstFieldIdx > 0 ? lines.slice(0, firstFieldIdx) : [];
  // Remove episode title lines (lines with "|" separators)
  const synopsis = synopsisLines.filter(l=>!l.includes('|')).join(' ').trim();

  // Extract drama title and year
  const titleLine = fieldLines.find(l=>/^Title\s*:/i.test(l));
  const dramaTitle = titleLine ? titleLine.replace(/^Title\s*:/i,'').trim() : '';
  const airedLine = fieldLines.find(l=>/^Aired\s*:/i.test(l));
  const yearMatch = airedLine ? airedLine.match(/\d{4}/) : null;
  const year = yearMatch ? yearMatch[0] : '';

  // Build info fields
  const fieldMap = [
    {key:'Type',      icon:'🎭', label:'Type'},
    {key:'Country',   icon:'🌏', label:'Country'},
    {key:'Episodes',  icon:'📺', label:'Episodes'},
    {key:'Aired',     icon:'📅', label:'Aired', full:true},
    {key:'Duration',  icon:'⏱', label:'Duration'},
    {key:'Network',   icon:'📡', label:'Network', full:true},
    {key:'Format',    icon:'🎬', label:'Format'},
    {key:'Cast',      icon:'⭐', label:'Cast', full:true},
    {key:'Genre',     icon:'🏷', label:'Genre', full:true},
  ];

  const fields = [];
  fieldMap.forEach(({key,icon,label,full})=>{
    const line = fieldLines.find(l=>new RegExp(`^${key}\s*:`,'i').test(l));
    if(line){
      const value = line.replace(new RegExp(`^${key}\s*:`,'i'),'').replace(/\.+$/,'').trim();
      if(value && value.toLowerCase()!=='not yet rated' && value!=='-'){
        fields.push({icon,label,value,full:!!full});
      }
    }
  });

  return { synopsis, dramaTitle, year, fields };
}

// toggleDesc works for both synopsis and plain desc
window.toggleDesc=()=>{
  // Try synopsis first
  const syn = $('watch-synopsis');
  const desc = $('watch-desc');
  const btn  = $('watch-desc-toggle');
  const el   = syn?.style.display!=='none' ? syn : desc;
  if(!el||!btn) return;
  const collapsed = el.style.overflow==='hidden';
  el.style.overflow  = collapsed?'visible':'hidden';
  el.style.webkitLineClamp = collapsed?'unset':'3';
  btn.textContent    = collapsed?'Show less ▴':'Show more ▾';
};

// ── SESSION CACHE ─────────────────────────────────────────
// Cache disabled — always load fresh from Firestore
function saveCache(data){}
function loadCache(){ return null; }

async function loadAll(){
  try{
    // Load ads config in parallel (non-blocking)
    if(window.loadAdsConfig) window.loadAdsConfig();
    // Fetch from Firebase
      const[catSnap,plSnap,vidSnap,secSnap]=await Promise.all([
        getDocs(collection(db,"categories")),
        getDocs(collection(db,"playlists")),
        getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
        getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
      ]);
      categories = catSnap.docs.map(d=>({id:d.id,...d.data()}));
      playlists  = plSnap.docs.map(d=>({id:d.id,...d.data()}));
      videos     = vidSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');
      sections   = secSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
      // Load blog posts for SEO URL linking
      try{
        const blogSnap2 = await getDocs(collection(db,'blog_posts'));
        allBlogPosts = blogSnap2.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status==='published');
      }catch(e){ allBlogPosts=[]; }

      const stDoc = await getDoc(doc(db,"settings","main")).catch(()=>null);
      const settings = stDoc?.exists() ? stDoc.data() : null;

      // Apply settings
      const s = settings;
      if(s){
        if(s.name){
          siteName=s.name;
          ["site-name","footer-name"].forEach(id=>{if($(id))$(id).textContent=s.name;});
          document.title=s.name;
          document.getElementById('og-site')?.setAttribute('content',s.name);
          const yr=new Date().getFullYear();
          const copy=`© ${yr} ${s.name}. All rights reserved.`;
          ["footer-copy","slim-copy-watch","slim-copy-hist","slim-copy-cat","slim-copy-search"].forEach(id=>{if($(id))$(id).textContent=copy;});
        }
        if(s.footer&&$("footer-desc"))$("footer-desc").textContent=s.footer;
      } else {
        ["site-name","footer-name"].forEach(id=>{if($(id))$(id).textContent=siteDefaults.name;});
        const yr=new Date().getFullYear();
        const copy=`© ${yr} ${siteDefaults.name}. All rights reserved.`;
        ["footer-copy","slim-copy-watch","slim-copy-hist","slim-copy-cat","slim-copy-search"].forEach(id=>{if($(id))$(id).textContent=copy;});
        document.title=siteDefaults.name;
        if($("footer-desc"))$("footer-desc").textContent=siteDefaults.footer;
      }

    buildNav();buildHero();buildSections();
    initRecommended();
    setupRecObserver();
    // Set initial history state so popstate always works
    if(!history.state){
      history.replaceState({page:'home'},'',location.pathname+location.search);
    }
    routeFromUrl(false);
    // Hide loader
    hideLoader();
    // Lazy load images with IntersectionObserver
    setupLazyLoad();
    initCookieBanner();
    // Real-time listener — auto-update cards when videos change in Firestore
    startVideoListener();

  }catch(err){
    console.error(err);
    showToast("Failed to load data","err");
    const loader=$('page-loader');
    if(loader){ loader.classList.add('hidden'); setTimeout(()=>loader.remove(),500); }
  }
}


function startVideoListener(){
  // Poll every 60s instead of onSnapshot to avoid corrupting browser history
  // onSnapshot fires on view count updates causing extra pushState entries
  setInterval(async ()=>{
    const onWatch = document.getElementById('page-watch')?.classList.contains('active');
    if(onWatch) return;
    try {
      const snap = await getDocs(query(collection(db,'videos'),orderBy('createdAt','desc')));
      const updated = snap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');
      const addedIds = updated.filter(uv=>!videos.find(v=>v.id===uv.id)).map(v=>v.id);
      if(addedIds.length > 0){
        videos = updated;
        buildSections();
        buildHero();
        showUpdateToast(addedIds.length);
      }
    } catch(e){}
  }, 60000);
}

// Show a subtle "new content" toast
function showUpdateToast(count){
  const existing = document.getElementById('update-toast');
  if(existing) existing.remove();

  const t = document.createElement('div');
  t.id = 'update-toast';
  t.style.cssText = 'position:fixed;bottom:80px;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid rgba(242,125,38,.3);color:#f27d26;font-size:.78rem;font-weight:700;padding:10px 20px;border-radius:9999px;z-index:500;display:flex;align-items:center;gap:8px;box-shadow:0 4px 20px rgba(0,0,0,.5);animation:fadeUp .3s ease;cursor:pointer;white-space:nowrap;';
  t.innerHTML = `<span>🎬</span> ${count} new video${count>1?'s':''} added!`;
  t.onclick = ()=>{ window.scrollTo({top:0,behavior:'smooth'}); t.remove(); };
  document.body.appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(),300); }, 5000);
}

function hideLoader(){
  const loader=$('page-loader');
  if(loader){ loader.classList.add('hidden'); setTimeout(()=>loader.remove(),500); }
}

function setupLazyLoad(){
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ const img=e.target; if(img.dataset.src){ img.src=img.dataset.src; img.removeAttribute('data-src'); io.unobserve(img); } } });
  },{rootMargin:'200px'});
  document.querySelectorAll('img[data-src]').forEach(img=>io.observe(img));
}

// ── Nav ──
function buildNav(activeId){
  const sorted=[...categories].sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  const desktopCats=sorted.slice(0,8); // desktop navbar limited to 8
  const cats=sorted;                    // mobile sheet shows all

  function slug(c){ return '/'+c.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
  function navLink(c, closeMobile=false){
    const close=closeMobile?'toggleMobileMenu();':'';
    const icon = c.ico && c.ico.trim() && c.ico!=='▶'
      ? `<span style="font-size:1.05rem">${c.ico}</span>`
      : `<span style="font-size:.75rem;font-weight:800;color:#f27d26">${(c.name||'?').charAt(0).toUpperCase()}</span>`;
    return `<a href="${slug(c)}" data-catid="${c.id}"
      onclick="event.preventDefault();${close}navGo('${c.id}')"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.8);text-decoration:none;transition:background .18s,color .18s;"
      onmouseover="this.style.background='rgba(242,125,38,.08)';this.style.color='#f27d26';this.querySelector('div').style.background='rgba(242,125,38,.15)'"
      onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.8)';this.querySelector('div').style.background='rgba(255,255,255,.05)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;transition:background .18s">${icon}</div>
      ${c.name}
    </a>`;
  }

  // Determine active: use passed activeId, else fall back to URL
  const curSlug=location.pathname;
  const resolvedActive=activeId||
    (curSlug==='/'?'home':cats.find(c=>slug(c)===curSlug)?.id||'');

  $("nav-cats").innerHTML=
    `<a href="/" onclick="goHome(event)" ${resolvedActive==='home'?'class="active"':''}>Home</a>`
    +`<a href="/for-you" onclick="event.preventDefault();showForYouPage()" ${resolvedActive==='for-you'?'class="active"':''}>✨ For You</a>`
    +desktopCats.map(c=>`<a href="${slug(c)}" data-catid="${c.id}" onclick="event.preventDefault();navGo('${c.id}')" ${resolvedActive===c.id?'class="active"':''}>${c.name}</a>`).join("")
    +`<a href="/blog" onclick="event.preventDefault();showBlogPage()" style="font-weight:600;">📝 Blog</a>`
    +`<a href="/donate" style="color:#f27d26;font-weight:800;display:flex;align-items:center;gap:5px;" onmouseover="this.style.opacity='.75'" onmouseout="this.style.opacity='1'">☕ Donate</a>`;

  // Populate More dropdown with overflow categories
  const moreCats = sorted.slice(8);
  const moreWrap = $("nav-more-wrap");
  const moreMenu = $("nav-more-menu");
  if(moreWrap && moreMenu){
    if(moreCats.length){
      moreWrap.style.display='block';
      moreMenu.innerHTML = moreCats.map(c=>`
        <a href="${slug(c)}" data-catid="${c.id}"
          onclick="event.preventDefault();closeMoreMenu();navGo('${c.id}')"
          style="display:flex;align-items:center;gap:10px;padding:9px 12px;border-radius:8px;font-size:.82rem;font-weight:600;color:#aaa;text-decoration:none;transition:background .15s,color .15s;white-space:nowrap;"
          onmouseover="this.style.background='rgba(242,125,38,.08)';this.style.color='#f27d26';this.querySelector('span').style.background='#f27d26'"
          onmouseout="this.style.background='';this.style.color='#aaa';this.querySelector('span').style.background='#444'">
          <span style="width:6px;height:6px;border-radius:50%;background:#444;flex-shrink:0;transition:background .15s;"></span>
          ${c.name}
        </a>`).join('');
    } else {
      moreWrap.style.display='none';
    }
  }
  $("mobile-cats").innerHTML=
    `<div style="font-size:.63rem;font-weight:800;letter-spacing:.12em;text-transform:uppercase;color:rgba(255,255,255,.2);padding:4px 12px 8px;">Menu</div>`
    +`<a href="/" onclick="event.preventDefault();toggleMobileMenu();goHome(event)"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.8);text-decoration:none;transition:background .18s,color .18s;"
      onmouseover="this.style.background='rgba(242,125,38,.08)';this.style.color='#f27d26'"
      onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.8)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;">
        <svg width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9,22 9,12 15,12 15,22"/></svg>
      </div>
      Home
    </a>`
    +cats.map(c=>navLink(c,true)).join("")
    +`<a href="/for-you" onclick="event.preventDefault();toggleMobileMenu();showForYouPage()"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.8);text-decoration:none;"
      onmouseover="this.style.background='rgba(242,125,38,.08)';this.style.color='#f27d26'"
      onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.8)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">✨</div>
      For You
    </a>`
    +`<a href="/blog" onclick="event.preventDefault();toggleMobileMenu();showBlogPage()"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:600;color:rgba(255,255,255,.8);text-decoration:none;"
      onmouseover="this.style.background='rgba(242,125,38,.08)';this.style.color='#f27d26'"
      onmouseout="this.style.background='';this.style.color='rgba(255,255,255,.8)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.06);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">📝</div>
      Blog
    </a>`
    +`<a href="/donate"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:700;color:#f27d26;text-decoration:none;background:rgba(242,125,38,.06);border:1px solid rgba(242,125,38,.15);margin-top:8px;"
      onmouseover="this.style.background='rgba(242,125,38,.12)'"
      onmouseout="this.style.background='rgba(242,125,38,.06)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(242,125,38,.15);border:1px solid rgba(242,125,38,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">☕</div>
      Donate
    </a>`;
  $("footer-links").innerHTML=
    `<a href="/" onclick="goHome(event)" ${resolvedActive==='home'?'class="active"':''}>Home</a>`
    +`<a href="/blog" onclick="event.preventDefault();showBlogPage()">Blog</a>`
    +`<a href="/about">About</a>`
    +`<a href="/privacy">Privacy</a>`
    +`<a href="/terms">Terms</a>`
    +`<a href="/contact">Contact</a>`
    +`<a href="/donate" style="color:#f27d26;font-weight:800;">☕ Donate</a>`;
}

// Set active nav link
function setNavActive(matchId){
  document.querySelectorAll('#nav-cats a').forEach(a=>{
    if(matchId==='home'){
      a.classList.toggle('active', !a.dataset.catid);
    } else {
      a.classList.toggle('active', a.dataset.catid===matchId);
    }
  });
}

// Single entry point for all nav category clicks
window.navGo=(id)=>{
  const c=categories.find(x=>x.id===id); if(!c)return;
  // Stop video when navigating away
  const iframe=document.getElementById('player-iframe');
  if(iframe) iframe.src='';
  NP.start();
  const ids=c.target_ids||(c.target_id?[c.target_id]:[]);
  const slug='/'+c.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  history.pushState({page:'cat',catId:id},"",slug);
  buildNav(id);
  if(c.target_type==='playlist'&&ids.length){
    openCategoryById(id);
  } else if(c.target_type==='video'&&ids.length){
    openCategoryById(id);
  } else {
    openCategory(id, c.name, false);
  }
  NP.done();
};

// ── Card ──
function buildCard(v){
  const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
  const epNum=pl?(pl.videos||[]).indexOf(v.id)+1:0;
  const watchUrl=pl?`/watch/${playlistSlug(pl)}/ep-${epNum}`:`/watch/${videoSlug(v)}`;
  const click=pl?`openPlaylist('${pl.id}','${v.id}')`:`openVideo('${v.id}')`;

  // If playlist has a linked article → use blog URL as primary href for SEO
  // onclick still plays the video normally
  const blogArticle = v.articleId
    ? (() => { const p = allBlogPosts?.find?.(p=>p.id===v.articleId||p.slug===v.articleId); return p?`/blog/${p.slug||p.id}`:null; })()
    : null;
  const primaryUrl = blogArticle || watchUrl;

  return`<a class="vcard" data-id="${v.id}" href="${primaryUrl}" onclick="event.preventDefault();${click}">
    <div class="vcard-thumb">
      <img src="${getThumb(v)}" alt="${(v.title||"").replace(/"/g,"")}" loading="lazy"
        onerror="this.src='https://picsum.photos/seed/${v.id}x/800/450'">
      <div class="vcard-overlay"></div>
      <div class="vcard-play"><div class="vcard-play-icon">
        <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
      </div></div>
      ${v.duration?`<div class="vcard-duration">${v.duration}</div>`:""}
      ${pl?`<div class="vcard-series">Series</div>`:""}
      ${epNum?`<div class="ep-badge ep-badge--${v.badgePos||'top-left'}">${epNum}</div>`:""}
)()}
    </div>
    <div class="vcard-title">${v.title||""}</div>
    <div class="vcard-sub">${[
      v.category,
      v.views||v.viewsDisplay ? fmtViews(v.views||0)+' views' : '',
      timeAgo(v.createdAt)
    ].filter(Boolean).join(' · ')}</div>
  </a>`;
}

function skelRow(n=4){return Array(n).fill(0).map(()=>`<div class="skel-card"><div class="skeleton skel-thumb"></div><div class="skeleton skel-title"></div><div class="skeleton skel-sub"></div></div>`).join("");}

// ── AD CARD ──────────────────────────────────────────
function buildAdCard(){
  const cfg   = window.AD_CONFIG||{};
  if(!cfg.enabled || !cfg.feedAds) return '';
  const img   = cfg.feedImageUrl||cfg.imageUrl||'';
  const url   = cfg.feedAdUrl||cfg.clickUrl||'#';
  const target= url==='#'?'':'target="_blank" rel="noopener"';
  return`<a class="vcard vcard-ad" href="${url}" ${target}>
    <div class="vcard-thumb">
      ${img
        ?`<img src="${img}" alt="Advertisement" loading="lazy" onerror="this.parentElement.style.background='#1a1a1a'">`
        :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
          </div>`}
      <div class="vcard-ad-badge">Ad</div>
    </div>
    <div class="vcard-title" style="color:#888;">Advertisement</div>
    <div class="vcard-sub">Sponsored</div>
  </a>`;
}

// Inject ad cards every N cards into a list
function injectAdCards(list, every=6){
  const result=[];
  list.forEach((item,i)=>{
    result.push(item);
    if((i+1)%every===0) result.push('__AD__');
  });
  return result;
}

function buildFeedWithAds(list, every=6){
  const injected = injectAdCards(list, every);
  return injected.map(item => item==='__AD__' ? buildAdCard() : buildCard(item)).join('');
}

function buildSuggWithAds(list, every=6){
  const injected = injectAdCards(list, every);
  return injected.map((item,i) => {
    if(item==='__AD__') return buildSuggAdCard();
    const x=item;
    const xpl=playlists.find(p=>(p.videos||[]).includes(x.id));
    const xUrl=xpl?`/watch/${playlistSlug(xpl)}/ep-${(xpl.videos||[]).indexOf(x.id)+1}`:`/watch/${videoSlug(x)}`;
    const xClick=xpl?`openPlaylist('${xpl.id}','${x.id}')`:`openVideo('${x.id}')`;
    const isWatched=getHistory().includes(x.id);
    return`<a class="sugg-item" href="${xUrl}" onclick="event.preventDefault();${xClick}">
      <div class="sugg-thumb" style="position:relative;">
        <img src="${getThumb(x)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${x.id}/320/180'">
        ${x.duration?`<div class="sugg-dur">${x.duration}</div>`:''}
        ${isWatched?`<div style="position:absolute;top:4px;right:4px;background:rgba(34,197,94,.85);border-radius:50%;width:16px;height:16px;display:flex;align-items:center;justify-content:center;font-size:.6rem;color:#fff">✓</div>`:''}
        ${(xpl?(xpl.videos||[]).indexOf(x.id)+1:x.episodeNum)||''?`<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:2;line-height:1">${xpl?(xpl.videos||[]).indexOf(x.id)+1:x.episodeNum}</div>`:''}
      </div>
      <div class="sugg-info">
        <div class="sugg-title-text">${x.title||''}</div>
        <div class="sugg-meta"><em>${x.category||x.platform||''}</em> · ${fmtViews(x.views)} views${xpl?' · Series':''}</div>
      </div>
    </a>`;
  }).join('');
}

function buildSuggAdCard(){
  const cfg   = window.AD_CONFIG||{};
  if(!cfg.enabled || !cfg.feedAds) return '';
  const img   = cfg.feedImageUrl||cfg.imageUrl||'';
  const url   = cfg.feedAdUrl||cfg.clickUrl||'#';
  const target= url==='#'?'':'target="_blank" rel="noopener"';
  return`<a class="sugg-item sugg-ad" href="${url}" ${target}>
    <div class="sugg-thumb" style="position:relative;">
      ${img
        ?`<img src="${img}" alt="Ad" loading="lazy">`
        :`<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/></svg>
          </div>`}
      <div class="vcard-ad-badge">Ad</div>
    </div>
    <div class="sugg-info">
      <div class="sugg-title-text" style="color:#888;">Advertisement</div>
      <div class="sugg-meta">Sponsored</div>
    </div>
  </a>`;
}

function renderGrid(el,list){
  if(!el)return;
  el.innerHTML=list.length
    ?buildFeedWithAds(list,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6)
    :`<div class="empty-state" style="grid-column:1/-1"><div class="empty-state-icon">🎬</div><p>No videos found</p></div>`;
}

// ── Hero ──
function buildHero(){
  const feat=videos.filter(v=>v.featured==="yes"||v.is_featured===1||v.is_featured===true);
  heroVideos=feat.length?feat.slice(0,8):videos.slice(0,6);
  heroIndex=0;
  $("hero-dots").innerHTML=heroVideos.map((_,i)=>
    `<button class="hero-dot${i===0?" active":""}" onclick="event.stopPropagation();goToHeroSlide(${i})"></button>`
  ).join("");
  updateHero(0);resetHeroTimer();
}

function updateHero(i){
  const v=heroVideos[i];if(!v)return;
  window._currentHeroId=v.id;
  const img=$("hero-img");
  img.style.opacity="0";
  setTimeout(()=>{img.src=getThumb(v);img.style.opacity="1";},260);

  // Title — clean truncation
  $("hero-title").textContent=v.title?.length>72?v.title.slice(0,72)+"…":v.title||"";

  // Description — show real desc or smart fallback
  const desc=v.description||(v.category?`A ${v.category} video from ${v.platform||'our collection'}.`:"");
  // Strip HTML tags for hero — show plain text only
  $("hero-desc").textContent=desc.replace(/<[^>]*>/g,"").replace(/&amp;/g,"&").replace(/&lt;/g,"<").replace(/&gt;/g,">").trim();
  $("hero-desc").style.display=desc?"":"none";

  // Category badge
  $("hero-cat").textContent=v.category||"";
  $("hero-cat").style.display=v.category?"":"none";

  // Views — only show if > 0
  const vw=v.views||0;
  $("hero-views").textContent=vw>0?fmtViews(vw)+" views":"";
  $("hero-views").style.display=vw>0?"":"none";

  // Update hero button href
  const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
  const heroUrl=pl?`/watch/${playlistSlug(pl)}/ep-${(pl.videos||[]).indexOf(v.id)+1}`:`/watch/${videoSlug(v)}`;
  $("hero-watch-btn")?.setAttribute("data-url",heroUrl);

  document.querySelectorAll(".hero-dot").forEach((d,j)=>d.classList.toggle("active",j===i));
}

window.goToHeroSlide=i=>{heroIndex=i;updateHero(i);resetHeroTimer();};
window.slideHero=d=>{heroIndex=(heroIndex+d+heroVideos.length)%heroVideos.length;updateHero(heroIndex);resetHeroTimer();};
window.heroClick=()=>{
  if(!window._currentHeroId)return;
  const v=videos.find(x=>x.id===window._currentHeroId);
  if(!v)return;
  const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
  if(pl) openPlaylist(pl.id,v.id);
  else openVideo(v.id);
};

function resetHeroTimer(){
  clearInterval(heroTimer);
  if(heroVideos.length>1)heroTimer=setInterval(()=>{heroIndex=(heroIndex+1)%heroVideos.length;updateHero(heroIndex);},6000);
}

// ── Sections ──
function buildContinueWatching(container){
  const history=getHistory();
  if(!history.length) return;
  const cwVids=history.map(id=>videos.find(v=>v.id===id)).filter(Boolean).slice(0,12);
  if(!cwVids.length) return;

  const sec=document.createElement('div');
  sec.className='cw-section';
  sec.innerHTML=`
    <div class="section-header" style="margin-bottom:12px">
      <div class="section-left">
        <div class="section-icon">⏱</div>
        <span class="section-title">Continue Watching</span>
      </div>
      <a href="/history" onclick="event.preventDefault();showHistoryPage()" class="section-more">See All ›</a>
    </div>
    <div class="cw-row hide-scroll">
      ${cwVids.map(v=>{
        const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
        const url=pl?`/watch/${playlistSlug(pl)}/ep-${(pl.videos||[]).indexOf(v.id)+1}`:`/watch/${videoSlug(v)}`;
        const click=pl?`openPlaylist('${pl.id}','${v.id}')`:`openVideo('${v.id}')`;
        return`<div class="cw-card" onclick="${click}">
          <div class="cw-thumb" style="position:relative;">
            <img src="${getThumb(v)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${v.id}/320/180'">
            <div class="cw-play"><div class="cw-play-icon">
              <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
            </div></div>
            <div class="cw-progress"><div class="cw-progress-bar"></div></div>
            ${(()=>{ const cwpl=playlists.find(p=>(p.videos||[]).includes(v.id)); const cwep=cwpl?(cwpl.videos||[]).indexOf(v.id)+1:v.episodeNum; return cwep?`<div style="position:absolute;top:5px;left:5px;width:24px;height:24px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:3;line-height:1">${cwep}</div>`:''; })()}
          </div>
          <div class="cw-title">${v.title||''}</div>
          <div class="cw-meta">${v.category||''}</div>
        </div>`;
      }).join('')}
    </div>`;
  container.appendChild(sec);
}

function buildSections(){
  const container=$("home-sections");container.innerHTML="";

  // Continue Watching at top
  buildContinueWatching(container);

  const active=sections.filter(s=>s.is_active!==0&&s.is_active!=="0");
  const list=active.length?active:[
    {id:"trending",title:"Trending Now",icon:"Flame",target_type:"trending"},
    {id:"new",title:"New Arrivals",icon:"Sparkles",target_type:"latest"}
  ];
  // Add blog section at bottom of home feed
  buildBlogSection(container);

  list.forEach(sec=>{
    const rowId=`row-${sec.id}`;
    const el=document.createElement("div");
    el.className="section";
    el.innerHTML=`
      <div class="section-header">
        <div class="section-left">
          <div class="section-icon">${ICONS[sec.icon]||"▶"}</div>
          <span class="section-title">${sec.title}</span>
        </div>
        <a href="/${toSlug(sec.title)}" class="section-more" onclick="event.preventDefault();seeAll('${sec.id}')">View All ›</a>
      </div>
      <div class="row-wrap">
        <button class="row-btn prev" onclick="scrollRow('${rowId}',-1)">&#8249;</button>
        <div class="row hide-scroll" id="${rowId}">${skelRow()}</div>
        <button class="row-btn next" onclick="scrollRow('${rowId}',1)">&#8250;</button>
      </div>`;
    container.appendChild(el);
    fillSection(sec,rowId);
  });
}

async function buildBlogSection(container){
  try{
    const snap = await getDocs(query(collection(db,'blog_posts'), orderBy('createdAt','desc')));
    const posts = snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status==='published')
      .sort((a,b)=>{
        const ta = a.updatedAt?.seconds?a.updatedAt.seconds*1000:a.createdAt?.toDate?a.createdAt.toDate().getTime():0;
        const tb = b.updatedAt?.seconds?b.updatedAt.seconds*1000:b.createdAt?.toDate?b.createdAt.toDate().getTime():0;
        return tb-ta;
      }).slice(0,8); // show 8 cards
    if(!posts.length) return;

    const blogCard = p=>`
      <a href="/blog/${p.slug||p.id}" onclick="event.preventDefault();showBlogPost('${p.slug||p.id}')"
        style="display:flex;flex-direction:column;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:12px;overflow:hidden;text-decoration:none;transition:border-color .2s,transform .2s;"
        onmouseover="this.style.borderColor='rgba(242,125,38,.3)';this.style.transform='translateY(-2px)'"
        onmouseout="this.style.borderColor='rgba(255,255,255,.06)';this.style.transform=''">
        <div style="aspect-ratio:16/9;overflow:hidden;background:#111;flex-shrink:0;">
          ${p.cover
            ?`<img src="${p.cover}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">`
            :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;">📝</div>`}
        </div>
        <div style="padding:.75rem .9rem .85rem;">
          <div style="font-size:.62rem;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#f27d26;margin-bottom:.25rem;">${p.category||'Article'}</div>
          <div style="font-size:.84rem;font-weight:700;color:#e4e4e7;line-height:1.35;margin-bottom:.3rem;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.title||''}</div>
          <div style="font-size:.72rem;color:#555;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.excerpt||''}</div>
        </div>
      </a>`;

    const sec = document.createElement('div');
    sec.className = 'section';
    sec.innerHTML = `
      <div class="section-header">
        <div class="section-left">
          <div class="section-icon">📝</div>
          <span class="section-title">Latest Articles</span>
        </div>
        <a href="/blog" onclick="event.preventDefault();showBlogPage()" class="section-more">View All ›</a>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:1rem;padding:0 2px;">
        ${posts.map(p=>blogCard(p)).join('')}
      </div>
      <!-- Read More button -->
      <div style="text-align:center;margin-top:1.25rem;">
        <a href="/blog" onclick="event.preventDefault();showBlogPage()"
          style="display:inline-flex;align-items:center;gap:8px;padding:10px 28px;background:rgba(242,125,38,.08);border:1px solid rgba(242,125,38,.25);color:#f27d26;font-size:.82rem;font-weight:800;border-radius:9999px;text-decoration:none;transition:all .2s;"
          onmouseover="this.style.background='rgba(242,125,38,.18)'"
          onmouseout="this.style.background='rgba(242,125,38,.08)'">
          📝 Read More Articles ›
        </a>
      </div>`;
    container.appendChild(sec);
  } catch(e){}
}

function buildPlaylistCard(pl){
  const count=(pl.videos||[]).length;
  const thumbVids=(pl.videos||[]).slice(0,4).map(id=>videos.find(v=>v.id===id)).filter(Boolean);
  const watchUrl=`/watch/${playlistSlug(pl)}/ep-1`;

  // Single thumbnail (use custom thumbnail, or first video thumb)
  const img=pl.thumbnail||(thumbVids[0]?getThumb(thumbVids[0]):`https://picsum.photos/seed/${pl.id}/800/450`);
  const thumbHtml=`<div class="pl-multithumb-single"><img src="${img}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${pl.id}/800/450'"></div>`;

  return`<a class="vcard" href="${watchUrl}" onclick="event.preventDefault();openPlaylistById('${pl.id}')">
    <div class="pl-multithumb">
      ${thumbHtml}
      <div class="pl-multithumb-overlay"></div>
      <div class="pl-multithumb-play"><div class="vcard-play-icon">
        <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
      </div></div>
      <div class="pl-ep-badge">▶ ${count} EP</div>
      <div class="pl-series-badge">Series</div>
    </div>
    <div class="vcard-title">${pl.name||""}</div>
    <div class="vcard-sub">${pl.description||`${count} episode${count!==1?"s":""}`}</div>
  </a>`;
}



function fillSection(sec,rowId){
  const isTrending=sec.target_type==="trending"||sec.title?.toLowerCase().includes("trend");
  const el=$(rowId);
  if(!el) return;

  // PLAYLIST type (single) — legacy support
  if(sec.target_type==="playlist"&&sec.target_id){
    const pl=playlists.find(p=>p.id===sec.target_id);
    el.innerHTML=pl?buildPlaylistCard(pl):`<div style="padding:1rem;color:#555;font-size:.82rem">Playlist not found.</div>`;
    return;
  }
  // MULTI_PLAYLIST — show one card per playlist
  if(sec.target_type==="multi_playlist"&&(sec.playlist_ids||[]).length){
    const pls=sortNewest((sec.playlist_ids||[]).map(id=>playlists.find(p=>p.id===id)).filter(Boolean), true);
    const cards=pls.map(pl=>buildPlaylistCard(pl)).join("");
    el.innerHTML=cards||`<div style="padding:1rem;color:#555;font-size:.82rem">No playlists found.</div>`;
    return;
  }
  if(sec.target_type==="single_videos"&&(sec.custom_videos||[]).length){
    const list=sortNewest((sec.custom_videos||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean));
    el.innerHTML=list.length?buildFeedWithAds(list,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6):skelRow();
    return;
  }
  if(sec.target_type==="category"&&sec.target_id){
    const cat=categories.find(c=>c.id===sec.target_id);
    const list=sortNewest(videos.filter(v=>v.category===(cat?.name||sec.target_id)||v.category_id===sec.target_id)).slice(0,12);
    el.innerHTML=list.length?buildFeedWithAds(list,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6):skelRow();
    return;
  }
  let list=isTrending
    ?[...videos].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,12)
    :sortNewest(videos).slice(0,12);
  el.innerHTML=list.length?list.map(v=>buildCard(v)).join(""):skelRow();
}

window.scrollRow=(id,dir)=>{const el=$(id);if(el)el.scrollBy({left:dir*700,behavior:"smooth"});};

// ── RECOMMENDED INFINITE SCROLL ──────────────────────
let _recPool=[], _recShown=0, _recLoading=false, _recDone=false;
const REC_BATCH=12;

function initRecommended(){
  // Shuffle all videos randomly
  _recPool=[...videos].sort(()=>Math.random()-.5);
  _recShown=0; _recDone=false;
  const grid=$('recommended-grid');
  const loader=$('recommended-loader');
  if(grid) grid.innerHTML='';
  if(loader) loader.textContent='';
  loadMoreRecommended();
}

function loadMoreRecommended(){
  if(_recLoading||_recDone) return;
  _recLoading=true;
  const grid=$('recommended-grid');
  const loader=$('recommended-loader');
  if(loader) loader.textContent='Loading...';

  const batch=_recPool.slice(_recShown, _recShown+REC_BATCH);
  if(!batch.length){ _recDone=true; if(loader) loader.textContent=''; _recLoading=false; return; }

  setTimeout(()=>{
    if(grid) grid.innerHTML+=buildFeedWithAds(batch,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6);
    _recShown+=batch.length;
    if(_recShown>=_recPool.length) _recDone=true;
    if(loader) loader.textContent=_recDone?'':' ';
    _recLoading=false;
  }, 100);
}

// Observe recommended loader for infinite scroll
function setupRecObserver(){
  const loader=$('recommended-loader');
  if(!loader) return;
  const obs=new IntersectionObserver(entries=>{
    if(entries[0].isIntersecting && !_recDone) loadMoreRecommended();
  },{rootMargin:'200px'});
  obs.observe(loader);
}
window.seeAll=sid=>{
  NP.start();
  const sec=sections.find(s=>s.id===sid);
  if(!sec){ showPage("cat"); return; }

  // Category type — go to proper /slug URL
  if(sec.target_type==="category"&&sec.target_id){
    const cat=categories.find(c=>c.id===sec.target_id);
    if(cat){ navGo(cat.id); return; }
  }

  // For any other type — build a virtual category page
  const slug='/'+toSlug(sec.title||'all');
  history.pushState({page:'cat',secId:sid},"",slug);
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-cat"));
  window.scrollTo(0,0);
  $("cat-title").textContent=sec.title||"All Videos";
  const seeAllCount=(sec.video_ids||[]).length||0;
  $("cat-desc").textContent=`${seeAllCount} video${seeAllCount!==1?'s':''} · Browse all ${sec.title||""} content`;
  // Banner background from first video in section
  const saBg=$("cat-banner-bg");
  const saFirst=(sec.video_ids||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean)[0];
  if(saBg) saBg.style.backgroundImage=saFirst?`url('${getThumb(saFirst)}')`:'none';
  updateMeta({title:`${sec.title} | រោងកុនគ្មានមនុស្ស`, desc:`Watch the best ${sec.title} videos online for free. Stream ${sec.title} content on រោងកុនគ្មានមនុស្ស (RongKunKmeanMnus) — no subscription needed.`, url:location.href});

  let list=[];
  if(sec.target_type==="multi_playlist"||sec.target_type==="playlist"){
    const ids=sec.playlist_ids||[sec.target_id].filter(Boolean);
    ids.forEach(pid=>{ const pl=playlists.find(p=>p.id===pid); if(pl)(pl.videos||[]).forEach(vid=>{ if(!list.find(v=>v.id===vid)){const v=videos.find(x=>x.id===vid);if(v)list.push(v);} }); });
  } else if(sec.target_type==="single_videos"){
    list=(sec.custom_videos||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean);
  } else {
    list=[...videos].sort((a,b)=>sec.target_type==="trending"?(b.views||0)-(a.views||0):0);
  }
  renderGrid($("cat-grid"),list);
};

// ── Watch ──
window.openVideo=async (id,push=true)=>{
  if(!id) return;
  // Always navigate to real URL when push=true
  if(push){
    const v=videos.find(x=>x.id===id); if(!v) return;
    const pl2=playlists.find(p=>(p.videos||[]).includes(id));
    if(pl2){
      const epNum=(pl2.videos||[]).indexOf(id)+1;
      window.location.href=`/watch/${playlistSlug(pl2)}/ep-${epNum}`;
    } else {
      window.location.href=`/watch/${videoSlug(v)}`;
    }
    return;
  }
  // push=false means called from routeFromUrl (page just loaded) — render directly
  // When push=false: render watch page directly (called from routeFromUrl after page load)
  NP.start();
  previousPage=location.pathname;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-watch'));
  window.scrollTo(0,0);
  playlistQueue=[];plQueueIdx=0;
  $("playlist-panel").style.display="none";
  // Reset mobile playlist toggle
  _mobilePlaylistOpen = false;
  const _mBtn=$('mobile-playlist-btn-wrap');
  if(_mBtn) _mBtn.style.display='none';
  const _mLabel=$('mobile-playlist-label');
  if(_mLabel) _mLabel.textContent='Show Playlist';
  const _mChevron=$('mobile-playlist-chevron');
  if(_mChevron) _mChevron.style.transform='';
  const _mEp=$('mobile-playlist-ep-count');
  if(_mEp) _mEp.textContent='';
  $("suggested-list").style.display="";
  if($("suggested-list-mobile")) $("suggested-list-mobile").style.display="";
  $("watch-next-btn").style.display="none";
  $("watch-prev-btn").style.display="none";
  clearCountdown();
  document.querySelectorAll('.watch-filter-chip').forEach(c=>c.classList.remove('active'));
  document.querySelector('.watch-filter-chip')?.classList.add('active');
  const chipPl=$("chip-playlist");
  if(chipPl)chipPl.style.display='none';
  $("suggested-list").innerHTML=skelRow(3);
  if($("suggested-list-mobile")) $("suggested-list-mobile").innerHTML=skelRow(3);
  _suggPage=0; _suggList=[];
  if(_suggObserver){ _suggObserver.disconnect(); _suggObserver=null; }
  // Reset article wrap
  const articleWrap = $('video-article-wrap');
  if(articleWrap){ articleWrap.style.display='none'; articleWrap.innerHTML=''; }

  // Reset description card
  const synWrapR=$('watch-synopsis-wrap');
  const cardR=$('watch-info-card');
  const descR=$('watch-desc');
  if(synWrapR) synWrapR.style.display='none';
  if(cardR) cardR.style.display='none';
  if(descR){ descR.style.display='none'; descR.innerHTML=''; }

  const v=videos.find(x=>x.id===id);if(!v)return;

  // Update URL — always use Firestore IDs for stable unique URLs
  const pl2=playlists.find(p=>(p.videos||[]).includes(id));
  if(push){
    if(pl2){
      const epNum=(pl2.videos||[]).indexOf(id)+1;
      // /watch/PLAYLIST_ID/ep-N
      history.pushState({page:'watch',videoId:id},'',`/watch/${pl2.id}/ep-${epNum}`);
    } else {
      // /watch/VIDEO_ID — clean, no title in URL
      history.pushState({page:'watch',videoId:id},'',`/watch/${v.id}`);
    }
  }

  // Show pre-roll ad, then load video with mid-roll schedule
  const loadVideo=()=>{
    const iframe=$("player-iframe");
    iframe.setAttribute('src', getEmbedUrl(v));
    scheduleMidrolls(v.duration||'');
  };
  // Show pre-roll (config already loaded at startup)
  if(window.showPreroll) showPreroll(loadVideo);
  else loadVideo();
  $("watch-title").textContent=v.title||"";

  $("watch-source").textContent=v.platform||v.source||"";
  $("watch-cat").textContent=v.category||"";
  const viewCount=(v.views||0)+1;
  $("watch-views").textContent=viewCount>1?fmtViews(viewCount)+' views':'';
  $("watch-date").textContent=v.createdAt?.toDate?v.createdAt.toDate().toLocaleDateString():"—";
  // If article linked → hide description area (article shown below playlist)
  if(v.articleId){
    // Hide all description elements
    const descEl=$('watch-desc'), synWrap=$('watch-synopsis-wrap'), card=$('watch-info-card'), toggle=$('watch-desc-toggle');
    if(descEl){ descEl.style.display='none'; descEl.innerHTML=''; }
    if(synWrap) synWrap.style.display='none';
    if(card) card.style.display='none';
    if(toggle) toggle.style.display='none';
  } else {
    // Render description normally
    renderWatchDescription(v);
  }

  // Tags
  const tagsEl=$("watch-tags");
  if(tagsEl){
    const tags=[v.category,v.platform||v.source].filter(Boolean);
    tagsEl.innerHTML=tags.map(t=>`<span class="watch-tag" onclick="doSearch('${t}')">${t}</span>`).join('');
  }

  // SEO + History
  addToHistory(id);
  updateMeta({
    title   : v.title,
    desc    : v.description && v.description.trim().length>20
      ? v.description
      : `Watch "${v.title}"${v.episodeNum?' Episode '+v.episodeNum:''} online free on រោងកុនគ្មានមនុស្ស. Stream ${v.category||'drama'} videos for free — no subscription needed.`,
    image   : getThumb(v),
    url     : location.href,
    type    : 'video.other',
    videoId : v.id
  });

  updateDoc(doc(db,"videos",id),{views:increment(1)}).catch(()=>{});
  const lv=videos.find(x=>x.id===id);if(lv)lv.views=(lv.views||0)+1;

  // Update episode active state immediately (fast visual feedback)
  document.querySelectorAll('.pl-item').forEach(el=>{
    const onclick = el.getAttribute('onclick')||'';
    const isActive = onclick.includes(id);
    if(isActive){
      el.classList.add('current');
      el.classList.remove('watched');
    } else {
      el.classList.remove('current');
    }
  });

  // Playlist
  const pl=playlists.find(p=>(p.videos||[]).includes(id));
  if(pl&&(pl.videos||[]).length>1){
    playlistQueue=(pl.videos||[]).map(vid=>videos.find(v=>v.id===vid)).filter(Boolean);
    plQueueIdx=playlistQueue.findIndex(v=>v.id===id);
    $("playlist-progress").textContent=`${plQueueIdx+1} / ${playlistQueue.length}`;
    const watchedIds=getHistory();
    $("playlist-items").innerHTML=playlistQueue.map((pv,pi)=>{
      const isWatched=watchedIds.includes(pv.id);
      const isCurrent=pv.id===id;
      return`<a class="pl-item${isCurrent?' current':''}${isWatched&&!isCurrent?' watched':''}"
        href="/watch/${playlistSlug(pl)}/ep-${pi+1}"
        onclick="event.preventDefault();window.location.href='/watch/${playlistSlug(pl)}/ep-${pi+1}'">
        <div class="pl-thumb" style="position:relative;">
          <img src="${getThumb(pv)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${pv.id}/320/180'">
          ${isCurrent?`<div class="pl-thumb-overlay"><svg width="11" height="11" fill="#fff" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg></div>`:''}
          ${pv.episodeNum?`<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:2;line-height:1">${pv.episodeNum}</div>`:''}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;min-width:0;flex:1">
          <div class="pl-title">${pv.title||""}</div>
          ${pv.duration?`<div class="pl-dur">${pv.duration}</div>`:''}
        </div>
        ${isWatched&&!isCurrent?`<div class="pl-watched-dot" title="Watched"></div>`:''}
      </a>`;
    }).join("");
    // Desktop: show playlist panel directly
    // Mobile: show toggle button, keep playlist hidden by default
    const isMobile = window.innerWidth <= 768;
    if(isMobile){
      $("playlist-panel").style.display="none";
      _mobilePlaylistOpen = false;
      const mBtn=$('mobile-playlist-btn-wrap');
      const mLabel=$('mobile-playlist-label');
      const mChevron=$('mobile-playlist-chevron');
      const mClose=$('mobile-playlist-close');
      const mEpCount=$('mobile-playlist-ep-count');
      if(mBtn) mBtn.style.display='block';
      if(mLabel) mLabel.textContent='Show Playlist';
      if(mChevron) mChevron.style.transform='';
      if(mClose) mClose.style.display='none';
      // Show episode count e.g. "EP 4 / 24"
      if(mEpCount && pl){
        const total = (pl.videos||[]).length;
        const current = (pl.videos||[]).indexOf(id)+1;
        mEpCount.textContent = `· EP ${current} / ${total}`;
      }
    } else {
      $("playlist-panel").style.display="";
    }

    // Show playlist chip on mobile
    const chipPl=$("chip-playlist");
    if(chipPl){ chipPl.style.display=''; chipPl.textContent=`📋 ${pl.name}`; }
    if(playlistQueue[plQueueIdx+1]){
      $("watch-next-btn").style.display="";
    } else {
      $("watch-next-btn").style.display="none";
    }
    if(playlistQueue[plQueueIdx-1]){
      $("watch-prev-btn").style.display="";
    } else {
      $("watch-prev-btn").style.display="none";
    }
  }

  // Load linked article if exists
  if(v.articleId){
    loadVideoArticle(v.articleId);
  } else {
    const articleWrap = $('video-article-wrap');
    if(articleWrap) articleWrap.style.display='none';
  }

  // Smarter related videos — same category first, then others
  const sameCat=videos.filter(x=>x.id!==id&&x.category===v.category);
  const others=videos.filter(x=>x.id!==id&&x.category!==v.category);
  const allRelated=[...sameCat,...others]; // ALL videos, not limited
  // Init infinite scroll for suggested
  initSuggInfiniteScroll(allRelated);

  // Load likes/dislikes + comments for this video
  loadReactions(id);
  loadComments(id);
  NP.done();
  // Setup mini player observer
};


window.openPlaylist=(plId,startId)=>{
  const pl=playlists.find(p=>p.id===plId);
  if(!pl||!(pl.videos||[]).length){
    const v=videos.find(x=>x.id===startId);
    if(v) window.location.href=`/watch/${videoSlug(v)}`;
    return;
  }
  const i=pl.videos.indexOf(startId);
  const vid=pl.videos[i>=0?i:0];
  const epNum=(pl.videos||[]).indexOf(vid)+1;
  window.location.href=`/watch/${playlistSlug(pl)}/ep-${epNum}`;
};
let _countdownTimer=null;
const COUNTDOWN_SEC=5;
const ARC_LEN=94.2; // 2π × r(15)

function clearCountdown(){
  if(_countdownTimer){ clearInterval(_countdownTimer); _countdownTimer=null; }
  const arc=$('countdown-arc');
  const lbl=$('next-label');
  if(arc) arc.style.strokeDashoffset=ARC_LEN;
  if(lbl) lbl.textContent='Next Episode';
}

function startCountdown(){
  clearCountdown();
  const next=playlistQueue[plQueueIdx+1];
  if(!next) return;
  let remaining=COUNTDOWN_SEC;
  const arc=$('countdown-arc');
  const lbl=$('next-label');

  function tick(){
    if(arc) arc.style.strokeDashoffset=ARC_LEN*(remaining/COUNTDOWN_SEC);
    if(lbl) lbl.textContent=`Next in ${remaining}s`;
    if(remaining<=0){
      clearCountdown();
      playNext();
      return;
    }
    remaining--;
  }
  tick();
  _countdownTimer=setInterval(tick,1000);
}

window.toggleDesc=()=>{
  const el=$('watch-desc'), btn=$('watch-desc-toggle');
  if(!el||!btn) return;
  const collapsed=el.style.overflow==='hidden';
  el.style.overflow=collapsed?'visible':'hidden';
  el.style.webkitLineClamp=collapsed?'unset':'3';
  btn.textContent=collapsed?'Show less ▴':'Show more ▾';
};

window.playNext=()=>{
  clearCountdown();
  const n=playlistQueue[plQueueIdx+1];
  if(!n) return;
  const pl=playlists.find(p=>(p.videos||[]).includes(n.id));
  if(pl){ const ep=(pl.videos||[]).indexOf(n.id)+1; window.location.href=`/watch/${playlistSlug(pl)}/ep-${ep}`; }
  else { const v=videos.find(x=>x.id===n.id); if(v) window.location.href=`/watch/${videoSlug(v)}`; }
};

window.playPrev=()=>{
  clearCountdown();
  const p=playlistQueue[plQueueIdx-1];
  if(!p) return;
  const pl=playlists.find(pl=>(pl.videos||[]).includes(p.id));
  if(pl){ const ep=(pl.videos||[]).indexOf(p.id)+1; window.location.href=`/watch/${playlistSlug(pl)}/ep-${ep}`; }
  else { const v=videos.find(x=>x.id===p.id); if(v) window.location.href=`/watch/${videoSlug(v)}`; }
};

// ── Watch filter chips ──
window.setWatchFilter=(type,btn)=>{
  document.querySelectorAll('.watch-filter-chip').forEach(c=>c.classList.remove('active'));
  btn?.classList.add('active');
  if(type==='playlist'){
    $('playlist-panel').style.display='';
    $('suggested-list').style.display='none';
    if($('suggested-list-mobile')) $('suggested-list-mobile').style.display='none';
  } else {
    $('playlist-panel').style.display='none';
    $('suggested-list').style.display='';
    if($('suggested-list-mobile')) $('suggested-list-mobile').style.display='';
  }
};
window.openPlaylistById=id=>{
  const pl=playlists.find(p=>p.id===id);
  if(!pl||(pl.videos||[]).length===0) return;
  window.location.href=`/watch/${playlistSlug(pl)}/ep-1`;
};

// ── Category ──
// Show category page content by category object
function showCatPage(cat){
  NP.start();
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-cat"));
  window.scrollTo(0,0);
  $("cat-title").textContent=cat.name;
  updateMeta({ title:`${cat.name} | រោងកុនគ្មានមនុស្ស`, desc:`Watch free ${cat.name} videos online. Stream the best ${cat.name} content on រោងកុនគ្មានមនុស្ស (RongKunKmeanMnus). No subscription needed.`, url:location.href });

  const ids=cat.target_ids||(cat.target_id?[cat.target_id]:[]);

  // Get list of videos for this category
  let catVideos=[];
  if(cat.target_type==="playlist"){
    const pls=ids.map(pid=>playlists.find(p=>p.id===pid)).filter(Boolean);
    catVideos=pls.flatMap(pl=>(pl.videos||[]).map(vid=>videos.find(v=>v.id===vid)).filter(Boolean));
  } else if(cat.target_type==="video"){
    catVideos=ids.map(vid=>videos.find(v=>v.id===vid)).filter(Boolean);
  } else {
    catVideos=videos.filter(v=>v.category===cat.name);
  }

  // Banner: use thumbnail of first video as blurred background
  const bannerBg=$("cat-banner-bg");
  const firstThumb=catVideos.length?getThumb(catVideos[0]):'';
  if(bannerBg) bannerBg.style.backgroundImage=firstThumb?`url('${firstThumb}')`:'none';

  // Video count in meta
  const count=catVideos.length;
  $("cat-desc").textContent=`${count} video${count!==1?'s':''} · ${cat.description||'Browse and enjoy'}`;

  // Sort by newest/updated first
  const sortedCatVideos = sortNewest(catVideos);
  // Render grid
  if(cat.target_type==="playlist"){
    const pls=ids.map(pid=>playlists.find(p=>p.id===pid)).filter(Boolean);
    const sortedPls = sortNewest(pls, true);
    const cards=sortedPls.map(pl=>buildPlaylistCard(pl)).join("");
    $("cat-grid").innerHTML=cards||`<div style="padding:2rem;color:#555;text-align:center">No playlists found.</div>`;
  } else {
    renderGrid($("cat-grid"), sortedCatVideos);
  }
  NP.done();
}

// Called from navGo for playlist/video types (URL already pushed)
window.openCategoryById=(id)=>{
  const cat=categories.find(c=>c.id===id); if(!cat)return;
  showCatPage(cat);
};

// Legacy / direct call — also pushes URL
window.openCategory=(id,name,push=true)=>{
  const decodedName=decodeURIComponent(name||id);
  const cat=categories.find(c=>c.id===id||c.name===decodedName)||{id,name:decodedName,target_type:'category'};
  if(push){
    const slug='/'+cat.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
    history.pushState({page:'cat',catId:id},"",slug);
  }
  showCatPage(cat);
};

// ── SHARE ──
window.toggleSharePanel=(e)=>{
  e.stopPropagation();
  $("share-panel")?.classList.toggle("open");
};
document.addEventListener("click",()=>$("share-panel")?.classList.remove("open"));

window.shareAction=(type)=>{
  const pageUrl = location.href;
  const title   = document.title;
  $("share-panel")?.classList.remove("open");

  // Resolve current video ID from URL (using Firestore IDs)
  let currentVidId = null;
  const path = location.pathname;
  if(path.startsWith('/watch/')){
    const parts = path.slice(7).split('/');
    if(parts.length>=2){
      // /watch/PLAYLIST_ID/ep-N
      const pl = playlists.find(p=>p.id===parts[0]);
      const epNum = parseInt((parts[1]||'').replace('ep-',''))||1;
      if(pl && pl.videos && pl.videos[epNum-1]) currentVidId = pl.videos[epNum-1];
    } else if(parts.length===1){
      // /watch/VIDEO_ID or /watch/PLAYLIST_ID (ep-1)
      const pl = playlists.find(p=>p.id===parts[0]);
      if(pl && pl.videos && pl.videos[0]) currentVidId = pl.videos[0];
      else {
        const v = videos.find(x=>x.id===parts[0]);
        if(v) currentVidId = v.id;
      }
    }
  }

  // Build share URL — use /api/og for Telegram/Facebook so bots get correct thumbnail
  const ogUrl = currentVidId
    ? `https://www.rongkunkmeanmnus.com/api/og?id=${currentVidId}`
    : pageUrl;

  if(type==="copy"){
    // Copy the real watch URL (not the API URL)
    navigator.clipboard.writeText(pageUrl).then(()=>showToast("Link copied!","ok"));
  } else if(type==="telegram"){
    window.open(`https://t.me/share/url?url=${encodeURIComponent(ogUrl)}&text=${encodeURIComponent(title)}`,'_blank');
  } else if(type==="facebook"){
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(ogUrl)}`,'_blank');
  }
};
window.copyLink=()=>shareAction('copy');

// ── LIKE / DISLIKE ──
let _currentVideoId=null;
const REACT_KEY='rkmn_reactions';
function getUserReactions(){ try{ return JSON.parse(localStorage.getItem(REACT_KEY)||'{}'); }catch{ return {}; } }
function setUserReaction(vid,type){ const r=getUserReactions(); r[vid]=type; localStorage.setItem(REACT_KEY,JSON.stringify(r)); }

async function loadReactions(vid){
  _currentVideoId=vid;
  const userReact=getUserReactions()[vid]||null;
  $('like-btn')?.classList.toggle('liked', userReact==='like');
  $('dislike-btn')?.classList.toggle('disliked', userReact==='dislike');
  try{
    const snap=await getDoc(doc(db,'videos',vid));
    const data=snap.data()||{};
    $('like-count').textContent=data.likes>0?data.likes:'';
    $('dislike-count').textContent=data.dislikes>0?data.dislikes:''
  }catch(e){}
}

window.reactVideo=async(type)=>{
  const vid=_currentVideoId; if(!vid)return;
  const prev=getUserReactions()[vid]||null;
  const isToggle=prev===type;
  const newReact=isToggle?null:type;
  setUserReaction(vid,newReact);

  $('like-btn')?.classList.toggle('liked', newReact==='like');
  $('dislike-btn')?.classList.toggle('disliked', newReact==='dislike');

  // Update Firestore counts
  const updates={};
  if(prev==='like')    updates.likes=increment(-1);
  if(prev==='dislike') updates.dislikes=increment(-1);
  if(newReact==='like')    updates.likes=increment(1);
  if(newReact==='dislike') updates.dislikes=increment(1);
  if(Object.keys(updates).length){
    try{
      await updateDoc(doc(db,'videos',vid),updates);
      // Refresh counts
      const snap=await getDoc(doc(db,'videos',vid));
      const data=snap.data()||{};
      const lc=Math.max(0,data.likes||0);
      const dc=Math.max(0,data.dislikes||0);
      $('like-count').textContent=lc>0?lc:'';
      $('dislike-count').textContent=dc>0?dc:'';
    }catch(e){}
  }
};

// ── COMMENTS ──
// ── COMMENT SYSTEM ──────────────────────────────────
const NAME_KEY='rkmn_username';
let _commentVideoId=null;
let _allComments=[];

// ── Locked name logic ──
function getSavedName(){ return localStorage.getItem(NAME_KEY)||''; }
function setSavedName(n){ localStorage.setItem(NAME_KEY,n); }
function initNameField(){
  const saved=getSavedName();
  const setup=$('username-setup');
  const form=$('comment-form-wrap');
  const avatar=$('comment-avatar');
  const display=$('username-display');
  if(saved){
    if(setup)setup.style.display='none';
    if(form)form.style.display='';
    if(display)display.textContent=saved;
    if(avatar){
      avatar.textContent=saved[0].toUpperCase();
      avatar.style.background=strColor(saved);
    }
  } else {
    if(setup)setup.style.display='';
    if(form)form.style.display='none';
  }
}

window.confirmUsername=()=>{
  const inp=$('username-input');
  const name=(inp?.value||'').trim();
  if(!name){ showToast('Enter a username first','err'); inp?.focus(); return; }
  if(name.length<2){ showToast('Username too short (min 2 chars)','err'); inp?.focus(); return; }
  // Confirm — permanent warning
  if(!confirm(`Set "${name}" as your permanent username?\n\nThis cannot be changed later.`)) return;
  setSavedName(name);
  initNameField();
  showToast('Username set! You can now comment.','ok');
};

// ── Load & render ──
async function loadComments(vid){
  _commentVideoId=vid;
  initNameField();
  const list=$('comments-list');
  if(!list)return;
  list.innerHTML=`<div class="comments-loading"><div class="loader-ring" style="width:16px;height:16px;border-width:2px"></div> Loading...</div>`;
  try{
    const snap=await getDocs(query(collection(db,'comments'),orderBy('createdAt','asc')));
    _allComments=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.videoId===vid);
    renderComments();
  }catch(e){list.innerHTML=`<div class="comments-empty">Could not load comments.</div>`;}
}

function renderComments(){
  const list=$('comments-list');
  if(!list)return;
  const tops=_allComments.filter(c=>!c.parentId);
  const total=_allComments.length;
  $('comment-count').textContent=total?`(${total})`:'';
  if(!tops.length){list.innerHTML=`<div class="comments-empty">No comments yet. Be the first!</div>`;return;}
  list.innerHTML=tops.map(c=>buildComment(c,0)).join('');
}

function buildComment(c,depth){
  const init=(c.name||'U')[0].toUpperCase();
  const time=fmtTime(c.createdAt);
  const children=_allComments.filter(x=>x.parentId===c.id);
  const visible=children.slice(0,2);
  const hidden=children.slice(2);
  const saved=getSavedName();
  const avatarInit=(saved[0]||'U').toUpperCase();
  const avatarBg=saved?strColor(saved):'#555';
  const canReply=depth<2;

  const repliesHtml=`<div class="replies-wrap" id="replies-${c.id}" ${children.length?'':'style="display:none"'}>
    ${visible.map(r=>buildComment(r,depth+1)).join('')}
    ${hidden.length?`<button class="view-more-replies" onclick="showMoreReplies('${c.id}')">▸ View ${hidden.length} more repl${hidden.length===1?'y':'ies'}</button>`:''}
  </div>`;

  return`<div class="comment-item" id="cmt-${c.id}" data-depth="${depth}">
    <div class="comment-avatar ${depth>0?'sm':''}" style="background:${strColor(c.name||'')}">${init}</div>
    <div class="comment-body">
      <div class="comment-author">
        ${escHtml(c.name||'Anonymous')}
        <span class="comment-time">${time}</span>
      </div>
      ${c.replyTo?`<div class="replying-to">↩ replying to <strong>${escHtml(c.replyTo)}</strong></div>`:''}
      <div class="comment-text">${escHtml(c.text||'')}</div>
      <div class="comment-actions">
        ${canReply?`<button class="comment-reply-btn" onclick="toggleReplyForm('${c.id}','${escHtml(c.name||'Anonymous')}')">↩ Reply</button>`:''}
      </div>
      <div id="reply-form-${c.id}" style="display:none" class="reply-form-wrap">
        <div class="reply-form">
          <div class="comment-avatar sm" style="background:${avatarBg}">${avatarInit}</div>
          <div style="flex:1">
            <textarea class="reply-text-input" id="reply-text-${c.id}" placeholder="Reply to ${escHtml(c.name||'Anonymous')}..." maxlength="500"></textarea>
            <div style="display:flex;gap:6px;margin-top:5px">
              <button class="reply-submit" onclick="submitReply('${c.id}','${escHtml(c.name||'Anonymous')}')">Reply</button>
              <button class="reply-cancel" onclick="toggleReplyForm('${c.id}','')">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      ${repliesHtml}
    </div>
  </div>`;
}

function fmtTime(ts){
  if(!ts?.toDate)return 'Just now';
  const d=ts.toDate(),now=new Date(),diff=Math.floor((now-d)/1000);
  if(diff<60)return 'Just now';
  if(diff<3600)return `${Math.floor(diff/60)}m ago`;
  if(diff<86400)return `${Math.floor(diff/3600)}h ago`;
  if(diff<604800)return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString();
}
function strColor(s){const h=[...s].reduce((a,c)=>a+c.charCodeAt(0),0)%360;return `hsl(${h},55%,38%)`;}
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

window.showMoreReplies=(parentId)=>{
  const children=_allComments.filter(x=>x.parentId===parentId);
  const wrap=document.getElementById('replies-'+parentId);
  if(!wrap)return;
  const depth=parseInt(document.getElementById('cmt-'+parentId)?.dataset.depth||0);
  wrap.innerHTML=children.map(r=>buildComment(r,depth+1)).join('');
};

window.toggleReplyForm=(parentId)=>{
  const form=document.getElementById('reply-form-'+parentId);
  if(!form)return;
  const isOpen=form.style.display!=='none';
  document.querySelectorAll('[id^="reply-form-"]').forEach(f=>f.style.display='none');
  if(!isOpen){form.style.display='';document.getElementById('reply-text-'+parentId)?.focus();}
};

window.submitComment=async()=>{
  const name=getSavedName();
  if(!name){showToast('Please set a username first','err');return;}
  const text=($('comment-text')?.value||'').trim();
  if(!text){showToast('Write something first','err');return;}
  if(!_commentVideoId)return;
  const btn=document.querySelector('.comment-submit');
  if(btn)btn.disabled=true;
  try{
    await addDoc(collection(db,'comments'),{videoId:_commentVideoId,name,text,parentId:null,replyTo:null,createdAt:serverTimestamp()});
    $('comment-text').value='';
    showToast('Comment posted!','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to post','err');}
  if(btn)btn.disabled=false;
};

window.submitReply=async(parentId,replyToName)=>{
  const name=getSavedName();
  if(!name){showToast('Please set a username first','err');return;}
  const textEl=document.getElementById('reply-text-'+parentId);
  const text=(textEl?.value||'').trim();
  if(!text){showToast('Write something first','err');return;}
  if(!_commentVideoId)return;
  const btn=document.querySelector(`#reply-form-${parentId} .reply-submit`);
  if(btn)btn.disabled=true;
  try{
    await addDoc(collection(db,'comments'),{videoId:_commentVideoId,name,text,parentId,replyTo:replyToName,createdAt:serverTimestamp()});
    if(textEl)textEl.value='';
    document.getElementById('reply-form-'+parentId).style.display='none';
    showToast('Reply posted!','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to post','err');}
  if(btn)btn.disabled=false;
};

window.deleteComment=async(id)=>{
  if(!confirm('Delete this comment and all its replies?'))return;
  try{
    const gather=(pid)=>{
      const kids=_allComments.filter(c=>c.parentId===pid).map(c=>c.id);
      return[pid,...kids.flatMap(kid=>gather(kid))];
    };
    const ids=gather(id);
    await Promise.all([...new Set(ids)].map(cid=>deleteDoc(doc(db,'comments',cid))));
    showToast('Deleted','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to delete','err');}
};

// closeMiniPlayer defined below in MINI PLAYER section


// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown',e=>{
  // Don't fire if typing in an input
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  const watchActive=document.getElementById('page-watch')?.classList.contains('active');
  if(!watchActive) return;
  if(e.key==='ArrowRight'||e.key==='n'){
    const next=playlistQueue[plQueueIdx+1];
    if(next){ clearCountdown(); openVideo(next.id); }
  }
  if(e.key==='ArrowLeft'||e.key==='p'){
    const prev=playlistQueue[plQueueIdx-1];
    if(prev){ clearCountdown(); openVideo(prev.id); }
  }
  if(e.key==='Escape') goBack();
});


// ── DONATE MODAL ─────────────────────────────────────────
window.openDonateModal = (e)=>{
  if(e) e.preventDefault();
  const m = document.getElementById('donate-modal');
  if(m){ m.classList.add('active'); document.body.style.overflow='hidden'; }
};
window.closeDonateModal = ()=>{
  const m = document.getElementById('donate-modal');
  if(m){ m.classList.remove('active'); document.body.style.overflow=''; }
};
window.dmSelect = (amount, btn)=>{
  document.querySelectorAll('.dm-amt').forEach(b=>b.classList.remove('active'));
  if(btn) btn.classList.add('active');
  const fmt = '$'+amount.toFixed(2);
  const d = document.getElementById('dm-amount-display');
  const q = document.getElementById('dm-qr-amount');
  if(d) d.textContent = fmt;
  if(q) q.textContent = fmt;
};
window.dmSurprise = ()=>{
  const amounts=[0.50,1,2,5,10,20,50];
  const r = amounts[Math.floor(Math.random()*amounts.length)];
  document.querySelectorAll('.dm-amt:not(.dm-surprise)').forEach(b=>{
    b.classList.toggle('active', parseFloat(b.textContent.replace('$',''))===r);
  });
  const fmt='$'+r.toFixed(2);
  const d=document.getElementById('dm-amount-display');
  const q=document.getElementById('dm-qr-amount');
  if(d) d.textContent=fmt;
  if(q) q.textContent=fmt;
};
// Close modal on backdrop click
document.addEventListener('click', e=>{
  const m=document.getElementById('donate-modal');
  if(m && e.target===m) closeDonateModal();
});

// ── SUGGESTED INFINITE SCROLL ────────────────────────────
let _suggList = [];
let _suggPage = 0;
const SUGG_PER_PAGE = 10;
let _suggObserver = null;

function initSuggInfiniteScroll(allVideos){
  // Reset state
  _suggList = allVideos;
  _suggPage = 0;

  // Clear both lists
  const el  = $('suggested-list');
  const elm = $('suggested-list-mobile');
  if(el)  el.innerHTML  = '';
  if(elm) elm.innerHTML = '';

  // Remove old observer
  if(_suggObserver) _suggObserver.disconnect();

  // Load first batch
  loadMoreSugg();

  // Setup IntersectionObserver on sentinel element
  setupSuggObserver();
}

function loadMoreSugg(){
  const start = _suggPage * SUGG_PER_PAGE;
  const end   = start + SUGG_PER_PAGE;
  const batch = _suggList.slice(start, end);
  if(!batch.length) return;

  _suggPage++;

  const html = buildSuggWithAds(batch,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6);

  const el  = $('suggested-list');
  const elm = $('suggested-list-mobile');

  // Remove old sentinel before appending
  el?.querySelector('.sugg-sentinel')?.remove();
  elm?.querySelector('.sugg-sentinel')?.remove();

  if(el)  el.insertAdjacentHTML('beforeend', html);
  if(elm) elm.insertAdjacentHTML('beforeend', html);

  // Add sentinel if more videos available
  if(_suggPage * SUGG_PER_PAGE < _suggList.length){
    const sentinel = `<div class="sugg-sentinel" style="height:20px;"></div>`;
    if(el)  el.insertAdjacentHTML('beforeend', sentinel);
    if(elm) elm.insertAdjacentHTML('beforeend', sentinel);
    setupSuggObserver();
  }
}

function setupSuggObserver(){
  if(_suggObserver) _suggObserver.disconnect();

  // Observe ALL sentinels — mobile scroll body + desktop sidebar
  const sentinels = [
    document.querySelector('.watch-scroll-body .sugg-sentinel'),
    document.querySelector('#suggested-list .sugg-sentinel'),
    document.querySelector('#suggested-list-mobile .sugg-sentinel'),
  ].filter(Boolean);

  if(!sentinels.length) return;

  let fired = false;
  _suggObserver = new IntersectionObserver((entries)=>{
    entries.forEach(e=>{
      if(e.isIntersecting && !fired){
        fired = true;
        _suggObserver.disconnect();
        loadMoreSugg();
      }
    });
  }, { rootMargin: '300px' });

  sentinels.forEach(s => _suggObserver.observe(s));
}

// ── SORT HELPERS ─────────────────────────────────────────
// Get latest timestamp for a video (createdAt or updatedAt)
function getVideoTime(v){
  if(v.updatedAt?.toDate) return v.updatedAt.toDate().getTime();
  if(v.createdAt?.toDate) return v.createdAt.toDate().getTime();
  if(v.updatedAt?.seconds) return v.updatedAt.seconds*1000;
  if(v.createdAt?.seconds) return v.createdAt.seconds*1000;
  return 0;
}

// Get latest timestamp for a playlist (based on most recently added video)
function getPlaylistTime(pl){
  if(pl.updatedAt?.toDate) return pl.updatedAt.toDate().getTime();
  if(pl.updatedAt?.seconds) return pl.updatedAt.seconds*1000;
  // Fall back to most recent video in playlist
  const times = (pl.videos||[]).map(id=>{
    const v = videos.find(x=>x.id===id);
    return v ? getVideoTime(v) : 0;
  });
  return times.length ? Math.max(...times) : 0;
}

function sortNewest(arr, isPlaylist=false){
  return [...arr].sort((a,b)=>{
    const ta = isPlaylist ? getPlaylistTime(a) : getVideoTime(a);
    const tb = isPlaylist ? getPlaylistTime(b) : getVideoTime(b);
    return tb - ta;
  });
}

// ── DRAMA DETAIL PAGE ────────────────────────────────────
let _currentDramaPlId = null;

window.openDramaDetail = (plId)=>{
  const pl = playlists.find(p=>p.id===plId);
  if(!pl) return;
  _currentDramaPlId = plId;
  NP.start();

  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-drama'));
  window.scrollTo(0,0);

  const slug = playlistSlug(pl);
  history.pushState({page:'drama',plId},'',`/drama/${slug}`);
  updateMeta({
    title: `${pl.name} | រោងកុនគ្មានមនុស្ស`,
    desc : pl.description||`Watch ${pl.name} online free with Khmer dubbing.`,
    url  : location.href
  });

  const vids = (pl.videos||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean);
  const first = vids[0];
  const thumb = pl.thumbnail||(first?getThumb(first):'');

  // Banner
  const bannerImg = $('drama-banner-img');
  if(bannerImg) bannerImg.style.backgroundImage = thumb?`url('${thumb}')`:'none';

  // Poster
  const poster = $('drama-poster');
  if(poster) poster.innerHTML = thumb?`<img src="${thumb}" style="width:100%;height:100%;object-fit:cover;">`:'';

  // Title & meta
  $('drama-title').textContent = pl.name||'';
  $('drama-meta').textContent  = `${vids.length} Episodes${pl.description?' · '+pl.description:''}`;

  // Description
  $('drama-desc').textContent = pl.description||`Watch all ${vids.length} episodes of ${pl.name} online free.`;

  // Episodes list
  const watchedIds = getHistory();
  $('drama-episodes').innerHTML = vids.map((v,i)=>{
    const epNum = i+1;
    const url   = `/watch/${playlistSlug(pl)}/ep-${epNum}`;
    const isWatched = watchedIds.includes(v.id);
    return `<a href="${url}" onclick="event.preventDefault();openPlaylist('${pl.id}','${v.id}')"
      style="display:flex;align-items:center;gap:.75rem;padding:.65rem .75rem;background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.05);border-radius:10px;text-decoration:none;transition:border-color .2s,background .2s;"
      onmouseover="this.style.borderColor='rgba(242,125,38,.3)';this.style.background='rgba(242,125,38,.04)'"
      onmouseout="this.style.borderColor='rgba(255,255,255,.05)';this.style.background='rgba(255,255,255,.02)'">
      <div style="width:50px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#111;flex-shrink:0;position:relative;">
        <img src="${getThumb(v)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
        ${isWatched?`<div style="position:absolute;inset:0;background:rgba(0,0,0,.5);display:flex;align-items:center;justify-content:center;font-size:.7rem;color:#22c55e;font-weight:900;">✓</div>`:''}
      </div>
      <div style="min-width:0;flex:1;">
        <div style="font-size:.78rem;font-weight:700;color:${isWatched?'#555':'#ccc'};">EP ${epNum}${v.title&&v.title!==pl.name?' — '+v.title.replace(pl.name,'').trim():''}</div>
        <div style="font-size:.65rem;color:#444;margin-top:2px;">${v.duration||''}</div>
      </div>
      ${isWatched?`<div style="font-size:.65rem;color:#22c55e;font-weight:700;flex-shrink:0;">Watched</div>`:''}
    </a>`;
  }).join('');

  NP.done();
};

window.playDrama = ()=>{
  if(!_currentDramaPlId) return;
  const pl = playlists.find(p=>p.id===_currentDramaPlId);
  if(!pl||(pl.videos||[]).length===0) return;
  // Find first unwatched episode
  const watched = getHistory();
  const firstUnwatched = (pl.videos||[]).find(id=>!watched.includes(id))||(pl.videos||[])[0];
  if(firstUnwatched) openPlaylist(pl.id, firstUnwatched);
};

// ── FOR YOU PAGE ─────────────────────────────────────────
// For You page state
let _fyPool=[], _fyPage=0, _fyObserver=null;
const FY_BATCH=20;

window.showForYouPage = async ()=>{
  NP.start();
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-cat'));
  window.scrollTo(0,0);
  history.pushState({page:'for-you'},'','/for-you');
  $('cat-title').textContent = '✨ For You';
  $('cat-desc').textContent  = 'Personalized mix of videos and articles';
  const bannerBg=$('cat-banner-bg');
  if(bannerBg) bannerBg.style.backgroundImage='none';
  updateMeta({title:'For You | រោងកុនគ្មានមនុស្ស', desc:'Your personalized mix of videos and articles on រោងកុនគ្មានមនុស្ស.', url:location.href});

  const grid = $('cat-grid');
  if(!grid){ NP.done(); return; }
  grid.innerHTML = skelRow(4);

  // Reset state
  _fyPage=0; _fyPool=[];
  if(_fyObserver){ _fyObserver.disconnect(); _fyObserver=null; }

  try {
    // Fetch blog posts
    const blogSnap = await getDocs(query(collection(db,'blog_posts'), orderBy('createdAt','desc')));
    const blogPosts = blogSnap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status==='published');

    // Shuffle videos
    const shuffledVids = [...videos].sort(()=>Math.random()-.5);
    const shuffledBlogs = [...blogPosts].sort(()=>Math.random()-.5);

    // Build mixed pool: 4 videos → 1 article → 4 videos → 1 article...
    // Ads are injected by buildFeedWithAds using AD_CONFIG.feedEvery setting
    const mixed = [];
    let vi=0, bi=0;
    while(vi<shuffledVids.length || bi<shuffledBlogs.length){
      for(let i=0;i<4&&vi<shuffledVids.length;i++){
        mixed.push({type:'video', data:shuffledVids[vi++]});
      }
      if(bi<shuffledBlogs.length){
        mixed.push({type:'blog', data:shuffledBlogs[bi++]});
      }
    }
    _fyPool = mixed;

    grid.innerHTML='';
    _fyRenderBatch(grid);

    // Setup infinite scroll sentinel
    const sentinel = document.createElement('div');
    sentinel.id='fy-sentinel';
    sentinel.style.cssText='height:20px;grid-column:1/-1;';
    grid.appendChild(sentinel);

    _fyObserver = new IntersectionObserver(entries=>{
      if(entries[0].isIntersecting){
        _fyRenderBatch(grid);
      }
    },{rootMargin:'300px'});
    _fyObserver.observe(sentinel);

  } catch(e){
    const shuffled = [...videos].sort(()=>Math.random()-.5);
    renderGrid(grid, shuffled);
  }
  NP.done();
};

function _fyBlogCard(p){
  return `<a class="vcard" href="/blog/${p.slug||p.id}" onclick="event.preventDefault();showBlogPost('${p.slug||p.id}')">
    <div class="vcard-thumb" style="position:relative;">
      ${p.cover
        ?`<img src="${p.cover}" alt="${(p.title||'').replace(/"/g,'')}" loading="lazy"
            onerror="this.parentElement.style.background='#111'">`
        :`<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;font-size:2.5rem;">📝</div>`}
      <div class="vcard-overlay"></div>
      <div style="position:absolute;top:6px;left:6px;background:#f27d26;color:#000;font-size:.58rem;font-weight:900;padding:2px 7px;border-radius:9999px;text-transform:uppercase;letter-spacing:.06em;">Article</div>
      ${p.category?`<div class="vcard-duration">${p.category}</div>`:''}
    </div>
    <div class="vcard-title">${p.title||''}</div>
    <div class="vcard-sub">${p.excerpt?p.excerpt.replace(/<[^>]*>/g,'').slice(0,60)+'…':''}</div>
  </a>`;
}

function _fyRenderBatch(grid){
  const start = _fyPage * FY_BATCH;
  const batch = _fyPool.slice(start, start+FY_BATCH);
  if(!batch.length) return;
  _fyPage++;

  // Remove sentinel temporarily
  const sentinel = document.getElementById('fy-sentinel');
  if(sentinel) sentinel.remove();

  // Inject ads using AD_CONFIG.feedEvery from Admin → Ads Settings
  const every = (window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6;
  const injected = injectAdCards(batch, every);
  const html = injected.map(item=>{
    if(item==='__AD__') return buildAdCard();
    if(item.type==='blog') return _fyBlogCard(item.data);
    return buildCard(item.data);
  }).join('');

  grid.insertAdjacentHTML('beforeend', html);

  // Re-add sentinel if more items
  if(_fyPage * FY_BATCH < _fyPool.length){
    const s = document.createElement('div');
    s.id='fy-sentinel';
    s.style.cssText='height:20px;grid-column:1/-1;';
    grid.appendChild(s);
    if(_fyObserver) _fyObserver.observe(s);
  }
}

// ── VIDEO ARTICLE DESCRIPTION ────────────────────────────
async function loadVideoArticle(articleId){
  const wrap = $('video-article-wrap');
  if(!wrap) return;
  wrap.style.display='block';
  wrap.innerHTML = `<div style="padding:1rem;text-align:center;color:#444;font-size:.8rem;">Loading article...</div>`;
  try {
    const snap = await getDoc(doc(db,'blog_posts',articleId));
    if(!snap.exists()){ wrap.style.display='none'; return; }
    const post = {id:snap.id,...snap.data()};
    if(post.status!=='published'){ wrap.style.display='none'; return; }

    wrap.innerHTML = `
      <div style="border-top:1px solid rgba(255,255,255,.06);padding-top:1.25rem;margin-top:1rem;">

        <!-- Header: title + read more button -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.85rem;flex-wrap:wrap;gap:8px;">
          <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1rem;">📝</span>
            <span style="font-size:.78rem;font-weight:800;color:#e4e4e7;">${post.title||''}</span>
          </div>
          <a href="/blog/${post.slug||post.id}" onclick="event.preventDefault();showBlogPost('${post.slug||post.id}')"
            style="font-size:.68rem;font-weight:700;color:#f27d26;text-decoration:none;background:rgba(242,125,38,.08);padding:3px 10px;border-radius:9999px;border:1px solid rgba(242,125,38,.2);white-space:nowrap;">
            Read Full Article ›
          </a>
        </div>

        <!-- Cover image if exists -->
        ${post.cover?`
        <div style="width:100%;aspect-ratio:16/6;overflow:hidden;border-radius:10px;margin-bottom:1rem;background:#111;">
          <img src="${post.cover}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
            onerror="this.parentElement.style.display='none'">
        </div>`:''}

        <!-- Excerpt -->
        ${post.excerpt?`<p style="font-size:.82rem;color:#777;line-height:1.65;margin-bottom:1rem;">${post.excerpt}</p>`:''}

        <!-- Full content collapsible -->
        <div id="video-article-content" class="blog-post-content" style="max-height:200px;overflow:hidden;position:relative;">
          ${post.content||''}
          <div style="position:absolute;bottom:0;left:0;right:0;height:60px;background:linear-gradient(transparent,var(--bg));pointer-events:none;"></div>
        </div>
        <button onclick="expandVideoArticle(this)" style="background:none;border:none;color:#f27d26;font-size:.75rem;font-weight:700;cursor:pointer;padding:.4rem 0;display:block;margin-top:.5rem;">Show more ▾</button>
      </div>`;
  } catch(e){ wrap.style.display='none'; }
}

window.expandVideoArticle = (btn)=>{
  const c = $('video-article-content');
  if(!c) return;
  const expanded = c.style.maxHeight === 'none';
  c.style.maxHeight = expanded ? '200px' : 'none';
  c.style.overflow  = expanded ? 'hidden' : 'visible';
  c.querySelector('div')?.style && (c.querySelector('div[style*="gradient"]').style.display = expanded ? '' : 'none');
  btn.textContent = expanded ? 'Show more ▾' : 'Show less ▴';
};

// ── BLOG ──────────────────────────────────────────────────
function blogMd(text){
  if(!text) return '';
  let t = text
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/^## (.+)$/gm,'<h2 style="font-size:1.1rem;font-weight:800;color:#e4e4e7;margin:1.2rem 0 .4rem;">$1</h2>')
    .replace(/^### (.+)$/gm,'<h3 style="font-size:.95rem;font-weight:700;color:#ccc;margin:1rem 0 .3rem;">$1</h3>')
    .replace(/\*\*(.+?)\*\*/g,'<strong style="color:#e4e4e7;">$1</strong>')
    .replace(/\*(.+?)\*/g,'<em style="color:#aaa;">$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g,'<a href="$2" target="_blank" rel="noopener" style="color:#f27d26;text-decoration:underline;">$1</a>')
    .replace(/^- (.+)$/gm,'<li style="margin:.25rem 0;">$1</li>')
    .split('\n\n').join('</p><p style="margin:.75rem 0;line-height:1.8;color:#999;">');
  return t;
}

window.showBlogPage = async function showBlogPage(){
  NP.start();
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-blog'));
  window.scrollTo(0,0);
  history.pushState({page:'blog'},'','/blog');
  updateMeta({title:'Blog | រោងកុនគ្មានមនុស្ស', desc:'Drama reviews, episode recaps, top lists and more from រោងកុនគ្មានមនុស្ស.'});
  const grid = $('blog-grid');
  if(!grid){ NP.done(); return; }
  grid.innerHTML = '<div class="skel-card"><div class="skeleton skel-thumb"></div><div class="skeleton skel-title"></div></div>'.repeat(4);
  try {
    const snap = await getDocs(query(collection(db,'blog_posts'), orderBy('createdAt','desc')));
    const posts = snap.docs.map(d=>({id:d.id,...d.data()})).filter(p=>p.status==='published')
      .sort((a,b)=>{
        const ta = a.updatedAt?.toDate?a.updatedAt.toDate().getTime():a.updatedAt?.seconds?a.updatedAt.seconds*1000:a.createdAt?.toDate?a.createdAt.toDate().getTime():0;
        const tb = b.updatedAt?.toDate?b.updatedAt.toDate().getTime():b.updatedAt?.seconds?b.updatedAt.seconds*1000:b.createdAt?.toDate?b.createdAt.toDate().getTime():0;
        return tb-ta;
      });
    if(!posts.length){
      grid.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:3rem;color:#555;">No articles yet — check back soon!</div>';
      NP.done(); return;
    }
    grid.innerHTML = posts.map(p=>`
      <a class="blog-card" href="/blog/${p.slug||p.id}" onclick="event.preventDefault();showBlogPost('${p.slug||p.id}')">
        <div class="blog-card-img">
          ${p.cover
            ?`<img src="${p.cover}" loading="lazy" onerror="this.parentElement.style.background='#1a1a1a'">`
            :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:2rem;background:#111;">📝</div>`}
        </div>
        <div class="blog-card-body">
          <div class="blog-card-cat">${p.category||'Article'}</div>
          <div class="blog-card-title">${p.title||''}</div>
          <div class="blog-card-excerpt">${p.excerpt||''}</div>
        </div>
      </a>`).join('');
  } catch(e){ grid.innerHTML='<div style="color:#555;padding:2rem;">Could not load posts.</div>'; }
  NP.done();
}

window.showBlogPost = async function showBlogPost(slug){
  NP.start();
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-blog-post'));
  window.scrollTo(0,0);
  const wrap = $('blog-post-wrap');
  if(!wrap){ NP.done(); return; }
  wrap.innerHTML = '<div style="text-align:center;padding:3rem;color:#555;">Loading...</div>';
  try {
    const snap = await getDocs(query(collection(db,'blog_posts'), where('slug','==',slug)));
    const post = snap.docs[0] ? {id:snap.docs[0].id,...snap.docs[0].data()} : null;
    if(!post || post.status!=='published'){ show404(); return; }
    history.pushState({page:'blog-post',slug},'','/blog/'+slug);
    updateMeta({title:post.title, desc:post.excerpt||post.title, image:post.cover||'', url:location.href});
    const date = post.createdAt?.toDate ? post.createdAt.toDate().toLocaleDateString() : '';

    // Get sidebar data — random articles + random videos
    const allPostsSnap = await getDocs(query(collection(db,'blog_posts'), orderBy('createdAt','desc')));
    const sidebarPosts = allPostsSnap.docs
      .map(d=>({id:d.id,...d.data()}))
      .filter(p=>p.status==='published' && p.slug!==slug)
      .sort(()=>Math.random()-.5).slice(0,3);
    const sidebarVids = [...videos].sort(()=>Math.random()-.5).slice(0,4);

    // Get related videos (selected or random)
    const relIds = post.relatedVideos||[];
    const relVids = relIds.length
      ? relIds.map(id=>videos.find(v=>v.id===id)).filter(Boolean)
      : [...videos].filter(v=>v.category===post.category).sort(()=>Math.random()-.5).slice(0,6);

    wrap.innerHTML = `
      <div class="blog-post-layout">
        <!-- Main Article -->
        <div class="blog-post-main">
          ${post.cover?`<div style="width:100%;aspect-ratio:16/6;overflow:hidden;border-radius:14px;margin-bottom:1.5rem;background:#111;">
            <img src="${post.cover}" style="width:100%;height:100%;object-fit:cover;" loading="lazy">
          </div>`:''}
          <div style="display:flex;align-items:center;gap:8px;margin-bottom:.75rem;flex-wrap:wrap;">
            <span style="font-size:.72rem;font-weight:700;background:rgba(242,125,38,.1);color:#f27d26;padding:3px 10px;border-radius:9999px;border:1px solid rgba(242,125,38,.2);">${post.category||'Article'}</span>
            ${date?`<span style="font-size:.72rem;color:#555;">${date}</span>`:''}
          </div>
          <h1 style="font-size:1.4rem;font-weight:900;color:#e4e4e7;line-height:1.35;margin-bottom:1rem;">${post.title||''}</h1>
          ${post.excerpt?`<p style="font-size:.9rem;color:#888;line-height:1.7;margin-bottom:1.5rem;padding-bottom:1.5rem;border-bottom:1px solid rgba(255,255,255,.06);">${post.excerpt}</p>`:''}

          <!-- Video Player Section -->
          ${(()=>{
            // Find playlist linked to this article
            const linkedPl = playlists.find(pl=>{
              // Check if any video in this playlist has this articleId
              return (pl.videos||[]).some(vid=>{
                const v = videos.find(x=>x.id===vid);
                return v && v.articleId && (v.articleId===post.id||v.articleId===(post.slug||post.id));
              });
            });
            // Also check relatedVideos
            const firstRelVid = post.relatedVideos?.[0] 
              ? videos.find(v=>v.id===post.relatedVideos[0]) 
              : null;
            const targetPl = linkedPl || (firstRelVid ? playlists.find(p=>(p.videos||[]).includes(firstRelVid?.id)) : null);
            const targetVid = targetPl ? videos.find(v=>v.id===(targetPl.videos||[])[0]) : firstRelVid;

            if(!targetVid) return '';

            const embedUrl = getEmbedUrl(targetVid);
            const plVids = targetPl ? (targetPl.videos||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean) : [];

            return `
            <div style="margin-bottom:1.5rem;border-radius:14px;overflow:hidden;border:1px solid rgba(255,255,255,.08);background:#111;">
              <!-- Player -->
              <div style="position:relative;aspect-ratio:16/9;background:#000;">
                <iframe id="blog-player-iframe" src="${embedUrl}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"
                  style="width:100%;height:100%;"></iframe>
              </div>
              <!-- Episode selector — thumbnail cards like computer view -->
              ${plVids.length>1?`
              <div style="border-top:1px solid rgba(255,255,255,.06);">
                <!-- Header -->
                <div style="padding:.6rem 1rem;display:flex;align-items:center;justify-content:space-between;">
                  <div style="font-size:.72rem;font-weight:800;color:#e4e4e7;">${targetPl?.name||''}</div>
                  <div style="font-size:.65rem;color:#555;">${plVids.length} Episodes</div>
                </div>
                <!-- Episode thumbnail cards — horizontal scroll on mobile, grid on desktop -->
                <div style="overflow-x:auto;padding:0 1rem .75rem;-webkit-overflow-scrolling:touch;scrollbar-width:none;">
                  <div style="display:flex;gap:8px;width:max-content;">
                    ${plVids.map((v,i)=>`
                      <div id="blog-ep-${i}" onclick="
                        document.getElementById('blog-player-iframe').src='${getEmbedUrl(v)}';
                        document.querySelectorAll('[id^=blog-ep-]').forEach(el=>{
                          el.style.borderColor='transparent';
                          el.querySelector('.ep-title-label').style.color='#888';
                        });
                        this.style.borderColor='#f27d26';
                        this.querySelector('.ep-title-label').style.color='#f27d26';
                        this.scrollIntoView({behavior:'smooth',block:'nearest',inline:'center'});"
                        style="flex-shrink:0;width:130px;cursor:pointer;border:2px solid ${i===0?'#f27d26':'transparent'};
                          border-radius:8px;overflow:hidden;background:#1a1a1a;transition:border-color .2s;">
                        <!-- Thumbnail -->
                        <div style="position:relative;aspect-ratio:16/9;background:#111;">
                          <img src="${getThumb(v)}" style="width:100%;height:100%;object-fit:cover;"
                            onerror="this.src='https://picsum.photos/seed/${v.id}/260/146'">
                          <div style="position:absolute;bottom:3px;left:3px;background:rgba(0,0,0,.8);
                            color:#fff;font-size:.55rem;font-weight:800;padding:1px 5px;border-radius:3px;">
                            EP ${i+1}
                          </div>
                        </div>
                        <!-- Title -->
                        <div style="padding:4px 6px;">
                          <div class="ep-title-label" style="font-size:.65rem;font-weight:700;
                            color:${i===0?'#f27d26':'#888'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                            ${v.title&&v.title!==targetPl?.name?v.title:`Episode ${i+1}`}
                          </div>
                        </div>
                      </div>`).join('')}
                  </div>
                </div>
              </div>`:''} 
            </div>`;
          })()}

          <div class="blog-post-content">${post.content||''}</div>

          <!-- Below Article Videos -->
          ${relVids.length?`
          <div style="margin-top:2.5rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.06);">
            <div style="font-size:.78rem;font-weight:800;color:#e4e4e7;margin-bottom:1rem;display:flex;align-items:center;gap:8px;">
              <span style="font-size:1rem;">🎬</span> Related Videos
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;">
              ${relVids.map(v=>{
                const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
                const url=pl?`/watch/${playlistSlug(pl)}/ep-${(pl.videos||[]).indexOf(v.id)+1}`:`/watch/${videoSlug(v)}`;
                const click=pl?`openPlaylist('${pl.id}','${v.id}')`:`window.location.href='${url}'`;
                return `<a href="${url}" onclick="event.preventDefault();${click}"
                  style="display:flex;flex-direction:column;background:rgba(255,255,255,.03);border:1px solid rgba(255,255,255,.06);border-radius:10px;overflow:hidden;text-decoration:none;transition:border-color .2s,transform .2s;"
                  onmouseover="this.style.borderColor='rgba(242,125,38,.3)';this.style.transform='translateY(-2px)'"
                  onmouseout="this.style.borderColor='rgba(255,255,255,.06)';this.style.transform=''">
                  <div style="aspect-ratio:16/9;overflow:hidden;background:#111;position:relative;">
                    <img src="${getThumb(v)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
                      onerror="this.src='https://picsum.photos/seed/${v.id}/320/180'">
                    ${v.episodeNum?`<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:2;line-height:1;">${v.episodeNum}</div>`:''}
                    ${v.duration?`<div style="position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,.75);color:#fff;font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:3px;">${v.duration}</div>`:''}
                  </div>
                  <div style="padding:.5rem .6rem;">
                    <div style="font-size:.75rem;font-weight:700;color:#ccc;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${v.title||''}</div>
                    <div style="font-size:.65rem;color:#555;margin-top:2px;">${v.category||''}${pl?' · Series':''}</div>
                  </div>
                </a>`;
              }).join('')}
            </div>
          </div>`:''}

          <div style="margin-top:2rem;padding-top:1.5rem;border-top:1px solid rgba(255,255,255,.06);">
            <a href="/blog" onclick="event.preventDefault();showBlogPage()" style="color:#f27d26;font-size:.82rem;font-weight:700;text-decoration:none;">← Back to Blog</a>
          </div>
        </div>

        <!-- Sidebar -->
        <div class="blog-post-sidebar">
          ${sidebarPosts.length?`
          <div class="blog-sidebar-section">
            <div class="blog-sidebar-title">📝 More Articles</div>
            ${sidebarPosts.map(p=>`
              <a href="/blog/${p.slug||p.id}" onclick="event.preventDefault();showBlogPost('${p.slug||p.id}')"
                style="display:flex;gap:.6rem;align-items:flex-start;text-decoration:none;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05);"
                onmouseover="this.querySelector('.sb-title').style.color='#f27d26'"
                onmouseout="this.querySelector('.sb-title').style.color='#ccc'">
                <div style="width:64px;aspect-ratio:16/9;flex-shrink:0;border-radius:6px;overflow:hidden;background:#111;">
                  ${p.cover?`<img src="${p.cover}" style="width:100%;height:100%;object-fit:cover;">`
                  :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;">📝</div>`}
                </div>
                <div>
                  <div class="sb-title" style="font-size:.77rem;font-weight:700;color:#ccc;line-height:1.3;transition:color .15s;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${p.title||''}</div>
                  <div style="font-size:.65rem;color:#555;margin-top:2px;">${p.category||''}</div>
                </div>
              </a>`).join('')}
          </div>`:''}

          ${sidebarVids.length?`
          <div class="blog-sidebar-section" style="margin-top:1.25rem;">
            <div class="blog-sidebar-title">🎬 Watch Now</div>
            ${sidebarVids.map(v=>{
              const pl=playlists.find(p=>(p.videos||[]).includes(v.id));
              const url=pl?`/watch/${playlistSlug(pl)}/ep-${(pl.videos||[]).indexOf(v.id)+1}`:`/watch/${videoSlug(v)}`;
              const click=pl?`openPlaylist('${pl.id}','${v.id}')`:`window.location.href='${url}'`;
              return `<a href="${url}" onclick="event.preventDefault();${click}"
                style="display:flex;gap:.6rem;align-items:flex-start;text-decoration:none;padding:.6rem 0;border-bottom:1px solid rgba(255,255,255,.05);"
                onmouseover="this.querySelector('.sb-vtitle').style.color='#f27d26'"
                onmouseout="this.querySelector('.sb-vtitle').style.color='#ccc'">
                <div style="width:64px;aspect-ratio:16/9;flex-shrink:0;border-radius:6px;overflow:hidden;background:#111;">
                  <img src="${getThumb(v)}" style="width:100%;height:100%;object-fit:cover;" loading="lazy"
                    onerror="this.src='https://picsum.photos/seed/${v.id}/320/180'">
                </div>
                <div>
                  <div class="sb-vtitle" style="font-size:.77rem;font-weight:700;color:#ccc;line-height:1.3;transition:color .15s;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;">${v.title||''}</div>
                  <div style="font-size:.65rem;color:#555;margin-top:2px;">${v.category||''}</div>
                </div>
              </a>`;
            }).join('')}
          </div>`:''}
        </div>
      </div>`;
  } catch(e){ wrap.innerHTML='<div style="color:#555;padding:2rem;">Could not load article.</div>'; }
  NP.done();
}

// ── MOBILE PLAYLIST TOGGLE ───────────────────────────────
let _mobilePlaylistOpen = false;

window.toggleMobilePlaylist = ()=>{
  _mobilePlaylistOpen = !_mobilePlaylistOpen;
  const panel    = $('playlist-panel');
  const label    = $('mobile-playlist-label');
  const chevron  = $('mobile-playlist-chevron');
  const closeBtn = $('mobile-playlist-close');
  const btn      = $('mobile-playlist-toggle');

  if(_mobilePlaylistOpen){
    if(panel){ panel.style.display=''; panel.style.animation='slideDown .25s ease'; }
    if(label) label.textContent = 'Hide Playlist';
    if(chevron) chevron.style.transform = 'rotate(180deg)';
    if(closeBtn) closeBtn.style.display = 'block';
    if(btn) btn.style.background = 'rgba(242,125,38,.12)';
  } else {
    if(panel) panel.style.display = 'none';
    if(label) label.textContent = 'Show Playlist';
    if(chevron) chevron.style.transform = '';
    if(closeBtn) closeBtn.style.display = 'none';
    if(btn) btn.style.background = 'rgba(242,125,38,.06)';
  }
};

// ── COOKIE CONSENT ───────────────────────────────────────
function initCookieBanner(){
  const consent = localStorage.getItem('rkmn_cookie_consent');
  if(!consent){
    // Show banner after 1.5s delay
    setTimeout(()=>{
      const b = document.getElementById('cookie-banner');
      if(b) b.style.display='block';
    }, 1500);
  }
}

window.acceptCookies = ()=>{
  localStorage.setItem('rkmn_cookie_consent','accepted');
  hideCookieBanner();
};

window.declineCookies = ()=>{
  localStorage.setItem('rkmn_cookie_consent','declined');
  hideCookieBanner();
};

function hideCookieBanner(){
  const b = document.getElementById('cookie-banner');
  if(!b) return;
  b.style.opacity='0';
  b.style.transition='opacity .3s';
  setTimeout(()=>{ b.style.display='none'; }, 300);
}

// ── PULL TO REFRESH ──────────────────────────────────────
(()=>{
  let startY=0, canPull=false, active=false;
  const threshold=70;
  const ind=()=>$('ptr-indicator');
  const txt=()=>ind()?.querySelector('.ptr-text');
  const ico=()=>ind()?.querySelector('.ptr-icon');

  // Check if the scrollable container is at the very top
  function isAtTop(){
    // Watch page — scroll body
    const wb=document.querySelector('#page-watch.active .watch-scroll-body');
    if(wb) return wb.scrollTop===0;
    // Home feed and other pages — window scroll
    return window.scrollY===0;
  }

  // Get the active scroll container
  function getScrollContainer(){
    const wb=document.querySelector('#page-watch.active .watch-scroll-body');
    if(wb) return wb;
    return window;
  }

  document.addEventListener('touchstart',e=>{
    // Only allow pull if already at the top
    if(isAtTop()){
      startY=e.touches[0].clientY;
      canPull=true;
      active=false;
    } else {
      canPull=false;
    }
  },{passive:true});

  document.addEventListener('touchmove',e=>{
    if(!canPull) return;
    // Still check we're at top (user might have scrolled)
    if(!isAtTop()){ canPull=false; return; }
    const dist=e.touches[0].clientY-startY;
    if(dist<=0) return; // pulling up — ignore
    active=true;
    const i=ind(); if(!i) return;
    i.classList.add('visible');
    if(dist>threshold){
      i.classList.add('releasing');
      if(txt()) txt().textContent='Release to refresh';
      if(ico()) ico().textContent='↑';
    } else {
      i.classList.remove('releasing');
      if(txt()) txt().textContent='Pull to refresh';
      if(ico()) ico().textContent='↓';
    }
  },{passive:true});

  document.addEventListener('touchend',e=>{
    if(!canPull||!active) return;
    canPull=false; active=false;
    const dist=e.changedTouches[0].clientY-startY;
    const i=ind(); if(!i) return;
    if(dist>threshold){
      i.classList.add('loading');
      if(txt()) txt().textContent='Refreshing...';
      if(ico()) ico().textContent='↻';
      setTimeout(()=>location.reload(),600);
    } else {
      i.classList.remove('visible','releasing');
    }
  },{passive:true});
})();

// Clear any old cache on startup
try{
  Object.keys(sessionStorage).forEach(k=>{ if(k.startsWith('rkmn_cache')) sessionStorage.removeItem(k); });
  Object.keys(localStorage).forEach(k=>{ if(k.startsWith('rkmn_cache')) localStorage.removeItem(k); });
}catch(e){}

loadAll();
