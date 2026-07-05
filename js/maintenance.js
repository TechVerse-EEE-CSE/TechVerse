/* ══════════════════════════════════════════════════════════
   MAINTENANCE MODE — ENGINE
   এই ফাইলে হাত দেওয়ার দরকার নেই।
   অন/অফ করতে হলে js/maintenance-config.js ফাইল দেখুন।
   ══════════════════════════════════════════════════════════ */

(function () {
  var cfg = window.MAINTENANCE_CONFIG || {};

  if (!cfg.MAINTENANCE_MODE) return; // সাইট স্বাভাবিকভাবে চলবে

  // পুরো পেজ লোড হওয়ার আগেই বাকি কন্টেন্ট লুকিয়ে ফেলি যাতে flash না করে
  var styleGuard = document.createElement('style');
  styleGuard.id = 'mtGuardStyle';
  styleGuard.textContent = 'body > *:not(#maintenanceOverlay):not(script):not(style){display:none !important;} body{overflow:auto !important; height:auto !important;}';
  document.documentElement.appendChild(styleGuard);

  function buildOverlay() {
    var hasEta = !!cfg.eta;
    var overlay = document.createElement('div');
    overlay.id = 'maintenanceOverlay';

    var contactHtml = cfg.contactEmail
      ? '<div class="mt-contact">emergency contact: <a href="mailto:' + cfg.contactEmail + '">' + cfg.contactEmail + '</a></div>'
      : '';

    overlay.innerHTML =
      '<div class="mt-glow mt-glow-1"></div>' +
      '<div class="mt-glow mt-glow-2"></div>' +
      '<div class="mt-card">' +
        '<div class="mt-icon-wrap">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' +
            '<path d="M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z"/>' +
          '</svg>' +
        '</div>' +
        '<div class="mt-site-name">' + escapeHtml(cfg.siteName || 'Website') + '</div>' +
        '<div class="mt-title">' + escapeHtml(cfg.title || 'The site is under maintenance') + '</div>' +
        '<div class="mt-message">' + escapeHtml(cfg.message || '') + '</div>' +
        (hasEta ? '<div class="mt-countdown" id="mtCountdown"></div>' : '') +
        '<div class="mt-status-row"><span class="mt-status-dot"></span><span id="mtStatusText"> We are working on it — please wait.</span></div>' +
        '<div class="mt-progress-track"><div class="mt-progress-fill"></div></div>' +
        '<div class="mt-actions">' +
          '<button class="mt-btn mt-primary" id="mtRetryBtn">Try again</button>' +
        '</div>' +
        contactHtml +
      '</div>';

    document.body.appendChild(overlay);

    document.getElementById('mtRetryBtn').addEventListener('click', function () {
      checkStatusNow(true);
    });

    if (hasEta) startCountdown(cfg.eta);
  }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  function startCountdown(etaStr) {
    var target = new Date(etaStr).getTime();
    if (isNaN(target)) return;
    var el = document.getElementById('mtCountdown');
    if (!el) return;

    function render() {
      var now = Date.now();
      var diff = target - now;
      if (diff <= 0) {
        el.innerHTML = '<div class="mt-countdown-box"><div class="mt-countdown-num">soon</div><div class="mt-countdown-label">coming back</div></div>';
        checkStatusNow(false);
        return;
      }
      var d = Math.floor(diff / (1000 * 60 * 60 * 24));
      var h = Math.floor((diff / (1000 * 60 * 60)) % 24);
      var m = Math.floor((diff / (1000 * 60)) % 60);
      var s = Math.floor((diff / 1000) % 60);

      el.innerHTML =
        box(d, 'day') + box(h, 'hour') + box(m, 'min') + box(s, 'sec');
    }

    function box(val, label) {
      return '<div class="mt-countdown-box"><div class="mt-countdown-num">' + String(val).padStart(2, '0') + '</div><div class="mt-countdown-label">' + label + '</div></div>';
    }

    render();
    setInterval(render, 1000);
  }

  // ব্যাকগ্রাউন্ডে সময় সময় চেক করে দেখে সাইট চালু হয়ে গেছে কিনা (কনফিগ ফাইল আবার fetch করে)
  var checking = false;
  function checkStatusNow(manual) {
    if (checking) return;
    checking = true;
    var statusEl = document.getElementById('mtStatusText');
    if (manual && statusEl) statusEl.textContent = 'চেক করা হচ্ছে...';

    var url = 'js/maintenance-config.js?_=' + Date.now();
    fetch(url, { cache: 'no-store' })
      .then(function (res) { return res.text(); })
      .then(function (text) {
        var stillOn = /MAINTENANCE_MODE\s*:\s*true/.test(text);
        if (!stillOn) {
          if (statusEl) statusEl.textContent = 'Site is up and running! Page is reloading...';
          setTimeout(function () { location.reload(); }, 800);
        } else if (manual && statusEl) {
          statusEl.textContent = 'Still in progress — please wait.';
        }
      })
      .catch(function () {
        if (manual && statusEl) statusEl.textContent = ' Sorry, try again later.';
      })
      .finally(function () {
        checking = false;
      });
  }

  function init() {
    buildOverlay();
    var seconds = Number(cfg.autoCheckSeconds) || 0;
    if (seconds > 0) {
      setInterval(function () { checkStatusNow(false); }, seconds * 1000);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();