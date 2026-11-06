"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { BROWSER_COOKIE, VISIT_COOKIE, pageType, trafficSource } from "@/lib/analytics-shared.mjs";

function cookieValue(name) {
  return document.cookie.split("; ").find((part) => part.startsWith(name + "="))?.split("=")[1];
}

function setCookie(name, value, maxAge) {
  const secure = location.protocol === "https:" ? "; Secure" : "";
  document.cookie = name + "=" + value + "; Max-Age=" + maxAge + "; Path=/; SameSite=Lax" + secure;
}

export default function AnalyticsTracker() {
  const pathname = usePathname();
  const lastPath = useRef(null);

  useEffect(() => {
    if (lastPath.current === pathname) return;
    const initialLoad = lastPath.current === null;
    lastPath.current = pathname;
    const page = pageType(pathname);
    if (!page || navigator.globalPrivacyControl || navigator.doNotTrack === "1" || !crypto.randomUUID) return;

    const browser = cookieValue(BROWSER_COOKIE);
    const visit = (browser && cookieValue(VISIT_COOKIE)) || crypto.randomUUID();
    if (!browser) setCookie(BROWSER_COOKIE, crypto.randomUUID(), 90 * 86400);
    setCookie(VISIT_COOKIE, visit, 1800);

    fetch("/api/analytics", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        page,
        source: trafficSource(new URL(location.href), initialLoad ? document.referrer : ""),
      }),
    }).catch(() => {});
  }, [pathname]);

  return null;
}
