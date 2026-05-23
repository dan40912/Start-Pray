"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAudio } from "@/context/AudioContext";
import { PRAYER_AUDIO_START_EVENT } from "@/lib/events";

const FALLBACK_SPEAKER = "Prayer Partner";

export default function PrayerAudioPlayer({ requestId, initialTrack = null, prayerTitle = "" }) {
  const { playTrack, setQueue } = useAudio();
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState("");
  const loadingRef = useRef(false);

  const primaryTrack = useMemo(() => {
    if (!initialTrack || !initialTrack.voiceUrl) return null;
    return {
      id: initialTrack.id ?? "primary-track",
      homeCardId: initialTrack.homeCardId ?? requestId,
      voiceUrl: initialTrack.voiceUrl,
      speaker: initialTrack.speaker?.trim() || FALLBACK_SPEAKER,
      message: initialTrack.message?.trim() || "",
      avatarUrl: initialTrack.avatarUrl?.trim() || "",
      responderId: initialTrack.responderId ?? null,
      requestTitle: initialTrack.requestTitle || prayerTitle || "社群禱告",
    };
  }, [initialTrack, prayerTitle, requestId]);

  const fetchResponseTracks = useCallback(async () => {
    const res = await fetch(`/api/responses/${requestId}`, { cache: "no-store" });
    if (!res.ok) {
      throw new Error("無法載入語音清單");
    }
    const data = await res.json();
    return data
      .filter(
        (item) =>
          item?.voiceUrl &&
          !item.isBlocked &&
          Number(item.reportCount ?? 0) === 0
      )
      .map((item, index) => ({
        id: item.id ?? `response-${index}`,
        homeCardId: item.homeCardId ?? requestId,
        voiceUrl: item.voiceUrl,
        speaker: item.isAnonymous
          ? "匿名代禱者"
          : item.responder?.name || item.responder?.username || FALLBACK_SPEAKER,
        message: item.message?.trim() || "",
        avatarUrl: item.responder?.avatarUrl?.trim() || "",
        responderId: item.responderId ?? null,
        requestTitle: prayerTitle || item.card?.title || "社群禱告",
      }));
  }, [requestId, prayerTitle]);

  const handlePlay = useCallback(async () => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    setLoading(true);
    setFeedback("");

    try {
      const queue = [];
      if (primaryTrack) {
        queue.push(primaryTrack);
        playTrack(primaryTrack);
      }

      const responseTracks = await fetchResponseTracks();
      for (const track of responseTracks) {
        if (!queue.find((item) => item.voiceUrl === track.voiceUrl)) {
          queue.push(track);
        }
      }

      if (!queue.length) {
        setFeedback("目前沒有可播放的語音。");
        return;
      }

      setQueue(queue, 0);
    } catch (error) {
      console.error("Failed to load prayer audio queue", error);
      setFeedback("播放失敗，請稍後再試");
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [fetchResponseTracks, playTrack, primaryTrack, setQueue]);

  // Listen for external events (like from Hero "Listen Now" button)
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handleExternalStart = (event) => {
      const targetId = String(event?.detail?.requestId ?? "");
      if (targetId === String(requestId)) {
        handlePlay();
      }
    };
    window.addEventListener(PRAYER_AUDIO_START_EVENT, handleExternalStart);
    return () => window.removeEventListener(PRAYER_AUDIO_START_EVENT, handleExternalStart);
  }, [requestId, handlePlay]);

  return (
    <div className="pray-audio-trigger-wrapper">
      <button
        type="button"
        className="btn btn-primary btn-record"
        onClick={handlePlay}
        aria-busy={loading}
        disabled={loading}
        style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px" }}
      >
        <i className={`fa-solid ${loading ? "fa-spinner fa-spin" : "fa-play"}`} aria-hidden="true"></i>
        <span>{loading ? "載入語音…" : "播放祈禱錄音"}</span>
      </button>
      {feedback ? <p className="player-hint">{feedback}</p> : null}
    </div>
  );
}
