// ══════════════════════════════════════
//  FIRESTORE SYNC (v2 — Collaborative) — js/firestore-sync.js
//
//  Strategy to keep Firestore load low:
//   1. Save is still manual (Ctrl+S) — there's no write on every keystroke
//   2. An onSnapshot listener is used for working together in real time,
//      but it only triggers when someone actually saves — so
//      even with multiple collaborators there's no read while idle
//   3. Only one active listener is kept per project at a time
//      (the previous listener is detached when the tab is switched/closed)
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
let _unsubscribe       = null;   // ← the currently active onSnapshot listener
let _lastKnownUpdateMs = 0;      // to avoid remote echo (not showing a toast for one's own save)

onAuthStateChanged(auth, async (user) => {
  _currentUser = user;
  if (!user) return;

  // ── Check the users/{uid} doc — see if a project already exists ──
  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  const owned    = userSnap.exists() ? (userSnap.data().ownedProjectIds || []) : [];

  if (owned.length > 0) {
    // ── An existing project exists → open it ──
    window.currentProjectId = owned[0];
    window.openProjectSync(owned[0]);
    const fs = await window.cloudLoadProject(owned[0]);
    if (fs) {
      await IDBStore.set('fs', fs);
      if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
    }
  } else {
    // ── First-time login → create a new project from the current local files ──
    const localFs = await IDBStore.get('fs');
    const projectId = await window.createProject('My Project', localFs || {});
    window.currentProjectId = projectId;
    window.openProjectSync(projectId);
    showToast?.('New project created', 'success', 'fa-folder-plus');
  }
});

// ══════════════════════════════════════
//  Open a project — attach listener
// ══════════════════════════════════════
window.openProjectSync = function (projectId) {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }   // ← stop the previous listener
  _activeProjectId = projectId;

  const projRef = doc(db, 'projects', projectId);

  // ── This listener does no extra read while idle — a snapshot is pushed only when
  //    there's an actual write (native Firestore behaviour) ──
  _unsubscribe = onSnapshot(projRef, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    const remoteMs = data.updatedAt?.toMillis?.() || 0;

    // ── Skip if this is one's own save (to avoid reloading oneself) ──
    if (remoteMs <= _lastKnownUpdateMs) return;
    _lastKnownUpdateMs = remoteMs;

    if (data.updatedBy === _currentUser?.uid) return; // done by the current user themself

    // ── Someone else made an update → notify the user, without forcing a reload ──
    if (typeof showToast === 'function') {
      showToast(`${data.updatedByName || 'A collaborator'} made a new update`, 'info', 'fa-users');
    }
    document.getElementById('reloadAvailableBadge')?.classList.remove('hidden');
    document.getElementById('reloadDot')?.classList.remove('hidden');
    window._remoteFsAvailable = data.fs; // the user can load it by clicking the button if they want
  });
};

window.closeProjectSync = function () {
  if (_unsubscribe) { _unsubscribe(); _unsubscribe = null; }
  _activeProjectId = null;
};

// ══════════════════════════════════════
//  CLOUD SAVE — called on manual Ctrl+S / the Save button
//  Each save = exactly 1 write (same as before)
// ══════════════════════════════════════
window.cloudSave = async function (fsData) {
  if (!_currentUser)     { showToast?.('No cloud save without logging in, local save is available', 'info'); return; }
  if (!_activeProjectId) { showToast?.('No project is open', 'error'); return; }
  if (_isSyncing) return;
  _isSyncing = true;
  showSyncStatus('saving');

  try {
    const jsonStr = JSON.stringify(fsData);
    const sizeKB  = new Blob([jsonStr]).size / 1024;

    if (sizeKB > 900) {
      showSyncStatus('toobig');
      showToast?.('File is too large! Only saved locally.', 'info', 'fa-triangle-exclamation');
      return;
    }

    const now = Date.now();
    _lastKnownUpdateMs = now; // ← so one's own write isn't treated as a remote update

    await setDoc(doc(db, 'projects', _activeProjectId), {
      fs: fsData,
      updatedAt: serverTimestamp(),
      updatedBy: _currentUser.uid,
      updatedByName: _currentUser.displayName || _currentUser.email,
      sizeKB: Math.round(sizeKB),
    }, { merge: true });

    showSyncStatus('saved');
    showToast?.('Saved to Cloud ☁️', 'success', 'fa-cloud-arrow-up');

  } catch (err) {
    console.error('Cloud save error:', err);
    showSyncStatus('error');
    showToast?.('Cloud save failed. Local save is available.', 'error', 'fa-cloud-slash');
  } finally {
    _isSyncing = false;
  }
};

// ══════════════════════════════════════
//  CLOUD LOAD — once when opening a project (1 read)
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

// ── Called when clicking the "Load new version" button after someone else's update ──
window.applyRemoteUpdate = async function () {
  if (!window._remoteFsAvailable) return;
  await IDBStore.set('fs', window._remoteFsAvailable);
  document.getElementById('reloadAvailableBadge')?.classList.add('hidden');
  document.getElementById('reloadDot')?.classList.add('hidden');
  if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
  window._remoteFsAvailable = null;
};

// ══════════════════════════════════════
//  SYNC STATUS INDICATOR (in the navbar)
// ══════════════════════════════════════
function showSyncStatus(status) {
  let el = document.getElementById('cloudSyncBadge');
  if (!el) return;
  const map = {
    saving:  { icon: 'fa-cloud-arrow-up',       color: '#5b8dee', title: 'Saving to Cloud…' },
    saved:   { icon: 'fa-cloud-check',          color: '#10c98f', title: 'Saved to Cloud' },
    error:   { icon: 'fa-cloud-slash',          color: '#ef4444', title: 'Cloud save failed' },
    toobig:  { icon: 'fa-triangle-exclamation', color: '#feca57', title: 'File is too large' },
  };
  const s = map[status] || map.saved;
  el.innerHTML = `<i class="fa-solid ${s.icon}" style="color:${s.color}" title="${s.title}"></i>`;
  el.style.opacity = '1';
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.style.opacity = '0.3'; }, 3000);
}

window._cloudSyncReady = true;
