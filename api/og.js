// Vercel Edge Function — /api/og
// Returns HTML with proper OG meta tags for Facebook/Telegram link previews.
// Uses Firestore REST API (no SDK needed — works reliably in Edge Runtime).
// Called as: /api/og?id=VIDEO_ID

const PROJECT_ID = 'streamhub-ce717';
const FIRESTORE_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/(default)/documents`;

export default async function handler(req) {
  const url = new URL(req.url);
  const id  = url.searchParams.get('id');
  const siteUrl   = 'https://www.rongkunkmeanmnus.com';
  const defaultImg = `${siteUrl}/assets/img/og-default.png`;
  const siteName  = 'រោងកុនគ្មានមនុស្ស';

  let title   = siteName;
  let desc    = 'Watch free Chinese Drama and Khmer dubbed series online.';
  let img     = defaultImg;
  let pageUrl = siteUrl;

  try {
    if (id) {
      // Fetch the video document
      const vRes = await fetch(`${FIRESTORE_BASE}/videos/${id}`);
      if (vRes.ok) {
        const vDoc = await vRes.json();
        const f = vDoc.fields || {};

        const get = (key) => f[key]?.stringValue || '';
        const getInt = (key) => parseInt(f[key]?.integerValue || f[key]?.doubleValue || '0') || 0;

        title = get('title') || siteName;
        const rawDesc = get('description');
        desc = (rawDesc || `Watch ${title} online free on ${siteName}`)
          .replace(/<[^>]*>/g, '').slice(0, 200);

        // Thumbnail
        const customThumb = get('customThumb') || get('thumbnail');
        const platform = get('platform') || get('source');
        const videoId  = get('videoId');

        if (customThumb) img = customThumb;
        else if (platform === 'dailymotion') img = `https://www.dailymotion.com/thumbnail/video/${videoId}`;
        else if (platform === 'youtube')     img = `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;

        // Build the real watch URL — check if video belongs to a playlist
        const titleSlug = slugify(title);
        let watchSlug = titleSlug.length >= 3 ? titleSlug : id;
        pageUrl = `${siteUrl}/watch/${watchSlug}`;

        // Search playlists for this video
        const plRes = await fetch(`${FIRESTORE_BASE}/playlists`);
        if (plRes.ok) {
          const plData = await plRes.json();
          const docs = plData.documents || [];
          for (const plDoc of docs) {
            const pf = plDoc.fields || {};
            const videoArr = (pf.videos?.arrayValue?.values || []).map(v => v.stringValue);
            const idx = videoArr.indexOf(id);
            if (idx !== -1) {
              const plName = pf.name?.stringValue || '';
              const plNameSlug = slugify(plName);
              const plSlug = plNameSlug.length >= 3 ? plNameSlug : plDoc.name.split('/').pop();
              pageUrl = `${siteUrl}/watch/${plSlug}/ep-${idx + 1}`;
              break;
            }
          }
        }
      }
    }
  } catch (e) {
    // On any error, fall back to defaults defined above
  }

  const html = `<!DOCTYPE html>
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
<meta http-equiv="refresh" content="0;url=${pageUrl}">
</head>
<body>
<p>Redirecting to <a href="${pageUrl}">${escHtml(title)}</a>...</p>
</body>
</html>`;

  return new Response(html, {
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
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

export const config = { runtime: 'edge' };
