/* ══════════════════════════════════════════════════════════
   WHAT'S NEW — CONFIG
   ------------------------------------------------------------
   This file controls the "What's New" popup that greets each
   user once, right after they log in — usually right after you
   finish an update / come back from maintenance mode.

   HOW TO USE:
   1. Bump the "version" string below to anything new (e.g. the
      date, or "v2"). Every user who has NOT seen this exact
      version will see the popup once, the next time they log in.
   2. Edit the "title", "subtitle" and "updates" list with
      whatever you changed.
   3. Set ENABLED to false if you want to turn the popup off
      completely without deleting your update list.

   You never need to touch whatsnew.js — just this file.
   ══════════════════════════════════════════════════════════ */

window.WHATSNEW_CONFIG = {
  // Master switch
  ENABLED: true,

  // Bump this on every release so the popup shows again for everyone.
  // Anything works: "2026-07-06", "v4", "release-14"...
  version: "00.02.04",

  // Small eyebrow label above the title
  badge: "Our New version added",

  // Headline
  title: "Tech Verse just got better",

  // Short supporting line under the headline
  subtitle: "Here's what we improved while you were away.",

  // The list of updates. "icon" is any Font Awesome class.
  updates: [
    {
      icon: "fa-solid fa-shield-halved",
      title: "Stronger security",
      description: "We added extra protection across the platform to keep your account and projects safer."
    },
    {
      icon: "fa-solid fa-rocket",
      title: "Faster & smoother",
      description: "Pages load quicker and the editor feels snappier overall."
    },
    {   
      icon: "fa-solid fa-wand-magic-sparkles",
      title: "Polished Experience",
      description: "Refined toolbar design with usability improvements and a smoother overall experience."
   }
  ],

  // Button text
  ctaText: "Got it, thanks!",

  // Optional footer note (leave empty string to hide)
  footerNote: "Tech Verse EEE & CSE"
};
