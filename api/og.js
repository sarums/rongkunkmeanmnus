// Vercel Edge Function — /api/og
// Returns OG meta tags for social media share button
// Usage: /api/og?id=FIRESTORE_VIDEO_ID

const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;
const IMG = DEFAULT_IMG;

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



export default async function handler(req) {
  const url     = new URL(req.url);
  const videoId = url.searchParams.get('id');

  let title   = SITE_NAME;
  let desc    = 'Watch free Chinese Drama and Khmer dubbed series online.';
  let img     = DEFAULT_IMG;
  let pageUrl = SITE_URL;

  if(videoId){
    try{
      const res = await fetch(`${FIRESTORE}/videos/${videoId}`);
      if(res.ok){
        const doc = await res.json();
        const f   = doc.fields||{};
        const get = k=>f[k]?.stringValue||'';
        if(get('title')) title = get('title');
        if(get('description')) desc = get('description').replace(/<[^>]*>/g,'').slice(0,200);
        img = await resolveThumb(f);

        // Find playlist for correct URL
        // The site's real URLs use Firestore IDs (/watch/VIDEO_ID, /watch/PLAYLIST_ID/ep-N).
        // og:url must match them, otherwise Facebook re-scrapes a URL that does not resolve and loses the thumbnail.
        pageUrl = `${SITE_URL}/watch/${videoId}`;

        const plRes = await fetch(`${FIRESTORE}/playlists`);
        if(plRes.ok){
          const plData = await plRes.json();
          for(const plDoc of (plData.documents||[])){
            const pf  = plDoc.fields||{};
            const arr = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
            const idx = arr.indexOf(videoId);
            if(idx!==-1){
              const plId   = plDoc.name.split('/').pop();
              pageUrl = `${SITE_URL}/watch/${plId}/ep-${idx+1}`;
              title   = `${title} — Episode ${idx+1}`;
              break;
            }
          }
        }
      }
    }catch(e){}
  }

  const html = `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${pageUrl}">
<meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
<h1>${esc(title)}</h1>
<p>${esc(desc)}</p>
<a href="${pageUrl}">Watch on ${SITE_NAME}</a>
</body>
</html>`;

  return new Response(html,{
    headers:{
      'Content-Type':'text/html;charset=utf-8',
      'Cache-Control':'public,max-age=3600',
    }
  });
}

function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(s){
  return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

export const config = { runtime:'edge' };
