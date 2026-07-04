// ══════════════════════════════════════════════════════
//  PROFILE.JS — Tech Verse Profile Management
//  Features:
//   ✅ Display Name + Photo URL update
//   ✅ Email verification status
//   ✅ Password change (email users only)
//   ✅ Password strength checker
//   ✅ Delete all Firestore data
//   ✅ Account info (creation date, provider, etc.)
//   ✅ Account delete
//  js/profile.js — works as a window global
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
import {
  isValidUsername,
  isUsernameAvailable,
  usernameFormatHint,
  changeUsername,
} from "./username.js";

// ── Init ──
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

let _currentUser = null;
let _deleteTarget = null; // 'data' | 'account'
let _currentUsername = '';

// ── Auth state ──
onAuthStateChanged(auth, (user) => {
  _currentUser = user;
});

// ══════════════════════════════════════
//  OPEN PROFILE MODAL
// ══════════════════════════════════════
window.openProfileModal = async function () {
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

  // Fetch the current username (stored in users/{uid}, not in Firebase Auth itself)
  try {
    const snap = await getDoc(doc(db, 'users', user.uid));
    _currentUsername = snap.exists() ? (snap.data().username || '') : '';
  } catch (_) {
    _currentUsername = '';
  }
  const unameInput = document.getElementById('profileUsernameInput');
  if (unameInput) unameInput.value = _currentUsername;
  const unameHint = document.getElementById('profileUsernameHint');
  if (unameHint) { unameHint.textContent = ''; unameHint.className = 'username-hint'; }
};

// ── Live username availability check in the profile modal ──
document.addEventListener('DOMContentLoaded', () => {
  const input = document.getElementById('profileUsernameInput');
  const hint  = document.getElementById('profileUsernameHint');
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
    if (val.toLowerCase() === (_currentUsername || '').toLowerCase()) {
      hint.textContent = 'This is your current username.';
      hint.className = 'username-hint';
      return;
    }

    hint.textContent = 'Checking availability…';
    hint.className = 'username-hint';
    timer = setTimeout(async () => {
      const ok = await isUsernameAvailable(val);
      if (input.value.trim() !== val) return;
      hint.textContent = ok ? 'Username is available ✓' : 'This username is already taken.';
      hint.className   = ok ? 'username-hint success' : 'username-hint error';
    }, 400);
  });
});

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

  // Tab badges
  const pwBadge  = document.getElementById('pwTabBadge');
  const accBadge = document.getElementById('accTabBadge');
  if (pwBadge)  pwBadge.style.display  = !user.emailVerified ? 'inline-flex' : 'none';
  if (accBadge) accBadge.style.display = 'none';

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

  const newName     = document.getElementById('profileNameInput')?.value.trim();
  const newPhoto    = document.getElementById('profilePhotoInput')?.value.trim();
  const newUsername = document.getElementById('profileUsernameInput')?.value.trim();

  if (!newName) {
    return _showProfileMsg('profileInfoMsg', 'error', 'Name cannot be left empty.');
  }
  if (newUsername && !isValidUsername(newUsername)) {
    return _showProfileMsg('profileInfoMsg', 'error', usernameFormatHint());
  }

  _setProfileBtnLoading('profileInfoSaveBtn', true);

  try {
    await updateProfile(user, {
      displayName: newName,
      photoURL: newPhoto || null,
    });

    // Username changed? Reserve the new one (atomic) and release the old one.
    const usernameChanged = newUsername && newUsername.toLowerCase() !== (_currentUsername || '').toLowerCase();
    if (usernameChanged) {
      try {
        await changeUsername(user.uid, _currentUsername, newUsername, user.email);
        _currentUsername = newUsername;
      } catch (unameErr) {
        _setProfileBtnLoading('profileInfoSaveBtn', false);
        return _showProfileMsg('profileInfoMsg', 'error', 'This username is already taken. Please choose another.');
      }
    }

    // Update all UI elements
    _updateAllAvatarsAndNames(user, newName, newPhoto);
    _populateInfoTab(user);
    if (usernameChanged) {
      const ddU   = document.getElementById('ddUsername');
      const menuU = document.getElementById('menuUsername');
      if (ddU)   { ddU.textContent   = '@' + _currentUsername; ddU.style.display   = 'block'; }
      if (menuU) { menuU.textContent = '@' + _currentUsername; menuU.style.display = 'block'; }
      window._currentUsername = _currentUsername;
    }

    _showProfileMsg('profileInfoMsg', 'success', 'Profile updated!');
    if (typeof showToast === 'function')
      showToast('Profile saved!', 'success', 'fa-user-check');

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

  if (!currentPw) return _showProfileMsg('profilePwMsg', 'error', 'Please enter your current password.');
  if (!newPw || newPw.length < 8)
    return _showProfileMsg('profilePwMsg', 'error', 'New password must be at least 8 characters.');
  if (newPw !== confirmPw)
    return _showProfileMsg('profilePwMsg', 'error', 'The new passwords do not match.');
  if (currentPw === newPw)
    return _showProfileMsg('profilePwMsg', 'error', 'The new password cannot be the same as the old one.');

  const strength = _getPasswordStrength(newPw);
  if (strength.score < 2)
    return _showProfileMsg('profilePwMsg', 'error', 'Password is too weak. Please use a stronger password.');

  _setProfileBtnLoading('profilePwSaveBtn', true);

  try {
    // Re-authenticate first
    const credential = EmailAuthProvider.credential(user.email, currentPw);
    await reauthenticateWithCredential(user, credential);

    // Update password
    await updatePassword(user, newPw);

    _showProfileMsg('profilePwMsg', 'success', 'Password changed! Use the new password to log in next time.');
    if (typeof showToast === 'function')
      showToast('Password changed!', 'success', 'fa-lock');

    // Clear fields
    ['profileCurrentPw', 'profileNewPw', 'profileConfirmPw'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });
    _resetPwRequirements();

  } catch (e) {
    const map = {
      'auth/wrong-password':          'Current password is incorrect.',
      'auth/too-many-requests':       'Too many attempts. Please wait a moment.',
      'auth/requires-recent-login':   'Please log in again for security.',
      'auth/weak-password':           'Password is too weak.',
      'auth/invalid-credential':      'Current password is incorrect.',
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
    text.textContent = `Strength: ${_strengthLabelBn(strength.label)}`;
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
  return { weak: 'Weak 😟', fair: 'Fair 😐', good: 'Good 🙂', strong: 'Strong 💪' }[label] || '';
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
    _showProfileMsg('profileInfoMsg', 'success', `Verification email sent to ${user.email}.`);
    if (typeof showToast === 'function')
      showToast('Verification email sent!', 'info', 'fa-envelope');
  } catch (e) {
    _showProfileMsg('profileInfoMsg', 'error', 'Could not send email. Please try again later.');
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
    if (typeEl)  typeEl.textContent    = 'All Cloud Data';
    if (titleEl) titleEl.textContent   = 'Delete all data?';
    if (descEl)  descEl.innerHTML      = 'Your <strong>entire projects and files</strong> will be permanently deleted from Firestore. Local data will remain.';
    if (inputWr) inputWr.style.display = 'block';
    if (inputEl) inputEl.placeholder   = 'Type DELETE to confirm';
  } else {
    if (typeEl)  typeEl.textContent    = 'Account Delete';
    if (titleEl) titleEl.textContent   = 'Delete account?';
    if (descEl)  descEl.innerHTML      = 'Your <strong>account and all data</strong> will be permanently deleted. This action <strong>cannot be undone</strong>.';
    if (inputWr) inputWr.style.display = 'block';
    if (inputEl) inputEl.placeholder   = 'Type DELETE to confirm';
  }

  if (inputEl) inputEl.value = '';
  _showProfileMsg('deleteConfirmMsg', '');
  if (typeof openModal === 'function') openModal('deleteConfirmModal');
};

// ── Execute Delete ──
window.executeDelete = async function () {
  const input = document.getElementById('deleteConfirmInput')?.value.trim();
  if (input !== 'DELETE') {
    return _showProfileMsg('deleteConfirmMsg', 'error', 'Type DELETE (uppercase) to confirm.');
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
        showToast('All Cloud data deleted', 'info', 'fa-trash');

    } else if (_deleteTarget === 'account') {
      await _deleteAllFirestoreData(user);
      await deleteUser(user);
      // Auth state change will redirect to login
      if (typeof showToast === 'function')
        showToast('Account deleted', 'info', 'fa-user-slash');
    }
  } catch (e) {
    const map = {
      'auth/requires-recent-login': 'Please log in again for security, then delete.',
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

  // 3. shared projects (present in collaboratorUids) — just remove this user
  //    from the collaborator list rather than deleting the whole project,
  //    since other people's data lives in it too.
  try {
    const sharedQuery = query(
      collection(db, 'projects'),
      where('collaboratorUids', 'array-contains', user.uid)
    );
    const sharedSnap = await getDocs(sharedQuery);
    sharedSnap.forEach(d => {
      const list = (d.data().collaboratorUids || []).filter(u => u !== user.uid);
      batch.update(d.ref, { collaboratorUids: list });
    });
  } catch (_) {
    // skip if the collaboratorUids field does not exist
  }

  // 4. release this user's username + lookup docs
  try {
    const userSnap = await getDoc(userRef);
    if (userSnap.exists()) {
      const data = userSnap.data();
      if (data.usernameLower) batch.delete(doc(db, 'usernames', data.usernameLower));
      if (data.emailLower)    batch.delete(doc(db, 'userEmails', data.emailLower));
    }
  } catch (_) {}
  batch.delete(doc(db, 'publicProfiles', user.uid));

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

// ── Avatar File Upload ──
window.handleAvatarUpload = function (input) {
  const file = input.files[0];
  if (!file) return;

  if (file.size > 2 * 1024 * 1024) {
    if (typeof showToast === 'function')
      showToast('Image cannot exceed 2MB.', 'error', 'fa-triangle-exclamation');
    return;
  }

  const statusEl = document.getElementById('avatarUploadStatus');
  const fillEl   = document.getElementById('avatarUploadFill');
  const textEl   = document.getElementById('avatarUploadText');

  if (statusEl) statusEl.style.display = 'flex';
  if (fillEl)   fillEl.style.width = '30%';
  if (textEl)   textEl.textContent = 'Reading…';

  const reader = new FileReader();
  reader.onload = (e) => {
    if (fillEl) fillEl.style.width = '70%';
    const base64 = e.target.result;

    // Preview
    const av = document.getElementById('profileAvatarBig');
    if (av) av.innerHTML = `<img src="${base64}" alt=""><div class="avatar-upload-overlay" onclick="document.getElementById('avatarFileInput').click()" title="Change photo"><i class="fa-solid fa-camera"></i></div>`;

    // Put it into the Photo URL input
    const photoInput = document.getElementById('profilePhotoInput');
    if (photoInput) photoInput.value = base64;

    if (fillEl) fillEl.style.width = '100%';
    if (textEl) textEl.textContent = 'Ready! Please save.';
    setTimeout(() => { if (statusEl) statusEl.style.display = 'none'; }, 2000);
  };
  reader.readAsDataURL(file);
};

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
