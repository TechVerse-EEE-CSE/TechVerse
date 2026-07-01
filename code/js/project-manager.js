// ══════════════════════════════════════
//  PROJECT MANAGER — js/project-manager.js
//  একাধিক প্রজেক্ট + শেয়ারিং + কোলাবোরেশন
//
//  ডিজাইন প্রিন্সিপাল (Firestore লোড কম রাখার জন্য):
//   - শেয়ার লিংক ছাড়া কেউ প্রজেক্টে ঢুকতে পারবে না
//   - জয়েন করা একবারের event (2 write, repeat হয় না)
//   - "আমার প্রজেক্ট" লিস্ট আনতে collection query না করে
//     users/{uid} ডকে denormalized array রাখা হয়েছে (1 read)
//   - কোনো realtime keystroke sync নেই — সেভ এখনো manual/debounced
// ══════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, updateDoc,
  arrayUnion, serverTimestamp, collection,
  query, where, getDocs, deleteField
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ── ছোট র‍্যান্ডম id জেনারেটর (shareId / projectId এর জন্য) ──
function randId(len = 10) {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let out = '';
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

// ══════════════════════════════════════
//  ১. নতুন প্রজেক্ট তৈরি
// ══════════════════════════════════════
window.createProject = async function (name, fsData) {
  const user = auth.currentUser;
  if (!user) { showToast?.('লগইন করুন প্রথমে', 'error'); return null; }

  const projectId = randId(12);
  const projRef   = doc(db, 'projects', projectId);
  const userRef   = doc(db, 'users', user.uid);

  await setDoc(projRef, {
    name,
    ownerUid: user.uid,
    ownerName: user.displayName || user.email || 'অজানা',
    fs: fsData,
    collaboratorUids: [],          // ← কোলাবোরেটরদের uid এখানে যোগ হবে
    roles: {},                     // ← { uid: 'admin' | 'editor' }
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  // ── owner-এর users ডকে denormalized রেফারেন্স যোগ (cheap "my projects" list) ──
  await setDoc(userRef, {
    ownedProjectIds: arrayUnion(projectId),
  }, { merge: true });

  return projectId;
};

// ══════════════════════════════════════
//  ২. ইউজারনেম বা ইমেইল দিয়ে সরাসরি ইনভাইট করা (এডমিন / এডিটর রোল)
//     — কোনো শেয়ার লিংক নেই, সরাসরি ইউজারের অ্যাকাউন্টে প্রজেক্ট যুক্ত হয়
// ══════════════════════════════════════
window.inviteUserToProject = async function (projectId, identifier, role = 'editor') {
  const user = auth.currentUser;
  if (!user) { showToast?.('লগইন করুন প্রথমে', 'error'); return null; }

  identifier = (identifier || '').trim();
  if (!identifier) { showToast?.('ইউজারনেম বা ইমেইল লিখুন', 'error'); return null; }
  if (!['admin', 'editor'].includes(role)) role = 'editor';

  let targetUid   = null;
  let targetLabel = identifier;

  try {
    if (identifier.includes('@')) {
      // ── ইমেইল দিয়ে খোঁজা ──
      const q    = query(collection(db, 'users'), where('emailLower', '==', identifier.toLowerCase()));
      const snap = await getDocs(q);
      if (!snap.empty) {
        targetUid   = snap.docs[0].id;
        targetLabel = snap.docs[0].data().username || identifier;
      }
    } else {
      // ── ইউজারনেম দিয়ে খোঁজা ──
      const uSnap = await getDoc(doc(db, 'usernames', identifier.toLowerCase()));
      if (uSnap.exists()) {
        targetUid   = uSnap.data().uid;
        targetLabel = uSnap.data().username || identifier;
      }
    }
  } catch (e) {
    showToast?.('ইউজার খুঁজতে সমস্যা হয়েছে', 'error');
    return null;
  }

  if (!targetUid) {
    showToast?.('এই ইউজারনেম/ইমেইলে কোনো অ্যাকাউন্ট পাওয়া যায়নি', 'error');
    return null;
  }

  if (targetUid === user.uid) {
    showToast?.('নিজেকে ইনভাইট করা যাবে না', 'error');
    return null;
  }

  const projRef  = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) { showToast?.('প্রজেক্ট খুঁজে পাওয়া যায়নি', 'error'); return null; }

  const projData = projSnap.data();
  if (projData.ownerUid === targetUid) {
    showToast?.('উনি ইতোমধ্যে এই প্রজেক্টের মালিক', 'info');
    return null;
  }

  await updateDoc(projRef, {
    collaboratorUids: arrayUnion(targetUid),
    [`roles.${targetUid}`]: role,
  });

  await setDoc(doc(db, 'users', targetUid), {
    sharedProjectIds: arrayUnion(projectId),
    roles: { [projectId]: role },
  }, { merge: true });

  showToast?.(
    `${targetLabel} কে ${role === 'admin' ? 'এডমিন' : 'এডিটর'} হিসেবে ইনভাইট করা হয়েছে ✅`,
    'success', 'fa-user-plus'
  );
  return targetUid;
};

// ══════════════════════════════════════
//  ৩. প্রজেক্টের কোলাবোরেটর লিস্ট (ইউজারনেম/ইমেইল/রোল সহ)
// ══════════════════════════════════════
window.getProjectCollaborators = async function (projectId) {
  const projSnap = await getDoc(doc(db, 'projects', projectId));
  if (!projSnap.exists()) return [];

  const d     = projSnap.data();
  const uids  = d.collaboratorUids || [];
  const roles = d.roles || {};

  const out = [];
  for (const uid of uids) {
    const uSnap = await getDoc(doc(db, 'users', uid));
    const ud    = uSnap.exists() ? uSnap.data() : {};
    out.push({
      uid,
      username: ud.username || null,
      email: ud.email || null,
      role: roles[uid] || 'editor',
    });
  }
  return out;
};

// ══════════════════════════════════════
//  ৪. কোলাবোরেটরের রোল পরিবর্তন (এডমিন ⇄ এডিটর)
// ══════════════════════════════════════
window.updateCollaboratorRole = async function (projectId, uid, role) {
  if (!['admin', 'editor'].includes(role)) return;
  await updateDoc(doc(db, 'projects', projectId), {
    [`roles.${uid}`]: role,
  });
  await setDoc(doc(db, 'users', uid), {
    roles: { [projectId]: role },
  }, { merge: true });
  showToast?.('রোল আপডেট হয়েছে', 'success', 'fa-user-gear');
};

// ══════════════════════════════════════
//  ৪. "আমার প্রজেক্ট" লিস্ট — মাত্র ১টা read (users/{uid})
// ══════════════════════════════════════
window.listMyProjects = async function () {
  const user = auth.currentUser;
  if (!user) return [];

  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (!userSnap.exists()) return [];

  const data = userSnap.data();
  const ids  = [...new Set([...(data.ownedProjectIds || []), ...(data.sharedProjectIds || [])])];

  // ── প্রতিটা প্রজেক্টের নাম/মেটা আনতে individual read লাগবে,
  //    কিন্তু এটা ইউজার ড্যাশবোর্ড খোলার সময়েই হবে, recurring না ──
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
//  ৫. কোলাবোরেটর রিমুভ করা (শুধু owner/admin পারবে — rule দিয়ে enforce হবে)
// ══════════════════════════════════════
window.removeCollaborator = async function (projectId, uid) {
  const projRef  = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) return;

  const list = (projSnap.data().collaboratorUids || []).filter(u => u !== uid);
  await updateDoc(projRef, {
    collaboratorUids: list,
    [`roles.${uid}`]: deleteField(),
  });
  showToast?.('কোলাবোরেটর রিমুভ করা হয়েছে', 'info', 'fa-user-minus');
};
