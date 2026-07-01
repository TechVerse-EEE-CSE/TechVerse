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
  getFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc,
  arrayUnion, arrayRemove, serverTimestamp, collection
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import firebaseConfig from "../config/firebase-config.js";

const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);

// ══════════════════════════════════════
//  ০. Auth "ready" হেল্পার
//     — Firebase auth state async ভাবে লোড হয়, তাই পেজ লোডের সাথে সাথে
//     auth.currentUser চেক করলে ভুলভাবে "লগইন নেই" ধরে নেওয়া হতে পারে,
//     যদিও ইউজার আসলে লগইন করা আছে (persisted session)।
// ══════════════════════════════════════
let _authResolved = false;
let _authWaiters   = [];

onAuthStateChanged(auth, (user) => {
  _authResolved = true;
  const waiters = _authWaiters;
  _authWaiters = [];
  waiters.forEach((fn) => fn(user));

  // ── ইউজার এইমাত্র লগইন করলো এবং আগে থেকে pending join-invite ছিল ──
  if (user && window._pendingJoinShareId) {
    const shareId = window._pendingJoinShareId;
    window._pendingJoinShareId = null;
    setTimeout(() => window.handleJoinFromUrl(shareId), 250);
  }
});

function waitForAuthUser() {
  return new Promise((resolve) => {
    if (_authResolved) resolve(auth.currentUser);
    else _authWaiters.push(resolve);
  });
}

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
      const isOwner = d.ownerUid === user.uid;
      projects.push({
        id,
        name: d.name,
        isOwner,
        ownerName: d.ownerName || 'অজানা',
        // ── এই ইউজারের role — owner হলে সবসময় 'owner', নাহলে যোগ দেওয়ার সময়
        //    নির্ধারিত role (এখন শুধু 'editor' সাপোর্টেড) ──
        role: isOwner ? 'owner' : (data.roles?.[id] || 'editor'),
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
//  ৬. প্রজেক্ট ডিলিট করা — শুধুমাত্র owner এই কাজ করতে পারবে।
//     কোলাবোরেটর (এডিটর হিসেবে যোগ দেওয়া ইউজার) কখনোই ডিলিট করতে পারবে না —
//     এটা এখানে client-side এ চেক করা হয়, এবং একই নিয়ম firestore.rules
//     ফাইলেও enforce করা আছে (ক্লায়েন্ট সাইড চেক বাইপাস করা গেলেও সার্ভার
//     সাইডে আটকে যাবে)।
// ══════════════════════════════════════
window.deleteProject = async function (projectId) {
  const user = auth.currentUser;
  if (!user) { showToast?.('লগইন করুন প্রথমে', 'error'); return false; }

  const projRef  = doc(db, 'projects', projectId);
  const projSnap = await getDoc(projRef);
  if (!projSnap.exists()) return false;

  const d = projSnap.data();
  if (d.ownerUid !== user.uid) {
    showToast?.('শুধু প্রজেক্টের মালিক এটি ডিলিট করতে পারবেন। আপনি এই প্রজেক্টে এডিটর হিসেবে যুক্ত আছেন।', 'error');
    return false;
  }

  await deleteDoc(projRef);

  const userRef = doc(db, 'users', user.uid);
  await setDoc(userRef, { ownedProjectIds: arrayRemove(projectId) }, { merge: true });

  return true;
};

// ══════════════════════════════════════
//  ৭. শেয়ার লিংক থেকে প্রজেক্টের প্রিভিউ তথ্য আনা (join না করেই)
//     — অ্যাপ্রুভ/ক্যান্সেল মোডালে দেখানোর জন্য ব্যবহার হবে
// ══════════════════════════════════════
window.getShareLinkInfo = async function (shareId) {
  const shareRef  = doc(db, 'shareLinks', shareId);
  const shareSnap = await getDoc(shareRef);
  if (!shareSnap.exists() || shareSnap.data().active === false) return null;

  const { projectId, role } = shareSnap.data();
  const projSnap = await getDoc(doc(db, 'projects', projectId));
  if (!projSnap.exists()) return null;

  const d    = projSnap.data();
  const user = auth.currentUser;
  const already = !!user && (
    d.ownerUid === user.uid || (d.collaboratorUids || []).includes(user.uid)
  );

  return {
    shareId,
    projectId,
    role,
    projectName: d.name,
    ownerName: d.ownerName || 'অজানা',
    ownerUid: d.ownerUid,
    alreadyMember: already,
  };
};

// ══════════════════════════════════════
//  ৮. URL-এ ?join=shareId থাকলে হ্যান্ডল করা
//     নতুন ফ্লো:
//       ১) আগে auth state resolve হওয়ার জন্য অপেক্ষা করে (রেস কন্ডিশন এড়াতে)
//       ২) লগইন করা না থাকলে shareId মনে রেখে দেয় — লগইন স্ক্রিন দেখায়,
//          "আগে লগইন করুন" এরর টোস্ট দেখায় না
//       ৩) লগইন করা থাকলে (বা এইমাত্র লগইন করলে) সরাসরি জয়েন না করে
//          একটা অ্যাপ্রুভ/ক্যান্সেল মোডাল দেখায় (share-ui.js এ ডিফাইন করা)
//       ৪) ইউজার ইতোমধ্যে owner/collaborator হলে সরাসরি প্রজেক্ট ওপেন হয়ে যায়
// ══════════════════════════════════════
window.handleJoinFromUrl = async function () {
  const params  = new URLSearchParams(location.search);
  const shareId = params.get('join');
  if (!shareId) return null;

  const user = await waitForAuthUser();

  if (!user) {
    // ── এখনও লগইন হয়নি — মনে রাখো, লগইন স্ক্রিনেই থাকতে দাও।
    //    onAuthStateChanged এ ইউজার লগইন করার সাথে সাথে এই ফাংশন আবার চলবে। ──
    window._pendingJoinShareId = shareId;
    return null;
  }

  const info = await window.getShareLinkInfo(shareId);
  if (!info) {
    showToast?.('এই শেয়ার লিংকটি বৈধ নয় বা বন্ধ করা হয়েছে', 'error');
    cleanJoinUrlParam();
    return null;
  }

  if (info.alreadyMember) {
    // ── ইতোমধ্যে সদস্য — আবার অ্যাপ্রুভ চাওয়ার দরকার নেই, সরাসরি ওপেন করো ──
    cleanJoinUrlParam();
    if (typeof window.openExistingProject === 'function') {
      await window.openExistingProject(info.projectId);
    } else {
      window.currentProjectId = info.projectId;
      window.openProjectSync?.(info.projectId);
    }
    return info.projectId;
  }

  // ── নতুন সদস্য — অ্যাপ্রুভ/ক্যান্সেল মোডাল দেখাও, এখনই জয়েন করো না ──
  if (typeof window.showJoinApprovalModal === 'function') {
    window.showJoinApprovalModal(info);
  } else {
    // ফলব্যাক (যদি share-ui.js না লোড হয়): পুরনো আচরণ
    const projectId = await window.joinProjectViaShareLink(shareId);
    cleanJoinUrlParam();
    if (projectId) showToast?.('প্রজেক্টে জয়েন করা হয়েছে ✅', 'success', 'fa-users');
    return projectId;
  }
  return null;
};

// ── URL থেকে ?join= প্যারামিটার পরিষ্কার করা (রিফ্রেশে যেন আবার না চলে) ──
function cleanJoinUrlParam() {
  const params = new URLSearchParams(location.search);
  params.delete('join');
  const clean = location.pathname + (params.toString() ? `?${params}` : '');
  history.replaceState({}, '', clean);
}
window._cleanJoinUrlParam = cleanJoinUrlParam;
