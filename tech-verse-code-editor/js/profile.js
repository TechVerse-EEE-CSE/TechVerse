// ══════════════════════════════════════════════════════
//  PROFILE.JS — Tech Verse Profile Management
//  Features:
//   ✅ Display Name + Photo URL update
//   ✅ Email verification status
//   ✅ Password change (email users only)
//   ✅ Password strength checker
//   ✅ Firestore সমস্ত ডেটা ডিলিট
//   ✅ Account info (creation date, provider, etc.)
//   ✅ Account delete
//  js/profile.js — window global হিসেবে কাজ করে
// ══════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getAuth,
  updateProfile,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  sendEmailVerification,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  getDocs,
  deleteDoc,
  collection,
  query,
  where,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "../config/firebase-config.js";

// ── Init ──
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let _currentUser = null;
let _deleteTarget = null; // 'data' | 'account'

// ── Auth state ──
onAuthStateChanged(auth, (user) => {
  _currentUser = user;
});

// ══════════════════════════════════════
//  OPEN PROFILE MODAL
// ══════════════════════════════════════
window.openProfileModal = function () {
  const user = auth.currentUser;
  if (!user) return;
  _currentUser = user;

  // Populate info tab
  _populateInfoTab(user);
  _populatePasswordTab(user);
  _populateAccountTab(user);

  // Show first tab
  switchProfileTab('info');

  // Clear messages
  ['profileInfoMsg', 'profilePwMsg', 'profileAccMsg'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.className = 'profile-msg';
  });

  if (typeof openModal === 'function') openModal('profileModal');
  document.getElementById('userDropdown')?.classList.remove('show');
};

// ── Populate Info Tab ──
function _populateInfoTab(user) {
  const displayName = user.displayName || user.email?.split('@')[0] || '—';
  const initials    = displayName.slice(0, 2).toUpperCase();

  // Avatar
  const av = document.getElementById('profileAvatarBig');
  if (av) {
    if (user.photoURL) {
      av.innerHTML = `<img src="${user.photoURL}" alt=""><span class="profile-avatar-badge"><i class="fa-solid fa-check"></i></span>`;
    } else {
      av.textContent = initials;
    }
  }

  // Names
  _setText('profileNameDisplay', displayName);
  _setText('profileEmailDisplay', user.email || '—');

  // Provider badge
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');
  const badge    = document.getElementById('profileProviderBadge');
  if (badge) {
    badge.className  = `profile-provider-badge ${isGoogle ? 'google' : 'email'}`;
    badge.innerHTML  = isGoogle
      ? '<i class="fa-brands fa-google"></i> Google Account'
      : '<i class="fa-solid fa-envelope"></i> Email Account';
  }

  // Inputs
  const nameInput  = document.getElementById('profileNameInput');
  const photoInput = document.getElementById('profilePhotoInput');
  if (nameInput)  nameInput.value  = user.displayName || '';
  if (photoInput) photoInput.value = user.photoURL    || '';

  // Verified status
  const verifiedEl = document.getElementById('profileEmailVerified');
  if (verifiedEl) {
    if (user.emailVerified) {
      verifiedEl.innerHTML = '<i class="fa-solid fa-circle-check" style="color:var(--success)"></i> Verified';
      verifiedEl.style.color = 'var(--success)';
    } else {
      verifiedEl.innerHTML = '<i class="fa-solid fa-circle-exclamation" style="color:var(--warning)"></i> Not verified';
      verifiedEl.style.color = 'var(--warning)';
    }
  }
}

// ── Populate Password Tab ──
function _populatePasswordTab(user) {
  const isGoogle  = user.providerData?.some(p => p.providerId === 'google.com');
  const pwSection = document.getElementById('pwChangeSection');
  const pwNotice  = document.getElementById('pwGoogleNotice');

  if (isGoogle) {
    if (pwSection) pwSection.style.display = 'none';
    if (pwNotice)  pwNotice.style.display  = 'flex';
  } else {
    if (pwSection) pwSection.style.display = 'block';
    if (pwNotice)  pwNotice.style.display  = 'none';
  }

  // Clear inputs
  ['profileCurrentPw', 'profileNewPw', 'profileConfirmPw'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  // Reset strength bar
  const fill = document.getElementById('pwStrengthFill');
  const text = document.getElementById('pwStrengthText');
  if (fill) { fill.className = 'pw-strength-fill'; fill.style.width = '0'; }
  if (text) text.textContent = '';
  _resetPwRequirements();
}

// ── Populate Account Tab ──
function _populateAccountTab(user) {
  const isGoogle = user.providerData?.some(p => p.providerId === 'google.com');

  _setText('accInfoEmail',    user.email || '—');
  _setText('accInfoProvider', isGoogle ? 'Google' : 'Email / Password');
  _setText('accInfoUid',      user.uid ? user.uid.slice(0, 16) + '…' : '—');

  // Created date
  const created = user.metadata?.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('bn-BD', {
        year: 'numeric', month: 'long', day: 'numeric'
      })
    : '—';
  _setText('accInfoCreated', created);

  // Last sign-in
  const lastSignIn = user.metadata?.lastSignInTime
    ? new Date(user.metadata.lastSignInTime).toLocaleString('bn-BD', {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '—';
  _setText('accInfoLastLogin', lastSignIn);
}

// ══════════════════════════════════════
//  TAB SWITCHING
// ══════════════════════════════════════
window.switchProfileTab = function (tab) {
  document.querySelectorAll('.profile-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.querySelectorAll('.profile-tab-body').forEach(body => {
    body.classList.toggle('active', body.id === `profileTab_${tab}`);
  });
};

// ══════════════════════════════════════
//  SAVE PROFILE INFO
// ══════════════════════════════════════
window.saveProfileInfo = async function () {
  const user = auth.currentUser;
  if (!user) return;

  const newName  = document.getElementById('profileNameInput')?.value.trim();
  const newPhoto = document.getElementById('profilePhotoInput')?.value.trim();

  if (!newName) {
    return _showProfileMsg('profileInfoMsg', 'error', 'নাম খালি রাখা যাবে না।');
  }

  _setProfileBtnLoading('profileInfoSaveBtn', true);

  try {
    await updateProfile(user, {
      displayName: newName,
      photoURL: newPhoto || null,
    });

    // Update all UI elements
    _updateAllAvatarsAndNames(user, newName, newPhoto);
    _populateInfoTab(user);

    _showProfileMsg('profileInfoMsg', 'success', 'প্রোফাইল আপডেট হয়েছে!');
    if (typeof showToast === 'function')
      showToast('প্রোফাইল সেভ হয়েছে!', 'success', 'fa-user-check');

  } catch (e) {
    _showProfileMsg('profileInfoMsg', 'error', e.message);
  } finally {
    _setProfileBtnLoading('profileInfoSaveBtn', false);
  }
};

// ── Update all avatars/names in the app ──
function _updateAllAvatarsAndNames(user, name, photoURL) {
  const initials = (name || '?').slice(0, 2).toUpperCase();

  const nameEls   = ['navName', 'ddName', 'menuName', 'profileNameDisplay'];
  const avatarEls = ['navAvatar', 'ddAvatar', 'menuAvatar', 'profileAvatarBig'];

  nameEls.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.textContent = name;
  });

  avatarEls.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (photoURL) {
      el.innerHTML = `<img src="${photoURL}" alt="">`;
    } else {
      el.textContent = initials;
    }
  });
}

// ══════════════════════════════════════
//  PASSWORD CHANGE
// ══════════════════════════════════════
window.changePassword = async function () {
  const user = auth.currentUser;
  if (!user) return;

  const currentPw = document.getElementById('profileCurrentPw')?.value;
  const newPw     = document.getElementById('profileNewPw')?.value;
  const confirmPw = document.getElementById('profileConfirmPw')?.value;

  if (!currentPw) return _showProfileMsg('profilePwMsg', 'error', 'বর্তমান পাসওয়ার্ড দিন।');
  if (!newPw || newPw.length < 8)
    return _showProfileMsg('profilePwMsg', 'error', 'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের হতে হবে।');
  if (newPw !== confirmPw)
    return _showProfileMsg('profilePwMsg', 'error', 'নতুন পাসওয়ার্ড দুটো মিলছে না।');
  if (currentPw === newPw)
    return _showProfileMsg('profilePwMsg', 'error', 'নতুন পাসওয়ার্ড আগেরটার মতো হলে চলবে না।');

  const strength = _getPasswordStrength(newPw);
  if (strength.score < 2)
    return _showProfileMsg('profilePwMsg', 'error', 'পাসওয়ার্ড খুব দুর্বল। আরো শক্তিশালী পাসওয়ার্ড ব্যবহার করুন।');

  _setProfileBtnLoading('profilePwSaveBtn', true);

  try {
    // Re-authenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPw);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPw);

    _showProfileMsg('profilePwMsg', 'success', 'পাসওয়ার্ড পরিবর্তন হয়েছে! পরবর্তীবার নতুন পাসওয়ার্ড দিয়ে লগইন করুন।');
    if (typeof showToast === 'function')
      showToast('পাসওয়ার্ড পরিবর্তন হয়েছে!', 'success', 'fa-lock');

    // Clear fields
    ['profileCurrentPw', 'profileNewPw', 'profileConfirmPw'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    _resetPwRequirements();

  } catch (e) {
    const map = {
      'auth/wrong-password':          'বর্তমান পাসওয়ার্ড ভুল।',
      'auth/too-many-requests':       'অনেকবার চেষ্টা করা হয়েছে। একটু অপেক্ষা করুন।',
      'auth/requires-recent-login':   'নিরাপত্তার জন্য আবার লগইন করুন।',
      'auth/weak-password':           'পাসওয়ার্ড খুব দুর্বল।',
      'auth/invalid-credential':      'বর্তমান পাসওয়ার্ড ভুল।',
    };
    _showProfileMsg('profilePwMsg', 'error', map[e.code] || e.message);
  } finally {
    _setProfileBtnLoading('profilePwSaveBtn', false);
  }
};

// ── Password Strength Checker ──
window.checkPasswordStrength = function (val) {
  const strength = _getPasswordStrength(val);
  const fill     = document.getElementById('pwStrengthFill');
  const text     = document.getElementById('pwStrengthText');

  if (!fill || !text) return;

  if (!val) {
    fill.className    = 'pw-strength-fill';
    fill.style.width  = '0';
    text.textContent  = '';
  } else {
    fill.className   = `pw-strength-fill ${strength.label}`;
    text.textContent = `শক্তি: ${_strengthLabelBn(strength.label)}`;
    text.style.color = strength.color;
  }

  // Requirements
  _setPwReq('reqLength',  val.length >= 8);
  _setPwReq('reqUpper',   /[A-Z]/.test(val));
  _setPwReq('reqNumber',  /[0-9]/.test(val));
  _setPwReq('reqSpecial', /[^A-Za-z0-9]/.test(val));
};

function _getPasswordStrength(pw) {
  let score = 0;
  if (pw.length >= 8)          score++;
  if (pw.length >= 12)         score++;
  if (/[A-Z]/.test(pw))       score++;
  if (/[0-9]/.test(pw))       score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;

  if (score <= 1) return { score, label: 'weak',   color: '#ef4444' };
  if (score <= 2) return { score, label: 'fair',   color: '#f59e0b' };
  if (score <= 3) return { score, label: 'good',   color: '#3ecf8e' };
  return              { score, label: 'strong', color: '#10c98f' };
}

function _strengthLabelBn(label) {
  return { weak: 'দুর্বল 😟', fair: 'মাঝারি 😐', good: 'ভালো 🙂', strong: 'শক্তিশালী 💪' }[label] || '';
}

function _setPwReq(id, met) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.toggle('met', met);
  const icon = el.querySelector('i');
  if (icon) icon.className = met ? 'fa-solid fa-circle-check' : 'fa-regular fa-circle';
}

function _resetPwRequirements() {
  ['reqLength', 'reqUpper', 'reqNumber', 'reqSpecial'].forEach(id => _setPwReq(id, false));
  const fill = document.getElementById('pwStrengthFill');
  const text = document.getElementById('pwStrengthText');
  if (fill) { fill.className = 'pw-strength-fill'; fill.style.width = '0'; }
  if (text) text.textContent = '';
}

// ══════════════════════════════════════
//  SEND EMAIL VERIFICATION
// ══════════════════════════════════════
window.sendVerificationEmail = async function () {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await sendEmailVerification(user);
    _showProfileMsg('profileInfoMsg', 'success', `Verification email পাঠানো হয়েছে ${user.email} তে।`);
    if (typeof showToast === 'function')
      showToast('Verification email পাঠানো হয়েছে!', 'info', 'fa-envelope');
  } catch (e) {
    _showProfileMsg('profileInfoMsg', 'error', 'Email পাঠানো যায়নি। কিছুক্ষণ পর আবার চেষ্টা করুন।');
  }
};

// ══════════════════════════════════════
//  DELETE CONFIRMATION MODAL
// ══════════════════════════════════════
window.openDeleteConfirm = function (type) {
  _deleteTarget = type; // 'data' | 'account'

  const modal   = document.getElementById('deleteConfirmModal');
  const typeEl  = document.getElementById('deleteTypeBadge');
  const titleEl = document.getElementById('deleteConfirmTitle');
  const descEl  = document.getElementById('deleteConfirmDesc');
  const inputWr = document.getElementById('deleteConfirmInputWrap');
  const inputEl = document.getElementById('deleteConfirmInput');

  if (type === 'data') {
    if (typeEl)  typeEl.textContent    = 'সমস্ত Cloud ডেটা';
    if (titleEl) titleEl.textContent   = 'সমস্ত ডেটা ডিলিট করবেন?';
    if (descEl)  descEl.innerHTML      = 'Firestore থেকে আপনার <strong>সমস্ত প্রজেক্ট ও ফাইল</strong> চিরতরে মুছে যাবে। Local ডেটা থাকবে।';
    if (inputWr) inputWr.style.display = 'block';
    if (inputEl) inputEl.placeholder   = 'DELETE লিখুন নিশ্চিত করতে';
  } else {
    if (typeEl)  typeEl.textContent    = 'অ্যাকাউন্ট ডিলিট';
    if (titleEl) titleEl.textContent   = 'অ্যাকাউন্ট ডিলিট করবেন?';
    if (descEl)  descEl.innerHTML      = 'আপনার <strong>অ্যাকাউন্ট ও সমস্ত ডেটা</strong> চিরতরে মুছে যাবে। এই কাজ পূর্বাবস্থায় ফেরানো <strong>সম্ভব নয়</strong>।';
    if (inputWr) inputWr.style.display = 'block';
    if (inputEl) inputEl.placeholder   = 'DELETE লিখুন নিশ্চিত করতে';
  }

  if (inputEl) inputEl.value = '';
  _showProfileMsg('deleteConfirmMsg', '');
  if (typeof openModal === 'function') openModal('deleteConfirmModal');
};

// ── Execute Delete ──
window.executeDelete = async function () {
  const input = document.getElementById('deleteConfirmInput')?.value.trim();
  if (input !== 'DELETE') {
    return _showProfileMsg('deleteConfirmMsg', 'error', 'নিশ্চিত করতে DELETE (বড় হাতে) লিখুন।');
  }

  const user = auth.currentUser;
  if (!user) return;

  _setProfileBtnLoading('executeDeleteBtn', true);

  try {
    if (_deleteTarget === 'data') {
      await _deleteAllFirestoreData(user);
      if (typeof openModal === 'function') {
        if (typeof closeModal === 'function') {
          closeModal('deleteConfirmModal');
          closeModal('profileModal');
        }
      }
      if (typeof showToast === 'function')
        showToast('সমস্ত Cloud ডেটা মুছে গেছে', 'info', 'fa-trash');

    } else if (_deleteTarget === 'account') {
      await _deleteAllFirestoreData(user);
      await deleteUser(user);
      // Auth state change will redirect to login
      if (typeof showToast === 'function')
        showToast('অ্যাকাউন্ট ডিলিট হয়েছে', 'info', 'fa-user-slash');
    }
  } catch (e) {
    const map = {
      'auth/requires-recent-login': 'নিরাপত্তার জন্য আবার লগইন করুন, তারপর ডিলিট করুন।',
    };
    _showProfileMsg('deleteConfirmMsg', 'error', map[e.code] || e.message);
  } finally {
    _setProfileBtnLoading('executeDeleteBtn', false);
  }
};

// ── Delete all Firestore data ──
async function _deleteAllFirestoreData(user) {
  const batch = writeBatch(db);

  // 1. user's projects
  const projQuery = query(
    collection(db, 'projects'),
    where('ownerId', '==', user.uid)
  );
  const projSnap = await getDocs(projQuery);
  projSnap.forEach(d => batch.delete(d.ref));

  // 2. user document
  const userRef = doc(db, 'users', user.uid);
  batch.delete(userRef);

  // 3. shared projects (collaborator এ আছে)
  try {
    const sharedQuery = query(
      collection(db, 'projects'),
      where('collaborators', 'array-contains', user.uid)
    );
    const sharedSnap = await getDocs(sharedQuery);
    sharedSnap.forEach(d => batch.delete(d.ref));
  } catch (_) {
    // collaborators field না থাকলে skip
  }

  await batch.commit();

  // Clear local IDB
  if (typeof IDBStore !== 'undefined' && IDBStore.clear) {
    await IDBStore.clear();
  }

  // Clear window state
  window.currentProjectId = null;
}

// ══════════════════════════════════════
//  TOGGLE PASSWORD VISIBILITY
// ══════════════════════════════════════
window.togglePwVisibility = function (inputId, iconEl) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const isText = input.type === 'text';
  input.type   = isText ? 'password' : 'text';
  iconEl.className = isText
    ? 'fa-regular fa-eye pf-input-icon'
    : 'fa-regular fa-eye-slash pf-input-icon';
};

// ══════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════
function _setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function _showProfileMsg(id, type, msg) {
  const el = document.getElementById(id);
  if (!el) return;
  if (!type) { el.className = 'profile-msg'; return; }
  const icon = type === 'error'   ? 'fa-circle-exclamation'
             : type === 'success' ? 'fa-circle-check'
             :                      'fa-circle-info';
  el.className = `profile-msg ${type} show`;
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
}

function _setProfileBtnLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  if (!btn) return;
  btn.disabled = loading;
  if (loading) {
    btn.dataset.original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  } else {
    if (btn.dataset.original) btn.innerHTML = btn.dataset.original;
  }
}

// ── Expose to window ──
window._profileModule = {
  openProfileModal,
  switchProfileTab,
  saveProfileInfo,
  changePassword,
  checkPasswordStrength,
  sendVerificationEmail,
  openDeleteConfirm,
  executeDelete,
  togglePwVisibility,
};

window._profileReady = true;
