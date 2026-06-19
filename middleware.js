// Vercel Edge Middleware — Bot Detection + Pre-rendering
// Serves proper OG meta tags to social bots for thumbnail previews.
// Real users always get the normal SPA.

const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

// All known social/search bots
const BOTS = [
  'facebookexternalhit','facebot',
  'twitterbot','telegrambot',
  'whatsapp','linkedinbot',
  'discordbot','slackbot',
  'pinterest','applebot',
  'googlebot','bingbot',
  'yandexbot','duckduckbot',
  'ahrefsbot','semrushbot',
];

function isBot(req){
  const ua = (req.headers.get('user-agent')||'').toLowerCase();
  return BOTS.some(b => ua.includes(b));
}

function slugify(s){
  return (s||'').toLowerCase()
    .replace(/\s+/g,'-')
    .replace(/[^a-z0-9-]/g,'')
    .replace(/-+/g,'-')
    .replace(/^-+|-+$/g,'')
    .slice(0,80);
}

function esc(s){
  return (s||'')
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function html(title, desc, img, url, type='website'){
  const t = esc(title||SITE_NAME);
  const d = esc((desc||'Watch free Chinese Drama and Khmer dubbed series online.')
    .replace(/<[^>]*>/g,'').slice(0,200));
  const i = img||DEFAULT_IMG;
  const u = url||SITE_URL;
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
<a href="${u}">Watch on ${SITE_NAME}</a>
</body>
</html>`;
}

// Fetch a single video doc from Firestore
async function fetchVideo(id){
  try{
    const r = await fetch(`${FIRESTORE}/videos/${id}`, {
      headers:{'Accept':'application/json'}
    });
    if(!r.ok) return null;
    const d = await r.json();
    const f = d.fields||{};
    const g = k => f[k]?.stringValue||'';
    const platform = g('platform')||g('source');
    const vid      = g('videoId');
    let img = g('customThumb')||g('thumbnail');
    if(!img){
      if(platform==='dailymotion') img = `https://www.dailymotion.com/thumbnail/video/${vid}`;
      else if(platform==='youtube') img = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      else if(platform==='vimeo')   img = `https://vumbnail.com/${vid}.jpg`;
    }
    return { title:g('title'), desc:g('description'), img };
  }catch(e){ return null; }
}

// Fetch all playlists
async function fetchPlaylists(){
  try{
    const r = await fetch(`${FIRESTORE}/playlists`,{
      headers:{'Accept':'application/json'}
    });
    if(!r.ok) return [];
    const d = await r.json();
    return (d.documents||[]).map(doc=>({
      id    : doc.name.split('/').pop(),
      name  : doc.fields?.name?.stringValue||'',
      videos: (doc.fields?.videos?.arrayValue?.values||[]).map(v=>v.stringValue),
    }));
  }catch(e){ return []; }
}

// Fetch blog post by slug
async function fetchBlogPost(slug){
  try{
    const r = await fetch(`${FIRESTORE}/blog_posts?pageSize=200`,{
      headers:{'Accept':'application/json'}
    });
    if(!r.ok) return null;
    const d = await r.json();
    const doc = (d.documents||[]).find(doc=>{
      const f   = doc.fields||{};
      const s   = f.slug?.stringValue||'';
      const id  = doc.name.split('/').pop();
      return s===slug || id===slug;
    });
    if(!doc) return null;
    const f = doc.fields||{};
    return {
      title  : f.title?.stringValue||'',
      excerpt: f.excerpt?.stringValue||'',
      cover  : f.cover?.stringValue||'',
    };
  }catch(e){ return null; }
}

// Fetch videos list (for slug matching)
async function fetchVideoBySlug(slug){
  try{
    const r = await fetch(`${FIRESTORE}/videos?pageSize=300`,{
      headers:{'Accept':'application/json'}
    });
    if(!r.ok) return null;
    const d = await r.json();
    const doc = (d.documents||[]).find(doc=>{
      const id    = doc.name.split('/').pop();
      const title = doc.fields?.title?.stringValue||'';
      const s     = slugify(title);
      return (s.length>=3?s:id)===slug || id===slug;
    });
    if(!doc) return null;
    return fetchVideo(doc.name.split('/').pop());
  }catch(e){ return null; }
}

export default async function middleware(req){
  // Only intercept bots
  if(!isBot(req)) return;

  const { pathname } = new URL(req.url);
  const pageUrl = SITE_URL + pathname;
  const respond = (title, desc, img, type) =>
    new Response(html(title, desc, img, pageUrl, type), {
      headers:{
        'Content-Type' : 'text/html;charset=utf-8',
        'Cache-Control': 'public,max-age=3600,s-maxage=3600',
      }
    });

  // ── HOME ──
  if(pathname==='/' || pathname===''){
    return respond(
      `${SITE_NAME} — Watch Chinese Drama & Khmer Dubbed Series Free`,
      'Watch Chinese Drama, Khmer Drama and Khmer dubbed series online for free on រោងកុនគ្មានមនុស្ស.',
      DEFAULT_IMG
    );
  }

  // ── WATCH PAGE ──
  if(pathname.startsWith('/watch/')){
    const parts = pathname.slice(7).split('/');
    let video = null;
    let epLabel = '';

    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      // /watch/playlist-slug/ep-N
      const epNum = parseInt(parts[1].replace('ep-',''))||1;
      epLabel = ` — Episode ${epNum}`;
      const pls = await fetchPlaylists();
      const pl  = pls.find(p=>{
        const s = slugify(p.name);
        return (s.length>=3?s:p.id) === parts[0];
      });
      if(pl){
        const vidId = (pl.videos||[])[epNum-1];
        if(vidId) video = await fetchVideo(vidId);
      }
    } else if(parts.length===1){
      // /watch/video-slug
      video = await fetchVideoBySlug(parts[0]);
    }

    const title = video?.title ? `${video.title}${epLabel}` : SITE_NAME;
    const desc  = video?.desc  || `Watch ${title} online free on ${SITE_NAME}.`;
    const img   = video?.img   || DEFAULT_IMG;
    return respond(title, desc, img, 'video.other');
  }

  // ── BLOG LIST ──
  if(pathname==='/blog'){
    return respond(
      `Blog | ${SITE_NAME}`,
      'Drama reviews, episode recaps, top lists and more from រោងកុនគ្មានមនុស្ស.',
      DEFAULT_IMG
    );
  }

  // ── BLOG POST ──
  if(pathname.startsWith('/blog/')){
    const slug = pathname.replace('/blog/','');
    const post = await fetchBlogPost(slug);
    const title = post?.title ? `${post.title} | ${SITE_NAME}` : SITE_NAME;
    const desc  = post?.excerpt || `Read drama articles on ${SITE_NAME}.`;
    const img   = post?.cover  || DEFAULT_IMG;
    return respond(title, desc, img, 'article');
  }

  // ── FOR YOU, SEARCH etc — generic ──
  return respond(SITE_NAME,
    'Watch free Chinese Drama and Khmer dubbed series online.',
    DEFAULT_IMG
  );
}

export const config = {
  matcher: ['/', '/watch/:path*', '/blog', '/blog/:path*', '/for-you', '/search'],
};
