"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { useAudio } from "@/context/AudioContext";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";
import { normalizeAudioUrl } from "@/lib/media-url";

// 把一則語音回應轉成共用播放佇列吃的形狀（id + voiceUrl 是硬性需求，
// 見 AudioContext 的 getTrackKey/sanitizeTrack）。requestTitle 會顯示在
// 陪伴模式的卡片抬頭上 —— 聽的人要知道自己在為「哪一件事」禱告。
function toTrack(response, { anonymousLabel, prayerTitle, coverImage }) {
  const voiceUrl = normalizeAudioUrl(response?.voiceUrl);
  if (!voiceUrl) return null;
  const isAnonymous = Boolean(response.isAnonymous);
  return {
    id: response.id,
    voiceUrl,
    message: response.message?.trim() || "",
    speaker: isAnonymous
      ? anonymousLabel
      : response.responder?.name?.trim() || anonymousLabel,
    avatarUrl: isAnonymous
      ? response.anonymousAvatarUrl?.trim() || ""
      : response.responder?.avatarUrl?.trim() || "",
    requestTitle: prayerTitle || response.card?.title || anonymousLabel,
    coverImage: response.card?.image?.trim?.() || coverImage || "",
  };
}

// Shared state/behavior for "record a response to this Prayer" + "listen to
// others' responses", reused by both HomePrayerHero (homepage) and
// DetailPrayerInteractionPanel (/prayfor/[id]) — see
// docs/obsidian/27-Shared-Prayer-Interaction-Audit.md. Page-specific concerns
// (homepage swipe/adjacent-prayer navigation, detail-page mobile ordering)
// stay in each page's own component; only the genuinely-shared parts live here.
export function usePrayerInteraction(prayerId) {
  const [recorderActive, setRecorderActive] = useState(false);
  const [recorderState, setRecorderState] = useState(null);
  const [playableResponses, setPlayableResponses] = useState([]);

  // 陪伴模式沒有自己的播放器了。它就是共用佇列 + GlobalPlayer 的沉浸呈現 ——
  // 首頁與 /prayfor/[id] 因此拿到同一套播放體驗，而不是兩份長得不一樣的清單。
  const { isCompanion, setIsCompanion, setQueue, setIsExpanded, pause } = useAudio();

  const recorderRef = useRef(null);
  const requestGenerationRef = useRef(0);

  const fetchPlayableResponses = () => {
    if (!prayerId) {
      setPlayableResponses([]);
      return;
    }
    const generation = ++requestGenerationRef.current;
    fetch(`/api/responses/${prayerId}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (generation !== requestGenerationRef.current) return;
        setPlayableResponses(Array.isArray(data) ? data.filter((item) => item.voiceUrl) : []);
      })
      .catch(() => {
        if (generation !== requestGenerationRef.current) return;
        setPlayableResponses([]);
      });
  };

  useEffect(() => {
    fetchPlayableResponses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerId]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onCreated = () => fetchPlayableResponses();
    window.addEventListener(PRAYER_RESPONSE_CREATED, onCreated);
    return () => window.removeEventListener(PRAYER_RESPONSE_CREATED, onCreated);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayerId]);

  const openCompanion = useCallback(
    ({ anonymousLabel = "", prayerTitle = "", coverImage = "" } = {}) => {
      const tracks = playableResponses
        .map((response) => toTrack(response, { anonymousLabel, prayerTitle, coverImage }))
        .filter(Boolean);
      if (!tracks.length) return;
      setIsCompanion(true);
      setQueue(tracks, 0);
      // setQueue 會順手把播放清單展開；陪伴模式一進來就先把清單收起來，
      // 讓人先聽見聲音，想看清單再自己打開。
      setIsExpanded(false);
    },
    [playableResponses, setIsCompanion, setIsExpanded, setQueue]
  );

  // 離開陪伴模式 = 收回底部那條播放列，不是把佇列丟掉。聲音停下來，但剛剛在聽的
  // 那幾則還在，想再聽一次不必重新進一次陪伴模式；播放列上的 × 才是真的關掉。
  const closeCompanion = useCallback(() => {
    setIsCompanion(false);
    setIsExpanded(false);
    pause();
  }, [pause, setIsCompanion, setIsExpanded]);

  const openRecorder = () => setRecorderActive(true);

  const closeRecorder = () => {
    setRecorderActive(false);
    setRecorderState(null);
  };

  const discardRecorder = () => {
    recorderRef.current?.discard?.();
    closeRecorder();
  };

  return {
    recorderRef,
    recorderActive,
    recorderState,
    setRecorderState,
    openRecorder,
    closeRecorder,
    discardRecorder,
    companionOpen: isCompanion,
    openCompanion,
    closeCompanion,
    playableResponses,
    hasCompanionEntry: playableResponses.length > 0,
  };
}
