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
        <div id="collaboratorList" class="collaborator-list"></div>
        <button class="modal-close-btn" onclick="document.getElementById('shareModal').classList.add('hidden')">বন্ধ করুন</button>
      </div>`;
    document.body.appendChild(div);

    document.getElementById('copyShareLinkBtn').onclick = () => {
      const input = document.getElementById('shareLinkInput');
      navigator.clipboard.writeText(input.value);
      showToast?.('লিংক কপি হয়েছে', 'success', 'fa-copy');
    };
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
})();
