// ══════════════════════════════════════
//  TEAM / ABOUT — js/team.js
//  Renders a flip-card into #teamGrid (About panel).
//  Front: profile photo + name + role. Tap → flips to show bio + links.
// ══════════════════════════════════════

const TEAM_MEMBERS = [
  {
    name:   'Imran Ahmed',
    role:   'Developer',
    photo:  '/gallery/imran3.webp',
    bio:    'Developer of Tech Verse — a browser-based code editor built entirely from scratch. Passionate about crafting seamless experiences across the stack, from pixel-perfect frontends to Firebase-powered backends.',
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
    <div class="team-card" id="teamCard${i}" onclick="flipTeamCard(${i})">
      <div class="team-card-inner">

        <div class="team-card-front">
          <div class="team-photo-wrap">
            <img class="team-photo" src="${m.photo}" alt="${m.name}" loading="lazy"
                 onerror="this.onerror=null;this.src='favicon.png';">
          </div>
          <div class="team-name">${m.name}</div>
          <div class="team-role">${m.role}</div>
          <div class="team-flip-hint"><i class="fa-solid fa-arrow-rotate-right"></i> Tap for details</div>
        </div>

        <div class="team-card-back">
          <div class="team-back-top">
            <img class="team-photo-mini" src="${m.photo}" alt="${m.name}"
                 onerror="this.onerror=null;this.src='favicon.png';">
            <div>
              <div class="team-name-mini">${m.name}</div>
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
  `).join('');
}

window.flipTeamCard = function (i) {
  document.getElementById(`teamCard${i}`)?.classList.toggle('flipped');
};

document.addEventListener('DOMContentLoaded', renderTeamGrid);
// In case the About panel is opened before DOMContentLoaded fires (script loaded late)
if (document.readyState !== 'loading') renderTeamGrid();
