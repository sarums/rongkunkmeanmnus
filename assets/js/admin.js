import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs, deleteDoc,
  doc, query, orderBy, where, updateDoc, serverTimestamp, getDoc, setDoc, increment
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAnXxuc92620WOz_bVkovnUEQ_LL4YFPp8",
  authDomain: "streamhub-ce717.firebaseapp.com",
  projectId: "streamhub-ce717",
  storageBucket: "streamhub-ce717.firebasestorage.app",
  messagingSenderId: "223272731262",
  appId: "1:223272731262:web:d17866d4a12f610c864e2f"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// No login required — show dashboard immediately

// ── STATE ─────────────────────────────────────────────
let allVideos=[], allPlaylists=[], allCategories=[];
let siteSettings={ name:'RongKunKmeanMnus', footer:'© 2025 RKMN', password:'streamhub2024' };
let confirmCallback = null;

// ── UTILS ─────────────────────────────────────────────
const qs = id => document.getElementById(id);
const fmtViews = n => { if(n>=1e6) return (n/1e6).toFixed(1)+'M'; if(n>=1e3) return (n/1e3).toFixed(1)+'K'; return n||0; };
const thumbUrl = v => v.customThumb || (v.platform==='dailymotion' ? `https://www.dailymotion.com/thumbnail/video/${v.videoId}` : '');
const slugify = s => s.toLowerCase().replace(/\s+/g,'-');

// ── TOAST ─────────────────────────────────────────────
window.showToast = (title, msg='', type='ok') => {
  const icons = {ok:'✅', err:'❌', info:'ℹ️', warn:'⚠️'};
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `<span class="toast-ico">${icons[type]||'ℹ️'}</span><div class="toast-body"><div class="toast-title">${title}</div>${msg?`<div class="toast-msg">${msg}</div>`:''}</div>`;
  qs('toastWrap').appendChild(t);
  setTimeout(()=>t.classList.add('show'),10);
  setTimeout(()=>{ t.classList.remove('show'); setTimeout(()=>t.remove(),350); }, 3500);
};

// ── CONFIRM ───────────────────────────────────────────
window.showConfirm = (title, msg, cb) => {
  qs('confirmTitle').textContent = title;
  qs('confirmMsg').textContent = msg;
  confirmCallback = cb;
  qs('confirmOverlay').classList.add('open');
  qs('confirmYesBtn').onclick = ()=>{ closeConfirm(); cb(); };
};
window.closeConfirm = ()=>{ qs('confirmOverlay').classList.remove('open'); };

// ── LOGIN ─────────────────────────────────────────────
window.doLogout = ()=>{ location.reload(); };

// ── PANELS ────────────────────────────────────────────
window.showPanel = (id, btn) => {
  document.querySelectorAll('.panel').forEach(p=>p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(b=>b.classList.remove('active'));
  qs('panel-'+id).classList.add('active');
  if(btn) btn.classList.add('active');
  if(id==='overview') renderOverview();
  if(id==='allvideos') renderAllVideos();
  if(id==='playlists') renderPlaylists();
  if(id==='categories') renderCategories();
  if(id==='sections') renderSections();
  if(id==='settings') loadSettings();
  if(id==='addvideo'){ populateSelects(); }
};

// ── LOAD ALL ──────────────────────────────────────────
async function loadAll(){
  try {
    // Settings
    const s = await getDoc(doc(db,'settings','main'));
    if(s.exists()) siteSettings={...siteSettings,...s.data()};

    // Categories
    const cs = await getDocs(collection(db,'categories'));
    allCategories = cs.docs.map(d=>({id:d.id,...d.data()}));
    if(!allCategories.length){
      const defaults=[{name:'News',ico:'📰'},{name:'Sports',ico:'🌐'},{name:'Entertainment',ico:'🎬'},
        {name:'Tech',ico:'💻'},{name:'Music',ico:'🎵'},{name:'Comedy',ico:'😂'},{name:'Education',ico:'📚'},{name:'Gaming',ico:'🎮'}];
      for(const c of defaults){
        const r=await addDoc(collection(db,'categories'),c);
        allCategories.push({id:r.id,...c});
      }
    }

    // Playlists
    const ps = await getDocs(collection(db,'playlists'));
    allPlaylists = ps.docs.map(d=>({id:d.id,...d.data()}));

    // Videos
    const vs = await getDocs(query(collection(db,'videos'),orderBy('createdAt','desc')));
    allVideos = vs.docs.map(d=>({id:d.id,...d.data()}));

    populateSelects();
    renderOverview();
  } catch(e){
    showToast('Load Error', e.message, 'err');
  }
}

// ── POPULATE SELECTS ──────────────────────────────────
function populateSelects(){
  const catOpts = ['<option value="">Select category</option>',...allCategories.map(c=>`<option value="${c.name}">${c.ico||''} ${c.name}</option>`)].join('');
  ['fCat','editCat','filterCat'].forEach(id=>{ if(qs(id)) qs(id).innerHTML = id==='filterCat' ? '<option value="">All Categories</option>'+allCategories.map(c=>`<option value="${c.name}">${c.name}</option>`).join('') : catOpts; });
  const plOpts = ['<option value="">— No Playlist —</option>',...allPlaylists.map(p=>`<option value="${p.id}">${p.name}</option>`)].join('');
  ['fPlaylist','editPlaylist'].forEach(id=>{ if(qs(id)) qs(id).innerHTML = plOpts; });
}

// ── OVERVIEW ──────────────────────────────────────────
function renderOverview(){
  qs('ovTotalVids').textContent = allVideos.length;
  qs('ovDMVids').textContent = allVideos.filter(v=>v.platform==='dailymotion').length;
  qs('ovRBVids').textContent = allVideos.filter(v=>v.platform==='rumble').length;
  qs('ovCats').textContent = allCategories.length;

  const recent = allVideos.slice(0,15);
  qs('ovTable').innerHTML = recent.map(v=>{
    const pl = allPlaylists.find(p=>p.videos&&p.videos.includes(v.id));
    return `<tr>
      <td><div class="td-thumb"><img src="${thumbUrl(v)}" onerror="this.style.display='none'"></div></td>
      <td><div class="td-title">${v.title}</div></td>
      <td><span class="td-plat ${v.platform==='dailymotion'?'dm':'rb'}">${v.platform==='dailymotion'?'DM':'Rumble'}</span></td>
      <td><span class="td-cat">${v.category||'—'}</span></td>
      <td class="td-views">${fmtViews(v.views)}</td>
      <td>${pl?`<span class="badge badge-pl">📋 ${pl.name}</span>`:'<span style="color:var(--muted)">—</span>'}</td>
      <td><div class="td-actions">
        <button class="act-btn act-edit" onclick="openEdit('${v.id}')">✏️ Edit</button>
        <button class="act-btn act-del" onclick="deleteVideo('${v.id}','${v.title.replace(/'/g,'\\\'').substring(0,30)}')">🗑️</button>
      </div></td>
    </tr>`;
  }).join('') || `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No videos yet</td></tr>`;
}

// ── PLATFORM TOGGLE ───────────────────────────────────
window.setPlatform = (p)=>{
  qs('fPlatform').value=p;
  qs('btnDM').className='plat-btn'+(p==='dailymotion'?' active-dm':'');
  qs('btnRB').className='plat-btn'+(p==='rumble'?' active-rb':'');
  previewThumb();
};
window.setEditPlatform = (p)=>{
  qs('editPlatform').value=p;
  qs('editBtnDM').className='plat-btn'+(p==='dailymotion'?' active-dm':'');
  qs('editBtnRB').className='plat-btn'+(p==='rumble'?' active-rb':'');
  previewEditThumb();
};

// ── THUMBNAIL PREVIEW ─────────────────────────────────
window.previewThumb = ()=>{
  const custom=qs('fThumb').value.trim();
  const vid=qs('fVidId').value.trim();
  const plat=qs('fPlatform').value;
  const url = custom || (plat==='dailymotion'&&vid ? `https://www.dailymotion.com/thumbnail/video/${vid}` : '');
  const p=qs('thumbPreview');
  const epN=parseInt(qs('fEpNum')?.value)||0;
  if(url){
    p.innerHTML=`<img src="${url}" onerror="this.parentElement.innerHTML='<span>Could not load thumbnail</span>'">`
      +(epN?`<div style="position:absolute;top:8px;right:8px;width:44px;height:44px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.25);z-index:2">${epN}</div>`:'');
  } else p.innerHTML='<span>Enter Video ID to preview thumbnail</span>';
};
window.previewEditThumb = ()=>{
  const custom=qs('editThumb').value.trim();
  const vid=qs('editVidId').value.trim();
  const plat=qs('editPlatform').value;
  const url = custom || (plat==='dailymotion'&&vid ? `https://www.dailymotion.com/thumbnail/video/${vid}` : '');
  const p=qs('editThumbPreview');
  const epN=parseInt(qs('editEpNum')?.value)||0;
  if(url){
    p.innerHTML=`<img src="${url}" onerror="this.parentElement.innerHTML='<span>Could not load thumbnail</span>'">`
      +(epN?`<div style="position:absolute;top:8px;right:8px;width:44px;height:44px;background:#f27d26;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:1.1rem;font-weight:900;color:#fff;box-shadow:0 2px 10px rgba(0,0,0,.6);border:2px solid rgba(255,255,255,.25);z-index:2">${epN}</div>`:'');
  } else p.innerHTML='<span>No thumbnail</span>';
};

// ── ADD VIDEO ─────────────────────────────────────────
window.addVideo = async ()=>{
  const platform=qs('fPlatform').value, videoId=qs('fVidId').value.trim();
  const title=qs('fTitle').value.trim(), description=qs('fDesc').value.trim();
  const category=qs('fCat').value, section=qs('fSection').value;
  const plId=qs('fPlaylist').value, duration=qs('fDuration').value.trim();
  const customThumb=qs('fThumb').value.trim(), viewsDisplay=qs('fViews').value.trim();
  const epNum=parseInt(qs('fEpNum')?.value)||0;
  if(!videoId||!title){ showToast('Missing Fields','Video ID and Title are required','err'); return; }
  const btn=qs('addVidBtn'); btn.disabled=true; btn.textContent='Adding...';
  try {
    const data={ platform,videoId,title,description,category,featured:section==='featured'?'yes':'no',
      section:section||'', duration:duration||'', customThumb:customThumb||'',
      viewsDisplay:viewsDisplay||'', views:0, episodeNum:epNum||0, createdAt:serverTimestamp() };
    const ref=await addDoc(collection(db,'videos'),data);
    const newV={id:ref.id,...data};
    allVideos.unshift(newV);
    if(plId){
      const pl=allPlaylists.find(p=>p.id===plId);
      if(pl){ pl.videos=pl.videos||[]; pl.videos.push(ref.id); await updateDoc(doc(db,'playlists',plId),{videos:pl.videos}); }
    }
    showToast('Video Added!',`"${title}" has been added successfully`,'ok');
    // reset form
    ['fVidId','fTitle','fDesc','fDuration','fThumb','fViews','fEpNum'].forEach(id=>qs(id).value='');
    qs('fSection').value=''; qs('fPlaylist').value='';
    qs('thumbPreview').innerHTML='<span>Enter Video ID to preview thumbnail</span>';
    setPlatform('dailymotion');
    renderOverview();
  } catch(e){ showToast('Error',e.message,'err'); }
  btn.disabled=false; btn.textContent='➕ Add Video';
};

// ── ALL VIDEOS TABLE ──────────────────────────────────
window.filterVideos = (q)=>{
  const plat=qs('filterPlatform').value;
  const cat=qs('filterCat').value;
  let vids=allVideos.filter(v=>{
    const mQ=!q||(v.title.toLowerCase().includes(q.toLowerCase())||(v.description||'').toLowerCase().includes(q.toLowerCase()));
    const mP=!plat||v.platform===plat;
    const mC=!cat||v.category===cat;
    return mQ&&mP&&mC;
  });
  qs('allVidsEmpty').style.display=vids.length?'none':'block';
  renderVideosTable(vids);
};

function renderAllVideos(){ filterVideos(''); }

function renderVideosTable(vids){
  qs('allVidsTable').innerHTML = vids.map(v=>`<tr>
    <td><div class="td-thumb"><img src="${thumbUrl(v)}" onerror="this.style.display='none'"></div></td>
    <td>
      <div class="td-title">${v.title}</div>
      <div style="font-size:0.68rem;color:var(--muted);margin-top:0.15rem;font-family:'JetBrains Mono',monospace;">${v.videoId}${v.duration?' · '+v.duration:''}</div>
    </td>
    <td><span class="td-plat ${v.platform==='dailymotion'?'dm':'rb'}">${v.platform==='dailymotion'?'DM':'Rumble'}</span></td>
    <td><span class="td-cat">${v.category||'—'}</span></td>
    <td class="td-views">${fmtViews(v.views)}</td>
    <td>${v.featured==='yes'?'<span class="badge badge-feat">⭐ Hero</span>':v.section?`<span class="badge" style="background:rgba(139,92,246,0.1);border:1px solid rgba(139,92,246,0.2);color:var(--purple)">${v.section}</span>`:'<span style="color:var(--muted)">—</span>'}</td>
    <td><div class="td-actions">
      <button class="act-btn act-edit" onclick="openEdit('${v.id}')">✏️ Edit</button>
      <button class="act-btn act-feat" onclick="toggleFeatured('${v.id}')" title="${v.featured==='yes'?'Remove from hero':'Set as hero'}">⭐</button>
      <button class="act-btn act-del" onclick="deleteVideo('${v.id}','${v.title.replace(/'/g,'\\\'').substring(0,30)}')">🗑️</button>
    </div></td>
  </tr>`).join('') || `<tr><td colspan="7" style="text-align:center;padding:2rem;color:var(--muted)">No videos found</td></tr>`;
}

// ── EDIT VIDEO ────────────────────────────────────────
window.openEdit = (id)=>{
  const v=allVideos.find(x=>x.id===id);
  if(!v) return;
  qs('editId').value=id;
  qs('editPlatform').value=v.platform;
  setEditPlatform(v.platform);
  qs('editVidId').value=v.videoId||'';
  qs('editTitle').value=v.title||'';
  qs('editDesc').value=v.description||'';
  qs('editDuration').value=v.duration||'';
  qs('editThumb').value=v.customThumb||'';
  qs('editEpNum').value=v.episodeNum||'';
  qs('editSection').value=v.featured==='yes'?'featured':(v.section||'');
  populateSelects();
  setTimeout(()=>{
    qs('editCat').value=v.category||'';
    const pl=allPlaylists.find(p=>p.videos&&p.videos.includes(id));
    qs('editPlaylist').value=pl?pl.id:'';
    previewEditThumb();
  },50);
  qs('editModal').classList.add('open');
};
window.closeEditModal = ()=>{ qs('editModal').classList.remove('open'); };

window.saveEdit = async ()=>{
  const id=qs('editId').value;
  const platform=qs('editPlatform').value, videoId=qs('editVidId').value.trim();
  const title=qs('editTitle').value.trim(), description=qs('editDesc').value.trim();
  const category=qs('editCat').value, section=qs('editSection').value;
  const duration=qs('editDuration').value.trim(), customThumb=qs('editThumb').value.trim();
  const epNum=parseInt(qs('editEpNum')?.value)||0;
  const newPlId=qs('editPlaylist').value;
  if(!videoId||!title){ showToast('Missing Fields','Video ID and Title required','err'); return; }
  try {
    const data={ platform,videoId,title,description,category,
      featured:section==='featured'?'yes':'no', section:section||'',
      duration, customThumb, episodeNum:epNum||0 };
    await updateDoc(doc(db,'videos',id),data);
    const v=allVideos.find(x=>x.id===id);
    if(v) Object.assign(v,data);

    // update playlist membership
    for(const pl of allPlaylists){
      const has=pl.videos&&pl.videos.includes(id);
      if(has&&pl.id!==newPlId){
        pl.videos=pl.videos.filter(x=>x!==id);
        await updateDoc(doc(db,'playlists',pl.id),{videos:pl.videos});
      }
    }
    if(newPlId){
      const pl=allPlaylists.find(p=>p.id===newPlId);
      if(pl&&!(pl.videos||[]).includes(id)){
        pl.videos=[...(pl.videos||[]),id];
        await updateDoc(doc(db,'playlists',newPlId),{videos:pl.videos});
      }
    }

    showToast('Saved!',`"${title}" updated successfully`,'ok');
    closeEditModal();
    renderOverview(); renderAllVideos();
  } catch(e){ showToast('Error',e.message,'err'); }
};

// ── DELETE VIDEO ──────────────────────────────────────
window.deleteVideo = (id, name)=>{
  showConfirm('Delete Video?',`"${name}..." and ALL its comments will be permanently deleted.`,async()=>{
    try {
      // Delete the video
      await deleteDoc(doc(db,'videos',id));
      allVideos=allVideos.filter(v=>v.id!==id);

      // Remove from playlists
      for(const pl of allPlaylists){
        if(pl.videos&&pl.videos.includes(id)){
          pl.videos=pl.videos.filter(x=>x!==id);
          await updateDoc(doc(db,'playlists',pl.id),{videos:pl.videos});
        }
      }

      // Delete all comments for this video (cascade)
      const commSnap=await getDocs(query(collection(db,'comments'),where('videoId','==',id)));
      if(!commSnap.empty){
        await Promise.all(commSnap.docs.map(d=>deleteDoc(doc(db,'comments',d.id))));
        // Refresh local comments cache if loaded
        allComments=allComments.filter(c=>c.videoId!==id);
      }

      showToast('Deleted',`Video and ${commSnap.size} comment(s) removed`,'warn');
      renderOverview(); renderAllVideos();
    } catch(e){ showToast('Error',e.message,'err'); }
  });
};

// ── TOGGLE FEATURED ───────────────────────────────────
window.toggleFeatured = async (id)=>{
  const v=allVideos.find(x=>x.id===id);
  if(!v) return;
  const newFeat = v.featured==='yes'?'no':'yes';
  try {
    await updateDoc(doc(db,'videos',id),{featured:newFeat});
    v.featured=newFeat;
    showToast(newFeat==='yes'?'Set as Hero':'Removed from Hero','','ok');
    renderAllVideos(); renderOverview();
  } catch(e){ showToast('Error',e.message,'err'); }
};

// ── PLAYLISTS ─────────────────────────────────────────
window.previewPlThumb = ()=>{
  const url = qs('plThumb').value.trim();
  const box = qs('plThumbPreview');
  if(url){ box.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='Invalid'">`; }
  else   { box.innerHTML='No img'; }
};

window.createPlaylist = async ()=>{
  const name=qs('plName').value.trim(), desc=qs('plDesc').value.trim(), thumb=qs('plThumb').value.trim();
  if(!name){ showToast('Missing Name','Enter a playlist name','err'); return; }
  try {
    const ref=await addDoc(collection(db,'playlists'),{name,description:desc,thumbnail:thumb,videos:[],createdAt:serverTimestamp()});
    allPlaylists.push({id:ref.id,name,description:desc,thumbnail:thumb,videos:[]});
    qs('plName').value=''; qs('plDesc').value=''; qs('plThumb').value='';
    qs('plThumbPreview').innerHTML='No img';
    showToast('Playlist Created!',`"${name}" is ready`,'ok');
    populateSelects(); renderPlaylists();
  } catch(e){ showToast('Error',e.message,'err'); }
};

function renderPlaylists(){
  qs('plEmpty').style.display=allPlaylists.length?'none':'block';
  qs('plGrid').innerHTML=allPlaylists.map(pl=>{
    const vids=(pl.videos||[]).map(id=>allVideos.find(v=>v.id===id)).filter(Boolean);
    const autoThumb=pl.thumbnail||(vids[0]?thumbUrl(vids[0]):'');
    return `<div class="pl-card">
      <!-- Header -->
      <div class="pl-card-head">
        <div style="display:flex;align-items:center;gap:.85rem;flex:1;min-width:0">
          <div style="width:80px;aspect-ratio:16/9;border-radius:7px;overflow:hidden;background:var(--bg3);border:1px solid var(--border2);flex-shrink:0;position:relative">
            ${autoThumb
              ?`<img src="${autoThumb}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
              :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem">📋</div>`}
            <div style="position:absolute;bottom:3px;right:3px;background:rgba(0,0,0,.75);color:#fff;font-size:.6rem;font-weight:700;padding:1px 5px;border-radius:3px">${vids.length} ep</div>
          </div>
          <div style="min-width:0">
            <div class="pl-card-name">📋 ${pl.name}</div>
            ${pl.description?`<div class="pl-card-meta" style="margin-top:.2rem">${pl.description}</div>`:''}
            <div style="font-size:.65rem;margin-top:.2rem;color:${pl.thumbnail?'var(--accent)':'var(--muted)'}">
              🖼 ${pl.thumbnail?'Custom thumbnail set':'Auto thumbnail (from first video)'}
            </div>
          </div>
        </div>
        <div class="pl-card-actions">
          <span class="pl-card-meta">${vids.length} video${vids.length!==1?'s':''}</span>
          <button class="act-btn" style="background:rgba(232,160,32,.12);color:var(--accent);border:1px solid rgba(232,160,32,.25)" onclick="togglePlAddVideo('${pl.id}')">➕ Add Videos</button>
          <button class="act-btn act-edit" onclick="editPlaylist('${pl.id}')">✏️ Edit</button>
          <button class="act-btn act-del" onclick="deletePlaylist('${pl.id}','${pl.name.replace(/'/g,"\\'").substring(0,30)}')">🗑️</button>
        </div>
      </div>

      <!-- Add Video Panel (hidden by default) -->
      <div id="pl-addvid-${pl.id}" style="display:none;border-top:1px solid var(--border);padding:1rem">
        <div style="font-size:.75rem;font-weight:800;color:var(--text2);letter-spacing:.08em;text-transform:uppercase;margin-bottom:.6rem">Add Videos to Playlist</div>
        <div style="display:flex;gap:.5rem;margin-bottom:.5rem">
          <div style="position:relative;flex:1">
            <input type="text" class="finput" id="pl-search-${pl.id}" placeholder="Search videos..."
              oninput="searchPlVid('${pl.id}')" style="padding-left:2rem">
            <span style="position:absolute;left:.65rem;top:50%;transform:translateY(-50%);opacity:.4;font-size:.8rem">🔍</span>
          </div>
          <button class="submit-btn" style="padding:.5rem 1rem;font-size:.78rem;white-space:nowrap" onclick="addCheckedToPlaylist('${pl.id}')">✔ Add Ticked</button>
        </div>
        <div id="pl-results-${pl.id}" style="max-height:260px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border2);border-radius:8px"></div>
      </div>

      <!-- Video list -->
      <div class="pl-items-list">
        ${vids.length?vids.map((v,i)=>`
          <div class="pl-item-row">
            <div class="pl-num">${i+1}</div>
            <div class="pl-item-thumb"><img src="${thumbUrl(v)}" onerror="this.style.display='none'"></div>
            <div class="pl-item-info">
              <div class="pl-item-title">${v.title}</div>
              <div class="pl-item-meta">${v.duration||''} · ${v.category||'—'}</div>
            </div>
            <button class="pl-remove" onclick="removeFromPlaylist('${pl.id}','${v.id}')">Remove</button>
          </div>`).join('')
        :`<div style="padding:1rem 1.25rem;color:var(--muted);font-size:0.82rem">No videos yet — click ➕ Add Videos above</div>`}
      </div>
    </div>`;
  }).join('');
}

window.editPlaylist = id=>{
  const pl = allPlaylists.find(p=>p.id===id);
  if(!pl) return;
  const html=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.82);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem" id="plEditOverlay">
  <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:1.75rem;width:480px;max-width:100%;max-height:85vh;overflow-y:auto">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem">
      <span style="font-size:1rem;font-weight:800">✏️ Edit Playlist</span>
      <button onclick="document.getElementById('plEditOverlay').remove()" style="background:none;border:none;color:var(--text2);font-size:1.3rem;cursor:pointer">×</button>
    </div>
    <label class="flabel">Playlist Name</label>
    <input type="text" class="finput" id="eplName" value="${pl.name||''}" style="margin-bottom:.75rem">
    <label class="flabel">Description</label>
    <input type="text" class="finput" id="eplDesc" value="${pl.description||''}" style="margin-bottom:.75rem">
    <label class="flabel">Thumbnail URL</label>
    <div style="display:flex;gap:.6rem;align-items:flex-start;margin-bottom:.75rem">
      <input type="text" class="finput" id="eplThumb" value="${pl.thumbnail||''}" placeholder="https://...image.jpg" oninput="previewEplThumb()" style="flex:1">
      <div id="eplThumbPreview" style="width:90px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:var(--bg3);border:1px solid var(--border2);flex-shrink:0">
        ${pl.thumbnail
          ? `<img src="${pl.thumbnail}" style="width:100%;height:100%;object-fit:cover" onerror="this.innerHTML='?'">`
          : `<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--muted)">No img</div>`}
      </div>
    </div>
    <button onclick="savePlEdit('${id}')" class="submit-btn" style="width:100%">💾 Save Changes</button>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend', html);
};

window.previewEplThumb = ()=>{
  const url = document.getElementById('eplThumb')?.value.trim();
  const box = document.getElementById('eplThumbPreview');
  if(!box) return;
  if(url) box.innerHTML=`<img src="${url}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='Invalid'">`;
  else    box.innerHTML=`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:.7rem;color:var(--muted)">No img</div>`;
};

window.savePlEdit = async id=>{
  const name  = document.getElementById('eplName')?.value.trim();
  const desc  = document.getElementById('eplDesc')?.value.trim();
  const thumb = document.getElementById('eplThumb')?.value.trim();
  if(!name){ showToast('Error','Name is required','err'); return; }
  try{
    await updateDoc(doc(db,'playlists',id),{name,description:desc||'',thumbnail:thumb||''});
    const pl=allPlaylists.find(p=>p.id===id);
    if(pl){ pl.name=name; pl.description=desc||''; pl.thumbnail=thumb||''; }
    document.getElementById('plEditOverlay')?.remove();
    showToast('Saved!','Playlist updated','ok');
    populateSelects(); renderPlaylists();
  }catch(e){ showToast('Error',e.message,'err'); }
};
window.deletePlaylist = (id, name)=>{
  showConfirm('Delete Playlist?',`"${name}..." will be deleted.`,async()=>{
    try {
      await deleteDoc(doc(db,'playlists',id));
      allPlaylists=allPlaylists.filter(p=>p.id!==id);
      showToast('Deleted',`Playlist removed`,'warn');
      populateSelects(); renderPlaylists();
    } catch(e){ showToast('Error',e.message,'err'); }
  });
};

window.removeFromPlaylist = async (plId, vidId)=>{
  const pl=allPlaylists.find(p=>p.id===plId);
  if(!pl) return;
  pl.videos=(pl.videos||[]).filter(x=>x!==vidId);
  try {
    await updateDoc(doc(db,'playlists',plId),{videos:pl.videos});
    showToast('Removed','Video removed from playlist','info');
    renderPlaylists();
  } catch(e){ showToast('Error',e.message,'err'); }
};

// ── CATEGORIES ────────────────────────────────────────
// ── MENU TYPE TABS ────────────────────────────────────
let catSelPls=[], catSelVids=[];

window.setCatType=(t)=>{
  qs('catType').value=t;
  ['Cat','Pl','Vid'].forEach(x=>qs('catTypeBtn'+x)?.classList.remove('active'));
  qs('catTypeBtn'+(t==='category'?'Cat':t==='playlist'?'Pl':'Vid'))?.classList.add('active');
  qs('catPlPick').style.display  = t==='playlist'?'':'none';
  qs('catVidPick').style.display = t==='video'?'':'none';
  if(t==='playlist'){ catSelPls=[]; renderCatPlList(''); }
  if(t==='video')   { catSelVids=[]; renderCatVidList(''); }
};

window.renderCatPlList=(q='')=>{
  const box=qs('catPlList'); if(!box)return;
  const filtered=allPlaylists.filter(p=>(p.name||'').toLowerCase().includes((q||'').toLowerCase()));
  if(!filtered.length){box.innerHTML=`<div style="padding:.75rem;color:var(--text2);font-size:.8rem">No playlists</div>`;return;}
  box.innerHTML=filtered.map(pl=>{
    const chk=catSelPls.includes(pl.id);
    const thumb=getPlThumb(pl);
    return `<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;cursor:pointer;border-bottom:1px solid var(--border);background:${chk?'rgba(232,160,32,.08)':''}">
      <input type="checkbox" value="${pl.id}" ${chk?'checked':''} onchange="toggleCatPl('${pl.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0">
      ${thumb?`<img src="${thumb}" style="width:54px;aspect-ratio:16/9;object-fit:cover;border-radius:5px;flex-shrink:0">`
             :`<div style="width:54px;aspect-ratio:16/9;background:var(--bg4);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center">📋</div>`}
      <div style="min-width:0;flex:1">
        <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name}</div>
        <div style="font-size:.68rem;color:var(--text2)">${(pl.videos||[]).length} videos</div>
      </div>
    </label>`;
  }).join('');
};
window.toggleCatPl=(id,chk)=>{
  if(chk&&!catSelPls.includes(id)) catSelPls.push(id);
  if(!chk) catSelPls=catSelPls.filter(x=>x!==id);
};

window.renderCatVidList=(q='')=>{
  const box=qs('catVidList'); if(!box)return;
  const filtered=allVideos.filter(v=>(v.title||'').toLowerCase().includes((q||'').toLowerCase())).slice(0,60);
  if(!filtered.length){box.innerHTML=`<div style="padding:.75rem;color:var(--text2);font-size:.8rem">No videos</div>`;return;}
  box.innerHTML=filtered.map(v=>{
    const chk=catSelVids.includes(v.id);
    return `<label style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);background:${chk?'rgba(232,160,32,.08)':''}">
      <input type="checkbox" value="${v.id}" ${chk?'checked':''} onchange="toggleCatVid('${v.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0">
      <img src="${getAdminThumb(v)}" style="width:52px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex-shrink:0"
        onerror="this.src='https://picsum.photos/seed/${v.id}/160/90'">
      <div style="min-width:0;flex:1">
        <div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</div>
        <div style="font-size:.67rem;color:var(--text2)">${v.category||''} · ${v.platform||''}</div>
      </div>
    </label>`;
  }).join('');
};
window.toggleCatVid=(id,chk)=>{
  if(chk&&!catSelVids.includes(id)) catSelVids.push(id);
  if(!chk) catSelVids=catSelVids.filter(x=>x!==id);
};

// ── ADD MENU ITEM ──────────────────────────────────────
window.addCategory = async ()=>{
  const name=qs('catName').value.trim();
  const type=qs('catType').value;
  if(!name){ showToast('Missing Name','Enter a label','err'); return; }
  let target_ids=[];
  if(type==='playlist'){
    target_ids=[...catSelPls];
    if(!target_ids.length){ showToast('Error','Tick at least one playlist','err'); return; }
  }
  if(type==='video'){
    target_ids=[...catSelVids];
    if(!target_ids.length){ showToast('Error','Tick at least one video','err'); return; }
  }
  const data={name, ico:'', target_type:type, target_ids, target_id:target_ids[0]||null, display_order:allCategories.length};
  try {
    const ref=await addDoc(collection(db,'categories'),data);
    allCategories.push({id:ref.id,...data});
    qs('catName').value=''; qs('catVidSearch').value='';
    catSelPls=[]; catSelVids=[];
    setCatType('category');
    showToast('Added!',`"${name}" added to menu`,'ok');
    populateSelects(); renderCategories();
  } catch(e){ showToast('Error',e.message,'err'); }
};

// ── RENDER MENU LIST ───────────────────────────────────
function renderCategories(){
  allCategories.sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  qs('catEmpty').style.display=allCategories.length?'none':'flex';
  qs('catGrid').innerHTML=allCategories.map((c,i)=>{
    const typeTag = c.target_type==='playlist'?'📋 Playlist': c.target_type==='video'?'🎬 Video':'🏷️ Category';
    const ids=c.target_ids||[c.target_id].filter(Boolean);
    const sublabel = c.target_type==='playlist'
      ? (ids.length>1?`${ids.length} playlists`:allPlaylists.find(p=>p.id===ids[0])?.name||'?')
      : c.target_type==='video'
      ? (ids.length>1?`${ids.length} videos`:allVideos.find(v=>v.id===ids[0])?.title||'?')
      : `${allVideos.filter(v=>v.category===c.name).length} videos`;
    return `<div style="display:flex;align-items:center;gap:.85rem;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:.7rem 1rem;transition:border-color .2s"
        onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'">
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:700;color:var(--text)">${c.name}</div>
        <div style="font-size:.7rem;color:var(--text2);margin-top:2px">${typeTag} · ${sublabel}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
        <button onclick="moveCat('${c.id}',-1)" style="background:var(--bg4);border:1px solid var(--border2);color:var(--text2);border-radius:4px;width:24px;height:21px;font-size:.65rem;cursor:pointer" ${i===0?'disabled':''}>▲</button>
        <button onclick="moveCat('${c.id}',1)" style="background:var(--bg4);border:1px solid var(--border2);color:var(--text2);border-radius:4px;width:24px;height:21px;font-size:.65rem;cursor:pointer" ${i===allCategories.length-1?'disabled':''}>▼</button>
      </div>
      <button class="act-btn act-edit" onclick="editCategory('${c.id}')">✏️</button>
      <button class="act-btn act-del" onclick="deleteCategory('${c.id}','${c.name}')">🗑️</button>
    </div>`;
  }).join('');
}

// ── MOVE ORDER ─────────────────────────────────────────
window.moveCat=async(id,dir)=>{
  const idx=allCategories.findIndex(c=>c.id===id);
  const swap=allCategories[idx+dir]; if(!swap)return;
  const a=allCategories[idx].display_order??idx;
  const b=swap.display_order??(idx+dir);
  try{
    await Promise.all([
      updateDoc(doc(db,'categories',id),{display_order:b}),
      updateDoc(doc(db,'categories',swap.id),{display_order:a})
    ]);
    allCategories[idx].display_order=b;
    swap.display_order=a;
    allCategories.sort((x,y)=>(x.display_order??0)-(y.display_order??0));
    renderCategories();
  }catch(e){showToast('Error',e.message,'err');}
};

// ── EDIT ───────────────────────────────────────────────
// edit modal selection state
let ecSelPls=[], ecSelVids=[];

window.editCategory=id=>{
  const c=allCategories.find(x=>x.id===id); if(!c)return;
  const curType=c.target_type||'category';
  ecSelPls=[...(c.target_ids||(c.target_id?[c.target_id]:[])).filter(x=>allPlaylists.find(p=>p.id===x))];
  ecSelVids=[...(c.target_ids||(c.target_id?[c.target_id]:[])).filter(x=>allVideos.find(v=>v.id===x))];

  const html=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem" id="catEditOverlay">
  <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:1.75rem;width:560px;max-width:100%;max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
      <span style="font-size:1rem;font-weight:800">✏️ Edit Menu Item</span>
      <button onclick="document.getElementById('catEditOverlay').remove()" style="background:none;border:none;color:var(--text2);font-size:1.4rem;cursor:pointer;line-height:1">×</button>
    </div>
    <label class="flabel">Label</label>
    <input type="text" class="finput" id="ecName" value="${c.name||''}" style="margin-bottom:.75rem">
    <label class="flabel" style="margin-bottom:.5rem;display:block">Type</label>
    <div style="display:flex;gap:.5rem;margin-bottom:1rem">
      <button id="ecTypeBtnCat" class="type-tab ${curType==='category'?'active':''}" onclick="setEcType('category')">🏷️ Category</button>
      <button id="ecTypeBtnPl"  class="type-tab ${curType==='playlist'?'active':''}" onclick="setEcType('playlist')">📋 Playlist</button>
      <button id="ecTypeBtnVid" class="type-tab ${curType==='video'?'active':''}"    onclick="setEcType('video')">🎬 Video</button>
    </div>
    <input type="hidden" id="ecType" value="${curType}">

    <div id="ecPlPick" style="${curType==='playlist'?'':'display:none'}">
      <div style="position:relative;margin-bottom:.5rem">
        <input type="text" class="finput" placeholder="Search playlists..." oninput="renderEcPlList(this.value)" style="padding-left:2rem">
        <span style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);opacity:.4">🔍</span>
      </div>
      <div id="ecPlList" style="max-height:240px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;margin-bottom:.75rem"></div>
    </div>

    <div id="ecVidPick" style="${curType==='video'?'':'display:none'}">
      <div style="position:relative;margin-bottom:.5rem">
        <input type="text" class="finput" placeholder="Search videos..." oninput="renderEcVidList(this.value)" style="padding-left:2rem">
        <span style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);opacity:.4">🔍</span>
      </div>
      <div id="ecVidList" style="max-height:240px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;margin-bottom:.75rem"></div>
    </div>

    <button onclick="saveCatEdit('${id}')" class="submit-btn" style="width:100%">💾 Save Changes</button>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  if(curType==='playlist') renderEcPlList('');
  if(curType==='video')    renderEcVidList('');
};

window.setEcType=(t)=>{
  document.getElementById('ecType').value=t;
  ['Cat','Pl','Vid'].forEach(x=>document.getElementById('ecTypeBtn'+x)?.classList.remove('active'));
  document.getElementById('ecTypeBtn'+(t==='category'?'Cat':t==='playlist'?'Pl':'Vid'))?.classList.add('active');
  document.getElementById('ecPlPick').style.display  = t==='playlist'?'':'none';
  document.getElementById('ecVidPick').style.display = t==='video'?'':'none';
  if(t==='playlist'){ ecSelPls=[]; renderEcPlList(''); }
  if(t==='video')   { ecSelVids=[]; renderEcVidList(''); }
};

window.renderEcPlList=(q='')=>{
  const box=document.getElementById('ecPlList'); if(!box)return;
  const filtered=allPlaylists.filter(p=>(p.name||'').toLowerCase().includes((q||'').toLowerCase()));
  if(!filtered.length){box.innerHTML=`<div style="padding:.75rem;color:var(--text2);font-size:.8rem">No playlists</div>`;return;}
  box.innerHTML=filtered.map(pl=>{
    const chk=ecSelPls.includes(pl.id);
    const thumb=getPlThumb(pl);
    return `<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;cursor:pointer;border-bottom:1px solid var(--border);background:${chk?'rgba(232,160,32,.08)':''}">
      <input type="checkbox" value="${pl.id}" ${chk?'checked':''} onchange="toggleEcPl('${pl.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0">
      ${thumb?`<img src="${thumb}" style="width:54px;aspect-ratio:16/9;object-fit:cover;border-radius:5px;flex-shrink:0">`
             :`<div style="width:54px;aspect-ratio:16/9;background:var(--bg4);border-radius:5px;display:flex;align-items:center;justify-content:center;flex-shrink:0">📋</div>`}
      <div style="min-width:0;flex:1">
        <div style="font-size:.82rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name}</div>
        <div style="font-size:.68rem;color:var(--text2)">${(pl.videos||[]).length} videos</div>
      </div>
    </label>`;
  }).join('');
};
window.toggleEcPl=(id,chk)=>{
  if(chk&&!ecSelPls.includes(id)) ecSelPls.push(id);
  if(!chk) ecSelPls=ecSelPls.filter(x=>x!==id);
};

window.renderEcVidList=(q='')=>{
  const box=document.getElementById('ecVidList'); if(!box)return;
  const filtered=allVideos.filter(v=>(v.title||'').toLowerCase().includes((q||'').toLowerCase())).slice(0,60);
  if(!filtered.length){box.innerHTML=`<div style="padding:.75rem;color:var(--text2);font-size:.8rem">No videos</div>`;return;}
  box.innerHTML=filtered.map(v=>{
    const chk=ecSelVids.includes(v.id);
    return `<label style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);background:${chk?'rgba(232,160,32,.08)':''}">
      <input type="checkbox" value="${v.id}" ${chk?'checked':''} onchange="toggleEcVid('${v.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0">
      <img src="${getAdminThumb(v)}" style="width:52px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex-shrink:0">
      <div style="min-width:0;flex:1">
        <div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</div>
        <div style="font-size:.67rem;color:var(--text2)">${v.category||''}</div>
      </div>
    </label>`;
  }).join('');
};
window.toggleEcVid=(id,chk)=>{
  if(chk&&!ecSelVids.includes(id)) ecSelVids.push(id);
  if(!chk) ecSelVids=ecSelVids.filter(x=>x!==id);
};

window.saveCatEdit=async id=>{
  const name=document.getElementById('ecName')?.value.trim();
  const type=document.getElementById('ecType')?.value;
  if(!name){showToast('Error','Label required','err');return;}
  let target_ids=[];
  if(type==='playlist'){
    target_ids=[...ecSelPls];
    if(!target_ids.length){showToast('Error','Tick at least one playlist','err');return;}
  }
  if(type==='video'){
    target_ids=[...ecSelVids];
    if(!target_ids.length){showToast('Error','Tick at least one video','err');return;}
  }
  const updates={name, ico:'', target_type:type, target_ids, target_id:target_ids[0]||null};
  try{
    await updateDoc(doc(db,'categories',id),updates);
    const c=allCategories.find(x=>x.id===id); if(c)Object.assign(c,updates);
    document.getElementById('catEditOverlay')?.remove();
    showToast('Saved!','Menu item updated','ok');
    populateSelects(); renderCategories();
  }catch(e){showToast('Error',e.message,'err');}
};

window.deleteCategory = (id, name)=>{
  showConfirm('Delete Menu Item?',`"${name}" will be removed from the menu.`,async()=>{
    try {
      await deleteDoc(doc(db,'categories',id));
      allCategories=allCategories.filter(c=>c.id!==id);
      showToast('Deleted','Menu item removed','warn');
      populateSelects(); renderCategories();
    } catch(e){ showToast('Error',e.message,'err'); }
  });
};

// ── SETTINGS ─────────────────────────────────────────
function loadSettings(){
  qs('sSiteName').value=siteSettings.name||'';
  qs('sFooter').value=siteSettings.footer||'';
}
window.saveSettings = async ()=>{
  const newPw=qs('sNewPw').value.trim();
  const updated={
    name:qs('sSiteName').value.trim()||'RongKunKmeanMnus',
    footer:qs('sFooter').value.trim()||'',
    password:newPw||siteSettings.password
  };
  try {
    await setDoc(doc(db,'settings','main'),updated,{merge:true});
    siteSettings={...siteSettings,...updated};
    showToast('Settings Saved!','Changes applied successfully','ok');
    qs('sNewPw').value='';
  } catch(e){ showToast('Error',e.message,'err'); }
};

// ══════════════════════════════════════════
//  HOME SECTIONS MANAGER
// ══════════════════════════════════════════
let allSections = [];
let secSelectedVids = [];
let secSelectedPls  = []; // for multi_playlist type

// ── helpers ──
function getAdminThumb(v){
  return v.customThumb||v.thumbnail||
    ((v.platform||v.source||'')==='dailymotion'
      ?`https://www.dailymotion.com/thumbnail/video/${(v.videoId||v.url||'').replace(/.*\//,'')}`
      :`https://picsum.photos/seed/${v.id}/400/225`);
}
function getPlThumb(pl){
  if(pl.thumbnail) return pl.thumbnail;
  const fv=allVideos.find(v=>(pl.videos||[]).includes(v.id));
  return fv?getAdminThumb(fv):'';
}

// ── Section type toggle ──
window.onSecTypeChange = ()=>{
  const t = qs('secType').value;
  qs('secPlPicker').style.display    = t==='multi_playlist' ? '' : 'none';
  qs('secVideoPicker').style.display = t==='single_videos'  ? '' : 'none';
  qs('secCatPicker') && (qs('secCatPicker').style.display = t==='category' ? '' : 'none');
  if(t==='multi_playlist'){ secSelectedPls=[]; renderSecPlList(); }
  if(t==='single_videos') { secSelectedVids=[]; renderSecSelVids(); searchSecVids(); }
  if(t==='category'){
    const sel=qs('secCatSelect'); if(!sel)return;
    sel.innerHTML=allCategories.map(c=>`<option value="${c.name}">${c.ico||''} ${c.name}</option>`).join('');
  }
};

// ── Multi-playlist picker ──
window.filterSecPlaylists = ()=>{ renderSecPlList(qs('secPlSearch').value||''); };

function renderSecPlList(q=''){
  const box = qs('secPlList');
  if(!box) return;
  const filtered = allPlaylists.filter(p=>(p.name||'').toLowerCase().includes(q.toLowerCase()));
  if(!filtered.length){
    box.innerHTML=`<div style="padding:.75rem 1rem;color:var(--text2);font-size:.8rem">No playlists found</div>`;
    return;
  }
  box.innerHTML = filtered.map(pl=>{
    const checked = secSelectedPls.includes(pl.id);
    const thumb   = getPlThumb(pl);
    const cnt     = (pl.videos||[]).length;
    return `<label style="display:flex;align-items:center;gap:.75rem;padding:.6rem .85rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s;${checked?'background:rgba(232,160,32,.07)':''}"
      onmouseover="this.style.background='var(--bg4)'" onmouseout="this.style.background='${checked?'rgba(232,160,32,.07)':''}'" >
      <input type="checkbox" value="${pl.id}" ${checked?'checked':''} onchange="toggleSecPl('${pl.id}',this.checked)"
        style="width:16px;height:16px;accent-color:var(--accent);flex-shrink:0">
      ${thumb?`<img src="${thumb}" style="width:54px;aspect-ratio:16/9;object-fit:cover;border-radius:5px;flex-shrink:0" onerror="this.style.display='none'">`
             :`<div style="width:54px;aspect-ratio:16/9;background:var(--bg4);border-radius:5px;flex-shrink:0;display:flex;align-items:center;justify-content:center;font-size:1.1rem">📋</div>`}
      <div style="min-width:0;flex:1">
        <div style="font-size:.82rem;font-weight:700;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name}</div>
        <div style="font-size:.68rem;color:var(--text2)">${cnt} video${cnt!==1?'s':''}</div>
      </div>
    </label>`;
  }).join('');
}

window.toggleSecPl = (id, checked)=>{
  if(checked && !secSelectedPls.includes(id)) secSelectedPls.push(id);
  if(!checked) secSelectedPls = secSelectedPls.filter(x=>x!==id);
  if(qs('secPlCount')) qs('secPlCount').textContent = `(${secSelectedPls.length} selected)`;
};

// ── Single-video picker ──
window.searchSecVids = ()=>{
  const q = (qs('secVidSearch').value||'').toLowerCase();
  const res = qs('secVidResults');
  if(!res) return;
  const filtered = allVideos.filter(v=>
    !secSelectedVids.includes(v.id) &&
    (v.title||'').toLowerCase().includes(q)
  ).slice(0,30);
  if(!filtered.length){res.innerHTML=`<div style="padding:.75rem 1rem;color:var(--text2);font-size:.8rem">No videos found</div>`;return;}
  res.innerHTML = filtered.map(v=>`
    <div onclick="addSecVid('${v.id}')" style="display:flex;align-items:center;gap:.65rem;padding:.55rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background .15s"
      onmouseover="this.style.background='var(--bg4)'" onmouseout="this.style.background=''">
      <img src="${getAdminThumb(v)}" style="width:56px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;background:#222"
        onerror="this.src='https://picsum.photos/seed/${v.id}/160/90'">
      <div style="min-width:0;flex:1">
        <div style="font-size:.78rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</div>
        <div style="font-size:.68rem;color:var(--text2)">${v.platform||v.source||''} · ${v.category||''}</div>
      </div>
      <div style="color:var(--accent);font-size:1.3rem;flex-shrink:0;line-height:1">+</div>
    </div>`).join('');
};
window.addSecVid = id=>{ if(!secSelectedVids.includes(id)) secSelectedVids.push(id); renderSecSelVids(); searchSecVids(); };
window.removeSecVid = id=>{ secSelectedVids=secSelectedVids.filter(x=>x!==id); renderSecSelVids(); searchSecVids(); };
function renderSecSelVids(){
  if(!qs('secSelCount')) return;
  qs('secSelCount').textContent=`(${secSelectedVids.length})`;
  const wrap=qs('secSelVids');
  if(!secSelectedVids.length){ wrap.innerHTML=`<span style="font-size:.75rem;color:var(--muted);padding:4px">None selected yet</span>`; return; }
  wrap.innerHTML=secSelectedVids.map(id=>{
    const v=allVideos.find(x=>x.id===id);
    return v?`<div style="display:flex;align-items:center;gap:5px;background:var(--bg4);border:1px solid var(--border2);border-radius:6px;padding:4px 8px 4px 4px">
      <img src="${getAdminThumb(v)}" style="width:40px;aspect-ratio:16/9;object-fit:cover;border-radius:3px">
      <span style="font-size:.72rem;font-weight:600;max-width:120px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</span>
      <button onclick="removeSecVid('${id}')" style="background:none;border:none;color:var(--red);font-size:.9rem;cursor:pointer;padding:0 0 0 2px">×</button>
    </div>`:'';
  }).join('');
}

// ── Add Section ──
window.addSection = async ()=>{
  const title = qs('secTitle').value.trim();
  const icon  = qs('secIcon').value;
  const type  = qs('secType').value;
  if(!title){ showToast('Error','Section title is required','err'); return; }

  let data = { title, icon, target_type: type, target_id: null,
    custom_thumb:'', custom_videos:[], playlist_ids:[],
    display_order: allSections.length, is_active:true, createdAt:new Date() };

  if(type==='multi_playlist'){
    if(!secSelectedPls.length){ showToast('Error','Tick at least one playlist','err'); return; }
    data.playlist_ids=[...secSelectedPls];
  }
  if(type==='single_videos'){
    if(!secSelectedVids.length){ showToast('Error','Pick at least one video','err'); return; }
    data.custom_videos=[...secSelectedVids];
  }
  if(type==='category'){
    const cat=qs('secCatSelect')?.value;
    if(!cat){ showToast('Error','Pick a category','err'); return; }
    data.target_id=cat;
  }

  try{
    const ref=await addDoc(collection(db,'home_sections'),data);
    allSections.push({id:ref.id,...data});
    qs('secTitle').value=''; qs('secVidSearch') && (qs('secVidSearch').value='');
    qs('secPlSearch') && (qs('secPlSearch').value='');
    secSelectedVids=[]; secSelectedPls=[];
    qs('secType').value='trending'; onSecTypeChange();
    showToast('Done!','Section added','ok');
    renderSections();
  }catch(e){ showToast('Error',e.message,'err'); }
};

// ── Render Sections List ──
async function renderSections(){
  try{
    const snap=await getDocs(collection(db,'home_sections'));
    allSections=snap.docs.map(d=>({id:d.id,...d.data()}))
      .sort((a,b)=>(a.display_order||0)-(b.display_order||0));
  }catch(e){}

  onSecTypeChange();
  const list=qs('sectionsList');
  if(!allSections.length){
    list.innerHTML=`<div style="padding:1.5rem;text-align:center;color:var(--text2);font-size:.85rem">No sections yet. Add one above!</div>`;
    return;
  }

  list.innerHTML=allSections.map((sec,i)=>{
    // label
    let typeLabel='';
    if(sec.target_type==='multi_playlist'){
      const names=(sec.playlist_ids||[]).map(id=>allPlaylists.find(p=>p.id===id)?.name||'?');
      typeLabel=`📋 ${names.length} playlist${names.length!==1?'s':''}: ${names.slice(0,3).join(', ')}${names.length>3?'…':''}`;
    } else if(sec.target_type==='single_videos'){
      typeLabel=`🎬 ${(sec.custom_videos||[]).length} video(s)`;
    } else if(sec.target_type==='category'){
      typeLabel=`🏷️ Category: ${sec.target_id||'?'}`;
    } else if(sec.target_type==='trending'){ typeLabel='🔥 Auto Trending';
    } else { typeLabel='✨ Auto Latest'; }

    // thumb preview: first playlist or first vid
    let thumbSrc='';
    if(sec.target_type==='multi_playlist'&&(sec.playlist_ids||[]).length){
      const pl=allPlaylists.find(p=>p.id===sec.playlist_ids[0]);
      thumbSrc=pl?getPlThumb(pl):'';
    } else if(sec.target_type==='single_videos'&&(sec.custom_videos||[]).length){
      const v=allVideos.find(x=>x.id===sec.custom_videos[0]);
      thumbSrc=v?getAdminThumb(v):'';
    }

    return `<div style="display:flex;align-items:center;gap:.85rem;background:var(--bg3);border:1px solid var(--border2);border-radius:10px;padding:.75rem 1rem;transition:border-color .2s"
        onmouseover="this.style.borderColor='var(--accent)'" onmouseout="this.style.borderColor='var(--border2)'" id="sec-row-${sec.id}">
      <div style="width:70px;aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:var(--bg4);flex-shrink:0">
        ${thumbSrc
          ?`<img src="${thumbSrc}" style="width:100%;height:100%;object-fit:cover" onerror="this.style.display='none'">`
          :`<div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;font-size:1.4rem">${sec.icon==='Flame'?'🔥':sec.icon==='Sparkles'?'✨':sec.icon==='Star'?'⭐':'▶'}</div>`}
      </div>
      <div style="flex:1;min-width:0">
        <div style="font-size:.88rem;font-weight:700;color:var(--text)">${sec.title}</div>
        <div style="font-size:.72rem;color:var(--text2);margin-top:2px">${typeLabel}</div>
      </div>
      <label style="display:flex;align-items:center;gap:5px;cursor:pointer;flex-shrink:0">
        <input type="checkbox" ${sec.is_active!==false?'checked':''} onchange="toggleSecActive('${sec.id}',this.checked)"
          style="width:14px;height:14px;accent-color:var(--accent)">
        <span style="font-size:.72rem;color:var(--text2)">Active</span>
      </label>
      <div style="display:flex;flex-direction:column;gap:3px;flex-shrink:0">
        <button onclick="moveSec('${sec.id}',-1)" style="background:var(--bg4);border:1px solid var(--border2);color:var(--text2);border-radius:4px;width:24px;height:22px;font-size:.7rem" ${i===0?'disabled':''}>▲</button>
        <button onclick="moveSec('${sec.id}',1)" style="background:var(--bg4);border:1px solid var(--border2);color:var(--text2);border-radius:4px;width:24px;height:22px;font-size:.7rem" ${i===allSections.length-1?'disabled':''}>▼</button>
      </div>
      <button onclick="editSec('${sec.id}')" class="act-btn act-edit" style="flex-shrink:0">✏️</button>
      <button onclick="deleteSec('${sec.id}')" class="act-btn act-del" style="flex-shrink:0">🗑️</button>
    </div>`;
  }).join('');
}

window.toggleSecActive=async(id,val)=>{
  try{ await updateDoc(doc(db,'home_sections',id),{is_active:val}); const s=allSections.find(x=>x.id===id); if(s)s.is_active=val; showToast('Updated',val?'Enabled':'Disabled','ok'); }catch(e){showToast('Error',e.message,'err');}
};

window.moveSec=async(id,dir)=>{
  const idx=allSections.findIndex(s=>s.id===id); const swap=allSections[idx+dir]; if(!swap)return;
  const a=allSections[idx].display_order||idx, b=swap.display_order||(idx+dir);
  try{
    await Promise.all([updateDoc(doc(db,'home_sections',id),{display_order:b}),updateDoc(doc(db,'home_sections',swap.id),{display_order:a})]);
    allSections[idx].display_order=b; swap.display_order=a;
    allSections.sort((x,y)=>(x.display_order||0)-(y.display_order||0));
    renderSections();
  }catch(e){showToast('Error',e.message,'err');}
};

window.deleteSec=async id=>{
  if(!confirm('Delete this section?'))return;
  try{ await deleteDoc(doc(db,'home_sections',id)); allSections=allSections.filter(s=>s.id!==id); renderSections(); showToast('Deleted','Section removed','ok'); }catch(e){showToast('Error',e.message,'err');}
};

// ── full edit modal state ──
let esSelectedVids=[], esSelectedPls=[];

window.editSec=id=>{
  const sec=allSections.find(s=>s.id===id); if(!sec)return;
  esSelectedVids=[...(sec.custom_videos||[])];
  esSelectedPls=[...(sec.playlist_ids||[])];

  const iconMap={'Flame':'🔥','Sparkles':'✨','Star':'⭐','Video':'🎬','Music':'🎵','TrendingUp':'📈','Grid':'▦','List':'📋'};
  const iconOpts=Object.entries(iconMap).map(([v,e])=>`<option value="${v}" ${v===sec.icon?'selected':''}>${e} ${v}</option>`).join('');
  const typeOpts=[['trending','🔥 Trending (auto)'],['latest','✨ Latest (auto)'],['multi_playlist','📋 Playlists'],['single_videos','🎬 Single Videos'],['category','🏷️ Category']]
    .map(([v,l])=>`<option value="${v}" ${v===sec.target_type?'selected':''}>${l}</option>`).join('');

  const html=`<div style="position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:1000;display:flex;align-items:center;justify-content:center;padding:1rem" id="secEditOverlay">
  <div style="background:var(--bg2);border:1px solid var(--border2);border-radius:16px;padding:1.75rem;width:580px;max-width:100%;max-height:90vh;overflow-y:auto">
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.25rem">
      <span style="font-size:1rem;font-weight:800">✏️ Edit Section</span>
      <button onclick="document.getElementById('secEditOverlay').remove()" style="background:none;border:none;color:var(--text2);font-size:1.4rem;cursor:pointer;line-height:1">×</button>
    </div>
    <div style="display:grid;grid-template-columns:1fr 160px;gap:.75rem;margin-bottom:.75rem">
      <div><label class="flabel">Title</label><input type="text" class="finput" id="esTitle" value="${sec.title||''}"></div>
      <div><label class="flabel">Icon</label><select class="finput" id="esIcon">${iconOpts}</select></div>
    </div>
    <label class="flabel">Content Type</label>
    <select class="finput" id="esType" onchange="onEsTypeChange()" style="margin-bottom:1rem">${typeOpts}</select>

    <div id="esPlPicker" style="display:none;margin-bottom:1rem">
      <label class="flabel" style="margin-bottom:.5rem;display:flex;justify-content:space-between">
        <span>Select Playlists</span><span id="esPlCount" style="color:var(--accent);font-weight:600">${esSelectedPls.length} selected</span>
      </label>
      <div style="position:relative;margin-bottom:.5rem">
        <input type="text" class="finput" id="esPlSearch" placeholder="Search playlists..." oninput="renderEsPlList(this.value)" style="padding-left:2rem">
        <span style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);opacity:.4">🔍</span>
      </div>
      <div id="esPlList" style="max-height:220px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border2);border-radius:10px"></div>
    </div>

    <div id="esVidPicker" style="display:none;margin-bottom:1rem">
      <label class="flabel" style="margin-bottom:.5rem;display:flex;justify-content:space-between">
        <span>Pick Videos</span><span id="esVidCount" style="color:var(--accent);font-weight:600">${esSelectedVids.length} selected</span>
      </label>
      <div style="position:relative;margin-bottom:.5rem">
        <input type="text" class="finput" placeholder="Search videos..." oninput="searchEsVids(this.value)" style="padding-left:2rem">
        <span style="position:absolute;left:.7rem;top:50%;transform:translateY(-50%);opacity:.4">🔍</span>
      </div>
      <div id="esVidResults" style="max-height:190px;overflow-y:auto;background:var(--bg3);border:1px solid var(--border2);border-radius:8px;margin-bottom:.6rem"></div>
      <div style="font-size:.7rem;color:var(--text2);font-weight:700;margin-bottom:.3rem;text-transform:uppercase;letter-spacing:.06em">Selected</div>
      <div id="esSelVids" style="display:flex;flex-wrap:wrap;gap:5px;min-height:32px;padding:5px;background:var(--bg3);border:1px solid var(--border2);border-radius:8px"></div>
    </div>

    <div id="esCatPicker" style="display:none;margin-bottom:1rem">
      <label class="flabel">Select Category</label>
      <select class="finput" id="esCatSelect">
        ${allCategories.map(c=>`<option value="${c.name}" ${c.name===sec.target_id?'selected':''}>${c.ico||''} ${c.name}</option>`).join('')}
      </select>
    </div>

    <button onclick="saveSecEdit('${id}')" class="submit-btn" style="width:100%;margin-top:.25rem">💾 Save Changes</button>
  </div>
</div>`;
  document.body.insertAdjacentHTML('beforeend',html);
  onEsTypeChange();
};

window.onEsTypeChange=()=>{
  const t=document.getElementById('esType')?.value; if(!t)return;
  document.getElementById('esPlPicker').style.display  = t==='multi_playlist'?'':'none';
  document.getElementById('esVidPicker').style.display = t==='single_videos'?'':'none';
  document.getElementById('esCatPicker').style.display = t==='category'?'':'none';
  if(t==='multi_playlist') renderEsPlList('');
  if(t==='single_videos')  { renderEsSelVids(); searchEsVids(''); }
};

window.renderEsPlList=(q='')=>{
  const box=document.getElementById('esPlList'); if(!box)return;
  const filtered=allPlaylists.filter(p=>(p.name||'').toLowerCase().includes((q||'').toLowerCase()));
  if(!filtered.length){box.innerHTML=`<div style="padding:.75rem;color:var(--text2);font-size:.8rem">No playlists</div>`;return;}
  box.innerHTML=filtered.map(pl=>{
    const checked=esSelectedPls.includes(pl.id);
    const thumb=getPlThumb(pl);
    return `<label style="display:flex;align-items:center;gap:.75rem;padding:.55rem .85rem;cursor:pointer;border-bottom:1px solid var(--border);background:${checked?'rgba(232,160,32,.08)':''}">
      <input type="checkbox" value="${pl.id}" ${checked?'checked':''} onchange="toggleEsPl('${pl.id}',this.checked)" style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0">
      ${thumb?`<img src="${thumb}" style="width:52px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex-shrink:0">`:`<div style="width:52px;aspect-ratio:16/9;background:var(--bg4);border-radius:4px;display:flex;align-items:center;justify-content:center;flex-shrink:0">📋</div>`}
      <div style="min-width:0;flex:1">
        <div style="font-size:.8rem;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${pl.name}</div>
        <div style="font-size:.67rem;color:var(--text2)">${(pl.videos||[]).length} videos</div>
      </div>
    </label>`;
  }).join('');
};
window.toggleEsPl=(id,checked)=>{
  if(checked&&!esSelectedPls.includes(id)) esSelectedPls.push(id);
  if(!checked) esSelectedPls=esSelectedPls.filter(x=>x!==id);
  const cnt=document.getElementById('esPlCount'); if(cnt)cnt.textContent=`${esSelectedPls.length} selected`;
};
window.searchEsVids=(q='')=>{
  const box=document.getElementById('esVidResults'); if(!box)return;
  const filtered=allVideos.filter(v=>!esSelectedVids.includes(v.id)&&(v.title||'').toLowerCase().includes((q||'').toLowerCase())).slice(0,40);
  if(!filtered.length){box.innerHTML=`<div style="padding:.6rem .9rem;color:var(--text2);font-size:.8rem">No videos found</div>`;return;}
  box.innerHTML=filtered.map(v=>`
    <div onclick="addEsVid('${v.id}')" style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s"
      onmouseover="this.style.background='var(--bg4)'" onmouseout="this.style.background=''">
      <img src="${getAdminThumb(v)}" style="width:52px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex-shrink:0">
      <div style="min-width:0;flex:1">
        <div style="font-size:.78rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</div>
        <div style="font-size:.67rem;color:var(--text2)">${v.category||''}</div>
      </div>
      <span style="color:var(--accent);font-size:1.3rem;line-height:1;flex-shrink:0">+</span>
    </div>`).join('');
};
window.addEsVid=id=>{ if(!esSelectedVids.includes(id)) esSelectedVids.push(id); renderEsSelVids(); searchEsVids(document.querySelector('#esVidPicker input')?.value||''); };
window.removeEsVid=id=>{ esSelectedVids=esSelectedVids.filter(x=>x!==id); renderEsSelVids(); searchEsVids(document.querySelector('#esVidPicker input')?.value||''); };
window.renderEsSelVids=()=>{
  const cnt=document.getElementById('esVidCount'); if(cnt)cnt.textContent=`${esSelectedVids.length} selected`;
  const wrap=document.getElementById('esSelVids'); if(!wrap)return;
  if(!esSelectedVids.length){wrap.innerHTML=`<span style="font-size:.73rem;color:var(--muted);padding:3px">None yet — search above</span>`;return;}
  wrap.innerHTML=esSelectedVids.map(id=>{
    const v=allVideos.find(x=>x.id===id);
    return v?`<div style="display:flex;align-items:center;gap:4px;background:var(--bg4);border:1px solid var(--border2);border-radius:5px;padding:3px 7px 3px 3px">
      <img src="${getAdminThumb(v)}" style="width:36px;aspect-ratio:16/9;object-fit:cover;border-radius:3px">
      <span style="font-size:.7rem;font-weight:600;max-width:100px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</span>
      <button onclick="removeEsVid('${id}')" style="background:none;border:none;color:var(--red);font-size:.9rem;cursor:pointer;padding:0;line-height:1;margin-left:2px">×</button>
    </div>`:'';
  }).join('');
};

window.saveSecEdit=async id=>{
  const title=document.getElementById('esTitle')?.value.trim();
  const icon =document.getElementById('esIcon')?.value;
  const type =document.getElementById('esType')?.value;
  if(!title){showToast('Error','Title required','err');return;}
  const updates={title,icon,target_type:type,target_id:null,playlist_ids:[],custom_videos:[]};
  if(type==='multi_playlist'){
    if(!esSelectedPls.length){showToast('Error','Select at least one playlist','err');return;}
    updates.playlist_ids=[...esSelectedPls];
  }
  if(type==='single_videos'){
    if(!esSelectedVids.length){showToast('Error','Select at least one video','err');return;}
    updates.custom_videos=[...esSelectedVids];
  }
  if(type==='category'){
    const cat=document.getElementById('esCatSelect')?.value;
    if(!cat){showToast('Error','Select a category','err');return;}
    updates.target_id=cat;
  }
  try{
    await updateDoc(doc(db,'home_sections',id),updates);
    const s=allSections.find(x=>x.id===id); if(s)Object.assign(s,updates);
    document.getElementById('secEditOverlay')?.remove();
    showToast('Saved!','Section updated','ok');
    renderSections();
  }catch(e){showToast('Error',e.message,'err');}
};

// ══════════════════════════════════════════
//  PLAYLIST ADD-VIDEO (inline per playlist)
// ══════════════════════════════════════════
window.togglePlAddVideo=plId=>{
  const box=document.getElementById(`pl-addvid-${plId}`);
  if(!box)return;
  const open=box.style.display==='none'||!box.style.display||box.style.display==='';
  box.style.display=open?'block':'none';
  if(open){ searchPlVid(plId); }
};

window.searchPlVid=(plId,q='')=>{
  const inp=document.getElementById(`pl-search-${plId}`);
  if(inp) q=inp.value||'';
  const pl=allPlaylists.find(p=>p.id===plId); if(!pl)return;
  const box=document.getElementById(`pl-results-${plId}`);
  if(!box)return;
  const existing=pl.videos||[];
  const filtered=allVideos.filter(v=>
    !existing.includes(v.id)&&
    (v.title||'').toLowerCase().includes(q.toLowerCase())
  ).slice(0,40);
  if(!filtered.length){box.innerHTML=`<div style="padding:.6rem .9rem;color:var(--text2);font-size:.78rem">No videos found</div>`;return;}
  box.innerHTML=filtered.map(v=>`
    <label style="display:flex;align-items:center;gap:.6rem;padding:.5rem .75rem;cursor:pointer;border-bottom:1px solid var(--border);transition:background .12s"
      onmouseover="this.style.background='var(--bg4)'" onmouseout="this.style.background=''">
      <input type="checkbox" value="${v.id}" style="width:15px;height:15px;accent-color:var(--accent);flex-shrink:0">
      <img src="${getAdminThumb(v)}" style="width:52px;aspect-ratio:16/9;object-fit:cover;border-radius:4px;flex-shrink:0"
        onerror="this.src='https://picsum.photos/seed/${v.id}/160/90'">
      <div style="min-width:0;flex:1">
        <div style="font-size:.77rem;font-weight:600;color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${v.title||''}</div>
        <div style="font-size:.66rem;color:var(--text2)">${v.platform||v.source||''} · ${v.category||''}</div>
      </div>
    </label>`).join('');
};

window.addCheckedToPlaylist=async plId=>{
  const box=document.getElementById(`pl-results-${plId}`);
  if(!box)return;
  const checked=[...box.querySelectorAll('input[type=checkbox]:checked')].map(c=>c.value);
  if(!checked.length){showToast('None selected','Tick videos to add','info');return;}
  const pl=allPlaylists.find(p=>p.id===plId); if(!pl)return;
  pl.videos=[...(pl.videos||[]),...checked.filter(id=>!(pl.videos||[]).includes(id))];
  try{
    await updateDoc(doc(db,'playlists',plId),{videos:pl.videos});
    showToast('Added',`${checked.length} video${checked.length!==1?'s':''} added to playlist`,'ok');
    renderPlaylists();
  }catch(e){showToast('Error',e.message,'err');}
};

// (settings loaded via initLogin below)

// ── AUTO START ──
// ── COMMENTS PANEL ──────────────────────────────────
let allComments=[];

async function loadComments(){
  const snap=await getDocs(query(collection(db,'comments'),orderBy('createdAt','desc')));
  allComments=snap.docs.map(d=>({id:d.id,...d.data()}));
  renderAdminComments(allComments);
}

window.filterComments=()=>{
  const q=(qs('commentSearch')?.value||'').toLowerCase();
  const filtered=q?allComments.filter(c=>(c.name||'').toLowerCase().includes(q)||(c.text||'').toLowerCase().includes(q)):allComments;
  renderAdminComments(filtered);
};

function renderAdminComments(list){
  const el=qs('commentsAdminList');
  qs('commentsEmpty').style.display=list.length?'none':'flex';
  if(!list.length){ el.innerHTML=''; return; }
  el.innerHTML=list.map(c=>{
    const vid=allVideos.find(v=>v.id===c.videoId);
    const time=c.createdAt?.toDate?c.createdAt.toDate().toLocaleString():'—';
    return`<div style="background:var(--bg3);border:1px solid var(--border2);border-radius:12px;padding:.9rem 1rem;display:flex;gap:1rem;align-items:flex-start" id="acmt-${c.id}">
      <div style="flex:1;min-width:0">
        <div style="display:flex;align-items:center;gap:.6rem;margin-bottom:.4rem;flex-wrap:wrap">
          <span style="font-size:.82rem;font-weight:800;color:#ddd">${escHtml(c.name||'Anonymous')}</span>
          <span style="font-size:.68rem;color:var(--text2)">${time}</span>
          ${vid?`<a href="/watch/${vid.id}" target="_blank" style="font-size:.65rem;color:var(--accent);font-weight:700;background:rgba(232,160,32,.1);padding:1px 7px;border-radius:9999px">📺 ${(vid.title||'').slice(0,30)}</a>`:''}
        </div>
        <div style="font-size:.83rem;color:#999;line-height:1.55">${escHtml(c.text||'')}</div>
      </div>
      <button onclick="adminDeleteComment('${c.id}')" style="background:rgba(239,68,68,.1);border:1px solid rgba(239,68,68,.25);color:#ef4444;border-radius:8px;padding:.4rem .75rem;font-size:.72rem;font-weight:700;cursor:pointer;flex-shrink:0;transition:all .2s" onmouseover="this.style.background='rgba(239,68,68,.2)'" onmouseout="this.style.background='rgba(239,68,68,.1)'">🗑 Delete</button>
    </div>`;
  }).join('');
}

function escHtml(s){ return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

window.adminDeleteComment=async(id)=>{
  if(!confirm('Delete this comment?'))return;
  try{
    await deleteDoc(doc(db,'comments',id));
    allComments=allComments.filter(c=>c.id!==id);
    document.getElementById('acmt-'+id)?.remove();
    showToast('Deleted','Comment removed','ok');
    if(!allComments.length) qs('commentsEmpty').style.display='flex';
  }catch(e){ showToast('Error',e.message,'err'); }
};

// Load comments when panel opens
const _origShowPanel=window.showPanel;
window.showPanel=(id,btn)=>{
  _origShowPanel(id,btn);
  if(id==='comments') loadComments();
};

loadAll();
