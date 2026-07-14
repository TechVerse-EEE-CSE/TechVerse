/* ══════════════════════════════════════════════════════════
   MAINTENANCE MODE — CONFIG
   ------------------------------------------------------------
   This single file controls the entire maintenance system.
   To take the site down, just set MAINTENANCE_MODE: true below.
   To bring the site back online, set MAINTENANCE_MODE: false.
   ══════════════════════════════════════════════════════════ */

window.MAINTENANCE_CONFIG = {
  // Main switch — true means the site is down (shows the Maintenance page)
  MAINTENANCE_MODE: false,

  // Title
  title: "Work is underway to update our website.",

  // Main message
  message: "Work is currently underway to improve our website's speed, so we ask for your patience. Insha'Allah, you will enjoy a better experience using our site, and everything will be made easier.",

  // (Optional) Date/time for when the site will return. Leave empty to hide the countdown.
  // Format: "YYYY-MM-DDTHH:mm:ss" (based on your local time)
  eta: "2026-07-19T12:00:20",

  // Contact info (optional) — leave empty to hide this section
  contactEmail: "imran.info.me@gmail.com",

  // Site name/logo text
  siteName: "Tech Verse",

  // How often (in seconds) to automatically check if the site is back online (set to 0 to disable)
  autoCheckSeconds: 5
};
