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

// ── Initialize ──
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const gProvider = new GoogleAuthProvider();

// ── Auth State Listener ──
onAuthStateChanged(auth, user => {
  if (user) {
    enterEditor(user);
  } else {
    showAuthScreen();
  }
});

// ── Enter Editor ──
function enterEditor(user) {
  document.getElementById('authScreen').style.display = 'none';

  const displayName = user.displayName || user.email.split('@')[0];
  const initials    = displayName.slice(0, 2).toUpperCase();

  document.getElementById('navName').textContent = displayName;
  document.getElementById('ddName').textContent  = displayName;
  document.getElementById('ddEmail').textContent = user.email;
  const menuNameEl  = document.getElementById('menuName');
  const menuEmailEl = document.getElementById('menuEmail');
  if (menuNameEl)  menuNameEl.textContent  = displayName;
  if (menuEmailEl) menuEmailEl.textContent = user.email;

  const navAv  = document.getElementById('navAvatar');
  const ddAv   = document.getElementById('ddAvatar');
  const menuAv = document.getElementById('menuAvatar');

  if (user.photoURL) {
    navAv.innerHTML = `<img src="${user.photoURL}" alt="">`;
    ddAv.innerHTML  = `<img src="${user.photoURL}" alt="">`;
    if (menuAv) menuAv.innerHTML = `<img src="${user.photoURL}" alt="">`;
  } else {
    navAv.textContent = initials;
    ddAv.textContent  = initials;
    if (menuAv) menuAv.textContent = initials;
  }

  document.getElementById('userPill').style.display = 'flex';

  // Editor init (editor.js এ defined)
  if (typeof initEditorIfNeeded === 'function') initEditorIfNeeded();

  // Profile settings এর জন্য expose
  window._firebaseAuth    = auth;
  window._updateProfile   = updateProfile;
}

// ── Show Auth ──
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  document.getElementById('userPill').style.display   = 'none';
}

// ── Login ──
window.doLogin = async function () {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (!email || !pass) return showAuthMsg('loginMsg', 'error', 'সব ঘর পূরণ করুন।');
  setLoading('loginBtn', true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showAuthMsg('loginMsg', 'success', 'লগইন সফল! Editor লোড হচ্ছে…');
  } catch (e) {
    setLoading('loginBtn', false);
    showAuthMsg('loginMsg', 'error', friendlyError(e.code));
  }
};

// ── Register ──
window.doRegister = async function () {
  const name    = document.getElementById('registerName').value.trim();
  const email   = document.getElementById('registerEmail').value.trim();
  const pass    = document.getElementById('registerPassword').value;
  const confirm = document.getElementById('registerConfirm').value;

  if (!name)              return showAuthMsg('registerMsg', 'error', 'আপনার নাম দিন।');
  if (!email)             return showAuthMsg('registerMsg', 'error', 'ইমেইল দিন।');
  if (pass.length < 6)    return showAuthMsg('registerMsg', 'error', 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।');
  if (pass !== confirm)   return showAuthMsg('registerMsg', 'error', 'পাসওয়ার্ড মিলছে না।');
  if (!document.getElementById('termsCheck').checked)
    return showAuthMsg('registerMsg', 'error', 'Terms মেনে নিন।');

  setLoading('registerBtn', true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    showAuthMsg('registerMsg', 'success', 'অ্যাকাউন্ট তৈরি হয়েছে! স্বাগতম 🎉');
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

// ── Save Profile ──
window.saveProfile = async function () {
  const user = window._firebaseAuth?.currentUser;
  const updateFn = window._updateProfile;
  if (!user || !updateFn) return;

  const newName  = document.getElementById('profileNameInput').value.trim();
  const newPhoto = document.getElementById('profilePhotoInput').value.trim();

  if (!newName) {
    showProfileMsg('error', 'নাম খালি রাখা যাবে না।');
    return;
  }

  document.getElementById('profileSaveBtn').disabled = true;
  document.getElementById('profileSaveLabel').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> সংরক্ষণ হচ্ছে…';

  try {
    await updateFn(user, { displayName: newName, photoURL: newPhoto || null });

    const initials = newName.slice(0, 2).toUpperCase();
    document.getElementById('navName').textContent             = newName;
    document.getElementById('ddName').textContent              = newName;
    document.getElementById('profileNameDisplay').textContent  = newName;
    const menuNameEl = document.getElementById('menuName');
    if (menuNameEl) menuNameEl.textContent = newName;

    if (newPhoto) {
      ['navAvatar','ddAvatar','profileAvatarBig','menuAvatar'].forEach(id =>
        document.getElementById(id) && (document.getElementById(id).innerHTML = `<img src="${newPhoto}" alt="">`));
    } else {
      ['navAvatar','ddAvatar','profileAvatarBig','menuAvatar'].forEach(id =>
        document.getElementById(id) && (document.getElementById(id).textContent = initials));
    }

    showProfileMsg('success', 'প্রোফাইল আপডেট হয়েছে!');
    if (typeof showToast === 'function') showToast('প্রোফাইল সেভ হয়েছে!', 'success', 'fa-user-check');
    setTimeout(() => { if (typeof closeModal === 'function') closeModal('profileModal'); }, 1200);
  } catch (e) {
    showProfileMsg('error', e.message);
  } finally {
    document.getElementById('profileSaveBtn').disabled = false;
    document.getElementById('profileSaveLabel').innerHTML = '<i class="fa-solid fa-floppy-disk"></i> সেভ';
  }
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

function showProfileMsg(type, msg) {
  const el = document.getElementById('profileMsg');
  const icon = type === 'error' ? 'fa-circle-exclamation' : 'fa-circle-check';
  el.className = `auth-msg ${type} show`;
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
}

window._firebaseReady = true;
