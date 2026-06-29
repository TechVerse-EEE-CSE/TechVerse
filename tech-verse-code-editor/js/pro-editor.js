// ══════════════════════════════════════
//  PRO EDITOR PANEL — js/pro-editor.js
//  Admin: imran.info.me@gmail.com only
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, getDocs,
  deleteDoc, doc, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytesResumable, getDownloadURL, deleteObject
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

// ── Init ──
const app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);
const auth    = getAuth(app);

const ADMIN_EMAIL = 'imran.info.me@gmail.com';
let isAdmin       = false;
let currentUser   = null;

// ── Auth watch ──
onAuthStateChanged(auth, user => {
  currentUser = user;
  isAdmin     = user?.email === ADMIN_EMAIL;
  // panel open থাকলে refresh করো
  const panel = document.getElementById('panel-proeditor');
  if (panel?.classList.contains('active')) renderProPanel();
});

// ══════════════════════════════════════
//  RENDER — পুরো Pro Editor panel
// ══════════════════════════════════════
window.renderProPanel = async function () {
  const container = document.getElementById('proEditorContent');
  if (!container) return;

  container.innerHTML = `<div class="pro-loading"><i class="fa-solid fa-spinner fa-spin"></i> লোড হচ্ছে…</div>`;

  try {
    const [links, posts, pdfs, videos] = await Promise.all([
      fetchCol('pro_links'),
      fetchCol('pro_posts'),
      fetchCol('pro_pdfs'),
      fetchCol('pro_videos'),
    ]);

    container.innerHTML = `

      ${isAdmin ? adminToolbar() : ''}

      <!-- ── Links Section ── -->
      <div class="pro-section">
        <div class="pro-section-title"><i class="fa-solid fa-link"></i> Links</div>
        <div class="pro-links-grid" id="proLinksGrid">
          ${links.length ? links.map(l => linkCard(l)).join('') : emptyState('কোনো link নেই')}
        </div>
      </div>

      <!-- ── Learning Posts ── -->
      <div class="pro-section">
        <div class="pro-section-title"><i class="fa-solid fa-book-open"></i> Learning Posts</div>
        <div class="pro-posts-list" id="proPostsList">
          ${posts.length ? posts.map(p => postCard(p)).join('') : emptyState('কোনো post নেই')}
        </div>
      </div>

      <!-- ── PDFs ── -->
      <div class="pro-section">
        <div class="pro-section-title"><i class="fa-solid fa-file-pdf"></i> PDF Resources</div>
        <div class="pro-pdf-list" id="proPdfList">
          ${pdfs.length ? pdfs.map(p => pdfCard(p)).join('') : emptyState('কোনো PDF নেই')}
        </div>
      </div>

      <!-- ── Videos ── -->
      <div class="pro-section">
        <div class="pro-section-title"><i class="fa-brands fa-youtube"></i> Video Lessons</div>
        <div class="pro-video-list" id="proVideoList">
          ${videos.length ? videos.map(v => videoCard(v)).join('') : emptyState('কোনো video নেই')}
        </div>
      </div>

    `;

    // Admin modal গুলো body তে আছে কিনা চেক করো
    ensureAdminModals();

  } catch (e) {
    container.innerHTML = `<div class="pro-error"><i class="fa-solid fa-triangle-exclamation"></i> লোড ব্যর্থ হয়েছে।</div>`;
    console.error(e);
  }
};

// ══════════════════════════════════════
//  CARD TEMPLATES
// ══════════════════════════════════════
function linkCard(l) {
  const icons = {
    facebook:  'fa-brands fa-facebook',
    youtube:   'fa-brands fa-youtube',
    instagram: 'fa-brands fa-instagram',
    twitter:   'fa-brands fa-x-twitter',
    github:    'fa-brands fa-github',
    web:       'fa-solid fa-globe',
    editor:    'fa-solid fa-code',
  };
  const icon = icons[l.type] || icons.web;
  const colors = {
    facebook:'#1877f2', youtube:'#ff0000', instagram:'#e1306c',
    twitter:'#1da1f2',  github:'#ffffff',  web:'#5b8dee', editor:'#10c98f',
  };
  const color = colors[l.type] || colors.web;
  return `
    <a class="pro-link-card" href="${l.url}" target="_blank" rel="noopener">
      <i class="${icon}" style="color:${color};font-size:20px;"></i>
      <span>${l.label}</span>
      ${isAdmin ? `<button class="pro-del-btn" onclick="proDeleteItem(event,'pro_links','${l.id}')"><i class="fa-solid fa-xmark"></i></button>` : ''}
    </a>`;
}

function postCard(p) {
  return `
    <div class="pro-post-card">
      <div class="pro-post-title">${p.title}</div>
      <div class="pro-post-body">${p.body}</div>
      <div class="pro-post-meta">${formatDate(p.createdAt)}</div>
      ${isAdmin ? `<button class="pro-del-btn" onclick="proDeleteItem(event,'pro_posts','${p.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;
}

function pdfCard(p) {
  return `
    <div class="pro-pdf-card">
      <i class="fa-solid fa-file-pdf" style="color:#ef4444;font-size:22px;"></i>
      <div class="pro-pdf-info">
        <div class="pro-pdf-name">${p.name}</div>
        <div class="pro-pdf-size">${p.sizeKB || '?'} KB</div>
      </div>
      <a class="pro-pdf-open" href="${p.url}" target="_blank"><i class="fa-solid fa-arrow-up-right-from-square"></i></a>
      ${isAdmin ? `<button class="pro-del-btn" onclick="proDeletePdf(event,'${p.id}','${p.storagePath}')"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;
}

function videoCard(v) {
  const videoId = extractYouTubeId(v.url);
  return `
    <div class="pro-video-card">
      <div class="pro-video-title">${v.title}</div>
      ${videoId
        ? `<iframe src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen loading="lazy"></iframe>`
        : `<a href="${v.url}" target="_blank">${v.url}</a>`}
      ${isAdmin ? `<button class="pro-del-btn" onclick="proDeleteItem(event,'pro_videos','${v.id}')"><i class="fa-solid fa-trash"></i></button>` : ''}
    </div>`;
}

function adminToolbar() {
  return `
    <div class="pro-admin-bar">
      <span class="pro-admin-badge"><i class="fa-solid fa-shield-halved"></i> Admin Mode</span>
      <div class="pro-admin-btns">
        <button onclick="proOpenModal('link')"><i class="fa-solid fa-link"></i> Link</button>
        <button onclick="proOpenModal('post')"><i class="fa-solid fa-pen"></i> Post</button>
        <button onclick="proOpenModal('pdf')"><i class="fa-solid fa-file-pdf"></i> PDF</button>
        <button onclick="proOpenModal('video')"><i class="fa-brands fa-youtube"></i> Video</button>
      </div>
    </div>`;
}

function emptyState(msg) {
  return `<div class="pro-empty"><i class="fa-solid fa-inbox"></i> ${msg}</div>`;
}

// ══════════════════════════════════════
//  ADMIN — MODALS
// ══════════════════════════════════════
function ensureAdminModals() {
  if (document.getElementById('proAdminModal')) return;

  const el = document.createElement('div');
  el.innerHTML = `
  <div class="modal" id="proAdminModal">
    <div class="modal-content" style="width:420px;max-width:95vw;">

      <!-- LINK FORM -->
      <div id="proFormLink">
        <h3><i class="fa-solid fa-link"></i> নতুন Link যোগ করুন</h3>
        <div class="modal-label">Label</div>
        <input type="text" id="proLinkLabel" placeholder="যেমন: আমাদের Facebook Page">
        <div class="modal-label">URL</div>
        <input type="url" id="proLinkUrl" placeholder="https://...">
        <div class="modal-label">Type</div>
        <select id="proLinkType">
          <option value="web">🌐 Website</option>
          <option value="editor">💻 Code Editor (/code-editor/)</option>
          <option value="facebook">📘 Facebook</option>
          <option value="youtube">▶️ YouTube</option>
          <option value="instagram">📸 Instagram</option>
          <option value="github">🐙 GitHub</option>
          <option value="twitter">🐦 Twitter/X</option>
        </select>
        <div class="btn-group">
          <button class="btn btn-cancel" onclick="closeModal('proAdminModal')">Cancel</button>
          <button class="btn btn-primary" onclick="proSaveLink()"><i class="fa-solid fa-plus"></i> যোগ করুন</button>
        </div>
      </div>

      <!-- POST FORM -->
      <div id="proFormPost" style="display:none">
        <h3><i class="fa-solid fa-pen"></i> নতুন Post লিখুন</h3>
        <div class="modal-label">Title</div>
        <input type="text" id="proPostTitle" placeholder="Post এর শিরোনাম">
        <div class="modal-label">Content</div>
        <textarea id="proPostBody" rows="6" placeholder="এখানে লিখুন…" style="width:100%;background:rgba(255,255,255,0.05);color:#fff;border:1px solid rgba(255,255,255,0.1);border-radius:8px;padding:10px;font-family:inherit;resize:vertical;box-sizing:border-box;"></textarea>
        <div class="btn-group">
          <button class="btn btn-cancel" onclick="closeModal('proAdminModal')">Cancel</button>
          <button class="btn btn-primary" onclick="proSavePost()"><i class="fa-solid fa-paper-plane"></i> Publish</button>
        </div>
      </div>

      <!-- PDF FORM -->
      <div id="proFormPdf" style="display:none">
        <h3><i class="fa-solid fa-file-pdf"></i> PDF আপলোড করুন</h3>
        <div class="modal-label">PDF File</div>
        <input type="file" id="proPdfFile" accept=".pdf" style="color:#fff;width:100%;margin-bottom:12px;">
        <div class="pro-upload-progress" id="proUploadProgress" style="display:none">
          <div class="pro-progress-bar"><div class="pro-progress-fill" id="proProgressFill"></div></div>
          <div class="pro-progress-text" id="proProgressText">0%</div>
        </div>
        <div class="btn-group">
          <button class="btn btn-cancel" onclick="closeModal('proAdminModal')">Cancel</button>
          <button class="btn btn-primary" onclick="proUploadPdf()"><i class="fa-solid fa-upload"></i> Upload</button>
        </div>
      </div>

      <!-- VIDEO FORM -->
      <div id="proFormVideo" style="display:none">
        <h3><i class="fa-brands fa-youtube"></i> YouTube Video যোগ করুন</h3>
        <div class="modal-label">Title</div>
        <input type="text" id="proVideoTitle" placeholder="Video এর নাম">
        <div class="modal-label">YouTube URL</div>
        <input type="url" id="proVideoUrl" placeholder="https://youtube.com/watch?v=...">
        <div class="btn-group">
          <button class="btn btn-cancel" onclick="closeModal('proAdminModal')">Cancel</button>
          <button class="btn btn-primary" onclick="proSaveVideo()"><i class="fa-solid fa-plus"></i> যোগ করুন</button>
        </div>
      </div>

    </div>
  </div>`;
  document.body.appendChild(el.firstElementChild);
}

// ── Modal open ──
window.proOpenModal = function(type) {
  ensureAdminModals();
  ['link','post','pdf','video'].forEach(t => {
    document.getElementById(`proForm${t.charAt(0).toUpperCase()+t.slice(1)}`).style.display = t === type ? '' : 'none';
  });
  document.getElementById('proAdminModal').classList.add('show');
};

// ══════════════════════════════════════
//  ADMIN — SAVE ACTIONS
// ══════════════════════════════════════
window.proSaveLink = async function() {
  const label = document.getElementById('proLinkLabel').value.trim();
  const url   = document.getElementById('proLinkUrl').value.trim();
  const type  = document.getElementById('proLinkType').value;
  if (!label || !url) return showToast('Label ও URL দিন', 'error', 'fa-triangle-exclamation');

  await addDoc(collection(db, 'pro_links'), { label, url, type, createdAt: serverTimestamp() });
  closeModal('proAdminModal');
  showToast('Link যোগ হয়েছে!', 'success', 'fa-link');
  renderProPanel();
};

window.proSavePost = async function() {
  const title = document.getElementById('proPostTitle').value.trim();
  const body  = document.getElementById('proPostBody').value.trim();
  if (!title || !body) return showToast('Title ও Content দিন', 'error', 'fa-triangle-exclamation');

  await addDoc(collection(db, 'pro_posts'), { title, body, createdAt: serverTimestamp() });
  closeModal('proAdminModal');
  showToast('Post publish হয়েছে!', 'success', 'fa-paper-plane');
  renderProPanel();
};

window.proUploadPdf = async function() {
  const file = document.getElementById('proPdfFile').files[0];
  if (!file) return showToast('PDF সিলেক্ট করুন', 'error', 'fa-triangle-exclamation');
  if (file.size > 10 * 1024 * 1024) return showToast('PDF সর্বোচ্চ 10MB হতে পারবে', 'error', 'fa-triangle-exclamation');

  const progressWrap = document.getElementById('proUploadProgress');
  const fill         = document.getElementById('proProgressFill');
  const text         = document.getElementById('proProgressText');
  progressWrap.style.display = 'block';

  const path      = `pro_pdfs/${Date.now()}_${file.name}`;
  const storageRef = ref(storage, path);
  const task      = uploadBytesResumable(storageRef, file);

  task.on('state_changed',
    snap => {
      const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
      fill.style.width = pct + '%';
      text.textContent = pct + '%';
    },
    err => {
      showToast('Upload ব্যর্থ: ' + err.message, 'error', 'fa-triangle-exclamation');
      progressWrap.style.display = 'none';
    },
    async () => {
      const url = await getDownloadURL(task.snapshot.ref);
      await addDoc(collection(db, 'pro_pdfs'), {
        name: file.name,
        url,
        storagePath: path,
        sizeKB: Math.round(file.size / 1024),
        createdAt: serverTimestamp()
      });
      closeModal('proAdminModal');
      showToast('PDF আপলোড হয়েছে!', 'success', 'fa-file-pdf');
      renderProPanel();
    }
  );
};

window.proSaveVideo = async function() {
  const title = document.getElementById('proVideoTitle').value.trim();
  const url   = document.getElementById('proVideoUrl').value.trim();
  if (!title || !url) return showToast('Title ও URL দিন', 'error', 'fa-triangle-exclamation');

  await addDoc(collection(db, 'pro_videos'), { title, url, createdAt: serverTimestamp() });
  closeModal('proAdminModal');
  showToast('Video যোগ হয়েছে!', 'success', 'fa-youtube');
  renderProPanel();
};

// ══════════════════════════════════════
//  ADMIN — DELETE
// ══════════════════════════════════════
window.proDeleteItem = async function(e, colName, id) {
  e.preventDefault(); e.stopPropagation();
  if (!confirm('মুছে ফেলবো?')) return;
  await deleteDoc(doc(db, colName, id));
  showToast('মুছে ফেলা হয়েছে', 'info', 'fa-trash');
  renderProPanel();
};

window.proDeletePdf = async function(e, id, storagePath) {
  e.preventDefault(); e.stopPropagation();
  if (!confirm('PDF মুছে ফেলবো?')) return;
  try { await deleteObject(ref(storage, storagePath)); } catch(_) {}
  await deleteDoc(doc(db, 'pro_pdfs', id));
  showToast('PDF মুছে ফেলা হয়েছে', 'info', 'fa-trash');
  renderProPanel();
};

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
async function fetchCol(colName) {
  const q    = query(collection(db, colName), orderBy('createdAt', 'asc'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

function extractYouTubeId(url) {
  const m = url.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/);
  return m ? m[1] : null;
}

function formatDate(ts) {
  if (!ts) return '';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('bn-BD', { year:'numeric', month:'short', day:'numeric' });
}

window._proEditorReady = true;
