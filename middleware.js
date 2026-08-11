const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

// Only intercept known social/search bots
const BOTS = /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|googlebot|bingbot/i;

function esc(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function slug(s){ return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').slice(0,80); }

async function get(url){
  try{ const r=await fetch(url,{signal:AbortSignal.timeout(3000)}); return r.ok?await r.json():null; }
  catch(e){ return null; }
}

export default async function middleware(req){
  const ua = req.headers.get('user-agent')||'';
  if(!BOTS.test(ua)) return; // real users → pass through to SPA

  const path = new URL(req.url).pathname;
  let title=SITE_NAME, desc='Watch free Khmer dubbed drama online.', img=IMG;

  try{
    if(path.startsWith('/watch/')){
      const parts = path.slice(7).split('/');
      // Try as playlist first (with or without ep number)
      const plDoc = await get(`${FIRESTORE}/playlists/${parts[0]}`);
      if(plDoc?.fields){
        // It's a playlist
        const plName = plDoc.fields.name?.stringValue||'';
        const vids   = (plDoc.fields.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
        let epNum = 1;
        if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
          epNum = parseInt(parts[1].replace('ep-',''))||1;
        }
        const vidId = vids[epNum-1];
        if(vidId){
          const vDoc = await get(`${FIRESTORE}/videos/${vidId}`);
          if(vDoc?.fields){
            const f=vDoc.fields, g=k=>f[k]?.stringValue||'';
            const platform=g('platform')||g('source'), vid=g('videoId');
            title = parts.length>=2
              ? `${g('title')} — Episode ${epNum}`
              : `${plName} — Watch Free`;
            desc  = (g('description')||`Watch ${plName} Episode ${epNum} free on ${SITE_NAME}.`).replace(/<[^>]*>/g,'').slice(0,200);
            img   = g('customThumb')||g('thumbnail')||
              (platform==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${vid}`:
               platform==='youtube'?`https://img.youtube.com/vi/${vid}/hqdefault.jpg`:IMG);
          }
        }
        if(!title) title = plName;
      } else if(parts.length===1){
        // Not a playlist — try as single video ID
        const vDoc = await get(`${FIRESTORE}/videos/${parts[0]}`);
        if(vDoc?.fields){
          const f=vDoc.fields, g=k=>f[k]?.stringValue||'';
          const platform=g('platform')||g('source'), vid=g('videoId');
          title = g('title')||SITE_NAME;
          desc  = (g('description')||`Watch ${title} free on ${SITE_NAME}.`).replace(/<[^>]*>/g,'').slice(0,200);
          img   = g('customThumb')||g('thumbnail')||
            (platform==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${vid}`:
             platform==='youtube'?`https://img.youtube.com/vi/${vid}/hqdefault.jpg`:IMG);
        }
      }
    } else if(path.startsWith('/blog/')){
      const slug2 = path.replace('/blog/','');
      const res = await get(`${FIRESTORE}/blog_posts?pageSize=100`);
      const doc = (res?.documents||[]).find(d=>(d.fields?.slug?.stringValue||d.name.split('/').pop())===slug2);
      if(doc?.fields){
        title = doc.fields.title?.stringValue||SITE_NAME;
        desc  = doc.fields.excerpt?.stringValue||desc;
        img   = doc.fields.cover?.stringValue||IMG;
      }
    }
  }catch(e){}

  const t=esc(title), d=esc(desc), u=SITE_URL+path;
  return new Response(`<!DOCTYPE html><html><head>
<meta charset="UTF-8"><title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:url" content="${u}">
<meta property="og:type" content="video.other">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${u}">
</head><body>
<h1>${t}</h1><p>${d}</p>
<img src="${img}" alt="${t}" width="800">
<p>Watch on <a href="${SITE_URL}">${SITE_NAME}</a></p>
</body></html>`,{
    headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}
  });
}

export const config = { matcher:['/watch/:path*','/blog/:path*','/blog'] };
