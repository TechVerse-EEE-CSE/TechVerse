// ══════════════════════════════════════
//  AUTH NETWORK BACKGROUND — js/auth-network.js
//  Animated constellation of glowing, connected neurons
//  drifting slowly behind the login/register card.
// ══════════════════════════════════════
(function () {
  const NODE_COLORS = ['#5b8dee', '#10c98f', '#7c5cbf', '#22d3ee', '#f59e0b', '#ec4899', '#3b82f6'];
  const NODE_COUNT_DESKTOP = 220;
  const NODE_COUNT_TABLET  = 140;
  const NODE_COUNT_MOBILE  = 90;
  const LINK_DIST          = 165;
  const MOUSE_RADIUS       = 180;

  let canvas, ctx, nodes = [], raf = null, running = false;
  let mouse = { x: -9999, y: -9999, active: false };

  function init() {
    canvas = document.getElementById('authNetworkCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    seedNodes();
    window.addEventListener('resize', () => { resize(); seedNodes(); });
    window.addEventListener('mousemove', (e) => {
      mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true;
    });
    window.addEventListener('mouseleave', () => { mouse.active = false; });
    start();
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
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.28,
      vy: (Math.random() - 0.5) * 0.28,
      r: Math.random() * 1.8 + 0.9,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.012 + Math.random() * 0.014,
      twinkle: Math.random() < 0.18, // a subset of neurons "fire" brighter
    }));
  }

  function step() {
    const w = window.innerWidth, h = window.innerHeight;
    ctx.clearRect(0, 0, w, h);

    // Update positions
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += n.pulseSpeed;

      // gentle attraction/repulsion near the cursor for an "alive" feel
      if (mouse.active) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const d = Math.sqrt(dx * dx + dy * dy);
        if (d < MOUSE_RADIUS && d > 0.01) {
          const force = (1 - d / MOUSE_RADIUS) * 0.04;
          n.vx += (dx / d) * force;
          n.vy += (dy / d) * force;
        }
      }
      // gentle damping so speeds stay calm
      n.vx *= 0.985;
      n.vy *= 0.985;

      if (n.x < -20) n.x = w + 20;
      if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      if (n.y > h + 20) n.y = -20;
    }

    // Draw synapse links between nearby neurons, colored as a blend
    // of the two endpoint colors for a richer, layered look.
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const t = 1 - dist / LINK_DIST;
          const opacity = t * t * 0.5;
          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, hexToRgba(a.color, opacity));
          grad.addColorStop(1, hexToRgba(b.color, opacity));
          ctx.strokeStyle = grad;
          ctx.lineWidth = 0.8 + t * 0.7;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw neurons: soft outer glow + bright core, with occasional
    // brighter "firing" flicker for a smarter, more alive network feel.
    for (const n of nodes) {
      const base = 0.55 + Math.sin(n.pulse) * 0.35;
      const glow = n.twinkle ? Math.min(1, base + 0.25) : base;

      const outerR = n.r * (n.twinkle ? 5 : 3.5);
      const radial = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, outerR);
      radial.addColorStop(0, hexToRgba(n.color, glow * 0.35));
      radial.addColorStop(1, hexToRgba(n.color, 0));
      ctx.beginPath();
      ctx.arc(n.x, n.y, outerR, 0, Math.PI * 2);
      ctx.fillStyle = radial;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(n.color, 0.9);
      ctx.shadowColor = n.color;
      ctx.shadowBlur = n.twinkle ? 12 : 6;
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    if (running) raf = requestAnimationFrame(step);
  }

  function hexToRgba(hex, a) {
    const v = hex.replace('#', '');
    const r = parseInt(v.substring(0, 2), 16);
    const g = parseInt(v.substring(2, 4), 16);
    const b = parseInt(v.substring(4, 6), 16);
    return `rgba(${r},${g},${b},${a})`;
  }

  function start() {
    if (running) return;
    running = true;
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
})();
