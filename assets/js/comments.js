// ═══════════════════════════════════════════════════
//  comments.js — Comment & reply system
// ═══════════════════════════════════════════════════

const NAME_KEY='rkmn_username';
let _commentVideoId=null;
let _allComments=[];

// ── Username ──
function getSavedName(){ return localStorage.getItem(NAME_KEY)||''; }
function setSavedName(n){ localStorage.setItem(NAME_KEY,n); }
function initNameField(){
  const saved=getSavedName();
  const setup=$('username-setup');
  const form=$('comment-form-wrap');
  const avatar=$('comment-avatar');
  const display=$('username-display');
  if(saved){
    if(setup)setup.style.display='none';
    if(form)form.style.display='';
    if(display)display.textContent=saved;
    if(avatar){ avatar.textContent=saved[0].toUpperCase(); avatar.style.background=strColor(saved); }
  } else {
    if(setup)setup.style.display='';
    if(form)form.style.display='none';
  }
}
window.confirmUsername=()=>{
  const inp=$('username-input');
  const name=(inp?.value||'').trim();
  if(!name){ showToast('Enter a username first','err'); inp?.focus(); return; }
  if(name.length<2){ showToast('Username too short (min 2 chars)','err'); inp?.focus(); return; }
  if(!confirm(`Set "${name}" as your permanent username?\n\nThis cannot be changed later.`)) return;
  setSavedName(name);
  initNameField();
  showToast('Username set! You can now comment.','ok');
};

// ── Load & Render ──
async function loadComments(vid){
  _commentVideoId=vid;
  initNameField();
  const list=$('comments-list');
  if(!list)return;
  list.innerHTML=`<div class="comments-loading"><div class="loader-ring" style="width:16px;height:16px;border-width:2px"></div> Loading...</div>`;
  try{
    const {getDocs,collection,query,orderBy}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const snap=await getDocs(query(collection(window._core.db,'comments'),orderBy('createdAt','asc')));
    _allComments=snap.docs.map(d=>({id:d.id,...d.data()})).filter(c=>c.videoId===vid);
    renderComments();
  }catch(e){list.innerHTML=`<div class="comments-empty">Could not load comments.</div>`;}
}
function renderComments(){
  const list=$('comments-list');
  if(!list)return;
  const tops=_allComments.filter(c=>!c.parentId);
  const total=_allComments.length;
  $('comment-count').textContent=total?`(${total})`:'';
  if(!tops.length){list.innerHTML=`<div class="comments-empty">No comments yet. Be the first!</div>`;return;}
  list.innerHTML=tops.map(c=>buildComment(c,0)).join('');
}
function buildComment(c,depth){
  const init=(c.name||'U')[0].toUpperCase();
  const time=fmtTime(c.createdAt);
  const children=_allComments.filter(x=>x.parentId===c.id);
  const visible=children.slice(0,2);
  const hidden=children.slice(2);
  const saved=getSavedName();
  const avatarInit=(saved[0]||'U').toUpperCase();
  const avatarBg=saved?strColor(saved):'#555';
  const canReply=depth<2;
  const repliesHtml=`<div class="replies-wrap" id="replies-${c.id}" ${children.length?'':'style="display:none"'}>
    ${visible.map(r=>buildComment(r,depth+1)).join('')}
    ${hidden.length?`<button class="view-more-replies" onclick="showMoreReplies('${c.id}')">▸ View ${hidden.length} more repl${hidden.length===1?'y':'ies'}</button>`:''}
  </div>`;
  return`<div class="comment-item" id="cmt-${c.id}" data-depth="${depth}">
    <div class="comment-avatar ${depth>0?'sm':''}" style="background:${strColor(c.name||'')}">${init}</div>
    <div class="comment-body">
      <div class="comment-author">${escHtml(c.name||'Anonymous')}<span class="comment-time">${time}</span></div>
      ${c.replyTo?`<div class="replying-to">↩ replying to <strong>${escHtml(c.replyTo)}</strong></div>`:''}
      <div class="comment-text">${escHtml(c.text||'')}</div>
      <div class="comment-actions">
        ${canReply?`<button class="comment-reply-btn" onclick="toggleReplyForm('${c.id}','${escHtml(c.name||'Anonymous')}')">↩ Reply</button>`:''}
      </div>
      <div id="reply-form-${c.id}" style="display:none" class="reply-form-wrap">
        <div class="reply-form">
          <div class="comment-avatar sm" style="background:${avatarBg}">${avatarInit}</div>
          <div style="flex:1">
            <textarea class="reply-text-input" id="reply-text-${c.id}" placeholder="Reply to ${escHtml(c.name||'Anonymous')}..." maxlength="500"></textarea>
            <div style="display:flex;gap:6px;margin-top:5px">
              <button class="reply-submit" onclick="submitReply('${c.id}','${escHtml(c.name||'Anonymous')}')">Reply</button>
              <button class="reply-cancel" onclick="toggleReplyForm('${c.id}','')">Cancel</button>
            </div>
          </div>
        </div>
      </div>
      ${repliesHtml}
    </div>
  </div>`;
}

function fmtTime(ts){
  if(!ts?.toDate)return 'Just now';
  const d=ts.toDate(),now=new Date(),diff=Math.floor((now-d)/1000);
  if(diff<60)return 'Just now';
  if(diff<3600)return `${Math.floor(diff/60)}m ago`;
  if(diff<86400)return `${Math.floor(diff/3600)}h ago`;
  if(diff<604800)return `${Math.floor(diff/86400)}d ago`;
  return d.toLocaleDateString();
}
function strColor(s){const h=[...s].reduce((a,c)=>a+c.charCodeAt(0),0)%360;return `hsl(${h},55%,38%)`;}
function escHtml(s){return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

window.showMoreReplies=(parentId)=>{
  const children=_allComments.filter(x=>x.parentId===parentId);
  const wrap=document.getElementById('replies-'+parentId);
  if(!wrap)return;
  const depth=parseInt(document.getElementById('cmt-'+parentId)?.dataset.depth||0);
  wrap.innerHTML=children.map(r=>buildComment(r,depth+1)).join('');
};
window.toggleReplyForm=(parentId)=>{
  const form=document.getElementById('reply-form-'+parentId);
  if(!form)return;
  const isOpen=form.style.display!=='none';
  document.querySelectorAll('[id^="reply-form-"]').forEach(f=>f.style.display='none');
  if(!isOpen){form.style.display='';document.getElementById('reply-text-'+parentId)?.focus();}
};
window.submitComment=async()=>{
  const name=getSavedName();
  if(!name){showToast('Please set a username first','err');return;}
  const text=($('comment-text')?.value||'').trim();
  if(!text){showToast('Write something first','err');return;}
  if(!_commentVideoId)return;
  const btn=document.querySelector('.comment-submit');
  if(btn)btn.disabled=true;
  try{
    const {addDoc,collection,serverTimestamp}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await addDoc(collection(window._core.db,'comments'),{videoId:_commentVideoId,name,text,parentId:null,replyTo:null,createdAt:serverTimestamp()});
    $('comment-text').value='';
    showToast('Comment posted!','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to post','err');}
  if(btn)btn.disabled=false;
};
window.submitReply=async(parentId,replyToName)=>{
  const name=getSavedName();
  if(!name){showToast('Please set a username first','err');return;}
  const textEl=document.getElementById('reply-text-'+parentId);
  const text=(textEl?.value||'').trim();
  if(!text){showToast('Write something first','err');return;}
  if(!_commentVideoId)return;
  const btn=document.querySelector(`#reply-form-${parentId} .reply-submit`);
  if(btn)btn.disabled=true;
  try{
    const {addDoc,collection,serverTimestamp}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    await addDoc(collection(window._core.db,'comments'),{videoId:_commentVideoId,name,text,parentId,replyTo:replyToName,createdAt:serverTimestamp()});
    if(textEl)textEl.value='';
    document.getElementById('reply-form-'+parentId).style.display='none';
    showToast('Reply posted!','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to post','err');}
  if(btn)btn.disabled=false;
};
window.deleteComment=async(id)=>{
  if(!confirm('Delete this comment and all its replies?'))return;
  try{
    const {deleteDoc,doc}=await import("https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js");
    const gather=(pid)=>{ const kids=_allComments.filter(c=>c.parentId===pid).map(c=>c.id); return[pid,...kids.flatMap(kid=>gather(kid))]; };
    const ids=gather(id);
    await Promise.all([...new Set(ids)].map(cid=>deleteDoc(doc(window._core.db,'comments',cid))));
    showToast('Deleted','ok');
    await loadComments(_commentVideoId);
  }catch(e){showToast('Failed to delete','err');}
};
