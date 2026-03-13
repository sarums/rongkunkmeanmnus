// ═══════════════════════════════════════════════════
//  ads.js — All advertising logic for RongKunKmeanMnus
//  To disable all ads: remove <script> tag in index.html
// ═══════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────
const AD_CONFIG = {
  publisherId : 'ca-pub-3940256099942544', // ← replace with real ID
  adSlot      : '6300978111',              // ← replace with real slot
  duration    : 10,   // total ad display seconds
  skipAfter   : 5,    // skip button appears after X seconds
  midrollEvery: 5,    // show mid-roll every X minutes
  minDuration : 5,    // minimum video duration (min) to show mid-roll
};

// ── HELPERS ─────────────────────────────────────────
// Parse "MM:SS" or "HH:MM:SS" → total seconds
function parseDuration(str){
  if(!str) return 0;
  const parts = str.trim().split(':').map(Number);
  if(parts.length === 2) return parts[0]*60 + parts[1];
  if(parts.length === 3) return parts[0]*3600 + parts[1]*60 + parts[2];
  return 0;
}

// Build mid-roll schedule based on video duration
// Returns array of milliseconds when mid-rolls should fire
function buildSchedule(durationStr){
  const totalSec = parseDuration(durationStr);
  const totalMin = totalSec / 60;
  const schedule = [];

  // Only add mid-rolls if video is long enough
  if(totalMin < AD_CONFIG.minDuration) return schedule;

  // Every X minutes → add a mid-roll
  const intervalMs = AD_CONFIG.midrollEvery * 60 * 1000;
  const totalMs    = totalSec * 1000;
  let   t          = intervalMs;

  while(t < totalMs - 30000){ // stop 30s before end
    schedule.push(t);
    t += intervalMs;
  }
  return schedule;
}

// ── MIDROLL SCHEDULER ────────────────────────────────
let _midrollTimers = [];

window.scheduleMidrolls = function(durationStr){
  // Clear any existing mid-roll timers
  clearMidrolls();

  const schedule = buildSchedule(durationStr);
  if(!schedule.length) return;

  console.log(`📺 Mid-roll schedule: ${schedule.map(t=>Math.round(t/60000)+'min').join(', ')}`);

  schedule.forEach((ms, i) => {
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
  // Pause-like effect — show overlay again
  showPreroll(()=>{
    // After ad — video continues automatically (iframe keeps playing)
    console.log(`✅ Mid-roll ${num}/${total} done`);
  }, `Mid-roll ${num}/${total}`);
}

// ── PRE-ROLL / MID-ROLL DISPLAY ──────────────────────
let _prerollTimer = null;

window.showPreroll = function(onDone, label){
  const overlay    = document.getElementById('preroll-overlay');
  const countdown  = document.getElementById('preroll-countdown');
  const skipBtn    = document.getElementById('preroll-skip-btn');
  const progress   = document.getElementById('preroll-progress');
  const adLabel    = document.getElementById('preroll-label');
  if(!overlay) return onDone();

  // Update label (pre-roll vs mid-roll)
  if(adLabel) adLabel.textContent = label || 'Advertisement';

  overlay.style.display = 'flex';
  skipBtn.style.display  = 'none';
  countdown.textContent  = `Skip in ${AD_CONFIG.skipAfter}s`;
  progress.style.transition = 'none';
  progress.style.width      = '0%';

  // Load AdSense
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
