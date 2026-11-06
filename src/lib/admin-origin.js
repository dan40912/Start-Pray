const UNSAFE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

export function isSameOriginAdminMutation(request) {
  if (!UNSAFE_METHODS.has(request.method)) return true;
  try {
    // In a reverse proxy deployment configure the external, canonical origin.
    // Never trust a caller-provided X-Forwarded-Host to expand accepted origins.
    const configured = process.env.ADMIN_PUBLIC_ORIGIN?.trim();
    const expected = configured
      ? new URL(configured).origin
      : `${new URL(request.url).protocol}//${request.headers.get("host")}`;
    const suppliedOrigin = request.headers.get("origin");
    if (suppliedOrigin) return suppliedOrigin === expected;
    const referer = request.headers.get("referer");
    return Boolean(referer && new URL(referer).origin === expected);
  } catch {
    return false;
  }
}
