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
  GithubAuthProvider,
  sendPasswordResetEmail,
  onAuthStateChanged,
  signOut,
  updateProfile,
  deleteUser
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

import firebaseConfig from "../config/firebase-config.js";
import {
  isValidUsername,
  isUsernameAvailable,
  usernameFormatHint,
  reserveUsernameForNewUser,
  resolveLoginEmail,
  ensureUserHasUsername,
} from "./username.js";

// ── Initialize ──
const app       = initializeApp(firebaseConfig);
const auth      = getAuth(app);
const gProvider = new GoogleAuthProvider();
const ghProvider = new GithubAuthProvider();
ghProvider.addScope('repo'); // so a token from sign-in can also create/push repos for GitHub Deploy

// ── Auth State Listener ──
onAuthStateChanged(auth, user => {
  if (user) {
    enterEditor(user);
    // Make sure this user has a username (auto-generated for Google sign-ins
    // and pre-existing accounts made before this feature existed).
    // Runs in the background — never blocks entering the editor.
    ensureUserHasUsername(user).then(username => {
      if (username) _showUsernameInUI(username);
    }).catch(err => console.error('ensureUserHasUsername failed:', err));
  } else {
    showAuthScreen();
  }
});

// ── Enter Editor ──
function enterEditor(user) {
  document.getElementById('authScreen').style.display = 'none';
  if (window.AuthNetworkBG) window.AuthNetworkBG.stop();

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

  // Let other plain-script modules (e.g. js/whatsnew.js) know a user is
  // logged in and ready, so they can react without importing Firebase.
  document.dispatchEvent(new CustomEvent('tv:auth-ready', {
    detail: { uid: user.uid, name: displayName, email: user.email }
  }));
}

// ── Show the username under the email in the dropdown/drawer ──
function _showUsernameInUI(username) {
  const ddU   = document.getElementById('ddUsername');
  const menuU = document.getElementById('menuUsername');
  if (ddU)   { ddU.textContent   = '@' + username; ddU.style.display   = 'block'; }
  if (menuU) { menuU.textContent = '@' + username; menuU.style.display = 'block'; }
  window._currentUsername = username;
}

// ── Show Auth ──
function showAuthScreen() {
  document.getElementById('authScreen').style.display = 'flex';
  if (window.AuthNetworkBG) window.AuthNetworkBG.start();
  const up = document.getElementById('userPill');
  if (up) up.style.display = 'none';
}

// ── Login (accepts either an email or a username) ──
window.doLogin = async function () {
  const identifier = document.getElementById('loginEmail').value.trim();
  const pass       = document.getElementById('loginPassword').value;
  if (!identifier || !pass) return showAuthMsg('loginMsg', 'error', 'Please fill in all fields.');
  setLoading('loginBtn', true);
  try {
    const email = await resolveLoginEmail(identifier);
    if (!email) {
      setLoading('loginBtn', false);
      return showAuthMsg('loginMsg', 'error', identifier.includes('@')
        ? 'The email address is not valid.'
        : 'No account exists with this username.');
    }
    await signInWithEmailAndPassword(auth, email, pass);
    showAuthMsg('loginMsg', 'success', 'Login successful! Loading data…');
  } catch (e) {
    setLoading('loginBtn', false);
    showAuthMsg('loginMsg', 'error', friendlyError(e.code));
  }
};

// ── Register ──
window.doRegister = async function () {
  const name     = document.getElementById('registerName').value.trim();
  const email    = document.getElementById('registerEmail').value.trim();
  const username = document.getElementById('registerUsername').value.trim();
  const pass     = document.getElementById('registerPassword').value;
  const confirm  = document.getElementById('registerConfirm').value;

  // These are also checked step-by-step in auth-ui.js as the person moves forward,
  // but every field is re-validated here too since the final step could in theory
  // be reached without going through the wizard's Next buttons.
  if (!name)              { window.goToRegisterStep?.(1); return showAuthMsg('registerMsg', 'error', 'Please enter your name.'); }
  if (!email)             { window.goToRegisterStep?.(1); return showAuthMsg('registerMsg', 'error', 'Please enter an email.'); }
  if (!username)          { window.goToRegisterStep?.(2); return showAuthMsg('registerMsg', 'error', 'Please choose a username.'); }
  if (!isValidUsername(username)) {
    window.goToRegisterStep?.(2);
    return showAuthMsg('registerMsg', 'error', usernameFormatHint());
  }
  if (pass.length < 6)    { window.goToRegisterStep?.(3); return showAuthMsg('registerMsg', 'error', 'Password must be at least 6 characters.'); }
  if (pass !== confirm)   { window.goToRegisterStep?.(3); return showAuthMsg('registerMsg', 'error', 'Passwords do not match.'); }
  if (!document.getElementById('termsCheck').checked)
    return showAuthMsg('registerMsg', 'error', 'Please accept the Terms.');

  setLoading('registerBtn', true);

  // Fast best-effort check before creating the account (final say is the atomic transaction below)
  try {
    const available = await isUsernameAvailable(username);
    if (!available) {
      setLoading('registerBtn', false);
      window.goToRegisterStep?.(2);
      return showAuthMsg('registerMsg', 'error', 'This username is already taken. Please choose another.');
    }
  } catch (checkErr) {
    console.error('isUsernameAvailable failed:', checkErr);
    setLoading('registerBtn', false);
    const reason = checkErr.code === 'permission-denied'
      ? 'Server permission error (Firestore rules may not be deployed). Please contact support.'
      : 'Could not verify username availability. Please check your connection and try again.';
    return showAuthMsg('registerMsg', 'error', reason);
  }

  try {
    const cred = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(cred.user, { displayName: name });

    try {
      await reserveUsernameForNewUser(cred.user.uid, username, email, name, null);
    } catch (unameErr) {
      console.error('reserveUsernameForNewUser failed:', unameErr);
      // Roll back the freshly-created account so we don't leave a user with no username.
      await deleteUser(cred.user).catch(() => {});
      setLoading('registerBtn', false);

      if (unameErr.message === 'username-taken') {
        // Someone genuinely grabbed the username in the split second between our check and this write.
        window.goToRegisterStep?.(2);
        return showAuthMsg('registerMsg', 'error', 'This username was just taken by someone else. Please choose another.');
      }

      // Any other error (e.g. Firestore permission-denied because firestore.rules
      // hasn't been deployed yet, or a network issue) is NOT a username conflict —
      // show the real reason instead of falsely blaming the username.
      const reason = unameErr.code === 'permission-denied'
        ? 'Server permission error (Firestore rules may not be deployed). Please contact support.'
        : (unameErr.message || 'Something went wrong while creating your account. Please try again.');
      return showAuthMsg('registerMsg', 'error', reason);
    }

    showAuthMsg('registerMsg', 'success', 'Account created!');
  } catch (e) {
    setLoading('registerBtn', false);
    if (e.code === 'auth/email-already-in-use' || e.code === 'auth/invalid-email') window.goToRegisterStep?.(1);
    else if (e.code === 'auth/weak-password') window.goToRegisterStep?.(3);
    showAuthMsg('registerMsg', 'error', friendlyError(e.code));
  }
};

// ── Live username availability check (bound after DOM is ready) ──
function _bindUsernameAvailabilityCheck(inputId, hintId, currentUsernameGetter) {
  const input = document.getElementById(inputId);
  const hint  = document.getElementById(hintId);
  if (!input || !hint) return;

  let timer = null;
  input.addEventListener('input', () => {
    const val = input.value.trim();
    clearTimeout(timer);

    if (!val) { hint.textContent = ''; hint.className = 'username-hint'; return; }
    if (!isValidUsername(val)) {
      hint.textContent = usernameFormatHint();
      hint.className = 'username-hint error';
      return;
    }
    if (currentUsernameGetter && val.toLowerCase() === (currentUsernameGetter() || '').toLowerCase()) {
      hint.textContent = 'This is your current username.';
      hint.className = 'username-hint';
      return;
    }

    hint.textContent = 'Checking availability…';
    hint.className = 'username-hint';
    timer = setTimeout(async () => {
      const ok = await isUsernameAvailable(val);
      // Ignore stale results if the value changed while we were checking
      if (input.value.trim() !== val) return;
      hint.textContent = ok ? 'Username is available ✓' : 'This username is already taken.';
      hint.className   = ok ? 'username-hint success' : 'username-hint error';
    }, 400);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  _bindUsernameAvailabilityCheck('registerUsername', 'registerUsernameHint');
});

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

// ── GitHub Login ──
window.doGithubLogin = async function () {
  ['loginGithubBtn', 'registerGithubBtn'].forEach(id => setLoading(id, true));
  try {
    const result = await signInWithPopup(auth, ghProvider);
    // Hand the GitHub access token to the GitHub Deploy feature so the
    // account is already "connected" there — no need to connect twice.
    const credential = GithubAuthProvider.credentialFromResult(result);
    if (credential && credential.accessToken && typeof window.applyGithubSessionFromSignIn === 'function') {
      window.applyGithubSessionFromSignIn(credential.accessToken).catch(() => {});
    }
  } catch (e) {
    ['loginGithubBtn', 'registerGithubBtn'].forEach(id => setLoading(id, false));
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
    'auth/account-exists-with-different-credential': 'An account already exists with this email using a different sign-in method.',
    'auth/popup-blocked':           'Popup was blocked by the browser. Please allow popups and try again.',
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
