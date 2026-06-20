// Vercel Edge Function — handles both bots and real users
// Bots → get proper OG meta tags (for Facebook/Telegram thumbnails)
// Real users → get redirected to the actual SPA page
// Called for ALL /watch/* and /blog/* URLs via vercel.json rewrite

const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

const BOTS = [
  'facebookexternalhit','facebot','twitterbot','telegrambot',
  'whatsapp','linkedinbot','discordbot','slackbot','pinterest',
  'applebot','googlebot','bingbot','yandexbot','duckduckbot',
  'ahrefsbot','semrushbot','mj12bot','rogerbot','dotbot',
];

function isBot(req){
  const ua = (req.headers.get('user-agent')||'').toLowerCase();
  return BOTS.some(b=>ua.includes(b));
}

function slugify(s){
  return (s||'').toLowerCase()
    .replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'')
    .replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function ogHtml(title, desc, img, pageUrl, type='website'){
  const t = esc(title||SITE_NAME);
  const d = esc((desc||'Watch free Chinese Drama online.').replace(/<[^>]*>/g,'').slice(0,200));
  const i = img||DEFAULT_IMG;
  return `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
<link rel="canonical" href="${pageUrl}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<a href="${pageUrl}">Watch on ${SITE_NAME}</a>
</body>
</html>`;
}

async function fetchVideo(id){
  try{
    const r = await fetch(`${FIRESTORE}/videos/${id}`);
    if(!r.ok) return null;
    const d = await r.json();
    const f = d.fields||{};
    const g = k=>f[k]?.stringValue||'';
    const platform = g('platform')||g('source');
    const vid = g('videoId');
    let img = g('customThumb')||g('thumbnail');
    if(!img){
      if(platform==='dailymotion') img=`https://www.dailymotion.com/thumbnail/video/${vid}`;
      else if(platform==='youtube') img=`https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      else if(platform==='vimeo')   img=`https://vumbnail.com/${vid}.jpg`;
    }
    return {title:g('title'), desc:g('description'), img};
  }catch(e){return null;}
}

async function fetchPlaylists(){
  try{
    const r = await fetch(`${FIRESTORE}/playlists`);
    if(!r.ok) return [];
    const d = await r.json();
    return (d.documents||[]).map(doc=>({
      id    : doc.name.split('/').pop(),
      name  : doc.fields?.name?.stringValue||'',
      videos: (doc.fields?.videos?.arrayValue?.values||[]).map(v=>v.stringValue),
    }));
  }catch(e){return [];}
}

async function fetchVideoBySlug(slug){
  try{
    const r = await fetch(`${FIRESTORE}/videos?pageSize=300`);
    if(!r.ok) return null;
    const d = await r.json();
    const doc = (d.documents||[]).find(doc=>{
      const id = doc.name.split('/').pop();
      const title = doc.fields?.title?.stringValue||'';
      const s = slugify(title);
      return (s.length>=3?s:id)===slug||id===slug;
    });
    if(!doc) return null;
    return fetchVideo(doc.name.split('/').pop());
  }catch(e){return null;}
}

async function fetchBlogPost(slug){
  try{
    const r = await fetch(`${FIRESTORE}/blog_posts?pageSize=200`);
    if(!r.ok) return null;
    const d = await r.json();
    const doc = (d.documents||[]).find(doc=>{
      const f = doc.fields||{};
      const s = f.slug?.stringValue||'';
      const id = doc.name.split('/').pop();
      return s===slug||id===slug;
    });
    if(!doc) return null;
    const f = doc.fields||{};
    return {
      title  : f.title?.stringValue||'',
      excerpt: f.excerpt?.stringValue||'',
      cover  : f.cover?.stringValue||'',
    };
  }catch(e){return null;}
}

export default async function handler(req){
  const url      = new URL(req.url);
  const path     = url.pathname;
  const pageUrl  = SITE_URL + path;
  const bot      = isBot(req);

  // ── Real users → serve the SPA index.html ──
  if(!bot){
    // Fetch and return the SPA
    const spaRes = await fetch(`${SITE_URL}/index.html`);
    const html   = await spaRes.text();
    return new Response(html, {
      headers:{
        'Content-Type':'text/html;charset=utf-8',
        'Cache-Control':'no-store',
      }
    });
  }

  // ── Bots → serve proper OG tags ──
  const respond = (title, desc, img, type) =>
    new Response(ogHtml(title, desc, img, pageUrl, type),{
      headers:{
        'Content-Type':'text/html;charset=utf-8',
        'Cache-Control':'public,max-age=3600',
      }
    });

  // /watch/playlist-slug/ep-N
  if(path.startsWith('/watch/')){
    const parts = path.slice(7).split('/');
    let video = null;
    let epLabel = '';

    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      epLabel = ` — Episode ${epNum}`;
      const pls = await fetchPlaylists();
      const pl  = pls.find(p=>{
        const s = slugify(p.name);
        return (s.length>=3?s:p.id)===parts[0];
      });
      if(pl){
        const vidId=(pl.videos||[])[epNum-1];
        if(vidId) video=await fetchVideo(vidId);
      }
    } else if(parts.length===1){
      video = await fetchVideoBySlug(parts[0]);
    }

    const title = video?.title?`${video.title}${epLabel}`:SITE_NAME;
    const desc  = video?.desc||`Watch ${title} online free on ${SITE_NAME}.`;
    const img   = video?.img||DEFAULT_IMG;
    return respond(title, desc, img, 'video.other');
  }

  // /blog/slug
  if(path.startsWith('/blog/')){
    const slug = path.replace('/blog/','');
    const post = await fetchBlogPost(slug);
    return respond(
      post?.title?`${post.title} | ${SITE_NAME}`:SITE_NAME,
      post?.excerpt||`Read on ${SITE_NAME}.`,
      post?.cover||DEFAULT_IMG,
      'article'
    );
  }

  // /blog
  return respond(
    `Blog | ${SITE_NAME}`,
    'Drama reviews, episode recaps and more.',
    DEFAULT_IMG
  );
}

export const config = { runtime:'edge' };
