// ══════════════════════════════════════
//  AUTH NETWORK BACKGROUND — js/auth-network.js
//  A dense, living neural constellation: glowing neurons,
//  synapses, traveling signal pulses, and soft depth parallax —
//  spatially-indexed AND sprite-cached so it stays smooth even
//  at high node counts.
//
//  PERFORMANCE NOTE: the original version created a brand-new
//  CanvasGradient object for every link and every node on every
//  single frame (hundreds of allocations/sec), plus used
//  ctx.shadowBlur (one of the most expensive canvas operations)
//  on every node and signal. That combination was the main cause
//  of site-wide slowness. This version pre-renders the glow as
//  small offscreen "sprites" once, then just drawImage()s them
//  per frame — same look, far less CPU/GPU work. Node counts are
//  unchanged.
// ══════════════════════════════════════
(function () {
  const NODE_COLORS = ['#5b8dee', '#10c98f', '#7c5cbf', '#22d3ee', '#f59e0b', '#ec4899', '#3b82f6'];
  const NODE_COUNT_DESKTOP = 340;
  const NODE_COUNT_TABLET  = 220;
  const NODE_COUNT_MOBILE  = 130;
  const LINK_DIST          = 150;
  const MOUSE_RADIUS       = 190;
  const SIGNAL_SPAWN_CHANCE = 0.035; // per frame, chance to fire a new traveling signal
  const MAX_SIGNALS        = 26;

  let canvas, ctx, nodes = [], links = [], signals = [];
  let raf = null, running = false, lastT = 0;
  let mouse = { x: -9999, y: -9999, active: false };
  let grid = new Map(), cellSize = LINK_DIST;

  // ── Pre-rendered glow sprites (one per node color) ──
  // Built once, reused every frame via drawImage instead of
  // calling createRadialGradient() hundreds of times per frame.
  const SPRITE_SIZE = 128;
  const glowSprites = {};
  function buildGlowSprites() {
    for (const color of NODE_COLORS) {
      const s = document.createElement('canvas');
      s.width = SPRITE_SIZE; s.height = SPRITE_SIZE;
      const sctx = s.getContext('2d');
      const r = SPRITE_SIZE / 2;
      const grad = sctx.createRadialGradient(r, r, 0, r, r, r);
      grad.addColorStop(0, hexToRgba(color, 1));
      grad.addColorStop(1, hexToRgba(color, 0));
      sctx.fillStyle = grad;
      sctx.beginPath();
      sctx.arc(r, r, r, 0, Math.PI * 2);
      sctx.fill();
      glowSprites[color] = s;
    }
  }

  // ── Pre-mixed solid colors for every color-pair, so links use
  // a cheap solid strokeStyle + globalAlpha instead of a fresh
  // CanvasGradient every frame (gradient coords can't be cached
  // since node positions move, but a mixed color can be) ──
  const mixCache = {};
  function mixedColor(colorA, colorB) {
    const key = colorA < colorB ? colorA + colorB : colorB + colorA;
    if (mixCache[key]) return mixCache[key];
    const a = hexToRgb(colorA), b = hexToRgb(colorB);
    const mixed = `rgb(${(a.r + b.r) >> 1},${(a.g + b.g) >> 1},${(a.b + b.b) >> 1})`;
    mixCache[key] = mixed;
    return mixed;
  }

  function init() {
    canvas = document.getElementById('authNetworkCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    buildGlowSprites();
    resize();
    seedNodes();
    window.addEventListener('resize', onResize);
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    });
    window.addEventListener('mouseleave', () => { mouse.active = false; });
    start();
  }

  let resizeT = null;
  function onResize() {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => { resize(); seedNodes(); }, 120);
  }

  function resize() {
    if (!canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width  = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width  = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function nodeCount() {
    const w = window.innerWidth;
    if (w < 640) return NODE_COUNT_MOBILE;
    if (w < 1100) return NODE_COUNT_TABLET;
    return NODE_COUNT_DESKTOP;
  }

  function seedNodes() {
    const w = window.innerWidth, h = window.innerHeight;
    const count = nodeCount();
    nodes = Array.from({ length: count }, () => {
      const depth = 0.45 + Math.random() * 1.05; // parallax depth: 0.45 (far) .. 1.5 (near)
      return {
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.26 * depth,
        vy: (Math.random() - 0.5) * 0.26 * depth,
        r: (Math.random() * 1.5 + 0.8) * depth,
        depth,
        color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
        pulse: Math.random() * Math.PI * 2,
        pulseSpeed: 0.011 + Math.random() * 0.016,
        twinkle: Math.random() < 0.16,
      };
    });
    signals = [];
  }

  // ── Spatial grid so neighbor search stays fast even with 300+ nodes ──
  function buildGrid() {
    grid.clear();
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const cx = Math.floor(n.x / cellSize), cy = Math.floor(n.y / cellSize);
      const key = cx + ',' + cy;
      if (!grid.has(key)) grid.set(key, []);
      grid.get(key).push(i);
    }
  }

  function forEachNeighbor(i, cb) {
    const n = nodes[i];
    const cx = Math.floor(n.x / cellSize), cy = Math.floor(n.y / cellSize);
    for (let gx = cx - 1; gx <= cx + 1; gx++) {
      for (let gy = cy - 1; gy <= cy + 1; gy++) {
        const bucket = grid.get(gx + ',' + gy);
        if (!bucket) continue;
        for (const j of bucket) if (j > i) cb(j);
      }
    }
  }

  function step(t) {
    const dt = lastT ? Math.min((t - lastT) / 16.67, 2.5) : 1;
    lastT = t;
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Update neuron positions
    for (const n of nodes) {
      n.x += n.vx * dt;
      n.y += n.vy * dt;
      n.pulse += n.pulseSpeed * dt;

      if (mouse.active) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_RADIUS && d > 0.01) {
          const force = (1 - d / MOUSE_RADIUS) * 0.045 * n.depth;
          n.vx += (dx / d) * force;
          n.vy += (dy / d) * force;
        }
      }
      n.vx *= 0.985;
      n.vy *= 0.985;

      if (n.x < -20) n.x = w + 20;
      if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      if (n.y > h + 20) n.y = -20;
    }

    buildGrid();

    // Draw synapses: a cheap solid mixed-color stroke (opacity via
    // globalAlpha) instead of allocating a fresh CanvasGradient per
    // link every frame — visually near-identical, much lighter.
    links.length = 0;
    ctx.lineCap = 'round';
    for (let i = 0; i < nodes.length; i++) {
      forEachNeighbor(i, (j) => {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const tt = 1 - dist / LINK_DIST;
          const depthAvg = (a.depth + b.depth) / 2;
          const opacity = tt * tt * 0.55 * depthAvg;
          ctx.strokeStyle = mixedColor(a.color, b.color);
          ctx.globalAlpha = opacity;
          ctx.lineWidth = (0.6 + tt * 0.9) * depthAvg;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
          links.push([i, j, dist]);
        }
      });
    }
    ctx.globalAlpha = 1;

    // Occasionally fire a traveling signal pulse along a live synapse —
    // gives the network a genuine "thinking" / data-flow feel.
    if (links.length && signals.length < MAX_SIGNALS && Math.random() < SIGNAL_SPAWN_CHANCE) {
      const [i, j] = links[(Math.random() * links.length) | 0];
      signals.push({ i, j, tPos: 0, speed: 0.012 + Math.random() * 0.014 });
    }

    // Draw + advance signals (plain filled circle, no shadowBlur)
    for (let k = signals.length - 1; k >= 0; k--) {
      const s = signals[k];
      s.tPos += s.speed * dt;
      if (s.tPos >= 1 || !nodes[s.i] || !nodes[s.j]) { signals.splice(k, 1); continue; }
      const a = nodes[s.i], b = nodes[s.j];
      const dx = a.x - b.x, dy = a.y - b.y;
      if (Math.sqrt(dx * dx + dy * dy) > LINK_DIST * 1.4) { signals.splice(k, 1); continue; }
      const px = a.x + (b.x - a.x) * s.tPos;
      const py = a.y + (b.y - a.y) * s.tPos;
      const fade = Math.sin(s.tPos * Math.PI); // fade in/out along the path
      const sprite = glowSprites[a.color];
      const sr = (2.1 * fade + 0.4) * 4; // sprite draw radius, glow-boosted
      ctx.globalAlpha = 0.85 * fade;
      ctx.drawImage(sprite, px - sr, py - sr, sr * 2, sr * 2);
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.arc(px, py, 2.1 * fade + 0.4, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
    }

    // Draw neurons: sprite-based glow (drawImage, cached) + a plain
    // filled core. No per-node gradient allocation, no shadowBlur.
    for (const n of nodes) {
      const base = 0.55 + Math.sin(n.pulse) * 0.35;
      const glow = n.twinkle ? Math.min(1, base + 0.25) : base;

      const outerR = n.r * (n.twinkle ? 5.2 : 3.6);
      const sprite = glowSprites[n.color];
      ctx.globalAlpha = glow * 0.38 * n.depth;
      ctx.drawImage(sprite, n.x - outerR, n.y - outerR, outerR * 2, outerR * 2);
      ctx.globalAlpha = 1;

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(n.color, 0.75 + 0.2 * n.depth);
      ctx.fill();
    }

    if (running) raf = requestAnimationFrame(step);
  }

  function hexToRgb(hex) {
    const v = hex.replace('#', '');
    return {
      r: parseInt(v.substring(0, 2), 16),
      g: parseInt(v.substring(2, 4), 16),
      b: parseInt(v.substring(4, 6), 16),
    };
  }

  function hexToRgba(hex, a) {
    const c = hexToRgb(hex);
    return `rgba(${c.r},${c.g},${c.b},${a})`;
  }

  function start() {
    if (running) return;
    running = true;
    lastT = 0;
    raf = requestAnimationFrame(step);
  }

  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
  }

  // Pause when the tab/screen is hidden to save battery/CPU.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stop(); else start();
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposed so auth.js can stop this loop the moment the user logs in
  // (authScreen becomes display:none) and restart it when auth screen
  // is shown again — otherwise it keeps computing 340 nodes/frame
  // forever in the background, slowing down the whole app.
  window.AuthNetworkBG = { start, stop };
})();
