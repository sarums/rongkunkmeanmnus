// ═══════════════════════════════════════════════════
// § HISTORY & NAVIGATION (FIXED)
// ═══════════════════════════════════════════════════

/**
 * Enhanced navigation to ensure EVERY click is saved.
 * Use this instead of calling showPage or showWatchPage directly for clicks.
 */
window.navigateTo = (path, state = {}) => {
  // Always use pushState to add a new entry to the history stack
  history.pushState(state, "", path);
  // Trigger the router to update the UI immediately
  handleRouting();
};

/**
 * The Router: This runs every time the URL changes (Back/Forward/Click)
 */
const handleRouting = async () => {
  const path = window.location.pathname;
  const state = history.state || {};
  const params = new URLSearchParams(window.location.search);

  // Close any open modals or search overlays first
  if (typeof closeSearch === 'function') closeSearch();

  // 1. WATCH PAGE ROUTE
  if (path.startsWith('/watch/')) {
    const parts = path.split('/');
    const slug = parts[parts.length - 1];
    const videoId = state.videoId || slug.split('-').pop(); 
    
    if (videoId) {
      if (typeof showWatchPage === 'function') {
        // Pass 'false' to prevent infinite loops of pushing state
        showWatchPage(videoId, false); 
      }
    }
    return;
  }

  // 2. SEARCH ROUTE
  if (path.startsWith('/search')) {
    const q = params.get('q');
    if (q) {
      const searchInput = document.getElementById('searchInput');
      if (searchInput) searchInput.value = q;
      if (typeof doSearch === 'function') {
        doSearch(q, false); 
      }
    }
    return;
  }

  // 3. CATEGORY ROUTE
  if (path.startsWith('/category/')) {
    const cat = path.split('/').pop();
    if (typeof navGo === 'function') {
      navGo(cat, false);
    }
    return;
  }

  // 4. TOP LEVEL PAGES
  if (path === '/history') {
    if (typeof showPage === 'function') {
      showPage('history', false);
    }
    return;
  }

  // DEFAULT: HOME
  if (typeof showPage === 'function') {
    showPage('home', false);
  }
};

// ── Listen for Browser Back/Forward Buttons ──
window.addEventListener('popstate', (e) => {
  handleRouting();
});

// ── Initialize Routing on First Page Load ──
window.addEventListener('DOMContentLoaded', () => {
  handleRouting();
});

// ═══════════════════════════════════════════════════
// § UPDATED CLICK HANDLERS
// ═══════════════════════════════════════════════════

window.openVideo = (id, title) => {
  const cleanTitle = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  const slug = `${cleanTitle}-${id}`;
  window.navigateTo(`/watch/${slug}`, { videoId: id, page: 'watch' });
};

window.clickCategory = (catName) => {
  window.navigateTo(`/category/${catName}`, { page: 'category', cat: catName });
};

window.clickNavLink = (pageId) => {
  const path = pageId === 'home' ? '/' : `/${pageId}`;
  window.navigateTo(path, { page: pageId });
};

window.goBack = () => {
  if (window.history.length > 1) {
    history.back();
  } else {
    window.navigateTo('/', { page: 'home' });
  }
};