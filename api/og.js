// Vercel Serverless Function — Per-video OG meta tags
// Handles both:
//   /watch/VIDEO_ID          → single video
//   /watch/PLAYLIST_ID/ep-N  → playlist episode

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc, collection, getDocs } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAnXxuc92620WOz_bVkovnUEQ_LL4YFPp8",
  authDomain: "streamhub-ce717.firebaseapp.com",
  projectId: "streamhub-ce717",
  storageBucket: "streamhub-ce717.firebasestorage.app",
  messagingSenderId: "223272731262",
  appId: "1:223272731262:web:d17866d4a12f610c864e2f"
};

const fireApp = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db = getFirestore(fireApp);

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function getThumb(v) {
  if (v.customThumb) return v.customThumb;
  if (v.platform === 'dailymotion' && v.videoId)
    return `https://www.dailymotion.com/thumbnail/video/${v.videoId}`;
  return null;
}

module.exports = async (req, res) => {
  const siteUrl    = 'https://rongkunkmeanmnus.vercel.app';
  const defaultImg = `${siteUrl}/assets/img/og-default.png`;

  // Parse query params from vercel.json rewrite
  // Playlist: ?pl=PLAYLIST_ID&ep=ep-2
  // Single:   ?id=VIDEO_ID
  const { id, pl, ep } = req.query;
  const epNum    = ep ? (parseInt((ep||'').replace('ep-',''))||1) : null;
  const isPlaylist = !!(pl && ep);
  const first    = isPlaylist ? pl : (id||'');
  const path     = isPlaylist
    ? `/watch/${pl}/${ep}`
    : (id ? `/watch/${id}` : '/');

  let title = 'RongKunKmeanMnus - Watch Videos Online';
  let desc  = 'Watch Chinese Drama, Thai Drama and more — free online.';
  let image = defaultImg;
  let pageUrl = `${siteUrl}${path}`;

  try {
    if (isPlaylist) {
      // It's a playlist URL: first = playlist ID
      const plSnap = await getDoc(doc(db, 'playlists', first));
      if (plSnap.exists()) {
        const pl    = plSnap.data();
        const vids  = pl.videos || [];
        const vidId = vids[epNum - 1]; // ep-2 → index 1

        title = `${pl.name} — Episode ${epNum}`;
        desc  = `Watch ${pl.name} Episode ${epNum} on RongKunKmeanMnus. ${pl.description||''}`.trim();

        // Use playlist thumbnail first
        if (pl.thumbnail) {
          image = pl.thumbnail;
        }

        // Try to get the specific episode thumbnail
        if (vidId) {
          const vSnap = await getDoc(doc(db, 'videos', vidId));
          if (vSnap.exists()) {
            const v = vSnap.data();
            const thumb = getThumb(v);
            if (thumb) image = thumb;
            if (v.title) title = `${v.title} — ${pl.name} EP${epNum}`;
          }
        }
      }
    } else if (first) {
      // It's a single video URL: first = video ID
      const vSnap = await getDoc(doc(db, 'videos', first));
      if (vSnap.exists()) {
        const v     = vSnap.data();
        title = v.title || title;
        desc  = v.description ? v.description : `Watch ${v.title} on RongKunKmeanMnus`;
        const thumb = getThumb(v);
        if (thumb) image = thumb;
      }
    }
  } catch(e) {
    console.error('OG function error:', e.message);
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(desc)}">
  <meta property="og:type"         content="video.other">
  <meta property="og:site_name"    content="RongKunKmeanMnus">
  <meta property="og:title"        content="${escHtml(title)}">
  <meta property="og:description"  content="${escHtml(desc)}">
  <meta property="og:image"        content="${escHtml(image)}">
  <meta property="og:image:width"  content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:url"          content="${escHtml(pageUrl)}">
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escHtml(title)}">
  <meta name="twitter:description" content="${escHtml(desc)}">
  <meta name="twitter:image"       content="${escHtml(image)}">
  <meta http-equiv="refresh" content="0;url=${escHtml(pageUrl)}">
  <script>window.location.href="${escHtml(pageUrl)}";</script>
</head>
<body><p>Loading <a href="${escHtml(pageUrl)}">${escHtml(title)}</a>...</p></body>
</html>`);
};
