// ═══════════════════════════════════════════════════
//  ads.js — All advertising logic for RongKunKmeanMnus
//  To disable all ads: remove <script> tag in index.html
// ═══════════════════════════════════════════════════

// ── CONFIG ──────────────────────────────────────────
const AD_CONFIG = {
  publisherId:   'ca-pub-3940256099942544',  // ← replace with real ID
  adSlot:        '6300978111',               // ← replace with real slot
  duration:      10,   // total ad seconds
  skipAfter:     5,    // skip button appears after X seconds
};

// ── PRE-ROLL AD ──────────────────────────────────────
let _prerollTimer = null;

window.showPreroll = function(onDone){
  const overlay = document.getElementById('preroll-overlay');
  const countdown = document.getElementById('preroll-countdown');
  const skipBtn = document.getElementById('preroll-skip-btn');
  const progress = document.getElementById('preroll-progress');
  if(!overlay) return onDone();

  overlay.style.display = 'flex';
  skipBtn.style.display = 'none';
  countdown.textContent = `Skip in ${AD_CONFIG.skipAfter}s`;
  progress.style.transition = 'none';
  progress.style.width = '0%';

  // Load AdSense
  try{ (window.adsbygoogle = window.adsbygoogle || []).push({}); }catch(e){}

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
