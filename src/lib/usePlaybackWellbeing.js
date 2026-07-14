"use client";

// PRD-003 — 重複播放的心理健康防護
// 純前端、不上傳任何資料。偵測「同一段禱告語音」的連續重播次數與累計播放時間,
// 達門檻時讓呼叫端顯示一張溫和的關懷卡。絕不暫停 / 限制播放。

import { useCallback, useEffect, useRef, useState } from "react";
import { useAudio } from "@/context/AudioContext";

// 門檻常數(集中於此,方便日後調整)
export const REPEAT_THRESHOLD = 5; // 同一段連播次數
export const TOTAL_SECONDS_THRESHOLD = 900; // 累計播放秒數(15 分鐘)
const PROGRESS_REWIND_EPSILON = 2; // 進度回退超過此秒數視為一次重播
const MAX_PROGRESS_DELTA = 60; // 單次 timeupdate 正常增量上限,超過視為 seek,不累計
const SESSION_KEY = "sp_wellbeing_dismissed";

function trackKeyOf(track) {
  if (!track) return null;
  if (track.id !== undefined && track.id !== null) return `id:${track.id}`;
  if (track.voiceUrl) return `url:${track.voiceUrl}`;
  return null;
}

function readDismissedForever() {
  if (typeof window === "undefined") return false;
  try {
    return window.sessionStorage.getItem(SESSION_KEY) === "1";
  } catch {
    return false;
  }
}

function writeDismissedForever() {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(SESSION_KEY, "1");
  } catch {
    /* sessionStorage 不可用時靜默忽略 */
  }
}

export default function usePlaybackWellbeing() {
  const { currentTrack, progress } = useAudio();
  const trackKey = trackKeyOf(currentTrack);

  const [repeatCount, setRepeatCount] = useState(0);
  const [totalSeconds, setTotalSeconds] = useState(0);
  const [promptVisible, setPromptVisible] = useState(false);
  const [dismissedForever, setDismissedForever] = useState(false);

  const lastKeyRef = useRef(null);
  const lastProgressRef = useRef(0);
  const nextRepeatRef = useRef(REPEAT_THRESHOLD);
  const nextSecondsRef = useRef(TOTAL_SECONDS_THRESHOLD);

  // 初始化:讀取本 session 是否已選擇「不再顯示」
  useEffect(() => {
    setDismissedForever(readDismissedForever());
  }, []);

  // 切換到不同語音時重置計數(保留 dismissedForever)
  useEffect(() => {
    if (trackKey !== lastKeyRef.current) {
      lastKeyRef.current = trackKey;
      lastProgressRef.current = 0;
      setRepeatCount(0);
      setTotalSeconds(0);
      nextRepeatRef.current = REPEAT_THRESHOLD;
      nextSecondsRef.current = TOTAL_SECONDS_THRESHOLD;
      setPromptVisible(false);
    }
  }, [trackKey]);

  // 累計播放時間與重播次數
  useEffect(() => {
    if (!trackKey) return;
    const last = lastProgressRef.current;
    const value = Number.isFinite(progress) ? progress : 0;
    if (value > last) {
      const delta = value - last;
      if (delta > 0 && delta < MAX_PROGRESS_DELTA) {
        setTotalSeconds((seconds) => seconds + delta);
      }
    } else if (last - value > PROGRESS_REWIND_EPSILON) {
      // 進度回到起點 = 一次重播(含單曲循環)
      setRepeatCount((count) => count + 1);
    }
    lastProgressRef.current = value;
  }, [progress, trackKey]);

  // 是否達門檻
  useEffect(() => {
    if (dismissedForever) return;
    if (repeatCount >= nextRepeatRef.current || totalSeconds >= nextSecondsRef.current) {
      setPromptVisible(true);
    }
  }, [repeatCount, totalSeconds, dismissedForever]);

  const dismiss = useCallback(() => {
    // 關閉當前提醒,並把下次觸發門檻往後推一個級距
    setPromptVisible(false);
    nextRepeatRef.current = repeatCount + REPEAT_THRESHOLD;
    nextSecondsRef.current = totalSeconds + TOTAL_SECONDS_THRESHOLD;
  }, [repeatCount, totalSeconds]);

  const dismissForever = useCallback(() => {
    setPromptVisible(false);
    setDismissedForever(true);
    writeDismissedForever();
  }, []);

  return {
    repeatCount,
    totalSeconds,
    shouldPrompt: promptVisible && !dismissedForever,
    dismiss,
    dismissForever,
  };
}
