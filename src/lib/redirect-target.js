export function resolveSafeNextPath(candidate, fallback = "/me") {
  const fallbackPath =
    typeof fallback === "string" && fallback.startsWith("/") && !fallback.startsWith("//")
      ? fallback
      : "/me";

  if (typeof candidate !== "string") {
    return fallbackPath;
  }

  const trimmed = candidate.trim();
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
    return fallbackPath;
  }

  try {
    const url = new URL(trimmed, "https://startpray.local");
    if (url.origin !== "https://startpray.local") {
      return fallbackPath;
    }
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallbackPath;
  }
}
