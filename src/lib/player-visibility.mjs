export function getPlayerRouteState(pathname = "/") {
  const path = pathname.replace(/^\/en(?=\/|$)/, "") || "/";
  const isPath = (target) => path === target || path.startsWith(`${target}/`);
  const blocked = [
    "/about",
    "/howto",
    "/terms",
    "/whitepaper",
    "/login",
    "/signup",
    "/forgot-password",
    "/reset-password",
    "/admin",
    "/me/create",
    "/me/edit",
  ].some(isPath);
  const supported =
    path === "/" ||
    path === "/me" ||
    ["/prayfor", "/overcomer", "/global-prayer-room"].some(isPath);
  return { blocked, supported, inPrayerDetail: /^\/prayfor\/[^/]+$/.test(path) };
}

export function shouldShowPlayer({
  supported,
  hasPlaybackState,
  dismissedKey,
  trackKey,
  isPlaying,
  isCompanion,
}) {
  return supported && hasPlaybackState && (isPlaying || isCompanion || dismissedKey !== trackKey);
}
