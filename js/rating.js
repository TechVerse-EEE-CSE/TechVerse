// ══════════════════════════════════════════════════════
//  RATING.JS — Tech Verse "Rate Us" Page
//  Features:
//   ✅ 1–5 star interactive rating + optional written review
//   ✅ One rating per user (doc id = uid) — resubmitting = update
//   ✅ Live average, total count, and 5→1 star distribution bars
//   ✅ Live feed of everyone's reviews (most recent first)
//   ✅ Edit / delete your own rating anytime
//  js/rating.js — works as a window global
// ══════════════════════════════════════════════════════

import { initializeApp, getApps } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  onSnapshot,
  serverTimestamp,
  arrayUnion,
  arrayRemove,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import firebaseConfig from "../config/firebase-config.js";

// ── Init (reuse the app instance if one already exists) ──
const app  = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);

const RATING_WORDS = { 1: '🫩', 2: '😢', 3: '🙂', 4: '😊', 5: '🥰' };

let _selectedStars   = 0;   // the value the user has picked/hovered but not yet submitted
let _myExistingRating = null; // {rating, review} if this user already rated
let _allRatings       = [];   // live cache of every rating doc (for stats + feed)
let _unsubscribeFeed  = null;
let _submitting       = false;

// ══════════════════════════════════════
//  Open / Close
// ══════════════════════════════════════
window.openRatingModal = async function () {
  window.openModal('ratingModal');
  _resetInputUI();
  _attachLiveFeed();

  const user = auth.currentUser;
  if (!user) return; // editor is behind auth, shouldn't normally happen

  try {
    const snap = await getDoc(doc(db, 'ratings', user.uid));
    if (snap.exists()) {
      _myExistingRating = snap.data();
      _selectedStars = _myExistingRating.rating || 0;
      _paintStars(_selectedStars);
      document.getElementById('ratingReviewInput').value = _myExistingRating.review || '';
      updateRatingCharCount();
      document.getElementById('ratingSubmitLabel').textContent = 'update rating';
      document.getElementById('ratingDeleteBtn').style.display = 'inline-flex';
    } else {
      _myExistingRating = null;
      document.getElementById('ratingSubmitLabel').textContent = 'Submit a rating';
      document.getElementById('ratingDeleteBtn').style.display = 'none';
    }
  } catch (e) {
    console.error('openRatingModal:', e);
  }
};

window.closeRatingModal = function () {
  if (_unsubscribeFeed) { _unsubscribeFeed(); _unsubscribeFeed = null; }
  window.closeModal('ratingModal');
};

function _resetInputUI() {
  document.getElementById('ratingMsg').textContent = '';
  document.getElementById('ratingMsg').className = 'profile-msg';
  const btn = document.getElementById('ratingSubmitBtn');
  if (btn) { btn.disabled = false; btn.classList.remove('rating-btn-loading'); }
}

// ══════════════════════════════════════
//  Star input (hover + click)
// ══════════════════════════════════════
window.hoverRatingStars = function (n) {
  _paintStars(n);
  document.getElementById('ratingWordLabel').textContent = RATING_WORDS[n] || '';
};

window.setRatingStars = function (n) {
  _selectedStars = n;
  _paintStars(n);
  document.getElementById('ratingWordLabel').textContent = RATING_WORDS[n] || '';
};

document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('ratingStarsInput');
  if (!wrap) return;
  wrap.addEventListener('mouseleave', () => {
    _paintStars(_selectedStars);
    document.getElementById('ratingWordLabel').textContent = RATING_WORDS[_selectedStars] || '\u00A0';
  });
});

function _paintStars(n) {
  document.querySelectorAll('#ratingStarsInput .rstar').forEach(star => {
    const val = Number(star.dataset.val);
    star.classList.toggle('rstar-active', val <= n);
  });
}

window.updateRatingCharCount = function () {
  const el = document.getElementById('ratingReviewInput');
  const counter = document.getElementById('ratingCharCount');
  if (el && counter) counter.textContent = `${el.value.length}/400`;
};

// ══════════════════════════════════════
//  Submit / Update
// ══════════════════════════════════════
window.submitRating = async function () {
  if (_submitting) return;
  const user = auth.currentUser;
  if (!user) return;

  if (_selectedStars < 1) {
    _showRatingMsg('error', 'Please select at least 1 star.');
    return;
  }

  _submitting = true;
  const btn = document.getElementById('ratingSubmitBtn');
  const label = document.getElementById('ratingSubmitLabel');
  const prevLabel = label.textContent;
  btn.disabled = true;
  label.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

  try {
    const review = document.getElementById('ratingReviewInput').value.trim().slice(0, 400);
    const displayName = user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    const username = window._currentUsername || '';

    const payload = {
      uid: user.uid,
      displayName,
      username,
      photoURL: user.photoURL || null,
      rating: _selectedStars,
      review,
      updatedAt: serverTimestamp(),
    };
    if (!_myExistingRating) payload.createdAt = serverTimestamp();

    await setDoc(doc(db, 'ratings', user.uid), payload, { merge: true });

    _myExistingRating = { ...(_myExistingRating || {}), ...payload };
    document.getElementById('ratingDeleteBtn').style.display = 'inline-flex';
    label.textContent = 'update rating';
    _showRatingMsg('success', 'Thank you! Your rating has been saved.');
    if (typeof showToast === 'function') showToast('Rating submitted!', 'success', 'fa-star');
    _celebrateStars();
  } catch (e) {
    console.error('submitRating:', e);
    label.textContent = prevLabel;
    _showRatingMsg('error', 'Could not be saved, please try again.');
  } finally {
    btn.disabled = false;
    _submitting = false;
  }
};

window.deleteMyRating = async function () {
  const user = auth.currentUser;
  if (!user || !_myExistingRating) return;
  if (!confirm('Want to delete your rating?')) return;

  try {
    await deleteDoc(doc(db, 'ratings', user.uid));
    _myExistingRating = null;
    _selectedStars = 0;
    _paintStars(0);
    document.getElementById('ratingReviewInput').value = '';
    updateRatingCharCount();
    document.getElementById('ratingWordLabel').textContent = '\u00A0';
    document.getElementById('ratingDeleteBtn').style.display = 'none';
    document.getElementById('ratingSubmitLabel').textContent = 'Submit a rating';
    _showRatingMsg('info', 'Your rating has been deleted.');
    if (typeof showToast === 'function') showToast('Rating deleted.', 'info', 'fa-trash');
  } catch (e) {
    console.error('deleteMyRating:', e);
    _showRatingMsg('error', 'Could not be deleted, please try again');
  }
};

function _showRatingMsg(type, text) {
  const el = document.getElementById('ratingMsg');
  if (!el) return;
  el.textContent = text;
  el.className = `profile-msg show ${type}`;
}

// ══════════════════════════════════════
//  Live stats + review feed
// ══════════════════════════════════════
function _attachLiveFeed() {
  if (_unsubscribeFeed) return; // already listening
  _unsubscribeFeed = onSnapshot(collection(db, 'ratings'), snap => {
    _allRatings = snap.docs.map(d => d.data());
    _renderStats();
    _renderFeed();
  }, err => console.error('ratings feed:', err));
}

function _renderStats() {
  const total = _allRatings.length;
  const sum = _allRatings.reduce((s, r) => s + (r.rating || 0), 0);
  const avg = total ? sum / total : 0;

  document.getElementById('ratingAvgNum').textContent = avg.toFixed(1);
  document.getElementById('ratingAvgCount').textContent =
    total === 0 ? 'No ratings yet.' : `${total} rating`;

  const starsBox = document.getElementById('ratingAvgStars');
  starsBox.innerHTML = [1, 2, 3, 4, 5].map(i => {
    const filled = i <= Math.round(avg);
    return `<i class="fa-solid fa-star${filled ? '' : ' rstar-dim'}"></i>`;
  }).join('');

  const dist = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  _allRatings.forEach(r => { if (dist[r.rating] !== undefined) dist[r.rating]++; });

  const distBox = document.getElementById('ratingDistBars');
  distBox.innerHTML = [5, 4, 3, 2, 1].map(star => {
    const count = dist[star];
    const pct = total ? Math.round((count / total) * 100) : 0;
    return `
      <div class="rdist-row">
        <span class="rdist-label">${star}<i class="fa-solid fa-star"></i></span>
        <div class="rdist-track"><div class="rdist-fill" style="width:${pct}%"></div></div>
        <span class="rdist-count">${count}</span>
      </div>`;
  }).join('');
}

function _renderFeed() {
  const list = document.getElementById('ratingReviewsList');
  const empty = document.getElementById('ratingReviewsEmpty');
  if (!list) return;

  const myUid = auth.currentUser?.uid || null;

  const withReviews = _allRatings
    .filter(r => r.review && r.review.trim().length > 0)
    .sort((a, b) => (b.updatedAt?.seconds || 0) - (a.updatedAt?.seconds || 0))
    .slice(0, 30);

  if (withReviews.length === 0) {
    list.innerHTML = '';
    if (empty) empty.style.display = 'block';
    return;
  }
  if (empty) empty.style.display = 'none';

  list.innerHTML = withReviews.map(r => {
    const name = r.displayName || 'User';
    const initials = name.slice(0, 2).toUpperCase();
    const stars = [1, 2, 3, 4, 5].map(i =>
      `<i class="fa-solid fa-star${i <= r.rating ? '' : ' rstar-dim'}"></i>`).join('');
    const timeAgo = _relativeTime(r.updatedAt);
    const avatar = r.photoURL
      ? `<img src="${r.photoURL}" alt="">`
      : initials;

    const loveUids    = Array.isArray(r.loveUids) ? r.loveUids : [];
    const helpfulUids = Array.isArray(r.helpfulUids) ? r.helpfulUids : [];
    const iLoved      = myUid ? loveUids.includes(myUid) : false;
    const iFoundHelpful = myUid ? helpfulUids.includes(myUid) : false;
    const ratingUidJs = r.uid.replace(/'/g, "\\'");

    return `
      <div class="rreview-card">
        <div class="rreview-top">
          <div class="rreview-avatar">${avatar}</div>
          <div class="rreview-meta">
            <div class="rreview-name">${_escapeHtml(name)}</div>
            <div class="rreview-stars">${stars}</div>
          </div>
          <div class="rreview-time">${timeAgo}</div>
        </div>
        <div class="rreview-text">${_escapeHtml(r.review)}</div>
        <div class="rreview-actions">
          <button class="rreact-btn${iLoved ? ' active-love' : ''}" onclick="toggleLoveReaction('${ratingUidJs}')">
            <i class="fa-${iLoved ? 'solid' : 'regular'} fa-heart"></i>
            <span>${loveUids.length}</span>
          </button>
          <button class="rreact-btn${iFoundHelpful ? ' active-helpful' : ''}" onclick="toggleHelpfulReaction('${ratingUidJs}')">
            <i class="fa-${iFoundHelpful ? 'solid' : 'regular'} fa-thumbs-up"></i>
            <span>${helpfulUids.length ? `Helpful (${helpfulUids.length})` : 'Helpful'}</span>
          </button>
        </div>
      </div>`;
  }).join('');
}

// ══════════════════════════════════════
//  Review reactions — love / helpful (one toggle per user, per review)
// ══════════════════════════════════════
window.toggleLoveReaction = async function (ratingUid) {
  const user = auth.currentUser;
  if (!user) return;
  const r = _allRatings.find(x => x.uid === ratingUid);
  const already = !!(r && Array.isArray(r.loveUids) && r.loveUids.includes(user.uid));
  try {
    await updateDoc(doc(db, 'ratings', ratingUid), {
      loveUids: already ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  } catch (e) {
    console.error('toggleLoveReaction:', e);
    if (typeof showToast === 'function') showToast('There was a problem, please try again.', 'error', 'fa-triangle-exclamation');
  }
};

window.toggleHelpfulReaction = async function (ratingUid) {
  const user = auth.currentUser;
  if (!user) return;
  const r = _allRatings.find(x => x.uid === ratingUid);
  const already = !!(r && Array.isArray(r.helpfulUids) && r.helpfulUids.includes(user.uid));
  try {
    await updateDoc(doc(db, 'ratings', ratingUid), {
      helpfulUids: already ? arrayRemove(user.uid) : arrayUnion(user.uid),
    });
  } catch (e) {
    console.error('toggleHelpfulReaction:', e);
    if (typeof showToast === 'function') showToast('There was a problem, please try again.', 'error', 'fa-triangle-exclamation');
  }
};

function _relativeTime(ts) {
  if (!ts || !ts.seconds) return '';
  const diffMs = Date.now() - ts.seconds * 1000;
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins} minutes ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs} hours ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months} months ago`;
  return `${Math.floor(months / 12)} years ago`;
}

function _escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function _celebrateStars() {
  const wrap = document.getElementById('ratingStarsInput');
  if (!wrap) return;
  wrap.classList.add('rstars-pop');
  setTimeout(() => wrap.classList.remove('rstars-pop'), 500);
}
