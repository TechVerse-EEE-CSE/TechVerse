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
let isAdmin   = false;
let currentUser = null;

// ── Auth watch ──
onAuthStateChanged(auth, user => {
  currentUser = user;
  isAdmin     = user?.email === ADMIN_EMAIL;
  const panel = document.getElementById('panel-proeditor');
  if (panel?.classList.contains('active')) renderProPanel();
});

// ══════════════════════════════════════
//  ICON CONFIG (FA only — no emoji)
// ══════════════════════════════════════
const LINK_ICONS = {
  facebook:  { icon: 'fa-brands fa-facebook',   color: '#1877f2', bg: 'rgba(24,119,242,0.12)' },
  youtube:   { icon: 'fa-brands fa-youtube',    color: '#ff0000', bg: 'rgba(255,0,0,0.10)'    },
  instagram: { icon: 'fa-brands fa-instagram',  color: '#e1306c', bg: 'rgba(225,48,108,0.10)' },
  twitter:   { icon: 'fa-brands fa-x-twitter',  color: '#ffffff', bg: 'rgba(255,255,255,0.08)'},
  github:    { icon: 'fa-brands fa-github',     color: '#f0f6fc', bg: 'rgba(240,246,252,0.08)'},
  web:       { icon: 'fa-solid fa-globe',       color: '#60a5fa', bg: 'rgba(96,165,250,0.12)' },
  editor:    { icon: 'fa-solid fa-code',        color: '#10c98f', bg: 'rgba(16,201,143,0.12)' },
  telegram:  { icon: 'fa-brands fa-telegram',   color: '#2aabee', bg: 'rgba(42,171,238,0.12)' },
  linkedin:  { icon: 'fa-brands fa-linkedin',   color: '#0a66c2', bg: 'rgba(10,102,194,0.12)' },
  discord:   { icon: 'fa-brands fa-discord',    color: '#7289da', bg: 'rgba(114,137,218,0.12)'},
  whatsapp:  { icon: 'fa-brands fa-whatsapp',   color: '#25d366', bg: 'rgba(37,211,102,0.12)' },
};

const SECTION_ICONS = {
  links:  'fa-solid fa-link',
  posts:  'fa-solid fa-book-open',
  pdfs:   'fa-solid fa-file-pdf',
  videos: 'fa-brands fa-youtube',
};

// ══════════════════════════════════════
//  RENDER
// ══════════════════════════════════════
window.renderProPanel = async function () {
  const container = document.getElementById('proEditorContent');
  if (!container) return;

  container.innerHTML = `
    <div class="pro-loading">
      <i class="fa-solid fa-spinner fa-spin-pulse"></i>
      <span>লোড হচ্ছে…</span>
    </div>`;

  try {
    const [links, posts, pdfs, videos] = await Promise.all([
      fetchCol('pro_links'),
      fetchCol('pro_posts'),
      fetchCol('pro_pdfs'),
      fetchCol('pro_videos'),
    ]);

    container.innerHTML = `
      ${isAdmin ? adminToolbar() : ''}

      <div class="pro-section">
        <div class="pro-section-header">
          <i class="${SECTION_ICONS.links}"></i>
          <span>Links</span>
          <div class="pro-section-count">${links.length}</div>
        </div>
        <div class="pro-links-grid" id="proLinksGrid">
          ${links.length ? links.map(linkCard).join('') : emptyState('কোনো link যোগ হয়নি')}
        </div>
      </div>

      <div class="pro-section">
        <div class="pro-section-header">
          <i class="${SECTION_ICONS.posts}"></i>
          <span>Learning Posts</span>
          <div class="pro-section-count">${posts.length}</div>
        </div>
        <div class="pro-posts-list" id="proPostsList">
          ${posts.length ? posts.map(postCard).join('') : emptyState('কোনো post লেখা হয়নি')}
        </div>
      </div>

      <div class="pro-section">
        <div class="pro-section-header">
          <i class="${SECTION_ICONS.pdfs}"></i>
          <span>PDF Resources</span>
          <div class="pro-section-count">${pdfs.length}</div>
        </div>
        <div class="pro-pdf-list" id="proPdfList">
          ${pdfs.length ? pdfs.map(pdfCard).join('') : emptyState('কোনো PDF আপলোড হয়নি')}
        </div>
      </div>

      <div class="pro-section">
        <div class="pro-section-header">
          <i class="${SECTION_ICONS.videos}"></i>
          <span>Video Lessons</span>
          <div class="pro-section-count">${videos.length}</div>
        </div>
        <div class="pro-video-list" id="proVideoList">
          ${videos.length ? videos.map(videoCard).join('') : emptyState('কোনো video যোগ হয়নি')}
        </div>
      </div>
    `;

    ensureAdminModals();
    injectProStyles();

  } catch (e) {
    container.innerHTML = `
      <div class="pro-error">
        <i class="fa-solid fa-circle-exclamation"></i>
        <span>লোড ব্যর্থ হয়েছে। পুনরায় চেষ্টা করুন।</span>
      </div>`;
    console.error(e);
  }
};

// ══════════════════════════════════════
//  CARD TEMPLATES
// ══════════════════════════════════════
function linkCard(l) {
  const cfg   = LINK_ICONS[l.type] || LINK_ICONS.web;
  const delBtn = isAdmin
    ? `<button class="pro-del-btn" title="মুছুন" onclick="proDeleteItem(event,'pro_links','${l.id}')">
         <i class="fa-solid fa-xmark"></i>
       </button>`
    : '';
  return `
    <a class="pro-link-card" href="${l.url}" target="_blank" rel="noopener"
       style="--card-accent:${cfg.color};--card-bg:${cfg.bg}">
      <span class="pro-link-icon-wrap">
        <i class="${cfg.icon}"></i>
      </span>
      <span class="pro-link-label">${escHtml(l.label)}</span>
      <i class="fa-solid fa-arrow-up-right-from-square pro-link-arrow"></i>
      ${delBtn}
    </a>`;
}

function postCard(p) {
  const delBtn = isAdmin
    ? `<button class="pro-del-btn" title="মুছুন" onclick="proDeleteItem(event,'pro_posts','${p.id}')">
         <i class="fa-solid fa-trash-can"></i>
       </button>`
    : '';
  return `
    <div class="pro-post-card">
      <div class="pro-post-inner">
        <div class="pro-post-icon"><i class="fa-solid fa-book-open-reader"></i></div>
        <div class="pro-post-content">
          <div class="pro-post-title">${escHtml(p.title)}</div>
          <div class="pro-post-body">${escHtml(p.body)}</div>
          <div class="pro-post-meta">
            <i class="fa-regular fa-clock"></i> ${formatDate(p.createdAt)}
          </div>
        </div>
      </div>
      ${delBtn}
    </div>`;
}

function pdfCard(p) {
  const sizeStr = p.sizeKB >= 1024
    ? (p.sizeKB / 1024).toFixed(1) + ' MB'
    : (p.sizeKB || '?') + ' KB';
  const delBtn = isAdmin
    ? `<button class="pro-del-btn" title="মুছুন" onclick="proDeletePdf(event,'${p.id}','${p.storagePath}')">
         <i class="fa-solid fa-trash-can"></i>
       </button>`
    : '';
  return `
    <div class="pro-pdf-card">
      <span class="pro-pdf-icon-wrap">
        <i class="fa-solid fa-file-pdf"></i>
      </span>
      <div class="pro-pdf-info">
        <div class="pro-pdf-name" title="${escHtml(p.name)}">${escHtml(p.name)}</div>
        <div class="pro-pdf-meta">
          <i class="fa-solid fa-weight-hanging"></i> ${sizeStr}
        </div>
      </div>
      <a class="pro-pdf-open" href="${p.url}" target="_blank" title="খুলুন">
        <i class="fa-solid fa-file-arrow-down"></i>
      </a>
      ${delBtn}
    </div>`;
}

function videoCard(v) {
  const videoId = extractYouTubeId(v.url);
  const delBtn  = isAdmin
    ? `<button class="pro-del-btn pro-del-video" title="মুছুন" onclick="proDeleteItem(event,'pro_videos','${v.id}')">
         <i class="fa-solid fa-trash-can"></i>
       </button>`
    : '';
  return `
    <div class="pro-video-card">
      <div class="pro-video-header">
        <i class="fa-brands fa-youtube"></i>
        <span class="pro-video-title">${escHtml(v.title)}</span>
        ${delBtn}
      </div>
      <div class="pro-video-embed">
        ${videoId
          ? `<iframe
               src="https://www.youtube.com/embed/${videoId}?rel=0"
               frameborder="0"
               allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
               allowfullscreen
               loading="lazy">
             </iframe>`
          : `<div class="pro-video-fallback">
               <i class="fa-solid fa-circle-exclamation"></i>
               <a href="${v.url}" target="_blank">${v.url}</a>
             </div>`
        }
      </div>
    </div>`;
}

// ── Admin toolbar ──
function adminToolbar() {
  return `
    <div class="pro-admin-bar">
      <div class="pro-admin-badge">
        <i class="fa-solid fa-shield-halved"></i>
        <span>Admin Mode</span>
      </div>
      <div class="pro-admin-btns">
        <button class="pro-add-btn" onclick="proOpenModal('link')">
          <i class="fa-solid fa-link"></i> Link
        </button>
        <button class="pro-add-btn" onclick="proOpenModal('post')">
          <i class="fa-solid fa-pen-to-square"></i> Post
        </button>
        <button class="pro-add-btn" onclick="proOpenModal('pdf')">
          <i class="fa-solid fa-file-arrow-up"></i> PDF
        </button>
        <button class="pro-add-btn" onclick="proOpenModal('video')">
          <i class="fa-brands fa-youtube"></i> Video
        </button>
      </div>
    </div>`;
}

function emptyState(msg) {
  return `
    <div class="pro-empty">
      <i class="fa-solid fa-inbox"></i>
      <span>${msg}</span>
    </div>`;
}

// ══════════════════════════════════════
//  ADMIN MODALS
// ══════════════════════════════════════
function ensureAdminModals() {
  if (!isAdmin || document.getElementById('proAdminModal')) return;

  const el = document.createElement('div');
  el.innerHTML = `
  <div class="pro-modal-overlay" id="proAdminModal" onclick="proModalOutsideClick(event)">
    <div class="pro-modal-box">

      <button class="pro-modal-close" onclick="closeModal('proAdminModal')">
        <i class="fa-solid fa-xmark"></i>
      </button>

      <!-- LINK FORM -->
      <div id="proFormLink">
        <div class="pro-modal-title">
          <i class="fa-solid fa-link"></i> নতুন Link যোগ করুন
        </div>
        <label class="pro-field-label">Label</label>
        <input class="pro-input" type="text" id="proLinkLabel" placeholder="যেমন: আমাদের Facebook Page">
        <label class="pro-field-label">URL</label>
        <input class="pro-input" type="url" id="proLinkUrl" placeholder="https://...">
        <label class="pro-field-label">Type</label>
        <div class="pro-type-grid" id="proLinkTypeGrid">
          ${Object.entries(LINK_ICONS).map(([k, v]) => `
            <label class="pro-type-option">
              <input type="radio" name="proLinkType" value="${k}" ${k === 'web' ? 'checked' : ''}>
              <span class="pro-type-btn">
                <i class="${v.icon}" style="color:${v.color}"></i>
                <span>${k}</span>
              </span>
            </label>`).join('')}
        </div>
        <div class="pro-modal-footer">
          <button class="pro-btn-cancel" onclick="closeModal('proAdminModal')">বাতিল</button>
          <button class="pro-btn-primary" onclick="proSaveLink()">
            <i class="fa-solid fa-plus"></i> যোগ করুন
          </button>
        </div>
      </div>

      <!-- POST FORM -->
      <div id="proFormPost" style="display:none">
        <div class="pro-modal-title">
          <i class="fa-solid fa-pen-to-square"></i> নতুন Post লিখুন
        </div>
        <label class="pro-field-label">Title</label>
        <input class="pro-input" type="text" id="proPostTitle" placeholder="Post এর শিরোনাম">
        <label class="pro-field-label">Content</label>
        <textarea class="pro-input pro-textarea" id="proPostBody" rows="6" placeholder="এখানে লিখুন…"></textarea>
        <div class="pro-modal-footer">
          <button class="pro-btn-cancel" onclick="closeModal('proAdminModal')">বাতিল</button>
          <button class="pro-btn-primary" onclick="proSavePost()">
            <i class="fa-solid fa-paper-plane"></i> Publish
          </button>
        </div>
      </div>

      <!-- PDF FORM -->
      <div id="proFormPdf" style="display:none">
        <div class="pro-modal-title">
          <i class="fa-solid fa-file-arrow-up"></i> PDF আপলোড করুন
        </div>
        <label class="pro-field-label">PDF File (সর্বোচ্চ 10 MB)</label>
        <label class="pro-file-drop" id="proPdfDropZone">
          <input type="file" id="proPdfFile" accept=".pdf" style="display:none" onchange="proUpdateFileName(this)">
          <i class="fa-solid fa-cloud-arrow-up"></i>
          <span id="proPdfFileName">ফাইল বেছে নিন বা এখানে ড্রপ করুন</span>
        </label>
        <div class="pro-progress-wrap" id="proUploadProgress" style="display:none">
          <div class="pro-progress-bar">
            <div class="pro-progress-fill" id="proProgressFill"></div>
          </div>
          <div class="pro-progress-text" id="proProgressText">0%</div>
        </div>
        <div class="pro-modal-footer">
          <button class="pro-btn-cancel" onclick="closeModal('proAdminModal')">বাতিল</button>
          <button class="pro-btn-primary" onclick="proUploadPdf()">
            <i class="fa-solid fa-upload"></i> Upload
          </button>
        </div>
      </div>

      <!-- VIDEO FORM -->
      <div id="proFormVideo" style="display:none">
        <div class="pro-modal-title">
          <i class="fa-brands fa-youtube"></i> YouTube Video যোগ করুন
        </div>
        <label class="pro-field-label">Title</label>
        <input class="pro-input" type="text" id="proVideoTitle" placeholder="Video এর নাম">
        <label class="pro-field-label">YouTube URL</label>
        <input class="pro-input" type="url" id="proVideoUrl" placeholder="https://youtube.com/watch?v=...">
        <div class="pro-modal-footer">
          <button class="pro-btn-cancel" onclick="closeModal('proAdminModal')">বাতিল</button>
          <button class="pro-btn-primary" onclick="proSaveVideo()">
            <i class="fa-solid fa-plus"></i> যোগ করুন
          </button>
        </div>
      </div>

    </div>
  </div>`;
  document.body.appendChild(el.firstElementChild);

  // File drop zone click-to-browse
  document.getElementById('proPdfDropZone')?.addEventListener('click', () => {
    document.getElementById('proPdfFile').click();
  });

  // Drag and drop
  const dz = document.getElementById('proPdfDropZone');
  if (dz) {
    dz.addEventListener('dragover', e => { e.preventDefault(); dz.classList.add('drag-over'); });
    dz.addEventListener('dragleave', () => dz.classList.remove('drag-over'));
    dz.addEventListener('drop', e => {
      e.preventDefault();
      dz.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file && file.type === 'application/pdf') {
        const dt = new DataTransfer();
        dt.items.add(file);
        const input = document.getElementById('proPdfFile');
        input.files = dt.files;
        proUpdateFileName(input);
      }
    });
  }
}

// ── filename display after pick ──
window.proUpdateFileName = function(input) {
  const span = document.getElementById('proPdfFileName');
  if (span && input.files[0]) span.textContent = input.files[0].name;
};

// ── outside click closes modal ──
window.proModalOutsideClick = function(e) {
  if (e.target.id === 'proAdminModal') closeModal('proAdminModal');
};

// ── open modal & show right form ──
window.proOpenModal = function(type) {
  ensureAdminModals();
  ['Link','Post','Pdf','Video'].forEach(t => {
    const el = document.getElementById(`proForm${t}`);
    if (el) el.style.display = t.toLowerCase() === type ? '' : 'none';
  });
  document.getElementById('proAdminModal').classList.add('show');
};

// ══════════════════════════════════════
//  SAVE ACTIONS
// ══════════════════════════════════════
window.proSaveLink = async function() {
  const label = document.getElementById('proLinkLabel').value.trim();
  const url   = document.getElementById('proLinkUrl').value.trim();
  const type  = document.querySelector('input[name="proLinkType"]:checked')?.value || 'web';
  if (!label || !url) return showToast('Label ও URL দিন', 'error', 'fa-circle-exclamation');
  if (!isValidUrl(url)) return showToast('সঠিক URL দিন', 'error', 'fa-circle-exclamation');

  try {
    await addDoc(collection(db, 'pro_links'), { label, url, type, createdAt: serverTimestamp() });
    closeModal('proAdminModal');
    showToast('Link যোগ হয়েছে', 'success', 'fa-circle-check');
    renderProPanel();
  } catch(e) {
    showToast('ব্যর্থ হয়েছে: ' + e.message, 'error', 'fa-circle-exclamation');
  }
};

window.proSavePost = async function() {
  const title = document.getElementById('proPostTitle').value.trim();
  const body  = document.getElementById('proPostBody').value.trim();
  if (!title || !body) return showToast('Title ও Content দিন', 'error', 'fa-circle-exclamation');

  try {
    await addDoc(collection(db, 'pro_posts'), { title, body, createdAt: serverTimestamp() });
    closeModal('proAdminModal');
    showToast('Post publish হয়েছে', 'success', 'fa-circle-check');
    renderProPanel();
  } catch(e) {
    showToast('ব্যর্থ হয়েছে: ' + e.message, 'error', 'fa-circle-exclamation');
  }
};

window.proUploadPdf = async function() {
  const file = document.getElementById('proPdfFile').files[0];
  if (!file) return showToast('PDF সিলেক্ট করুন', 'error', 'fa-circle-exclamation');
  if (file.type !== 'application/pdf') return showToast('শুধুমাত্র PDF ফাইল আপলোড করুন', 'error', 'fa-circle-exclamation');
  if (file.size > 10 * 1024 * 1024) return showToast('PDF সর্বোচ্চ 10 MB হতে পারবে', 'error', 'fa-circle-exclamation');

  const progressWrap = document.getElementById('proUploadProgress');
  const fill = document.getElementById('proProgressFill');
  const text = document.getElementById('proProgressText');
  progressWrap.style.display = 'block';

  const path = `pro_pdfs/${Date.now()}_${file.name}`;
  const task = uploadBytesResumable(ref(storage, path), file);

  task.on('state_changed',
    snap => {
      const pct = Math.round(snap.bytesTransferred / snap.totalBytes * 100);
      fill.style.width  = pct + '%';
      text.textContent  = pct + '%';
    },
    err => {
      showToast('Upload ব্যর্থ: ' + err.message, 'error', 'fa-circle-exclamation');
      progressWrap.style.display = 'none';
    },
    async () => {
      try {
        const url = await getDownloadURL(task.snapshot.ref);
        await addDoc(collection(db, 'pro_pdfs'), {
          name: file.name, url,
          storagePath: path,
          sizeKB: Math.round(file.size / 1024),
          createdAt: serverTimestamp(),
        });
        closeModal('proAdminModal');
        showToast('PDF আপলোড সম্পন্ন', 'success', 'fa-circle-check');
        renderProPanel();
      } catch(e) {
        showToast('সেভ ব্যর্থ: ' + e.message, 'error', 'fa-circle-exclamation');
        progressWrap.style.display = 'none';
      }
    }
  );
};

window.proSaveVideo = async function() {
  const title = document.getElementById('proVideoTitle').value.trim();
  const url   = document.getElementById('proVideoUrl').value.trim();
  if (!title || !url) return showToast('Title ও URL দিন', 'error', 'fa-circle-exclamation');
  if (!extractYouTubeId(url)) return showToast('সঠিক YouTube URL দিন', 'error', 'fa-circle-exclamation');

  try {
    await addDoc(collection(db, 'pro_videos'), { title, url, createdAt: serverTimestamp() });
    closeModal('proAdminModal');
    showToast('Video যোগ হয়েছে', 'success', 'fa-circle-check');
    renderProPanel();
  } catch(e) {
    showToast('ব্যর্থ হয়েছে: ' + e.message, 'error', 'fa-circle-exclamation');
  }
};

// ══════════════════════════════════════
//  DELETE
// ══════════════════════════════════════
window.proDeleteItem = async function(e, colName, id) {
  e.preventDefault(); e.stopPropagation();
  if (!confirm('আইটেমটি মুছে ফেলবেন?')) return;
  try {
    await deleteDoc(doc(db, colName, id));
    showToast('মুছে ফেলা হয়েছে', 'info', 'fa-trash-can');
    renderProPanel();
  } catch(err) {
    showToast('মুছতে ব্যর্থ: ' + err.message, 'error', 'fa-circle-exclamation');
  }
};

window.proDeletePdf = async function(e, id, storagePath) {
  e.preventDefault(); e.stopPropagation();
  if (!confirm('PDF মুছে ফেলবেন?')) return;
  try { await deleteObject(ref(storage, storagePath)); } catch(_) {}
  try {
    await deleteDoc(doc(db, 'pro_pdfs', id));
    showToast('PDF মুছে ফেলা হয়েছে', 'info', 'fa-trash-can');
    renderProPanel();
  } catch(err) {
    showToast('মুছতে ব্যর্থ: ' + err.message, 'error', 'fa-circle-exclamation');
  }
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
  return d.toLocaleDateString('bn-BD', { year: 'numeric', month: 'short', day: 'numeric' });
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

function isValidUrl(str) {
  try { new URL(str); return true; } catch(_) { return false; }
}

// ══════════════════════════════════════
//  INJECT STYLES (one-time)
// ══════════════════════════════════════
function injectProStyles() {
  if (document.getElementById('pro-editor-styles')) return;
  const style = document.createElement('style');
  style.id = 'pro-editor-styles';
  style.textContent = `
/* ─── Loading / Error ───────────────────────────────── */
.pro-loading,
.pro-error {
  display: flex; align-items: center; gap: 12px;
  justify-content: center; padding: 48px 20px;
  color: rgba(255,255,255,0.45); font-size: 15px;
}
.pro-error { color: #f87171; }
.pro-loading i { font-size: 22px; }
.pro-error i   { font-size: 22px; }

/* ─── Empty state ────────────────────────────────────── */
.pro-empty {
  display: flex; flex-direction: column; align-items: center; gap: 8px;
  padding: 32px 20px; color: rgba(255,255,255,0.25); font-size: 13px;
}
.pro-empty i { font-size: 28px; }

/* ─── Admin bar ──────────────────────────────────────── */
.pro-admin-bar {
  display: flex; align-items: center; justify-content: space-between;
  flex-wrap: wrap; gap: 10px;
  padding: 10px 14px;
  background: rgba(16,201,143,0.08);
  border: 1px solid rgba(16,201,143,0.2);
  border-radius: 10px;
  margin-bottom: 18px;
}
.pro-admin-badge {
  display: flex; align-items: center; gap: 7px;
  font-size: 12px; font-weight: 600; letter-spacing: .5px;
  color: #10c98f;
}
.pro-admin-btns { display: flex; flex-wrap: wrap; gap: 7px; }
.pro-add-btn {
  display: flex; align-items: center; gap: 6px;
  padding: 6px 13px; font-size: 12.5px; font-weight: 500;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 7px; color: #fff; cursor: pointer;
  transition: background .18s, border-color .18s;
}
.pro-add-btn:hover {
  background: rgba(255,255,255,0.12);
  border-color: rgba(255,255,255,0.22);
}

/* ─── Sections ───────────────────────────────────────── */
.pro-section { margin-bottom: 28px; }
.pro-section-header {
  display: flex; align-items: center; gap: 9px;
  font-size: 14px; font-weight: 600; color: rgba(255,255,255,0.75);
  margin-bottom: 12px; padding-bottom: 9px;
  border-bottom: 1px solid rgba(255,255,255,0.07);
}
.pro-section-header i { font-size: 15px; color: #10c98f; }
.pro-section-count {
  margin-left: auto;
  background: rgba(255,255,255,0.07);
  color: rgba(255,255,255,0.4);
  font-size: 11px; font-weight: 600;
  padding: 2px 8px; border-radius: 20px;
}

/* ─── Link cards ─────────────────────────────────────── */
.pro-links-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 10px;
}
.pro-link-card {
  position: relative;
  display: flex; align-items: center; gap: 10px;
  padding: 11px 13px;
  background: var(--card-bg, rgba(255,255,255,0.05));
  border: 1px solid rgba(255,255,255,0.08);
  border-radius: 10px;
  color: #fff; text-decoration: none;
  font-size: 13px; font-weight: 500;
  transition: border-color .18s, transform .15s;
  overflow: hidden;
}
.pro-link-card:hover {
  border-color: var(--card-accent, #10c98f);
  transform: translateY(-2px);
}
.pro-link-icon-wrap {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(0,0,0,0.25); border-radius: 7px; flex-shrink: 0;
  font-size: 16px;
}
.pro-link-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pro-link-arrow { font-size: 11px; color: rgba(255,255,255,0.25); flex-shrink: 0; }

/* ─── Post cards ─────────────────────────────────────── */
.pro-posts-list { display: flex; flex-direction: column; gap: 10px; }
.pro-post-card {
  position: relative;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 14px 16px;
  transition: border-color .18s;
}
.pro-post-card:hover { border-color: rgba(255,255,255,0.15); }
.pro-post-inner { display: flex; gap: 13px; }
.pro-post-icon {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(16,201,143,0.1); border-radius: 8px;
  color: #10c98f; font-size: 15px; flex-shrink: 0;
}
.pro-post-content { flex: 1; min-width: 0; }
.pro-post-title { font-size: 14px; font-weight: 600; color: #fff; margin-bottom: 5px; }
.pro-post-body  { font-size: 13px; color: rgba(255,255,255,0.55); line-height: 1.55; white-space: pre-wrap; }
.pro-post-meta  { font-size: 11px; color: rgba(255,255,255,0.3); margin-top: 8px; display: flex; align-items: center; gap: 5px; }

/* ─── PDF cards ──────────────────────────────────────── */
.pro-pdf-list { display: flex; flex-direction: column; gap: 8px; }
.pro-pdf-card {
  position: relative;
  display: flex; align-items: center; gap: 12px;
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 10px; padding: 12px 14px;
  transition: border-color .18s;
}
.pro-pdf-card:hover { border-color: rgba(239,68,68,0.35); }
.pro-pdf-icon-wrap {
  width: 36px; height: 36px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(239,68,68,0.1); border-radius: 8px;
  color: #ef4444; font-size: 18px; flex-shrink: 0;
}
.pro-pdf-info { flex: 1; min-width: 0; }
.pro-pdf-name {
  font-size: 13px; font-weight: 500; color: #fff;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.pro-pdf-meta  { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 3px; display: flex; align-items: center; gap: 5px; }
.pro-pdf-open {
  width: 32px; height: 32px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.06); border-radius: 7px;
  color: rgba(255,255,255,0.6); font-size: 14px; text-decoration: none;
  transition: background .18s;
}
.pro-pdf-open:hover { background: rgba(255,255,255,0.14); color: #fff; }

/* ─── Video cards ────────────────────────────────────── */
.pro-video-list { display: flex; flex-direction: column; gap: 16px; }
.pro-video-card {
  background: rgba(255,255,255,0.04);
  border: 1px solid rgba(255,255,255,0.07);
  border-radius: 12px; overflow: hidden;
  transition: border-color .18s;
}
.pro-video-card:hover { border-color: rgba(255,0,0,0.3); }
.pro-video-header {
  display: flex; align-items: center; gap: 9px;
  padding: 12px 14px; border-bottom: 1px solid rgba(255,255,255,0.06);
}
.pro-video-header > .fa-brands { color: #ff0000; font-size: 16px; flex-shrink: 0; }
.pro-video-title { font-size: 13.5px; font-weight: 500; color: #fff; flex: 1; }
.pro-video-embed { position: relative; padding-bottom: 56.25%; height: 0; background: #000; }
.pro-video-embed iframe { position: absolute; top:0; left:0; width:100%; height:100%; }
.pro-video-fallback {
  position: absolute; top:0; left:0; width:100%; height:100%;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  gap: 10px; color: rgba(255,255,255,0.45); font-size: 13px;
}
.pro-video-fallback i { font-size: 24px; color: #f87171; }
.pro-video-fallback a { color: #60a5fa; word-break: break-all; }
.pro-del-video { margin-left: auto; }

/* ─── Delete button ──────────────────────────────────── */
.pro-del-btn {
  position: absolute; top: 8px; right: 8px;
  width: 26px; height: 26px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(239,68,68,0.12); border: 1px solid rgba(239,68,68,0.2);
  border-radius: 6px; color: #ef4444; font-size: 12px;
  cursor: pointer; opacity: 0;
  transition: opacity .18s, background .18s;
  z-index: 2;
}
.pro-post-card .pro-del-btn,
.pro-pdf-card  .pro-del-btn { position: static; opacity: 1; flex-shrink: 0; }
.pro-link-card:hover .pro-del-btn,
.pro-video-card:hover .pro-del-btn { opacity: 1; }
.pro-del-btn:hover { background: rgba(239,68,68,0.28); }

/* ─── Modal ──────────────────────────────────────────── */
.pro-modal-overlay {
  display: none; position: fixed; inset: 0; z-index: 9000;
  background: rgba(0,0,0,0.65); backdrop-filter: blur(4px);
  align-items: center; justify-content: center;
}
.pro-modal-overlay.show { display: flex; }
.pro-modal-box {
  position: relative;
  width: 440px; max-width: 95vw; max-height: 90vh;
  overflow-y: auto;
  background: #1a1d2e;
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 14px; padding: 24px 22px 20px;
  box-shadow: 0 20px 60px rgba(0,0,0,0.5);
}
.pro-modal-close {
  position: absolute; top: 14px; right: 14px;
  width: 28px; height: 28px;
  display: flex; align-items: center; justify-content: center;
  background: rgba(255,255,255,0.07); border: none;
  border-radius: 7px; color: rgba(255,255,255,0.5);
  cursor: pointer; font-size: 14px;
  transition: background .18s, color .18s;
}
.pro-modal-close:hover { background: rgba(239,68,68,0.2); color: #ef4444; }
.pro-modal-title {
  font-size: 16px; font-weight: 600; color: #fff;
  display: flex; align-items: center; gap: 9px;
  margin-bottom: 18px; padding-right: 28px;
}
.pro-modal-title i { color: #10c98f; }
.pro-field-label {
  display: block; font-size: 12px; font-weight: 500;
  color: rgba(255,255,255,0.45); margin-bottom: 6px; margin-top: 14px;
  letter-spacing: .3px; text-transform: uppercase;
}
.pro-input {
  width: 100%; box-sizing: border-box;
  padding: 9px 12px; font-size: 14px;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: #fff;
  outline: none; font-family: inherit;
  transition: border-color .18s;
}
.pro-input:focus { border-color: #10c98f; }
.pro-textarea { resize: vertical; min-height: 110px; }

/* ─── Type picker grid ───────────────────────────────── */
.pro-type-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(80px, 1fr));
  gap: 7px; margin-top: 8px;
}
.pro-type-option input { display: none; }
.pro-type-btn {
  display: flex; flex-direction: column; align-items: center; gap: 5px;
  padding: 9px 6px; border-radius: 8px; cursor: pointer;
  background: rgba(255,255,255,0.05);
  border: 1.5px solid rgba(255,255,255,0.08);
  font-size: 11px; color: rgba(255,255,255,0.5);
  transition: border-color .18s, background .18s;
  user-select: none;
}
.pro-type-btn i { font-size: 18px; }
.pro-type-option input:checked + .pro-type-btn {
  border-color: #10c98f;
  background: rgba(16,201,143,0.1);
  color: #fff;
}

/* ─── File drop zone ─────────────────────────────────── */
.pro-file-drop {
  display: flex; flex-direction: column; align-items: center; gap: 9px;
  padding: 28px 20px; margin-top: 8px;
  background: rgba(255,255,255,0.04);
  border: 2px dashed rgba(255,255,255,0.12);
  border-radius: 10px; cursor: pointer; color: rgba(255,255,255,0.4);
  font-size: 13px; text-align: center;
  transition: border-color .18s, background .18s;
}
.pro-file-drop i { font-size: 28px; }
.pro-file-drop:hover,
.pro-file-drop.drag-over {
  border-color: #10c98f;
  background: rgba(16,201,143,0.06);
  color: rgba(255,255,255,0.7);
}

/* ─── Upload progress ────────────────────────────────── */
.pro-progress-wrap { margin-top: 12px; }
.pro-progress-bar  {
  height: 6px; background: rgba(255,255,255,0.1);
  border-radius: 99px; overflow: hidden;
}
.pro-progress-fill {
  height: 100%; width: 0; background: #10c98f;
  border-radius: 99px; transition: width .2s;
}
.pro-progress-text {
  font-size: 12px; color: rgba(255,255,255,0.4);
  text-align: right; margin-top: 4px;
}

/* ─── Modal footer ───────────────────────────────────── */
.pro-modal-footer {
  display: flex; justify-content: flex-end; gap: 9px; margin-top: 20px;
}
.pro-btn-cancel {
  padding: 8px 18px; font-size: 13.5px; font-weight: 500;
  background: rgba(255,255,255,0.06);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 8px; color: rgba(255,255,255,0.55);
  cursor: pointer; transition: background .18s;
}
.pro-btn-cancel:hover { background: rgba(255,255,255,0.12); color: #fff; }
.pro-btn-primary {
  display: flex; align-items: center; gap: 7px;
  padding: 8px 18px; font-size: 13.5px; font-weight: 600;
  background: #10c98f;
  border: none; border-radius: 8px; color: #0a0f1e;
  cursor: pointer; transition: background .18s, transform .12s;
}
.pro-btn-primary:hover { background: #0eb87f; transform: translateY(-1px); }
.pro-btn-primary:active { transform: none; }
`;
  document.head.appendChild(style);
}

window._proEditorReady = true;
