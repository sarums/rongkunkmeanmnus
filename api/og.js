// Vercel Serverless Function (Node.js) — /api/og
// Returns HTML with OG meta tags for social media bots
// Usage: /api/og?id=FIRESTORE_VIDEO_ID

const https = require('https');

const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function slugify(s){
  return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

function fetchJson(url){
  return new Promise((resolve,reject)=>{
    https.get(url, res=>{
      let data='';
      res.on('data',d=>data+=d);
      res.on('end',()=>{
        try{ resolve(JSON.parse(data)); }
        catch(e){ reject(e); }
      });
    }).on('error',reject);
  });
}

module.exports = async (req, res) => {
  const videoId = req.query.id;

  let title   = SITE_NAME;
  let desc    = 'Watch free Chinese Drama and Khmer dubbed series online.';
  let img     = DEFAULT_IMG;
  let pageUrl = SITE_URL;

  if(videoId){
    try{
      // Fetch video
      const doc = await fetchJson(`${FIRESTORE}/videos/${videoId}`);
      const f   = doc.fields||{};
      const get = k=>f[k]?.stringValue||'';

      const vTitle    = get('title');
      const vDesc     = get('description');
      const platform  = get('platform')||get('source');
      const vid       = get('videoId');
      const custom    = get('customThumb')||get('thumbnail');

      if(vTitle) title = vTitle;
      if(vDesc)  desc  = vDesc.replace(/<[^>]*>/g,'').slice(0,200);

      if(custom)                   img = custom;
      else if(platform==='dailymotion') img = `https://www.dailymotion.com/thumbnail/video/${vid}`;
      else if(platform==='youtube')     img = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      else if(platform==='vimeo')       img = `https://vumbnail.com/${vid}.jpg`;

      // Find playlist
      const titleSlug = slugify(title);
      pageUrl = `${SITE_URL}/watch/${titleSlug.length>=3?titleSlug:videoId}`;

      const plData = await fetchJson(`${FIRESTORE}/playlists`);
      for(const plDoc of (plData.documents||[])){
        const pf  = plDoc.fields||{};
        const arr = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
        const idx = arr.indexOf(videoId);
        if(idx!==-1){
          const plName  = pf.name?.stringValue||'';
          const plSlug  = slugify(plName);
          const plId    = plDoc.name.split('/').pop();
          const slug    = plSlug.length>=3?plSlug:plId;
          pageUrl = `${SITE_URL}/watch/${slug}/ep-${idx+1}`;
          title   = `${title} — Episode ${idx+1}`;
          break;
        }
      }
    }catch(e){
      // use defaults
    }
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

  res.setHeader('Content-Type','text/html; charset=utf-8');
  res.setHeader('Cache-Control','public, max-age=3600');
  res.status(200).send(html);
};
