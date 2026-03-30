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
import{getFirestore,collection,getDocs,addDoc,deleteDoc,doc,updateDoc,increment,query,orderBy,getDoc,serverTimestamp,onSnapshot}from"https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// ── Firebase Config ──
const firebaseConfig={apiKey:"AIzaSyAnXxuc92620WOz_bVkovnUEQ_LL4YFPp8",authDomain:"streamhub-ce717.firebaseapp.com",projectId:"streamhub-ce717",storageBucket:"streamhub-ce717.firebasestorage.app",messagingSenderId:"223272731262",appId:"1:223272731262:web:d17866d4a12f610c864e2f"};
const siteDefaults={name:"RongKunKmeanMnus",footer:"Your ultimate destination for curated video content from Dailymotion and Rumble."};

const app=initializeApp(firebaseConfig);
const db=getFirestore(app);

// ── State ──
let videos=[],playlists=[],categories=[],sections=[];
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

// ── Helpers ──
const $=id=>document.getElementById(id);
function toSlug(s){ return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80); }
// Returns best URL slug for a video — uses title if latin, else uses ID
function videoSlug(v){
  const s=toSlug(v.title||'');
  return s.length>=3 ? s : v.id;
}
// Returns best URL slug for a playlist
function playlistSlug(pl){
  const s=toSlug(pl.name||'');
  return s.length>=3 ? s : pl.id;
}
const fmtViews=n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(1)+"K":String(n||0);
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
function updateMeta({title, desc, image, url, type='website', videoId=''}){
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
  if(jsonld && type === 'video.other' && title){
    jsonld.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": title,
      "description": fullDesc,
      "thumbnailUrl": fullImg,
      "url": fullUrl,
      "embedUrl": fullUrl,
      "uploadDate": new Date().toISOString(),
      "inLanguage": "en"
    });
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
  if(mobileMenuOpen){ mobileMenuOpen=false; document.body.style.overflow=''; document.body.style.position=''; document.body.style.width=''; const s=$("mobile-menu"),b=$("sheet-backdrop"); if(s)s.style.transform='translateY(100%)'; if(b){b.style.background='rgba(0,0,0,0)';setTimeout(()=>b.style.display='none',350);} }

  history.pushState({page:'search',q},"",`/search?q=${encodeURIComponent(q)}`);
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-search"));
  window.scrollTo(0,0);
  updateMeta({title:`Search: ${q} | រោងកុនគ្មានមនុស្ស`, desc:`Search results for "${q}" — Watch free drama and entertainment videos on រោងកុនគ្មានមនុស្ស.`});
  const results=videos.filter(v=>matchSearch(v,q));
  $("search-info").textContent=`${results.length} results for "${q}"`;
  renderGrid($("search-grid"),results);
  NP.done();
};
window.openDesktopSearch=()=>{
  // Create overlay if not exists
  let overlay=$('desktop-search-overlay');
  if(!overlay){
    overlay=document.createElement('div');
    overlay.id='desktop-search-overlay';
    overlay.style.cssText='position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,.85);z-index:500;display:flex;align-items:flex-start;justify-content:center;padding-top:120px;backdrop-filter:blur(6px);';
    overlay.innerHTML=`
      <div style="width:100%;max-width:600px;padding:0 20px;">
        <div style="display:flex;align-items:center;gap:12px;background:#1a1a1a;border:1px solid rgba(255,255,255,.12);border-radius:14px;padding:14px 18px;">
          <svg width="18" height="18" fill="none" stroke="#f27d26" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/></svg>
          <input id="desktop-search-input" type="text" placeholder="Search videos..." autofocus
            style="flex:1;background:none;border:none;outline:none;color:#fff;font-size:1rem;font-family:inherit;"
            onkeydown="if(event.key==='Enter'){closeDesktopSearch();doSearch(this.value);} if(event.key==='Escape') closeDesktopSearch();">
          <button onclick="closeDesktopSearch()" style="background:none;border:none;color:#555;cursor:pointer;font-size:1.2rem;line-height:1;">✕</button>
        </div>
        <p style="text-align:center;color:#444;font-size:.75rem;margin-top:12px;">Press Enter to search · Esc to close</p>
      </div>`;
    overlay.addEventListener('click', e=>{ if(e.target===overlay) closeDesktopSearch(); });
    document.body.appendChild(overlay);
  } else {
    overlay.style.display='flex';
  }
  setTimeout(()=>$('desktop-search-input')?.focus(),50);
};
window.closeDesktopSearch=()=>{
  const o=$('desktop-search-overlay');
  if(o) o.style.display='none';
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

function showPage(id, push=true){
  if(id!=="watch"){
    previousPage=id;
    // Stop video when leaving watch page
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
      history.pushState({page:'home'},"","/");
    } else if(id==='history'){
      history.pushState({page:'history'},"","/history");
    } else if(id==='about'){
      history.pushState({page:'about'},"","/about");
    } else if(id==='privacy'){
      history.pushState({page:'privacy'},"","/privacy");
    } else if(id==='terms'){
      history.pushState({page:'terms'},"","/terms");
    } else if(id==='contact'){
      history.pushState({page:'contact'},"","/contact");
    } else if(id==='search'){
      // Don't push state here - doSearch handles it
    } else {
      history.pushState({page:id},"","/"+id);
    }
  }
  window.scrollTo(0,0);
  // Update bottom nav
  document.querySelectorAll('#bottom-nav a').forEach(a=>a.classList.remove('active'));
  const bnMap={home:'bn-home',search:'bn-search',history:'bn-history'};
  if(bnMap[id]) $(bnMap[id])?.classList.add('active');
  // Reset meta for non-video pages
  if(id==='home') updateMeta({title:'រោងកុនគ្មានមនុស្ស | Watch Chinese Drama, Khmer Drama Free Online', desc:'Watch Chinese Drama, Khmer Drama and Khmer dubbed series online for free. រោងកុនគ្មានមនុស្ស — your free streaming destination. No subscription needed.', url:'https://www.rongkunkmeanmnus.com'});
  if(id==='about') updateMeta({title:'About Us | រោងកុនគ្មានមនុស្ស', desc:'Learn more about RongKunKmeanMnus - your free streaming destination for Chinese and Khmer dramas.'});
  if(id==='privacy') updateMeta({title:'Privacy Policy | រោងកុនគ្មានមនុស្ស', desc:'Read our privacy policy to understand how we protect your data.'});
  if(id==='terms') updateMeta({title:'Terms of Service | រោងកុនគ្មានមនុស្ស', desc:'Terms and conditions for using RongKunKmeanMnus streaming service.'});
  if(id==='contact') updateMeta({title:'Contact Us | រោងកុនគ្មានមនុស្ស', desc:'Get in touch with RongKunKmeanMnus support team.'});
}
window.goHome=e=>{
  e?.preventDefault();
  history.pushState({page:'home'},"","/");
  showPage("home", false);
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
    const[vidSnap,secSnap]=await Promise.all([
      getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
      getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
    ]);
    const newVideos=vidSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');
    const newSections=secSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
    // Only rebuild if data changed
    const changed=JSON.stringify(newVideos.map(v=>v.id))!==JSON.stringify(videos.map(v=>v.id))
      ||newSections.length!==sections.length;
    if(changed){
      videos=newVideos;
      sections=newSections;
      buildHero();
      buildSections();
      initRecommended();
    }
  }catch(e){}
}

// FIXED: Back button now uses browser's native history
window.goBack = () => {
  history.back();
};

function routeFromUrl(push=false){
  const path=location.pathname;
  if(path==="/"||path===""){ showPage("home",false); return; }

  // /watch/playlist-slug/ep-N  or  /watch/video-slug
  if(path.startsWith("/watch/")){
    const parts=path.slice(7).split("/"); // remove '/watch/'
    if(parts.length>=2){
      // playlist video: /watch/playlist-slug/ep-N
      const plSlug=parts[0];
      const epRaw=parts[1]||'';
      // Must be exactly 'ep-N' format where N is digits only
      if(!/^ep-\d+$/.test(epRaw)){ show404(); return; }
      const epNum=parseInt(epRaw.replace('ep-',''))||1;
      const pl=playlists.find(p=>playlistSlug(p)===plSlug||toSlug(p.name)===plSlug);
      if(pl&&(pl.videos||[]).length){
        // No fallback — episode must exist exactly
        const vidId=pl.videos[epNum-1];
        if(!vidId){ show404(); return; } // episode number out of range
        const vid=videos.find(v=>v.id===vidId);
        if(vid){ openVideo(vid.id,false); return; }
      }
    }
    if(parts.length===1){
      // single video: /watch/video-slug (or /watch/id as fallback)
      const vSlug=parts[0];
      const vid=videos.find(v=>videoSlug(v)===vSlug||toSlug(v.title)===vSlug||v.id===vSlug);
      if(vid){ openVideo(vid.id,false); return; }
    }
    show404(); return;  // /watch/ URL didn't match any video or playlist
  }

  // Category slug
  const slug=path.replace(/^\//, '');
  const cat=categories.find(c=>toSlug(c.name)===slug);
  if(cat){ showCatPage(cat); return; }

  // About pages
  if(path==='/about'){ showPage('about',false); return; }
  if(path==='/privacy'){ showPage('privacy',false); return; }
  if(path==='/terms'){ showPage('terms',false); return; }
  if(path==='/contact'){ showPage('contact',false); return; }
  if(path==='/donate'){ openDonateModal(); showPage('home',false); return; }

  // Search: /search?q=...
  if(path==='/search'){
    const q=new URLSearchParams(location.search).get('q')||'';
    if(q) doSearch(q);
    else showPage('home',false);
    return;
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

// FIXED: Enhanced popstate handler for complete history navigation
window.addEventListener("popstate", e => {
  const path = location.pathname;
  
  // Handle home
  if (path === "/" || path === "") {
    showPage("home", false);
    updateMeta({
      title: 'រោងកុនគ្មានមនុស្ស | Watch Chinese Drama, Khmer Drama Free Online',
      desc: 'Watch Chinese Drama, Khmer Drama and Khmer dubbed series online for free.',
      url: 'https://www.rongkunkmeanmnus.com'
    });
    buildNav('home');
    return;
  }
  
  // Handle watch page
  if (path.startsWith("/watch/")) {
    const parts = path.slice(7).split("/");
    if (parts.length >= 2) {
      const plSlug = parts[0];
      const epRaw = parts[1] || '';
      if (/^ep-\d+$/.test(epRaw)) {
        const epNum = parseInt(epRaw.replace('ep-', '')) || 1;
        const pl = playlists.find(p => playlistSlug(p) === plSlug || toSlug(p.name) === plSlug);
        if (pl && (pl.videos || []).length) {
          const vidId = pl.videos[epNum - 1];
          if (vidId) {
            const vid = videos.find(v => v.id === vidId);
            if (vid) {
              openVideo(vid.id, false);
              return;
            }
          }
        }
      }
    }
    if (parts.length === 1) {
      const vSlug = parts[0];
      const vid = videos.find(v => videoSlug(v) === vSlug || toSlug(v.title) === vSlug || v.id === vSlug);
      if (vid) {
        openVideo(vid.id, false);
        return;
      }
    }
    show404();
    return;
  }
  
  // Handle search
  if (path === '/search') {
    const q = new URLSearchParams(location.search).get('q') || '';
    if (q) doSearch(q);
    else showPage('home', false);
    return;
  }
  
  // Handle history
  if (path === '/history') {
    showHistoryPage();
    return;
  }
  
  // Handle category
  const slug = path.replace(/^\//, '');
  const cat = categories.find(c => toSlug(c.name) === slug);
  if (cat) {
    showCatPage(cat);
    return;
  }
  
  // Handle about pages
  if (path === '/about') {
    showPage('about', false);
    return;
  }
  if (path === '/privacy') {
    showPage('privacy', false);
    return;
  }
  if (path === '/terms') {
    showPage('terms', false);
    return;
  }
  if (path === '/contact') {
    showPage('contact', false);
    return;
  }
  if (path === '/donate') {
    openDonateModal();
    showPage('home', false);
    return;
  }
  
  // Default to home if nothing matches
  showPage('home', false);
});

// ── Load Data ──
async function loadAll(){
  try{
    // Load ads config first so feed cards render correctly
    if(window.loadAdsConfig) await window.loadAdsConfig();

    const[catSnap,plSnap,vidSnap,secSnap]=await Promise.all([
      getDocs(collection(db,"categories")),
      getDocs(collection(db,"playlists")),
      getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
      getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
    ]);
    categories=catSnap.docs.map(d=>({id:d.id,...d.data()}));
    playlists=plSnap.docs.map(d=>({id:d.id,...d.data()}));
    videos=vidSnap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');
    sections=secSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.display_order||0)-(b.display_order||0));

    const stDoc=await getDoc(doc(db,"settings","main")).catch(()=>null);
    if(stDoc?.exists()){
      const s=stDoc.data();
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
    }else{
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
    routeFromUrl(false);
    // Hide loader
    const loader=$('page-loader');
    if(loader){ loader.classList.add('hidden'); setTimeout(()=>loader.remove(),500); }
    // Lazy load images with IntersectionObserver
    setupLazyLoad();
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
  let isFirst = true;
  onSnapshot(query(collection(db,'videos'),orderBy('createdAt','desc')), snap=>{
    // Skip first snapshot — already loaded in loadAll()
    if(isFirst){ isFirst=false; return; }

    const updated = snap.docs.map(d=>({id:d.id,...d.data()})).filter(v=>v.status!=='draft');

    // Check what changed
    const addedIds   = updated.filter(uv=>!videos.find(v=>v.id===uv.id)).map(v=>v.id);
    const removedIds = videos.filter(v=>!updated.find(uv=>uv.id===v.id)).map(v=>v.id);
    const hasChanges = addedIds.length > 0 || removedIds.length > 0 ||
      updated.some(uv=>{ const old=videos.find(v=>v.id===uv.id); return old && JSON.stringify(old)!==JSON.stringify(uv); });

    if(!hasChanges) return;

    // Update videos array
    videos = updated;

    // Rebuild home feed sections
    buildSections();
    buildHero();

    // Show toast for new videos
    if(addedIds.length > 0){
      showUpdateToast(addedIds.length);
    }
  });
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

function setupLazyLoad(){
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting
