// Vercel Serverless Function — Per-video OG meta tags
// URL: /api/og?id=VIDEO_ID
// Called by vercel.json rewrite for /watch/* routes

const { initializeApp, getApps } = require('firebase/app');
const { getFirestore, doc, getDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAnXxuc92620WOz_bVkovnUEQ_LL4YFPp8",
  authDomain: "streamhub-ce717.firebaseapp.com",
  projectId: "streamhub-ce717",
  storageBucket: "streamhub-ce717.firebasestorage.app",
  messagingSenderId: "223272731262",
  appId: "1:223272731262:web:d17866d4a12f610c864e2f"
};

// Init Firebase once
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

module.exports = async (req, res) => {
  const { id } = req.query;
  const siteUrl = 'https://rongkunkmeanmnus.vercel.app';
  const defaultImg = `${siteUrl}/assets/img/og-default.png`;

  let title = 'RongKunKmeanMnus - Watch Videos Online';
  let desc  = 'Watch Chinese Drama, Thai Drama and more — free online.';
  let image = defaultImg;
  let url   = siteUrl;

  if (id) {
    try {
      const snap = await getDoc(doc(db, 'videos', id));
      if (snap.exists()) {
        const v = snap.data();
        title = v.title || title;
        desc  = v.description || `Watch ${v.title} on RongKunKmeanMnus`;
        url   = `${siteUrl}/watch/${id}`;

        // Use custom thumbnail or Dailymotion auto thumb
        if (v.customThumb) {
          image = v.customThumb;
        } else if (v.platform === 'dailymotion' && v.videoId) {
          image = `https://www.dailymotion.com/thumbnail/video/${v.videoId}`;
        }
      }
    } catch(e) {
      console.error('Firestore error:', e.message);
    }
  }

  // Return HTML with correct OG tags + redirect to SPA
  res.setHeader('Content-Type', 'text/html');
  res.setHeader('Cache-Control', 's-maxage=3600'); // cache 1hr
  res.send(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>${escHtml(title)}</title>
  <meta name="description" content="${escHtml(desc)}">

  <!-- Open Graph -->
  <meta property="og:type"        content="video.other">
  <meta property="og:site_name"   content="RongKunKmeanMnus">
  <meta property="og:title"       content="${escHtml(title)}">
  <meta property="og:description" content="${escHtml(desc)}">
  <meta property="og:image"       content="${image}">
  <meta property="og:image:width"  content="1280">
  <meta property="og:image:height" content="720">
  <meta property="og:url"         content="${url}">

  <!-- Twitter Card -->
  <meta name="twitter:card"        content="summary_large_image">
  <meta name="twitter:title"       content="${escHtml(title)}">
  <meta name="twitter:description" content="${escHtml(desc)}">
  <meta name="twitter:image"       content="${image}">

  <!-- Redirect real users to SPA immediately -->
  <meta http-equiv="refresh" content="0;url=${url}">
  <script>window.location.href="${url}";</script>
</head>
<body>
  <p>Loading <a href="${url}">${escHtml(title)}</a>...</p>
</body>
</html>`);
};

function escHtml(s) {
  return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
