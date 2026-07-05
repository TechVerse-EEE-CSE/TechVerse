// ══════════════════════════════════════
//  AUTH UI — js/auth-ui.js
//  UI logic for the Login/Register form
// ══════════════════════════════════════

// ── Tab Switch ──
window.switchAuthTab = function (tab) {
  const tabs  = document.querySelectorAll('.auth-tab');
  const forms = document.querySelectorAll('.auth-form');
  forms.forEach(f => f.classList.remove('active'));
  tabs.forEach(t => t.classList.remove('active'));

  if (tab === 'login') {
    document.getElementById('loginForm').classList.add('active');
    tabs[0].classList.add('active');
    document.getElementById('authTabs').style.display = 'flex';
  } else if (tab === 'register') {
    document.getElementById('registerForm').classList.add('active');
    tabs[1].classList.add('active');
    document.getElementById('authTabs').style.display = 'flex';
    window.goToRegisterStep(1); // always start the wizard fresh
  } else if (tab === 'reset') {
    document.getElementById('resetForm').classList.add('active');
    document.getElementById('authTabs').style.display = 'none';
    document.getElementById('resetNormal').style.display = '';
    document.getElementById('resetSent').classList.remove('show');
  }
  document.querySelectorAll('.auth-msg').forEach(m => m.classList.remove('show'));
};

// ══════════════════════════════════════
//  REGISTER WIZARD — step-by-step Create Account form
// ══════════════════════════════════════
let _registerStep = 1;
const REG_STEP_COUNT = 4;

function _regMsg(type, msg) {
  const el = document.getElementById('registerMsg');
  if (!el) return;
  const icon = type === 'error' ? 'fa-circle-exclamation'
             : type === 'success' ? 'fa-circle-check' : 'fa-circle-info';
  el.className = `auth-msg ${type} show`;
  el.innerHTML = `<i class="fa-solid ${icon}"></i> ${msg}`;
}

window.goToRegisterStep = function (step) {
  step = Math.min(Math.max(step, 1), REG_STEP_COUNT);
  _registerStep = step;

  document.querySelectorAll('.reg-step-panel').forEach(p => p.classList.remove('active'));
  const panel = document.getElementById('regStep' + step);
  if (panel) panel.classList.add('active');

  document.querySelectorAll('.reg-step-dot').forEach(dot => {
    const n = parseInt(dot.dataset.step, 10);
    dot.classList.toggle('active', n === step);
    dot.classList.toggle('done', n < step);
  });

  const msg = document.getElementById('registerMsg');
  if (msg) msg.classList.remove('show');

  // Scroll the freshly-shown step into view inside the (now scrollable) card
  panel?.scrollIntoView?.({ block: 'nearest' });
};

window.nextRegisterStep = function () {
  if (_registerStep === 1) {
    const name  = document.getElementById('registerName').value.trim();
    const email = document.getElementById('registerEmail').value.trim();
    if (!name)  return _regMsg('error', 'Please enter your name.');
    if (!email) return _regMsg('error', 'Please enter an email.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return _regMsg('error', 'Please enter a valid email address.');
  } else if (_registerStep === 2) {
    const username = document.getElementById('registerUsername').value.trim();
    if (!username) return _regMsg('error', 'Please choose a username.');
    if (!/^[a-z][a-z0-9_]{2,19}$/i.test(username))
      return _regMsg('error', 'Username must be 3-20 characters, start with a letter, and can only contain letters, numbers, and underscore (_).');
  } else if (_registerStep === 3) {
    const pass    = document.getElementById('registerPassword').value;
    const confirm = document.getElementById('registerConfirm').value;
    if (pass.length < 6)  return _regMsg('error', 'Password must be at least 6 characters.');
    if (pass !== confirm) return _regMsg('error', 'Passwords do not match.');
  }
  window.goToRegisterStep(_registerStep + 1);
};

window.prevRegisterStep = function () {
  window.goToRegisterStep(_registerStep - 1);
};

// ── Password Visibility Toggle ──
window.togglePw = function (inputId, btn) {
  const inp    = document.getElementById(inputId);
  const isText = inp.type === 'text';
  inp.type     = isText ? 'password' : 'text';
  btn.querySelector('i').className = isText ? 'fa-solid fa-eye' : 'fa-solid fa-eye-slash';
};

// ── Password Strength ──
window.checkPwStrength = function (val) {
  const fill = document.getElementById('pwStrengthFill');
  const text = document.getElementById('pwStrengthText');
  if (!val) { fill.style.width = '0%'; text.textContent = ''; return; }

  let score = 0;
  if (val.length >= 6)             score++;
  if (val.length >= 10)            score++;
  if (/[A-Z]/.test(val))           score++;
  if (/[0-9]/.test(val))           score++;
  if (/[^a-zA-Z0-9]/.test(val))   score++;

  const levels = [
    { w: '20%',  c: '#ef4444', t: 'Very Weak' },
    { w: '40%',  c: '#f97316', t: 'Weak' },
    { w: '60%',  c: '#eab308', t: 'Fair' },
    { w: '80%',  c: '#84cc16', t: 'Strong' },
    { w: '100%', c: '#10c98f', t: 'Very Strong' },
  ];
  const l = levels[Math.min(score, 4)];
  fill.style.width      = l.w;
  fill.style.background = l.c;
  text.textContent      = l.t;
  text.style.color      = l.c;
};

// ── User Dropdown ──
window.toggleUserDropdown = function () {
  document.getElementById('userDropdown').classList.toggle('show');
};

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('#userPill') && !e.target.closest('#userDropdown'))
    document.getElementById('userDropdown').classList.remove('show');
});

// ── Enter Key Submit ──
document.addEventListener('keydown', e => {
  if (e.key !== 'Enter') return;
  if (document.getElementById('authScreen').style.display === 'none') return;
  if (document.getElementById('loginForm').classList.contains('active'))    window.doLogin?.();
  if (document.getElementById('registerForm').classList.contains('active')) {
    // Enter advances the wizard step-by-step, only submitting on the final step
    if (_registerStep < REG_STEP_COUNT) window.nextRegisterStep?.();
    else window.doRegister?.();
  }
  if (document.getElementById('resetForm').classList.contains('active'))    window.doReset?.();
});

// ── Open Profile Modal ──
window.openProfileModal = function () {
  document.getElementById('userDropdown').classList.remove('show');
  const auth = window._firebaseAuth;
  if (!auth) return;
  const user = auth.currentUser;
  if (!user) return;

  const displayName = user.displayName || '';
  const email       = user.email || '';
  const photoURL    = user.photoURL || '';
  const initials    = displayName ? displayName.slice(0, 2).toUpperCase() : '?';

  const avEl = document.getElementById('profileAvatarBig');
  avEl.innerHTML = photoURL ? `<img src="${photoURL}" alt="">` : '';
  if (!photoURL) avEl.textContent = initials;

  document.getElementById('profileNameDisplay').textContent  = displayName || '—';
  document.getElementById('profileEmailDisplay').textContent = email;
  document.getElementById('profileNameInput').value          = displayName;
  document.getElementById('profilePhotoInput').value         = photoURL;

  const msg = document.getElementById('profileMsg');
  msg.className = 'auth-msg';
  msg.innerHTML = '';

  if (typeof openModal === 'function') openModal('profileModal');
};
