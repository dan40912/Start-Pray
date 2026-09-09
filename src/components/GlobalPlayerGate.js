"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import GlobalPlayer from "@/components/GlobalPlayer";
import { useAudio } from "@/context/AudioContext";

const DISMISS_KEY = "startpray:player-dismissed";

function isPath(pathname, target) {
  return pathname === target || pathname.startsWith(`${target}/`);
}

export default function GlobalPlayerGate() {
  const pathname = usePathname() || "/";
  const { playlist, currentTrack, isPlaying, pause } = useAudio();

  const hasQueue = Array.isArray(playlist) && playlist.length > 0;
  // 播放列以前只要「佇列非空」就出現，而首頁與詳情頁一載入就會用
  // setQueue(tracks, -1) 預先鋪好佇列 —— 所以第一次進站、什麼都還沒按，
  // 螢幕底部就已經被一個關不掉的播放列佔掉約 13%，播的還是別張卡的語音。
  // 改成看 currentTrack：預鋪佇列的 index 是 -1，currentTrack 為 null，
  // 要等使用者真的選了一首才會有值。
  const hasPlaybackState = Boolean(currentTrack);
  const inPrayerList = isPath(pathname, "/prayfor");
  const inOvercomer = isPath(pathname, "/overcomer");
  const inCustomerPortal = pathname === "/customer-portal";
  const inGlobalPrayerRoom = isPath(pathname, "/global-prayer-room");
  // Homepage companion mode (docs/obsidian/25-Companion-Mode-Reuse-Audit.md) reuses
  // this same shared queue, so it needs to be on the supported list too — otherwise
  // the effect below immediately pauses any homepage-initiated playback.
  const inHome = pathname === "/" || pathname === "/en";
  const supportedByRoute =
    inPrayerList || inOvercomer || inCustomerPortal || inGlobalPrayerRoom || inHome;

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

  // 使用者按了關閉之後，同一個 session 內不再自動彈回來 —— 除非他自己又去
  // 播了別的東西。
  const trackKey = currentTrack ? currentTrack.src || currentTrack.id || "" : "";
  const [dismissedKey, setDismissedKey] = useState(null);

  useEffect(() => {
    try {
      setDismissedKey(window.sessionStorage.getItem(DISMISS_KEY));
    } catch {
      // 無痕模式或封鎖 storage 時就當作沒關過，播放列照常出現。
    }
  }, []);

  const handleClose = useCallback(() => {
    pause();
    setDismissedKey(trackKey);
    try {
      window.sessionStorage.setItem(DISMISS_KEY, trackKey);
    } catch {
      // 存不進去也沒關係，這一次仍然關得掉。
    }
  }, [pause, trackKey]);

  const shouldShowByRoute =
    supportedByRoute && hasPlaybackState && dismissedKey !== trackKey;

  if (!shouldShowByRoute) {
    return null;
  }

  return <GlobalPlayer onClose={handleClose} />;
}
