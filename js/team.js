// ══════════════════════════════════════
//  TEAM / ABOUT — js/team.js
//  Renders a premium flip-card into #teamGrid (About panel).
//  Front: photo, status, skills, animated stat counters.
//  Back: bio + social links.
//  Extras: animated gradient border (CSS), 3D mouse-tilt (JS),
//  count-up stats that (re)play each time the About panel opens.
// ══════════════════════════════════════

const TEAM_MEMBERS = [
  {
    name:      'Imran Ahmed',
    role:      'Developer',
    photo:     '/gallery/about.webp',
    available: true,
    bio:       'Developer of Tech Verse — a browser-based code editor built entirely from scratch. Passionate about crafting seamless experiences across the stack, from pixel-perfect frontends to Firebase-powered backends.',
    skills:    ['python', 'c++', 'JavaScript', 'HTML', 'Git', 'database'],
    stats: [
      { label: 'Projects',      value: 5,  suffix: '+' },
      { label: 'Yrs Experience', value: 1,   suffix: '+' },
      { label: 'Happy Users',   value: 50, suffix: '+' },
    ],
    links: [
      { icon: 'fa-brands fa-facebook',  label: 'Facebook',  url: 'https://facebook.com/imran.ahmedddddd' },
      { icon: 'fa-brands fa-github',    label: 'GitHub',    url: 'https://github.com/imranahmed-dev-tech' },
      { icon: 'fa-brands fa-instagram', label: 'Instagram', url: 'https://instagram.com/Imran.ahmedddddd' },
      { icon: 'fa-brands fa-whatsapp',  label: 'WhatsApp',  url: 'https://wa.me/8801957329211' },
      { icon: 'fa-solid fa-envelope',   label: 'Email',     url: 'mailto:imran.info.me@gmail.com' },
    ],
  },
];

function renderTeamGrid() {
  const grid = document.getElementById('teamGrid');
  if (!grid) return;

  grid.innerHTML = TEAM_MEMBERS.map((m, i) => `
    <div class="team-card" id="teamCard${i}" style="animation-delay:${i * 90}ms">
      <div class="team-card-tilt" id="teamTilt${i}">
        <div class="team-card-inner" onclick="flipTeamCard(${i})">

          <div class="team-face team-face-front">
            <div class="team-face-content">
              ${m.available ? `
                <div class="team-status"><span class="status-dot"></span>Available for work</div>
              ` : ''}

              <div class="team-photo-wrap">
                <img class="team-photo" src="${m.photo}" alt="${m.name}" loading="lazy"
                     onerror="this.onerror=null;this.src='favicon.png';">
              </div>

              <div class="team-name-row">
                <span class="team-name">${m.name}</span>
                <i class="fa-solid fa-circle-check team-verified" title="Verified Developer"></i>
              </div>
              <div class="team-role">${m.role}</div>

              <div class="team-skills">
                ${m.skills.map(s => `<span class="skill-chip">${s}</span>`).join('')}
              </div>

              <div class="team-stats">
                ${m.stats.map(s => `
                  <div class="stat-item">
                    <div class="stat-value" data-target="${s.value}" data-suffix="${s.suffix || ''}">0${s.suffix || ''}</div>
                    <div class="stat-label">${s.label}</div>
                  </div>
                `).join('')}
              </div>

              <div class="team-flip-hint"><i class="fa-solid fa-arrow-rotate-right"></i> Tap for details</div>
            </div>
            <div class="team-glare"></div>
          </div>

          <div class="team-face team-face-back">
            <div class="team-face-content">
              <div class="team-back-top">
                <img class="team-photo-mini" src="${m.photo}" alt="${m.name}"
                     onerror="this.onerror=null;this.src='favicon.png';">
                <div>
                  <div class="team-name-mini">${m.name} <i class="fa-solid fa-circle-check team-verified-mini" title="Verified Developer"></i></div>
                  <div class="team-role-mini">${m.role}</div>
                </div>
              </div>
              <p class="team-bio">${m.bio}</p>
              <div class="team-links">
                ${m.links.map(l => `
                  <a class="team-link-btn" href="${l.url}" target="_blank" rel="noopener"
                     onclick="event.stopPropagation()" title="${l.label}">
                    <i class="${l.icon}"></i>
                  </a>
                `).join('')}
              </div>
              <div class="team-flip-hint"><i class="fa-solid fa-arrow-rotate-left"></i> Tap to flip back</div>
            </div>
          </div>

        </div>
      </div>
    </div>
  `).join('');

  TEAM_MEMBERS.forEach((_, i) => initTilt(i));
}

// ── Flip ──
window.flipTeamCard = function (i) {
  document.getElementById(`teamCard${i}`)?.classList.toggle('flipped');
  // Reset any tilt offset so the flip animation isn't skewed
  const tilt = document.getElementById(`teamTilt${i}`);
  if (tilt) tilt.style.transform = '';
  // Light haptic tap on flip (mobile only — silently no-ops elsewhere)
  if (navigator.vibrate) navigator.vibrate(15);
};

// ── 3D mouse-tilt + cursor-following glare (front face only) ──
function initTilt(i) {
  const card = document.getElementById(`teamCard${i}`);
  const tilt = document.getElementById(`teamTilt${i}`);
  if (!card || !tilt) return;
  const MAX_TILT = 9;

  tilt.addEventListener('mousemove', (e) => {
    if (card.classList.contains('flipped')) return;
    const rect = tilt.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width;
    const py = (e.clientY - rect.top) / rect.height;
    const rx = (0.5 - py) * MAX_TILT * 2;
    const ry = (px - 0.5) * MAX_TILT * 2;
    tilt.style.transform = `rotateX(${rx}deg) rotateY(${ry}deg)`;

    const glare = card.querySelector('.team-face-front .team-glare');
    if (glare) glare.style.background =
      `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.16), transparent 60%)`;
  });

  tilt.addEventListener('mouseleave', () => {
    tilt.style.transform = 'rotateX(0deg) rotateY(0deg)';
    const glare = card.querySelector('.team-face-front .team-glare');
    if (glare) glare.style.background = 'transparent';
  });
}

// ── Animated count-up for the stat numbers ──
function animateStats(container) {
  container.querySelectorAll('.stat-value').forEach((el) => {
    const target = parseFloat(el.dataset.target);
    const suffix = el.dataset.suffix || '';
    if (isNaN(target)) return;
    const duration = 1100;
    const start = performance.now();
    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3); // ease-out-cubic
      el.textContent = Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
  });
}

// Replay the card entrance + stat count-up every time the About panel
// (#panel-appinfo) is opened, since it lives in a display:none sidebar
// panel and IntersectionObserver alone wouldn't catch that.
function watchAboutPanel() {
  const panel = document.getElementById('panel-appinfo');
  const grid  = document.getElementById('teamGrid');
  if (!panel || !grid) return;

  const trigger = () => {
    grid.classList.remove('in-view');
    // restart the CSS entrance animation
    grid.querySelectorAll('.team-card').forEach(c => {
      c.style.animation = 'none';
      requestAnimationFrame(() => { c.style.animation = ''; });
    });
    requestAnimationFrame(() => grid.classList.add('in-view'));
    animateStats(grid);
  };

  const observer = new MutationObserver(() => {
    if (panel.classList.contains('active')) trigger();
  });
  observer.observe(panel, { attributes: true, attributeFilter: ['class'] });

  if (panel.classList.contains('active')) trigger();
}

document.addEventListener('DOMContentLoaded', () => { renderTeamGrid(); watchAboutPanel(); });
// In case the About panel is opened before DOMContentLoaded fires (script loaded late)
if (document.readyState !== 'loading') { renderTeamGrid(); watchAboutPanel(); }
