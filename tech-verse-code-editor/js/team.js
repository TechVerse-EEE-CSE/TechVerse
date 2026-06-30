// ══════════════════════════════════════
//  TEAM / ABOUT SECTION — js/team.js
//  Firestore থেকে টিম মেম্বার লোড করে About সেকশনে দেখায়।
//  নির্দিষ্ট এডমিন ইমেইল দিয়ে লগইন করলে Add/Edit/Delete ফর্ম শো করে।
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, collection, doc, addDoc, setDoc, deleteDoc,
  onSnapshot, query, orderBy, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-storage.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

// ── এডমিন ইমেইল লিস্ট — শুধু এই ইমেইল দিয়ে লগইন করলে Add/Edit/Delete দেখা যাবে ──
const ADMIN_EMAILS = ['imran.info.me@gmail.com'];

// ── Firebase init (অন্য মডিউলের সাথে একই app instance শেয়ার করে) ──
const app     = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db      = getFirestore(app);
const storage = getStorage(app);
const auth    = getAuth(app);

let _isAdmin       = false;
let _teamUnsub      = null;
let _initialized    = false;
let _selectedPhotoFile = null;
let _teamCache      = [];

// ── বিভিন্ন রকমের ডিফল্ট অ্যাভাটার স্টাইল (DiceBear) — ছবি না থাকলে এর একটা ব্যবহার হয় ──
const AVATAR_STYLES = ['avataaars', 'bottts', 'pixel-art', 'adventurer', 'fun-emoji', 'identicon', 'lorelei'];

function pickAvatarStyle(seed) {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_STYLES[hash % AVATAR_STYLES.length];
}

function defaultAvatarUrl(name) {
  const style = pickAvatarStyle(name || 'member');
  return `https://api.dicebear.com/7.x/${style}/svg?seed=${encodeURIComponent(name || 'member')}`;
}

// ── এডমিন কিনা চেক করা ──
onAuthStateChanged(auth, (user) => {
  _isAdmin = !!(user && user.email && ADMIN_EMAILS.includes(user.email));
  const addBtn = document.getElementById('btnAddTeamMember');
  if (addBtn) addBtn.classList.toggle('hidden', !_isAdmin);
  if (_initialized) renderTeam(_teamCache);
});

// ── About প্যানেল প্রথমবার খোলার সময় লোড শুরু করা (lazy init) ──
window.initTeamSectionIfNeeded = function () {
  if (_initialized) return;
  _initialized = true;
  const teamQuery = query(collection(db, 'team'), orderBy('order', 'asc'));
  _teamUnsub = onSnapshot(teamQuery, (snap) => {
    _teamCache = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    renderTeam(_teamCache);
  }, (err) => {
    console.error('Team load error:', err);
    const grid = document.getElementById('teamGrid');
    if (grid) grid.innerHTML = `<p class="muted">টিম তথ্য লোড করা যায়নি।</p>`;
  });
};

// ── টিম গ্রিড রেন্ডার করা ──
function renderTeam(members) {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;

  if (!members.length) {
    grid.innerHTML = `<p class="muted">এখনো কোনো টিম মেম্বার যুক্ত করা হয়নি।</p>`;
    return;
  }

  grid.innerHTML = members.map(m => {
    const photo = m.photoURL || defaultAvatarUrl(m.name);
    const socials = [
      m.facebook  ? `<a href="${escAttr(m.facebook)}"  target="_blank" rel="noopener" class="team-social fb"><i class="fa-brands fa-facebook"></i></a>`  : '',
      m.github    ? `<a href="${escAttr(m.github)}"    target="_blank" rel="noopener" class="team-social gh"><i class="fa-brands fa-github"></i></a>`    : '',
      m.instagram ? `<a href="${escAttr(m.instagram)}" target="_blank" rel="noopener" class="team-social ig"><i class="fa-brands fa-instagram"></i></a>` : '',
    ].join('');

    const adminControls = _isAdmin ? `
      <div class="team-card-admin">
        <button onclick="window.openTeamForm('${m.id}')" title="এডিট"><i class="fa-solid fa-pen"></i></button>
        <button onclick="window.deleteTeamMember('${m.id}')" title="ডিলিট" class="danger"><i class="fa-solid fa-trash"></i></button>
      </div>` : '';

    return `
      <div class="team-card">
        ${adminControls}
        <img class="team-card-photo" src="${escAttr(photo)}" alt="${escAttr(m.name || '')}" loading="lazy">
        <div class="team-card-name">${escHtml(m.name || '')}</div>
        <div class="team-card-role">${escHtml(m.role || '')}</div>
        ${m.bio ? `<p class="team-card-bio">${escHtml(m.bio)}</p>` : ''}
        ${socials ? `<div class="team-card-socials">${socials}</div>` : ''}
      </div>`;
  }).join('');
}

// ── XSS-সেফ এসকেপিং হেল্পার ──
function escHtml(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}
function escAttr(str) {
  return String(str).replace(/"/g, '&quot;');
}

// ══════════════════════════════════════
//  এডমিন ফর্ম — Add / Edit
// ══════════════════════════════════════

window.openTeamForm = function (memberId) {
  if (!_isAdmin) return;
  _selectedPhotoFile = null;

  const modal = document.getElementById('teamFormModal');
  document.getElementById('teamMemberId').value = memberId || '';
  document.getElementById('teamFormTitle').textContent = memberId ? 'মেম্বার এডিট করুন' : 'নতুন মেম্বার যুক্ত করুন';

  const preview = document.getElementById('teamPhotoPreview');

  if (memberId) {
    const m = _teamCache.find(x => x.id === memberId);
    document.getElementById('teamName').value      = m?.name || '';
    document.getElementById('teamRole').value      = m?.role || '';
    document.getElementById('teamBio').value       = m?.bio || '';
    document.getElementById('teamFacebook').value  = m?.facebook || '';
    document.getElementById('teamGithub').value    = m?.github || '';
    document.getElementById('teamInstagram').value = m?.instagram || '';
    preview.innerHTML = `<img src="${escAttr(m?.photoURL || defaultAvatarUrl(m?.name))}" alt="">`;
  } else {
    ['teamName','teamRole','teamBio','teamFacebook','teamGithub','teamInstagram'].forEach(id => {
      document.getElementById(id).value = '';
    });
    preview.innerHTML = `<i class="fa-solid fa-user"></i>`;
  }

  document.getElementById('teamPhotoFile').value = '';
  modal.classList.remove('hidden');
};

window.previewTeamPhoto = function (e) {
  const file = e.target.files?.[0];
  if (!file) return;
  _selectedPhotoFile = file;
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('teamPhotoPreview').innerHTML = `<img src="${reader.result}" alt="">`;
  };
  reader.readAsDataURL(file);
};

window.saveTeamMember = async function () {
  if (!_isAdmin) return;

  const id   = document.getElementById('teamMemberId').value;
  const name = document.getElementById('teamName').value.trim();
  if (!name) { showToast?.('নাম দিন', 'error'); return; }

  const saveBtn = document.getElementById('teamSaveBtn');
  saveBtn.disabled = true;
  saveBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> সেভ হচ্ছে...`;

  try {
    let photoURL = id ? (_teamCache.find(x => x.id === id)?.photoURL || '') : '';

    if (_selectedPhotoFile) {
      const path = `team-photos/${Date.now()}-${_selectedPhotoFile.name}`;
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, _selectedPhotoFile);
      photoURL = await getDownloadURL(storageRef);
    }

    const data = {
      name,
      role:      document.getElementById('teamRole').value.trim(),
      bio:       document.getElementById('teamBio').value.trim(),
      facebook:  document.getElementById('teamFacebook').value.trim(),
      github:    document.getElementById('teamGithub').value.trim(),
      instagram: document.getElementById('teamInstagram').value.trim(),
      photoURL,
      order: id ? (_teamCache.find(x => x.id === id)?.order ?? Date.now()) : Date.now(),
      updatedAt: serverTimestamp(),
    };

    if (id) {
      await setDoc(doc(db, 'team', id), data, { merge: true });
      showToast?.('মেম্বার আপডেট হয়েছে', 'success', 'fa-user-pen');
    } else {
      data.createdAt = serverTimestamp();
      await addDoc(collection(db, 'team'), data);
      showToast?.('নতুন মেম্বার যুক্ত হয়েছে', 'success', 'fa-user-plus');
    }

    document.getElementById('teamFormModal').classList.add('hidden');
  } catch (err) {
    console.error(err);
    showToast?.('সেভ করা যায়নি, আবার চেষ্টা করুন', 'error');
  } finally {
    saveBtn.disabled = false;
    saveBtn.innerHTML = `<i class="fa-solid fa-check"></i> সেভ করুন`;
  }
};

window.deleteTeamMember = async function (memberId) {
  if (!_isAdmin) return;
  if (!confirm('এই মেম্বারকে ডিলিট করতে চান?')) return;
  try {
    await deleteDoc(doc(db, 'team', memberId));
    showToast?.('মেম্বার ডিলিট হয়েছে', 'info', 'fa-trash');
  } catch (err) {
    console.error(err);
    showToast?.('ডিলিট করা যায়নি', 'error');
  }
};
