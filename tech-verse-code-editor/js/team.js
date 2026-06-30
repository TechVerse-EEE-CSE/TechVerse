/* ══════════════════════════════════════════════════════════════
   TEAM MEMBERS — এখানেই সব ডেটা এডিট করবে
   প্রতিটা মেম্বারের জন্য একটা অবজেক্ট যোগ করো নিচের অ্যারেতে।

   ফিল্ড গাইড:
   - name        : নাম
   - role        : পজিশন/রোল (যেমন "Founder & Lead Developer")
   - photo       : ছবির সরাসরি লিংক (URL)। ফাঁকা রাখলে আইকন দেখাবে।
   - responsibilities : দায়িত্বের লিস্ট (যত খুশি লাইন)
   - socials     : { platform: "url" } — platform নাম দেখে আইকন বসবে
                    সাপোর্টেড platform: facebook, github, linkedin,
                    instagram, twitter/x, youtube, whatsapp, telegram,
                    website, email
   ══════════════════════════════════════════════════════════════ */

const TEAM_MEMBERS = [
  {
    name: "Imran Hossain",
    role: "Founder & Lead Developer",
    photo: "",
    responsibilities: [
      "অ্যাপের সম্পূর্ণ আর্কিটেকচার ও কোডবেস ডিজাইন",
      "ব্যাকএন্ড ও ডাটাবেস ম্যানেজমেন্ট",
      "প্রজেক্ট রোডম্যাপ পরিচালনা"
    ],
    socials: {
      facebook: "",
      github: "",
      linkedin: "",
      email: "mailto:imran.info.me@gmail.com"
    }
  }
  // ── নতুন মেম্বার যোগ করতে নিচে কমা দিয়ে আরেকটা অবজেক্ট বসাও ──
  // {
  //   name: "নাম এখানে",
  //   role: "রোল এখানে",
  //   photo: "https://....jpg",
  //   responsibilities: ["দায়িত্ব ১", "দায়িত্ব ২"],
  //   socials: { facebook: "https://facebook.com/username", github: "https://github.com/username" }
  // },
];

/* ══════════════════════════════════════════════════════════════
   নিচের কোড — রেন্ডারিং লজিক (এখানে কিছু এডিট করার দরকার নেই)
   ══════════════════════════════════════════════════════════════ */

const TEAM_SOCIAL_ICONS = {
  facebook: "fa-brands fa-facebook-f",
  github: "fa-brands fa-github",
  linkedin: "fa-brands fa-linkedin-in",
  instagram: "fa-brands fa-instagram",
  twitter: "fa-brands fa-x-twitter",
  x: "fa-brands fa-x-twitter",
  youtube: "fa-brands fa-youtube",
  whatsapp: "fa-brands fa-whatsapp",
  telegram: "fa-brands fa-telegram",
  website: "fa-solid fa-globe",
  email: "fa-solid fa-envelope"
};

function teamEscapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function renderTeamGrid() {
  const grid = document.getElementById("teamGrid");
  if (!grid) return;

  if (!TEAM_MEMBERS.length) {
    grid.innerHTML = `<div class="team-grid-empty"><i class="fa-solid fa-user-group" style="font-size:18px;margin-bottom:6px;display:block;"></i>এখনো কোনো টিম মেম্বার যোগ করা হয়নি</div>`;
    return;
  }

  grid.innerHTML = TEAM_MEMBERS.map((m, i) => {
    const photoHtml = m.photo
      ? `<img class="team-card-photo" src="${teamEscapeHtml(m.photo)}" alt="${teamEscapeHtml(m.name)}" onerror="this.onerror=null;this.src='';this.style.display='none';this.insertAdjacentHTML('afterend','<div class=\\'team-card-photo\\' style=\\'display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--text-muted);\\'><i class=\\'fa-solid fa-user\\'></i></div>')">`
      : `<div class="team-card-photo" style="display:flex;align-items:center;justify-content:center;font-size:20px;color:var(--text-muted);"><i class="fa-solid fa-user"></i></div>`;

    return `
      <div class="team-card" onclick="openTeamModal(${i})">
        <div class="team-card-photo-wrap">${photoHtml}</div>
        <div class="team-card-name">${teamEscapeHtml(m.name)}</div>
        <div class="team-card-role">${teamEscapeHtml(m.role)}</div>
      </div>`;
  }).join("");
}

window.openTeamModal = function (index) {
  const m = TEAM_MEMBERS[index];
  if (!m) return;

  const modal = document.getElementById("teamModal");
  const photoEl = document.getElementById("teamModalPhoto");
  const nameEl = document.getElementById("teamModalName");
  const roleEl = document.getElementById("teamModalRole");
  const respEl = document.getElementById("teamModalResp");
  const socialsEl = document.getElementById("teamModalSocials");

  if (m.photo) {
    photoEl.src = m.photo;
    photoEl.style.display = "block";
    photoEl.onerror = function () {
      this.style.display = "none";
      photoEl.insertAdjacentHTML("afterend", `<div class="team-modal-photo" style="display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--text-muted);"><i class="fa-solid fa-user"></i></div>`);
    };
  } else {
    photoEl.style.display = "none";
    photoEl.insertAdjacentHTML("afterend", `<div class="team-modal-photo" style="display:flex;align-items:center;justify-content:center;font-size:30px;color:var(--text-muted);"><i class="fa-solid fa-user"></i></div>`);
  }

  nameEl.textContent = m.name || "";
  roleEl.textContent = m.role || "";

  const resp = m.responsibilities || [];
  respEl.innerHTML = resp.length
    ? resp.map(r => `<li>${teamEscapeHtml(r)}</li>`).join("")
    : `<li style="opacity:0.6;">দায়িত্ব উল্লেখ করা হয়নি</li>`;

  const socials = m.socials || {};
  const socialKeys = Object.keys(socials).filter(k => socials[k]);
  socialsEl.innerHTML = socialKeys.length
    ? socialKeys.map(platform => `
        <a class="team-social-btn" data-platform="${platform}" href="${teamEscapeHtml(socials[platform])}" target="_blank" rel="noopener noreferrer" title="${platform}">
          <i class="${TEAM_SOCIAL_ICONS[platform] || 'fa-solid fa-link'}"></i>
        </a>`).join("")
    : "";

  modal.classList.add("active");
};

window.closeTeamModal = function () {
  const modal = document.getElementById("teamModal");
  modal.classList.remove("active");
  const photoEl = document.getElementById("teamModalPhoto");
  let sib = photoEl.nextElementSibling;
  if (sib && sib !== photoEl) sib.remove();
  photoEl.style.display = "block";
};

document.addEventListener("DOMContentLoaded", renderTeamGrid);
if (document.readyState === "complete" || document.readyState === "interactive") {
  renderTeamGrid();
}
