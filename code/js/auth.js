// ══════════════════════════════════════
//  AUTH MODULE — js/auth.js
//  Firebase Authentication সব কাজ এখানে
// ══════════════════════════════════════

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import firebaseConfig from "../config/firebase-config.js";
import {
  usernameError,
  isUsernameTaken,
  getUserUsername,
  reserveUsername,
  resolveLoginIdentifier,
  showUsernameGate,
  hideUsernameGate,
} from "./username.js";

// ── Initialize ──
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const gProvider = new GoogleAuthProvider();

// ── Auth State Listener ──
onAuthStateChanged(auth, async user => {
  if (!user) {
    showAuthScreen();
    hideUsernameGate();
    return;
  }

  // Profile settings এর জন্য আগেই expose করে রাখি (gate থেকেও দরকার হয়)
  window._firebaseAuth  = auth;
  window._updateProfile = updateProfile;

  // ── ইউজারনেম আছে কিনা চেক করো ──
  const username = await getUserUsername(user.uid);
  if (!username) {
    // পুরাতন ইউজার / ইউজারনেম ছাড়া অ্যাকাউন্ট → বাধ্যতামূলক Gate দেখাও
    document.getElementById('authScreen').style.display = 'none';
    showUsernameGate(user, () => enterEditor(user));
    return;
  }

  window._currentUsername      = username;
  window._currentUsernameLower = username.toLowerCase();
  hideUsernameGate();
  enterEditor(user);
});

// ── Enter Editor ──
function enterEditor(user) {
  document.getElementById('authScreen').style.display = 'none';

  const displayName = user.displayName || user.email.split('@')[0];
  const initials    = displayName.slice(0, 2).toUpperCase();

  const navNameEl = document.getElementById('navName');
  if (navNameEl) navNameEl.textContent = displayName;
  document.getElementById('ddName').textContent  = displayName;
  document.getElementById('ddEmail').textContent = user.email;
  const menuNameEl  = document.getElementById('menuName');
  const menuEmailEl = document.getElementById('menuEmail');
  if (menuNameEl)  menuNameEl.textContent  = displayName;
  if (menuEmailEl) menuEmailEl.textContent = user.email;

  const uname = window._currentUsername;
  const ddUnameEl   = document.getElementById('ddUsername');
  const menuUnameEl = document.getElementById('menuUsername');
  if (ddUnameEl)   { ddUnameEl.textContent   = uname ? '@' + uname : ''; ddUnameEl.style.display   = uname ? 'block' : 'none'; }
  if (menuUnameEl) { menuUnameEl.textContent = uname ? '@' + uname : ''; menuUnameEl.style.display = uname ? 'block' : 'none'; }

  const navAv  = document.getElementById('navAvatar');
  const ddAv   = document.getElementById('ddAvatar');
  const menuAv = document.getElementById('menuAvatar');

  if (user.photoURL) {
    if (navAv) navAv.innerHTML = `<img src="${user.photoURL}" alt="">`;
    ddAv.innerHTML  = `<img src="${user.photoURL}" alt="">`;
    if (menuAv) menuAv.innerHTML = `<img src="${user.photoURL}" alt="">`;
  } else {
    if (navAv) navAv.textContent = initials;
    ddAv.textContent  = initials;
    if (menuAv) menuAv.textContent = initials;
  }

  const userPillEl = document.getElementById('userPill');
  if (userPillEl) userPillEl.style.display = 'flex';

  // Editor init (editor.js এ defined)
  if (typeof initEditorIfNeeded === 'function') initEditorIfNeeded();
}

// ── Show Auth ──
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  const up = document.getElementById('userPill');
  if (up) up.style.display = 'none';
}

// ── Login (Email অথবা Username দিয়ে) ──
window.doLogin = async function () {
  const identifier = document.getElementById('loginEmail').value.trim();
  const pass       = document.getElementById('loginPassword').value;
  if (!identifier || !pass) return showAuthMsg('loginMsg', 'error', 'সব ঘর পূরণ করুন।');

  setLoading('loginBtn', true);
  try {
    const { email, notFound } = await resolveLoginIdentifier(identifier);
    if (notFound) {
      setLoading('loginBtn', false);
      return showAuthMsg('loginMsg', 'error', 'এই ইউজারনেমে কোনো অ্যাকাউন্ট পাওয়া যায়নি।');
    }
    await signInWithEmailAndPassword(auth, email, pass);
    showAuthMsg('loginMsg', 'success', 'লগইন সফল! ডেটা লোড হচ্ছে…');
  } catch (e) {
    setLoading('loginBtn', false);
    showAuthMsg('loginMsg', 'error', friendlyError(e.code));
  }
};

// ── Register ──
window.doRegister = async function () {
  const name     = document.getElementById('registerName').value.trim();
  const username = document.getElementById('registerUsername').value.trim();
  const email    = document.getElementById('registerEmail').value.trim();
  const pass     = document.getElementById('registerPassword').value;
  const confirm  = document.getElementById('registerConfirm').value;

  if (!name)              return showAuthMsg('registerMsg', 'error', 'আপনার নাম দিন।');
  const unameErr = usernameError(username);
  if (unameErr)            return showAuthMsg('registerMsg', 'error', unameErr);
  if (!email)             return showAuthMsg('registerMsg', 'error', 'ইমেইল দিন।');
  if (pass.length < 6)    return showAuthMsg('registerMsg', 'error', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  if (pass !== confirm)   return showAuthMsg('registerMsg', 'error', 'পাসওয়ার্ড মিলছে না।');
  if (!document.getElementById('termsCheck').checked)
    return showAuthMsg('registerMsg', 'error', 'Terms মেনে নিন।');

  setLoading('registerBtn', true);
  try {
    const taken = await isUsernameTaken(username.toLowerCase());
    if (taken) {
      setLoading('registerBtn', false);
      return showAuthMsg('registerMsg', 'error', 'এই ইউজারনেম আগে থেকেই নেওয়া হয়েছে। অন্য একটা দিন।');
    }

    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    await reserveUsername(cred.user.uid, username, email);
    showAuthMsg('registerMsg', 'success', 'অ্যাকাউন্ট তৈরি হয়েছে!');
  } catch (e) {
    setLoading('registerBtn', false);
    showAuthMsg('registerMsg', 'error', friendlyError(e.code));
  }
};

// ── Google Login ──
window.doGoogleLogin = async function () {
  ['loginGoogleBtn', 'registerGoogleBtn'].forEach(id => setLoading(id, true));
  try {
    await signInWithPopup(auth, gProvider);
  } catch (e) {
    ['loginGoogleBtn', 'registerGoogleBtn'].forEach(id => setLoading(id, false));
    const msgId = document.getElementById('loginForm').classList.contains('active')
      ? 'loginMsg' : 'registerMsg';
    showAuthMsg(msgId, 'error', friendlyError(e.code));
  }
};

// ── Password Reset ──
window.doReset = async function () {
  const email = document.getElementById('resetEmail').value.trim();
  if (!email) return showAuthMsg('resetMsg', 'error', 'ইমেইল দিন।');
  setLoading('resetBtn', true);
  try {
    await sendPasswordResetEmail(auth, email);
    document.getElementById('resetNormal').style.display = 'none';
    document.getElementById('resetSent').classList.add('show');
    document.getElementById('resetMsg').classList.remove('show');
  } catch (e) {
    setLoading('resetBtn', false);
    showAuthMsg('resetMsg', 'error', friendlyError(e.code));
  }
};

// ── Sign Out ──
window.doSignOut = async function () {
  await signOut(auth);
  document.getElementById('userDropdown').classList.remove('show');
  if (typeof showToast === 'function') showToast('সাইন আউট হয়েছে', 'info', 'fa-right-from-bracket');
};

// ── Copy Email ──
window.copyEmail = function () {
  const em = document.getElementById('ddEmail').textContent;
  navigator.clipboard.writeText(em).then(() => {
    if (typeof showToast === 'function') showToast('ইমেইল কপি হয়েছে!', 'success', 'fa-copy');
  });
  document.getElementById('userDropdown').classList.remove('show');
};

// ── Open Profile Modal (delegates to profile.js) ──
window.openProfileModal = function () {
  if (window._profileReady) {
    window._profileModule.openProfileModal();
  } else {
    const iv = setInterval(() => {
      if (window._profileReady) { clearInterval(iv); window._profileModule.openProfileModal(); }
    }, 100);
  }
};

// ── Legacy saveProfile (compat shim) ──
window.saveProfile = function () {
  if (window._profileReady) window._profileModule.saveProfileInfo();
};

// ── Helpers ──
function friendlyError(code) {
  const map = {
    'auth/invalid-email':           'ইমেইল ঠিকানা সঠিক নয়।',
    'auth/user-not-found':          'এই ইমেইলে কোনো অ্যাকাউন্ট নেই।',
    'auth/wrong-password':          'পাসওয়ার্ড ভুল।',
    'auth/email-already-in-use':    'এই ইমেইলে ইতোমধ্যে অ্যাকাউন্ট আছে।',
    'auth/weak-password':           'পাসওয়ার্ড দুর্বল (কমপক্ষে ৬ অক্ষর)।',
    'auth/too-many-requests':       'অনেকবার চেষ্টা করা হয়েছে। একটু অপেক্ষা করুন।',
    'auth/network-request-failed':  'নেটওয়ার্ক সমস্যা।',
    'auth/popup-closed-by-user':    'Google সাইন-ইন বাতিল হয়েছে।',
    'auth/invalid-credential':      'ইমেইল বা পাসওয়ার্ড ভুল।',
    'auth/user-disabled':           'এই অ্যাকাউন্ট নিষ্ক্রিয় করা হয়েছে।',
  };
  return map[code] || 'কিছু একটা সমস্যা হয়েছে। আবার চেষ্টা করুন।';
}

function setLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.classList.toggle('loading', loading);
  btn.disabled = loading;
}

function showAuthMsg(id, type, msg) {
  const el = document.getElementById(id);
  const icon = type === 'error' ? 'fa-circle-exclamation'
             : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  el.className = `auth-msg ${type} show`;
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
}

window._firebaseReady = true;
