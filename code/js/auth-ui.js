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
  } else if (tab === 'reset') {
    document.getElementById('resetForm').classList.add('active');
    document.getElementById('authTabs').style.display = 'none';
    document.getElementById('resetNormal').style.display = '';
    document.getElementById('resetSent').classList.remove('show');
  }
  document.querySelectorAll('.auth-msg').forEach(m => m.classList.remove('show'));
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
  if (document.getElementById('registerForm').classList.contains('active')) window.doRegister?.();
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
