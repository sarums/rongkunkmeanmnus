// ═══════════════════════════════════════════════════
// § HISTORY (REWRITTEN FOR UNLIMITED BACK)
// ═══════════════════════════════════════════════════

// This listener detects when the user clicks the browser's BACK button.
window.addEventListener('popstate', (e) => {
    const state = e.state;
    const path = window.location.pathname;

    // 1. If we are on a Watch URL (/watch/...)
    if (path.startsWith('/watch/')) {
        const id = state?.videoId || path.split('/').pop().split('-').pop();
        if (id) {
            // We pass 'false' to showWatchPage so it doesn't create a NEW history entry
            showWatchPage(id, false);
        }
        return;
    }

    // 2. If we are on a Category URL (/category/...)
    if (path.startsWith('/category/')) {
        const cat = path.split('/').pop();
        navGo(cat, false);
        return;
    }

    // 3. If we are on a Search URL (/search)
    if (path.startsWith('/search')) {
        const params = new URLSearchParams(window.location.search);
        const q = params.get('q');
        if (q) {
            doSearch(q, false);
        }
        return;
    }

    // 4. Specific Pages (History)
    if (path === '/history') {
        showPage('history', false);
        return;
    }

    // 5. Default back to Home
    showPage('home', false);
});

// Update your existing goBack function to be more reliable
window.goBack = () => {
    if (window.history.length > 1) {
        history.back();
    } else {
        // If there's no more history, just force go to home
        showPage('home');
    }
};

// ═══════════════════════════════════════════════════
// § PAGES / ROUTING (UPDATED TO RECORD EVERY CLICK)
// ═══════════════════════════════════════════════════

// Update your showPage function to accept a 'push' parameter
window.showPage = (id, push = true) => {
    // Hide all pages
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    
    // Show selected page
    const pg = document.getElementById('page-' + id);
    if (pg) {
        pg.classList.add('active');
        window.scrollTo(0, 0);
    }

    // Handle URL and History
    if (push) {
        const path = id === 'home' ? '/' : `/${id}`;
        history.pushState({ page: id }, "", path);
    }

    // Special logic for history page loading
    if (id === 'history') {
        loadHistoryPage();
    }
};

// Update your navGo function (for categories)
window.navGo = (cat, push = true) => {
    if (push) {
        history.pushState({ page: 'category', cat: cat }, "", `/category/${cat}`);
    }
    
    // Close search if open
    if (window.closeSearch) closeSearch();
    
    showPage('home', false); // Switch to home view to show category results
    
    const title = cat === 'all' ? 'All Videos' : cat.charAt(0).toUpperCase() + cat.slice(1);
    const heroTitle = document.getElementById('heroTitle');
    if (heroTitle) heroTitle.textContent = title;

    loadCategoryVideos(cat);
};

// Update your showWatchPage function
window.showWatchPage = async (id, push = true) => {
    // 1. Update History/URL
    if (push) {
        // Fetch title for the URL slug if possible, or use ID
        const slug = `video-${id}`; 
        history.pushState({ page: 'watch', videoId: id }, "", `/watch/${slug}`);
    }

    // 2. UI Logic
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    const wp = document.getElementById('page-watch');
    if (wp) wp.classList.add('active');
    window.scrollTo(0, 0);

    // 3. Your existing Firebase Video Loading Logic...
    // (Keep the rest of your original showWatchPage code here)
};