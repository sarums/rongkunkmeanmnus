// ═══════════════════════════════════════════
//  RongKunKmeanMnus — Main App
// ═══════════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, getDocs, doc,
  updateDoc, increment, query, orderBy, getDoc
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { firebaseConfig, siteDefaults } from "./config.js";

// ── Init Firebase ──────────────────────────
const app = initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── State ──────────────────────────────────
let videos     = [];
let playlists  = [];
let categories = [];
let sections   = [];

let heroVideos = [], heroIndex = 0, heroTimer = null;
let currentVideoId = null, playlistQueue = [], plQueueIdx = 0;
let previousPage = "home", lastScrollY = 0;
let searchOpen = false, mobileMenuOpen = false;

// ── Helpers ────────────────────────────────
const $ = id => document.getElementById(id);

const fmtViews = n =>
  n >= 1e6 ? (n / 1e6).toFixed(1) + "M" :
  n >= 1e3 ? (n / 1e3).toFixed(1) + "K" :
  String(n || 0);

const getThumb = v =>
  v.customThumb || v.thumbnail ||
  ((v.platform || v.source || "") === "dailymotion"
    ? `https://www.dailymotion.com/thumbnail/video/${(v.videoId || v.url || "").replace(/.*\//, "")}`
    : `https://picsum.photos/seed/${v.id}/800/450`);

const getEmbedUrl = v => {
  const src = v.platform || v.source || "";
  const id  = (v.videoId || (v.url || "").split("/").pop() || "");
  if (src === "dailymotion") return `https://www.dailymotion.com/embed/video/${id}?autoplay=1`;
  if (src === "rumble")      return `https://rumble.com/embed/${id}/?pub=4`;
  return v.url || "";
};

const SECTION_ICONS = {
  Flame: "🔥", Sparkles: "✨", Dices: "🎲",
  Video: "🎬", Music: "🎵", TrendingUp: "📈",
  Star: "⭐", List: "📋", Grid: "▦", Eye: "👁"
};

// ── Toast ──────────────────────────────────
window.showToast = (msg, type = "ok") => {
  const el = document.createElement("div");
  el.className = `toast-item ${type}`;
  el.textContent = msg;
  $("toast").appendChild(el);
  requestAnimationFrame(() => setTimeout(() => el.classList.add("show"), 10));
  setTimeout(() => {
    el.classList.remove("show");
    setTimeout(() => el.remove(), 300);
  }, 3200);
};

// ── Scroll / Nav ───────────────────────────
window.addEventListener("scroll", () => {
  const sy = window.scrollY;
  const nav = $("navbar");

  // hide/show navbar
  if (sy > lastScrollY && sy > 120) nav.classList.add("hidden");
  else nav.classList.remove("hidden");

  // solid background when scrolled
  const inner = $("nav-inner");
  if (sy > 70) inner.classList.add("solid");
  else inner.classList.remove("solid");

  lastScrollY = sy;
});

window.toggleSearch = () => {
  searchOpen = !searchOpen;
  $("search-wrap").classList.toggle("open", searchOpen);
  if (searchOpen) setTimeout(() => $("search-input").focus(), 50);
};

window.toggleMobileMenu = () => {
  mobileMenuOpen = !mobileMenuOpen;
  $("mobile-menu").classList.toggle("open", mobileMenuOpen);
};

window.doSearch = () => {
  const q = ($("search-input").value || $("mobile-search-input")?.value || "").trim();
  if (!q) return;
  showPage("search");
  $("search-info").textContent = `Showing results for "${q}"`;
  const results = videos.filter(v => v.title?.toLowerCase().includes(q.toLowerCase()));
  renderGrid($("search-grid"), results);
};

// ── Page Routing ───────────────────────────
function showPage(id, push = true) {
  if (id !== "watch") previousPage = id;
  document.querySelectorAll(".page").forEach(p =>
    p.classList.toggle("active", p.id === `page-${id}`)
  );
  if (push) history.pushState({ page: id }, "", id === "home" ? "/" : "/" + id);
  window.scrollTo(0, 0);
}

window.goHome  = e => { e?.preventDefault(); showPage("home"); };
window.goBack  = () => showPage(previousPage);
window.addEventListener("popstate", e => { if (e.state?.page) showPage(e.state.page, false); });

// ── Load All Data ──────────────────────────
async function loadAll() {
  try {
    const [catSnap, plSnap, vidSnap, secSnap] = await Promise.all([
      getDocs(collection(db, "categories")),
      getDocs(collection(db, "playlists")),
      getDocs(query(collection(db, "videos"), orderBy("createdAt", "desc"))),
      getDocs(collection(db, "home_sections")).catch(() => ({ docs: [] }))
    ]);

    categories = catSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    playlists  = plSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    videos     = vidSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    sections   = secSnap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

    // Load site settings from Firestore
    const settingsDoc = await getDoc(doc(db, "settings", "main")).catch(() => null);
    if (settingsDoc?.exists()) {
      const s = settingsDoc.data();
      if (s.name)   { $("site-name").textContent = s.name; $("footer-name").textContent = s.name; document.title = s.name; }
      if (s.footer) { $("footer-desc").textContent = s.footer; }
    } else {
      $("site-name").textContent   = siteDefaults.name;
      $("footer-name").textContent = siteDefaults.name;
      document.title               = siteDefaults.name;
      $("footer-desc").textContent = siteDefaults.footer;
    }

    buildNav();
    buildHero();
    buildSections();

  } catch (err) {
    console.error(err);
    showToast("Failed to load data", "err");
  }
}

// ── Build Nav ──────────────────────────────
function buildNav() {
  const cats = categories.slice(0, 7);

  $("nav-cats").innerHTML =
    `<a href="#" onclick="goHome(event)" class="active">Home</a>` +
    cats.map(c => `<a href="#" onclick="openCategory('${c.id}','${c.name}')">${c.name}</a>`).join("");

  $("mobile-cats").innerHTML =
    cats.map(c => `<a href="#" onclick="openCategory('${c.id}','${c.name}');toggleMobileMenu()">${c.name}</a>`).join("");

  $("footer-links").innerHTML =
    `<a href="#" onclick="goHome(event)">Home</a>` +
    cats.slice(0, 4).map(c => `<a href="#" onclick="openCategory('${c.id}','${c.name}')">${c.name}</a>`).join("") +
    `<a href="/admin">Admin</a>`;
}

// ── Build Video Card ───────────────────────
function buildCard(v) {
  const pl    = playlists.find(p => (p.videos || []).includes(v.id));
  const click = pl ? `openPlaylist('${pl.id}','${v.id}')` : `openVideo('${v.id}')`;
  const img   = getThumb(v);

  return `
    <a class="vcard" href="#" onclick="event.preventDefault();${click}">
      <div class="vcard-thumb">
        <img src="${img}" alt="${(v.title || "").replace(/"/g, "")}" loading="lazy"
          onerror="this.src='https://picsum.photos/seed/${v.id}x/800/450'">
        <div class="vcard-overlay"></div>
        <div class="vcard-play">
          <div class="vcard-play-icon">
            <svg viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          </div>
        </div>
        ${v.duration ? `<div class="vcard-duration">${v.duration}</div>` : ""}
        ${pl ? `<div class="vcard-series">Series</div>` : ""}
      </div>
      <div class="vcard-title">${v.title || ""}</div>
      <div class="vcard-sub">${v.category || ""}${v.duration ? ` · ${v.duration}` : ""}</div>
    </a>`;
}

// ── Skeletons ──────────────────────────────
function buildSkeletonRow(n = 4) {
  return Array(n).fill(0).map(() => `
    <div class="skel-card">
      <div class="skeleton skel-thumb"></div>
      <div class="skeleton skel-title"></div>
      <div class="skeleton skel-sub"></div>
    </div>`).join("");
}

function buildSkeletonGrid(n = 8) {
  return Array(n).fill(0).map(() => `
    <div>
      <div class="skeleton skel-thumb"></div>
      <div class="skeleton skel-title"></div>
      <div class="skeleton skel-sub"></div>
    </div>`).join("");
}

// ── Render Grid ────────────────────────────
function renderGrid(el, list) {
  if (!el) return;
  if (!list.length) {
    el.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-state-icon">🎬</div>
        <p>No videos found</p>
      </div>`;
    return;
  }
  el.innerHTML = list.map(v => buildCard(v)).join("");
}

// ── Hero ───────────────────────────────────
function buildHero() {
  const featured = videos.filter(v =>
    v.featured === "yes" || v.is_featured === 1 || v.is_featured === true
  );
  heroVideos = featured.length ? featured.slice(0, 8) : videos.slice(0, 6);
  heroIndex  = 0;

  $("hero-dots").innerHTML = heroVideos.map((_, i) =>
    `<button class="hero-dot${i === 0 ? " active" : ""}"
      onclick="event.stopPropagation();goToHeroSlide(${i})"></button>`
  ).join("");

  updateHero(0);
  resetHeroTimer();
}

function updateHero(i) {
  const v = heroVideos[i];
  if (!v) return;
  window._currentHeroId = v.id;

  const img = $("hero-img");
  img.style.opacity = "0";
  setTimeout(() => { img.src = getThumb(v); img.style.opacity = "1"; }, 260);

  $("hero-title").textContent = v.title?.length > 70 ? v.title.slice(0, 70) + "…" : v.title || "";
  $("hero-desc").textContent  = v.description || "";
  $("hero-cat").textContent   = v.category || "";
  $("hero-views").textContent = fmtViews(v.views || 0) + " views";

  document.querySelectorAll(".hero-dot")
    .forEach((d, j) => d.classList.toggle("active", j === i));
}

window.goToHeroSlide = i => { heroIndex = i; updateHero(i); resetHeroTimer(); };
window.slideHero     = d => { heroIndex = (heroIndex + d + heroVideos.length) % heroVideos.length; updateHero(heroIndex); resetHeroTimer(); };
window.heroClick     = () => { if (window._currentHeroId) openVideo(window._currentHeroId); };

function resetHeroTimer() {
  clearInterval(heroTimer);
  if (heroVideos.length > 1)
    heroTimer = setInterval(() => {
      heroIndex = (heroIndex + 1) % heroVideos.length;
      updateHero(heroIndex);
    }, 6000);
}

// ── Build Sections ─────────────────────────
function buildSections() {
  const container = $("home-sections");
  container.innerHTML = "";

  const activeSections = sections.filter(s => s.is_active !== 0 && s.is_active !== "0");
  const list = activeSections.length ? activeSections : [
    { id: "trending", title: "Trending Now",  icon: "Flame",    target_type: "trending" },
    { id: "new",      title: "New Arrivals",  icon: "Sparkles", target_type: "latest"   },
  ];

  list.forEach(sec => {
    const rowId = `row-${sec.id}`;
    const el = document.createElement("div");
    el.className = "section";
    el.innerHTML = `
      <div class="section-header">
        <div class="section-left">
          <div class="section-icon">${SECTION_ICONS[sec.icon] || "▶"}</div>
          <span class="section-title">${sec.title}</span>
        </div>
        <a href="#" class="section-more" onclick="event.preventDefault();seeAll('${sec.id}')">View All ›</a>
      </div>
      <div class="row-wrap">
        <button class="row-btn prev" onclick="scrollRow('${rowId}', -1)">&#8249;</button>
        <div class="row hide-scroll" id="${rowId}">${buildSkeletonRow()}</div>
        <button class="row-btn next" onclick="scrollRow('${rowId}', 1)">&#8250;</button>
      </div>`;
    container.appendChild(el);
    fillSection(sec, rowId);
  });
}

function fillSection(sec, rowId) {
  const isTrending = sec.target_type === "trending" || sec.title?.toLowerCase().includes("trend");
  let list = [];

  if (sec.target_type === "playlist" && sec.target_id) {
    const pl = playlists.find(p => p.id === sec.target_id);
    list = (pl?.videos || []).map(id => videos.find(v => v.id === id)).filter(Boolean).slice(0, 12);

  } else if (sec.target_type === "category" && sec.target_id) {
    const cat = categories.find(c => c.id === sec.target_id);
    list = videos.filter(v =>
      v.category === (cat?.name || sec.target_id) || v.category_id === sec.target_id
    ).slice(0, 12);

  } else if (isTrending) {
    list = [...videos].sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 12);

  } else {
    list = videos.slice(0, 12);
  }

  const el = $(rowId);
  if (!el) return;
  el.innerHTML = list.length ? list.map(v => buildCard(v)).join("") : buildSkeletonRow();
}

window.scrollRow = (id, dir) => {
  const el = $(id);
  if (el) el.scrollBy({ left: dir * 700, behavior: "smooth" });
};

window.seeAll = secId => {
  const sec = sections.find(s => s.id === secId);
  if (sec?.target_type === "category" && sec.target_id) {
    const cat = categories.find(c => c.id === sec.target_id);
    openCategory(sec.target_id, cat?.name || sec.title);
  } else {
    $("cat-title").textContent = "All Videos";
    $("cat-desc").textContent  = "Browse all videos in the collection.";
    renderGrid($("cat-grid"), videos);
    showPage("cat");
  }
};

// ── Open Video ─────────────────────────────
window.openVideo = async id => {
  showPage("watch");
  currentVideoId = id;
  playlistQueue  = [];
  plQueueIdx     = 0;

  $("player-iframe").src = "";
  $("playlist-panel").style.display = "none";
  $("watch-next-btn").style.display = "none";
  $("suggested-list").innerHTML = buildSkeletonRow(3);

  const v = videos.find(x => x.id === id);
  if (!v) return;

  $("player-iframe").src        = getEmbedUrl(v);
  $("watch-title").textContent  = v.title || "";
  $("watch-source").textContent = v.platform || v.source || "";
  $("watch-cat").textContent    = v.category || "";
  $("watch-views").textContent  = fmtViews((v.views || 0) + 1);
  $("watch-date").textContent   = v.createdAt?.toDate ? v.createdAt.toDate().toLocaleDateString() : "—";
  $("watch-desc").textContent   = v.description || `${v.category || ""} content from ${v.platform || v.source || ""}.`;

  // Increment view count
  updateDoc(doc(db, "videos", id), { views: increment(1) }).catch(() => {});
  const local = videos.find(x => x.id === id);
  if (local) local.views = (local.views || 0) + 1;

  // Playlist queue
  const pl = playlists.find(p => (p.videos || []).includes(id));
  if (pl && (pl.videos || []).length > 1) {
    playlistQueue = (pl.videos || []).map(vid => videos.find(v => v.id === vid)).filter(Boolean);
    plQueueIdx    = playlistQueue.findIndex(v => v.id === id);

    $("playlist-progress").textContent = `${plQueueIdx + 1} / ${playlistQueue.length}`;
    $("playlist-items").innerHTML = playlistQueue.map(pv => `
      <div class="pl-item ${pv.id === id ? "current" : ""}" onclick="openVideo('${pv.id}')">
        <div class="pl-thumb">
          <img src="${getThumb(pv)}" loading="lazy"
            onerror="this.src='https://picsum.photos/seed/${pv.id}/320/180'">
          ${pv.id === id ? `<div class="pl-thumb-overlay">
            <svg width="11" height="11" fill="#fff" viewBox="0 0 24 24"><polygon points="5,3 19,12 5,21"/></svg>
          </div>` : ""}
        </div>
        <div style="display:flex;flex-direction:column;justify-content:center;min-width:0">
          <div class="pl-title">${pv.title || ""}</div>
          ${pv.duration ? `<div class="pl-dur">${pv.duration}</div>` : ""}
        </div>
      </div>`).join("");

    $("playlist-panel").style.display = "";
    if (playlistQueue[plQueueIdx + 1]) $("watch-next-btn").style.display = "";
  }

  // Suggested videos
  const suggested = videos.filter(x => x.id !== id).slice(0, 8);
  $("suggested-list").innerHTML = suggested.map(x => `
    <div class="sugg-item" onclick="openVideo('${x.id}')">
      <div class="sugg-thumb">
        <img src="${getThumb(x)}" loading="lazy"
          onerror="this.src='https://picsum.photos/seed/${x.id}/320/180'">
        ${x.duration ? `<div class="sugg-dur">${x.duration}</div>` : ""}
      </div>
      <div class="sugg-info">
        <div class="sugg-title-text">${x.title || ""}</div>
        <div class="sugg-meta">
          <em>${x.platform || x.source || ""}</em> · ${fmtViews(x.views)} views
        </div>
      </div>
    </div>`).join("");
};

window.openPlaylist = (plId, startId) => {
  const pl = playlists.find(p => p.id === plId);
  if (!pl || !(pl.videos || []).length) { openVideo(startId); return; }
  const i = pl.videos.indexOf(startId);
  openVideo(pl.videos[i >= 0 ? i : 0]);
};

window.playNext = () => {
  const next = playlistQueue[plQueueIdx + 1];
  if (next) openVideo(next.id);
};

// ── Open Category ──────────────────────────
window.openCategory = (id, name) => {
  showPage("cat");
  $("cat-title").textContent = name || id;
  $("cat-desc").textContent  = `Discover the best ${name || ""} content.`;

  const cat = categories.find(c => c.id === id || c.name === name);
  let list = [];

  if (cat?.target_type === "playlist" && cat.target_id) {
    const pl = playlists.find(p => p.id === cat.target_id);
    list = videos.filter(v => (pl?.videos || []).includes(v.id));
  } else {
    list = videos.filter(v => v.category === name || v.category === id || v.category_id === id);
  }

  renderGrid($("cat-grid"), list);
};

// ── Share ──────────────────────────────────
window.copyLink = () =>
  navigator.clipboard.writeText(location.href)
    .then(() => showToast("Link copied!", "ok"));

// ── Start ──────────────────────────────────
loadAll();
