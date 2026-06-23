const PROJECT_ID  = 'streamhub-ce717';
const FIRESTORE   = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;
const SITE_URL    = 'https://www.rongkunkmeanmnus.com';
const SITE_NAME   = 'រោងកុនគ្មានមនុស្ស';
const DEFAULT_IMG = `${SITE_URL}/assets/img/og-default.png`;

const BOT_RE = /facebookexternalhit|facebot|twitterbot|telegrambot|whatsapp|linkedinbot|discordbot|slackbot|googlebot|bingbot|yandexbot|applebot|pinterest/i;

function isBot(req){
  return BOT_RE.test(req.headers.get('user-agent')||'');
}

function slugify(s){
  return (s||'').toLowerCase().replace(/\s+/g,'-').replace(/[^a-z0-9-]/g,'').replace(/-+/g,'-').replace(/^-+|-+$/g,'').slice(0,80);
}

function esc(s){
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function buildHtml(title, desc, img, url, type){
  const t=esc(title||SITE_NAME), d=esc((desc||'').replace(/<[^>]*>/g,'').slice(0,200)||'Watch free drama online.'), i=img||DEFAULT_IMG, u=url||SITE_URL;
  return `<!DOCTYPE html><html lang="km"><head><meta charset="UTF-8">
<title>${t}</title>
<meta name="description" content="${d}">
<meta property="og:type" content="${type||'website'}">
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
</head><body><h1>${t}</h1><p>${d}</p><a href="${u}">Watch on ${SITE_NAME}</a></body></html>`;
}

async function getVideo(id){
  try{
    const r=await fetch(`${FIRESTORE}/videos/${id}`);
    if(!r.ok) return null;
    const d=await r.json(), f=d.fields||{}, g=k=>f[k]?.stringValue||'';
    const platform=g('platform')||g('source'), vid=g('videoId');
    let img=g('customThumb')||g('thumbnail');
    if(!img){
      if(platform==='dailymotion') img=`https://www.dailymotion.com/thumbnail/video/${vid}`;
      else if(platform==='youtube') img=`https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      else if(platform==='vimeo') img=`https://vumbnail.com/${vid}.jpg`;
    }
    return {title:g('title'), desc:g('description'), img};
  }catch(e){return null;}
}

async function getPlaylists(){
  try{
    const r=await fetch(`${FIRESTORE}/playlists`);
    if(!r.ok) return [];
    const d=await r.json();
    return (d.documents||[]).map(doc=>({
      id   :doc.name.split('/').pop(),
      name :doc.fields?.name?.stringValue||'',
      videos:(doc.fields?.videos?.arrayValue?.values||[]).map(v=>v.stringValue),
    }));
  }catch(e){return [];}
}

export default async function middleware(req){
  if(!isBot(req)) return;

  const {pathname}=new URL(req.url);
  const pageUrl=SITE_URL+pathname;
  const ok=(t,d,i,type)=>new Response(buildHtml(t,d,i,pageUrl,type),{headers:{'Content-Type':'text/html;charset=utf-8','Cache-Control':'public,max-age=3600'}});

  // /watch/PLAYLIST_ID_OR_SLUG/ep-N
  if(pathname.startsWith('/watch/')){
    const parts=pathname.slice(7).split('/');
    let video=null, epLabel='';

    if(parts.length>=2 && /^ep-\d+$/.test(parts[1])){
      const epNum=parseInt(parts[1].replace('ep-',''))||1;
      epLabel=` — Episode ${epNum}`;
      const pls=await getPlaylists();

      // Match by BOTH raw ID and slugified name
      const pl=pls.find(p=>{
        const s=slugify(p.name);
        return p.id===parts[0] || (s.length>=3 && s===parts[0]);
      });

      if(pl){
        const vidId=(pl.videos||[])[epNum-1];
        if(vidId) video=await getVideo(vidId);
      }
    } else if(parts.length===1){
      // Try as direct video ID first (fastest)
      video=await getVideo(parts[0]);
      // If not found try slug search
      if(!video){
        try{
          const r=await fetch(`${FIRESTORE}/videos?pageSize=300`);
          if(r.ok){
            const d=await r.json();
            const doc=(d.documents||[]).find(doc=>{
              const id=doc.name.split('/').pop();
              const title=doc.fields?.title?.stringValue||'';
              const s=slugify(title);
              return (s.length>=3&&s===parts[0])||id===parts[0];
            });
            if(doc) video=await getVideo(doc.name.split('/').pop());
          }
        }catch(e){}
      }
    }

    return ok(
      video?.title?`${video.title}${epLabel}`:SITE_NAME,
      video?.desc||`Watch ${video?.title||'drama'} free on ${SITE_NAME}.`,
      video?.img||DEFAULT_IMG,
      'video.other'
    );
  }

  // /blog/slug
  if(pathname.startsWith('/blog/')){
    const slug=pathname.replace('/blog/','');
    try{
      const r=await fetch(`${FIRESTORE}/blog_posts?pageSize=200`);
      if(r.ok){
        const d=await r.json();
        const doc=(d.documents||[]).find(doc=>{
          const f=doc.fields||{};
          return f.slug?.stringValue===slug||doc.name.split('/').pop()===slug;
        });
        if(doc){
          const f=doc.fields||{};
          return ok(
            `${f.title?.stringValue||''} | ${SITE_NAME}`,
            f.excerpt?.stringValue||'',
            f.cover?.stringValue||DEFAULT_IMG,
            'article'
          );
        }
      }
    }catch(e){}
    return ok(`Blog | ${SITE_NAME}`,'Read drama articles.',DEFAULT_IMG);
  }

  // /drama/slug — playlist detail page
  if(pathname.startsWith('/drama/')){
    const slug = pathname.replace('/drama/','');
    const pls  = await getPlaylists();
    const pl   = pls.find(p=>{
      const s = slugify(p.name);
      return p.id===slug||(s.length>=3&&s===slug);
    });
    if(pl){
      // Get thumbnail from first video
      const firstVidId = (pl.videos||[])[0];
      let img = DEFAULT_IMG;
      if(firstVidId){
        const v = await getVideo(firstVidId);
        if(v?.img) img = v.img;
      }
      return ok(
        `${pl.name} | ${SITE_NAME}`,
        `Watch all ${(pl.videos||[]).length} episodes of ${pl.name} online free on ${SITE_NAME}.`,
        img,
        'video.other'
      );
    }
  }

  // /blog
  if(pathname==='/blog'){
    return ok(`Blog | ${SITE_NAME}`,'Drama reviews and more.',DEFAULT_IMG);
  }

  // home
  return ok(`${SITE_NAME} - Watch Free Drama Online`,'Watch Chinese Drama free.',DEFAULT_IMG);
}

export const config = {
  matcher:['/watch/:path*','/blog','/blog/:path*','/drama/:path*','/'],
};
