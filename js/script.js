// js/script.js

// ===== FIREBASE INITIALIZATION =====
firebase.initializeApp(CONFIG.FIREBASE);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// ===== INJECT WEB3FORMS KEY =====
document.addEventListener('DOMContentLoaded', () => {
    const formKeyInput = document.getElementById('web3forms_key_input');
    if(formKeyInput) {
        formKeyInput.value = CONFIG.WEB3FORMS_KEY;
    }
});

// ===== STATE =====
let appState = {
    isLoggedIn: false, hasPremium: false,
    editorTrialsUsed: 0, builderTrialsUsed: 0,
    maxTrials: 3, pendingWorkspace: null,
    theme: 'dark', dragMode: false
};
try {
    const saved = localStorage.getItem('techverse_state');
    if (saved) appState = { ...appState, ...JSON.parse(saved) };
} catch(e) {}

function saveState() {
    localStorage.setItem('techverse_state', JSON.stringify(appState));
}

// ===== THEME =====
function applyTheme(t) {
    const html = document.documentElement;
    if (t === 'light') {
        html.classList.remove('dark'); html.classList.add('light');
        document.getElementById('theme-icon').className = 'fa-solid fa-sun';
        const mob = document.getElementById('theme-icon-mobile');
        if (mob) mob.className = 'fa-solid fa-sun';
    } else {
        html.classList.remove('light'); html.classList.add('dark');
        document.getElementById('theme-icon').className = 'fa-solid fa-moon';
        const mob = document.getElementById('theme-icon-mobile');
        if (mob) mob.className = 'fa-solid fa-moon';
    }
}
applyTheme(appState.theme);

function toggleTheme() {
    appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
    applyTheme(appState.theme);
    saveState();
}

// ===== DRAG MODE =====
let isDragging = false, dragStartX = 0, dragStartY = 0, dragScrollX = 0, dragScrollY = 0;

function toggleDragMode() {
    appState.dragMode = !appState.dragMode;
    saveState();
    const btn = document.getElementById('dragModeBtn');
    const label = document.getElementById('dragModeLabel');
    if (appState.dragMode) {
        document.body.classList.add('drag-mode');
        btn.classList.add('text-cyan-400', 'border-cyan-500/30');
        label.textContent = 'Drag ON';
    } else {
        document.body.classList.remove('drag-mode', 'dragging');
        btn.classList.remove('text-cyan-400', 'border-cyan-500/30');
        label.textContent = 'Drag';
    }
}

document.addEventListener('mousedown', (e) => {
    if (!appState.dragMode) return;
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    dragScrollX = window.scrollX;
    dragScrollY = window.scrollY;
    document.body.classList.add('dragging');
});
document.addEventListener('mousemove', (e) => {
    if (!isDragging || !appState.dragMode) return;
    const dx = e.clientX - dragStartX;
    const dy = e.clientY - dragStartY;
    window.scrollTo(dragScrollX - dx, dragScrollY - dy);
});
document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.classList.remove('dragging');
});

// ===== FIREBASE AUTH =====
auth.onAuthStateChanged((user) => {
    if (user) {
        appState.isLoggedIn = true;
        saveState();
        const el = document.getElementById('user-display-name');
        if (el && user.displayName) el.textContent = user.displayName.split(' ')[0];
        updateUIState();
    }
});

function updateUIState() {
    const s = document.getElementById('nav-user-status');
    if (appState.isLoggedIn && s) { s.classList.remove('hidden'); s.classList.add('flex'); }
    document.querySelectorAll('.editor-remaining').forEach(el => el.textContent = Math.max(0, appState.maxTrials - appState.editorTrialsUsed));
    document.querySelectorAll('.builder-remaining').forEach(el => el.textContent = Math.max(0, appState.maxTrials - appState.builderTrialsUsed));
}
updateUIState();

// ===== PRELOADER =====
window.addEventListener('load', () => {
    setTimeout(() => {
        const p = document.getElementById('preloader');
        p.style.opacity = '0';
        setTimeout(() => p.style.visibility = 'hidden', 600);
    }, 800);
});

// ===== CURSOR GLOW =====
const glow = document.getElementById('cursor-glow');
let cx = 0, cy = 0, tx = 0, ty = 0;
window.addEventListener('mousemove', e => { tx = e.clientX; ty = e.clientY; });
(function animGlow() {
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    if (glow) { glow.style.left = cx + 'px'; glow.style.top = cy + 'px'; }
    requestAnimationFrame(animGlow);
})();

// ===== TYPEWRITER =====
const texts = ["Innovation","Robotics & AI","Hardware Logic","Python","Integration","TechVerse","EEE Projects","CSE Projects"];
let tCount = 0, tIndex = 0;
(function type() {
    if (tCount === texts.length) tCount = 0;
    const current = texts[tCount];
    const letter = current.slice(0, ++tIndex);
    const el = document.getElementById('typewriter');
    if (el) el.textContent = letter;
    if (letter.length === current.length) {
        tCount++; tIndex = 0;
        setTimeout(type, 2000);
    } else { setTimeout(type, 100); }
})();

// ===== COUNTER =====
const countObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        const target = +el.getAttribute('data-target');
        let count = 0;
        const inc = target / 50;
        const update = () => {
            count = Math.min(count + inc, target);
            el.innerText = Math.ceil(count);
            if (count < target) setTimeout(update, 40);
        };
        update();
        countObserver.unobserve(el);
    });
});
document.querySelectorAll('.counter').forEach(c => countObserver.observe(c));

// ===== READING PROGRESS =====
window.addEventListener('scroll', () => {
    const doc = document.documentElement;
    const pct = (doc.scrollTop / (doc.scrollHeight - doc.clientHeight)) * 100;
    document.getElementById('reading-progress').style.width = pct + '%';
});

// ===== PROJECT FILTER =====
function filterProjects(cat, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active-filter');
        b.classList.add('text-gray-400');
    });
    btn.classList.add('active-filter');
    btn.classList.remove('text-gray-400');
    document.querySelectorAll('.project-card').forEach(card => {
        const show = cat === 'all' || card.getAttribute('data-category') === cat;
        card.style.transition = 'opacity 0.3s ease, transform 0.3s ease';
        if (show) {
            card.style.display = 'flex';
            setTimeout(() => { card.style.opacity = '1'; card.style.transform = 'translateY(0)'; }, 30);
        } else {
            card.style.opacity = '0'; card.style.transform = 'translateY(10px)';
            setTimeout(() => card.style.display = 'none', 300);
        }
    });
}

// ===== COPY CODE =====
function copyCode(btn) {
    const codeEl = btn.nextElementSibling || btn.parentElement.querySelector('.hidden');
    const text = codeEl ? (codeEl.innerText || codeEl.textContent) : '';
    navigator.clipboard.writeText(text).then(() => {
        const orig = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied';
        showToast("Code copied!", "emerald");
        setTimeout(() => btn.innerHTML = orig, 2000);
    });
}

// ===== TOAST =====
function showToast(msg, color = 'emerald') {
    const toast = document.getElementById('toast');
    const colors = { emerald: '#10b981', red: '#ef4444', yellow: '#eab308', cyan: '#22d3ee' };
    toast.style.color = colors[color] || colors.emerald;
    toast.style.borderColor = (colors[color] || colors.emerald) + '40';
    document.getElementById('toastMsg').textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3500);
}

// ===== AOS & TILT =====
AOS.init({ once: true, offset: 50, duration: 800 });
VanillaTilt.init(document.querySelectorAll(".glass-card"), {
    max: 3, speed: 400, glare: true, "max-glare": 0.1, perspective: 1000
});

// ===== SCROLL EFFECTS =====
window.addEventListener('scroll', () => {
    const nb = document.getElementById('navbar');
    if (window.scrollY > 50) {
        nb.classList.add('nav-scrolled');
        nb.classList.replace('py-4', 'py-2');
    } else {
        nb.classList.remove('nav-scrolled');
        nb.classList.replace('py-2', 'py-4');
    }
    const stb = document.getElementById('scrollTopBtn');
    if (window.scrollY > 400) stb.classList.add('visible');
    else stb.classList.remove('visible');

    // Scrollspy
    let current = '';
    document.querySelectorAll('section').forEach(sec => {
        if (window.pageYOffset >= sec.offsetTop - 150) current = sec.getAttribute('id');
    });
    document.querySelectorAll('.nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('href') && l.getAttribute('href').includes(current)) l.classList.add('active');
    });
    document.querySelectorAll('.bottom-nav-link').forEach(l => {
        l.classList.remove('active');
        if (l.getAttribute('href') && l.getAttribute('href').includes(current)) l.classList.add('active');
    });
});

function scrollToTop() { window.scrollTo({ top: 0, behavior: 'smooth' }); }

// ===== MOBILE MENU =====
const menuBtn = document.getElementById('menu-btn');
const mobileMenu = document.getElementById('mobile-menu');
menuBtn.addEventListener('click', () => {
    mobileMenu.classList.toggle('hidden');
    const icon = menuBtn.querySelector('i');
    icon.className = mobileMenu.classList.contains('hidden') ? 'fa-solid fa-bars text-xl' : 'fa-solid fa-xmark text-xl';
});
document.querySelectorAll('.mobile-nav-link').forEach(l => {
    l.addEventListener('click', () => {
        mobileMenu.classList.add('hidden');
        menuBtn.querySelector('i').className = 'fa-solid fa-bars text-xl';
    });
});

// ===== WORKSPACE =====
function openWorkspace(type) {
    if (!appState.isLoggedIn) {
        appState.pendingWorkspace = type;
        openModal('authModal');
        return;
    }
    if (!appState.hasPremium) {
        if (type === 'editor' && appState.editorTrialsUsed >= appState.maxTrials) { openModal('paywallModal'); return; }
        if (type === 'eeeBuilder' && appState.builderTrialsUsed >= appState.maxTrials) { openModal('paywallModal'); return; }
    }
    const ws = document.getElementById(type + 'Workspace');
    if (!ws) return;
    document.body.style.overflow = 'hidden';
    ws.classList.remove('hidden');
    setTimeout(() => ws.style.opacity = '1', 20);
    if (type === 'editor') { renderFileList(); switchActiveFile(activeFile); }
    updateUIState();
}

function closeWorkspace(type) {
    const ws = document.getElementById(type + 'Workspace');
    document.body.style.overflow = '';
    ws.style.opacity = '0';
    if (type === 'editor' && isFullScreen) toggleFullScreenEditor();
    setTimeout(() => ws.classList.add('hidden'), 400);
}

function openModal(id) {
    const m = document.getElementById(id);
    m.classList.remove('hidden');
    setTimeout(() => m.style.opacity = '1', 20);
}

function closeAuthModal() {
    const m = document.getElementById('authModal');
    m.style.opacity = '0';
    setTimeout(() => m.classList.add('hidden'), 400);
}
function closePaywallModal() {
    const m = document.getElementById('paywallModal');
    m.style.opacity = '0';
    setTimeout(() => m.classList.add('hidden'), 400);
}

// ===== GOOGLE SIGN IN =====
function handleGoogleSignIn() {
    const btn = document.querySelector('#authModal button:last-of-type');
    const orig = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-circle-notch animate-spin"></i> Connecting...';
    btn.disabled = true;
    auth.signInWithPopup(provider).then(result => {
        appState.isLoggedIn = true;
        saveState();
        const el = document.getElementById('user-display-name');
        if (el && result.user.displayName) el.textContent = result.user.displayName.split(' ')[0];
        updateUIState();
        closeAuthModal();
        if (appState.pendingWorkspace) {
            openWorkspace(appState.pendingWorkspace);
            appState.pendingWorkspace = null;
        }
        showToast("Signed in successfully!", "cyan");
        btn.innerHTML = orig; btn.disabled = false;
    }).catch(err => {
        console.error(err);
        showToast("Sign-in failed. Try again.", "red");
        btn.innerHTML = orig; btn.disabled = false;
    });
}

// ===== PAYMENT =====
function simulatePayment() {
    const btn = document.querySelector('#paywallModal button:last-of-type');
    btn.innerHTML = '<i class="fa-solid fa-spinner animate-spin mr-2"></i> Processing...';
    btn.disabled = true;
    setTimeout(() => {
        appState.hasPremium = true;
        saveState(); updateUIState();
        closePaywallModal();
        showToast("Premium activated! All restrictions lifted.", "yellow");
    }, 1500);
}

// ===== TAB SWITCHER =====
function switchTab(domain, tabId, btn) {
    const color = domain === 'eee' ? 'cyan' : 'blue';
    document.querySelectorAll('.tab-content-' + domain).forEach(el => el.classList.add('hidden'));
    document.querySelectorAll('.tab-btn-' + domain).forEach(b => {
        b.className = `tab-btn-${domain} w-full text-left p-4 rounded-xl bg-white/5 border border-white/5 text-gray-300 hover:bg-white/10 transition`;
    });
    document.getElementById(domain + '-' + tabId).classList.remove('hidden');
    btn.className = `tab-btn-${domain} w-full text-left p-4 rounded-xl bg-${color}-500/10 border border-${color}-500/30 text-${color}-400 font-medium transition`;
}

// ===== FAQ =====
function toggleFaq(button) {
    const icon = button.querySelector('i');
    const answer = button.nextElementSibling;
    const isOpen = answer.style.maxHeight && answer.style.maxHeight !== '0px';

    document.querySelectorAll('.faq-answer').forEach(el => {
        el.style.maxHeight = '0px';
        const prev = el.previousElementSibling;
        if (prev) { prev.querySelector('i').classList.remove('rotate-180'); prev.parentElement.classList.remove('border-cyan-500/30'); }
    });

    if (!isOpen) {
        answer.style.maxHeight = answer.scrollHeight + 'px';
        icon.classList.add('rotate-180');
        button.parentElement.classList.add('border-cyan-500/30');
    }
}

// ===== CONTACT FORM =====
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    const btn = document.getElementById('submitBtn');
    const txt = document.getElementById('btnText');
    btn.disabled = true; txt.textContent = 'Sending...';
    fetch('https://api.web3forms.com/submit', { method: 'POST', body: new FormData(this) })
        .then(r => r.json())
        .then(d => {
            if (d.success) { this.reset(); showToast("Message sent successfully!", "cyan"); }
            else showToast("Something went wrong. Try again!", "red");
        })
        .catch(() => showToast("Network error!", "red"))
        .finally(() => { btn.disabled = false; txt.textContent = 'Send Message'; });
});

// ===== PRO EDITOR =====
let editorFiles = {
    'index.html': { content: "<!DOCTYPE html>\n<html>\n<head>\n  <title>TechVerse Editor</title>\n  <style>\n    body { font-family: sans-serif; background: #050814; color: #fff; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }\n    h1 { color: #22d3ee; }\n  </style>\n</head>\n<body>\n  <div style='text-align:center'>\n    <h1>Hello TechVerse! 🚀</h1>\n    <p style='color:#9ca3af'>Write code and click Run to see magic.</p>\n  </div>\n</body>\n</html>" },
    'style.css': { content: "/* CSS Styles */\nbody {\n  margin: 0;\n  background: #f8fafc;\n}" },
    'script.js': { content: "// JavaScript\nconsole.log('TechVerse Matrix Online.');" },
    'main.py': { content: "# Python\ndef run():\n    print('Hello from Python Engine')\nrun()" }
};
let activeFile = 'index.html';
try {
    const saved = localStorage.getItem('techverse_pro_files');
    if (saved) { editorFiles = JSON.parse(saved); if (!editorFiles[activeFile]) activeFile = Object.keys(editorFiles)[0]; }
} catch(e) {}

function getFileIcon(f) {
    if (f.endsWith('.html')) return '<i class="fa-brands fa-html5 text-orange-500 w-4"></i>';
    if (f.endsWith('.css')) return '<i class="fa-brands fa-css3-alt text-blue-500 w-4"></i>';
    if (f.endsWith('.js')) return '<i class="fa-brands fa-js text-yellow-400 w-4"></i>';
    if (f.endsWith('.py')) return '<i class="fa-brands fa-python text-blue-400 w-4"></i>';
    return '<i class="fa-solid fa-file-code text-gray-400 w-4"></i>';
}

function renderFileList() {
    const fl = document.getElementById('fileList');
    if (!fl) return;
    fl.innerHTML = '';
    for (let name in editorFiles) {
        const div = document.createElement('div');
        div.className = `file-item flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-xs font-mono transition ${name === activeFile ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`;
        div.innerHTML = `<div class="flex items-center gap-1.5" onclick="switchActiveFile('${name}')">${getFileIcon(name)}<span class="truncate max-w-[90px]">${name}</span></div><div class="file-actions opacity-0 transition-opacity"><button onclick="event.stopPropagation();deleteFile('${name}')" class="text-gray-500 hover:text-red-400 ml-1"><i class="fa-solid fa-xmark"></i></button></div>`;
        fl.appendChild(div);
    }
}

function switchActiveFile(name) {
    if (!editorFiles[name]) return;
    activeFile = name;
    renderFileList();
    const ed = document.getElementById('liveCodeEditor');
    const disp = document.getElementById('activeFileNameDisplay');
    ed.value = editorFiles[name].content;
    disp.innerHTML = `${getFileIcon(name)} ${name}`;
    const colorMap = { '.html': 'text-emerald-400', '.css': 'text-blue-300', '.js': 'text-yellow-300', '.py': 'text-purple-300' };
    const ext = Object.keys(colorMap).find(e => name.endsWith(e)) || '.html';
    ed.className = `flex-grow bg-transparent p-4 pl-3 resize-none outline-none whitespace-pre overflow-auto text-xs sm:text-sm ${colorMap[ext]}`;
    updateLineNumbers();
}

function handleEditorInput() {
    const ed = document.getElementById('liveCodeEditor');
    editorFiles[activeFile].content = ed.value;
    try { localStorage.setItem('techverse_pro_files', JSON.stringify(editorFiles)); } catch(e) {}
    updateLineNumbers();
}

function updateLineNumbers() {
    const ed = document.getElementById('liveCodeEditor');
    const ln = document.getElementById('lineNumbers');
    if (!ed || !ln) return;
    const lines = ed.value.split('\n').length;
    ln.innerHTML = Array.from({length: lines}, (_, i) => i + 1).join('<br>');
}

function syncEditorScroll() {
    const ed = document.getElementById('liveCodeEditor');
    const ln = document.getElementById('lineNumbers');
    if (ln) ln.scrollTop = ed.scrollTop;
}

function createNewFile() {
    const name = prompt("Filename with extension (e.g. app.js, page.html):");
    if (!name || !name.trim()) return;
    if (editorFiles[name.trim()]) { alert("File already exists!"); return; }
    editorFiles[name.trim()] = { content: '' };
    switchActiveFile(name.trim());
}

function deleteFile(name) {
    if (!confirm(`Delete "${name}"?`)) return;
    delete editorFiles[name];
    const keys = Object.keys(editorFiles);
    if (keys.length === 0) { editorFiles['index.html'] = { content: '' }; }
    switchActiveFile(Object.keys(editorFiles)[0]);
}

let isFullScreen = false;
function toggleFullScreenEditor() {
    const box = document.getElementById('editorBox');
    const icon = document.getElementById('fullScreenIcon');
    isFullScreen = !isFullScreen;
    if (isFullScreen) {
        box.style.cssText = 'max-width:100%;max-height:100vh;height:100vh;width:100vw;border-radius:0;border:none;padding:1rem;margin:0;';
        icon.className = 'fa-solid fa-compress';
    } else {
        box.style.cssText = '';
        icon.className = 'fa-solid fa-expand';
    }
}

function clearConsole() { document.getElementById('consoleOutput').innerHTML = ''; }

function logToConsole(msg, type = 'log') {
    const co = document.getElementById('consoleOutput');
    const div = document.createElement('div');
    div.className = type === 'error' ? 'text-red-400' : 'text-gray-300';
    div.textContent = '> ' + msg;
    co.appendChild(div);
    co.scrollTop = co.scrollHeight;
}

window.addEventListener('message', e => {
    if (e.data && e.data.type === 'iframe-log') logToConsole(e.data.message);
});

function triggerEditorAction() {
    if (!appState.hasPremium && appState.editorTrialsUsed >= appState.maxTrials) {
        closeWorkspace('editor'); openModal('paywallModal'); return;
    }
    if (!appState.hasPremium) { appState.editorTrialsUsed++; saveState(); updateUIState(); }

    if (activeFile.endsWith('.py')) {
        logToConsole("Python: backend required for execution.", 'log');
        logToConsole("Simulated: Hello from Python Engine", 'log');
        return;
    }
    const html = editorFiles['index.html']?.content || (activeFile.endsWith('.html') ? editorFiles[activeFile].content : '');
    const css = editorFiles['style.css']?.content || '';
    const js = editorFiles['script.js']?.content || '';

    const combined = `<!DOCTYPE html><html><head><style>${css}</style></head><body>${html}<script>
        const _cl = console.log;
        console.log = (...a) => { window.parent.postMessage({type:'iframe-log',message:a.join(' ')},'*'); _cl(...a); };
        window.onerror = m => window.parent.postMessage({type:'iframe-log',message:'ERR: '+m},'*');
        try { ${js} } catch(e) { console.log('Exception: '+e.message); }
    <\/script></body></html>`;
    clearConsole();
    logToConsole("Compiling and rendering...");
    document.getElementById('livePreview').srcdoc = combined;
}

// ===== EEE BUILDER =====
function generateEEEProject() {
    if (!appState.hasPremium && appState.builderTrialsUsed >= appState.maxTrials) {
        closeWorkspace('eeeBuilder'); openModal('paywallModal'); return;
    }
    const checked = document.querySelectorAll('.eee-comp:checked');
    const out = document.getElementById('eeeOutput');
    if (!checked.length) {
        out.innerHTML = `<div class="h-40 flex flex-col items-center justify-center text-center"><i class="fa-solid fa-circle-exclamation text-4xl mb-3 text-red-400"></i><p class="text-red-400 text-sm">Please select at least one component.</p></div>`;
        return;
    }
    if (!appState.hasPremium) { appState.builderTrialsUsed++; saveState(); updateUIState(); }

    const comps = [...checked].map(c => c.value);
    let code = '';
    if (comps.includes('ESP8266 WiFi')) code += '#include <ESP8266WiFi.h>\n';
    if (comps.includes('Servo Motor')) code += '#include <Servo.h>\nServo myServo;\n';
    if (comps.includes('Ultrasonic Sensor')) code += '#define TRIG_PIN 9\n#define ECHO_PIN 10\n';
    code += '\nvoid setup() {\n  Serial.begin(9600);\n';
    if (comps.includes('Servo Motor')) code += '  myServo.attach(9);\n';
    if (comps.includes('L298N Driver')) code += '  // L298N: IN1=2, IN2=3, IN3=4, IN4=5\n  pinMode(2,OUTPUT); pinMode(3,OUTPUT);\n';
    code += '  // Initialized: ' + comps.join(', ') + '\n}\n\nvoid loop() {\n  // Write hardware logic here\n}';

    out.innerHTML = `
        <div class="mb-4 bg-purple-500/10 border border-purple-500/20 p-3 rounded-lg">
            <span class="text-purple-400 font-semibold text-sm block mb-1">Active Modules:</span>
            <span class="text-white text-xs">${comps.join(' • ')}</span>
        </div>
        <div class="relative p-4 bg-black/50 rounded-xl border border-white/5 font-mono text-xs text-indigo-300 overflow-x-auto group">
            <button onclick="navigator.clipboard.writeText(this.nextElementSibling.textContent).then(()=>showToast('Code copied!','cyan'))" class="absolute top-2 right-2 bg-purple-500/20 hover:bg-purple-500/40 text-purple-300 px-2 py-1 rounded text-[10px] border border-purple-500/30 transition opacity-0 group-hover:opacity-100"><i class="fa-regular fa-copy"></i> Copy</button>
            <code class="whitespace-pre block">${code}</code>
        </div>
        <div class="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-xs flex items-center gap-3">
            <i class="fa-solid fa-circle-check text-xl"></i>
            <div><strong class="block text-sm">Generated Successfully!</strong>Ready for Arduino IDE compilation.</div>
        </div>`;
}

// ===== YEAR =====
const yr = document.getElementById('year');
if (yr) yr.textContent = new Date().getFullYear();

// ===== DRAG MODE RESTORE =====
if (appState.dragMode) toggleDragMode();







//ইনস্টল পপ আপ 

let deferredPrompt;
const smartInstallBtn = document.getElementById('smart-install-btn');

// ১. ব্রাউজার যখন ইনস্টলের জন্য প্রস্তুত হবে, তখন বাটনটি শো করবে
window.addEventListener('beforeinstallprompt', (e) => {
  // ডিফল্ট পপ-আপ বন্ধ রাখা হচ্ছে
  e.preventDefault();
  // ইভেন্টটি সেভ করে রাখা হচ্ছে যাতে পরে কল করা যায়
  deferredPrompt = e;
  // আমাদের কাস্টম বাটনটি ভিজিবল করা হচ্ছে
  smartInstallBtn.style.display = 'block';
});

// ২. বাটনে ক্লিক করলে ইনস্টল পপ-আপ আসবে
smartInstallBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    // সেভ করে রাখা ইভেন্ট থেকে ইনস্টল প্রম্পট কল করা
    deferredPrompt.prompt();
    // ইউজারের সিদ্ধান্তের জন্য অপেক্ষা করা
    const { outcome } = await deferredPrompt.userChoice;
    
    // ইউজার অ্যাক্সেপ্ট করলে বাটনটি হাইড করে দেওয়া
    if (outcome === 'accepted') {
      console.log('App Installed Successfully!');
    }
    
    // প্রম্পট ক্লিয়ার করা
    deferredPrompt = null;
    smartInstallBtn.style.display = 'none';
  }
});

// ৩. অ্যাপটি আগে থেকেই ইনস্টল করা থাকলে বাটনটি হাইড থাকবে
window.addEventListener('appinstalled', () => {
  smartInstallBtn.style.display = 'none';
});
