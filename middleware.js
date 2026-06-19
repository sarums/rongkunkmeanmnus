// Vercel Edge Middleware — Bot Detection + Pre-rendering
// Serves static HTML with proper meta tags to ALL search engine crawlers
// and social media bots for ALL page types.
// Real users always get the normal SPA.

const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

const BOTS = [
  'googlebot','bingbot','yandexbot','duckduckbot','slurp',
  'facebookexternalhit','facebot','twitterbot','telegrambot',
  'whatsapp','linkedinbot','discordbot','slackbot','pinterest',
  'applebot','seznambot','ahrefsbot','semrushbot','mj12bot',
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

function escHtml(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHtml({title, desc, img, url, type='website'}){
  const t = escHtml(title||SITE_NAME);
  const d = escHtml((desc||'Watch free Chinese Drama and Khmer dubbed series online.').replace(/<[^>]*>/g,'').slice(0,200));
  const i = img||DEFAULT_IMG;
  const u = url||SITE_URL;
  return `<!DOCTYPE html>
<html lang="km">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="${type}">
<meta property="og:title" content="${t}">
<meta property="og:description" content="${d}">
<meta property="og:image" content="${i}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${i}">
<link rel="canonical" href="${u}">
</head>
<body>
<h1>${t}</h1>
<p>${d}</p>
<p><a href="${u}">Watch on ${SITE_NAME}</a></p>
</body>
</html>`;
}

async function getVideoData(videoId){
  try{
    const res = await fetch(`${FIRESTORE}/videos/${videoId}`);
    if(!res.ok) return null;
    const doc = await res.json();
    const f = doc.fields||{};
    const get = k => f[k]?.stringValue||'';
    const platform = get('platform')||get('source');
    const vid = get('videoId');
    let img = get('customThumb')||get('thumbnail');
    if(!img){
      if(platform==='dailymotion') img=`https://www.dailymotion.com/thumbnail/video/${vid}`;
      else if(platform==='youtube') img=`https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
    }
    return { title:get('title'), desc:get('description'), img };
  }catch(e){ return null; }
}

async function getPlaylists(){
  try{
    const res = await fetch(`${FIRESTORE}/playlists`);
    if(!res.ok) return [];
    const data = await res.json();
    return (data.documents||[]).map(d=>({
      id: d.name.split('/').pop(),
      name: d.fields?.name?.stringValue||'',
      videos: (d.fields?.videos?.arrayValue?.values||[]).map(v=>v.stringValue),
    }));
  }catch(e){ return []; }
}

async function getBlogPost(slug){
  try{
    const res = await fetch(`${FIRESTORE}/blog_posts?pageSize=200`);
    if(!res.ok) return null;
    const data = await res.json();
    const doc = (data.documents||[]).find(d=>{
      const f = d.fields||{};
      const s = f.slug?.stringValue||'';
      const id = d.name.split('/').pop();
      return s===slug||id===slug;
    });
    if(!doc) return null;
    const f = doc.fields||{};
    return {
      title   : f.title?.stringValue||'',
      excerpt : f.excerpt?.stringValue||'',
      cover   : f.cover?.stringValue||'',
      category: f.category?.stringValue||'',
    };
  }catch(e){ return null; }
}

export default async function middleware(req){
  if(!isBot(req)) return; // real users pass through to normal SPA

  const url  = new URL(req.url);
  const path = url.pathname;
  const respond = html => new Response(html, {
    headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}
  });

  // ── Home ──
  if(path==='/'||path===''){
    return respond(buildHtml({
      title: `${SITE_NAME} - Watch Chinese Drama & Khmer Dubbed Series Free`,
      desc : 'Watch Chinese Drama, Khmer Drama and Khmer dubbed series online for free. No subscription needed.',
      url  : SITE_URL,
    }));
  }

  // ── Watch page ──
  if(path.startsWith('/watch/')){
    const parts = path.slice(7).split('/');
    let videoData = null;
    const pageUrl = SITE_URL + path;

    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      const pls   = await getPlaylists();
      const pl    = pls.find(p=>{
        const s = slugify(p.name);
        return (s.length>=3?s:p.id)===parts[0];
      });
      if(pl){
        const vidId = (pl.videos||[])[epNum-1];
        if(vidId){
          videoData = await getVideoData(vidId);
          if(videoData) videoData.title = `${videoData.title||''} — Episode ${epNum}`;
        }
      }
    } else if(parts.length===1){
      const vRes = await fetch(`${FIRESTORE}/videos?pageSize=300`);
      if(vRes.ok){
        const vData = await vRes.json();
        const doc = (vData.documents||[]).find(d=>{
          const id = d.name.split('/').pop();
          const title = d.fields?.title?.stringValue||'';
          const s = slugify(title);
          return (s.length>=3?s:id)===parts[0]||id===parts[0];
        });
        if(doc){
          const id = doc.name.split('/').pop();
          videoData = await getVideoData(id);
        }
      }
    }

    return respond(buildHtml({
      title: videoData?.title||SITE_NAME,
      desc : videoData?.desc||`Watch ${videoData?.title||'drama'} online free on ${SITE_NAME}.`,
      img  : videoData?.img||DEFAULT_IMG,
      url  : pageUrl,
      type : 'video.other',
    }));
  }

  // ── Blog list ──
  if(path==='/blog'){
    return respond(buildHtml({
      title: `Blog | ${SITE_NAME}`,
      desc : 'Drama reviews, episode recaps, top lists and more.',
      url  : `${SITE_URL}/blog`,
    }));
  }

  // ── Blog post ──
  if(path.startsWith('/blog/')){
    const slug = path.replace('/blog/','');
    const post = await getBlogPost(slug);
    return respond(buildHtml({
      title: post?.title?`${post.title} | ${SITE_NAME}`:SITE_NAME,
      desc : post?.excerpt||`Read on ${SITE_NAME}.`,
      img  : post?.cover||DEFAULT_IMG,
      url  : `${SITE_URL}/blog/${slug}`,
      type : 'article',
    }));
  }

  // ── Everything else — pass through ──
  return;
}

export const config = {
  matcher: ['/', '/watch/:path*', '/blog', '/blog/:path*'],
};
