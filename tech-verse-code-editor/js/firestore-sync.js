// ══════════════════════════════════════
//  FIRESTORE SYNC — js/firestore-sync.js
//  শুধু Ctrl+S এ cloud save হবে
//  Autosave সবসময় IndexedDB তে (localStorage এর বদলে — বড় ডেটা/quota সমস্যা নেই)
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

// ── ইতোমধ্যে initialize হলে নতুন করে করব না ──
const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

let _currentUser = null;
let _isSyncing   = false;

// ── Auth ready হলে cloud থেকে load ──
onAuthStateChanged(auth, async (user) => {
  _currentUser = user;
  if (user) {
    await cloudLoad(user.uid);
  }
});

// ══════════════════════════════════════
//  CLOUD SAVE — শুধু manual Ctrl+S এ call হবে
//  Firestore write: প্রতি manual save = 1 write
// ══════════════════════════════════════
window.cloudSave = async function (fsData) {
  if (!_currentUser)  return; // login না থাকলে skip
  if (_isSyncing)     return; // double save রোধ
  _isSyncing = true;

  // Save indicator দেখাও
  showSyncStatus('saving');

  try {
    const uid     = _currentUser.uid;
    const docRef  = doc(db, 'projects', uid);

    // ── Safety check: data size ──
    // Firestore document limit 1MB, তাই আগে check করি
    const jsonStr = JSON.stringify(fsData);
    const sizeKB  = new Blob([jsonStr]).size / 1024;

    if (sizeKB > 900) {
      // 900KB এর বেশি হলে cloud save করব না
      showSyncStatus('toobig');
      if (typeof showToast === 'function')
        showToast('ফাইল অনেক বড়! শুধু local সেভ হয়েছে।', 'info', 'fa-triangle-exclamation');
      return;
    }

    await setDoc(docRef, {
      fs:          fsData,
      savedAt:     serverTimestamp(),
      fileCount:   Object.keys(fsData).length,
      sizeKB:      Math.round(sizeKB),
    });

    showSyncStatus('saved');
    if (typeof showToast === 'function')
      showToast('Cloud এ সেভ হয়েছে ☁️', 'success', 'fa-cloud-arrow-up');

  } catch (err) {
    console.error('Cloud save error:', err);
    showSyncStatus('error');
    if (typeof showToast === 'function')
      showToast('Cloud সেভ ব্যর্থ। Local সেভ আছে।', 'error', 'fa-cloud-slash');
  } finally {
    _isSyncing = false;
  }
};

// ══════════════════════════════════════
//  CLOUD LOAD — login করলে একবার চলবে
//  Firestore read: login per session = 1 read
// ══════════════════════════════════════
async function cloudLoad(uid) {
  try {
    const docRef  = doc(db, 'projects', uid);
    const snap    = await getDoc(docRef);

    if (!snap.exists()) {
      // প্রথমবার login — cloud এ কিছু নেই, local টাই রাখো
      return;
    }

    const cloudData = snap.data();
    const cloudFs   = cloudData.fs;
    const cloudTime = cloudData.savedAt?.toMillis?.() || 0;

    // Local data কত পুরনো?
    const localTime = parseInt(await IDBStore.get('cloudtime') || 0);

    if (cloudTime > localTime) {
      // Cloud এর data বেশি নতুন → cloud থেকে load করো
      await IDBStore.set('fs', cloudFs);
      await IDBStore.set('cloudtime', cloudTime);

      // editor যদি আগেই init হয়ে গিয়ে থাকে
      if (typeof reloadFsFromStorage === 'function') {
        await reloadFsFromStorage();
      }

      if (typeof showToast === 'function')
        showToast('Cloud থেকে লোড হয়েছে ☁️', 'info', 'fa-cloud-arrow-down');
    }
    // local বেশি নতুন হলে কিছুই করব না

  } catch (err) {
    console.error('Cloud load error:', err);
    // load fail হলেও local data দিয়ে কাজ চলবে, কোনো crash নেই
  }
}

// ══════════════════════════════════════
//  SYNC STATUS INDICATOR (navbar এ)
// ══════════════════════════════════════
function showSyncStatus(status) {
  let el = document.getElementById('cloudSyncBadge');
  if (!el) return;

  const map = {
    saving:  { icon: 'fa-cloud-arrow-up',  color: '#5b8dee', title: 'Cloud এ সেভ হচ্ছে…' },
    saved:   { icon: 'fa-cloud-check',     color: '#10c98f', title: 'Cloud এ সেভ হয়েছে' },
    error:   { icon: 'fa-cloud-slash',     color: '#ef4444', title: 'Cloud সেভ ব্যর্থ'   },
    toobig:  { icon: 'fa-triangle-exclamation', color: '#feca57', title: 'ফাইল অনেক বড়' },
  };

  const s = map[status] || map.saved;
  el.innerHTML = `<i class="fa-solid ${s.icon}" style="color:${s.color}" title="${s.title}"></i>`;
  el.style.opacity = '1';

  // 3 সেকেন্ড পর আবার 희미ে যাবে
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0.3'; }, 3000);
}

// ── expose করো যাতে editor.js থেকে check করা যায় ──
window._cloudSyncReady = true;
