"use client";

import { useEffect, useRef, useState } from "react";

import { PRAYER_RESPONSE_CREATED } from "@/lib/events";

// Shared state/behavior for "record a response to this Prayer" + "listen to
// others' responses", reused by both HomePrayerHero (homepage) and
// DetailPrayerInteractionPanel (/prayfor/[id]) — see
// docs/obsidian/27-Shared-Prayer-Interaction-Audit.md. Page-specific concerns
// (homepage swipe/adjacent-prayer navigation, detail-page mobile ordering)
// stay in each page's own component; only the genuinely-shared parts live here.
export function usePrayerInteraction(prayerId) {
  const [recorderActive, setRecorderActive] = useState(false);
  const [recorderState, setRecorderState] = useState(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [playableResponses, setPlayableResponses] = useState([]);

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
    companionOpen,
    openCompanion: () => setCompanionOpen(true),
    closeCompanion: () => setCompanionOpen(false),
    playableResponses,
    hasCompanionEntry: playableResponses.length > 0,
  };
}
