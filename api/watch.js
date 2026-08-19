// Vercel Edge Function — handles /watch/* for both bots and users
// Bots get proper OG meta tags
// Real users get the normal SPA (index.html)

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

const BOTS = /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|googlebot|bingbot|yandexbot|applebot|pinterest|linkedinbot|discordbot/i;

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function fetchFS(path, ms=4000){
  try{
    const r = await fetch(`${FIRESTORE}/${path}`, {signal: AbortSignal.timeout(ms)});
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}

function getImg(f){
  const g = k=>f[k]?.stringValue||'';
  const platform = g('platform')||g('source');
  const vid = g('videoId');
  const custom = g('customThumb')||g('thumbnail');
  if(custom) return custom;
  if(platform==='dailymotion') return `https://www.dailymotion.com/thumbnail/video/${vid}`;
  if(platform==='youtube') return `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
  return IMG;
}

function ogPage(title, desc, img, url){
  const t=esc(title||SITE_NAME);
  const d=esc((desc||'Watch free drama online.').replace(/<[^>]*>/g,'').slice(0,200));
  const i=img||IMG;
  return `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${url}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
<link rel="canonical" href="${url}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<img src="${i}" alt="${t}" width="1280" height="720">
<p>Watch <strong>${t}</strong> free on <a href="${SITE_URL}">${SITE_NAME}</a>.</p>
<p>Stream the best Chinese Drama and Khmer dubbed series online for free. No subscription needed.</p>
</body>
</html>`;
}

export default async function handler(req){
  const url  = new URL(req.url);
  const path = url.pathname; // e.g. /watch/PLAYLIST_ID/ep-5
  const pageUrl = SITE_URL + path;
  const ua = req.headers.get('user-agent')||'';
  const bot = BOTS.test(ua);

  // Real users → serve SPA index.html
  if(!bot){
    const spa = await fetch(`${SITE_URL}/index.html`);
    const html = await spa.text();
    return new Response(html, {
      headers:{
        'Content-Type':'text/html;charset=utf-8',
        'Cache-Control':'no-store',
        'X-Served-By':'watch-edge-fn',
      }
    });
  }

  // Bots → serve OG tags with video data
  const parts = path.replace('/watch/','').split('/');
  let title = SITE_NAME, desc = '', img = IMG;

  try{
    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      // /watch/PLAYLIST_ID/ep-N
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      const plDoc = await fetchFS(`playlists/${parts[0]}`);
      if(plDoc?.fields){
        const pf = plDoc.fields;
        const plName = pf.name?.stringValue||'';
        const vids = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
        const vidId = vids[epNum-1];
        if(vidId){
          const vDoc = await fetchFS(`videos/${vidId}`);
          if(vDoc?.fields){
            const f = vDoc.fields;
            const g = k=>f[k]?.stringValue||'';
            title = `${plName} — Episode ${epNum}`;
            desc  = (g('description')||`Watch ${plName} Episode ${epNum} free on ${SITE_NAME}.`);
            img   = getImg(f);
          }
        }
        if(!title||title===SITE_NAME) title = `${plName} — Episode ${epNum}`;
      }
    } else if(parts.length===1){
      // /watch/VIDEO_ID
      const vDoc = await fetchFS(`videos/${parts[0]}`);
      if(vDoc?.fields){
        const f = vDoc.fields;
        const g = k=>f[k]?.stringValue||'';
        title = g('title')||SITE_NAME;
        desc  = g('description')||`Watch ${title} free on ${SITE_NAME}.`;
        img   = getImg(f);
      }
    }
  }catch(e){}

  return new Response(ogPage(title, desc, img, pageUrl),{
    headers:{
      'Content-Type':'text/html;charset=utf-8',
      'Cache-Control':'public,max-age=3600',
      'X-Served-By':'watch-edge-fn',
    }
  });
}

export const config = { runtime: 'edge' };
