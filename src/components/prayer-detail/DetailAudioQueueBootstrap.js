"use client";

import { useCallback, useEffect, useMemo } from "react";

import { useAudio } from "@/context/AudioContext";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";
import { normalizeAudioUrl } from "@/lib/media-url";

const FALLBACK_SPEAKER = "Anonymous";
const FALLBACK_TITLE = "Prayer Audio";

function normalizePrimaryTrack(track, prayerTitle, homeCardId = null) {
  const voiceUrl = normalizeAudioUrl(track?.voiceUrl);
  if (!voiceUrl) return null;
  return {
    id: track.id ?? "primary-track",
    homeCardId: track.homeCardId ?? homeCardId,
    voiceUrl,
    speaker: track.speaker?.trim() || FALLBACK_SPEAKER,
    message: track.message?.trim() || "",
    avatarUrl: track.avatarUrl?.trim() || "",
    requestTitle: track.requestTitle || prayerTitle || FALLBACK_TITLE,
    coverImage: track.coverImage?.trim() || "",
  };
}

function normalizeResponseTrack(item, index, prayerTitle, fallbackCoverImage = "", homeCardId = null) {
  const voiceUrl = normalizeAudioUrl(item?.voiceUrl);
  if (!voiceUrl) return null;
  const isAnonymous = Boolean(item.isAnonymous);
  return {
    id: item.id ?? `response-${index}`,
    homeCardId: item.homeCardId ?? homeCardId,
    voiceUrl,
    speaker: isAnonymous
      ? FALLBACK_SPEAKER
      : item.responder?.name?.trim() || item.responder?.email?.trim() || FALLBACK_SPEAKER,
    message: item.message?.trim() || "",
    avatarUrl: item.responder?.avatarUrl?.trim() || "",
    requestTitle: prayerTitle || item.card?.title || FALLBACK_TITLE,
    coverImage: item.card?.image?.trim?.() || fallbackCoverImage || "",
  };
}

function isValidResponse(item) {
  if (!item || item.isBlocked) return false;
  return Number(item.reportCount ?? 0) === 0;
}

function dedupeTracks(tracks) {
  const seenIds = new Set();
  const seenVoiceUrls = new Set();
  const output = [];

  for (const track of tracks) {
    if (!track?.voiceUrl) continue;
    if (track.id && seenIds.has(track.id)) continue;
    if (seenVoiceUrls.has(track.voiceUrl)) continue;

    if (track.id) seenIds.add(track.id);
    seenVoiceUrls.add(track.voiceUrl);
    output.push(track);
  }

  return output;
}

export default function DetailAudioQueueBootstrap({
  requestId,
  initialTrack = null,
  prayerTitle = "",
}) {
  const { setQueue, setIsExpanded } = useAudio();

  const primaryTrack = useMemo(
    () => normalizePrimaryTrack(initialTrack, prayerTitle, requestId),
    [initialTrack, prayerTitle, requestId]
  );

  const loadQueue = useCallback(async () => {
    try {
      const response = await fetch(`/api/responses/${requestId}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("Failed to load response tracks.");
      }
      const data = await response.json();

      const responseTracks = Array.isArray(data)
        ? data
            .filter(isValidResponse)
            .map((item, index) =>
              normalizeResponseTrack(item, index, prayerTitle, primaryTrack?.coverImage || "", requestId)
            )
            .filter(Boolean)
        : [];

      const queue = dedupeTracks([primaryTrack, ...responseTracks]);
      // Keep queue available but do not auto start, so global player stays collapsed by default.
      setQueue(queue, -1);
      setIsExpanded(false);
    } catch (error) {
      console.error("DetailAudioQueueBootstrap loadQueue failed", error);
      // Keep primary prayer audio playable even if response API fails.
      const fallbackQueue = primaryTrack ? [primaryTrack] : [];
      setQueue(fallbackQueue, -1);
      setIsExpanded(false);
    }
  }, [requestId, primaryTrack, prayerTitle, setQueue, setIsExpanded]);

  useEffect(() => {
    setIsExpanded(false);
  }, [setIsExpanded]);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onCreated = () => loadQueue();
    window.addEventListener(PRAYER_RESPONSE_CREATED, onCreated);
    return () => window.removeEventListener(PRAYER_RESPONSE_CREATED, onCreated);
  }, [loadQueue]);

  return null;
}
