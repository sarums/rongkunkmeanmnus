// ═══════════════════════════════════════════════════
//  ads.js — All advertising logic for RongKunKmeanMnus
//  Controlled from Admin Dashboard → Ads Settings
// ═══════════════════════════════════════════════════

// ── DEFAULT CONFIG (overridden by Firestore) ─────────
let AD_CONFIG = window.AD_CONFIG = {
  enabled      : 0,  // OFF by default — turn on via Admin → Ads Settings
  preroll      : 1,
  midroll      : 1,
  skipAfter    : 5,
  duration     : 10,
  midrollEvery : 5,
  minDuration  : 5,
  publisherId  : 'ca-pub-6821890542678085', // your real AdSense Publisher ID
  adSlot       : '', // set from Admin → Ads Settings
  imageUrl     : '', // set from Admin → Ads Settings
  clickUrl     : '', // where user goes when clicking the ad
  videoUrl     : '', // MP4 video URL for video ads
  overlayBanner     : 0,  // ON/OFF
  overlayDelay      : 5,  // seconds after video starts
  overlayTitle      : '', // product name
  overlayDesc       : '', // short description
  overlayImage      : '', // small image
  overlayClickUrl   : '', // click URL
};

// ── LOAD CONFIG FROM FIRESTORE ───────────────────────
window.loadAdsConfig = async function(){
  try{
    // Use Firebase already initialized in app.js
    const { getFirestore, doc, getDoc } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
    const { getApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
    const db   = getFirestore(getApp());
    const snap = await getDoc(doc(db,'settings','ads'));
    if(snap.exists()){
      AD_CONFIG = { ...AD_CONFIG, ...snap.data() };
      window.AD_CONFIG = AD_CONFIG; // expose globally for app.js
      console.log('✅ Ads config loaded from Firestore');
    }
  } catch(e){
    console.log('ℹ️ Using default ads config');
  }
};

// ── HELPERS ─────────────────────────────────────────
function parseDuration(str){
  if(!str) return 0;
  const parts = str.trim().split(':').map(Number);
  if(parts.length === 2) return parts[0]*60 + parts[1];
  if(parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return 0;
}

function buildSchedule(durationStr){
  const totalSec = parseDuration(durationStr);
  const totalMin = totalSec / 60;
  const schedule = [];
  if(totalMin < AD_CONFIG.minDuration) return schedule;
  const intervalMs = AD_CONFIG.midrollEvery * 60 * 1000;
  const totalMs    = totalSec * 1000;
  let t = intervalMs;
  while(t < totalMs - 30000){
    schedule.push(t);
    t += intervalMs;
  }
  return schedule;
}

// ── MIDROLL SCHEDULER ────────────────────────────────
let _midrollTimers = [];

window.scheduleMidrolls = function(durationStr){
  clearMidrolls();
  if(!AD_CONFIG.enabled || !AD_CONFIG.midroll) return;
  const schedule = buildSchedule(durationStr);
  if(!schedule.length) return;
  schedule.forEach((ms, i)=>{
    const t = setTimeout(()=>{
      showMidroll(i+1, schedule.length);
    }, ms);
    _midrollTimers.push(t);
  });
};

window.clearMidrolls = function(){
  _midrollTimers.forEach(t => clearTimeout(t));
  _midrollTimers = [];
};

function showMidroll(num, total){
  showPreroll(()=>{}, `Mid-roll ${num}/${total}`);
}

// ── PRE-ROLL / MID-ROLL DISPLAY ──────────────────────
let _prerollTimer = null;

window.showPreroll = function(onDone, label){
  if(!AD_CONFIG.enabled || !AD_CONFIG.preroll){
    return onDone();
  }
  const overlay   = document.getElementById('preroll-overlay');
  const countdown = document.getElementById('preroll-countdown');
  const skipBtn   = document.getElementById('preroll-skip-btn');
  const progress  = document.getElementById('preroll-progress');
  const adLabel   = document.getElementById('preroll-label');
  const adImg     = document.getElementById('preroll-ad-image');
  if(!overlay) return onDone();

  // Update label
  if(adLabel) adLabel.textContent = label || 'Advertisement';

  // Video ad or image ad
  const adVideo = document.getElementById('preroll-ad-video');
  if(AD_CONFIG.videoUrl && adVideo){
    // Video ad — hide image, show video
    if(adImg) adImg.style.display = 'none';
    adVideo.style.display = 'block';
    adVideo.src = AD_CONFIG.videoUrl;
    adVideo.poster = AD_CONFIG.imageUrl || '';
    adVideo.muted = true;
    adVideo.play().catch(()=>{});
  } else if(AD_CONFIG.imageUrl && adImg){
    // Image ad
    if(adVideo) adVideo.style.display = 'none';
    adImg.src = AD_CONFIG.imageUrl;
    adImg.style.display = 'block';
  }

  // Make ad image clickable
  if(adImg){
    adImg.style.cursor = AD_CONFIG.clickUrl ? 'pointer' : 'default';
    adImg.onclick = ()=>{
      if(AD_CONFIG.clickUrl){
        window.open(AD_CONFIG.clickUrl, '_blank', 'noopener');
      }
    };
  }

  overlay.classList.add('active');
  skipBtn.style.display = 'none';
  countdown.textContent  = `Skip in ${AD_CONFIG.skipAfter}s`;
  progress.style.transition = 'none';
  progress.style.width      = '0%';

  // Load AdSense if real IDs configured
  try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch(e){}

  let elapsed = 0;
  setTimeout(()=>{
    progress.style.transition = `width ${AD_CONFIG.duration}s linear`;
    progress.style.width = '100%';
  }, 100);

  _prerollTimer = setInterval(()=>{
    elapsed++;
    const remaining = AD_CONFIG.skipAfter - elapsed;
    if(elapsed < AD_CONFIG.skipAfter){
      countdown.textContent = `Skip in ${remaining}s`;
    } else if(elapsed === AD_CONFIG.skipAfter){
      skipBtn.style.display = '';
      countdown.textContent = '';
    }
    if(elapsed >= AD_CONFIG.duration){
      clearInterval(_prerollTimer);
      hidePreroll();
      onDone();
    }
  }, 1000);

  overlay._onDone = onDone;

  // Click on overlay (not skip btn) goes to ad URL
  overlay.onclick = (e)=>{
    if(e.target === skipBtn || skipBtn.contains(e.target)) return;
    if(AD_CONFIG.clickUrl){
      window.open(AD_CONFIG.clickUrl, '_blank', 'noopener');
    }
  };
};

window.hidePreroll = function(){
  const overlay = document.getElementById('preroll-overlay');
  if(overlay) overlay.classList.remove('active');
  clearInterval(_prerollTimer);
  // Stop video if playing
  const adVideo = document.getElementById('preroll-ad-video');
  if(adVideo){ adVideo.pause(); adVideo.src=''; }
};

window.skipPreroll = function(){
  const overlay = document.getElementById('preroll-overlay');
  const cb = overlay?._onDone;
  hidePreroll();
  if(cb) cb();
};

// ── IN-VIDEO OVERLAY BANNER ─────────────────────────
let _overlayTimer = null;

window.showOverlayBanner = function(){
  if(!AD_CONFIG.enabled || !AD_CONFIG.overlayBanner) return;
  const banner = document.getElementById('overlay-banner');
  if(!banner) return;

  // Populate content
  const img   = document.getElementById('overlay-banner-img');
  const title = document.getElementById('overlay-banner-title');
  const desc  = document.getElementById('overlay-banner-desc');
  const btn   = document.getElementById('overlay-banner-btn');

  if(img){
    img.style.display = 'none';
    if(AD_CONFIG.overlayImage){
      // Set src directly — let browser handle CORS
      img.crossOrigin = 'anonymous';
      img.onload  = ()=>{ img.style.display = 'block'; };
      img.onerror = ()=>{ 
        // Try without crossOrigin if CORS fails
        img.removeAttribute('crossorigin');
        img.onload  = ()=>{ img.style.display = 'block'; };
        img.onerror = ()=>{ img.style.display = 'none'; };
        img.src = AD_CONFIG.overlayImage + '?' + Date.now();
      };
      img.src = AD_CONFIG.overlayImage;
    }
  }
  if(title) title.textContent = AD_CONFIG.overlayTitle || 'Special Offer';
  if(desc)  desc.textContent  = AD_CONFIG.overlayDesc  || '';
  if(btn)   btn.href = AD_CONFIG.overlayClickUrl || '#';

  // Show after delay with smooth fade in
  _overlayTimer = setTimeout(()=>{
    banner.style.display = 'block'; // outer wrapper is block, inner card is flex
    requestAnimationFrame(()=>{
      requestAnimationFrame(()=>{
        banner.style.opacity = '1';
      });
    });
  }, (AD_CONFIG.overlayDelay || 5) * 1000);
};

window.closeOverlayBanner = function(){
  const banner = document.getElementById('overlay-banner');
  if(!banner) return;
  banner.style.opacity = '0';
  setTimeout(()=>{ banner.style.display='none'; }, 300);
  clearTimeout(_overlayTimer);
};

window.clearOverlayBanner = function(){
  clearTimeout(_overlayTimer);
  const banner = document.getElementById('overlay-banner');
  if(banner){ 
    banner.style.opacity='0'; 
    banner.style.display='none';
  }
  // Reset image
  const img = document.getElementById('overlay-banner-img');
  if(img){ img.src=''; img.style.display='none'; }
};

// Config loaded on demand in app.js before each ad
