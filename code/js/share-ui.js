// ══════════════════════════════════════
//  SHARE / PROJECT UI — js/share-ui.js
//  project-manager.js এর পরে লোড করুন
// ══════════════════════════════════════

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    injectShareModal();
    injectProjectListModal();
    bindOpenButtons();
    window.handleJoinFromUrl?.();
  });

  // ── শেয়ার মোডাল HTML ইনজেক্ট ──
  function injectShareModal() {
    const div = document.createElement('div');
    div.id = 'shareModal';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal-box">
        <h3><i class="fa-solid fa-user-group"></i> প্রজেক্ট শেয়ার করুন</h3>
        <p class="muted">যাকে এই লিংক দেবেন, সে লগইন করে এই প্রজেক্টে এডিট করতে পারবে।</p>
        <div class="share-link-row">
          <input id="shareLinkInput" type="text" readonly placeholder="লিংক তৈরি হচ্ছে...">
          <button id="copyShareLinkBtn"><i class="fa-solid fa-copy"></i></button>
        </div>
        <div class="share-social-row">
          <button class="share-social-btn sb-whatsapp" data-share="whatsapp" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
          <button class="share-social-btn sb-telegram" data-share="telegram" title="Telegram"><i class="fa-brands fa-telegram"></i></button>
          <button class="share-social-btn sb-messenger" data-share="messenger" title="Messenger"><i class="fa-brands fa-facebook-messenger"></i></button>
          <button class="share-social-btn sb-facebook" data-share="facebook" title="Facebook"><i class="fa-brands fa-facebook"></i></button>
          <button class="share-social-btn sb-instagram" data-share="instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></button>
          <button class="share-social-btn sb-more" data-share="more" title="আরও / সিস্টেম শেয়ার"><i class="fa-solid fa-share-nodes"></i></button>
        </div>
        <div id="collaboratorList" class="collaborator-list"></div>
        <button class="modal-close-btn" onclick="document.getElementById('shareModal').classList.add('hidden')">বন্ধ করুন</button>
      </div>`;
    document.body.appendChild(div);

    document.getElementById('copyShareLinkBtn').onclick = () => {
      const input = document.getElementById('shareLinkInput');
      navigator.clipboard.writeText(input.value);
      showToast?.('লিংক কপি হয়েছে', 'success', 'fa-copy');
    };

    bindSocialShareButtons(div);
  }

  // ── সোশ্যাল শেয়ার বাটনগুলোতে ক্লিক হ্যান্ডলার বাইন্ড করা ──
  function bindSocialShareButtons(root) {
    root.querySelectorAll('.share-social-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const link = document.getElementById('shareLinkInput').value;
        if (!link) { showToast?.('লিংক এখনো তৈরি হয়নি, একটু অপেক্ষা করুন', 'error'); return; }

        const projectName = (window.currentProjectName || 'আমার প্রজেক্ট');
        const shareText = `${projectName} — এই প্রজেক্টে আমার সাথে কোড এডিট করুন:`;
        const encodedLink = encodeURIComponent(link);
        const encodedText = encodeURIComponent(shareText);
        const platform = btn.dataset.share;

        openShareTarget(platform, link, encodedLink, encodedText);
      });
    });
  }

  // ── প্ল্যাটফর্ম অনুযায়ী শেয়ার লিংক ওপেন করা ──
  function openShareTarget(platform, rawLink, encodedLink, encodedText) {
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

    switch (platform) {
      case 'whatsapp': {
        const url = isMobile
          ? `whatsapp://send?text=${encodedText}%20${encodedLink}`
          : `https://web.whatsapp.com/send?text=${encodedText}%20${encodedLink}`;
        window.open(url, '_blank');
        break;
      }
      case 'telegram': {
        window.open(`https://t.me/share/url?url=${encodedLink}&text=${encodedText}`, '_blank');
        break;
      }
      case 'facebook': {
        window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, '_blank', 'width=600,height=500');
        break;
      }
      case 'messenger': {
        if (isMobile) {
          // মোবাইলে Messenger অ্যাপ ডিপ-লিংক, না থাকলে ফেসবুকে পাঠানো হবে
          window.location.href = `fb-messenger://share?link=${encodedLink}`;
          setTimeout(() => {
            navigator.clipboard?.writeText(rawLink);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, '_blank');
          }, 800);
        } else {
          navigator.clipboard?.writeText(rawLink);
          showToast?.('লিংক কপি হয়েছে, Messenger-এ পেস্ট করুন', 'info', 'fa-facebook-messenger');
          window.open('https://www.messenger.com/', '_blank');
        }
        break;
      }
      case 'instagram': {
        // ইনস্টাগ্রাম সরাসরি লিংক শেয়ার সাপোর্ট করে না, তাই লিংক কপি করে অ্যাপ খুলে দেওয়া হয়
        navigator.clipboard?.writeText(rawLink);
        showToast?.('লিংক কপি হয়েছে, Instagram DM/Story-তে পেস্ট করুন', 'info', 'fa-instagram');
        window.open(isMobile ? 'instagram://direct/inbox' : 'https://www.instagram.com/', '_blank');
        break;
      }
      case 'more': {
        if (navigator.share) {
          navigator.share({ title: 'প্রজেক্ট শেয়ার', text: decodeURIComponent(encodedText), url: rawLink }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(rawLink);
          showToast?.('লিংক কপি হয়েছে', 'success', 'fa-copy');
        }
        break;
      }
    }
  }

  // ── "আমার প্রজেক্ট" লিস্ট মোডাল ──
  function injectProjectListModal() {
    const div = document.createElement('div');
    div.id = 'projectListModal';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal-box">
        <h3><i class="fa-solid fa-folder-open"></i> আমার প্রজেক্টসমূহ</h3>
        <div id="myProjectListBody" class="project-list-body">
          <p class="muted">লোড হচ্ছে...</p>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('projectListModal').classList.add('hidden')">বন্ধ করুন</button>
      </div>`;
    document.body.appendChild(div);
  }

  function bindOpenButtons() {
    document.getElementById('btnShareProject')?.addEventListener('click', openShareModal);
    document.getElementById('btnMyProjects')?.addEventListener('click', openProjectListModal);
  }

  // ── শেয়ার মোডাল খোলা + লিংক জেনারেট ──
  window.openShareModal = async function () {
    const projectId = window.currentProjectId; // editor.js এ সেট থাকতে হবে
    if (!projectId) { showToast?.('প্রথমে একটা প্রজেক্ট খুলুন বা তৈরি করুন', 'error'); return; }

    document.getElementById('shareModal').classList.remove('hidden');
    const link = await window.createShareLink(projectId, 'editor');
    document.getElementById('shareLinkInput').value = link || '';
  };

  // ── "আমার প্রজেক্ট" মোডাল খোলা ──
  window.openProjectListModal = async function () {
    document.getElementById('projectListModal').classList.remove('hidden');
    const body = document.getElementById('myProjectListBody');
    body.innerHTML = `<p class="muted">লোড হচ্ছে...</p>`;

    const projects = await window.listMyProjects();
    if (!projects.length) {
      body.innerHTML = `<p class="muted">কোনো প্রজেক্ট নেই। নতুন তৈরি করুন।</p>`;
      return;
    }

    body.innerHTML = projects.map(p => `
      <div class="project-row" onclick="window.openExistingProject('${p.id}')">
        <i class="fa-solid ${p.isOwner ? 'fa-crown' : 'fa-user-group'}"></i>
        <span class="project-row-name">${p.name}</span>
        ${p.collaboratorCount ? `<span class="badge-count">${p.collaboratorCount} জন</span>` : ''}
      </div>
    `).join('');
  };

  // ── নির্দিষ্ট প্রজেক্ট ওপেন করা (লোড + sync attach) ──
  window.openExistingProject = async function (projectId) {
    document.getElementById('projectListModal')?.classList.add('hidden');
    window.currentProjectId = projectId;

    const fs = await window.cloudLoadProject(projectId);
    if (fs) {
      await IDBStore.set('fs', fs);
      if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
    }
    window.openProjectSync(projectId);
    showToast?.('প্রজেক্ট ওপেন হয়েছে', 'success', 'fa-folder-open');
  };
  // ── নতুন প্রজেক্ট তৈরি (ব্ল্যাঙ্ক স্টার্টার ফাইল সহ) ──
  window.handleCreateNewProject = async function () {
    const name = prompt('প্রজেক্টের নাম দিন:', 'নতুন প্রজেক্ট');
    if (!name) return;

    const starterFs = {
      'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>' + name + '</title>\n</head>\n<body>\n  \n</body>\n</html>'
    };

    showToast?.('প্রজেক্ট তৈরি হচ্ছে...', 'info', 'fa-spinner');
    const projectId = await window.createProject(name, starterFs);
    if (!projectId) return;

    // ── আগের প্রজেক্টের sync বন্ধ করে নতুনটাতে সুইচ করো ──
    window.closeProjectSync?.();
    window.currentProjectId = projectId;

    await IDBStore.set('fs', starterFs);
    if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();

    window.openProjectSync(projectId);
    showToast?.('নতুন প্রজেক্ট তৈরি হয়েছে ✅', 'success', 'fa-folder-plus');
  };

})();
