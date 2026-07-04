// ══════════════════════════════════════════════════════
//  USERNAME.JS — js/username.js
//  Central place for everything related to usernames:
//   - format validation
//   - availability check
//   - reserving a username (new account / retrofit)
//   - changing a username
//   - resolving "email or username" → email (for login)
//   - resolving "email or username" → uid (for sharing/collaborators)
//
//  Firestore collections used (all documented in USERNAME-SETUP.md):
//   - usernames/{usernameLower}     { uid, username, email, createdAt }
//   - userEmails/{emailLower}       { uid }
//   - publicProfiles/{uid}          { username, displayName, photoURL, updatedAt }
//   - users/{uid}                   gets extra fields: username, usernameLower, email, emailLower
// ══════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, deleteDoc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "../config/firebase-config.js";

const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const db  = getFirestore(app);

// ── Normalizers ──
export function normalizeUsername(u) {
  return (u || '').trim().toLowerCase();
}
export function normalizeEmail(e) {
  return (e || '').trim().toLowerCase();
}

// ── Format validation: 3-20 chars, letters/numbers/underscore, must start with a letter ──
export function isValidUsername(u) {
  return /^[a-z][a-z0-9_]{2,19}$/.test(normalizeUsername(u));
}

export function usernameFormatHint() {
  return 'Username must be 3-20 characters, start with a letter, and can only contain letters, numbers, and underscore (_).';
}

// ── Best-effort availability check (final check always happens in the write transaction) ──
export async function isUsernameAvailable(username) {
  const lower = normalizeUsername(username);
  if (!isValidUsername(lower)) return false;
  const snap = await getDoc(doc(db, 'usernames', lower));
  return !snap.exists();
}

// ══════════════════════════════════════
//  Reserve a username for a NEW user (registration, or first-time retrofit)
//  Atomic — throws Error('username-taken') if it lost the race
// ══════════════════════════════════════
export async function reserveUsernameForNewUser(uid, username, email, displayName, photoURL) {
  const lower     = normalizeUsername(username);
  const emailLow  = normalizeEmail(email);

  try {
    await runTransaction(db, async (tx) => {
      const unameRef = doc(db, 'usernames', lower);
      const unameSnap = await tx.get(unameRef);
      if (unameSnap.exists()) throw new Error('username-taken');

      tx.set(unameRef, {
        uid, username, email: email || null, createdAt: serverTimestamp(),
      });

      tx.set(doc(db, 'users', uid), {
        username, usernameLower: lower,
        email: email || null, emailLower: emailLow || null,
      }, { merge: true });

      if (emailLow) {
        tx.set(doc(db, 'userEmails', emailLow), { uid }, { merge: true });
      }

      tx.set(doc(db, 'publicProfiles', uid), {
        username, displayName: displayName || username, photoURL: photoURL || null,
        updatedAt: serverTimestamp(),
      }, { merge: true });
    });
  } catch (e) {
    if (e.message !== 'username-taken') {
      console.error('reserveUsernameForNewUser transaction failed', { uid, lower, emailLow, code: e.code, message: e.message });
    }
    throw e;
  }
}

// ══════════════════════════════════════
//  Change username for an EXISTING user (from Profile settings)
// ══════════════════════════════════════
export async function changeUsername(uid, oldUsername, newUsername, email) {
  const newLower = normalizeUsername(newUsername);
  const oldLower = normalizeUsername(oldUsername || '');
  if (newLower === oldLower) return;

  await runTransaction(db, async (tx) => {
    const newRef  = doc(db, 'usernames', newLower);
    const newSnap = await tx.get(newRef);
    if (newSnap.exists()) throw new Error('username-taken');

    tx.set(newRef, { uid, username: newUsername, email: email || null, createdAt: serverTimestamp() });
    if (oldLower) tx.delete(doc(db, 'usernames', oldLower));

    tx.set(doc(db, 'users', uid), { username: newUsername, usernameLower: newLower }, { merge: true });
    tx.set(doc(db, 'publicProfiles', uid), { username: newUsername, updatedAt: serverTimestamp() }, { merge: true });
  });
}

// ══════════════════════════════════════
//  Resolve a login identifier (email OR username) → email
//  Needed because Firebase Auth's client SDK can only sign in with an email.
// ══════════════════════════════════════
export async function resolveLoginEmail(identifier) {
  const id = (identifier || '').trim();
  if (!id) return null;
  if (id.includes('@')) return id;

  const snap = await getDoc(doc(db, 'usernames', normalizeUsername(id)));
  if (!snap.exists()) return null;
  return snap.data().email || null;
}

// ══════════════════════════════════════
//  Resolve an identifier (email OR username) → uid
//  Used when adding a collaborator to a project.
// ══════════════════════════════════════
export async function resolveIdentifierToUid(identifier) {
  const id = (identifier || '').trim();
  if (!id) return null;

  if (id.includes('@')) {
    const snap = await getDoc(doc(db, 'userEmails', normalizeEmail(id)));
    return snap.exists() ? snap.data().uid : null;
  }
  const snap = await getDoc(doc(db, 'usernames', normalizeUsername(id)));
  return snap.exists() ? snap.data().uid : null;
}

// ══════════════════════════════════════
//  Fetch a public profile (for showing collaborator names/avatars)
// ══════════════════════════════════════
export async function getPublicProfile(uid) {
  const snap = await getDoc(doc(db, 'publicProfiles', uid));
  return snap.exists() ? snap.data() : null;
}

// ══════════════════════════════════════
//  Ensure a signed-in user has a username.
//  Covers: Google sign-in users, and pre-existing accounts created before
//  this feature existed. Auto-generates one from the email (user can
//  change it later from Profile settings) and never blocks the caller.
// ══════════════════════════════════════
export async function ensureUserHasUsername(user) {
  const userRef  = doc(db, 'users', user.uid);
  const userSnap = await getDoc(userRef);
  if (userSnap.exists() && userSnap.data().username) {
    return userSnap.data().username;
  }

  let base = normalizeUsername((user.email || 'user').split('@')[0]).replace(/[^a-z0-9_]/g, '');
  if (!/^[a-z]/.test(base)) base = 'u' + base;
  base = (base || 'user').slice(0, 15);

  for (let i = 0; i < 8; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(1000 + Math.random() * 9000)}`;
    try {
      await reserveUsernameForNewUser(user.uid, candidate, user.email, user.displayName, user.photoURL);
      return candidate;
    } catch (e) {
      if (e.message !== 'username-taken') { console.error('ensureUserHasUsername:', e); return null; }
      // collision — retry with a new random suffix
    }
  }
  return null;
}

window._usernameReady = true;
