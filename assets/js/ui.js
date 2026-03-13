// ═══════════════════════════════════════════════════
//  ui.js — Cards, Hero, Sections, Nav, Category, Infinite Scroll
// ═══════════════════════════════════════════════════

// ── Nav ──
function buildNav(activeId){
  const sorted=[...categories].sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  const cats=sorted.slice(0,8);
  function slug(c){ return '/'+c.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); }
  const curSlug=location.pathname;
  const resolvedActive=activeId||(curSlug==='/'?'home':cats.find(c=>slug(c)===curSlug)?.id||'');
  $("nav-cats").innerHTML=
    `<a href="/" onclick="goHome(event)" ${resolvedActive==='home'?'class="active"':''}>Home</a>`
    +cats.map(c=>`<a href="${slug(c)}" data-catid="${c.id}" onclick="event.preventDefault();navGo('${c.id}')" ${resolvedActive===c.id?'class="active"':''}>${c.name}</a>`).join("");
  $("mobile-cats").innerHTML=cats.map(c=>`<a href="${slug(c)}" data-catid="${c.id}" onclick="event.preventDefault();toggleMobileMenu();navGo('${c.id}')">${c.name}</a>`).join("");
  $("footer-links").innerHTML=
    `<a href="/" onclick="goHome(event)" ${resolvedActive==='home'?'class="active"':''}>Home</a>`
    +`<a href="/about">About</a>`
    +`<a href="/privacy">Privacy</a>`
    +`<a href="/terms">Terms</a>`
    +`<a href="/contact">Contact</a>`;
}
function setNavActive(matchId){
  document.querySelectorAll('#nav-cats a').forEach(a=>{
    if(matchId==='home'){ a.classList.toggle('active', !a.dataset.catid); }
    else { a.classList.toggle('active', a.dataset.catid===matchId); }
  });
}
window.navGo=(id)=>{
  const c=categories.find(x=>x.id===id); if(!c)return;
  NP.start();
  const ids=c.target_ids||(c.target_id?[c.target_id]:[]);
  const slug='/'+c.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'');
  history.pushState({page:'cat',catId:id},"",slug);
  buildNav(id);
  if(c.target_type==='playlist'&&ids.length){ openCategoryById(id); }
  else if(c.target_type==='video'&&ids.length){ openCategoryById(id); }
  else { openCategory(id, c.name, false); }
  NP.done();
};

// ── Cards ──
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
      ${v.duration?`<div class="vcard-duration">${v.duration}`+ `</div>`:""}
      ${pl?`<div class="vcard-series">Series</div>`:""}
      ${v.episodeNum?`<div class="ep-badge">${v.episodeNum}</div>`:""}
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

// ── Ad Cards ──
function buildAdCard(){
  const cfg = window.AD_CONFIG||{};
  if(!cfg.enabled || !cfg.feedAds) return '';
  const img = cfg.feedImageUrl||cfg.imageUrl||'';
  const url = cfg.feedAdUrl||'#';
  const target = url==='#'?'':'target="_blank" rel="noopener"';
  return`<a class="vcard vcard-ad" href="${url}" ${target}>
    <div class="vcard-thumb">
      ${img?`<img src="${img}" alt="Advertisement" loading="lazy" onerror="this.parentElement.style.background='#1a1a1a'">`:
        `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
        </div>`}
      <div class="vcard-ad-badge">Ad</div>
    </div>
    <div class="vcard-title" style="color:#888;">Advertisement</div>
    <div class="vcard-sub">Sponsored</div>
  </a>`;
}
function buildSuggAdCard(){
  const cfg = window.AD_CONFIG||{};
  if(!cfg.enabled || !cfg.feedAds) return '';
  const img = cfg.feedImageUrl||cfg.imageUrl||'';
  const url = cfg.feedAdUrl||'#';
  const target = url==='#'?'':'target="_blank" rel="noopener"';
  return`<a class="sugg-item sugg-ad" href="${url}" ${target}>
    <div class="sugg-thumb" style="position:relative;">
      ${img?`<img src="${img}" alt="Ad" loading="lazy">`:
        `<div style="width:100%;height:100%;background:#111;display:flex;align-items:center;justify-content:center;">
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
function injectAdCards(list, every=6){ const result=[]; list.forEach((item,i)=>{ result.push(item); if((i+1)%every===0) result.push('__AD__'); }); return result; }
function buildFeedWithAds(list, every=6){ const injected=injectAdCards(list,every); return injected.map(item=>item==='__AD__'?buildAdCard():buildCard(item)).join(''); }
function buildSuggWithAds(list, every=6){
  const injected=injectAdCards(list,every);
  return injected.map(item=>{
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
  $("hero-title").textContent=v.title?.length>72?v.title.slice(0,72)+"…":v.title||"";
  const desc=v.description||(v.category?`A ${v.category} video from ${v.platform||'our collection'}.`:"");
  $("hero-desc").textContent=desc;
  $("hero-desc").style.display=desc?"":"none";
  $("hero-cat").textContent=v.category||"";
  $("hero-cat").style.display=v.category?"":"none";
  const vw=v.views||0;
  $("hero-views").textContent=vw>0?fmtViews(vw)+" views":"";
  $("hero-views").style.display=vw>0?"":"none";
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
  if(pl) openPlaylist(pl.id,v.id); else openVideo(v.id);
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
  let thumbHtml='';
  if(thumbVids.length>=4){
    thumbHtml=`<div class="pl-multithumb-grid">${thumbVids.map(v=>`<img src="${getThumb(v)}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${v.id}/320/180'">`).join('')}</div>`;
  } else {
    const img=pl.thumbnail||(thumbVids[0]?getThumb(thumbVids[0]):`https://picsum.photos/seed/${pl.id}/800/450`);
    thumbHtml=`<div class="pl-multithumb-single"><img src="${img}" loading="lazy" onerror="this.src='https://picsum.photos/seed/${pl.id}/800/450'"></div>`;
  }
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
  if(sec.target_type==="playlist"&&sec.target_id){
    const pl=playlists.find(p=>p.id===sec.target_id);
    el.innerHTML=pl?buildPlaylistCard(pl):`<div style="padding:1rem;color:#555;font-size:.82rem">Playlist not found.</div>`;
    return;
  }
  if(sec.target_type==="multi_playlist"&&(sec.playlist_ids||[]).length){
    const cards=(sec.playlist_ids||[]).map(id=>playlists.find(p=>p.id===id)).filter(Boolean).map(pl=>buildPlaylistCard(pl)).join("");
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

// ── Infinite Scroll ──
let _recPool=[], _recShown=0, _recLoading=false, _recDone=false;
const REC_BATCH=12;
function initRecommended(){
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
function setupRecObserver(){
  const loader=$('recommended-loader');
  if(!loader) return;
  const obs=new IntersectionObserver(entries=>{ if(entries[0].isIntersecting && !_recDone) loadMoreRecommended(); },{rootMargin:'200px'});
  obs.observe(loader);
}

window.seeAll=sid=>{
  NP.start();
  const sec=sections.find(s=>s.id===sid);
  if(!sec){ showPage("cat"); return; }
  if(sec.target_type==="category"&&sec.target_id){ const cat=categories.find(c=>c.id===sec.target_id); if(cat){ navGo(cat.id); return; } }
  const slug='/'+toSlug(sec.title||'all');
  history.pushState({page:'cat',secId:sid},"",slug);
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-cat"));
  window.scrollTo(0,0);
  $("cat-title").textContent=sec.title||"All Videos";
  const seeAllCount=(sec.video_ids||[]).length||0;
  $("cat-desc").textContent=`${seeAllCount} video${seeAllCount!==1?'s':''} · Browse all ${sec.title||""} content`;
  const saBg=$("cat-banner-bg");
  const saFirst=(sec.video_ids||[]).map(id=>videos.find(v=>v.id===id)).filter(Boolean)[0];
  if(saBg) saBg.style.backgroundImage=saFirst?`url('${getThumb(saFirst)}')`:'none';
  updateMeta({title:sec.title, desc:`Browse all ${sec.title} content`, url:location.href});
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

// ── Category Page ──
function showCatPage(cat){
  NP.start();
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("active",p.id==="page-cat"));
  window.scrollTo(0,0);
  $("cat-title").textContent=cat.name;
  updateMeta({ title:cat.name, desc:`Discover the best ${cat.name} content`, url:location.href });
  const ids=cat.target_ids||(cat.target_id?[cat.target_id]:[]);
  let catVideos=[];
  if(cat.target_type==="playlist"){ const pls=ids.map(pid=>playlists.find(p=>p.id===pid)).filter(Boolean); catVideos=pls.flatMap(pl=>(pl.videos||[]).map(vid=>videos.find(v=>v.id===vid)).filter(Boolean)); }
  else if(cat.target_type==="video"){ catVideos=ids.map(vid=>videos.find(v=>v.id===vid)).filter(Boolean); }
  else { catVideos=videos.filter(v=>v.category===cat.name); }
  const bannerBg=$("cat-banner-bg");
  const firstThumb=catVideos.length?getThumb(catVideos[0]):'';
  if(bannerBg) bannerBg.style.backgroundImage=firstThumb?`url('${firstThumb}')`:'none';
  const count=catVideos.length;
  $("cat-desc").textContent=`${count} video${count!==1?'s':''} · ${cat.description||'Browse and enjoy'}`;
  if(cat.target_type==="playlist"){
    const cards=ids.map(pid=>playlists.find(p=>p.id===pid)).filter(Boolean).map(pl=>buildPlaylistCard(pl)).join("");
    $("cat-grid").innerHTML=cards||`<div style="padding:2rem;color:#555;text-align:center">No playlists found.</div>`;
  } else { renderGrid($("cat-grid"),catVideos); }
  NP.done();
}
window.openCategoryById=(id)=>{ const cat=categories.find(c=>c.id===id); if(!cat)return; showCatPage(cat); };
window.openCategory=(id,name,push=true)=>{
  const decodedName=decodeURIComponent(name||id);
  const cat=categories.find(c=>c.id===id||c.name===decodedName)||{id,name:decodedName,target_type:'category'};
  if(push){ const slug='/'+cat.name.toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,''); history.pushState({page:'cat',catId:id},"",slug); }
  showCatPage(cat);
};
