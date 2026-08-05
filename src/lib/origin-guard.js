// Shared same-origin check for the anonymous, cookie-authenticated POST
// endpoints (/api/responses, /api/prayer-response/report,
// /api/home-cards/[id]/prayed) — see docs/obsidian/19-Security-Review.md
// "CSRF／Origin／CORS". Confirmed via a real request (not assumed) that this
// app's own fetch() calls send an Origin header matching the request's Host
// on same-origin POSTs, so comparing the two is a reliable, dependency-free
// CSRF mitigation without needing a token scheme.
//
// Kept free of any Next.js import (deliberately not importing NextResponse
// here) so this stays unit-testable under plain `node --test`, which cannot
// resolve extensionless "next/server" outside Next's own build. Callers
// build their own NextResponse.json(...) rejection — they already import
// NextResponse anyway.
//
// Production host allowlist comes from ALLOWED_ORIGINS (comma-separated),
// never hardcoded here. Unset in local dev — falls back to "Origin's host
// must equal the request's own Host header", which is exactly true for
// same-origin requests and false for a page on another domain trying to
// submit against this API.
function getAllowedOrigins() {
  const configured = process.env.ALLOWED_ORIGINS;
  if (!configured) return null;
  return configured
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

export function isTrustedOrigin(request) {
  const origin = request.headers.get("origin");
  // No Origin header at all: same-origin GETs/simple requests can omit it,
  // but real browsers reliably send it for fetch() POSTs (verified against
  // this app itself). Treat a missing Origin as untrusted for POST safety
  // rather than guessing why it's absent.
  if (!origin) return false;

  const allowed = getAllowedOrigins();
  if (allowed) return allowed.includes(origin);

  const host = request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
