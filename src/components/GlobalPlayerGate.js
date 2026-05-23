"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

import GlobalPlayer from "@/components/GlobalPlayer";
import { useAudio } from "@/context/AudioContext";

function isPath(pathname, target) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function GlobalPlayerGate() {
  const pathname = usePathname() || "/";
  const { playlist, currentTrack, isPlaying, pause } = useAudio();

  const hasQueue = Array.isArray(playlist) && playlist.length > 0;
  const hasPlaybackState = hasQueue || Boolean(currentTrack);
  const inPrayerList = isPath(pathname, "/prayfor");
  const inOvercomer = isPath(pathname, "/overcomer");
  const inCustomerPortal = pathname === "/customer-portal";
  const inGlobalPrayerRoom = isPath(pathname, "/global-prayer-room");
  const supportedByRoute =
    inPrayerList || inOvercomer || inCustomerPortal || inGlobalPrayerRoom;

  const blockedByRoute =
    isPath(pathname, "/about") ||
    isPath(pathname, "/howto") ||
    isPath(pathname, "/terms") ||
    isPath(pathname, "/whitepaper") ||
    isPath(pathname, "/login") ||
    isPath(pathname, "/signup") ||
    isPath(pathname, "/forgot-password") ||
    isPath(pathname, "/reset-password") ||
    isPath(pathname, "/admin") ||
    isPath(pathname, "/customer-portal/create") ||
    isPath(pathname, "/customer-portal/edit");

  useEffect(() => {
    if (!blockedByRoute && supportedByRoute) return;
    if (!isPlaying) return;
    pause();
  }, [blockedByRoute, isPlaying, pause, supportedByRoute]);

  const shouldShowByRoute = supportedByRoute && hasPlaybackState;

  if (!shouldShowByRoute) {
    return null;
  }

  return <GlobalPlayer />;
}
