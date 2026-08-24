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
  let title=SITE_NAME, desc='Watch free Khmer dubbed drama online.', img=IMG, extraContent='';

  try{
    if(path.startsWith('/watch/')){
      const parts = path.slice(7).split('/');
      if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
        // /watch/PLAYLIST_ID/ep-N
        const epNum  = parseInt(parts[1].replace('ep-',''))||1;
        const plDoc  = await get(`${FIRESTORE}/playlists/${parts[0]}`);
        if(plDoc?.fields){
          const plName = plDoc.fields.name?.stringValue||'';
          const vids   = (plDoc.fields.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
          const vidId  = vids[epNum-1];
          if(vidId){
            const vDoc = await get(`${FIRESTORE}/videos/${vidId}`);
            if(vDoc?.fields){
              const f=vDoc.fields, g=k=>f[k]?.stringValue||'';
              const platform=g('platform')||g('source'), vid=g('videoId');
              title = `${plName} — Episode ${epNum}`;
              desc  = (g('description')||`Watch ${plName} Episode ${epNum} free on ${SITE_NAME}.`).replace(/<[^>]*>/g,'').slice(0,200);
              img   = g('customThumb')||g('thumbnail')||
                (platform==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${vid}`:
                 platform==='youtube'?`https://img.youtube.com/vi/${vid}/hqdefault.jpg`:IMG);
            }
          }
        }
      } else if(parts.length===1){
        // /watch/VIDEO_ID — check if video belongs to playlist
        const vDoc = await get(`${FIRESTORE}/videos/${parts[0]}`);
        if(vDoc?.fields){
          const f=vDoc.fields, g=k=>f[k]?.stringValue||'';
          const platform=g('platform')||g('source'), vid=g('videoId');
          const vTitle = g('title');

          // Find which playlist this video belongs to
          const plsData = await get(`${FIRESTORE}/playlists`);
          let epNum = 0, plName = '';
          for(const plDoc of (plsData?.documents||[])){
            const pf   = plDoc.fields||{};
            const vids = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
            const idx  = vids.indexOf(parts[0]);
            if(idx!==-1){
              epNum  = idx+1;
              plName = pf.name?.stringValue||'';
              break;
            }
          }

          title = epNum>0
            ? `${plName} — Episode ${epNum}`
            : vTitle||SITE_NAME;
          desc  = (g('description')||`Watch ${title} free on ${SITE_NAME}.`).replace(/<[^>]*>/g,'').slice(0,200);
          img   = g('customThumb')||g('thumbnail')||
            (platform==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${vid}`:
             platform==='youtube'?`https://img.youtube.com/vi/${vid}/hqdefault.jpg`:IMG);
        }
        // Playlist ID without ep → returns default OG (users get 404)
      }
    } else if(path.startsWith('/blog/')){
      const slug2 = path.replace('/blog/','');
      const res = await get(`${FIRESTORE}/blog_posts?pageSize=200`);
      const doc = (res?.documents||[]).find(d=>{
        const f=d.fields||{};
        return (f.slug?.stringValue||d.name.split('/').pop())===slug2;
      });
      if(doc?.fields){
        const f=doc.fields;
        title   = f.title?.stringValue||SITE_NAME;
        desc    = f.excerpt?.stringValue||desc;
        img     = f.cover?.stringValue||IMG;
        // Include article content for Google to index
        const rawContent = (f.content?.stringValue||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,2000);
        extraContent = rawContent;
      }
    }
  }catch(e){}

  const t=esc(title), d=esc(desc), u=SITE_URL+path;
  return new Response(`<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta name="robots" content="index,follow">
<meta property="og:type" content="${path.startsWith('/blog/')?'article':'video.other'}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${u}">
</head>
<body>
<h1>${t}</h1>
${img&&img!==IMG?`<img src="${img}" alt="${t}" width="800" height="450">`:''}
<p>${d}</p>
${extraContent?`<article>${extraContent}</article>`:''}
<p>Watch free Chinese Drama and Khmer dubbed series on <a href="${SITE_URL}">${SITE_NAME}</a>. No subscription needed.</p>
</body>
</html>`,{
    headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}
  });
}

export const config = { matcher:['/watch/:path*','/blog/:path*','/blog'] };
