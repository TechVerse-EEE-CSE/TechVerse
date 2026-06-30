// ══════════════════════════════════════
//  FIRESTORE SYNC (v3 — Low-Cost Design) — js/firestore-sync.js
//
//  ডেটা খরচ কমানোর নতুন স্ট্র্যাটেজি:
//   ১. ডকুমেন্ট দুই ভাগে ভাগ করা হয়েছে:
//      • projects/{id}          → শুধু META (নাম, owner, updatedAt, size...) — খুব ছোট
//      • projects/{id}/content/main → আসল ভারী fs ডেটা — শুধু প্রজেক্ট ওপেন/সেভ করলেই touch হয়
//      ফলে ড্যাশবোর্ডে "আমার প্রজেক্ট" লিস্ট আনতে ভারী fs ডেটা একদম read হয় না।
//   ২. onSnapshot এখন শুধু META ডক শোনে (fs নয়) — তাই প্রতিটা push-notification এ
//      পুরো প্রজেক্ট ডেটা ট্রান্সফার হয় না, শুধু "কেউ আপডেট করেছে" এই সিগনালটুকু আসে।
//   ৩. Write COALESCING: একই প্রজেক্টে পরপর কয়েকবার সেভ করলে (দ্রুত Ctrl+S) মাঝের
//      কোনো ভার্সন আলাদাভাবে write হয় না — শুধু সবশেষ ভার্সনটাই একবার write হয়,
//      আগের পেন্ডিং রাইট request বাতিল/প্রতিস্থাপিত (exchange) হয়ে যায়।
//   ৪. OFFLINE-SAFE QUEUE: পেন্ডিং write IndexedDB-তে থাকে, ট্যাব বন্ধ/রিফ্রেশ হলেও
//      হারায় না — পরের বার অ্যাপ খুললে বাকি থাকা write স্বয়ংক্রিয়ভাবে flush হয়।
//   ৫. একটা প্রজেক্টের জন্য সবসময় একটাই active write/listener থাকে।
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, updateDoc, onSnapshot, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

const SAVE_DEBOUNCE_MS = 2500;     // দ্রুত পরপর সেভে coalesce করার জন্য অপেক্ষার সময়
const PENDING_KEY_PREFIX = 'pendingCloudWrite_';

let _currentUser      = null;
let _isSyncing         = false;
let _activeProjectId   = null;
let _unsubscribe        = null;     // ← চলমান META onSnapshot listener
let _lastKnownUpdateMs  = 0;        // remote echo এড়াতে
let _pendingFs          = null;     // সবশেষ coalesced ডেটা (পুরনোটা এক্সচেঞ্জ হয়ে যায়)
let _saveTimer          = null;

// ══════════════════════════════════════
//  AUTH স্টেট পরিবর্তনে — শুধু META দিয়ে কাজ চালানো
// ══════════════════════════════════════
onAuthStateChanged(auth, async (user) => {
  _currentUser = user;
  if (!user) return;

  // ── users/{uid} আগে IndexedDB cache এ আছে কিনা দেখো (read বাঁচাতে) ──
  let owned = await IDBStore.get(`ownedProjectIds_${user.uid}`);
  if (owned === undefined) {
    const userRef  = doc(db, 'users', user.uid);
    const userSnap = await getDoc(userRef);
    owned = userSnap.exists() ? (userSnap.data().ownedProjectIds || []) : [];
    await IDBStore.set(`ownedProjectIds_${user.uid}`, owned);
  }

  if (owned.length > 0) {
    window.currentProjectId = owned[0];
    window.openProjectSync(owned[0]);
    const fs = await window.cloudLoadProject(owned[0]);
    if (fs) {
      await IDBStore.set('fs', fs);
      if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
    }
  } else {
    const localFs = await IDBStore.get('fs');
    const projectId = await window.createProject('My Project', localFs || {});
    window.currentProjectId = projectId;
    window.openProjectSync(projectId);
    showToast?.('নতুন প্রজেক্ট তৈরি হয়েছে', 'success', 'fa-folder-plus');
  }

  // ── আগের সেশনে কোনো write অসম্পূর্ণ থেকে গেলে এখন flush করো (offline-safe) ──
  await _flushPendingFromIDB();
});

// ══════════════════════════════════════
//  প্রজেক্ট ওপেন করা — শুধু META ডকে listener (fs ডকে নয়)
// ══════════════════════════════════════
window.openProjectSync = function (projectId) {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _activeProjectId = projectId;

  const metaRef = doc(db, 'projects', projectId);

  // ── এই listener শুধু ছোট META ডক শোনে — fs ডেটা এর মধ্যে নেই,
  //    তাই প্রতিটা push-এ ডেটা ট্রান্সফার অনেক কম ──
  _unsubscribe = onSnapshot(metaRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const remoteMs = data.updatedAt?.toMillis?.() || 0;

    if (remoteMs <= _lastKnownUpdateMs) return;
    _lastKnownUpdateMs = remoteMs;

    if (data.updatedBy === _currentUser?.uid) return; // নিজেই করেছে

    if (typeof showToast === 'function') {
      showToast(`${data.updatedByName || 'একজন কোলাবোরেটর'} নতুন আপডেট করেছে`, 'info', 'fa-users');
    }
    document.getElementById('reloadAvailableBadge')?.classList.remove('hidden');
    document.getElementById('reloadDot')?.classList.remove('hidden');
    // ── fs এখনই আনা হচ্ছে না — ইউজার বাটনে ক্লিক করলে তখনই 1 read হবে ──
    window._remoteUpdateProjectId = projectId;
  });
};

window.closeProjectSync = function () {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _activeProjectId = null;
};

// ── ট্যাব hidden হলে listener বন্ধ, ফিরে এলে আবার চালু (idle read/listen বাঁচাতে) ──
document.addEventListener('visibilitychange', () => {
  if (!_activeProjectId) return;
  if (document.hidden) {
    if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  } else if (!_unsubscribe) {
    window.openProjectSync(_activeProjectId);
  }
});

// ══════════════════════════════════════
//  CLOUD SAVE — debounce + coalesce
//  পরপর একাধিকবার কল হলেও Firestore-এ গিয়ে লেখা হবে শুধু সবশেষ ডেটাটা,
//  মাঝের পুরনো পেন্ডিং রাইট নতুনটা দিয়ে এক্সচেঞ্জ (replace) হয়ে যায়।
// ══════════════════════════════════════
window.cloudSave = async function (fsData) {
  if (!_currentUser)     { showToast?.('লগইন ছাড়া cloud সেভ হবে না, local সেভ আছে', 'info'); return; }
  if (!_activeProjectId) { showToast?.('কোনো প্রজেক্ট খোলা নেই', 'error'); return; }

  _pendingFs = fsData; // ← আগের pending ডেটা থাকলে এখানেই এক্সচেঞ্জ হয়ে গেলো

  // ── reload/বন্ধ হলেও যাতে হারায় না, IndexedDB তে সাথে সাথেই persist করো ──
  await IDBStore.set(PENDING_KEY_PREFIX + _activeProjectId, {
    fs: fsData,
    savedLocallyAt: Date.now(),
  });

  showSyncStatus('pending');
  clearTimeout(_saveTimer);
  _saveTimer = setTimeout(_flushCloudSave, SAVE_DEBOUNCE_MS);
};

// ── আসল Firestore write — প্রতি প্রজেক্টে ঠিক ১টা content write + ১টা ছোট meta write ──
async function _flushCloudSave() {
  if (_isSyncing || !_pendingFs || !_activeProjectId || !_currentUser) return;
  _isSyncing = true;
  showSyncStatus('saving');

  const projectId = _activeProjectId;
  const fsData     = _pendingFs;
  _pendingFs = null;

  try {
    const jsonStr = JSON.stringify(fsData);
    const sizeKB  = new Blob([jsonStr]).size / 1024;

    if (sizeKB > 900) {
      showSyncStatus('toobig');
      showToast?.('ফাইল অনেক বড়! শুধু local সেভ হয়েছে।', 'info', 'fa-triangle-exclamation');
      return;
    }

    const now = Date.now();
    _lastKnownUpdateMs = now;

    // ── ভারী ডেটা: content/main ডকে — এটাই একমাত্র write যেখানে fs যায় ──
    await setDoc(doc(db, 'projects', projectId, 'content', 'main'), {
      fs: fsData,
    }, { merge: false }); // merge:false → পুরনো fs পুরোপুরি প্রতিস্থাপিত হয়, accumulate হয় না

    // ── হালকা META ডক: শুধু ছোট কিছু ফিল্ড, dashboard/listener এর জন্য সস্তা ──
    await setDoc(doc(db, 'projects', projectId), {
      updatedAt: serverTimestamp(),
      updatedBy: _currentUser.uid,
      updatedByName: _currentUser.displayName || _currentUser.email,
      sizeKB: Math.round(sizeKB),
    }, { merge: true });

    await IDBStore.remove(PENDING_KEY_PREFIX + projectId);

    showSyncStatus('saved');
    showToast?.('Cloud এ সেভ হয়েছে ☁️', 'success', 'fa-cloud-arrow-up');

  } catch (err) {
    console.error('Cloud save error:', err);
    showSyncStatus('error');
    showToast?.('Cloud সেভ ব্যর্থ। Local এ আছে, পরে রিট্রাই হবে।', 'error', 'fa-cloud-slash');
    // ── ব্যর্থ হলেও ডেটা হারায় না, IndexedDB তে থেকে যায়, পরের লোডে আবার চেষ্টা হবে ──
  } finally {
    _isSyncing = false;
    if (_pendingFs) {
      clearTimeout(_saveTimer);
      _saveTimer = setTimeout(_flushCloudSave, SAVE_DEBOUNCE_MS);
    }
  }
}

// ── অ্যাপ চালু হওয়ার সময় IndexedDB-তে আগের কোনো অসম্পূর্ণ write থাকলে flush করো ──
async function _flushPendingFromIDB() {
  if (!_activeProjectId) return;
  try {
    const pending = await IDBStore.get(PENDING_KEY_PREFIX + _activeProjectId);
    if (pending && pending.fs) {
      _pendingFs = pending.fs;
      await _flushCloudSave();
    }
  } catch (e) {
    // key না থাকলে নিরাপদে ইগনোর করো
  }
}

// ══════════════════════════════════════
//  CLOUD LOAD — প্রজেক্ট ওপেন করার সময় শুধু content/main থেকে (1 read)
// ══════════════════════════════════════
window.cloudLoadProject = async function (projectId) {
  try {
    const metaSnap = await getDoc(doc(db, 'projects', projectId));
    if (!metaSnap.exists()) return null;
    _lastKnownUpdateMs = metaSnap.data().updatedAt?.toMillis?.() || 0;

    const contentSnap = await getDoc(doc(db, 'projects', projectId, 'content', 'main'));
    if (!contentSnap.exists()) return null;
    return contentSnap.data().fs;
  } catch (err) {
    console.error('Cloud load error:', err);
    return null;
  }
};

// ── অন্য কেউ আপডেট দিলে "নতুন ভার্সন লোড করুন" বাটনে ক্লিকে কল হবে ──
window.applyRemoteUpdate = async function () {
  const projectId = window._remoteUpdateProjectId || _activeProjectId;
  if (!projectId) return;

  const contentSnap = await getDoc(doc(db, 'projects', projectId, 'content', 'main'));
  if (!contentSnap.exists()) return;

  await IDBStore.set('fs', contentSnap.data().fs);
  document.getElementById('reloadAvailableBadge')?.classList.add('hidden');
  document.getElementById('reloadDot')?.classList.add('hidden');
  if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
  window._remoteUpdateProjectId = null;
};

// ══════════════════════════════════════
//  SYNC STATUS INDICATOR (navbar এ)
// ══════════════════════════════════════
function showSyncStatus(status) {
  let el = document.getElementById('cloudSyncBadge');
  if (!el) return;
  const map = {
    pending: { icon: 'fa-clock',                color: '#a0aec0', title: 'কিছুক্ষণ পর সেভ হবে…' },
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

// ── ট্যাব বন্ধ করার আগে শেষ চেষ্টা: pending থাকলে তাড়াতাড়ি flush করো ──
window.addEventListener('beforeunload', () => {
  if (_pendingFs) {
    clearTimeout(_saveTimer);
    _flushCloudSave(); // best-effort, পরের লোডে IndexedDB থেকে retry হবেই
  }
});

window._cloudSyncReady = true;
