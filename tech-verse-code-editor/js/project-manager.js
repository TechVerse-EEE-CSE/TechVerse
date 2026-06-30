// ══════════════════════════════════════
//  PROJECT MANAGER — js/project-manager.js
//  একাধিক প্রজেক্ট + শেয়ারিং + কোলাবোরেশন
//
//  ডিজাইন প্রিন্সিপাল (Firestore লোড কম রাখার জন্য):
//   - শেয়ার লিংক ছাড়া কেউ প্রজেক্টে ঢুকতে পারবে না
//   - জয়েন করা একবারের event (2 write, repeat হয় না)
//   - "আমার প্রজেক্ট" লিস্ট আনতে collection query না করে
//     users/{uid} ডকে denormalized array রাখা হয়েছে (1 read), এবং সেই
//     array IndexedDB-তে cache করা থাকে যাতে পরের লগইনে আবার read না লাগে
//   - projects/{id} ডকে এখন আর fs (ভারী ডেটা) থাকে না — তাই এই লিস্টিং
//     read গুলো সবসময় ছোট ও সস্তা থাকে, প্রজেক্ট যত বড়ই হোক না কেন
//   - কোনো realtime keystroke sync নেই — সেভ এখনো manual/debounced
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

  const projectId  = randId(12);
  const projRef    = doc(db, 'projects', projectId);
  const contentRef = doc(db, 'projects', projectId, 'content', 'main');
  const userRef    = doc(db, 'users', user.uid);

  // ── META: হালকা ডক, fs নেই — listing/dashboard এর জন্য সস্তা ──
  await setDoc(projRef, {
    name,
    ownerUid: user.uid,
    ownerName: user.displayName || user.email || 'অজানা',
    collaboratorUids: [],          // ← কোলাবোরেটরদের uid এখানে যোগ হবে
    updatedAt: serverTimestamp(),
    updatedBy: user.uid,
  });

  // ── ভারী fs ডেটা আলাদা subdocument-এ ──
  await setDoc(contentRef, { fs: fsData || {} });

  // ── owner-এর users ডকে denormalized রেফারেন্স যোগ (cheap "my projects" list) ──
  await setDoc(userRef, {
    ownedProjectIds: arrayUnion(projectId),
  }, { merge: true });

  // ── local cache আপডেট, পরের লগইনে users/{uid} read এড়াতে ──
  const cacheKey = `ownedProjectIds_${user.uid}`;
  const cached = (await IDBStore.get(cacheKey).catch(() => undefined)) || [];
  await IDBStore.set(cacheKey, [...new Set([...cached, projectId])]);

  return projectId;
};

// ══════════════════════════════════════
//  ২. শেয়ার লিংক জেনারেট করা (owner বা existing collaborator করতে পারবে)
//     ⚠️ এটা শুধু একবার তৈরি হয়, প্রতিবার আলাদা write হয় না —
//     চাইলে একই shareId বারবার পুনরায় কপি করে শেয়ার করা যায়।
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
//  ৩. শেয়ার লিংক দিয়ে জয়েন করা
//     — মাত্র 2 write (project + user doc), এরপর কোনো recurring cost নেই
// ══════════════════════════════════════
window.joinProjectViaShareLink = async function (shareId) {
  const user = auth.currentUser;
  if (!user) { showToast?.('জয়েন করার জন্য আগে লগইন করুন', 'error'); return null; }

  const shareRef  = doc(db, 'shareLinks', shareId);
  const shareSnap = await getDoc(shareRef);

  if (!shareSnap.exists() || shareSnap.data().active === false) {
    showToast?.('এই শেয়ার লিংকটি বৈধ নয় বা বন্ধ করা হয়েছে', 'error');
    return null;
  }

  const { projectId, role } = shareSnap.data();
  const projRef = doc(db, 'projects', projectId);
  const userRef = doc(db, 'users', user.uid);

  // ── ইতোমধ্যে owner/collaborator হলে আবার যোগ করার দরকার নেই ──
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) { showToast?.('প্রজেক্ট খুঁজে পাওয়া যায়নি', 'error'); return null; }

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
//  ৫. কোলাবোরেটর রিমুভ করা (শুধু owner পারবে — rule দিয়ে enforce হবে)
// ══════════════════════════════════════
window.removeCollaborator = async function (projectId, uid) {
  const projRef  = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) return;

  const list = (projSnap.data().collaboratorUids || []).filter(u => u !== uid);
  await updateDoc(projRef, { collaboratorUids: list });
};

// ══════════════════════════════════════
//  ৬. URL-এ ?join=shareId থাকলে অটো-হ্যান্ডল করা
// ══════════════════════════════════════
window.handleJoinFromUrl = async function () {
  const params  = new URLSearchParams(location.search);
  const shareId = params.get('join');
  if (!shareId) return null;

  const projectId = await window.joinProjectViaShareLink(shareId);

  // URL পরিষ্কার করো যাতে রিফ্রেশে আবার জয়েন না হয়
  params.delete('join');
  const clean = location.pathname + (params.toString() ? `?${params}` : '');
  history.replaceState({}, '', clean);

  if (projectId) {
    showToast?.('প্রজেক্টে জয়েন করা হয়েছে ✅', 'success', 'fa-users');
  }
  return projectId;
};
