// ═══════════════════════════════════════════════════
//  ads.js — All advertising logic for RongKunKmeanMnus
//  Controlled from Admin Dashboard → Ads Settings
// ═══════════════════════════════════════════════════

// ── DEFAULT CONFIG (overridden by Firestore) ─────────
let AD_CONFIG = {
  enabled      : 1,
  preroll      : 1,
  midroll      : 1,
  skipAfter    : 5,
  duration     : 10,
  midrollEvery : 5,
  minDuration  : 5,
  publisherId  : '', // set from Admin → Ads Settings
  adSlot       : '', // set from Admin → Ads Settings
  imageUrl     : '', // set from Admin → Ads Settings
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

  // Update ad image from config
  if(adImg && AD_CONFIG.imageUrl){
    adImg.src = AD_CONFIG.imageUrl;
    adImg.style.display = '';
  }

  overlay.style.display = 'flex';
  skipBtn.style.display  = 'none';
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
};

window.hidePreroll = function(){
  const overlay = document.getElementById('preroll-overlay');
  if(overlay) overlay.style.display = 'none';
  clearInterval(_prerollTimer);
};

window.skipPreroll = function(){
  const overlay = document.getElementById('preroll-overlay');
  const cb = overlay?._onDone;
  hidePreroll();
  if(cb) cb();
};

// Load config on startup
window.loadAdsConfig();
