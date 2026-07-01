// ══════════════════════════════════════
//  AUTH MODULE — js/auth.js
//  All Firebase Authentication work happens here
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

  const navNameEl = document.getElementById('navName');
  if (navNameEl) navNameEl.textContent = displayName;
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

  // Editor init (defined in editor.js)
  if (typeof initEditorIfNeeded === 'function') initEditorIfNeeded();

  // Expose for profile settings
  window._firebaseAuth    = auth;
  window._updateProfile   = updateProfile;
}

// ── Show Auth ──
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  const up = document.getElementById('userPill');
  if (up) up.style.display = 'none';
}

// ── Login ──
window.doLogin = async function () {
  const email = document.getElementById('loginEmail').value.trim();
  const pass  = document.getElementById('loginPassword').value;
  if (!email || !pass) return showAuthMsg('loginMsg', 'error', 'Please fill in all fields.');
  setLoading('loginBtn', true);
  try {
    await signInWithEmailAndPassword(auth, email, pass);
    showAuthMsg('loginMsg', 'success', 'Login successful! Loading data…');
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

  if (!name)              return showAuthMsg('registerMsg', 'error', 'Please enter your name.');
  if (!email)             return showAuthMsg('registerMsg', 'error', 'Please enter an email.');
  if (pass.length < 6)    return showAuthMsg('registerMsg', 'error', 'Password must be at least 6 characters.');
  if (pass !== confirm)   return showAuthMsg('registerMsg', 'error', 'Passwords do not match.');
  if (!document.getElementById('termsCheck').checked)
    return showAuthMsg('registerMsg', 'error', 'Please accept the Terms.');

  setLoading('registerBtn', true);
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });
    showAuthMsg('registerMsg', 'success', 'Account created!');
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
  if (!email) return showAuthMsg('resetMsg', 'error', 'Please enter an email.');
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
  if (typeof showToast === 'function') showToast('Signed out', 'info', 'fa-right-from-bracket');
};

// ── Copy Email ──
window.copyEmail = function () {
  const em = document.getElementById('ddEmail').textContent;
  navigator.clipboard.writeText(em).then(() => {
    if (typeof showToast === 'function') showToast('Email copied!', 'success', 'fa-copy');
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
    'auth/invalid-email':           'The email address is not valid.',
    'auth/user-not-found':          'No account exists with this email.',
    'auth/wrong-password':          'Incorrect password.',
    'auth/email-already-in-use':    'An account already exists with this email.',
    'auth/weak-password':           'Password is too weak (at least 6 characters).',
    'auth/too-many-requests':       'Too many attempts. Please wait a moment.',
    'auth/network-request-failed':  'Network error.',
    'auth/popup-closed-by-user':    'Google sign-in was cancelled.',
    'auth/invalid-credential':      'Incorrect email or password.',
    'auth/user-disabled':           'This account has been disabled.',
  };
  return map[code] || 'Something went wrong. Please try again.';
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
