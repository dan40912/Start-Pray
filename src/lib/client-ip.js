// Resolves the client IP used for anonymous rate limits and daily IP hashes.
//
// X-Forwarded-For is a comma-separated list that every proxy *appends* to, so
// its leftmost entry is whatever the client chose to send and can be forged
// to dodge per-IP limits. Only entries added by our own proxies are trusted:
// with TRUSTED_PROXY_HOPS=N, the client is the N-th entry from the right.
//   - Nginx only (proxy_add_x_forwarded_for)      → TRUSTED_PROXY_HOPS=1
//   - Cloudflare → Nginx (proxy_add_x_forwarded_for) → TRUSTED_PROXY_HOPS=2
//
// When TRUSTED_PROXY_HOPS is unset the legacy leftmost-entry behaviour is
// kept, so deploying this change never collapses every visitor into one
// shared IP bucket on a proxy setup we have not confirmed. See
// docs/security-hardening.md for how to pick the value.
//
// Kept free of Next.js imports so it stays unit-testable under `node --test`.

function readTrustedProxyHops() {
  const raw = process.env.TRUSTED_PROXY_HOPS?.trim();
  if (!raw) return 0;
  const parsed = Number.parseInt(raw, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

function parseForwardedFor(value) {
  return String(value || "")
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function readClientIp(request) {
  const headers = request.headers;
  const forwarded = parseForwardedFor(headers.get("x-forwarded-for"));
  const hops = readTrustedProxyHops();

  if (hops > 0) {
    // Fewer entries than trusted hops means the request skipped a proxy we
    // expected; the leftmost entry is then the best (and only) candidate.
    const index = Math.max(forwarded.length - hops, 0);
    return forwarded[index] || headers.get("x-real-ip")?.trim() || "unknown";
  }

  return (
    forwarded[0] ||
    headers.get("cf-connecting-ip")?.trim() ||
    headers.get("x-real-ip")?.trim() ||
    "unknown"
  );
}
