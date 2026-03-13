// ═══════════════════════════════════════════════════
//  watch.js — Video player, playlist queue, suggested, reactions
// ═══════════════════════════════════════════════════

// ── Open Video ──
window.openVideo=async (id,push=true)=>{
  NP.start();
  if(push) previousPage=location.pathname;
  document.querySelectorAll('.page').forEach(p=>p.classList.toggle('active',p.id==='page-watch'));
  window.scrollTo(0,0);
  playlistQueue=[];plQueueIdx=0;
  $("player-iframe").src="";
  $("playlist-panel").style.display="none";
  $("suggested-list").style.display="";
  $("watch-next-btn").style.display="none";
  clearCountdown();
  document.querySelectorAll('.watch-filter-chip').forEach(c=>c.classList.remove('active'));
  document.querySelector('.watch-filter-chip')?.classList.add('active');
  const chipPl=$("chip-playlist");
  if(chipPl)chipPl.style.display='none';
  $("suggested-list").innerHTML=skelRow(3);

  const v=videos.find(x=>x.id===id);if(!v)return;

  if(push){
    const pl2=playlists.find(p=>(p.videos||[]).includes(id));
    if(pl2){
      const epNum=(pl2.videos||[]).indexOf(id)+1;
      history.pushState({page:'watch',videoId:id},"",`/watch/${playlistSlug(pl2)}/ep-${epNum}`);
    } else {
      history.pushState({page:'watch',videoId:id},"",`/watch/${videoSlug(v)}`);
    }
  }

  const loadVideo=()=>{
    $("player-iframe").src=getEmbedUrl(v);
    if(window.scheduleMidrolls) scheduleMidrolls(v.duration||'');
  };
  if(window.showPreroll) showPreroll(loadVideo);
  else loadVideo();

  $("watch-title").textContent=v.title||"";
  $("watch-source").textContent=v.platform||v.source||"";
  $("watch-cat").textContent=v.category||"";
  $("watch-views").textContent=fmtViews((v.views||0)+1);
  $("watch-date").textContent=v.createdAt?.toDate?v.createdAt.toDate().toLocaleDateString():"—";

  const descText=v.description||`${v.category||""} content from ${v.platform||v.source||""}.`;
  $("watch-desc").textContent=descText;
  const toggle=$("watch-desc-toggle");
  if(toggle){
    toggle.style.display=descText.length>120?'':'none';
    toggle.textContent='Show more ▾';
    $("watch-desc").style.webkitLineClamp='3';
    $("watch-desc").style.overflow='hidden';
  }

  const tagsEl=$("watch-tags");
  if(tagsEl){
    const tags=[v.category,v.platform||v.source].filter(Boolean);
    tagsEl.innerHTML=tags.map(t=>`<span class="watch-tag" onclick="doSearch('${t}')">${t}</span>`).join('');
  }

  addToHistory(id);
  updateMeta({
    title : v.title,
    desc  : v.description || `មើល ${v.title} នៅលើ ${window.siteName||'RongKunKmeanMnus'}។ Watch ${v.title} on ${window.siteName||'RongKunKmeanMnus'}.`,
    image : getThumb(v),
    url   : location.href,
    type  : 'video.other'
  });

  // View count
  if(window._core?.db){
    const {db}=window._core;
    const {updateDoc,doc,increment,getDoc}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    updateDoc(doc(db,"videos",id),{views:increment(1)}).catch(()=>{});
    const lv=videos.find(x=>x.id===id);if(lv)lv.views=(lv.views||0)+1;
  }

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
    const chipPl2=$("chip-playlist");
    if(chipPl2){ chipPl2.style.display=''; chipPl2.textContent=`📋 ${pl.name}`; }
    if(playlistQueue[plQueueIdx+1]) $("watch-next-btn").style.display="";
  }

  // Suggested
  const sameCat=videos.filter(x=>x.id!==id&&x.category===v.category);
  const others=videos.filter(x=>x.id!==id&&x.category!==v.category);
  const related=[...sameCat,...others].slice(0,10);
  $("suggested-list").innerHTML=buildSuggWithAds(related,(window.AD_CONFIG&&window.AD_CONFIG.feedEvery)||6);

  loadReactions(id);
  loadComments(id);
  NP.done();
};

window.openPlaylist=(plId,startId)=>{
  const pl=playlists.find(p=>p.id===plId);
  if(!pl||!(pl.videos||[]).length){openVideo(startId);return;}
  const i=pl.videos.indexOf(startId);
  openVideo(pl.videos[i>=0?i:0]);
};
window.openPlaylistById=id=>{ const pl=playlists.find(p=>p.id===id); if(!pl||(pl.videos||[]).length===0) return; openVideo(pl.videos[0]); };

// ── Countdown ──
let _countdownTimer=null;
const COUNTDOWN_SEC=5;
const ARC_LEN=94.2;
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
    if(remaining<=0){ clearCountdown(); openVideo(next.id); return; }
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
window.playNext=()=>{ clearCountdown(); const n=playlistQueue[plQueueIdx+1]; if(n) openVideo(n.id); };

// ── Filter chips ──
window.setWatchFilter=(type,btn)=>{
  document.querySelectorAll('.watch-filter-chip').forEach(c=>c.classList.remove('active'));
  btn?.classList.add('active');
  if(type==='playlist'){ $('playlist-panel').style.display=''; $('suggested-list').style.display='none'; }
  else { $('playlist-panel').style.display='none'; $('suggested-list').style.display=''; }
};

// ── Reactions ──
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
    const {getDoc,doc}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snap=await getDoc(doc(window._core.db,'videos',vid));
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
  const updates={};
  if(prev==='like')    updates.likes=-1;
  if(prev==='dislike') updates.dislikes=-1;
  if(newReact==='like')    updates.likes=(updates.likes||0)+1;
  if(newReact==='dislike') updates.dislikes=(updates.dislikes||0)+1;
  if(Object.keys(updates).length){
    try{
      const {updateDoc,doc,increment,getDoc}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
      const firestoreUpdates={};
      if(updates.likes)    firestoreUpdates.likes=increment(updates.likes);
      if(updates.dislikes) firestoreUpdates.dislikes=increment(updates.dislikes);
      await updateDoc(doc(window._core.db,'videos',vid),firestoreUpdates);
      const snap=await getDoc(doc(window._core.db,'videos',vid));
      const data=snap.data()||{};
      $('like-count').textContent=Math.max(0,data.likes||0);
      $('dislike-count').textContent=Math.max(0,data.dislikes||0);
    }catch(e){}
  }
};

// ── Share ──
window.toggleSharePanel=(e)=>{ e.stopPropagation(); $("share-panel")?.classList.toggle("open"); };
document.addEventListener("click",()=>$("share-panel")?.classList.remove("open"));
window.shareAction=(type)=>{
  const url=location.href;
  const title=document.title;
  $("share-panel")?.classList.remove("open");
  if(type==="copy"){ navigator.clipboard.writeText(url).then(()=>showToast("Link copied!","ok")); }
  else if(type==="telegram"){ window.open(`https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,'_blank'); }
  else if(type==="facebook"){ window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,'_blank'); }
};
window.copyLink=()=>shareAction('copy');

// ── Mini Player ──
window.closeMiniPlayer=()=>{ deactivateMiniPlayer?.(); $('player-iframe').src=''; };
