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

function showPage(id,push=true){
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
  if(push)history.pushState({page:id},"",id==="home"?"/":"/"+id);
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
window.goBack=()=>{
  if(previousPage&&previousPage!==location.pathname){
    history.back();
  } else {
    showPage('home');
  }
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


window.addEventListener("popstate",e=>{
  if(!e.state) return routeFromUrl(false);
  if(e.state.page==="watch"&&e.state.videoId){
    // Stop any currently playing video first
    const iframe=$('player-iframe');
    if(iframe) iframe.src='about:blank';
    setTimeout(()=>openVideo(e.state.videoId,false), 50);
  } else if(e.state.page==="cat"){
    const cat=categories.find(c=>c.id===e.state.catId);
    if(cat) showCatPage(cat);
    else routeFromUrl(false);
  } else if(e.state.page==='search'&&e.state.q){
    doSearch(e.state.q);
  } else if(e.state.page==='history'){
    showHistoryPage();
  } else if(e.state.page){
    showPage(e.state.page,false);
  }
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
    +desktopCats.map(c=>`<a href="${slug(c)}" data-catid="${c.id}" onclick="event.preventDefault();navGo('${c.id}')" ${resolvedActive===c.id?'class="active"':''}>${c.name}</a>`).join("")
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
    +`<a href="/donate"
      style="display:flex;align-items:center;gap:14px;padding:13px 12px;border-radius:12px;font-size:.9rem;font-weight:700;color:#f27d26;text-decoration:none;background:rgba(242,125,38,.06);border:1px solid rgba(242,125,38,.15);margin-top:8px;"
      onmouseover="this.style.background='rgba(242,125,38,.12)'"
      onmouseout="this.style.background='rgba(242,125,38,.06)'">
      <div style="width:36px;height:36px;border-radius:10px;background:rgba(242,125,38,.15);border:1px solid rgba(242,125,38,.25);display:flex;align-items:center;justify-content:center;flex-shrink:0;font-size:1.1rem;">☕</div>
      Donate
    </a>`;
  $("footer-links").innerHTML=
    `<a href="/" onclick="goHome(event)" ${resolvedActive==='home'?'class="active"':''}>Home</a>`
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
  return`<a class="vcard" data-id="${v.id}" href="${watchUrl}" onclick="event.preventDefault();${click}">
    <div class="vcard-thumb">
      <img src="${getThumb(v)}" alt="${(v.title||"").replace(/"/g,"")}" loading="lazy"
        onerror="this.src='https://picsum.photos/seed/${v.id}x/800/450'">
      <div class="vcard-overlay"></div>
      <div class="vcard-play"><div class="vcard-play-icon">
        <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
      </div></div>
      ${v.duration?`<div class="vcard-duration">${v.duration}</div>`:""}
      ${pl?`<div class="vcard-series">Series</div>`:""}
      ${v.episodeNum?`<div class="ep-badge ep-badge--${v.badgePos||'top-left'}">${v.episodeNum}</div>`:""}
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
        ${x.episodeNum?`<div style="position:absolute;top:4px;left:4px;width:22px;height:22px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.6rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:2;line-height:1">${x.episodeNum}</div>`:''}
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
  $("hero-desc").textContent=desc;
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
            ${v.episodeNum?`<div style="position:absolute;top:5px;left:5px;width:24px;height:24px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.65rem;font-weight:900;color:#fff;box-shadow:0 1px 4px rgba(0,0,0,.6);border:1.5px solid rgba(255,255,255,.25);z-index:3;line-height:1">${v.episodeNum}</div>`:''}
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
    const cards=(sec.playlist_ids||[])
      .map(id=>playlists.find(p=>p.id===id)).filter(Boolean)
      .map(pl=>buildPlaylistCard(pl)).join("");
    el.innerHTML=cards||`<div style="padding:1rem;color:#555;font-size:.82rem">No playlists found.</div>`;
    return;
  }
  if(sec.target_type==="single_videos"&&(sec.custom_videos||[]).length){
    const list=(sec.custom_videos||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean);
    el.innerHTML=list.length?buildFeedWithAds(list,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6):skelRow();
    return;
  }
  if(sec.target_type==="category"&&sec.target_id){
    const cat=categories.find(c=>c.id===sec.target_id);
    const list=videos.filter(v=>v.category===(cat?.name||sec.target_id)||v.category_id===sec.target_id).slice(0,12);
    el.innerHTML=list.length?buildFeedWithAds(list,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6):skelRow();
    return;
  }
  let list=isTrending?[...videos].sort((a,b)=>(b.views||0)-(a.views||0)).slice(0,12):videos.slice(0,12);
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
  NP.start();


  // Save current URL as previous page before navigating (for back button)
  if(push) previousPage=location.pathname;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-watch'));
  window.scrollTo(0,0);
  playlistQueue=[];plQueueIdx=0;
  $("playlist-panel").style.display="none";
  $("suggested-list").style.display="";
  if($("suggested-list-mobile")) $("suggested-list-mobile").style.display="";
  $("watch-next-btn").style.display="none";
  clearCountdown();
  // Reset filter chips
  document.querySelectorAll('.watch-filter-chip').forEach(c=>c.classList.remove('active'));
  document.querySelector('.watch-filter-chip')?.classList.add('active');
  const chipPl=$("chip-playlist");
  if(chipPl)chipPl.style.display='none';
  $("suggested-list").innerHTML=skelRow(3);
  if($("suggested-list-mobile")) $("suggested-list-mobile").innerHTML=skelRow(3);

  const v=videos.find(x=>x.id===id);if(!v)return;

  // Build watch URL
  if(push){
    const pl2=playlists.find(p=>(p.videos||[]).includes(id));
    if(pl2){
      const epNum=(pl2.videos||[]).indexOf(id)+1;
      const watchUrl=`/watch/${playlistSlug(pl2)}/ep-${epNum}`;
      history.pushState({page:'watch',videoId:id},"",watchUrl);
    } else {
      history.pushState({page:'watch',videoId:id},"",`/watch/${videoSlug(v)}`);
    }
  }

  // Show pre-roll ad, then load video with mid-roll schedule
  const loadVideo=()=>{
    const iframe=$("player-iframe");
    const embedUrl=getEmbedUrl(v);
    // Clear first then set with small delay for reliable reload
    iframe.src='about:blank';
    setTimeout(()=>{ iframe.src=embedUrl; }, 100);
    scheduleMidrolls(v.duration||'');
  };
  // Show pre-roll (config already loaded at startup)
  if(window.showPreroll) showPreroll(loadVideo);
  else loadVideo();
  $("watch-title").textContent=v.title||"";
  $("watch-source").textContent=v.platform||v.source||"";
  $("watch-cat").textContent=v.category||"";
  $("watch-views").textContent=fmtViews((v.views||0)+1);
  $("watch-date").textContent=v.createdAt?.toDate?v.createdAt.toDate().toLocaleDateString():"—";
  // Description with expand toggle — rich fallback for SEO
  const platform = v.platform||v.source||'';
  const platformName = platform==='youtube'?'YouTube':platform==='dailymotion'?'Dailymotion':
    platform==='rumble'?'Rumble':platform==='vimeo'?'Vimeo':platform==='facebook'?'Facebook':
    platform==='odysee'?'Odysee':platform;
  const cat = v.category||'';
  const epText = v.episodeNum ? `Episode ${v.episodeNum}` : '';
  const fallbackDesc = [
    v.title ? `Watch "${v.title}"${epText?' - '+epText:''} online for free on រោងកុនគ្មានមនុស្ស (RongKunKmeanMnus).` : '',
    cat ? `This is a ${cat} video${platformName?' available on '+platformName:''}.` : '',
    `Stream high quality ${cat||'drama'} content for free. No subscription needed. Enjoy the best ${cat||'entertainment'} videos online.`,
    `រោងកុនគ្មានមនុស្ស brings you the best ${cat||'video'} content curated from top streaming platforms.`
  ].filter(Boolean).join(' ');
  const descText = v.description && v.description.trim().length > 20 ? v.description : fallbackDesc;
  $("watch-desc").textContent=descText;
  const toggle=$("watch-desc-toggle");
  if(toggle){
    toggle.style.display=descText.length>150?'':'none';
    toggle.textContent='Show more ▾';
    $("watch-desc").style.webkitLineClamp='3';
    $("watch-desc").style.overflow='hidden';
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
    title : v.title,
    desc  : v.description && v.description.trim().length>20
      ? v.description
      : `Watch "${v.title}"${v.episodeNum?' Episode '+v.episodeNum:''} online free on រោងកុនគ្មានមនុស្ស. Stream ${v.category||'drama'} videos for free — no subscription needed.`,
    image : getThumb(v),
    url   : location.href,
    type  : 'video.other'
  });

  updateDoc(doc(db,"videos",id),{views:increment(1)}).catch(()=>{});
  const lv=videos.find(x=>x.id===id);if(lv)lv.views=(lv.views||0)+1;

  // Update episode active state immediately (fast visual feedback)
  document.querySelectorAll('.pl-item').forEach(el=>{
    const isActive = (el.getAttribute('onclick')||'').includes("'"+id+"'");
    el.classList.toggle('current', isActive);
    el.classList.toggle('watched', !isActive && el.classList.contains('watched'));
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
        onclick="event.preventDefault();openVideo('${pv.id}')">
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
    $("playlist-panel").style.display="";
    // Scroll active episode into view
    setTimeout(()=>{
      const active=document.querySelector('.pl-item.current');
      if(active) active.scrollIntoView({behavior:'smooth',block:'nearest'});
    },200);
    // Show playlist chip on mobile
    const chipPl=$("chip-playlist");
    if(chipPl){ chipPl.style.display=''; chipPl.textContent=`📋 ${pl.name}`; }
    if(playlistQueue[plQueueIdx+1]){
      $("watch-next-btn").style.display="";
    }
  }

  // Smarter related videos — same category first, then others
  const sameCat=videos.filter(x=>x.id!==id&&x.category===v.category);
  const others=videos.filter(x=>x.id!==id&&x.category!==v.category);
  const related=[...sameCat,...others].slice(0,10);
  const watched=getHistory();
  const suggHtml=buildSuggWithAds(related,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6);
  $("suggested-list").innerHTML=suggHtml;
  if($("suggested-list-mobile")) $("suggested-list-mobile").innerHTML=suggHtml;

  // Load likes/dislikes + comments for this video
  loadReactions(id);
  loadComments(id);
  NP.done();
  // Setup mini player observer
};

window.openPlaylist=(plId,startId)=>{
  const pl=playlists.find(p=>p.id===plId);
  if(!pl||!(pl.videos||[]).length){openVideo(startId);return;}
  const i=pl.videos.indexOf(startId);
  openVideo(pl.videos[i>=0?i:0]);
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
      openVideo(next.id);
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
  if(n) openVideo(n.id);
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
  openVideo(pl.videos[0]);
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

  // Render grid
  if(cat.target_type==="playlist"){
    const cards=ids.map(pid=>playlists.find(p=>p.id===pid)).filter(Boolean)
      .map(pl=>buildPlaylistCard(pl)).join("");
    $("cat-grid").innerHTML=cards||`<div style="padding:2rem;color:#555;text-align:center">No playlists found.</div>`;
  } else {
    renderGrid($("cat-grid"),catVideos);
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

  // For Telegram/Facebook: use the OG API URL so bots get the correct thumbnail
  // Extract video ID from current URL /watch/VIDEO_ID or /watch/PLAYLIST/EP
  const watchMatch = location.pathname.match(/^\/watch\/([^/]+)/);
  const videoId    = watchMatch ? watchMatch[1] : null;
  const shareUrl   = videoId
    ? `https://www.rongkunkmeanmnus.com/api/og?id=${videoId}`
    : pageUrl;

  if(type==="copy"){
    // Copy the real watch URL (not the API URL)
    navigator.clipboard.writeText(pageUrl).then(()=>showToast("Link copied!","ok"));
  } else if(type==="telegram"){
    window.open(`https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(title)}`,'_blank');
  } else if(type==="facebook"){
    window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`,'_blank');
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
    $('like-count').textContent=data.likes||0;
    $('dislike-count').textContent=data.dislikes||0;
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
      $('like-count').textContent=Math.max(0,data.likes||0);
      $('dislike-count').textContent=Math.max(0,data.dislikes||0);
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

window.closeMiniPlayer = () => {
  // Stop player
  $('player-iframe').src = '';
};


// ── KEYBOARD SHORTCUTS ──
document.addEventListener('keydown',e=>{
  // Don't fire if typing in an input
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  const watchActive=document.getElementById('page-watch')?.classList.contains('active');
  if(!watchActive) return;
  if(e.key==='ArrowRight'||e.key==='n'){
    const next=playlistQueue[plQueueIdx+1];
    if(next){ clearCountdown(); openVideo(next.id); showToast('Next episode','info'); }
  }
  if(e.key==='ArrowLeft'||e.key==='p'){
    const prev=playlistQueue[plQueueIdx-1];
    if(prev){ clearCountdown(); openVideo(prev.id); showToast('Previous episode','info'); }
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

loadAll();
