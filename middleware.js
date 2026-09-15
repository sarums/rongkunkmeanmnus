const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

// STRICT bot detection - only known crawlers
const BOT = /^(facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp\/|linkedinbot|discordbot|googlebot|bingbot)/i;

function isBot(ua){ return BOT.test(ua||''); }
function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function get(url){
  try{
    const r = await fetch(url, {signal: AbortSignal.timeout(4000)});
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}

function getThumb(f){
  const g = k=>f[k]?.stringValue||'';
  const p = g('platform')||g('source'), v = g('videoId');
  return g('customThumb')||g('thumbnail')||
    (p==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${v}`:
     p==='youtube'?`https://img.youtube.com/vi/${v}/hqdefault.jpg`:IMG);
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

export default async function middleware(req){
  const ua = req.headers.get('user-agent')||'';
  if(!isBot(ua)) return; // real users → pass through to SPA

  const {pathname} = new URL(req.url);
  const pageUrl = SITE_URL + pathname;
  const ok=(t,d,i,type)=>new Response(ogHtml(t,d,i,pageUrl,type),{
    headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}
  });

  // /blog/slug or /blog/slug/epNum
  if(pathname.startsWith('/blog/')){
    const parts = pathname.replace('/blog/','').split('/');
    const slug  = parts[0];
    const epNum = parts[1] ? parseInt(parts[1])||1 : 1;

    // Get blog post
    const res = await get(`${FIRESTORE}/blog_posts?pageSize=200`);
    const doc = (res?.documents||[]).find(d=>{
      const f=d.fields||{};
      return (f.slug?.stringValue||d.name.split('/').pop())===slug;
    });

    if(doc?.fields){
      const f = doc.fields, g=k=>f[k]?.stringValue||'';
      let title = g('title'), desc = g('excerpt'), img = g('cover')||IMG;
      const relVids = f.relatedVideos?.arrayValue?.values||[];

      // Get episode-specific thumbnail
      if(relVids.length>0){
        let vidId = relVids[0].stringValue;
        // Find playlist and get correct episode
        const plsData = await get(`${FIRESTORE}/playlists`);
        for(const plDoc of (plsData?.documents||[])){
          const pf   = plDoc.fields||{};
          const vids = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
          if(vids.includes(vidId)){
            const epVidId = vids[epNum-1];
            if(epVidId) vidId = epVidId;
            break;
          }
        }
        const vDoc = await get(`${FIRESTORE}/videos/${vidId}`);
        if(vDoc?.fields){
          const thumb = getThumb(vDoc.fields);
          if(thumb) img = thumb;
        }
      }

      const epLabel = epNum>1 ? ` — Episode ${epNum}` : '';
      return ok(`${title}${epLabel} | ${SITE_NAME}`, desc, img, 'article');
    }
    return ok(`Blog | ${SITE_NAME}`, 'Drama reviews and more.', IMG, 'website');
  }

  // /watch/PLAYLIST_ID/ep-N
  if(pathname.startsWith('/watch/')){
    const parts = pathname.slice(7).split('/');
    let title=SITE_NAME, desc='', img=IMG;
    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      const plDoc = await get(`${FIRESTORE}/playlists/${parts[0]}`);
      if(plDoc?.fields){
        const pf   = plDoc.fields;
        const plName = pf.name?.stringValue||'';
        const vids   = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
        const vidId  = vids[epNum-1];
        if(vidId){
          const vDoc = await get(`${FIRESTORE}/videos/${vidId}`);
          if(vDoc?.fields){ img=getThumb(vDoc.fields); }
        }
        title = `${plName} — Episode ${epNum}`;
        desc  = `Watch ${plName} Episode ${epNum} free on ${SITE_NAME}.`;
      }
    } else if(parts.length===1){
      const vDoc = await get(`${FIRESTORE}/videos/${parts[0]}`);
      if(vDoc?.fields){
        const g=k=>vDoc.fields[k]?.stringValue||'';
        title=g('title'); desc=g('description'); img=getThumb(vDoc.fields);
      }
    }
    return ok(title, desc, img, 'video.other');
  }

  return; // everything else passes through
}

export const config = {
  matcher: ['/blog/:path*', '/blog', '/watch/:path*'],
};
