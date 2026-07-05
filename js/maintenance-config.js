/* ══════════════════════════════════════════════════════════
   MAINTENANCE MODE — CONFIG
   ------------------------------------------------------------
   This single file controls the entire maintenance system.
   To take the site down, just set MAINTENANCE_MODE: true below.
   To bring the site back online, set MAINTENANCE_MODE: false.
   ══════════════════════════════════════════════════════════ */

window.MAINTENANCE_CONFIG = {
  // Main switch — true means the site is down (shows the Maintenance page)
  MAINTENANCE_MODE: true,

  // Title
  title: "We're Working on a Site Update",

  // Main message
  message: "Tech Verse is currently undergoing updates and improvements. We'll be back soon with an even better experience. Thank you for your patience!",

  // (Optional) Date/time for when the site will return. Leave empty to hide the countdown.
  // Format: "YYYY-MM-DDTHH:mm:ss" (based on your local time)
  eta: "2026-07-19T00:00:00",

  // Contact info (optional) — leave empty to hide this section
  contactEmail: "imran.info.me@gmail.com",

  // Site name/logo text
  siteName: "Tech Verse",

  // How often (in seconds) to automatically check if the site is back online (set to 0 to disable)
  autoCheckSeconds: 15
};