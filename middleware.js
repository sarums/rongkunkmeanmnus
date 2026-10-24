const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

// STRICT bot detection - only known crawlers
const BOT = /facebookexternalhit|facebot|meta-externalagent|meta-externalfetcher|twitterbot|telegrambot|whatsapp|linkedinbot|discordbot|slackbot|skypeuripreview|viber|pinterest|redditbot|embedly|zalo|kakaotalk|line-poker|snapchat|googlebot|mediapartners-google|adsbot-google|google-inspectiontool|bingbot|yandex|applebot|duckduck/i;

function isBot(ua){ return BOT.test(ua||''); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

// List a whole Firestore collection (REST returns at most 300 per page).
async function getAll(col){
  let out=[],token='';
  for(let i=0;i<10;i++){
    const r=await get(`${FIRESTORE}/${col}?pageSize=300${token?`&pageToken=${encodeURIComponent(token)}`:''}`);
    if(!r) throw new Error('Firestore unavailable: '+col);
    out=out.concat(r.documents||[]);
    if(!r.nextPageToken) break; token=r.nextPageToken;
  }
  return out;
}
async function get(url){
  try{
    const r = await fetch(url, {signal: AbortSignal.timeout(4000)});
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}

// ── Thumbnail resolver (shared logic, inlined per edge file) ──
function fixImg(u){
  u=(u||'').trim(); if(!u) return '';
  if(u.startsWith('//')) u='https:'+u;
  u=u.replace(/^http:\/\//i,'https://');
  // Google Drive links are often blocked for crawlers; use the public image host instead.
  const m=u.match(/drive\.google\.com\/(?:uc\?(?:export=\w+&)?id=|file\/d\/|open\?id=)([\w-]+)/i)||u.match(/[?&]id=([\w-]{20,})/);
  if(/drive\.google\.com/i.test(u)&&m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1280`;
  return u;
}
function cleanId(raw){
  raw=String(raw||'').trim(); if(!raw) return '';
  const dm=raw.match(/(?:dai\.ly\/|dailymotion\.com\/(?:video\/|embed\/video\/))([a-zA-Z0-9]+)/i);
  if(dm) return dm[1];
  return raw.split(/[/?#]/).filter(Boolean).pop()||'';
}
async function resolveThumb(f){
  const g=k=>f[k]?.stringValue||'';
  const p=(g('platform')||g('source')).toLowerCase();
  const custom=g('customThumb')||g('thumbnail');
  if(custom) return fixImg(custom);
  const id=cleanId(g('videoId')||g('url'));
  if(!id) return IMG;
  if(p==='dailymotion') return `https://www.dailymotion.com/thumbnail/video/${id}`;
  if(p==='youtube')     return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  if(p==='vimeo')       return `https://vumbnail.com/${id}.jpg`;
  if(p==='rumble'){
    try{
      const r=await fetch(`https://rumble.com/api/Media/oembed.json?url=${encodeURIComponent('https://rumble.com/embed/'+id+'/')}`,{signal:AbortSignal.timeout(3500)});
      if(r.ok){const j=await r.json(); if(j&&j.thumbnail_url) return fixImg(j.thumbnail_url);}
    }catch(e){}
  }
  return IMG;
}

function ogHtml(title, desc, img, url, type='video.other'){
  const t=esc(title||SITE_NAME), d=esc((desc||'').replace(/<[^>]*>/g,'').slice(0,200)||'Watch free drama online.');
  return `<!DOCTYPE html><html lang="km"><head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img||IMG}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img||IMG}">
<link rel="canonical" href="${url}">
</head><body>
<h1>${t}</h1><p>${d}</p>
<img src="${img||IMG}" alt="${t}" width="800">
<p>Watch on <a href="${SITE_URL}">${SITE_NAME}</a></p>
</body></html>`;
}


// ── Home page for crawlers (Googlebot, AdSense/Mediapartners, social bots) ──
// The normal site is a JavaScript app that shows "Loading..." until Firebase answers.
// Crawlers get the same information as plain HTML so they never see an empty page.
function fsTime(f){ const t=f.createdAt?.timestampValue; return t?Date.parse(t)||0:0; }
function thumbSync(f){
  const g=k=>f[k]?.stringValue||'';
  const custom=g('customThumb')||g('thumbnail'); if(custom) return fixImg(custom);
  const p=(g('platform')||g('source')).toLowerCase(), id=cleanId(g('videoId')||g('url'));
  if(p==='dailymotion'&&id) return `https://www.dailymotion.com/thumbnail/video/${id}`;
  if(p==='youtube'&&id)     return `https://img.youtube.com/vi/${id}/hqdefault.jpg`;
  if(p==='vimeo'&&id)       return `https://vumbnail.com/${id}.jpg`;
  return IMG;
}
async function homeHtml(){
  const [vDocs,pDocs,bDocs]=await Promise.all([getAll('videos'),getAll('playlists'),getAll('blog_posts')]);
  const videos=vDocs.map(d=>({id:d.name.split('/').pop(),f:d.fields||{}}))
    .filter(v=>(v.f.status?.stringValue||'public')!=='draft')
    .sort((a,b)=>fsTime(b.f)-fsTime(a.f));
  const playlists=pDocs.map(d=>({id:d.name.split('/').pop(),f:d.fields||{}}));
  const posts=bDocs.map(d=>({id:d.name.split('/').pop(),f:d.fields||{}}))
    .filter(b=>b.f.status?.stringValue==='published')
    .sort((a,b)=>fsTime(b.f)-fsTime(a.f)).slice(0,12);
  const plOf={};
  playlists.forEach(pl=>(pl.f.videos?.arrayValue?.values||[]).forEach((v,i)=>{plOf[v.stringValue]={id:pl.id,ep:i+1};}));
  const link=v=>{const m=plOf[v.id];return SITE_URL+(m?`/watch/${m.id}/ep-${m.ep}`:`/watch/${v.id}`);};
  const title=v=>v.f.title?.stringValue||'Video';

  const latest=videos.slice(0,40).map(v=>`<li><a href="${link(v)}"><img src="${esc(thumbSync(v.f))}" alt="${esc(title(v))}" width="320" height="180" loading="lazy"><h3>${esc(title(v))}</h3></a>${v.f.description?.stringValue?`<p>${esc(v.f.description.stringValue.replace(/<[^>]*>/g,'').slice(0,160))}</p>`:''}</li>`).join('\n');
  const series=playlists.filter(pl=>(pl.f.videos?.arrayValue?.values||[]).length).slice(0,60).map(pl=>{
    const n=(pl.f.videos.arrayValue.values||[]).length;
    return `<li><a href="${SITE_URL}/watch/${pl.id}/ep-1">${esc(pl.f.name?.stringValue||'Series')}</a> — ${n} episode${n>1?'s':''}${pl.f.description?.stringValue?`<p>${esc(pl.f.description.stringValue.replace(/<[^>]*>/g,'').slice(0,200))}</p>`:''}</li>`;
  }).join('\n');
  const blog=posts.map(b=>`<li><a href="${SITE_URL}/blog/${esc(b.f.slug?.stringValue||b.id)}">${esc(b.f.title?.stringValue||'Article')}</a>${b.f.excerpt?.stringValue?`<p>${esc(b.f.excerpt.stringValue.replace(/<[^>]*>/g,'').slice(0,160))}</p>`:''}</li>`).join('\n');

  const desc='រោងកុនគ្មានមនុស្ស (RongKunKmeanMnus) — watch Chinese drama and Khmer dubbed series online. Browse the latest episodes, series playlists and drama articles.';
  const schema=JSON.stringify({"@context":"https://schema.org","@type":"WebSite","name":SITE_NAME,"url":SITE_URL,"description":desc});
  return `<!DOCTYPE html><html lang="km"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(SITE_NAME)} - Watch Chinese Drama &amp; Khmer Dubbed Series Online</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index,follow">
<link rel="canonical" href="${SITE_URL}/">
<meta property="og:type" content="website"><meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${esc(SITE_NAME)} - Watch Videos Online">
<meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${SITE_URL}/">
<meta property="og:image" content="${IMG}"><meta name="twitter:card" content="summary_large_image"><meta name="twitter:image" content="${IMG}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8912019493601229" crossorigin="anonymous"></script>
<script type="application/ld+json">${schema}</script>
</head><body>
<header><h1>${esc(SITE_NAME)} — RongKunKmeanMnus</h1>
<p>${esc(desc)}</p>
<nav><a href="${SITE_URL}/">Home</a> | <a href="${SITE_URL}/blog">Blog</a> | <a href="${SITE_URL}/about">About</a> | <a href="${SITE_URL}/contact">Contact</a> | <a href="${SITE_URL}/privacy">Privacy Policy</a> | <a href="${SITE_URL}/terms">Terms</a></nav></header>
<main>
${latest?`<section><h2>Latest videos</h2><ul>${latest}</ul></section>`:''}
${series?`<section><h2>Drama series</h2><ul>${series}</ul></section>`:''}
${blog?`<section><h2>Drama articles</h2><ul>${blog}</ul></section>`:''}
</main>
<footer><p>&copy; ${new Date().getUTCFullYear()} ${esc(SITE_NAME)}. <a href="${SITE_URL}/about">About</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/privacy">Privacy Policy</a> · <a href="${SITE_URL}/terms">Terms of Service</a></p></footer>
</body></html>`;
}

// ── Shared page shell for crawlers ──
function stripHtml(h){ return String(h||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim(); }
function safeHtml(h){
  return String(h||'')
    .replace(/<(script|style|iframe|object|embed|form)[\s\S]*?<\/\1>/gi,'')
    .replace(/<(script|style|iframe|object|embed|form)[^>]*>/gi,'')
    .replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi,'')
    .replace(/(href|src)\s*=\s*("|')\s*javascript:[^"']*\2/gi,'$1="#"');
}
function shell({title,desc,url,img,type='website',body,schema,status=200}){
  const t=esc(title), d=esc((desc||'').slice(0,300));
  const html=`<!DOCTYPE html><html lang="km"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${url}">
<meta property="og:type" content="${type}"><meta property="og:site_name" content="${esc(SITE_NAME)}">
<meta property="og:title" content="${t}"><meta property="og:description" content="${d}">
<meta property="og:image" content="${img||IMG}"><meta property="og:url" content="${url}">
<meta name="twitter:card" content="summary_large_image"><meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}"><meta name="twitter:image" content="${img||IMG}">
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8912019493601229" crossorigin="anonymous"></script>
${schema?`<script type="application/ld+json">${schema}</script>`:''}
</head><body>
<header><p><a href="${SITE_URL}/">${esc(SITE_NAME)}</a></p>
<nav><a href="${SITE_URL}/">Home</a> | <a href="${SITE_URL}/blog">Blog</a> | <a href="${SITE_URL}/about">About</a> | <a href="${SITE_URL}/contact">Contact</a> | <a href="${SITE_URL}/privacy">Privacy Policy</a> | <a href="${SITE_URL}/terms">Terms</a></nav></header>
<main>${body}</main>
<footer><p>&copy; ${new Date().getUTCFullYear()} ${esc(SITE_NAME)}. <a href="${SITE_URL}/about">About</a> · <a href="${SITE_URL}/contact">Contact</a> · <a href="${SITE_URL}/privacy">Privacy Policy</a> · <a href="${SITE_URL}/terms">Terms of Service</a></p></footer>
</body></html>`;
  return new Response(html,{status,headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':status===200?'public,max-age=0,s-maxage=600,stale-while-revalidate=3600':'public,max-age=300'}});
}
function notFound(){
  return shell({title:`Page not found | ${SITE_NAME}`,desc:'This page does not exist.',url:SITE_URL+'/',body:`<h1>Page not found</h1><p>This page does not exist. <a href="${SITE_URL}/">Go to the home page</a>.</p>`,status:404});
}
async function loadAll(){
  const [vDocs,pDocs]=await Promise.all([getAll('videos'),getAll('playlists')]);
  const videos=vDocs.map(d=>({id:d.name.split('/').pop(),f:d.fields||{}}));
  const playlists=pDocs.map(d=>({id:d.name.split('/').pop(),f:d.fields||{}}));
  return {videos,playlists,vById:Object.fromEntries(videos.map(v=>[v.id,v]))};
}
const plIds=pl=>(pl.f.videos?.arrayValue?.values||[]).map(v=>v.stringValue);

async function watchPage(pathname){
  const parts=pathname.slice(7).split('/').filter(Boolean);
  const {videos,playlists,vById}=await loadAll();
  let v=null,pl=null,ep=0;
  if(parts.length===2 && /^ep-\d+$/.test(parts[1])){
    pl=playlists.find(x=>x.id===parts[0]); ep=parseInt(parts[1].slice(3))||1;
    const vid=pl&&plIds(pl)[ep-1]; v=vid?vById[vid]:null;
  } else if(parts.length===1){
    v=vById[parts[0]];
    if(!v && playlists.find(x=>x.id===parts[0])) return notFound(); // playlist needs /ep-N
  }
  if(!v || (v.f.status?.stringValue==='draft')) return notFound();
  const g=(o,k)=>o.f[k]?.stringValue||'';
  const plName=pl?g(pl,'name'):'';
  const vTitle=g(v,'title')||SITE_NAME;
  const title=pl?`${plName} — Episode ${ep}`:vTitle;
  const url=SITE_URL+pathname;
  const img=await resolveThumb(v.f);
  const vDesc=stripHtml(g(v,'description'));
  const plDesc=pl?stripHtml(g(pl,'description')):'';
  const desc=(vDesc||plDesc||`Watch ${title} online on ${SITE_NAME}.`).slice(0,300);
  const ids=pl?plIds(pl):[];
  const epLinks=ids.map((id,i)=>{const ev=vById[id];const lab=ev?g(ev,'title'):`Episode ${i+1}`;return `<li>${i+1===ep?'<strong>':''}<a href="${SITE_URL}/watch/${pl.id}/ep-${i+1}">Episode ${i+1}${lab?` — ${esc(lab)}`:''}</a>${i+1===ep?'</strong>':''}</li>`;}).join('\n');
  const dur=g(v,'duration'), cat=g(v,'category');
  const body=`<article>
<h1>${esc(title)}</h1>
${vTitle&&pl?`<p><em>${esc(vTitle)}</em></p>`:''}
<img src="${esc(img)}" alt="${esc(title)}" width="1280" height="720">
<ul>${cat?`<li>Category: ${esc(cat)}</li>`:''}${dur?`<li>Duration: ${esc(dur)}</li>`:''}${pl?`<li>Series: <a href="${SITE_URL}/watch/${pl.id}/ep-1">${esc(plName)}</a> (${ids.length} episodes)</li>`:''}</ul>
${vDesc?`<h2>About this episode</h2><p>${esc(vDesc)}</p>`:''}
${plDesc?`<h2>About ${esc(plName)}</h2><p>${esc(plDesc)}</p>`:''}
${pl&&ids.length>1?`<nav><h2>All episodes of ${esc(plName)}</h2><ul>${epLinks}</ul></nav>`:''}
${pl&&ep>1?`<p><a href="${SITE_URL}/watch/${pl.id}/ep-${ep-1}">← Previous episode</a></p>`:''}
${pl&&ep<ids.length?`<p><a href="${SITE_URL}/watch/${pl.id}/ep-${ep+1}">Next episode →</a></p>`:''}
</article>`;
  const schema=JSON.stringify({"@context":"https://schema.org","@type":"VideoObject","name":title,"description":desc,"thumbnailUrl":img,"uploadDate":(v.f.createdAt?.timestampValue||new Date().toISOString()),"publisher":{"@type":"Organization","name":SITE_NAME,"url":SITE_URL}});
  return shell({title:`${title} | ${SITE_NAME}`,desc,url,img,type:'video.other',body,schema});
}

async function blogPage(pathname){
  const parts=pathname.replace('/blog/','').split('/').filter(Boolean);
  const slug=parts[0]; const epNum=parts[1]?(parseInt(parts[1])||1):1;
  const docs=await getAll('blog_posts');
  const doc=docs.find(d=>{const f=d.fields||{};return (f.slug?.stringValue||d.name.split('/').pop())===slug;});
  if(!doc?.fields || doc.fields.status?.stringValue==='draft') return notFound();
  const f=doc.fields, g=k=>f[k]?.stringValue||'';
  const baseTitle=g('title')||SITE_NAME;
  const url=SITE_URL+pathname;
  let img=g('cover')?fixImg(g('cover')):IMG;
  const rel=(f.relatedVideos?.arrayValue?.values||[]).map(v=>v.stringValue);
  let epHtml='', ids=[], pl=null, epVideo=null, all=null;
  if(rel.length){
    all=await loadAll();
    pl=all.playlists.find(p=>plIds(p).includes(rel[0]));
    ids=pl?plIds(pl):rel;
    const vid=ids[epNum-1]||rel[0];
    epVideo=all.vById[vid]||null;
    if(epVideo) img=await resolveThumb(epVideo.f);
    if(ids.length>1) epHtml=`<nav><h2>Episodes</h2><ul>${ids.map((id,i)=>{const ev=all.vById[id];const lab=ev?(ev.f.title?.stringValue||''):'';return `<li><a href="${SITE_URL}/blog/${esc(slug)}/${i+1}">Episode ${i+1}${lab?` — ${esc(lab)}`:''}</a></li>`;}).join('\n')}</ul></nav>`;
  }
  const isEp=parts.length>1 && epNum>1;
  const title=isEp?`${baseTitle} — Episode ${epNum}`:baseTitle;
  const excerpt=stripHtml(g('excerpt'));
  const epDesc=epVideo?stripHtml(epVideo.f.description?.stringValue||''):'';
  const desc=(isEp&&epDesc?epDesc:(excerpt||stripHtml(g('content')).slice(0,200))).slice(0,300);
  const body=`<article>
<h1>${esc(title)}</h1>
${g('category')?`<p>Category: ${esc(g('category'))}</p>`:''}
<img src="${esc(img)}" alt="${esc(title)}" width="1280" height="720">
${isEp
  ? `${epVideo&&epVideo.f.title?.stringValue?`<h2>${esc(epVideo.f.title.stringValue)}</h2>`:''}${epDesc?`<p>${esc(epDesc)}</p>`:''}<p>This is episode ${epNum} of <a href="${SITE_URL}/blog/${esc(slug)}">${esc(baseTitle)}</a>.</p>`
  : `${excerpt?`<p><strong>${esc(excerpt)}</strong></p>`:''}<div>${safeHtml(g('content'))}</div>`}
${epHtml}
${isEp?`<p><a href="${SITE_URL}/blog/${esc(slug)}">← Read the full article</a></p>`:''}
</article>`;
  const schema=JSON.stringify({"@context":"https://schema.org","@type":"Article","headline":title,"description":desc,"image":img,"datePublished":(f.createdAt?.timestampValue||undefined),"mainEntityOfPage":url,"publisher":{"@type":"Organization","name":SITE_NAME,"url":SITE_URL}});
  return shell({title:`${title} | ${SITE_NAME}`,desc,url,img,type:'article',body,schema});
}

export default async function middleware(req){
  const ua = req.headers.get('user-agent')||'';
  if(!isBot(ua)) return; // real users → pass through to SPA

  const {pathname} = new URL(req.url);

  // Home page: full readable content for crawlers
  if(pathname==='/'||pathname===''){
    try{
      return new Response(await homeHtml(),{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=0,s-maxage=600,stale-while-revalidate=3600'}});
    }catch(e){ return; } // on any error fall back to the normal page
  }
  const pageUrl = SITE_URL + pathname;
  const ok=(t,d,i,type)=>new Response(ogHtml(t,d,i,pageUrl,type),{
    headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}
  });

  // /blog/slug or /blog/slug/epNum  → full article page for crawlers
  if(pathname.startsWith('/blog/') && pathname.length>6){
    try{ const r=await blogPage(pathname); if(r) return r; }catch(e){}
    return;
  }

  // /watch/PLAYLIST_ID/ep-N  or  /watch/VIDEO_ID → full episode page for crawlers
  if(pathname.startsWith('/watch/')){
    try{ const r=await watchPage(pathname); if(r) return r; }catch(e){}
    return;
  }

  return; // everything else passes through
}

export const config = {
  matcher: ['/', '/blog/(.*)', '/watch/(.*)'],
};
