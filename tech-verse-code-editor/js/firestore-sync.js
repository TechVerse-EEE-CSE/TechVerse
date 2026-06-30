// ══════════════════════════════════════
//  FIRESTORE SYNC (v2 — Collaborative) — js/firestore-sync.js
//
//  Firestore লোড কম রাখার কৌশল:
//   ১. Save এখনো manual (Ctrl+S) — প্রতি কী-স্ট্রোকে write হয় না
//   ২. একসাথে কাজ করার জন্য onSnapshot লিসেনার ব্যবহার করা হয়েছে,
//      কিন্তু এটা তখনই ট্রিগার হয় যখন আসলে কেউ save করে — তাই
//      একাধিক কোলাবোরেটর থাকলেও idle অবস্থায় কোনো read হয় না
//   ৩. ১টা প্রজেক্টের জন্য একসাথে একটাই active listener রাখা হয়
//      (tab পরিবর্তন/বন্ধ করলে আগের listener detach করে দেওয়া হয়)
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

let _currentUser     = null;
let _isSyncing        = false;
let _activeProjectId  = null;
let _unsubscribe       = null;   // ← চলমান onSnapshot listener
let _lastKnownUpdateMs = 0;      // remote echo এড়াতে (নিজের সেভ-এর জন্য toast না দেখানো)

onAuthStateChanged(auth, (user) => { _currentUser = user; });

// ══════════════════════════════════════
//  প্রজেক্ট ওপেন করা — listener attach
// ══════════════════════════════════════
window.openProjectSync = function (projectId) {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }   // ← আগের listener বন্ধ করো
  _activeProjectId = projectId;

  const projRef = doc(db, 'projects', projectId);

  // ── এই listener idle অবস্থায় কোনো extra read করে না — শুধু
  //    actual write হলেই snapshot push হয় (Firestore-এর native behaviour) ──
  _unsubscribe = onSnapshot(projRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const remoteMs = data.updatedAt?.toMillis?.() || 0;

    // ── নিজের করা সেভ হলে স্কিপ করো (নিজেকে নিজে রিলোড না করার জন্য) ──
    if (remoteMs <= _lastKnownUpdateMs) return;
    _lastKnownUpdateMs = remoteMs;

    if (data.updatedBy === _currentUser?.uid) return; // নিজেই করেছে

    // ── অন্য কেউ আপডেট করেছে → ইউজারকে জানাও, ফোর্স রিলোড না করে ──
    if (typeof showToast === 'function') {
      showToast(`${data.updatedByName || 'একজন কোলাবোরেটর'} নতুন আপডেট করেছে`, 'info', 'fa-users');
    }
    document.getElementById('reloadAvailableBadge')?.classList.remove('hidden');
    document.getElementById('reloadDot')?.classList.remove('hidden');
    window._remoteFsAvailable = data.fs; // চাইলে ইউজার বাটনে ক্লিক করে লোড করবে
  });
};

window.closeProjectSync = function () {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _activeProjectId = null;
};

// ══════════════════════════════════════
//  CLOUD SAVE — manual Ctrl+S / Save বাটনে কল হবে
//  প্রতি save = ঠিক ১টা write (আগের মতোই)
// ══════════════════════════════════════
window.cloudSave = async function (fsData) {
  if (!_currentUser)     { showToast?.('লগইন ছাড়া cloud সেভ হবে না, local সেভ আছে', 'info'); return; }
  if (!_activeProjectId) { showToast?.('কোনো প্রজেক্ট খোলা নেই', 'error'); return; }
  if (_isSyncing) return;
  _isSyncing = true;
  showSyncStatus('saving');

  try {
    const jsonStr = JSON.stringify(fsData);
    const sizeKB  = new Blob([jsonStr]).size / 1024;

    if (sizeKB > 900) {
      showSyncStatus('toobig');
      showToast?.('ফাইল অনেক বড়! শুধু local সেভ হয়েছে।', 'info', 'fa-triangle-exclamation');
      return;
    }

    const now = Date.now();
    _lastKnownUpdateMs = now; // ← নিজের write কে নিজে remote-update হিসেবে না ধরার জন্য

    await setDoc(doc(db, 'projects', _activeProjectId), {
      fs: fsData,
      updatedAt: serverTimestamp(),
      updatedBy: _currentUser.uid,
      updatedByName: _currentUser.displayName || _currentUser.email,
      sizeKB: Math.round(sizeKB),
    }, { merge: true });

    showSyncStatus('saved');
    showToast?.('Cloud এ সেভ হয়েছে ☁️', 'success', 'fa-cloud-arrow-up');

  } catch (err) {
    console.error('Cloud save error:', err);
    showSyncStatus('error');
    showToast?.('Cloud সেভ ব্যর্থ। Local সেভ আছে।', 'error', 'fa-cloud-slash');
  } finally {
    _isSyncing = false;
  }
};

// ══════════════════════════════════════
//  CLOUD LOAD — প্রজেক্ট ওপেন করার সময় একবার (1 read)
// ══════════════════════════════════════
window.cloudLoadProject = async function (projectId) {
  try {
    const snap = await getDoc(doc(db, 'projects', projectId));
    if (!snap.exists()) return null;
    const data = snap.data();
    _lastKnownUpdateMs = data.updatedAt?.toMillis?.() || 0;
    return data.fs;
  } catch (err) {
    console.error('Cloud load error:', err);
    return null;
  }
};

// ── অন্য কেউ আপডেট দিলে "নতুন ভার্সন লোড করুন" বাটনে ক্লিকে কল হবে ──
window.applyRemoteUpdate = async function () {
  if (!window._remoteFsAvailable) return;
  await IDBStore.set('fs', window._remoteFsAvailable);
  document.getElementById('reloadAvailableBadge')?.classList.add('hidden');
  document.getElementById('reloadDot')?.classList.add('hidden');
  if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
  window._remoteFsAvailable = null;
};

// ══════════════════════════════════════
//  SYNC STATUS INDICATOR (navbar এ)
// ══════════════════════════════════════
function showSyncStatus(status) {
  let el = document.getElementById('cloudSyncBadge');
  if (!el) return;
  const map = {
    saving:  { icon: 'fa-cloud-arrow-up',       color: '#5b8dee', title: 'Cloud এ সেভ হচ্ছে…' },
    saved:   { icon: 'fa-cloud-check',          color: '#10c98f', title: 'Cloud এ সেভ হয়েছে' },
    error:   { icon: 'fa-cloud-slash',          color: '#ef4444', title: 'Cloud সেভ ব্যর্থ' },
    toobig:  { icon: 'fa-triangle-exclamation', color: '#feca57', title: 'ফাইল অনেক বড়' },
  };
  const s = map[status] || map.saved;
  el.innerHTML = `<i class="fa-solid ${s.icon}" style="color:${s.color}" title="${s.title}"></i>`;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0.3'; }, 3000);
}

window._cloudSyncReady = true;
