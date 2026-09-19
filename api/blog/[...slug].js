// Vercel Edge Function — handles /api/blog/* 
// This file handles blog OG tags for Google indexing
// Route: /api/blog/[...slug] catches all /api/blog/* requests

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

const BOTS = /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|linkedinbot|discordbot|googlebot|bingbot|yandex|applebot/i;

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

export default async function handler(req){
  const url     = new URL(req.url);
  const ua      = req.headers.get('user-agent')||'';
  const isBot   = BOTS.test(ua);

  // Get slug and episode from URL
  // URL format: /api/blog/the-legend-of-shen-li-2024/36
  const parts  = url.pathname.replace('/api/blog/','').split('/');
  const slug   = parts[0];
  const epNum  = parts[1] ? parseInt(parts[1])||1 : 1;
  const pageUrl = `${SITE_URL}/blog/${parts.join('/')}`;

  // Real users → fetch and serve the SPA index.html
  // We fetch from the root which is NOT routed through this function
  if(!isBot){
    try{
      const spaRes = await fetch(`${SITE_URL}/?_spa=1`);
      if(spaRes.ok){
        const html = await spaRes.text();
        return new Response(html, {
          headers: {
            'Content-Type': 'text/html;charset=utf-8',
            'Cache-Control': 'no-store',
          }
        });
      }
    }catch(e){}
    // Fallback: serve minimal HTML that loads the SPA
    return new Response(`<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>រោងកុនគ្មានមនុស្ស</title>
<link rel="stylesheet" href="/assets/css/main.css?v=202609180446">
<script type="module" src="/assets/js/app.js?v=202609180446"></script>
</head>
<body>
<div id="page-loader"><div class="loader-spinner"></div></div>
</body>
</html>`, {
      headers: {
        'Content-Type': 'text/html;charset=utf-8',
        'Cache-Control': 'no-store',
      }
    });
  }

  // Bots → fetch article and return OG tags
  let title = SITE_NAME, desc = 'Watch free drama online.', img = IMG;

  try{
    // Get blog post
    const res = await get(`${FIRESTORE}/blog_posts?pageSize=200`);
    const doc = (res?.documents||[]).find(d=>{
      const f = d.fields||{};
      return (f.slug?.stringValue||d.name.split('/').pop())===slug;
    });

    if(doc?.fields){
      const f = doc.fields, g = k=>f[k]?.stringValue||'';
      title = g('title')||SITE_NAME;
      desc  = g('excerpt')||desc;
      img   = g('cover')||IMG;

      // Get episode-specific thumbnail
      const relVids = f.relatedVideos?.arrayValue?.values||[];
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
      // Add episode label to title
      if(epNum>1) title = `${title} — Episode ${epNum}`;
    }
  }catch(e){}

  const t=esc(title), d=esc(desc.replace(/<[^>]*>/g,'').slice(0,200));

  return new Response(`<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="article">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${pageUrl}">
<script type="application/ld+json">${JSON.stringify({
  "@context":"https://schema.org",
  "@type":"VideoObject",
  "name":title,
  "description":desc.replace(/<[^>]*>/g,'').slice(0,200),
  "thumbnailUrl":img,
  "uploadDate":new Date().toISOString(),
  "publisher":{"@type":"Organization","name":SITE_NAME,"url":SITE_URL}
})}</script>
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<img src="${img}" alt="${t}" width="800" height="450">
<p>Watch <strong>${t}</strong> free on <a href="${SITE_URL}">${SITE_NAME}</a>.</p>
<p>Stream the best Chinese Drama with Khmer dubbing — no subscription needed.</p>
<p><a href="${SITE_URL}/blog/${slug}">← Back to article</a></p>
</body>
</html>`,{
    headers:{
      'Content-Type':'text/html;charset=utf-8',
      'Cache-Control':'public,max-age=3600',
    }
  });
}

export const config = { runtime: 'edge' };
