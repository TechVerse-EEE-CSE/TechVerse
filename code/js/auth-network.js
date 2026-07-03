// ══════════════════════════════════════
//  AUTH NETWORK BACKGROUND — js/auth-network.js
//  Animated constellation of glowing, connected nodes
//  drifting slowly behind the login/register card.
// ══════════════════════════════════════
(function () {
  const NODE_COLORS = ['#5b8dee', '#10c98f', '#7c5cbf', '#22d3ee', '#f59e0b'];
  const NODE_COUNT_DESKTOP = 90;
  const NODE_COUNT_MOBILE  = 55;
  const LINK_DIST          = 150;

  let canvas, ctx, nodes = [], raf = null, running = false;

  function init() {
    canvas = document.getElementById('authNetworkCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    seedNodes();
    window.addEventListener('resize', resize);
    start();
  }

  function resize() {
    if (!canvas) return;
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function seedNodes() {
    const count = window.innerWidth < 640 ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 1,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
    }));
  }

  function step() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Update positions
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      n.pulse += 0.015;
      if (n.x < -20) n.x = canvas.width + 20;
      if (n.x > canvas.width + 20) n.x = -20;
      if (n.y < -20) n.y = canvas.height + 20;
      if (n.y > canvas.height + 20) n.y = -20;
    }

    // Draw links between nearby nodes
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          const opacity = (1 - dist / LINK_DIST) * 0.35;
          ctx.strokeStyle = `rgba(91,141,238,${opacity})`;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes with soft glow
    for (const n of nodes) {
      const glow = 0.55 + Math.sin(n.pulse) * 0.35;
      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * 3, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(n.color, glow * 0.15);
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(n.color, 0.85);
      ctx.fill();
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
