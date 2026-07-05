// ══════════════════════════════════════
//  EDITOR CORE — js/editor.js
//  CodeMirror editor and file management
// ══════════════════════════════════════

const STORAGE_KEY  = 'tv_promax_v3';
const SETTINGS_KEY = 'tv_promax_settings_v3';

// ── Default Project Files ──
const DEFAULT_FS = {
  'index.html': `<!DOCTYPE html>\n<html lang="en">\n<head>\n    <meta charset="UTF-8">\n    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n    <title>My Project</title>\n    <link rel="stylesheet" href="css/style.css">\n</head>\n<body>\n\n    <h1>my project</h1>\n    <p>this is amazing website Tech Verse Web.</p>\n\n    <script src="js/app.js"><\/script>\n</body>\n</html>`,
  'css/style.css': `/* ── Styles ── */\nbody {\n    margin: 0;\n    font-family: 'Segoe UI', sans-serif;\n    background: #0f172a;\n    color: #e2e8f0;\n    min-height: 100vh;\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    flex-direction: column;\n    gap: 12px;\n}\n\nh1 { color: #5b8dee; }\np { color: #94a3b8; }`,
  'js/app.js': `// ── App Logic ──\nconsole.log('TechVerse Editor - Ready!');\n\ndocument.addEventListener('DOMContentLoaded', () => {\n    console.log('DOM loaded.');\n});`
};

// ── State ──
// fs/cfg here are just placeholders — actual data is loaded asynchronously from IndexedDB in initEditorIfNeeded()
let fs               = JSON.parse(JSON.stringify(DEFAULT_FS));
let cfg              = {};
const defaults      = {
  theme: 'material-ocean', font: 'Fira Code', fontSize: 15, lineHeight: 1.7,
  lineNumbers: true, wordWrap: true, autoClose: true, autoSave: true,
  matchBrackets: true, tabSize: 4
};
cfg = Object.assign({}, defaults, cfg);

let currentFile      = 'index.html';
let openTabs         = ['index.html'];
let ctxTarget        = null;
let renamingFile     = null;
let autoSaveTimer    = null;
let searchCursor     = null;
let editor;
let editorInitialized = false;
let collapsedFolders  = new Set();

// ── Live Preview State ──
let previewOpen        = false;   // preview overlay currently visible?
let previewTargetFile  = null;    // which .html file the live preview is tracking
let previewDebounceT   = null;    // debounce handle for live rebuilds
const PREVIEW_DEBOUNCE_MS = 350;  // typing pause before the preview refreshes

// ── Themes & Fonts ──
const THEMES = [
  { id: 'material-ocean', name: 'Material Ocean', dots: ['#0f111a','#c792ea','#89ddff'] },
  { id: 'dracula',        name: 'Dracula',         dots: ['#282a36','#ff79c6','#50fa7b'] },
  { id: 'monokai',        name: 'Monokai',         dots: ['#272822','#f92672','#a6e22e'] },
  { id: 'nord',           name: 'Nord',            dots: ['#2e3440','#81a1c1','#88c0d0'] },
  { id: 'solarized dark', name: 'Solarized',       dots: ['#002b36','#268bd2','#859900'] },
  { id: 'night',          name: 'Night',           dots: ['#0a0e14','#5ccfe6','#bae67e'] },
];
const FONTS = ['Fira Code', 'JetBrains Mono', 'Consolas', 'monospace'];

const SHORTCUTS = [
  { key: 'Ctrl+S',     desc: 'Save file' },
  { key: 'Ctrl+Enter', desc: 'Run / Preview' },
  { key: 'Ctrl+B',     desc: 'Sidebar toggle' },
  { key: 'Ctrl+F',     desc: 'Find in file' },
  { key: 'Ctrl+Z',     desc: 'Undo' },
  { key: 'Ctrl+Y',     desc: 'Redo' },
  { key: 'Ctrl+A',     desc: 'Select all' },
  { key: 'Tab',        desc: 'Indent' },
];

// ── Init ──
window.initEditorIfNeeded = async function () {
  if (editorInitialized) return;
  editorInitialized = true;

  // ── One-time migration of existing users' localStorage data into IndexedDB ──
  await IDBStore.migrateFromLocalStorage({
    [STORAGE_KEY]:            'fs',
    [SETTINGS_KEY]:           'settings',
    'tv_promax_localtime':    'localtime',
    'tv_promax_cloudtime':    'cloudtime',
  });

  // ── Load the actual data from IndexedDB ──
  const storedFs  = await IDBStore.get('fs');
  const storedCfg = await IDBStore.get('settings');
  fs  = storedFs  || JSON.parse(JSON.stringify(DEFAULT_FS));
  cfg = Object.assign({}, defaults, storedCfg || {});

  editor = CodeMirror.fromTextArea(document.getElementById('code-editor'), {
    mode:             'xml',
    theme:            cfg.theme,
    lineNumbers:      cfg.lineNumbers,
    autoCloseTags:    cfg.autoClose,
    autoCloseBrackets: true,
    matchBrackets:    cfg.matchBrackets,
    indentUnit:       cfg.tabSize,
    tabSize:          cfg.tabSize,
    lineWrapping:     cfg.wordWrap,
    extraKeys: {
      'Ctrl-S':     () => saveData(true),
      'Ctrl-Enter': runCode,
      'Ctrl-B':     toggleSidebar,
      'Ctrl-F':     toggleSearch,
    }
  });

  applyFontStyle();
  buildThemeGrid();
  buildFontBtns();
  buildShortcutList();
  applySettingsUI();
  setupQuickKeys();

  editor.on('change', onEditorChange);
  editor.on('cursorActivity', updateStatusbar);

  document.getElementById('editorLoading').style.display = 'none';

  openFile(currentFile);
  renderTabs();
  renderFileTree();

  document.addEventListener('keydown', handleGlobalKey);
};

// ── File Helpers ──
function getFileIcon(name) {
  if (name.endsWith('.html')) return '<i class="fa-brands fa-html5" style="color:#e34f26"></i>';
  if (name.endsWith('.css'))  return '<i class="fa-brands fa-css3-alt" style="color:#264de4"></i>';
  if (name.endsWith('.js'))   return '<i class="fa-brands fa-js" style="color:#f7df1e"></i>';
  return '<i class="fa-regular fa-file-code" style="color:#8b92a5"></i>';
}

function getMode(path) {
  if (path.endsWith('.css')) return 'css';
  if (path.endsWith('.js'))  return 'javascript';
  return 'xml';
}

function getLangName(path) {
  if (path.endsWith('.css'))  return 'CSS';
  if (path.endsWith('.js'))   return 'JavaScript';
  if (path.endsWith('.html')) return 'HTML';
  return 'Text';
}

// ── Open File ──
window.openFile = function (path) {
  if (!fs[path] && fs[path] !== '') return;
  if (currentFile !== path) fs[currentFile] = editor.getValue();
  currentFile = path;
  schedulePreviewRefresh();
  editor.setValue(fs[path] || '');
  editor.setOption('mode', getMode(path));
  editor.clearHistory();
  editor.refresh();
  const base = path.includes('/') ? path.split('/').pop() : path;
  document.getElementById('headerPath').innerHTML =
    `${getFileIcon(base)} <span>${path}</span> <span class="badge" id="modifiedBadge" style="display:none">●</span>`;
  if (!openTabs.includes(path)) openTabs.push(path);
  renderTabs();
  renderFileTree();
  updateStatusbar();
  document.getElementById('sbLang').innerHTML = `<i class="fa-solid fa-code"></i> ${getLangName(path)}`;
  if (window.innerWidth < 768) closeSidebar();
};

// ── Save ──
window.saveData = async function (manual = false) {
  fs[currentFile] = editor.getValue();
  await IDBStore.set('fs', fs);
  // keep the local save time (for comparison with cloud load)
  await IDBStore.set('localtime', Date.now());

  document.getElementById('autosaveDot').classList.remove('active');
  const badge = document.getElementById('modifiedBadge');
  if (badge) badge.style.display = 'none';

  if (manual) {
    showToast('Saved', 'success', 'fa-floppy-disk');
    // ── Cloud save only on manual Ctrl+S ──
    // autosave will not trigger a cloud save → keeps Firestore safe
    if (typeof window.cloudSave === 'function') {
      window.cloudSave(fs);
    }
  }
};

// ── Reload fs when the cloud load happens ──
window.reloadFsFromStorage = async function () {
  const stored = await IDBStore.get('fs');
  if (!stored) return;
  try {
    fs = stored;
    editor.setValue(fs[currentFile] || '');
    renderTabs();
    renderFileTree();
    showToast('Project loaded from Cloud', 'info', 'fa-cloud-arrow-down');
  } catch (e) {
    console.error('reloadFsFromStorage error:', e);
  }
};

function onEditorChange() {
  fs[currentFile] = editor.getValue();
  document.getElementById('autosaveDot').classList.add('active');
  const badge = document.getElementById('modifiedBadge');
  if (badge) badge.style.display = '';
  updateStatusbar();
  if (cfg.autoSave) {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => saveData(), 1500);
  }
  schedulePreviewRefresh();
}

function updateStatusbar() {
  const cursor = editor.getCursor();
  document.getElementById('sbCursor').innerHTML =
    `<i class="fa-solid fa-i-cursor"></i> Ln ${cursor.line+1}, Col ${cursor.ch+1}`;
  document.getElementById('sbChars').innerHTML =
    `<i class="fa-solid fa-font"></i> ${editor.getValue().length} chars`;
}

// ── File Tree ──
function renderFileTree() {
  const tree = document.getElementById('fileTree');
  tree.innerHTML = '';
  const folders   = new Map();
  const rootFiles = [];

  Object.keys(fs).forEach(path => {
    if (path.includes('/')) {
      const folder = path.split('/')[0];
      if (!folders.has(folder)) folders.set(folder, []);
      folders.get(folder).push(path);
    } else {
      rootFiles.push(path);
    }
  });

  folders.forEach((files, folder) => {
    const isOpen = !collapsedFolders.has(folder);
    const li = document.createElement('li');
    li.innerHTML = `<div class="tree-folder ${isOpen?'open':''}" onclick="toggleFolder('${folder}',this)">
      <i class="fa-solid fa-folder" style="color:#facc15;font-size:13px"></i>
      <span>${folder}</span>
      <i class="fa-solid fa-chevron-right"></i>
    </div>`;
    tree.appendChild(li);
    if (isOpen) {
      files.forEach(path => {
        const base   = path.split('/').pop();
        const fileLi = document.createElement('li');
        fileLi.innerHTML = `<div class="tree-file ${currentFile===path?'active-file':''}"
             onclick="openFile('${path}')" oncontextmenu="showCtxMenu(event,'${path}')">
          ${getFileIcon(base)}
          <span class="tree-file-name">${base}</span>
          <div class="tree-file-actions">
            <button onclick="event.stopPropagation();startRename('${path}')"><i class="fa-solid fa-pen"></i></button>
            <button onclick="event.stopPropagation();deleteFile('${path}')"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>`;
        tree.appendChild(fileLi);
      });
    }
  });

  rootFiles.forEach(file => {
    const li = document.createElement('li');
    li.innerHTML = `<div class="tree-file tree-root-file ${currentFile===file?'active-file':''}"
         onclick="openFile('${file}')" oncontextmenu="showCtxMenu(event,'${file}')">
      ${getFileIcon(file)}
      <span class="tree-file-name">${file}</span>
      <div class="tree-file-actions">
        <button onclick="event.stopPropagation();startRename('${file}')"><i class="fa-solid fa-pen"></i></button>
        ${file!=='index.html'?`<button onclick="event.stopPropagation();deleteFile('${file}')"><i class="fa-solid fa-trash"></i></button>`:''}
      </div>
    </div>`;
    tree.appendChild(li);
  });

  if (Object.keys(fs).length === 0)
    tree.innerHTML = `<li><div class="empty-workspace"><i class="fa-solid fa-folder-open"></i><br>No files yet.<br>Create one above.</div></li>`;
}

window.toggleFolder = function (name) {
  if (collapsedFolders.has(name)) collapsedFolders.delete(name);
  else collapsedFolders.add(name);
  renderFileTree();
};

window.collapseAll = function () {
  Object.keys(fs).forEach(p => { if (p.includes('/')) collapsedFolders.add(p.split('/')[0]); });
  renderFileTree();
};

window.deleteFile = function (path) {
  showConfirm(`Delete "${path}"?`, () => {
    delete fs[path];
    openTabs = openTabs.filter(t => t !== path);
    if (currentFile === path) {
      currentFile = openTabs[0] || 'index.html';
      if (!fs[currentFile]) fs[currentFile] = DEFAULT_FS['index.html'] || '';
      editor.setValue(fs[currentFile]);
    }
    saveData();
    renderTabs();
    renderFileTree();
    showToast(`Deleted: ${path.split('/').pop()}`, 'info', 'fa-trash');
  });
};

// ── Tabs ──
function renderTabs() {
  const bar    = document.getElementById('tabBar');
  const newBtn = bar.querySelector('.tab-new-btn');
  bar.innerHTML = '';
  openTabs.forEach(path => {
    const base = path.includes('/') ? path.split('/').pop() : path;
    const div  = document.createElement('div');
    div.className = `tab ${path===currentFile?'active':''}`;
    div.innerHTML = `${getFileIcon(base)} ${base}
      <span class="close-tab" onclick="closeTab(event,'${path}')"><i class="fa-solid fa-xmark"></i></span>`;
    div.addEventListener('click', e => { if (!e.target.closest('.close-tab')) openFile(path); });
    bar.appendChild(div);
  });
  const nb = newBtn || (() => {
    const b = document.createElement('div');
    b.className = 'tab-new-btn';
    b.innerHTML = '<i class="fa-solid fa-plus"></i>';
    b.onclick   = () => openCreateModal();
    return b;
  })();
  bar.appendChild(nb);
}

window.closeTab = function (e, path) {
  e.stopPropagation();
  if (openTabs.length === 1) return;
  openTabs = openTabs.filter(t => t !== path);
  if (currentFile === path) {
    currentFile = openTabs[openTabs.length-1];
    editor.setValue(fs[currentFile]||'');
    editor.setOption('mode', getMode(currentFile));
  }
  renderTabs(); renderFileTree();
};

// ── Create / Rename ──
window.openCreateModal = function (type) {
  if (type) document.getElementById('createType').value = type;
  document.getElementById('itemName').value = '';
  openModal('createModal');
  setTimeout(() => document.getElementById('itemName').focus(), 300);
};

window.createNewItem = function () {
  const type = document.getElementById('createType').value;
  let name = document.getElementById('itemName').value.trim();
  if (!name) { showToast('Please enter a name!', 'error', 'fa-triangle-exclamation'); return; }
  if (type === 'folder') {
    if (!name.endsWith('/')) name += '/';
    const placeholder = name + 'index.html';
    if (!fs[placeholder]) fs[placeholder] = `<!-- ${name}index.html -->`;
    showToast(`Folder created: "${name.slice(0,-1)}"`, 'success', 'fa-folder-plus');
    saveData(); renderFileTree();
  } else {
    if (fs[name] !== undefined) { showToast('File already exists!', 'error', 'fa-triangle-exclamation'); return; }
    fs[name] = ''; saveData(); openFile(name);
    showToast(`Created: ${name}`, 'success', 'fa-file-plus');
  }
  closeModal('createModal');
};

window.startRename = function (path) {
  renamingFile = path;
  document.getElementById('renameInput').value = path.includes('/') ? path.split('/').pop() : path;
  openModal('renameModal');
  setTimeout(() => document.getElementById('renameInput').focus(), 300);
};

window.doRename = function () {
  const newName = document.getElementById('renameInput').value.trim();
  if (!newName || !renamingFile) return;
  const dir     = renamingFile.includes('/') ? renamingFile.split('/')[0]+'/' : '';
  const newPath = dir + newName;
  if (newPath === renamingFile) { closeModal('renameModal'); return; }
  if (fs[newPath] !== undefined) { showToast('Already exists!', 'error'); return; }
  fs[newPath] = fs[renamingFile];
  delete fs[renamingFile];
  if (currentFile === renamingFile) currentFile = newPath;
  openTabs = openTabs.map(t => t===renamingFile ? newPath : t);
  saveData(); renderTabs(); renderFileTree();
  closeModal('renameModal');
  showToast(`Renamed: ${newName}`, 'success', 'fa-pen');
};

// ── Preview / Run (real-time / live) ──
window.runCode = function () {
  saveData();
  const target = currentFile.endsWith('.html') ? currentFile : 'index.html';
  openLivePreview(target);
};

window.previewFile = function (path) {
  if (!path || !path.endsWith('.html')) {
    showToast('Only HTML files can be previewed', 'info', 'fa-circle-info');
    return;
  }
  saveData();
  openLivePreview(path);
};

// Opens the preview overlay and starts tracking targetFile for live reload.
function openLivePreview(targetFile) {
  previewTargetFile = targetFile;
  previewOpen = true;
  document.getElementById('previewOverlay').classList.add('show');
  const dot = document.getElementById('liveDot');
  if (dot) dot.classList.add('on');
  buildAndPreview(targetFile);
}

// Builds the merged HTML/CSS/JS bundle and writes it into the preview iframe.
// Uses srcdoc (instead of document.write) so live refreshes don't flash/flicker
// and behave like a real dev-server hot reload.
function buildAndPreview(targetFile) {
  fs[currentFile] = editor.getValue(); // make sure latest keystrokes are included
  let html = fs[targetFile] || '';

  Object.keys(fs).forEach(path => {
    if (path.endsWith('.css')) {
      const base = path.split('/').pop();
      html = html.replace(new RegExp(`<link[^>]+${base}[^>]*>`, 'gi'),
        `<style>\n${fs[path]}\n</style>`);
    }
    if (path.endsWith('.js')) {
      const base = path.split('/').pop();
      html = html.replace(new RegExp(`<script[^>]+${base}[^>]*><\\/script>`, 'gi'),
        `<script>${fs[path]}<\/script>`);
    }
  });

  document.getElementById('previewUrlText').textContent = `localhost:8080/${targetFile}`;
  const frame = document.getElementById('liveFrame');
  frame.srcdoc = html;

  // brief pulse on the LIVE dot so it's clear a refresh just happened
  const dot = document.getElementById('liveDot');
  if (dot) {
    dot.classList.add('updating');
    setTimeout(() => dot.classList.remove('updating'), 250);
  }
}

// Called on every keystroke / tab switch. Only rebuilds while the preview
// overlay is actually open, and debounces so it doesn't rebuild on every
// single character — just after a short pause, like a real hot-reload dev server.
function schedulePreviewRefresh() {
  if (!previewOpen || !previewTargetFile) return;
  clearTimeout(previewDebounceT);
  previewDebounceT = setTimeout(() => buildAndPreview(previewTargetFile), PREVIEW_DEBOUNCE_MS);
}

window.closePreview = function () {
  document.getElementById('previewOverlay').classList.remove('show');
  previewOpen = false;
  previewTargetFile = null;
  clearTimeout(previewDebounceT);
  const dot = document.getElementById('liveDot');
  if (dot) dot.classList.remove('on', 'updating');
};

// ── View Source ──
window.viewSource = function () {
  fs[currentFile] = editor.getValue();
  document.getElementById('sourceTitle').textContent = `Source: ${currentFile}`;
  document.getElementById('sourceBody').textContent  = fs[currentFile] || '';
  document.getElementById('sourceOverlay').classList.add('show');
};

window.closeSource = function () {
  document.getElementById('sourceOverlay').classList.remove('show');
};

window.copySource = function () {
  const src = document.getElementById('sourceBody').textContent;
  navigator.clipboard.writeText(src).then(() => showToast('Source copied!', 'success', 'fa-copy'));
};

// ── Sidebar ──
window.toggleSidebar = function () {
  const sb = document.getElementById('sidebar');
  sb.classList.toggle('active');
  document.getElementById('sidebarOverlay').classList.toggle('active');
  if (sb.classList.contains('active')) {
    switchSideTab('menu');
    renderFileTree();
  }
};

window.closeSidebar = function () {
  document.getElementById('sidebar').classList.remove('active');
  document.getElementById('sidebarOverlay').classList.remove('active');
};

window.switchSideTab = function (panel) {
  document.querySelectorAll('.sidebar-panel').forEach(p => p.classList.remove('active'));
  const target = document.getElementById('panel-' + panel);
  if (target) target.classList.add('active');
};

// ── Search ──
let searchOpen  = false;
let replaceOpen = false;

window.toggleSearch = function () {
  searchOpen = !searchOpen;
  document.getElementById('searchBar').classList.toggle('active', searchOpen);
  if (searchOpen) setTimeout(() => document.getElementById('searchInput').focus(), 100);
  else { searchCursor = null; lastSearchQuery = null; document.getElementById('searchInfo').textContent = ''; }
};

window.toggleReplace = function () {
  replaceOpen = !replaceOpen;
  document.getElementById('replaceInput').style.display = replaceOpen ? '' : 'none';
  document.getElementById('replaceDoBtn').style.display = replaceOpen ? '' : 'none';
};

let lastSearchQuery = null;

window.searchFind = function () {
  const q = document.getElementById('searchInput').value;
  if (!q) return;

  // If the query changed (or there's no active cursor yet), start a fresh
  // search from the current caret position instead of reusing a stale,
  // mismatched cursor object — that was the cause of "always not found".
  if (q !== lastSearchQuery || !searchCursor) {
    searchCursor = editor.getSearchCursor(q, editor.getCursor(), { caseFold: true });
    lastSearchQuery = q;
  }

  if (!searchCursor.findNext()) {
    // Wrap around to the beginning of the document and try again.
    searchCursor = editor.getSearchCursor(q, CodeMirror.Pos(0, 0), { caseFold: true });
    lastSearchQuery = q;
    if (!searchCursor.findNext()) {
      document.getElementById('searchInfo').textContent = 'Not found';
      return;
    }
  }

  editor.setSelection(searchCursor.from(), searchCursor.to());
  editor.scrollIntoView(searchCursor.from(), 80);
  editor.focus();
  document.getElementById('searchInfo').textContent = 'Found';
};

window.doReplace = function () {
  const q = document.getElementById('searchInput').value;
  const r = document.getElementById('replaceInput').value;
  if (!q) return;
  const c = editor.getSearchCursor(q, CodeMirror.Pos(0, 0), { caseFold: true });
  let count = 0;
  while (c.findNext()) { c.replace(r); count++; }
  searchCursor = null;
  lastSearchQuery = null;
  showToast(`${count} replaced`, 'success', 'fa-arrows-rotate');
};

document.addEventListener('keydown', e => {
  if (searchOpen && e.key === 'Enter' && document.activeElement === document.getElementById('searchInput')) searchFind();
  if (searchOpen && e.key === 'Escape') toggleSearch();
});

// ── Context Menu ──
window.showCtxMenu = function (e, path) {
  e.preventDefault();
  ctxTarget = path;
  const menu = document.getElementById('ctxMenu');
  const items = menu.querySelectorAll('.ctx-item');
  items[1].style.display = path.endsWith('.html') ? '' : 'none'; // preview
  menu.classList.add('show');
  menu.style.left = Math.min(e.clientX, window.innerWidth-170)+'px';
  menu.style.top  = Math.min(e.clientY, window.innerHeight-140)+'px';
  e.stopPropagation();
};

function hideCtxMenu() { document.getElementById('ctxMenu').classList.remove('show'); }
window.ctxOpen       = () => { if (ctxTarget) openFile(ctxTarget);    hideCtxMenu(); };
window.ctxPreview    = () => { if (ctxTarget) previewFile(ctxTarget); hideCtxMenu(); };
window.ctxViewSource = () => { if (ctxTarget) { openFile(ctxTarget); setTimeout(() => viewSource(), 100); } hideCtxMenu(); };
window.ctxRename     = () => { if (ctxTarget) startRename(ctxTarget); hideCtxMenu(); };
window.ctxDelete     = () => { if (ctxTarget) deleteFile(ctxTarget);  hideCtxMenu(); };
document.addEventListener('click', () => hideCtxMenu());

// ── Quick Keys ──
function setupQuickKeys() {
  document.querySelectorAll('.key-btn').forEach(btn => {
    btn.addEventListener('click', function () {
      const text   = this.getAttribute('data-insert');
      const offset = parseInt(this.getAttribute('data-cursor') || '0');
      const doc    = editor.getDoc();
      const cursor = doc.getCursor();
      doc.replaceRange(text, cursor);
      if (offset !== 0) doc.setCursor({ line: cursor.line, ch: cursor.ch + text.length + offset });
      editor.focus();
    });
  });
}

// ── Settings ──
function buildThemeGrid() {
  const grid = document.getElementById('themeGrid');
  grid.innerHTML = '';
  THEMES.forEach(t => {
    const card = document.createElement('div');
    card.className  = `theme-card ${cfg.theme===t.id?'active':''}`;
    card.dataset.id = t.id;
    card.innerHTML  = `<div class="theme-dots">${t.dots.map(d=>`<div class="theme-dot" style="background:${d}"></div>`).join('')}</div><span class="theme-name">${t.name}</span>`;
    card.onclick    = () => applyTheme(t.id);
    grid.appendChild(card);
  });
}

window.applyTheme = function (id) {
  cfg.theme = id;
  editor.setOption('theme', id);
  document.getElementById('sbTheme').innerHTML = `<i class="fa-solid fa-palette"></i> ${id}`;
  document.querySelectorAll('.theme-card').forEach(c => c.classList.toggle('active', c.dataset.id===id));
  saveSettings();
  showToast(`Theme: ${id}`, 'info', 'fa-palette');
};

function buildFontBtns() {
  const container = document.getElementById('fontBtns');
  container.innerHTML = '';
  FONTS.forEach(f => {
    const btn = document.createElement('button');
    btn.className    = `font-btn ${cfg.font===f?'active':''}`;
    btn.textContent  = f;
    btn.style.fontFamily = f;
    btn.onclick      = () => applyFont(f);
    container.appendChild(btn);
  });
}

function applyFont(font) {
  cfg.font = font; applyFontStyle();
  document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.textContent===font));
  saveSettings();
  showToast(`Font: ${font}`, 'info', 'fa-font');
}

function applyFontStyle() {
  const cm = document.querySelector('.CodeMirror');
  if (cm) cm.style.fontFamily = cfg.font + ', monospace';
  document.documentElement.style.setProperty('--font-code', `'${cfg.font}', monospace`);
}

window.changeFontSize = function (val) {
  cfg.fontSize = parseInt(val);
  document.getElementById('fontSizeVal').textContent = val+'px';
  document.documentElement.style.setProperty('--font-size-editor', val+'px');
  const cm = document.querySelector('.CodeMirror');
  if (cm) cm.style.fontSize = val+'px';
  editor && editor.refresh();
  saveSettings();
};

window.changeLineHeight = function (val) {
  const lh = (val/10).toFixed(1);
  cfg.lineHeight = parseFloat(lh);
  document.getElementById('lineHeightVal').textContent = lh;
  const cm = document.querySelector('.CodeMirror');
  if (cm) cm.style.lineHeight = lh;
  editor && editor.refresh();
  saveSettings();
};

window.applyEditorSetting = function (key, val) {
  cfg[key] = val;
  editor && editor.setOption(key, val);
  saveSettings();
};

window.toggleAutoSave = function (val) {
  cfg.autoSave = val;
  if (!val) { clearTimeout(autoSaveTimer); document.getElementById('autosaveDot').classList.remove('active'); }
  saveSettings();
  showToast(`Auto-save ${val?'On':'Off'}`, 'info', 'fa-cloud');
};

function applySettingsUI() {
  document.getElementById('lineNumbersToggle').checked   = cfg.lineNumbers;
  document.getElementById('wordWrapToggle').checked      = cfg.wordWrap;
  document.getElementById('autoCloseToggle').checked     = cfg.autoClose;
  document.getElementById('autoSaveToggle').checked      = cfg.autoSave;
  document.getElementById('matchBracketsToggle').checked = cfg.matchBrackets;
  document.getElementById('fontSizeSlider').value        = cfg.fontSize;
  document.getElementById('fontSizeVal').textContent     = cfg.fontSize+'px';
  document.getElementById('lineHeightSlider').value      = Math.round(cfg.lineHeight*10);
  document.getElementById('lineHeightVal').textContent   = cfg.lineHeight;
  document.getElementById('sbTheme').innerHTML = `<i class="fa-solid fa-palette"></i> ${cfg.theme}`;
  changeFontSize(cfg.fontSize);
  changeLineHeight(Math.round(cfg.lineHeight*10));
}

async function saveSettings() { await IDBStore.set('settings', cfg); }

function buildShortcutList() {
  document.getElementById('shortcutList').innerHTML = SHORTCUTS.map(s =>
    `<div class="shortcut-item"><span>${s.desc}</span><span class="shortcut-key">${s.key}</span></div>`
  ).join('');
}

// ── Export / Clear ──
window.exportProject = function () {
  const a = document.createElement('a');
  a.href = 'data:application/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(fs, null, 2));
  a.download = 'techverse-project.json';
  a.click();
  showToast('Exported!', 'success', 'fa-download');
};

// ── Download as ZIP ──
window.downloadAsZip = async function () {
  if (typeof JSZip === 'undefined') {
    await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
  }

  showToast('Creating ZIP…', 'info', 'fa-spinner');

  fs[currentFile] = editor.getValue();

  const zip = new JSZip();
  Object.entries(fs).forEach(([path, content]) => {
    zip.file(path, content || '');
  });

  const blob = await zip.generateAsync({
    type: 'blob',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  });

  const projectName = Object.keys(fs).includes('index.html')
    ? 'my-project'
    : 'techverse-project';

  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = projectName + '.zip';
  a.click();
  URL.revokeObjectURL(url);

  showToast('Downloading ZIP!', 'success', 'fa-file-zipper');
};

// ── Expose current files for external integrations (e.g. GitHub deploy) ──
// Always flushes the actively-open file's latest content first, same as downloadAsZip does.
window.getProjectFiles = function () {
  if (editor && currentFile) fs[currentFile] = editor.getValue();
  return JSON.parse(JSON.stringify(fs));
};

// ── Dynamic script loader ──
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s   = document.createElement('script');
    s.src     = src;
    s.onload  = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}


// Clear data 

window.clearStorage = function () {
  showConfirm(
    'Delete all files and settings? This cannot be undone.',
    async () => {
      await IDBStore.clear();
      // also clear any leftover old localStorage data
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(SETTINGS_KEY);
      localStorage.removeItem('tv_promax_localtime');
      localStorage.removeItem('tv_promax_cloudtime');
      location.reload();
    },
    { title: 'Delete everything?' }
  );
};




// ── Modal ──
window.openModal  = id => document.getElementById(id).classList.add('active');
window.closeModal = id => document.getElementById(id).classList.remove('active');

// ── Custom Confirm (replaces native confirm() so the browser/localhost
//    permission-style popup never shows — uses our own styled modal) ──
window.showConfirm = function (message, onConfirm, opts = {}) {
  document.getElementById('confirmMessage').textContent = message;
  document.getElementById('confirmTitle').textContent   = opts.title || 'Please Confirm';
  const okBtn = document.getElementById('confirmOkBtn');
  okBtn.textContent = opts.okText || 'Delete';
  const newBtn = okBtn.cloneNode(true); // strip old listeners
  okBtn.parentNode.replaceChild(newBtn, okBtn);
  newBtn.addEventListener('click', () => {
    closeModal('confirmModal');
    onConfirm();
  });
  openModal('confirmModal');
};

document.querySelectorAll('.modal').forEach(m => {
  m.addEventListener('click', e => { if (e.target===m) closeModal(m.id); });
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') {
    ['createModal','renameModal','profileModal','confirmModal'].forEach(id => {
      if (document.getElementById(id)?.classList.contains('active')) closeModal(id);
    });
    if (document.getElementById('sourceOverlay')?.classList.contains('show')) closeSource();
  }
  if (e.key === 'Enter') {
    if (document.getElementById('createModal')?.classList.contains('active')) createNewItem();
    if (document.getElementById('renameModal')?.classList.contains('active')) doRename();
  }
});

// ── Toast ──
window.showToast = function (msg, type='info', icon='fa-circle-info') {
  const container = document.getElementById('toastContainer');
  const toast     = document.createElement('div');
  toast.className = `toast ${type}`;
  const color = type==='success' ? 'var(--success)' : type==='error' ? 'var(--danger)' : 'var(--primary)';
  toast.innerHTML = `<i class="fa-solid ${icon}" style="color:${color}"></i> ${msg}`;
  container.appendChild(toast);
  setTimeout(() => { toast.classList.add('out'); setTimeout(() => toast.remove(), 350); }, 2500);
};

// ── Global Keyboard Shortcuts ──
function handleGlobalKey(e) {
  if (e.ctrlKey || e.metaKey) {
    if (e.key==='s') { e.preventDefault(); saveData(true); }
    if (e.key==='Enter') { e.preventDefault(); runCode(); }
    if (e.key==='b') { e.preventDefault(); toggleSidebar(); }
    if (e.key==='f') { e.preventDefault(); toggleSearch(); }
  }
}
