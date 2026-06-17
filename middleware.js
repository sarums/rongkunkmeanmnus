// Vercel Edge Middleware
// Detects social media crawlers (Facebook, Telegram, WhatsApp, Twitter, etc.)
// and serves them a page with correct OG meta tags for /watch/ URLs.
// Real users pass through normally to the SPA.

const PROJECT_ID = 'streamhub-ce717';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

const BOT_PATTERNS = [
  'facebookexternalhit',
  'Facebot',
  'Twitterbot',
  'TelegramBot',
  'WhatsApp',
  'LinkedInBot',
  'Discordbot',
  'Slackbot',
  'Pinterest',
  'Googlebot',
  'bingbot',
];

export default async function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  const isBot = BOT_PATTERNS.some(b => ua.toLowerCase().includes(b.toLowerCase()));

  if (!isBot) return; // let real users through to the normal SPA

  const url = new URL(req.url);
  const path = url.pathname;

  if (!path.startsWith('/watch/')) return; // only intercept watch pages

  const html = await buildOgHtml(path, url.origin);

  return new Response(html, {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' },
  });
}

async function buildOgHtml(path, origin) {
  const siteUrl = 'https://www.rongkunkmeanmnus.com';
  const defaultImg = `${siteUrl}/assets/img/og-default.png`;
  const siteName = 'រោងកុនគ្មានមនុស្ស';

  let title = siteName;
  let desc = 'Watch free Chinese Drama and Khmer dubbed series online.';
  let img = defaultImg;
  const pageUrl = siteUrl + path;

  try {
    const parts = path.slice(7).split('/'); // remove '/watch/'
    let videoId = null;

    if (parts.length >= 2 && /^ep-\d+$/.test(parts[1])) {
      // /watch/playlist-slug/ep-N
      const epNum = parseInt(parts[1].replace('ep-', '')) || 1;
      const plRes = await fetch(`${FIRESTORE_BASE}/playlists`);
      if (plRes.ok) {
        const plData = await plRes.json();
        const docs = plData.documents || [];
        for (const plDoc of docs) {
          const pf = plDoc.fields || {};
          const plName = pf.name?.stringValue || '';
          const plSlug = slugify(plName);
          const idForSlug = plDoc.name.split('/').pop();
          const matchSlug = plSlug.length >= 3 ? plSlug : idForSlug;
          if (matchSlug === parts[0]) {
            const videoArr = (pf.videos?.arrayValue?.values || []).map(v => v.stringValue);
            videoId = videoArr[epNum - 1] || null;
            break;
          }
        }
      }
    } else if (parts.length === 1) {
      // /watch/video-slug — search videos collection for matching slug or id
      // Firestore REST doesn't support arbitrary queries easily without indexes,
      // so fetch a reasonable page and match by slug/id.
      const vRes = await fetch(`${FIRESTORE_BASE}/videos?pageSize=300`);
      if (vRes.ok) {
        const vData = await vRes.json();
        const docs = vData.documents || [];
        for (const vDoc of docs) {
          const id = vDoc.name.split('/').pop();
          const f = vDoc.fields || {};
          const t = f.title?.stringValue || '';
          const slug = slugify(t);
          const matchSlug = slug.length >= 3 ? slug : id;
          if (matchSlug === parts[0] || id === parts[0]) {
            videoId = id;
            break;
          }
        }
      }
    }

    if (videoId) {
      const vRes = await fetch(`${FIRESTORE_BASE}/videos/${videoId}`);
      if (vRes.ok) {
        const vDoc = await vRes.json();
        const f = vDoc.fields || {};
        const get = (key) => f[key]?.stringValue || '';

        title = get('title') || siteName;
        const rawDesc = get('description');
        desc = (rawDesc || `Watch ${title} online free on ${siteName}`)
          .replace(/<[^>]*>/g, '').slice(0, 200);

        const customThumb = get('customThumb') || get('thumbnail');
        const platform = get('platform') || get('source');
        const vid = get('videoId');

        if (customThumb) img = customThumb;
        else if (platform === 'dailymotion') img = `https://www.dailymotion.com/thumbnail/video/${vid}`;
        else if (platform === 'youtube') img = `https://img.youtube.com/vi/${vid}/hqdefault.jpg`;
      }
    }
  } catch (e) {
    // fall back to defaults on any error
  }

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>${escHtml(title)}</title>
<meta name="description" content="${escHtml(desc)}">
<meta property="og:type" content="video.other">
<meta property="og:title" content="${escHtml(title)}">
<meta property="og:description" content="${escHtml(desc)}">
<meta property="og:image" content="${img}">
<meta property="og:image:width" content="1280">
<meta property="og:image:height" content="720">
<meta property="og:url" content="${pageUrl}">
<meta property="og:site_name" content="${siteName}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escHtml(title)}">
<meta name="twitter:description" content="${escHtml(desc)}">
<meta name="twitter:image" content="${img}">
</head>
<body>
<h1>${escHtml(title)}</h1>
<p>${escHtml(desc)}</p>
<a href="${pageUrl}">Watch now</a>
</body>
</html>`;
}

function escHtml(s) {
  return (s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(s) {
  return (s || '')
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}

export const config = {
  matcher: '/watch/:path*',
};
