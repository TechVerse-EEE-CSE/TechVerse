/* ══════════════════════════════════════════════════════════
   WHAT'S NEW POPUP — ENGINE
   No need to edit this file. Edit js/whatsnew-config.js instead.

   How it works:
   - auth.js dispatches a "tv:auth-ready" event on `document`
     right after a user successfully logs in, with the user's uid.
   - This file listens for that event and shows the popup once
     per user per version (tracked in localStorage, scoped to
     that user's uid so it never leaks between accounts on the
     same device).
   ══════════════════════════════════════════════════════════ */

(function () {
  var STORAGE_PREFIX = 'tv_whatsnew_seen::';

  function seenKey(uid, version) {
    return STORAGE_PREFIX + uid + '::' + version;
  }

  function hasSeen(uid, version) {
    try {
      return localStorage.getItem(seenKey(uid, version)) === '1';
    } catch (e) {
      return true; // if storage is unavailable, don't keep bugging the user
    }
  }

  function markSeen(uid, version) {
    try {
      localStorage.setItem(seenKey(uid, version), '1');
    } catch (e) { /* ignore */ }
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function buildPopup(cfg) {
    var overlay = document.createElement('div');
    overlay.id = 'wnOverlay';

    var itemsHtml = (cfg.updates || []).map(function (item) {
      return (
        '<div class="wn-item">' +
          '<div class="wn-item-icon"><i class="' + escapeHtml(item.icon || 'fa-solid fa-star') + '"></i></div>' +
          '<div class="wn-item-text">' +
            '<p class="wn-item-title">' + escapeHtml(item.title || '') + '</p>' +
            '<p class="wn-item-desc">' + escapeHtml(item.description || '') + '</p>' +
          '</div>' +
        '</div>'
      );
    }).join('');

    var footerNoteHtml = cfg.footerNote
      ? '<p class="wn-note">' + escapeHtml(cfg.footerNote) + '</p>'
      : '';

    overlay.innerHTML =
      '<div class="wn-card" role="dialog" aria-modal="true" aria-labelledby="wnTitle">' +
        '<div class="wn-glow"></div>' +
        '<div class="wn-header">' +
          '<button class="wn-close" id="wnCloseBtn" aria-label="Close">' +
            '<i class="fa-solid fa-xmark"></i>' +
          '</button>' +
          '<span class="wn-badge"><i class="fa-solid fa-sparkles"></i>' + escapeHtml(cfg.badge || "What's New") + '</span>' +
          '<h2 class="wn-title" id="wnTitle">' + escapeHtml(cfg.title || "What's new") + '</h2>' +
          '<p class="wn-subtitle">' + escapeHtml(cfg.subtitle || '') + '</p>' +
        '</div>' +
        '<div class="wn-list">' + itemsHtml + '</div>' +
        '<div class="wn-footer">' +
          '<button class="wn-cta" id="wnCtaBtn">' + escapeHtml(cfg.ctaText || 'Got it') + '</button>' +
          footerNoteHtml +
        '</div>' +
      '</div>';

    document.body.appendChild(overlay);

    // trigger the entrance transition
    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        overlay.classList.add('wn-show');
      });
    });

    function close() {
      overlay.classList.remove('wn-show');
      setTimeout(function () {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 280);
    }

    document.getElementById('wnCloseBtn').addEventListener('click', close);
    document.getElementById('wnCtaBtn').addEventListener('click', close);
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay) close();
    });
    document.addEventListener('keydown', function escHandler(e) {
      if (e.key === 'Escape') {
        close();
        document.removeEventListener('keydown', escHandler);
      }
    });
  }

  function maybeShow(uid) {
    var cfg = window.WHATSNEW_CONFIG || {};
    if (!cfg.ENABLED) return;
    if (!uid) return;
    var version = String(cfg.version || 'v1');
    if (hasSeen(uid, version)) return;

    // small delay so it appears after the editor UI has settled in,
    // instead of popping up mid-transition.
    setTimeout(function () {
      buildPopup(cfg);
      markSeen(uid, version);
    }, 500);
  }

  document.addEventListener('tv:auth-ready', function (e) {
    var uid = e && e.detail && e.detail.uid;
    maybeShow(uid);
  });
})();
