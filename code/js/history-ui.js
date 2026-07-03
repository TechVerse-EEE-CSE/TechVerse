// ══════════════════════════════════════
//  HISTORY UI — js/history-ui.js
//  Renders the "last updated" line under Cloud sync status,
//  and the full Update History modal (date + what changed).
//  The actual history data is written by firestore-sync.js
//  (kept as a capped array on the project doc — no extra Firestore write).
// ══════════════════════════════════════

window._historyData = [];

// ── Called by firestore-sync.js whenever the history array changes ──
window.renderHistoryUI = function (historyArr) {
  window._historyData = (historyArr || []).slice().reverse(); // newest first

  const line = document.getElementById('pmHistoryLine');
  if (line) {
    if (!window._historyData.length) {
      line.style.display = 'none';
      line.innerHTML = '';
    } else {
      const last = window._historyData[0];
      line.style.display = 'flex';
      line.innerHTML =
        `<i class="fa-solid fa-clock-rotate-left"></i>` +
        `<span>${_fmtDate(last.at)} — ${_escape(last.summary)}</span>`;
    }
  }

  const modal = document.getElementById('historyModal');
  if (modal && modal.classList.contains('active')) _renderHistoryList();
};

// ── Open / close the full history modal ──
window.openHistoryModal = function () {
  if (typeof closeProjectMenu === 'function') closeProjectMenu();
  const modal = document.getElementById('historyModal');
  if (!modal) return;
  modal.classList.add('active');
  _renderHistoryList();
};

window.closeHistoryModal = function () {
  const modal = document.getElementById('historyModal');
  if (modal) modal.classList.remove('active');
};

function _renderHistoryList() {
  const container = document.getElementById('historyList');
  if (!container) return;
  const list = window._historyData || [];

  if (!list.length) {
    container.innerHTML = `<div class="history-empty">এখনো কোনো আপডেট রেকর্ড হয়নি।</div>`;
    return;
  }

  container.innerHTML = list.map(entry => `
    <div class="history-item">
      <div class="history-item-top">
        <span class="history-date"><i class="fa-regular fa-clock"></i> ${_fmtDate(entry.at)}</span>
        <span class="history-by">${_escape(entry.byName || '')}</span>
      </div>
      <div class="history-summary">${_escape(entry.summary || '')}</div>
      ${_fileChips(entry)}
    </div>
  `).join('');
}

function _fileChips(entry) {
  const chips = [];
  (entry.added    || []).forEach(f => chips.push(`<span class="hf-chip hf-added"><i class="fa-solid fa-plus"></i> ${_escape(f)}</span>`));
  (entry.modified || []).forEach(f => chips.push(`<span class="hf-chip hf-modified"><i class="fa-solid fa-pen"></i> ${_escape(f)}</span>`));
  (entry.removed  || []).forEach(f => chips.push(`<span class="hf-chip hf-removed"><i class="fa-solid fa-minus"></i> ${_escape(f)}</span>`));
  if (!chips.length) return '';
  return `<div class="history-files">${chips.join('')}</div>`;
}

function _fmtDate(ms) {
  if (!ms) return '';
  try {
    return new Intl.DateTimeFormat('bn-BD', {
      day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
    }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toLocaleString();
  }
}

function _escape(str) {
  const d = document.createElement('div');
  d.textContent = str == null ? '' : String(str);
  return d.innerHTML;
}

window._historyUIReady = true;
