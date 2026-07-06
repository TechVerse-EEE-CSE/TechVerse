// ══════════════════════════════════════
//  FLOATING TOOLBAR — js/toolbar.js
//  Add this after editor.js in index.html
// ══════════════════════════════════════

(function () {

  // ── Preset Colors ──
  const PRESETS = [
    '#ffffff','#f8f9fa','#e9ecef','#dee2e6',
    '#adb5bd','#6c757d','#495057','#212529',
    '#ff6b6b','#ff8e53','#feca57','#48dbfb',
    '#ff9ff3','#54a0ff','#5f27cd','#00d2d3',
    '#10c98f','#26de81','#fd9644','#a29bfe',
    '#5b8dee','#7c5cbf','#e84393','#636e72',
    '#0984e3','#00b894','#e17055','#fdcb6e',
    '#2d3436','#0d0f14','#161921','#1e2230',
  ];

  // ── State ──
  let currentColor  = '#5b8dee';
  let currentFormat = 'hex';
  let colorPopupOpen = false;
  let tbCollapsed    = false;

  // ── Init: run once the DOM is ready ──
  document.addEventListener('DOMContentLoaded', initToolbar);

  function initToolbar() {
    buildPresets();
    bindColorPicker();
    bindColorItemClick();
    updateColorDisplay(currentColor);
    createPeekButton(); // ← create the new peek button
  }

  // ── Create the peek button ──
  function createPeekButton() {
    const btn = document.createElement('div');
    btn.id = 'ftbPeekBtn';
    btn.title = 'Show Toolbar';
    btn.innerHTML = `<i class="fa-solid fa-chevron-left"></i>`;
    btn.onclick = function() {
      tbCollapsed = false;
      document.getElementById('floatToolbar').classList.remove('collapsed');
      btn.classList.remove('visible');
    };
    document.body.appendChild(btn);
  }

  // ── Create preset dots ──
  function buildPresets() {
    const container = document.getElementById('colorPresets');
    if (!container) return;
    PRESETS.forEach(hex => {
      const dot = document.createElement('div');
      dot.className = 'color-preset-dot';
      dot.style.background = hex;
      dot.title = hex;
      dot.onclick = () => selectPreset(hex, dot);
      container.appendChild(dot);
    });
  }

  function selectPreset(hex, dotEl) {
    currentColor = hex;
    document.getElementById('colorPickerBig').value = hex;
    updateColorDisplay(hex);
    document.querySelectorAll('.color-preset-dot').forEach(d => d.classList.remove('selected'));
    dotEl.classList.add('selected');
  }

  // ── Color Picker input bind ──
  function bindColorPicker() {
    const picker = document.getElementById('colorPickerBig');
    if (!picker) return;
    picker.addEventListener('input', e => {
      currentColor = e.target.value;
      updateColorDisplay(currentColor);
    });
  }

  // ── Toolbar Color item click → open popup ──
  function bindColorItemClick() {
    const wrap = document.getElementById('ftbColorWrap');
    if (!wrap) return;
    wrap.addEventListener('click', toggleColorPopup);
  }

  // ── Update color display ──
  function updateColorDisplay(hex) {
    const box = document.getElementById('colorPreviewBox');
    if (box) box.style.background = hex;
    const input = document.getElementById('colorValueInput');
    if (input) input.value = formatColor(hex, currentFormat);
  }

  // ── Color format convert ──
  function formatColor(hex, format) {
    const r = parseInt(hex.slice(1,3), 16);
    const g = parseInt(hex.slice(3,5), 16);
    const b = parseInt(hex.slice(5,7), 16);

    if (format === 'rgb') return `rgb(${r}, ${g}, ${b})`;
    if (format === 'hsl') {
      const rn = r/255, gn = g/255, bn = b/255;
      const max = Math.max(rn,gn,bn), min = Math.min(rn,gn,bn);
      let h, s, l = (max+min)/2;
      if (max === min) { h = s = 0; }
      else {
        const d = max - min;
        s = l > 0.5 ? d/(2-max-min) : d/(max+min);
        switch(max) {
          case rn: h = ((gn-bn)/d + (gn<bn?6:0))/6; break;
          case gn: h = ((bn-rn)/d + 2)/6; break;
          default: h = ((rn-gn)/d + 4)/6;
        }
      }
      return `hsl(${Math.round(h*360)}, ${Math.round(s*100)}%, ${Math.round(l*100)}%)`;
    }
    return hex;
  }

  // ── Format tab switch ──
  window.setColorFormat = function(format, btn) {
    currentFormat = format;
    document.querySelectorAll('.cf-tab').forEach(t => t.classList.remove('active'));
    btn.classList.add('active');
    updateColorDisplay(currentColor);
  };

  // ── Color Popup toggle ──
  window.toggleColorPopup = function() {
    colorPopupOpen = !colorPopupOpen;
    document.getElementById('colorPopup').classList.toggle('show', colorPopupOpen);
  };

  window.closeColorPopup = function() {
    colorPopupOpen = false;
    document.getElementById('colorPopup').classList.remove('show');
  };

  document.addEventListener('click', e => {
    if (!e.target.closest('#colorPopup') && !e.target.closest('#ftbColorWrap')) {
      closeColorPopup();
    }
  });

  // ── Copy color value ──
  window.copyColorValue = function() {
    const val = document.getElementById('colorValueInput').value;
    navigator.clipboard.writeText(val).then(() => {
      if (typeof showToast === 'function') showToast('Color copied!', 'success', 'fa-copy');
    });
  };

  // ── Insert color into editor ──
  window.insertColorToEditor = function() {
    const val = document.getElementById('colorValueInput').value;
    if (typeof editor !== 'undefined' && editor) {
      const doc    = editor.getDoc();
      const cursor = doc.getCursor();
      doc.replaceRange(val, cursor);
      editor.focus();
      if (typeof showToast === 'function') showToast(`Inserted: ${val}`, 'success', 'fa-palette');
    } else {
      navigator.clipboard.writeText(val).then(() => {
        if (typeof showToast === 'function') showToast('Copied to clipboard!', 'info', 'fa-copy');
      });
    }
    closeColorPopup();
  };

  // ── Undo ──
  window.ftbUndo = function() {
    if (typeof editor !== 'undefined' && editor) {
      editor.undo();
      if (typeof showToast === 'function') showToast('Undo', 'info', 'fa-rotate-left');
    }
  };

  // ── Redo ──
  window.ftbRedo = function() {
    if (typeof editor !== 'undefined' && editor) {
      editor.redo();
      if (typeof showToast === 'function') showToast('Redo', 'info', 'fa-rotate-right');
    }
  };

  // ── Tab insert ──
  window.ftbTab = function() {
    if (typeof editor !== 'undefined' && editor) {
      const doc    = editor.getDoc();
      const cursor = doc.getCursor();
      doc.replaceRange('    ', cursor);
    }
  };

  // ── Backspace ──
  window.ftbBackspace = function() {
    if (typeof editor !== 'undefined' && editor) {
      editor.execCommand('delCharBefore');
    }
  };

  // ── Toolbar collapse/expand ──
  window.toggleFloatToolbar = function() {
    tbCollapsed = !tbCollapsed;
    document.getElementById('floatToolbar').classList.toggle('collapsed', tbCollapsed);
    // show/hide peek button
    const peek = document.getElementById('ftbPeekBtn');
    if (peek) peek.classList.toggle('visible', tbCollapsed);
    if (tbCollapsed) closeColorPopup();
  };

})();
