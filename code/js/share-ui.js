// ══════════════════════════════════════
//  SHARE / PROJECT UI — js/share-ui.js
//  Load this after project-manager.js
// ══════════════════════════════════════

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    injectShareModal();
    injectProjectListModal();
    bindOpenButtons();
    window.handleJoinFromUrl?.();
  });

  // ── Inject the share modal HTML ──
  function injectShareModal() {
    const div = document.createElement('div');
    div.id = 'shareModal';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal-box">
        <h3><i class="fa-solid fa-user-group"></i> Share Project</h3>
        <p class="muted">Whoever you give this link to can log in and edit this project.</p>
        <div class="share-link-row">
          <input id="shareLinkInput" type="text" readonly placeholder="Generating link...">
          <button id="copyShareLinkBtn"><i class="fa-solid fa-copy"></i></button>
        </div>
        <div class="share-social-row">
          <button class="share-social-btn sb-whatsapp" data-share="whatsapp" title="WhatsApp"><i class="fa-brands fa-whatsapp"></i></button>
          <button class="share-social-btn sb-telegram" data-share="telegram" title="Telegram"><i class="fa-brands fa-telegram"></i></button>
          <button class="share-social-btn sb-messenger" data-share="messenger" title="Messenger"><i class="fa-brands fa-facebook-messenger"></i></button>
          <button class="share-social-btn sb-facebook" data-share="facebook" title="Facebook"><i class="fa-brands fa-facebook"></i></button>
          <button class="share-social-btn sb-instagram" data-share="instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></button>
          <button class="share-social-btn sb-more" data-share="more" title="More / System Share"><i class="fa-solid fa-share-nodes"></i></button>
        </div>
        <div id="collaboratorList" class="collaborator-list"></div>
        <button class="modal-close-btn" onclick="document.getElementById('shareModal').classList.add('hidden')">Close</button>
      </div>`;
    document.body.appendChild(div);

    document.getElementById('copyShareLinkBtn').onclick = () => {
      const input = document.getElementById('shareLinkInput');
      navigator.clipboard.writeText(input.value);
      showToast?.('Link copied', 'success', 'fa-copy');
    };

    bindSocialShareButtons(div);
  }

  // ── Bind click handlers to the social share buttons ──
  function bindSocialShareButtons(root) {
    root.querySelectorAll('.share-social-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const link = document.getElementById('shareLinkInput').value;
        if (!link) { showToast?.('Link not generated yet, please wait a moment', 'error'); return; }

        const projectName = (window.currentProjectName || 'My Project');
        const shareText = `${projectName} — edit code with me on this project:`;
        const encodedLink = encodeURIComponent(link);
        const encodedText = encodeURIComponent(shareText);
        const platform = btn.dataset.share;

        openShareTarget(platform, link, encodedLink, encodedText);
      });
    });
  }

  // ── Open the share link according to the platform ──
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
          // Deep-link to the Messenger app on mobile, falls back to Facebook if unavailable
          window.location.href = `fb-messenger://share?link=${encodedLink}`;
          setTimeout(() => {
            navigator.clipboard?.writeText(rawLink);
            window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodedLink}`, '_blank');
          }, 800);
        } else {
          navigator.clipboard?.writeText(rawLink);
          showToast?.('Link copied, paste it in Messenger', 'info', 'fa-facebook-messenger');
          window.open('https://www.messenger.com/', '_blank');
        }
        break;
      }
      case 'instagram': {
        // Instagram doesn't support direct link sharing, so the link is copied and the app is opened
        navigator.clipboard?.writeText(rawLink);
        showToast?.('Link copied, paste it in an Instagram DM/Story', 'info', 'fa-instagram');
        window.open(isMobile ? 'instagram://direct/inbox' : 'https://www.instagram.com/', '_blank');
        break;
      }
      case 'more': {
        if (navigator.share) {
          navigator.share({ title: 'Project Share', text: decodeURIComponent(encodedText), url: rawLink }).catch(() => {});
        } else {
          navigator.clipboard?.writeText(rawLink);
          showToast?.('Link copied', 'success', 'fa-copy');
        }
        break;
      }
    }
  }

  // ── "My Projects" list modal ──
  function injectProjectListModal() {
    const div = document.createElement('div');
    div.id = 'projectListModal';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal-box">
        <h3><i class="fa-solid fa-folder-open"></i> My Projects</h3>
        <div id="myProjectListBody" class="project-list-body">
          <p class="muted">Loading...</p>
        </div>
        <button class="modal-close-btn" onclick="document.getElementById('projectListModal').classList.add('hidden')">Close</button>
      </div>`;
    document.body.appendChild(div);
  }

  function bindOpenButtons() {
    document.getElementById('btnShareProject')?.addEventListener('click', openShareModal);
    document.getElementById('btnMyProjects')?.addEventListener('click', openProjectListModal);
  }

  // ── Open the share modal + generate the link ──
  window.openShareModal = async function () {
    const projectId = window.currentProjectId; // must be set in editor.js
    if (!projectId) { showToast?.('Please open or create a project first', 'error'); return; }

    document.getElementById('shareModal').classList.remove('hidden');
    const link = await window.createShareLink(projectId, 'editor');
    document.getElementById('shareLinkInput').value = link || '';
  };

  // ── Open the "My Projects" modal ──
  window.openProjectListModal = async function () {
    document.getElementById('projectListModal').classList.remove('hidden');
    const body = document.getElementById('myProjectListBody');
    body.innerHTML = `<p class="muted">Loading...</p>`;

    const projects = await window.listMyProjects();
    if (!projects.length) {
      body.innerHTML = `<p class="muted">No projects yet. Create a new one.</p>`;
      return;
    }

    body.innerHTML = projects.map(p => `
      <div class="project-row" onclick="window.openExistingProject('${p.id}')">
        <i class="fa-solid ${p.isOwner ? 'fa-crown' : 'fa-user-group'}"></i>
        <span class="project-row-name">${p.name}</span>
        ${p.collaboratorCount ? `<span class="badge-count">${p.collaboratorCount}</span>` : ''}
      </div>
    `).join('');
  };

  // ── Open a specific project (load + attach sync) ──
  window.openExistingProject = async function (projectId) {
    document.getElementById('projectListModal')?.classList.add('hidden');
    window.currentProjectId = projectId;

    const fs = await window.cloudLoadProject(projectId);
    if (fs) {
      await IDBStore.set('fs', fs);
      if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();
    }
    window.openProjectSync(projectId);
    showToast?.('Project opened', 'success', 'fa-folder-open');
  };
  // ── Create a new project (with a blank starter file) ──
  window.handleCreateNewProject = async function () {
    const name = prompt('Enter a project name:', 'New Project');
    if (!name) return;

    const starterFs = {
      'index.html': '<!DOCTYPE html>\n<html>\n<head>\n  <title>' + name + '</title>\n</head>\n<body>\n  \n</body>\n</html>'
    };

    showToast?.('Creating project...', 'info', 'fa-spinner');
    const projectId = await window.createProject(name, starterFs);
    if (!projectId) return;

    // ── Stop the previous project's sync and switch to the new one ──
    window.closeProjectSync?.();
    window.currentProjectId = projectId;

    await IDBStore.set('fs', starterFs);
    if (typeof reloadFsFromStorage === 'function') await reloadFsFromStorage();

    window.openProjectSync(projectId);
    showToast?.('New project created ✅', 'success', 'fa-folder-plus');
  };

})();
