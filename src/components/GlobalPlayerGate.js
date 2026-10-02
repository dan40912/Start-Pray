"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import GlobalPlayer from "@/components/GlobalPlayer";
import { useAudio } from "@/context/AudioContext";
import { getPlayerRouteState, shouldShowPlayer } from "@/lib/player-visibility.mjs";

const DISMISS_KEY = "startpray:player-dismissed";

export default function GlobalPlayerGate() {
  const pathname = usePathname() || "/";
  const { playlist, currentTrack, isPlaying, isCompanion, pause } = useAudio();

  const hasQueue = Array.isArray(playlist) && playlist.length > 0;
  const {
    supported: supportedByRoute,
    blocked: blockedByRoute,
    inPrayerDetail,
  } = getPlayerRouteState(pathname);
  const hasPlaybackState = Boolean(currentTrack) || (inPrayerDetail && hasQueue);

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

  // A previous dismissal must never hide an explicitly reopened or playing player.
  useEffect(() => {
    if (!isPlaying && !isCompanion) return;
    setDismissedKey(null);
    try {
      window.sessionStorage.removeItem(DISMISS_KEY);
    } catch {
      /* Storage is optional. */
    }
  }, [isPlaying, isCompanion]);

  const shouldShowByRoute = shouldShowPlayer({
    supported: supportedByRoute,
    hasPlaybackState,
    dismissedKey,
    trackKey,
    isPlaying,
    isCompanion,
  });

  if (!shouldShowByRoute) {
    return null;
  }

  return <GlobalPlayer onClose={handleClose} />;
}
