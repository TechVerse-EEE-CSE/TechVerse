// ══════════════════════════════════════
//  SHARE / PROJECT UI — js/share-ui.js
//  project-manager.js এর পরে লোড করুন
// ══════════════════════════════════════

(function () {
  document.addEventListener('DOMContentLoaded', () => {
    injectShareModal();
    injectProjectListModal();
    bindOpenButtons();
  });

  // ── শেয়ার / ইনভাইট মোডাল HTML ইনজেক্ট ──
  function injectShareModal() {
    const div = document.createElement('div');
    div.id = 'shareModal';
    div.className = 'modal-overlay hidden';
    div.innerHTML = `
      <div class="modal-box">
        <h3><i class="fa-solid fa-user-group"></i> প্রজেক্টে ইনভাইট করুন</h3>
        <p class="muted">ইউজারনেম বা ইমেইল দিয়ে সরাসরি ইনভাইট করুন — এডমিন বা এডিটর হিসেবে।</p>

        <div class="invite-row">
          <input id="inviteIdentifierInput" type="text" placeholder="ইউজারনেম বা ইমেইল" autocomplete="off">
          <select id="inviteRoleSelect">
            <option value="editor">এডিটর</option>
            <option value="admin">এডমিন</option>
          </select>
          <button id="inviteSendBtn" title="ইনভাইট করুন"><i class="fa-solid fa-paper-plane"></i></button>
        </div>

        <div id="collaboratorList" class="collaborator-list"></div>
        <button class="modal-close-btn" onclick="document.getElementById('shareModal').classList.add('hidden')">বন্ধ করুন</button>
      </div>`;
    document.body.appendChild(div);

    document.getElementById('inviteSendBtn').onclick = handleInviteClick;
    document.getElementById('inviteIdentifierInput').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') handleInviteClick();
    });
  }

  // ── ইনভাইট বাটনে ক্লিক ──
  async function handleInviteClick() {
    const projectId = window.currentProjectId;
    if (!projectId) { showToast?.('প্রথমে একটা প্রজেক্ট খুলুন বা তৈরি করুন', 'error'); return; }

    const input = document.getElementById('inviteIdentifierInput');
    const role  = document.getElementById('inviteRoleSelect').value;
    const identifier = input.value.trim();
    if (!identifier) { showToast?.('ইউজারনেম বা ইমেইল লিখুন', 'error'); return; }

    const btn = document.getElementById('inviteSendBtn');
    btn.disabled = true;
    const uid = await window.inviteUserToProject(projectId, identifier, role);
    btn.disabled = false;

    if (uid) {
      input.value = '';
      await refreshCollaboratorList(projectId);
    }
  }

  // ── কোলাবোরেটর লিস্ট রিফ্রেশ ও রেন্ডার ──
  async function refreshCollaboratorList(projectId) {
    const listEl = document.getElementById('collaboratorList');
    listEl.innerHTML = `<p class="muted" style="font-size:12px;">লোড হচ্ছে...</p>`;

    const collaborators = await window.getProjectCollaborators(projectId);
    if (!collaborators.length) {
      listEl.innerHTML = `<p class="muted" style="font-size:12px;">এখনো কোনো কোলাবোরেটর নেই।</p>`;
      return;
    }

    listEl.innerHTML = collaborators.map(c => `
      <div class="collaborator-row" data-uid="${c.uid}">
        <div class="collab-info">
          <i class="fa-solid fa-user"></i>
          <span class="collab-name">${c.username ? '@' + c.username : (c.email || c.uid.slice(0, 8))}</span>
        </div>
        <select class="collab-role-select" onchange="window.updateCollaboratorRole('${projectId}','${c.uid}', this.value)">
          <option value="editor" ${c.role === 'editor' ? 'selected' : ''}>এডিটর</option>
          <option value="admin" ${c.role === 'admin' ? 'selected' : ''}>এডমিন</option>
        </select>
        <button class="collab-remove-btn" title="রিমুভ করুন" onclick="window.removeCollaboratorAndRefresh('${projectId}','${c.uid}')">
          <i class="fa-solid fa-user-minus"></i>
        </button>
      </div>
    `).join('');
  }

  // ── কোলাবোরেটর রিমুভ + লিস্ট রিফ্রেশ (গ্লোবালি এক্সপোজ করা, onclick থেকে ব্যবহারের জন্য) ──
  window.removeCollaboratorAndRefresh = async function (projectId, uid) {
    await window.removeCollaborator(projectId, uid);
    await refreshCollaboratorList(projectId);
  };

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

  // ── শেয়ার/ইনভাইট মোডাল খোলা ──
  window.openShareModal = async function () {
    const projectId = window.currentProjectId; // editor.js এ সেট থাকতে হবে
    if (!projectId) { showToast?.('প্রথমে একটা প্রজেক্ট খুলুন বা তৈরি করুন', 'error'); return; }

    document.getElementById('shareModal').classList.remove('hidden');
    document.getElementById('inviteIdentifierInput').value = '';
    document.getElementById('inviteRoleSelect').value = 'editor';
    await refreshCollaboratorList(projectId);
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
