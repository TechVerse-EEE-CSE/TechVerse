// ══════════════════════════════════════
//  GITHUB DEPLOY — js/github-deploy.js
//  Lets a logged-in user connect their own GitHub account
//  and deploy the current project as a live GitHub Pages site.
//
//  How it works:
//   1. "Connect GitHub" links the user's existing Tech Verse account
//      to GitHub via Firebase Auth (GithubAuthProvider, 'repo' scope).
//   2. The GitHub OAuth access token Firebase hands back is kept only
//      in memory + sessionStorage (cleared when the tab closes) —
//      it is never written to Firestore or any server we control.
//   3. "Deploy" creates (or reuses) a repo owned by THAT user's GitHub
//      account, pushes every file in the project as one commit using
//      the Git Data API, then turns on GitHub Pages for it.
//
//  Setup required (one-time, by the site owner): see GITHUB-DEPLOY-SETUP.md
//  — a GitHub OAuth App must be registered and enabled as a Firebase
//  Auth sign-in provider before this feature will work.
// ══════════════════════════════════════

import {
  GithubAuthProvider,
  linkWithPopup,
  reauthenticateWithPopup,
  unlink,
} from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

const githubProvider = new GithubAuthProvider();
githubProvider.addScope('repo'); // needed to create repos + push files on the user's behalf

// ── In-memory state (never persisted beyond this tab/session) ──
let githubToken = sessionStorage.getItem('gh_token') || null;
let githubUser  = null;
try {
  const cached = sessionStorage.getItem('gh_user');
  if (cached) githubUser = JSON.parse(cached);
} catch (_) { githubUser = null; }

// ══════════════════════════════════════
//  Wait for Firebase auth to be ready (auth.js sets this)
// ══════════════════════════════════════
function _waitForAuth() {
  return new Promise(resolve => {
    if (window._firebaseAuth) return resolve(window._firebaseAuth);
    const iv = setInterval(() => {
      if (window._firebaseAuth) { clearInterval(iv); resolve(window._firebaseAuth); }
    }, 100);
  });
}

// ══════════════════════════════════════
//  Connection status
// ══════════════════════════════════════
window.isGithubConnected = function () {
  const auth = window._firebaseAuth;
  const user = auth && auth.currentUser;
  return !!(user && githubToken && user.providerData.some(p => p.providerId === 'github.com'));
};

// ══════════════════════════════════════
//  Called from auth.js right after a user signs in/up with GitHub —
//  reuses that same access token here so the Deploy modal already
//  shows "create a repository" instead of asking to connect again.
// ══════════════════════════════════════
window.applyGithubSessionFromSignIn = async function (accessToken) {
  if (!accessToken) return;
  githubToken = accessToken;
  sessionStorage.setItem('gh_token', githubToken);
  try {
    await _fetchGithubProfile();
  } catch (e) {
    console.error('applyGithubSessionFromSignIn: failed to fetch profile', e);
  }
};

// ══════════════════════════════════════
//  Connect (link or refresh the GitHub identity + token)
// ══════════════════════════════════════
window.connectGithub = async function () {
  const auth = await _waitForAuth();
  const user = auth.currentUser;
  if (!user) { _toast('Please log in to Tech Verse first', 'error'); return false; }

  const btn = document.getElementById('ghConnectBtn');
  if (btn) { btn.disabled = true; btn.classList.add('loading'); }

  try {
    const alreadyLinked = user.providerData.some(p => p.providerId === 'github.com');
    const result = alreadyLinked
      ? await reauthenticateWithPopup(user, githubProvider)
      : await linkWithPopup(user, githubProvider);

    const credential = GithubAuthProvider.credentialFromResult(result);
    if (!credential || !credential.accessToken) throw new Error('no-token');

    githubToken = credential.accessToken;
    sessionStorage.setItem('gh_token', githubToken);

    await _fetchGithubProfile();
    _toast('GitHub connected ✅', 'success', 'fa-brands fa-github');
    _showStep('deploy');
    _prefillRepoName();
    _renderDeploymentsList();
    return true;
  } catch (e) {
    console.error('connectGithub failed:', e);
    let msg = 'Could not connect to GitHub. Please try again.';
    if (e.code === 'auth/credential-already-in-use') msg = 'This GitHub account is already linked to a different user.';
    else if (e.code === 'auth/popup-closed-by-user') msg = 'GitHub connection was cancelled.';
    else if (e.code === 'auth/operation-not-allowed') msg = 'GitHub sign-in isn\u2019t enabled for this app yet.';
    else if (e.code === 'auth/provider-already-linked') { await _fetchGithubProfile().catch(()=>{}); _showStep('deploy'); _prefillRepoName(); _renderDeploymentsList(); return true; }
    _toast(msg, 'error', 'fa-triangle-exclamation');
    return false;
  } finally {
    if (btn) { btn.disabled = false; btn.classList.remove('loading'); }
  }
};

// ══════════════════════════════════════
//  Disconnect
// ══════════════════════════════════════
window.disconnectGithub = async function () {
  const auth = window._firebaseAuth;
  const user = auth && auth.currentUser;
  try { if (user) await unlink(user, 'github.com'); } catch (_) { /* wasn't linked, fine */ }
  githubToken = null;
  githubUser  = null;
  _deploymentsCache = null;
  sessionStorage.removeItem('gh_token');
  sessionStorage.removeItem('gh_user');
  _toast('GitHub disconnected', 'info', 'fa-link-slash');
  _showStep('connect');
};

async function _fetchGithubProfile() {
  const res = await fetch('https://api.github.com/user', {
    headers: { Authorization: `Bearer ${githubToken}` }
  });
  if (!res.ok) throw new Error('Could not read GitHub profile');
  const data = await res.json();
  githubUser = { login: data.login, avatar_url: data.avatar_url, name: data.name };
  sessionStorage.setItem('gh_user', JSON.stringify(githubUser));
  _renderAccountRow();
}

function _renderAccountRow() {
  if (!githubUser) return;
  const av = document.getElementById('ghAvatar');
  const lg = document.getElementById('ghLogin');
  if (av) av.src = githubUser.avatar_url || '';
  if (lg) lg.textContent = '@' + githubUser.login;
}

// ══════════════════════════════════════
//  Modal open/close + step switching
// ══════════════════════════════════════
window.openGithubDeployModal = async function () {
  const modal = document.getElementById('githubDeployModal');
  if (!modal) return;
  modal.classList.add('active');
  const list = document.getElementById('ghProgressList');
  if (list) list.innerHTML = '';

  await _waitForAuth();
  if (window.isGithubConnected()) {
    if (!githubUser) { try { await _fetchGithubProfile(); } catch (_) {} }
    _renderAccountRow();
    _showStep('deploy');
    _prefillRepoName();
    _renderDeploymentsList();
  } else {
    _showStep('connect');
  }
};

window.closeGithubDeployModal = function () {
  const modal = document.getElementById('githubDeployModal');
  if (modal) modal.classList.remove('active');
};

function _showStep(name) {
  ['connect', 'deploy', 'progress', 'done'].forEach(s => {
    const el = document.getElementById('ghStep' + s[0].toUpperCase() + s.slice(1));
    if (el) el.style.display = (s === name) ? 'block' : 'none';
  });
}

// ══════════════════════════════════════
//  Repo name helpers
// ══════════════════════════════════════
function _slugify(name) {
  return (name || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-_. ]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, 90) || 'my-tech-verse-site';
}

function _prefillRepoName() {
  const input = document.getElementById('ghRepoName');
  if (!input) return;
  let base = 'my-tech-verse-site';
  try {
    const files = window.getProjectFiles ? window.getProjectFiles() : {};
    const idx = files['index.html'];
    const m = idx && idx.match(/<title>([^<]+)<\/title>/i);
    if (m && m[1].trim()) base = m[1].trim();
  } catch (_) {}
  input.value = _slugify(base);
  window.checkGithubRepoName();
}

let _repoCheckTimer = null;
window.checkGithubRepoName = function () {
  clearTimeout(_repoCheckTimer);
  const hint  = document.getElementById('ghRepoHint');
  const btn   = document.getElementById('ghDeployBtn');
  const input = document.getElementById('ghRepoName');
  if (!hint || !btn || !input) return;

  const name = _slugify(input.value);
  if (!name) { hint.textContent = ''; return; }

  hint.textContent = 'Checking availability…';
  hint.className = 'username-hint';
  btn.disabled = true;

  _repoCheckTimer = setTimeout(async () => {
    try {
      const repo = await _ghGet(`/repos/${githubUser.login}/${name}`);
      if (!repo) {
        hint.textContent = 'Available — a new repository will be created ✓';
        hint.className = 'username-hint success';
      } else {
        hint.textContent = 'This repo already exists on your account — files will be pushed into it.';
        hint.className = 'username-hint';
      }
    } catch (e) {
      hint.textContent = e.message || 'Could not check repo name right now.';
      hint.className = 'username-hint error';
    } finally {
      btn.disabled = false;
    }
  }, 450);
};

// ══════════════════════════════════════
//  Deploy: create/reuse repo → push all files as one commit → enable Pages
// ══════════════════════════════════════
window.startGithubDeploy = async function () {
  const input = document.getElementById('ghRepoName');
  const repoName = _slugify(input ? input.value : '');
  if (!githubToken || !githubUser) { _toast('Please connect GitHub first', 'error'); _showStep('connect'); return; }

  _showStep('progress');
  _logProgress('Preparing your files…', 'fa-spinner fa-spin');

  try {
    const files = window.getProjectFiles ? window.getProjectFiles() : {};
    const fileEntries = Object.entries(files).filter(([, content]) => typeof content === 'string');
    if (!fileEntries.length) throw new Error('There are no files in this project to deploy.');

    // 1. Ensure the repo exists (created under THIS user's own GitHub account)
    _logProgress('Checking your GitHub repositories…', 'fa-magnifying-glass');
    let repo = await _ghGet(`/repos/${githubUser.login}/${repoName}`);
    if (!repo) {
      _logProgress(`Creating repository "${repoName}"…`, 'fa-plus');
      repo = await _ghPost('/user/repos', {
        name: repoName,
        description: 'Built and deployed with Tech Verse Editor',
        auto_init: true,
      });
    }
    const owner = repo.owner.login;
    const branch = repo.default_branch || 'main';

    // 2. Current branch tip (repo may be brand new with an auto_init commit)
    _logProgress('Reading current branch…', 'fa-code-branch');
    const ref = await _ghGet(`/repos/${owner}/${repoName}/git/ref/heads/${branch}`);
    const baseCommitSha = ref ? ref.object.sha : null;
    const baseTreeSha = baseCommitSha
      ? (await _ghGet(`/repos/${owner}/${repoName}/git/commits/${baseCommitSha}`)).tree.sha
      : null;

    // 3. Upload every file as a blob
    _logProgress(`Uploading ${fileEntries.length} file${fileEntries.length > 1 ? 's' : ''}…`, 'fa-cloud-arrow-up');
    const treeItems = [];
    for (const [path, content] of fileEntries) {
      const blob = await _ghPost(`/repos/${owner}/${repoName}/git/blobs`, {
        content: _utf8ToBase64(content || ''),
        encoding: 'base64',
      });
      treeItems.push({ path, mode: '100644', type: 'blob', sha: blob.sha });
    }

    // 4. Build the tree + commit on top of the current branch tip
    _logProgress('Building the commit…', 'fa-sitemap');
    const treeBody = { tree: treeItems };
    if (baseTreeSha) treeBody.base_tree = baseTreeSha;
    const tree = await _ghPost(`/repos/${owner}/${repoName}/git/trees`, treeBody);

    const commit = await _ghPost(`/repos/${owner}/${repoName}/git/commits`, {
      message: 'Deploy from Tech Verse Editor',
      tree: tree.sha,
      parents: baseCommitSha ? [baseCommitSha] : [],
    });

    // 5. Move the branch pointer to the new commit
    if (baseCommitSha) {
      await _ghPatch(`/repos/${owner}/${repoName}/git/refs/heads/${branch}`, { sha: commit.sha, force: false });
    } else {
      await _ghPost(`/repos/${owner}/${repoName}/git/refs`, { ref: `refs/heads/${branch}`, sha: commit.sha });
    }

    // 6. Turn on GitHub Pages for that branch (skip if already on)
    _logProgress('Enabling GitHub Pages…', 'fa-globe');
    let pages = await _ghGet(`/repos/${owner}/${repoName}/pages`);
    if (!pages) {
      pages = await _ghPost(`/repos/${owner}/${repoName}/pages`, { source: { branch, path: '/' } });
    }

    _logProgress('Finishing up…', 'fa-hourglass-half');
    await _sleep(2000);
    const finalPages = (await _ghGet(`/repos/${owner}/${repoName}/pages`)) || pages;
    const liveUrl = (finalPages && finalPages.html_url) || `https://${owner}.github.io/${repoName}/`;

    _showDone(liveUrl, `https://github.com/${owner}/${repoName}`, repoName);
  } catch (e) {
    console.error('GitHub deploy failed:', e);
    _showStep('deploy');
    _toast(e.message || 'Deployment failed. Please try again.', 'error', 'fa-triangle-exclamation');
  }
};

function _showDone(liveUrl, repoUrl, repoName) {
  _showStep('done');
  const liveLink = document.getElementById('ghLiveLink');
  const repoLink = document.getElementById('ghRepoLink');
  if (liveLink) { liveLink.href = liveUrl; liveLink.textContent = liveUrl.replace(/^https?:\/\//, ''); }
  if (repoLink) { repoLink.href = repoUrl; }
  _toast('Deployed successfully 🚀', 'success', 'fa-rocket');
  _deploymentsCache = null; // force a fresh GitHub lookup next time the list is shown
}

// ══════════════════════════════════════
//  Deployment history — read LIVE from the user's own GitHub account
//  (instead of a locally-kept record) so every repo ever created by this
//  tool shows up here, including ones deployed before this list existed.
// ══════════════════════════════════════
const DEPLOY_MARKER = 'Built and deployed with Tech Verse Editor';
let _deploymentsCache = null; // small in-tab cache so re-opening the modal doesn't always re-hit the API

async function _fetchDeployedRepos() {
  if (!githubToken || !githubUser) return [];
  if (_deploymentsCache) return _deploymentsCache;

  try {
    // Every repo owned by the user, most recently pushed first
    const repos = await _ghGet('/user/repos?per_page=100&sort=pushed&affiliation=owner');
    if (!Array.isArray(repos)) return [];

    // Only repos this tool created/deployed to (tagged via the description we set on creation)
    const deployed = repos.filter(r => (r.description || '').includes(DEPLOY_MARKER));

    // Fetch each one's Pages URL (if enabled) in parallel, capped to keep this fast
    const withPages = await Promise.all(deployed.slice(0, 15).map(async r => {
      let liveUrl = `https://${r.owner.login}.github.io/${r.name}/`;
      try {
        const pages = await _ghGet(`/repos/${r.owner.login}/${r.name}/pages`);
        if (pages && pages.html_url) liveUrl = pages.html_url;
      } catch (_) {}
      return {
        repoName: r.name,
        owner: r.owner.login,
        repoUrl: r.html_url,
        liveUrl,
        deployedAt: r.pushed_at || r.updated_at,
      };
    }));

    _deploymentsCache = withPages;
    return withPages;
  } catch (e) {
    console.error('Could not fetch deployed repos from GitHub:', e);
    return [];
  }
}

async function _renderDeploymentsList() {
  const wrap = document.getElementById('ghDeploymentsWrap');
  const list = document.getElementById('ghDeploymentsList');
  if (!wrap || !list) return;

  wrap.style.display = 'block';
  list.innerHTML = `<div class="gh-deployments-empty"><i class="fa-solid fa-spinner fa-spin"></i> Loading…</div>`;

  const deployments = await _fetchDeployedRepos();
  if (!deployments.length) {
    list.innerHTML = `<div class="gh-deployments-empty">No repositories deployed yet.</div>`;
    return;
  }

  list.innerHTML = deployments.map(d => `
    <div class="gh-deployment-item" onclick="window.reuseGithubDeployment('${_escAttr(d.repoName)}')">
      <i class="fa-brands fa-github"></i>
      <div class="gh-deployment-info">
        <div class="gh-deployment-name">${_escHtml(d.owner)}/${_escHtml(d.repoName)}</div>
        <div class="gh-deployment-time">Deployed ${_timeAgo(d.deployedAt)}</div>
      </div>
      <a class="gh-deployment-open" href="${_escAttr(d.liveUrl || d.repoUrl)}" target="_blank" rel="noopener" onclick="event.stopPropagation()" title="Open live site">
        <i class="fa-solid fa-arrow-up-right-from-square"></i>
      </a>
    </div>
  `).join('');
}

// Clicking a saved deployment reuses its repo name — pushes a fresh commit to that same repo
window.reuseGithubDeployment = function (repoName) {
  const input = document.getElementById('ghRepoName');
  if (!input) return;
  input.value = repoName;
  window.checkGithubRepoName();
  input.scrollIntoView({ block: 'nearest' });
};

function _timeAgo(iso) {
  if (!iso) return 'recently';
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day}d ago`;
  return new Date(iso).toLocaleDateString();
}

function _escHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function _escAttr(s) { return _escHtml(s).replace(/'/g, '&#39;'); }

// ══════════════════════════════════════
//  GitHub REST helpers
// ══════════════════════════════════════
async function _ghFetch(method, path, body) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${githubToken}`,
      Accept: 'application/vnd.github+json',
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 404 && method === 'GET') return null;

  if (res.status === 401) {
    githubToken = null;
    sessionStorage.removeItem('gh_token');
    throw new Error('Your GitHub session expired — please reconnect.');
  }

  if (!res.ok) {
    let msg = `GitHub error (${res.status})`;
    try { const j = await res.json(); if (j && j.message) msg = j.message; } catch (_) {}
    throw new Error(msg);
  }

  if (res.status === 204) return true;
  return res.json();
}
const _ghGet   = (path)       => _ghFetch('GET', path);
const _ghPost  = (path, body) => _ghFetch('POST', path, body);
const _ghPatch = (path, body) => _ghFetch('PATCH', path, body);

function _utf8ToBase64(str) {
  return btoa(unescape(encodeURIComponent(str)));
}
function _sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function _logProgress(text, icon) {
  const list = document.getElementById('ghProgressList');
  if (!list) return;
  const row = document.createElement('div');
  row.className = 'gh-progress-item';
  row.innerHTML = `<i class="fa-solid ${icon}"></i><span>${text}</span>`;
  list.appendChild(row);
  list.scrollTop = list.scrollHeight;
}

function _toast(msg, type, icon) {
  if (typeof showToast === 'function') showToast(msg, type, icon);
}

window._githubDeployReady = true;
