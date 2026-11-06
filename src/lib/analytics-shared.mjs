export const BROWSER_COOKIE = "sp_analytics_browser";
export const VISIT_COOKIE = "sp_analytics_visit";

export const PAGE_TYPES = [
  "home", "wall", "prayer", "create", "signup", "room", "stories", "story",
];

export const SOURCES = [
  "direct", "threads", "instagram", "facebook", "line", "search", "church", "other",
];

export function pageType(pathname) {
  const path = pathname.replace(/^\/en(?=\/|$)/, "").replace(/\/$/, "");
  if (!path) return "home";
  if (path === "/prayfor") return "wall";
  if (/^\/prayfor\/(?:\d+|one)$/.test(path)) return "prayer";
  if (path === "/me/create") return "create";
  if (path === "/signup") return "signup";
  if (path === "/global-prayer-room") return "room";
  if (path === "/overcomer") return "stories";
  if (/^\/overcomer\/[^/]+$/.test(path)) return "story";
  return null;
}

export function trafficSource(currentUrl, referrer) {
  const utm = currentUrl.searchParams.get("utm_source")?.toLowerCase();
  if (utm && utm !== "direct" && SOURCES.includes(utm)) return utm;
  if (!referrer) return utm ? "other" : "direct";
  try {
    const url = new URL(referrer);
    if (url.origin === currentUrl.origin) return utm ? "other" : "direct";
    const host = url.hostname.replace(/^(www|l|m)\./, "");
    if (["threads.net", "threads.com"].includes(host)) return "threads";
    if (host === "instagram.com") return "instagram";
    if (host === "facebook.com" || host === "fb.com") return "facebook";
    if (["line.me", "line-apps.com"].includes(host)) return "line";
    if (/^google\.[a-z]{2,3}(\.[a-z]{2})?$/.test(host) ||
        ["bing.com", "search.yahoo.com", "duckduckgo.com"].includes(host)) return "search";
  } catch {
    return "other";
  }
  return "other";
}
