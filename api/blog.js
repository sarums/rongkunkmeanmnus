// Vercel Edge Function — handles /blog/* for both bots and users
// Bots get proper OG meta tags + article content (for Google indexing)
// Real users get the normal SPA (index.html)

const FIRESTORE = `https://firestore.googleapis.com/v1/projects/streamhub-ce717/databases/(default)/documents`;
const SITE_URL  = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME = 'រោងកុនគ្មានមនុស្ស';
const IMG       = `${SITE_URL}/assets/img/og-default.png`;

const BOTS = /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|googlebot|bingbot|yandexbot|applebot|pinterest|linkedinbot|discordbot/i;

function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

async function fetchFS(path, ms=5000){
  try{
    const r = await fetch(`${FIRESTORE}/${path}`, {signal: AbortSignal.timeout(ms)});
    return r.ok ? await r.json() : null;
  }catch(e){ return null; }
}

export default async function handler(req){
  const url  = new URL(req.url);
  const path = url.pathname;
  const ua   = req.headers.get('user-agent')||'';
  const bot  = BOTS.test(ua);

  // Real users → serve the SPA directly
  // We can't fetch index.html from same domain (circular), so serve it from static path
  if(!bot){
    // Fetch index.html directly from Vercel static files
    const spaRes = await fetch(new URL('/', req.url).href, {
      headers: { 'x-bypass-middleware': '1' }
    });
    if(spaRes.ok){
      const html = await spaRes.text();
      return new Response(html, {
        headers: {
          'Content-Type': 'text/html;charset=utf-8',
          'Cache-Control': 'no-store',
        }
      });
    }
    // Fallback: redirect to homepage
    return Response.redirect(SITE_URL, 302);
  }

  // Bots → serve full article content for Google indexing
  let title   = `Blog | ${SITE_NAME}`;
  let relatedVideoData = null;
  let desc    = 'Drama reviews, episode recaps and more from រោងកុនគ្មានមនុស្ស.';
  let img     = IMG;
  let content = '';
  let category= '';
  const pageUrl = SITE_URL + path;

  if(path.startsWith('/blog/') && path.length > 6){
    const parts  = path.replace('/blog/','').split('/');
    const slug   = parts[0];
    const epNum  = parts[1] ? parseInt(parts[1])||1 : 1;

    // Fetch all blog posts and find by slug or ID
    const res = await fetchFS('blog_posts?pageSize=200');
    const doc = (res?.documents||[]).find(d=>{
      const f = d.fields||{};
      return (f.slug?.stringValue||d.name.split('/').pop()) === slug;
    });

    if(doc?.fields){
      const f = doc.fields;
      const g = k => f[k]?.stringValue||'';
      const baseTitle = g('title')||'';
      title = baseTitle
        ? (epNum>1 ? `${baseTitle} — Episode ${epNum} | ${SITE_NAME}` : `${baseTitle} | ${SITE_NAME}`)
        : title;
      desc     = g('excerpt') || desc;
      img      = g('cover')   || IMG;
      category = g('category')|| '';
      content  = (g('content')||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();

      // Get episode-specific video for thumbnail
      // If epNum > 1, find the playlist and get that specific episode
      const relVids = f.relatedVideos?.arrayValue?.values||[];
      let targetVidId = relVids.length>0 ? relVids[0].stringValue : null;

      // If specific episode requested, find playlist and get correct episode
      if(epNum > 1 && targetVidId){
        // Get playlist containing this video
        const plsData = await fetchFS('playlists');
        for(const plDoc of (plsData?.documents||[])){
          const pf   = plDoc.fields||{};
          const vids = (pf.videos?.arrayValue?.values||[]).map(v=>v.stringValue);
          if(vids.includes(targetVidId)){
            // Get the correct episode
            const epVidId = vids[epNum-1];
            if(epVidId) targetVidId = epVidId;
            break;
          }
        }
      }

      if(targetVidId){
        const vDoc = await fetchFS(`videos/${targetVidId}`);
        if(vDoc?.fields){
          const vf = vDoc.fields;
          const vg = k=>vf[k]?.stringValue||'';
          const platform = vg('platform')||vg('source');
          const vid = vg('videoId');
          const embedUrl = platform==='dailymotion'
            ? `https://www.dailymotion.com/embed/video/${vid}`
            : platform==='youtube'
            ? `https://www.youtube.com/embed/${vid}`
            : '';
          const thumb = vg('customThumb')||vg('thumbnail')||
            (platform==='dailymotion'?`https://www.dailymotion.com/thumbnail/video/${vid}`:
             platform==='youtube'?`https://img.youtube.com/vi/${vid}/hqdefault.jpg`:IMG);
          if(!img||img===IMG) img = thumb;
          relatedVideoData = {
            title    : vg('title'),
            embedUrl : embedUrl,
            duration : vg('duration'),
            thumbnail: thumb,
          };
        }
      }
    }
  }

  const t = esc(title);
  const d = esc(desc.slice(0,200));
  const u = pageUrl;

  // Build schema markup
  let videoSchema = '';
  if(relatedVideoData){
    const rv = relatedVideoData;
    videoSchema = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "VideoObject",
      "name": rv.title||title,
      "description": desc,
      "thumbnailUrl": img,
      "uploadDate": new Date().toISOString(),
      "embedUrl": rv.embedUrl||'',
      "duration": rv.duration||'',
      "publisher": {
        "@type": "Organization",
        "name": SITE_NAME,
        "url": SITE_URL
      }
    });
  }

  // Article schema
  const articleSchema = JSON.stringify({
    "@context": "https://schema.org",
    "@type": "Article",
    "headline": title,
    "description": desc,
    "image": img,
    "url": u,
    "publisher": {
      "@type": "Organization",
      "name": SITE_NAME,
      "url": SITE_URL
    }
  });

  const html = `<!DOCTYPE html>
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
<meta property="og:url" content="${u}">
<meta property="og:site_name" content="${SITE_NAME}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${t}">
<meta name="twitter:description" content="${d}">
<meta name="twitter:image" content="${img}">
<link rel="canonical" href="${u}">
<script type="application/ld+json">${articleSchema}</script>
${videoSchema?`<script type="application/ld+json">${videoSchema}</script>`:''}
<style>
  body{font-family:sans-serif;max-width:800px;margin:0 auto;padding:20px;background:#0a0a0a;color:#e4e4e7;}
  h1{color:#f27d26;font-size:1.8rem;line-height:1.3;}
  h2{color:#e4e4e7;font-size:1.3rem;margin-top:1.5rem;}
  p{color:#999;line-height:1.8;}
  a{color:#f27d26;}
  .cat{background:#f27d26;color:#000;padding:3px 10px;border-radius:4px;font-size:.8rem;font-weight:700;}
  img{max-width:100%;border-radius:8px;margin:16px 0;}
</style>
</head>
<body>
<p><a href="${SITE_URL}">${SITE_NAME}</a> — Free Khmer Dubbed Drama</p>
${category?`<span class="cat">${esc(category)}</span>`:''}
<h1>${t}</h1>
${img!==IMG?`<img src="${img}" alt="${t}" width="800" height="450">`:''}
<p><strong>${d}</strong></p>
${content?`<article><p>${esc(content).replace(/\n/g,'</p><p>')}</p></article>`:''}
<hr>
<p>Watch free Chinese Drama and Khmer dubbed series on <a href="${SITE_URL}">${SITE_NAME}</a>. 
Stream the best drama online for free — no subscription, no account needed.</p>
<p><a href="${SITE_URL}/blog">← More Articles</a></p>
</body>
</html>`;

  return new Response(html,{
    headers:{
      'Content-Type':'text/html;charset=utf-8',
      'Cache-Control':'public,max-age=3600',
    }
  });
}

export const config = { runtime: 'edge' };
