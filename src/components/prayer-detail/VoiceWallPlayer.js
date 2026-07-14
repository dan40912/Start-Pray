"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";
import { useAudio } from "@/context/AudioContext";

function formatTime(seconds) {
  const safe = Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
  const mins = Math.floor(safe / 60)
    .toString()
    .padStart(2, "0");
  const secs = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function normalizeDuration(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function normalizePrimaryTrack(track, prayerTitle, homeCardId = null) {
  if (!track?.voiceUrl) return null;
  return {
    id: track.id || "primary-track",
    homeCardId: track.homeCardId ?? homeCardId,
    voiceUrl: track.voiceUrl,
    speaker: track.speaker?.trim() || "上傳者",
    message: track.message?.trim() || "",
    avatarUrl: track.avatarUrl?.trim() || "",
    requestTitle: track.requestTitle || prayerTitle || "禱告錄音",
    isPrimary: true,
  };
}

function normalizeResponseTrack(item, index, prayerTitle, homeCardId = null) {
  if (!item?.voiceUrl) return null;
  const isAnonymous = Boolean(item.isAnonymous);
  const speaker = isAnonymous
    ? "匿名代禱者"
    : item.responder?.name || item.responder?.username || `回應者 ${index + 1}`;
  return {
    id: `response-${item.id ?? index}`,
    homeCardId: item.homeCardId ?? homeCardId,
    voiceUrl: item.voiceUrl,
    speaker,
    message: item.message?.trim() || "",
    avatarUrl: isAnonymous
      ? item.anonymousAvatarUrl?.trim() || ""
      : item.responder?.avatarUrl?.trim() || "",
    requestTitle: prayerTitle || "禱告錄音",
    isPrimary: false,
  };
}

function isValidResponse(item) {
  if (!item || item.isBlocked) return false;
  return Number(item.reportCount ?? 0) === 0;
}

export default function VoiceWallPlayer({ requestId, prayerTitle = "", initialTrack = null }) {
  const { setQueue } = useAudio();
  const audioRef = useRef(null);
  const [allTracks, setAllTracks] = useState(() => {
    const primary = normalizePrimaryTrack(initialTrack, prayerTitle, requestId);
    return primary ? [primary] : [];
  });
  const [excludedMap, setExcludedMap] = useState({});
  const [currentId, setCurrentId] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [trackDurations, setTrackDurations] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const pendingSeekRef = useRef(null);
  const probingKeysRef = useRef(new Set());
  const trackDurationsRef = useRef({});

  const loadTracks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/responses/${requestId}`, { cache: "no-store" });
      if (!res.ok) throw new Error("無法載入語音清單");
      const data = await res.json();

      const primary = normalizePrimaryTrack(initialTrack, prayerTitle, requestId);
      const responses = Array.isArray(data)
        ? data
            .filter(isValidResponse)
            .map((item, index) => normalizeResponseTrack(item, index, prayerTitle, requestId))
            .filter(Boolean)
        : [];
      setAllTracks(primary ? [primary, ...responses] : responses);
    } catch (fetchError) {
      console.error("VoiceWallPlayer loadTracks failed", fetchError);
      setError("語音清單載入失敗，請稍後再試。");
    } finally {
      setLoading(false);
    }
  }, [requestId, initialTrack, prayerTitle]);

  useEffect(() => {
    loadTracks();
  }, [loadTracks]);

  useEffect(() => {
    // Detail page should only play this card's voice content.
    setQueue([], -1);
  }, [setQueue]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const onResponseCreated = () => {
      loadTracks();
    };
    window.addEventListener(PRAYER_RESPONSE_CREATED, onResponseCreated);
    return () => window.removeEventListener(PRAYER_RESPONSE_CREATED, onResponseCreated);
  }, [loadTracks]);

  const playableTracks = useMemo(
    () => allTracks.filter((track) => !excludedMap[track.id]),
    [allTracks, excludedMap]
  );

  const setDurationForTrack = useCallback((trackId, seconds) => {
    if (!trackId) return;
    const normalized = normalizeDuration(seconds);
    setTrackDurations((prev) => {
      if (Object.prototype.hasOwnProperty.call(prev, trackId) && prev[trackId] === normalized) {
        return prev;
      }
      return { ...prev, [trackId]: normalized };
    });
  }, []);

  useEffect(() => {
    trackDurationsRef.current = trackDurations;
  }, [trackDurations]);

  useEffect(() => {
    if (typeof window === "undefined" || !allTracks.length) return undefined;

    const cleanups = [];

    allTracks.forEach((track) => {
      if (!track?.id || !track.voiceUrl) return;
      if (Object.prototype.hasOwnProperty.call(trackDurationsRef.current, track.id)) return;
      if (probingKeysRef.current.has(track.id)) return;

      probingKeysRef.current.add(track.id);
      const probe = new Audio();
      probe.preload = "metadata";

      const finish = (seconds) => {
        setDurationForTrack(track.id, seconds);
        probingKeysRef.current.delete(track.id);
        probe.removeEventListener("loadedmetadata", onMetadata);
        probe.removeEventListener("error", onError);
      };

      const onMetadata = () => finish(probe.duration);
      const onError = () => finish(0);

      probe.addEventListener("loadedmetadata", onMetadata);
      probe.addEventListener("error", onError);
      probe.src = track.voiceUrl;
      probe.load();

      cleanups.push(() => {
        probingKeysRef.current.delete(track.id);
        probe.removeEventListener("loadedmetadata", onMetadata);
        probe.removeEventListener("error", onError);
      });
    });

    return () => {
      cleanups.forEach((clean) => clean());
    };
  }, [allTracks, setDurationForTrack]);

  useEffect(() => {
    if (!playableTracks.length) {
      setCurrentId(null);
      setIsPlaying(false);
      return;
    }
    if (!currentId || !playableTracks.some((track) => track.id === currentId)) {
      setCurrentId(playableTracks[0].id);
      setProgress(0);
      setDuration(0);
    }
  }, [playableTracks, currentId]);

  const currentTrack = useMemo(
    () => playableTracks.find((track) => track.id === currentId) || null,
    [playableTracks, currentId]
  );
  const currentTrackId = currentTrack?.id || null;
  const currentTrackVoiceUrl = currentTrack?.voiceUrl || "";
  const currentTrackKnownDuration = currentTrackId
    ? normalizeDuration(trackDurations[currentTrackId])
    : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackId || !currentTrackVoiceUrl) return;
    audio.src = currentTrackVoiceUrl;
    audio.load();
    setProgress(0);
    setDuration(currentTrackKnownDuration);
  }, [currentTrackId, currentTrackVoiceUrl, currentTrackKnownDuration]);

  useEffect(() => {
    if (!currentTrackId) return;
    if (currentTrackKnownDuration > 0) {
      setDuration(currentTrackKnownDuration);
    }
  }, [currentTrackId, currentTrackKnownDuration]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !currentTrackId) return;
    if (isPlaying) {
      audio
        .play()
        .then(() => setIsPlaying(true))
        .catch(() => setIsPlaying(false));
    } else {
      audio.pause();
    }
  }, [isPlaying, currentTrackId]);

  const playNextTrack = useCallback(() => {
    if (!playableTracks.length || !currentTrack) {
      setIsPlaying(false);
      return;
    }
    const index = playableTracks.findIndex((track) => track.id === currentTrack.id);
    if (index === -1) {
      setCurrentId(playableTracks[0].id);
      return;
    }
    const nextTrack = playableTracks[index + 1];
    if (!nextTrack) {
      setIsPlaying(false);
      return;
    }
    setCurrentId(nextTrack.id);
    setIsPlaying(true);
  }, [playableTracks, currentTrack]);

  const totalDuration = useMemo(
    () =>
      playableTracks.reduce(
        (sum, track) => sum + normalizeDuration(trackDurations[track.id]),
        0
      ),
    [playableTracks, trackDurations]
  );

  const queueProgress = useMemo(() => {
    if (!currentTrack) return 0;
    let elapsed = 0;
    for (const track of playableTracks) {
      const knownDuration = normalizeDuration(trackDurations[track.id]);
      if (track.id === currentTrack.id) {
        const currentDuration = knownDuration > 0 ? knownDuration : normalizeDuration(duration);
        elapsed += currentDuration > 0 ? Math.min(progress, currentDuration) : Math.max(progress, 0);
        break;
      }
      elapsed += knownDuration;
    }
    return elapsed;
  }, [currentTrack, duration, playableTracks, progress, trackDurations]);

  const effectiveDuration = Math.max(totalDuration, queueProgress, normalizeDuration(duration));
  const canPlay = playableTracks.length > 0 && effectiveDuration > 0;

  const handleTogglePlay = () => {
    if (!currentTrack) return;
    setIsPlaying((prev) => !prev);
  };

  const handleTrackSelect = (trackId) => {
    setCurrentId(trackId);
    setIsPlaying(true);
  };

  const handleExcludeToggle = (trackId) => {
    setExcludedMap((prev) => ({
      ...prev,
      [trackId]: !prev[trackId],
    }));
  };

  const handleSeek = (event) => {
    const audio = audioRef.current;
    if (!audio || !playableTracks.length || effectiveDuration <= 0) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    const target = ratio * effectiveDuration;

    let accumulated = 0;
    let targetTrack = null;
    let targetOffset = 0;

    for (const track of playableTracks) {
      const trackDuration = normalizeDuration(trackDurations[track.id]);
      if (trackDuration <= 0) continue;
      const nextAccumulated = accumulated + trackDuration;
      if (target <= nextAccumulated) {
        targetTrack = track;
        targetOffset = Math.min(Math.max(target - accumulated, 0), trackDuration);
        break;
      }
      accumulated = nextAccumulated;
    }

    if (!targetTrack) return;

    if (currentTrack?.id !== targetTrack.id) {
      pendingSeekRef.current = targetOffset;
      setCurrentId(targetTrack.id);
      return;
    }

    audio.currentTime = targetOffset;
    setProgress(targetOffset);
  };

  const onTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextProgress = normalizeDuration(audio.currentTime);
    const nextDuration = normalizeDuration(audio.duration);
    setProgress(nextProgress);
    if (nextDuration > 0) {
      setDuration(nextDuration);
      if (currentTrack?.id) {
        setDurationForTrack(currentTrack.id, nextDuration);
      }
    }
  };

  const onLoadedMetadata = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const nextDuration = normalizeDuration(audio.duration);
    setDuration(nextDuration);
    if (currentTrack?.id) {
      setDurationForTrack(currentTrack.id, nextDuration);
    }
    if (pendingSeekRef.current !== null) {
      const nextTime = nextDuration > 0
        ? Math.min(Math.max(pendingSeekRef.current, 0), nextDuration)
        : Math.max(pendingSeekRef.current, 0);
      audio.currentTime = nextTime;
      setProgress(nextTime);
      pendingSeekRef.current = null;
    }
  };

  const onEnded = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (isRepeat) {
      audio.currentTime = 0;
      audio.play().catch(() => setIsPlaying(false));
      return;
    }
    playNextTrack();
  };

  const progressPercent =
    effectiveDuration > 0 ? Math.min((queueProgress / effectiveDuration) * 100, 100) : 0;
  const excludedCount = allTracks.length - playableTracks.length;

  return (
    <div className={`pdv2-player ${isExpanded ? "is-expanded" : ""}`}>
      <audio
        ref={audioRef}
        onTimeUpdate={onTimeUpdate}
        onLoadedMetadata={onLoadedMetadata}
        onEnded={onEnded}
      />

      <div className="pdv2-player__top">
        <button
          type="button"
          className="pdv2-player__expand-btn"
          onClick={() => setIsExpanded((prev) => !prev)}
          aria-expanded={isExpanded}
          aria-label={isExpanded ? "收合語音清單" : "展開語音清單"}
        >
          <i className={`fa-solid ${isExpanded ? "fa-chevron-down" : "fa-chevron-up"}`} />
        </button>

        <div className="pdv2-player__summary">
          <strong>{currentTrack?.speaker || "尚無可播放語音"}</strong>
          <span>{currentTrack?.message || prayerTitle || "請選擇語音"}</span>
        </div>

        <div className="pdv2-player__controls">
          <button
            type="button"
            className="pdv2-player__control"
            onClick={handleTogglePlay}
            disabled={!canPlay}
            aria-label={isPlaying ? "Pause" : "Play"}
          >
            <i className={`fa-solid ${isPlaying ? "fa-pause" : "fa-play"}`} />
          </button>
          <button
            type="button"
            className={`pdv2-player__control ${isRepeat ? "is-active" : ""}`}
            onClick={() => setIsRepeat((prev) => !prev)}
            aria-label="Repeat"
          >
            <i className="fa-solid fa-repeat" />
          </button>
        </div>
      </div>

      <div className="pdv2-player__progress" role="presentation" onClick={handleSeek}>
        <div className="pdv2-player__progress-fill" style={{ width: `${progressPercent}%` }} />
      </div>

      <div className="pdv2-player__time">
        <span>{formatTime(queueProgress)}</span>
        <span>{formatTime(effectiveDuration)}</span>
      </div>

      {isExpanded ? (
        <div className="pdv2-player__queue">
          <div className="pdv2-player__queue-head">
            <strong>語音清單</strong>
            <span>{excludedCount > 0 ? `已排除 ${excludedCount} 則` : "全部可播放"}</span>
          </div>

          {loading ? <p className="pdv2-player__hint">載入清單中...</p> : null}
          {error ? <p className="pdv2-player__hint pdv2-player__hint--error">{error}</p> : null}
          {!loading && !error && allTracks.length === 0 ? (
            <p className="pdv2-player__hint">目前沒有可播放錄音</p>
          ) : null}

          <ul className="pdv2-player__queue-list">
            {allTracks.map((track, index) => {
              const isExcluded = Boolean(excludedMap[track.id]);
              const isCurrent = currentTrack?.id === track.id && !isExcluded;
              return (
                <li
                  key={track.id}
                  className={`pdv2-player__queue-item ${isCurrent ? "is-current" : ""} ${
                    isExcluded ? "is-excluded" : ""
                  }`}
                >
                  <label className="pdv2-player__exclude">
                    <input
                      type="checkbox"
                      checked={isExcluded}
                      onChange={() => handleExcludeToggle(track.id)}
                    />
                    <span>排除</span>
                  </label>

                  <button
                    type="button"
                    className="pdv2-player__queue-track"
                    onClick={() => handleTrackSelect(track.id)}
                    disabled={isExcluded}
                  >
                    <strong>
                      {track.isPrimary ? "原始錄音" : `回應 ${index + 1}`} · {track.speaker}
                    </strong>
                    <span>{track.message || "無文字內容"}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
