// ═══════════════════════════════════════════════════
//  core.js — Firebase, state, helpers, routing, toast
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

// ── Watch History ──
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
function videoSlug(v){ const s=toSlug(v.title||''); return s.length>=3 ? s : v.id; }
function playlistSlug(pl){ const s=toSlug(pl.name||''); return s.length>=3 ? s : pl.id; }
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
const getThumb=v=>v.customThumb||v.thumbnail||
  ((v.platform||v.source||"")==="dailymotion"
    ?`https://www.dailymotion.com/thumbnail/video/${(v.videoId||v.url||"").replace(/.*\//,"")}`
    :`https://picsum.photos/seed/${v.id}/800/450`);
const getEmbedUrl=v=>{
  const src=v.platform||v.source||"";
  const id=(v.videoId||(v.url||"").split("/").pop()||"");
  if(src==="dailymotion")return`https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  if(src==="rumble")return`https://rumble.com/embed/${id}/?pub=4`;
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

// ── Progress Bar ──
const NP = {
  _timer: null, _val: 0, _fake: null,
  bar: null, spin: null,
  init(){ this.bar=document.getElementById('nprogress-bar'); this.spin=document.getElementById('nprogress-spinner'); },
  set(n){ if(!this.bar)this.init(); this._val=Math.min(n,0.994); this.bar.style.width=(this._val*100)+'%'; this.bar.classList.add('running'); this.spin.classList.add('running'); },
  start(){ if(!this.bar)this.init(); clearInterval(this._fake); this.set(0.08); this._fake=setInterval(()=>{ const gap=1-this._val; const inc=gap>.5?.1:gap>.2?.04:gap>.05?.01:0.005; this.set(this._val+inc); },300); },
  done(){ if(!this.bar)this.init(); clearInterval(this._fake); this.set(1); setTimeout(()=>{ this.bar.style.opacity='0'; this.spin.classList.remove('running'); setTimeout(()=>{ this.bar.style.width='0%'; this.bar.classList.remove('running'); this.bar.style.opacity=''; this._val=0; },400); },200); }
};

// ── Scroll ──
window.addEventListener("scroll",()=>{
  const sy=window.scrollY;
  $("nav-inner").classList.toggle("solid",sy>70);
  $("scroll-top")?.classList.toggle("visible",sy>400);
  lastScrollY=sy;
});

// ── Mobile Menu + Search ──
window.toggleMobileMenu=()=>{
  mobileMenuOpen=!mobileMenuOpen;
  $("mobile-menu").classList.toggle("open",mobileMenuOpen);
};
window.doSearch=(q2)=>{
  const q=(q2||$("search-input").value||$("mobile-search-input")?.value||"").trim();
  if(!q)return;
  NP.start();
  if(mobileMenuOpen){ mobileMenuOpen=false; $("mobile-menu").classList.remove("open"); }
  history.pushState({page:'search',q},"",`/search?q=${encodeURIComponent(q)}`);
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-search"));
  window.scrollTo(0,0);
  updateMeta({title:`Search: ${q}`, desc:`Search results for "${q}"`});
  const results=videos.filter(v=>matchSearch(v,q));
  $("search-info").textContent=`${results.length} results for "${q}"`;
  renderGrid($("search-grid"),results);
  NP.done();
};
window.openDesktopSearch=()=>{
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
window.closeDesktopSearch=()=>{ const o=$('desktop-search-overlay'); if(o) o.style.display='none'; };
function matchSearch(v,q){ const lq=q.toLowerCase(); return (v.title||'').toLowerCase().includes(lq)||(v.category||'').toLowerCase().includes(lq)||(v.description||'').toLowerCase().includes(lq); }

// ── Pages ──
function showPage(id,push=true){
  if(id!=="watch") previousPage=id;
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id===`page-${id}`));
  if(push)history.pushState({page:id},"",id==="home"?"/" :"/"+id);
  window.scrollTo(0,0);
  document.querySelectorAll('#bottom-nav a').forEach(a=>a.classList.remove('active'));
  const bnMap={home:'bn-home',search:'bn-search',history:'bn-history'};
  if(bnMap[id]) $(bnMap[id])?.classList.add('active');
  if(id==='home') updateMeta({title:null, desc:'មើលវីដេអូកម្សាន្ត រឿងភាគ និងភាពយន្តល្អៗ។ Watch Khmer drama and entertainment videos online.', url:'https://rongkunkmeanmnus.vercel.app'});
}
window.goHome=e=>{
  e?.preventDefault();
  showPage("home");
  buildNav('home');
  document.querySelectorAll('#footer-links a').forEach(a=>{ a.classList.toggle('active', a.getAttribute('href')==='/'); });
  silentRefresh();
};
async function silentRefresh(){
  try{
    const[vidSnap,secSnap]=await Promise.all([
      getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
      getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
    ]);
    const newVideos=vidSnap.docs.map(d=>({id:d.id,...d.data()}));
    const newSections=secSnap.docs.map(d=>({id:d.id,...d.data()})).sort((a,b)=>(a.display_order||0)-(b.display_order||0));
    const changed=JSON.stringify(newVideos.map(v=>v.id))!==JSON.stringify(videos.map(v=>v.id))||newSections.length!==sections.length;
    if(changed){ videos=newVideos; sections=newSections; buildHero(); buildSections(); initRecommended(); }
  }catch(e){}
}
window.goBack=()=>{ if(previousPage&&previousPage!==location.pathname){ history.back(); } else { showPage('home'); } };

function routeFromUrl(push=false){
  const path=location.pathname;
  if(path==="/"||path===""){ showPage("home",false); return; }
  if(path.startsWith("/watch/")){
    const parts=path.slice(7).split("/");
    if(parts.length>=2){
      const plSlug=parts[0];
      const epNum=parseInt((parts[1]||'').replace('ep-',''))||1;
      const pl=playlists.find(p=>playlistSlug(p)===plSlug||toSlug(p.name)===plSlug);
      if(pl&&(pl.videos||[]).length){
        const vid=videos.find(v=>v.id===pl.videos[epNum-1])||videos.find(v=>v.id===pl.videos[0]);
        if(vid){ openVideo(vid.id,false); return; }
      }
    }
    if(parts.length===1){
      const vSlug=parts[0];
      const vid=videos.find(v=>videoSlug(v)===vSlug||toSlug(v.title)===vSlug||v.id===vSlug);
      if(vid){ openVideo(vid.id,false); return; }
    }
    showPage("home",false); return;
  }
  const slug=path.replace(/^\//, '');
  const cat=categories.find(c=>toSlug(c.name)===slug);
  if(cat){ showCatPage(cat); return; }
  if(path==='/search'){
    const q=new URLSearchParams(location.search).get('q')||'';
    if(q) doSearch(q); else showPage('home',false);
    return;
  }
  showPage("home",false);
}

window.addEventListener("popstate",e=>{
  if(!e.state) return routeFromUrl(false);
  if(e.state.page==="watch"&&e.state.videoId){ openVideo(e.state.videoId,false); }
  else if(e.state.page==="cat"){ const cat=categories.find(c=>c.id===e.state.catId); if(cat) showCatPage(cat); else routeFromUrl(false); }
  else if(e.state.page==='search'&&e.state.q){ doSearch(e.state.q); }
  else if(e.state.page==='history'){ showHistoryPage(); }
  else if(e.state.page){ showPage(e.state.page,false); }
});

// ── Load All ──
async function loadAll(){
  try{
    if(window.loadAdsConfig) await window.loadAdsConfig();
    const[catSnap,plSnap,vidSnap,secSnap]=await Promise.all([
      getDocs(collection(db,"categories")),
      getDocs(collection(db,"playlists")),
      getDocs(query(collection(db,"videos"),orderBy("createdAt","desc"))),
      getDocs(collection(db,"home_sections")).catch(()=>({docs:[]}))
    ]);
    categories=catSnap.docs.map(d=>({id:d.id,...d.data()}));
    playlists=plSnap.docs.map(d=>({id:d.id,...d.data()}));
    videos=vidSnap.docs.map(d=>({id:d.id,...d.data()}));
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
    const loader=$('page-loader');
    if(loader){ loader.classList.add('hidden'); setTimeout(()=>loader.remove(),500); }
    setupLazyLoad();
    startVideoListener();
  }catch(err){
    console.error(err);
    showToast("Failed to load data","err");
    const loader=$('page-loader');
    if(loader){ loader.classList.add('hidden'); setTimeout(()=>loader.remove(),500); }
  }
}

function startVideoListener(){
  onSnapshot(query(collection(db,"videos"),orderBy("createdAt","desc")), snap=>{
    const updated = snap.docs.map(d=>({id:d.id,...d.data()}));
    let changed = false;
    updated.forEach(uv=>{
      const old = videos.find(v=>v.id===uv.id);
      if(old && old.episodeNum !== uv.episodeNum){ changed=true; Object.assign(old,{episodeNum:uv.episodeNum}); }
      if(!old){ changed=true; videos.unshift(uv); }
    });
    if(changed){
      document.querySelectorAll('.vid-grid').forEach(grid=>{
        const ids = [...grid.querySelectorAll('.vcard')].map(c=>c.dataset.id).filter(Boolean);
        if(!ids.length) return;
        grid.innerHTML = videos.filter(v=>ids.includes(v.id)).map(v=>buildCard(v)).join('');
      });
    }
  });
}

function setupLazyLoad(){
  if(!('IntersectionObserver' in window)) return;
  const io=new IntersectionObserver((entries)=>{
    entries.forEach(e=>{ if(e.isIntersecting){ const img=e.target; if(img.dataset.src){ img.src=img.dataset.src; img.removeAttribute('data-src'); io.unobserve(img); } } });
  },{rootMargin:'200px'});
  document.querySelectorAll('img[data-src]').forEach(img=>io.observe(img));
}

// ── Keyboard Shortcuts ──
document.addEventListener('keydown',e=>{
  if(['INPUT','TEXTAREA','SELECT'].includes(e.target.tagName)) return;
  const watchActive=document.getElementById('page-watch')?.classList.contains('active');
  if(!watchActive) return;
  if(e.key==='ArrowRight'||e.key==='n'){ const next=playlistQueue[plQueueIdx+1]; if(next){ clearCountdown(); openVideo(next.id); showToast('Next episode','info'); } }
  if(e.key==='ArrowLeft'||e.key==='p'){ const prev=playlistQueue[plQueueIdx-1]; if(prev){ clearCountdown(); openVideo(prev.id); showToast('Previous episode','info'); } }
  if(e.key==='Escape') goBack();
});

// ── Export to window (for cross-file access) ──
window._core={db,videos,playlists,categories,sections,getHistory,addToHistory,fmtViews,timeAgo,getThumb,getEmbedUrl,toSlug,videoSlug,playlistSlug,ICONS,$,NP,showPage,siteName,matchSearch,silentRefresh};

loadAll();
