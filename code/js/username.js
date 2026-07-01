// ══════════════════════════════════════════════════════
//  USERNAME.JS — ইউজারনেম সিস্টেম (js/username.js)
//  Features:
//   ✅ Username validate + availability check (Firestore)
//   ✅ Register এর সময় username reserve করা
//   ✅ Username অথবা Email দিয়ে login resolve করা
//   ✅ পুরাতন ইউজারদের জন্য বাধ্যতামূলক "Set Username" Gate
//   ✅ Profile থেকে username পরিবর্তন
//
//  Firestore Structure:
//   usernames/{usernameLower}  -> { uid, email, createdAt }
//   users/{uid}                -> { username, usernameLower, ... }  (merge)
// ══════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  deleteDoc,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "../config/firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

// ══════════════════════════════════════
//  VALIDATION
// ══════════════════════════════════════
export function usernameError(raw) {
  const u = (raw || '').trim();
  if (!u) return 'ইউজারনেম দিন।';
  if (u.length < 3) return 'ইউজারনেম কমপক্ষে ৩ অক্ষরের হতে হবে।';
  if (u.length > 20) return 'ইউজারনেম সর্বোচ্চ ২০ অক্ষরের হতে পারে।';
  if (!USERNAME_RE.test(u)) return 'শুধু ইংরেজি অক্ষর, সংখ্যা ও আন্ডারস্কোর ( _ ) ব্যবহার করুন।';
  return null;
}

// ══════════════════════════════════════
//  AVAILABILITY CHECK
// ══════════════════════════════════════
export async function isUsernameTaken(usernameLower, excludeUid = null) {
  const snap = await getDoc(doc(db, 'usernames', usernameLower));
  if (!snap.exists()) return false;
  if (excludeUid && snap.data().uid === excludeUid) return false;
  return true;
}

// ══════════════════════════════════════
//  GET CURRENT USERNAME OF A USER
// ══════════════════════════════════════
export async function getUserUsername(uid) {
  try {
    const snap = await getDoc(doc(db, 'users', uid));
    return snap.exists() ? (snap.data().username || null) : null;
  } catch (_) {
    return null;
  }
}

// ══════════════════════════════════════
//  RESERVE USERNAME (নতুন / প্রথমবার সেট করার সময়)
// ══════════════════════════════════════
export async function reserveUsername(uid, username, email) {
  const lower = username.trim().toLowerCase();
  await setDoc(doc(db, 'usernames', lower), {
    uid,
    email: email || null,
    createdAt: serverTimestamp(),
  });
  await setDoc(doc(db, 'users', uid), {
    username: username.trim(),
    usernameLower: lower,
  }, { merge: true });
  return username.trim();
}

// ══════════════════════════════════════
//  CHANGE USERNAME (প্রোফাইল থেকে পরিবর্তন)
// ══════════════════════════════════════
export async function changeUsername(uid, newUsername, email, oldUsernameLower) {
  const lower = newUsername.trim().toLowerCase();
  if (oldUsernameLower && oldUsernameLower !== lower) {
    try { await deleteDoc(doc(db, 'usernames', oldUsernameLower)); } catch (_) {}
  }
  return reserveUsername(uid, newUsername, email);
}

// ══════════════════════════════════════
//  LOGIN IDENTIFIER RESOLVE (Email অথবা Username)
// ══════════════════════════════════════
export async function resolveLoginIdentifier(identifier) {
  const id = (identifier || '').trim();
  if (!id) return { email: null, notFound: false };
  if (id.includes('@')) return { email: id, notFound: false }; // email হিসেবে ধরা হলো
  const snap = await getDoc(doc(db, 'usernames', id.toLowerCase()));
  if (!snap.exists()) return { email: null, notFound: true };
  return { email: snap.data().email, notFound: false };
}

// ══════════════════════════════════════
//  DEBOUNCE HELPER
// ══════════════════════════════════════
function debounce(fn, ms) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}

// ══════════════════════════════════════
//  LIVE AVAILABILITY UI (Register ফর্ম + Gate ফর্ম এ ব্যবহারের জন্য)
//  inputId   -> username input এর id
//  msgId     -> status message দেখানোর জন্য element id
//  excludeUid-> নিজের username হলে skip করার জন্য (profile edit এ)
// ══════════════════════════════════════
function wireLiveCheck(inputId, msgId, excludeUidFn) {
  const input = document.getElementById(inputId);
  const msg   = document.getElementById(msgId);
  if (!input || !msg) return;

  const run = debounce(async () => {
    const val = input.value.trim();
    const err = usernameError(val);
    if (err) {
      msg.className = 'uname-check error';
      msg.textContent = err;
      input.dataset.valid = '';
      return;
    }
    msg.className = 'uname-check checking';
    msg.textContent = 'চেক করা হচ্ছে…';
    try {
      const excludeUid = excludeUidFn ? excludeUidFn() : null;
      const taken = await isUsernameTaken(val.toLowerCase(), excludeUid);
      if (taken) {
        msg.className = 'uname-check error';
        msg.textContent = 'এই ইউজারনেম আগে থেকেই নেওয়া হয়েছে।';
        input.dataset.valid = '';
      } else {
        msg.className = 'uname-check success';
        msg.textContent = 'ইউজারনেমটি খালি আছে ✓';
        input.dataset.valid = '1';
      }
    } catch (e) {
      msg.className = 'uname-check error';
      msg.textContent = 'চেক করা যায়নি। আবার চেষ্টা করুন।';
      input.dataset.valid = '';
    }
  }, 450);

  input.addEventListener('input', run);
}

document.addEventListener('DOMContentLoaded', () => {
  wireLiveCheck('registerUsername', 'registerUsernameMsg', () => null);
  wireLiveCheck('gateUsername', 'gateUsernameMsg', () => null);
  wireLiveCheck('profileUsernameInput', 'profileUsernameMsg', () => window._currentUsernameLower || null);
});

// ══════════════════════════════════════
//  MANDATORY USERNAME GATE (পুরাতন ইউজারদের জন্য)
// ══════════════════════════════════════
let _gateOnComplete = null;

export function showUsernameGate(user, onComplete) {
  _gateOnComplete = onComplete;
  const gate = document.getElementById('usernameGateScreen');
  if (!gate) return;
  const emailEl = document.getElementById('gateUserEmail');
  if (emailEl) emailEl.textContent = user.email || '';
  const input = document.getElementById('gateUsername');
  if (input) { input.value = ''; input.dataset.valid = ''; }
  const msg = document.getElementById('gateUsernameMsg');
  if (msg) { msg.className = 'uname-check'; msg.textContent = ''; }
  const err = document.getElementById('gateMsg');
  if (err) err.className = 'auth-msg';
  gate.style.display = 'flex';
}

export function hideUsernameGate() {
  const gate = document.getElementById('usernameGateScreen');
  if (gate) gate.style.display = 'none';
  _gateOnComplete = null;
}

window.doSetUsernameFromGate = async function () {
  const auth = window._firebaseAuth;
  const user = auth?.currentUser;
  if (!user) return;

  const input = document.getElementById('gateUsername');
  const val   = input?.value.trim() || '';
  const err   = usernameError(val);
  const msgEl = document.getElementById('gateMsg');
  const btn   = document.getElementById('gateSaveBtn');

  const showErr = (t) => {
    if (msgEl) {
      msgEl.className = 'auth-msg error show';
      msgEl.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${t}`;
    }
  };

  if (err) return showErr(err);

  if (btn) { btn.classList.add('loading'); btn.disabled = true; }
  try {
    const taken = await isUsernameTaken(val.toLowerCase());
    if (taken) {
      showErr('এই ইউজারনেম আগে থেকেই নেওয়া হয়েছে। অন্য একটা দিন।');
      return;
    }
    await reserveUsername(user.uid, val, user.email);
    window._currentUsername = val;
    window._currentUsernameLower = val.toLowerCase();
    hideUsernameGate();
    if (typeof showToast === 'function') showToast('ইউজারনেম সেট হয়েছে!', 'success', 'fa-user-check');
    if (typeof _gateOnComplete === 'function') _gateOnComplete();
  } catch (e) {
    showErr('কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।');
  } finally {
    if (btn) { btn.classList.remove('loading'); btn.disabled = false; }
  }
};

window._usernameModule = {
  usernameError,
  isUsernameTaken,
  getUserUsername,
  reserveUsername,
  changeUsername,
  resolveLoginIdentifier,
  showUsernameGate,
  hideUsernameGate,
};
window._usernameReady = true;