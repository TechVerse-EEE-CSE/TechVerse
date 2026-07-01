// ══════════════════════════════════════
//  PROJECT MANAGER — js/project-manager.js
//  Multiple projects + sharing + collaboration
//
//  Design principles (to keep Firestore load low):
//   - No one can enter a project without a share link
//   - Joining is a one-time event (2 writes, does not repeat)
//   - Instead of a collection query to fetch the "My Projects" list,
//     a denormalized array is kept in the users/{uid} doc (1 read)
//   - No realtime keystroke sync — saving is still manual/debounced
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  arrayUnion, serverTimestamp, collection
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── Small random id generator (for shareId / projectId) ──
function randId(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ══════════════════════════════════════
//  1. Create a new project
// ══════════════════════════════════════
window.createProject = async function (name, fsData) {
  const user = auth.currentUser;
  if (!user) { showToast?.('Please log in first', 'error'); return null; }

  const projectId = randId(12);
  const projRef   = doc(db, 'projects', projectId);
  const userRef   = doc(db, 'users', user.uid);

  await setDoc(projRef, {
    name,
    ownerUid: user.uid,
    ownerName: user.displayName || user.email || 'Unknown',
    fs: fsData,
    collaboratorUids: [],          // ← collaborator uids will be added here
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  // ── Add a denormalized reference to the owner's users doc (cheap "my projects" list) ──
  await setDoc(userRef, {
    ownedProjectIds: arrayUnion(projectId),
  }, { merge: true });

  return projectId;
};

// ══════════════════════════════════════
//  2. Generate a share link (owner or existing collaborator can do this)
//     ⚠️ This is created only once, not a separate write each time —
//     the same shareId can be copied and shared again as many times as wanted.
// ══════════════════════════════════════
window.createShareLink = async function (projectId, role = 'editor') {
  const user = auth.currentUser;
  if (!user) return null;

  const shareId   = randId(14);
  const shareRef  = doc(db, 'shareLinks', shareId);

  await setDoc(shareRef, {
    projectId,
    role,                    // 'editor' | 'viewer'
    createdBy: user.uid,
    createdAt: serverTimestamp(),
    active: true,
  });

  const link = `${location.origin}${location.pathname}?join=${shareId}`;
  return link;
};

// ══════════════════════════════════════
//  3. Join using a share link
//     — only 2 writes (project + user doc), no recurring cost after that
// ══════════════════════════════════════
window.joinProjectViaShareLink = async function (shareId) {
  const user = auth.currentUser;
  if (!user) { showToast?.('Please log in first to join', 'error'); return null; }

  const shareRef  = doc(db, 'shareLinks', shareId);
  const shareSnap = await getDoc(shareRef);

  if (!shareSnap.exists() || shareSnap.data().active === false) {
    showToast?.('This share link is invalid or has been disabled', 'error');
    return null;
  }

  const { projectId, role } = shareSnap.data();
  const projRef = doc(db, 'projects', projectId);
  const userRef = doc(db, 'users', user.uid);

  // ── No need to add again if already owner/collaborator ──
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) { showToast?.('Project not found', 'error'); return null; }

  const projData = projSnap.data();
  const already = projData.ownerUid === user.uid ||
                   (projData.collaboratorUids || []).includes(user.uid);

  if (!already) {
    await updateDoc(projRef, {
      collaboratorUids: arrayUnion(user.uid),
    });
    await setDoc(userRef, {
      sharedProjectIds: arrayUnion(projectId),
      roles: { [projectId]: role },
    }, { merge: true });
  }

  return projectId;
};

// ══════════════════════════════════════
//  4. "My Projects" list — just 1 read (users/{uid})
// ══════════════════════════════════════
window.listMyProjects = async function () {
  const user = auth.currentUser;
  if (!user) return [];

  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];

  const data = userSnap.data();
  const ids  = [...new Set([...(data.ownedProjectIds || []), ...(data.sharedProjectIds || [])])];

  // ── An individual read is needed to fetch each project's name/meta,
  //    but this only happens when the user opens the dashboard, not recurring ──
  const projects = [];
  for (const id of ids) {
    const snap = await getDoc(doc(db, 'projects', id));
    if (snap.exists()) {
      const d = snap.data();
      projects.push({
        id,
        name: d.name,
        isOwner: d.ownerUid === user.uid,
        collaboratorCount: (d.collaboratorUids || []).length,
        updatedAt: d.updatedAt?.toMillis?.() || 0,
      });
    }
  }
  return projects.sort((a, b) => b.updatedAt - a.updatedAt);
};

// ══════════════════════════════════════
//  5. Remove a collaborator (only the owner can do this — enforced by a rule)
// ══════════════════════════════════════
window.removeCollaborator = async function (projectId, uid) {
  const projRef  = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) return;

  const list = (projSnap.data().collaboratorUids || []).filter(u => u !== uid);
  await updateDoc(projRef, { collaboratorUids: list });
};

// ══════════════════════════════════════
//  6. Auto-handle when the URL has ?join=shareId
// ══════════════════════════════════════
window.handleJoinFromUrl = async function () {
  const params  = new URLSearchParams(location.search);
  const shareId = params.get('join');
  if (!shareId) return null;

  const projectId = await window.joinProjectViaShareLink(shareId);

  // Clean the URL so a refresh doesn't trigger another join
  params.delete('join');
  const clean = location.pathname + (params.toString() ? `?${params}` : '');
  history.replaceState({}, '', clean);

  if (projectId) {
    showToast?.('Joined the project ✅', 'success', 'fa-users');
  }
  return projectId;
};
