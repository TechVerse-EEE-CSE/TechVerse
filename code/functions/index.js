// ══════════════════════════════════════════════════════════════
//  Cloud Functions — Tech Verse
//  "One sign-in method per account, forever" enforcement.
//
//  Why this needs to live server-side (and can't be done in client
//  JS alone): Firebase's password-reset flow lets anyone who can
//  read a verification email add a password credential to *any*
//  account with that email — even one that was created with Google
//  or GitHub only. That's intentional (it's an account-recovery
//  feature), but it defeats a strict "one method, no exceptions"
//  rule. The only bypass-proof place to stop it is at the moment of
//  sign-in itself, using Identity Platform Blocking Functions —
//  because even a modified/malicious client can't skip a server-side
//  check that Firebase Auth itself runs before issuing a session.
// ══════════════════════════════════════════════════════════════

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { beforeUserCreated, beforeUserSignedIn } = require("firebase-functions/v2/identity");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const logger = require("firebase-functions/logger");

initializeApp();

const PROVIDER_LABELS = {
  "password": "email/password",
  "google.com": "Google",
  "github.com": "GitHub",
};

function labelFor(providerId) {
  return PROVIDER_LABELS[providerId] || providerId;
}

// The provider actually being used in this specific auth event.
function eventProviderId(event) {
  if (event.credential && event.credential.providerId) return event.credential.providerId;
  const providers = (event.data && event.data.providerData) || [];
  return providers.length ? providers[0].providerId : null;
}

// ══════════════════════════════════════
//  1) beforeUserCreated
//     Every brand-new Firebase user gets tagged with the ONE provider
//     it's allowed to ever sign in with again.
// ══════════════════════════════════════
exports.tagPrimaryProvider = beforeUserCreated((event) => {
  const providerId = eventProviderId(event) || "password";
  logger.info(`New user ${event.data.uid} tagged with primaryProvider=${providerId}`);
  return {
    customClaims: { primaryProvider: providerId },
  };
});

// ══════════════════════════════════════
//  2) beforeUserSignedIn
//     Runs on EVERY sign-in (password, Google, GitHub — all of them),
//     right before Firebase issues the session. If the provider being
//     used isn't the account's tagged primaryProvider, the sign-in is
//     rejected here — this is what actually makes the rule
//     unbypassable, regardless of how a password credential ended up
//     attached to the account.
// ══════════════════════════════════════
exports.enforceSingleProvider = beforeUserSignedIn((event) => {
  const usedProvider = eventProviderId(event);
  const claims = event.data.customClaims || {};
  const primaryProvider = claims.primaryProvider;

  // Accounts that existed before this feature was deployed have no tag
  // yet. Tag them now with whatever they're currently using (their
  // long-standing habit becomes the locked-in method going forward)
  // instead of locking existing users out.
  if (!primaryProvider) {
    return { customClaims: { ...claims, primaryProvider: usedProvider } };
  }

  if (usedProvider && usedProvider !== primaryProvider) {
    throw new HttpsError(
      "permission-denied",
      `This account was created with ${labelFor(primaryProvider)}. Please sign in with ${labelFor(primaryProvider)} instead.`
    );
  }
});

// ══════════════════════════════════════
//  3) checkAccountBeforePasswordReset (callable)
//     Called by the client BEFORE sendPasswordResetEmail, purely for a
//     clear, immediate message — so a Google/GitHub-only user isn't
//     sent a reset email that (thanks to #2 above) could never
//     actually be used to sign in anyway.
// ══════════════════════════════════════
exports.checkAccountBeforePasswordReset = onCall(async (request) => {
  const email = ((request.data && request.data.email) || "").trim();
  if (!email) throw new HttpsError("invalid-argument", "Email is required.");

  try {
    const user = await getAuth().getUserByEmail(email);
    const primaryProvider = user.customClaims && user.customClaims.primaryProvider;

    if (primaryProvider && primaryProvider !== "password") {
      return {
        allowed: false,
        message: `This account was created with ${labelFor(primaryProvider)}. Please sign in with ${labelFor(primaryProvider)} instead — password reset isn't available for this account.`,
      };
    }
    return { allowed: true };
  } catch (err) {
    if (err.code === "auth/user-not-found") {
      // Don't reveal whether the account exists — same response shape as
      // "allowed", so this endpoint isn't usable to enumerate emails.
      // sendPasswordResetEmail's own enumeration-safe behavior takes it
      // from here.
      return { allowed: true };
    }
    logger.error("checkAccountBeforePasswordReset error:", err);
    throw new HttpsError("internal", "Something went wrong. Please try again.");
  }
});
