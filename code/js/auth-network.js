// ══════════════════════════════════════
//  AUTH NETWORK BACKGROUND — js/auth-network.js
//  Animated constellation of glowing, connected nodes
//  drifting slowly behind the login/register card.
//
//  UPGRADED: crisp retina rendering, mouse-reactive nodes,
//  gradient glow, twinkle variation, smooth fade-in,
//  and a soft cursor-follow highlight halo.
// ══════════════════════════════════════
(function () {
  const NODE_COLORS = ['#5b8dee', '#10c98f', '#7c5cbf', '#22d3ee', '#f59e0b'];
  const NODE_COUNT_DESKTOP = 90;
  const NODE_COUNT_MOBILE  = 55;
  const LINK_DIST          = 150;
  const MOUSE_RADIUS       = 180;   // how far the cursor influence reaches
  const MOUSE_PUSH         = 0.6;   // how strongly nodes drift from the cursor
  const FADE_IN_MS         = 900;

  let canvas, ctx, nodes = [], raf = null, running = false;
  let dpr = 1;
  let mouse = { x: -9999, y: -9999, active: false };
  let startTime = null;

  function init() {
    canvas = document.getElementById('authNetworkCanvas');
    if (!canvas) return;
    ctx = canvas.getContext('2d');
    resize();
    seedNodes();
    window.addEventListener('resize', resize);
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    window.addEventListener('mouseleave', onMouseLeave);
    window.addEventListener('touchmove', onTouchMove, { passive: true });
    window.addEventListener('touchend', onMouseLeave);
    startTime = performance.now();
    start();
  }

  function onMouseMove(e) {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.active = true;
  }

  function onTouchMove(e) {
    if (!e.touches || !e.touches[0]) return;
    mouse.x = e.touches[0].clientX;
    mouse.y = e.touches[0].clientY;
    mouse.active = true;
  }

  function onMouseLeave() {
    mouse.active = false;
  }

  function resize() {
    if (!canvas) return;
    dpr = Math.min(window.devicePixelRatio || 1, 2); // cap DPR for perf
    const w = window.innerWidth;
    const h = window.innerHeight;
    canvas.style.width  = w + 'px';
    canvas.style.height = h + 'px';
    canvas.width  = Math.floor(w * dpr);
    canvas.height = Math.floor(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function cssW() { return canvas.width / dpr; }
  function cssH() { return canvas.height / dpr; }

  function seedNodes() {
    const count = window.innerWidth < 640 ? NODE_COUNT_MOBILE : NODE_COUNT_DESKTOP;
    nodes = Array.from({ length: count }, () => ({
      x: Math.random() * cssW(),
      y: Math.random() * cssH(),
      vx: (Math.random() - 0.5) * 0.25,
      vy: (Math.random() - 0.5) * 0.25,
      r: Math.random() * 1.6 + 1,
      color: NODE_COLORS[Math.floor(Math.random() * NODE_COLORS.length)],
      pulse: Math.random() * Math.PI * 2,
      pulseSpeed: 0.012 + Math.random() * 0.012, // slight variety = less mechanical
      twinkle: Math.random() * Math.PI * 2,
    }));
  }

  function step(now) {
    const w = cssW(), h = cssH();
    ctx.clearRect(0, 0, w, h);

    // Smooth fade-in on first load
    const elapsed = now - startTime;
    const globalAlpha = Math.min(1, elapsed / FADE_IN_MS);

    // Update positions
    for (const n of nodes) {
      // Gentle repulsion from the cursor for a "living" feel
      if (mouse.active) {
        const dx = n.x - mouse.x, dy = n.y - mouse.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < MOUSE_RADIUS && dist > 0.001) {
          const force = (1 - dist / MOUSE_RADIUS) * MOUSE_PUSH;
          n.vx += (dx / dist) * force * 0.02;
          n.vy += (dy / dist) * force * 0.02;
        }
      }

      // Mild drag so velocity doesn't grow unbounded from mouse pushes
      n.vx *= 0.985;
      n.vy *= 0.985;

      n.x += n.vx;
      n.y += n.vy;
      n.pulse += n.pulseSpeed;
      n.twinkle += 0.02;

      if (n.x < -20) n.x = w + 20;
      if (n.x > w + 20) n.x = -20;
      if (n.y < -20) n.y = h + 20;
      if (n.y > h + 20) n.y = -20;
    }

    // Draw links between nearby nodes (gradient + cursor-proximity highlight)
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i], b = nodes[j];
        const dx = a.x - b.x, dy = a.y - b.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < LINK_DIST) {
          let opacity = (1 - dist / LINK_DIST) * 0.35;

          // Boost link brightness near the cursor
          if (mouse.active) {
            const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
            const mdist = Math.hypot(mx - mouse.x, my - mouse.y);
            if (mdist < MOUSE_RADIUS) {
              opacity += (1 - mdist / MOUSE_RADIUS) * 0.25;
            }
          }

          const grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
          grad.addColorStop(0, hexToRgba(a.color, opacity * globalAlpha));
          grad.addColorStop(1, hexToRgba(b.color, opacity * globalAlpha));

          ctx.strokeStyle = grad;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.stroke();
        }
      }
    }

    // Draw nodes with soft glow + twinkle
    for (const n of nodes) {
      const glow = 0.55 + Math.sin(n.pulse) * 0.35;
      const twinkleMul = 0.85 + Math.sin(n.twinkle) * 0.15;

      const outerR = n.r * 3.4 * twinkleMul;
      const glowGrad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, outerR);
      glowGrad.addColorStop(0, hexToRgba(n.color, glow * 0.28 * globalAlpha));
      glowGrad.addColorStop(1, hexToRgba(n.color, 0));

      ctx.beginPath();
      ctx.arc(n.x, n.y, outerR, 0, Math.PI * 2);
      ctx.fillStyle = glowGrad;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(n.x, n.y, n.r * twinkleMul, 0, Math.PI * 2);
      ctx.fillStyle = hexToRgba(n.color, 0.9 * globalAlpha);
      ctx.fill();
    }

    // Soft halo right at the cursor for tactile feedback
    if (mouse.active) {
      const haloGrad = ctx.createRadialGradient(
        mouse.x, mouse.y, 0, mouse.x, mouse.y, MOUSE_RADIUS
      );
      haloGrad.addColorStop(0, `rgba(91,141,238,${0.06 * globalAlpha})`);
      haloGrad.addColorStop(1, 'rgba(91,141,238,0)');
      ctx.beginPath();
      ctx.arc(mouse.x, mouse.y, MOUSE_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = haloGrad;
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
