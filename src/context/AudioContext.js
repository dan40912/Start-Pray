"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { normalizeAudioUrl } from "@/lib/media-url";
import { attachPlaybackGain } from "@/lib/audio-gain";

const AudioContext = createContext(null);
const hasOwn = Object.prototype.hasOwnProperty;
const END_EPSILON_SECONDS = 0.12;
const PLAYBACK_TIMEOUT_MS = 12000;
const AUDIO_DEBUG_TAG = "[AudioContext]";

function logAudioDebug(event, details = {}) {
  console.log(`${AUDIO_DEBUG_TAG} ${event}`, details);
}

function getTrackKey(track) {
  if (!track) return null;
  if (track.id !== undefined && track.id !== null) return `id:${track.id}`;
  const voiceUrl = normalizeAudioUrl(track.voiceUrl);
  if (voiceUrl) return `url:${voiceUrl}`;
  return null;
}

function normalizeDuration(value) {
  if (!Number.isFinite(value) || value < 0) return 0;
  return value;
}

function isTrackAtEnd(audio) {
  if (!audio) return false;
  const total = normalizeDuration(audio.duration);
  if (total <= 0) return false;
  const current = normalizeDuration(audio.currentTime);
  return current >= Math.max(total - END_EPSILON_SECONDS, 0);
}

function clampTrackSeekOffset(value, trackDuration, allowTrackEnd = false) {
  const safeDuration = normalizeDuration(trackDuration);
  if (safeDuration <= 0) return Math.max(value, 0);
  const bounded = Math.min(Math.max(value, 0), safeDuration);
  if (allowTrackEnd) return bounded;
  return Math.min(bounded, Math.max(safeDuration - END_EPSILON_SECONDS, 0));
}

function sanitizeTrack(track) {
  if (!track) return null;
  const voiceUrl = normalizeAudioUrl(track.voiceUrl);
  if (!voiceUrl) return null;
  return { ...track, voiceUrl };
}

function shouldSkipToNextTrackOnPlayFailure(error) {
  const name = String(error?.name || "");
  const message = String(error?.message || "").toLowerCase();
  if (name === "NotSupportedError") return true;
  if (message.includes("not supported")) return true;
  if (message.includes("no supported source")) return true;
  if (message.includes("decode")) return true;
  if (message.includes("media error")) return true;
  if (message.includes("load")) return true;
  if (message.includes("network")) return true;
  if (message.includes("timeout")) return true;
  return false;
}

function buildTrackLabel(track) {
  if (!track) return "未知音檔";
  return (
    track.speaker?.trim() ||
    track.requestTitle?.trim() ||
    track.message?.trim() ||
    "未知音檔"
  );
}

function buildSkipNotice(track) {
  return `已自動跳過無法播放的音檔：${buildTrackLabel(track)}`;
}

export function AudioProvider({ children }) {
  const [playlist, setPlaylist] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isQueueEnded, setIsQueueEnded] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  // 陪伴模式：使用者是從「聆聽大家的禱告」進來的，不是順手播一則。
  // 這個旗標決定 GlobalPlayer 要用沉浸的整頁樣子，還是底部那條播放列 ——
  // 兩者是同一個播放器的兩種呈現，不是兩個播放器。
  const [isCompanion, setIsCompanion] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isLoop, setIsLoop] = useState(false);
  const [trackDurations, setTrackDurations] = useState({});
  const [isRecovering, setIsRecovering] = useState(false);
  const [endedReason, setEndedReason] = useState(null);
  const [playbackNotice, setPlaybackNotice] = useState(null);
  const [failedTrackKeys, setFailedTrackKeys] = useState([]);
  const [lastSkippedTrack, setLastSkippedTrack] = useState(null);

  const audioRef = useRef(null);
  const playlistRef = useRef([]);
  const currentIndexRef = useRef(-1);
  const isLoopRef = useRef(false);
  const trackDurationsRef = useRef({});
  const failedTrackKeysRef = useRef(new Set());
  const pendingSeekRef = useRef(null);
  const probingKeysRef = useRef(new Set());
  const shouldAutoPlayRef = useRef(false);
  const loadedTrackKeyRef = useRef(null);
  const skipAutoPlayEffectRef = useRef(false);
  const playbackTimeoutRef = useRef(null);
  const playAttemptIdRef = useRef(0);
  const failureHandlingKeyRef = useRef(null);
  // Optional pause (in ms) inserted between tracks when the current one finishes
  // naturally, before the queue auto-advances to the next one. Defaults to 0 (the
  // existing instant-advance behaviour used everywhere on the site). Consumers such
  // as the companion overlay can opt into a longer gap via setAutoAdvanceDelay().
  const autoAdvanceDelayMsRef = useRef(0);
  const advanceDelayTimeoutRef = useRef(null);
  const [isAdvancingQueue, setIsAdvancingQueue] = useState(false);

  const clearPlaybackNotice = useCallback(() => {
    setPlaybackNotice(null);
  }, []);

  const pushPlaybackNotice = useCallback((type, message, track = null) => {
    setPlaybackNotice({
      type,
      message,
      trackKey: getTrackKey(track),
      createdAt: Date.now(),
    });
  }, []);

  const commitFailedTrackKeys = useCallback((updater) => {
    const current = Array.from(failedTrackKeysRef.current);
    const nextValue =
      typeof updater === "function" ? updater(current) : updater;
    const normalized = Array.from(
      new Set((Array.isArray(nextValue) ? nextValue : []).filter(Boolean))
    );
    failedTrackKeysRef.current = new Set(normalized);
    setFailedTrackKeys(normalized);
    return normalized;
  }, []);

  const clearTrackFailure = useCallback(
    (track) => {
      const key = getTrackKey(track);
      if (!key) return;
      commitFailedTrackKeys((prev) => prev.filter((item) => item !== key));
    },
    [commitFailedTrackKeys]
  );

  const markTrackFailed = useCallback(
    (track) => {
      const key = getTrackKey(track);
      if (!key) return;
      commitFailedTrackKeys((prev) =>
        prev.includes(key) ? prev : [...prev, key]
      );
    },
    [commitFailedTrackKeys]
  );

  const resetPlaybackFailures = useCallback(() => {
    failureHandlingKeyRef.current = null;
    failedTrackKeysRef.current = new Set();
    setFailedTrackKeys([]);
    setLastSkippedTrack(null);
  }, []);

  const syncFailedTrackKeysWithQueue = useCallback(
    (tracks) => {
      const validKeys = new Set(
        (Array.isArray(tracks) ? tracks : [])
          .map((track) => getTrackKey(track))
          .filter(Boolean)
      );
      commitFailedTrackKeys((prev) => prev.filter((key) => validKeys.has(key)));
    },
    [commitFailedTrackKeys]
  );

  const setDurationForTrack = useCallback((track, seconds) => {
    const key = getTrackKey(track);
    if (!key) return;
    const normalized = normalizeDuration(seconds);
    setTrackDurations((prev) => {
      if (hasOwn.call(prev, key) && prev[key] === normalized) return prev;
      return { ...prev, [key]: normalized };
    });
  }, []);

  const clearPlaybackAttemptTimeout = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
  }, []);

  const invalidatePlaybackAttempt = useCallback(() => {
    playAttemptIdRef.current += 1;
    clearPlaybackAttemptTimeout();
    return playAttemptIdRef.current;
  }, [clearPlaybackAttemptTimeout]);

  const clearAdvanceDelayTimeout = useCallback(() => {
    if (advanceDelayTimeoutRef.current) {
      clearTimeout(advanceDelayTimeoutRef.current);
      advanceDelayTimeoutRef.current = null;
    }
    setIsAdvancingQueue(false);
  }, []);

  const setAutoAdvanceDelay = useCallback((ms) => {
    autoAdvanceDelayMsRef.current = Math.max(0, Number(ms) || 0);
  }, []);

  const finishQueue = useCallback(
    (reason, noticeMessage = "", noticeType = "info") => {
      const audio = audioRef.current;
      invalidatePlaybackAttempt();
      shouldAutoPlayRef.current = false;
      skipAutoPlayEffectRef.current = false;
      if (audio) {
        audio.pause();
      }
      setIsPlaying(false);
      setIsRecovering(false);
      setIsQueueEnded(true);
      setEndedReason(reason);
      if (noticeMessage) {
        pushPlaybackNotice(noticeType, noticeMessage);
      }
      logAudioDebug("播放結束:標記完成", {
        reason,
        currentIndex: currentIndexRef.current,
        queueSize: playlistRef.current.length,
      });
    },
    [invalidatePlaybackAttempt, pushPlaybackNotice]
  );

  const stopAndResetAudio = useCallback(() => {
    const audio = audioRef.current;
    invalidatePlaybackAttempt();
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
      audio.removeAttribute("src");
      audio.load();
    }
    shouldAutoPlayRef.current = false;
    skipAutoPlayEffectRef.current = false;
    loadedTrackKeyRef.current = null;
    pendingSeekRef.current = null;
    failureHandlingKeyRef.current = null;
    setIsPlaying(false);
    setIsRecovering(false);
    setIsQueueEnded(false);
    setEndedReason(null);
    setProgress(0);
    setDuration(0);
    clearPlaybackNotice();
    resetPlaybackFailures();
  }, [clearPlaybackNotice, invalidatePlaybackAttempt, resetPlaybackFailures]);

  const findFirstPlayableIndex = useCallback((tracks = playlistRef.current) => {
    for (let index = 0; index < tracks.length; index += 1) {
      const track = sanitizeTrack(tracks[index]);
      const key = getTrackKey(track);
      if (!track || !key) continue;
      if (failedTrackKeysRef.current.has(key)) continue;
      return index;
    }
    return -1;
  }, []);

  const findNextPlayableIndex = useCallback(
    (startIndex, { allowLoop = false, tracks = playlistRef.current } = {}) => {
      const total = tracks.length;
      if (total === 0) return -1;
      const maxSteps = allowLoop ? total : Math.max(total - startIndex - 1, 0);
      for (let step = 1; step <= maxSteps; step += 1) {
        let candidate = startIndex + step;
        if (allowLoop) {
          candidate = ((candidate % total) + total) % total;
        } else if (candidate >= total) {
          break;
        }
        const track = sanitizeTrack(tracks[candidate]);
        const key = getTrackKey(track);
        if (!track || !key) continue;
        if (failedTrackKeysRef.current.has(key)) continue;
        return candidate;
      }
      return -1;
    },
    []
  );

  const findPrevPlayableIndex = useCallback((startIndex, { tracks = playlistRef.current } = {}) => {
    for (let candidate = startIndex - 1; candidate >= 0; candidate -= 1) {
      const track = sanitizeTrack(tracks[candidate]);
      const key = getTrackKey(track);
      if (!track || !key) continue;
      if (failedTrackKeysRef.current.has(key)) continue;
      return candidate;
    }
    return -1;
  }, []);

  const handleTrackPlaybackFailure = useCallback(
    (track, error, source = "未知來源") => {
      const audio = audioRef.current;
      const failedTrack = sanitizeTrack(track) || track;
      const failedKey = getTrackKey(failedTrack);
      if (!failedKey) {
        logAudioDebug("音檔失敗:缺少可辨識鍵值", { source });
        finishQueue("all_failed", "可播放音檔已全部跳過，要重新嘗試嗎？", "warning");
        return;
      }
      if (failureHandlingKeyRef.current === failedKey) {
        logAudioDebug("音檔失敗:忽略重複處理", { source, failedKey });
        return;
      }

      failureHandlingKeyRef.current = failedKey;
      invalidatePlaybackAttempt();
      if (audio) {
        audio.pause();
      }

      markTrackFailed(failedTrack);
      setLastSkippedTrack(failedTrack);
      setIsPlaying(false);
      setIsRecovering(true);
      setIsQueueEnded(false);
      setEndedReason(null);
      pushPlaybackNotice("warning", buildSkipNotice(failedTrack), failedTrack);

      const nextIndex = findNextPlayableIndex(currentIndexRef.current, {
        allowLoop: isLoopRef.current,
      });

      logAudioDebug("音檔失敗:自動跳過", {
        source,
        failedKey,
        failedLabel: buildTrackLabel(failedTrack),
        currentIndex: currentIndexRef.current,
        nextIndex,
        queueSize: playlistRef.current.length,
        errorName: String(error?.name || ""),
        errorMessage: String(error?.message || ""),
      });

      if (nextIndex < 0) {
        finishQueue("all_failed", "可播放音檔已全部跳過，要重新嘗試嗎？", "warning");
        return;
      }

      shouldAutoPlayRef.current = true;
      skipAutoPlayEffectRef.current = false;
      setCurrentIndex(nextIndex);
      setIsExpanded(true);
    },
    [
      findNextPlayableIndex,
      finishQueue,
      invalidatePlaybackAttempt,
      markTrackFailed,
      pushPlaybackNotice,
    ]
  );

  const startPlaybackAttemptTimeout = useCallback(
    (track, attemptId) => {
      clearPlaybackAttemptTimeout();
      const targetKey = getTrackKey(track);
      if (!targetKey) return;
      playbackTimeoutRef.current = setTimeout(() => {
        if (attemptId !== playAttemptIdRef.current) return;
        if (loadedTrackKeyRef.current !== targetKey) return;
        logAudioDebug("播放逾時:自動跳過", {
          targetKey,
          currentIndex: currentIndexRef.current,
          queueSize: playlistRef.current.length,
        });
        handleTrackPlaybackFailure(
          track,
          new Error("音訊載入逾時"),
          "播放逾時"
        );
      }, PLAYBACK_TIMEOUT_MS);
    },
    [clearPlaybackAttemptTimeout, handleTrackPlaybackFailure]
  );

  const tryPlayAudio = useCallback(
    (audio, errorLabel = "播放失敗", { track = null } = {}) => {
      const resolvedTrack =
        sanitizeTrack(track) || sanitizeTrack(playlistRef.current[currentIndexRef.current]);

      if (!audio || !resolvedTrack) {
        logAudioDebug("嘗試播放:阻擋", {
          原因: !audio ? "沒有 Audio 實例" : "沒有有效音檔",
          errorLabel,
          currentIndex: currentIndexRef.current,
          queueSize: playlistRef.current.length,
        });
        return false;
      }

      const attemptId = invalidatePlaybackAttempt();
      const trackKey = getTrackKey(resolvedTrack);
      failureHandlingKeyRef.current = null;
      startPlaybackAttemptTimeout(resolvedTrack, attemptId);

      logAudioDebug("嘗試播放:開始", {
        errorLabel,
        trackKey,
        trackLabel: buildTrackLabel(resolvedTrack),
        currentIndex: currentIndexRef.current,
        queueSize: playlistRef.current.length,
        isLoop: isLoopRef.current,
      });

      const playPromise = audio.play();
      if (playPromise && typeof playPromise.then === "function") {
        playPromise
          .then(() => {
            if (attemptId !== playAttemptIdRef.current) return;
            clearPlaybackAttemptTimeout();
            failureHandlingKeyRef.current = null;
            setIsPlaying(true);
            setIsRecovering(false);
            setIsQueueEnded(false);
            setEndedReason(null);
            logAudioDebug("嘗試播放:成功", {
              trackKey,
              currentIndex: currentIndexRef.current,
              queueSize: playlistRef.current.length,
            });
          })
          .catch((error) => {
            if (attemptId !== playAttemptIdRef.current) return;
            clearPlaybackAttemptTimeout();
            logAudioDebug("嘗試播放:失敗", {
              trackKey,
              trackLabel: buildTrackLabel(resolvedTrack),
              currentIndex: currentIndexRef.current,
              queueSize: playlistRef.current.length,
              errorName: String(error?.name || ""),
              errorMessage: String(error?.message || ""),
            });
            if (shouldSkipToNextTrackOnPlayFailure(error)) {
              handleTrackPlaybackFailure(resolvedTrack, error, errorLabel);
            } else {
              setIsPlaying(false);
              setIsRecovering(false);
              pushPlaybackNotice("warning", "播放失敗，請再試一次。", resolvedTrack);
            }
            console.error(errorLabel, error);
          });
        return true;
      }

      clearPlaybackAttemptTimeout();
      setIsPlaying(!audio.paused);
      setIsRecovering(false);
      if (!audio.paused) {
        setIsQueueEnded(false);
        setEndedReason(null);
      }
      return true;
    },
    [
      clearPlaybackAttemptTimeout,
      handleTrackPlaybackFailure,
      invalidatePlaybackAttempt,
      pushPlaybackNotice,
      startPlaybackAttemptTimeout,
    ]
  );

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";

    const audio = audioRef.current;
    // Every prayer recording played through the global player runs at roughly
    // -30 dBFS RMS, well under a comfortable speech level, and an <audio>
    // element cannot be pushed past volume 1. See src/lib/audio-gain.js.
    attachPlaybackGain(audio);
    const handlePlayEvent = () => {
      clearPlaybackAttemptTimeout();
      setIsPlaying(true);
      setIsRecovering(false);
      setIsQueueEnded(false);
      setEndedReason(null);
    };

    const handlePauseEvent = () => {
      setIsPlaying(false);
    };

    const handleErrorEvent = () => {
      const track = playlistRef.current[currentIndexRef.current];
      const error = new Error(audio?.error?.message || "音訊資源載入失敗");
      logAudioDebug("Audio 事件:錯誤", {
        currentIndex: currentIndexRef.current,
        queueSize: playlistRef.current.length,
        mediaErrorCode: audio?.error?.code ?? null,
        mediaErrorMessage: audio?.error?.message ?? "",
      });
      handleTrackPlaybackFailure(track, error, "audio.error");
    };

    const updateProgress = () => {
      setProgress(normalizeDuration(audio.currentTime));
      const nextDuration = normalizeDuration(audio.duration);
      setDuration(nextDuration);
      const track = playlistRef.current[currentIndexRef.current];
      if (track && nextDuration > 0) {
        setDurationForTrack(track, nextDuration);
      }
    };

    const handleEnded = () => {
      const tracks = playlistRef.current;
      const total = tracks.length;
      const currentTrack = tracks[currentIndexRef.current];

      logAudioDebug("Audio 事件:播放結束", {
        currentIndex: currentIndexRef.current,
        queueSize: total,
        isLoop: isLoopRef.current,
      });

      clearPlaybackAttemptTimeout();
      setIsPlaying(false);
      setIsRecovering(false);

      if (total === 0) {
        setCurrentIndex(-1);
        setIsQueueEnded(false);
        setEndedReason(null);
        return;
      }

      const nextIndex = findNextPlayableIndex(currentIndexRef.current, {
        allowLoop: isLoopRef.current,
      });

      if (nextIndex >= 0) {
        shouldAutoPlayRef.current = true;
        skipAutoPlayEffectRef.current = false;
        setIsQueueEnded(false);
        setEndedReason(null);

        if (nextIndex === currentIndexRef.current && audioRef.current) {
          audioRef.current.currentTime = 0;
          setProgress(0);
          tryPlayAudio(audioRef.current, "單曲循環重播失敗", {
            track: currentTrack,
          });
          return;
        }

        const delayMs = autoAdvanceDelayMsRef.current;
        if (delayMs > 0) {
          logAudioDebug("播放結束:延遲切換下一首", { delayMs, nextIndex });
          setIsAdvancingQueue(true);
          if (advanceDelayTimeoutRef.current) {
            clearTimeout(advanceDelayTimeoutRef.current);
          }
          advanceDelayTimeoutRef.current = setTimeout(() => {
            advanceDelayTimeoutRef.current = null;
            setIsAdvancingQueue(false);
            setCurrentIndex(nextIndex);
          }, delayMs);
          return;
        }

        setCurrentIndex(nextIndex);
        return;
      }

      finishQueue("completed", "播放完成，要重新播放嗎？");
    };

    const handleLoadedMetadata = () => {
      updateProgress();
      if (pendingSeekRef.current === null) return;
      const target = Math.max(0, pendingSeekRef.current);
      const maxTime = normalizeDuration(audio.duration);
      const nextTime = maxTime > 0 ? Math.min(target, maxTime) : target;
      audio.currentTime = nextTime;
      setProgress(nextTime);
      pendingSeekRef.current = null;
    };

    audio.addEventListener("timeupdate", updateProgress);
    audio.addEventListener("ended", handleEnded);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("play", handlePlayEvent);
    audio.addEventListener("pause", handlePauseEvent);
    audio.addEventListener("error", handleErrorEvent);

    return () => {
      invalidatePlaybackAttempt();
      audio.pause();
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", handleEnded);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("play", handlePlayEvent);
      audio.removeEventListener("pause", handlePauseEvent);
      audio.removeEventListener("error", handleErrorEvent);
    };
  }, [
    clearPlaybackAttemptTimeout,
    findNextPlayableIndex,
    finishQueue,
    handleTrackPlaybackFailure,
    invalidatePlaybackAttempt,
    setDurationForTrack,
    tryPlayAudio,
  ]);

  const playTrack = useCallback(
    (track) => {
      const nextTrack = sanitizeTrack(track);
      if (!nextTrack) return;
      clearAdvanceDelayTimeout();
      clearPlaybackNotice();
      setEndedReason(null);
      setIsQueueEnded(false);
      setIsRecovering(false);
      clearTrackFailure(nextTrack);

      setPlaylist((prev) => {
        const dedupedPrev = prev.map(sanitizeTrack).filter(Boolean);
        const existingIndex = dedupedPrev.findIndex(
          (item) =>
            (nextTrack.id && item.id === nextTrack.id) ||
            (item.voiceUrl && item.voiceUrl === nextTrack.voiceUrl)
        );

        if (existingIndex >= 0) {
          shouldAutoPlayRef.current = true;
          skipAutoPlayEffectRef.current = false;
          setCurrentIndex(existingIndex);
          return dedupedPrev;
        }

        const deduped = dedupedPrev.filter(
          (item) =>
            (nextTrack.id ? item.id !== nextTrack.id : true) &&
            (item.voiceUrl ? item.voiceUrl !== nextTrack.voiceUrl : true)
        );
        shouldAutoPlayRef.current = true;
        skipAutoPlayEffectRef.current = false;
        setCurrentIndex(0);
        return [nextTrack, ...deduped];
      });

      setIsExpanded(true);
      logAudioDebug("加入並播放音檔", {
        trackKey: getTrackKey(nextTrack),
        trackLabel: buildTrackLabel(nextTrack),
      });
    },
    [clearAdvanceDelayTimeout, clearPlaybackNotice, clearTrackFailure]
  );

  const setQueue = useCallback(
    (tracks, startIndex = 0) => {
      const normalized = Array.isArray(tracks)
        ? tracks.map(sanitizeTrack).filter(Boolean)
        : [];

      clearAdvanceDelayTimeout();
      setPlaylist(normalized);
      setEndedReason(null);
      setIsQueueEnded(false);
      setIsRecovering(false);
      if (startIndex >= 0) {
        resetPlaybackFailures();
      } else {
        syncFailedTrackKeysWithQueue(normalized);
      }

      if (!normalized.length) {
        stopAndResetAudio();
        setCurrentIndex(-1);
        return;
      }

      if (startIndex < 0) {
        const currentTrack = playlistRef.current[currentIndexRef.current];
        const preserveKey = getTrackKey(currentTrack) || loadedTrackKeyRef.current;

        if (!preserveKey) {
          shouldAutoPlayRef.current = false;
          skipAutoPlayEffectRef.current = false;
          setCurrentIndex(-1);
          setProgress(0);
          setDuration(0);
          return;
        }

        const nextIndex = normalized.findIndex(
          (track) => getTrackKey(track) === preserveKey
        );
        if (nextIndex < 0) {
          stopAndResetAudio();
          setCurrentIndex(-1);
          return;
        }

        const audio = audioRef.current;
        shouldAutoPlayRef.current = Boolean(audio && !audio.paused);
        skipAutoPlayEffectRef.current = false;
        setCurrentIndex(nextIndex);
        return;
      }

      clearPlaybackNotice();
      const baseIndex = Math.min(Math.max(startIndex, 0), normalized.length - 1);
      const safeIndex = findNextPlayableIndex(baseIndex - 1, {
        allowLoop: false,
        tracks: normalized,
      });

      if (safeIndex < 0) {
        stopAndResetAudio();
        setCurrentIndex(-1);
        finishQueue("all_failed", "可播放音檔已全部跳過，要重新嘗試嗎？", "warning");
        return;
      }

      shouldAutoPlayRef.current = true;
      skipAutoPlayEffectRef.current = false;
      setCurrentIndex(safeIndex);
      setIsExpanded(true);
    },
    [
      clearAdvanceDelayTimeout,
      clearPlaybackNotice,
      findNextPlayableIndex,
      finishQueue,
      resetPlaybackFailures,
      stopAndResetAudio,
      syncFailedTrackKeysWithQueue,
    ]
  );

  const playByIndex = useCallback(
    (index) => {
      const audio = audioRef.current;
      const tracks = playlistRef.current;
      clearAdvanceDelayTimeout();
      if (!audio) {
        logAudioDebug("指定索引播放:阻擋", { 原因: "沒有 Audio 實例", index });
        return false;
      }
      if (index < 0 || index >= tracks.length) {
        logAudioDebug("指定索引播放:阻擋", {
          原因: "索引超出範圍",
          index,
          total: tracks.length,
        });
        return false;
      }

      const track = sanitizeTrack(tracks[index]);
      if (!track?.voiceUrl) {
        logAudioDebug("指定索引播放:阻擋", {
          原因: "音檔網址無效",
          index,
        });
        return false;
      }

      clearTrackFailure(track);
      clearPlaybackNotice();
      failureHandlingKeyRef.current = null;
      const targetKey = getTrackKey(track);
      const currentTrack = tracks[currentIndexRef.current];
      const shouldSwitchTrack =
        loadedTrackKeyRef.current !== targetKey ||
        getTrackKey(currentTrack) !== targetKey;

      setCurrentIndex(index);
      setIsExpanded(true);
      setIsQueueEnded(false);
      setEndedReason(null);
      setIsRecovering(false);
      shouldAutoPlayRef.current = true;
      skipAutoPlayEffectRef.current = true;

      if (shouldSwitchTrack) {
        audio.src = normalizeAudioUrl(track.voiceUrl);
        loadedTrackKeyRef.current = targetKey;
        const knownDuration = normalizeDuration(trackDurationsRef.current[targetKey]);
        setDuration(knownDuration);
        setProgress(0);
      } else {
        audio.currentTime = 0;
        setProgress(0);
      }

      tryPlayAudio(audio, "指定索引播放失敗", { track });
      logAudioDebug("指定索引播放:請求", {
        index,
        targetKey,
        trackLabel: buildTrackLabel(track),
      });
      return true;
    },
    [clearAdvanceDelayTimeout, clearPlaybackNotice, clearTrackFailure, tryPlayAudio]
  );

  const restartQueue = useCallback(() => {
    const audio = audioRef.current;
    const tracks = playlistRef.current;
    if (!audio || !tracks.length) {
      logAudioDebug("重新播放清單:阻擋", {
        hasAudio: Boolean(audio),
        queueSize: tracks.length,
      });
      return false;
    }

    clearAdvanceDelayTimeout();
    clearPlaybackNotice();
    resetPlaybackFailures();

    const firstIndex = findFirstPlayableIndex(tracks);
    if (firstIndex < 0) {
      finishQueue("all_failed", "可播放音檔已全部跳過，要重新嘗試嗎？", "warning");
      return false;
    }

    const firstTrack = sanitizeTrack(tracks[firstIndex]);
    const targetKey = getTrackKey(firstTrack);
    failureHandlingKeyRef.current = null;

    if (loadedTrackKeyRef.current !== targetKey) {
      audio.src = normalizeAudioUrl(firstTrack.voiceUrl);
      loadedTrackKeyRef.current = targetKey;
      const knownDuration = normalizeDuration(trackDurationsRef.current[targetKey]);
      setDuration(knownDuration);
    }

    audio.currentTime = 0;
    setProgress(0);
    setCurrentIndex(firstIndex);
    setIsExpanded(true);
    setIsQueueEnded(false);
    setEndedReason(null);
    setIsRecovering(false);
    shouldAutoPlayRef.current = true;
    skipAutoPlayEffectRef.current = true;
    tryPlayAudio(audio, "重新播放清單失敗", { track: firstTrack });
    logAudioDebug("重新播放清單:請求", {
      queueSize: tracks.length,
      firstTrackIndex: firstIndex,
      firstTrackKey: targetKey,
      isLoop: isLoopRef.current,
    });
    return true;
  }, [
    clearAdvanceDelayTimeout,
    clearPlaybackNotice,
    findFirstPlayableIndex,
    finishQueue,
    resetPlaybackFailures,
    tryPlayAudio,
  ]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    const tracks = playlistRef.current;
    // A manual tap during the between-tracks pause (see setAutoAdvanceDelay) should
    // cancel the pending scheduled advance rather than fight with it — the branches
    // below already know how to move to the next playable track on their own.
    clearAdvanceDelayTimeout();
    if (!audio) {
      logAudioDebug("切換播放:阻擋", { 原因: "沒有 Audio 實例" });
      return;
    }

    if (audio.paused) {
      if (!tracks.length) {
        logAudioDebug("切換播放:阻擋", { 原因: "播放清單為空" });
        return;
      }

      if (isQueueEnded) {
        logAudioDebug("切換播放:重新開始清單", {
          currentIndex: currentIndexRef.current,
          queueSize: tracks.length,
        });
        restartQueue();
        return;
      }

      const currentTrack = sanitizeTrack(tracks[currentIndexRef.current]);
      const currentKey = getTrackKey(currentTrack);
      const currentFailed = currentKey
        ? failedTrackKeysRef.current.has(currentKey)
        : true;

      if (isTrackAtEnd(audio)) {
        const nextIndex = findNextPlayableIndex(currentIndexRef.current, {
          allowLoop: isLoopRef.current,
        });

        if (nextIndex >= 0 && nextIndex !== currentIndexRef.current) {
          shouldAutoPlayRef.current = true;
          skipAutoPlayEffectRef.current = false;
          setCurrentIndex(nextIndex);
          setIsQueueEnded(false);
          setEndedReason(null);
          setIsRecovering(false);
          return;
        }

        if (nextIndex === currentIndexRef.current) {
          audio.currentTime = 0;
          setProgress(0);
          tryPlayAudio(audio, "單曲循環重播失敗", { track: currentTrack });
          return;
        }

        finishQueue("completed", "播放完成，要重新播放嗎？");
        return;
      }

      if (!currentTrack || currentFailed || currentIndexRef.current < 0) {
        const resumeIndex =
          currentIndexRef.current >= 0
            ? findNextPlayableIndex(currentIndexRef.current, {
                allowLoop: isLoopRef.current,
              })
            : findFirstPlayableIndex();

        if (resumeIndex < 0) {
          finishQueue("all_failed", "可播放音檔已全部跳過，要重新嘗試嗎？", "warning");
          return;
        }

        shouldAutoPlayRef.current = true;
        skipAutoPlayEffectRef.current = false;
        setCurrentIndex(resumeIndex);
        setIsExpanded(true);
        setIsQueueEnded(false);
        setEndedReason(null);
        setIsRecovering(false);
        return;
      }

      tryPlayAudio(audio, "恢復播放失敗", { track: currentTrack });
      return;
    }

    logAudioDebug("切換播放:暫停", {
      currentIndex: currentIndexRef.current,
      queueSize: tracks.length,
    });
    shouldAutoPlayRef.current = false;
    invalidatePlaybackAttempt();
    audio.pause();
  }, [
    clearAdvanceDelayTimeout,
    findFirstPlayableIndex,
    findNextPlayableIndex,
    finishQueue,
    invalidatePlaybackAttempt,
    isQueueEnded,
    restartQueue,
    tryPlayAudio,
  ]);

  const pause = useCallback(() => {
    const audio = audioRef.current;
    clearAdvanceDelayTimeout();
    if (audio) {
      shouldAutoPlayRef.current = false;
      invalidatePlaybackAttempt();
      audio.pause();
    }
    setIsPlaying(false);
    setIsRecovering(false);
  }, [clearAdvanceDelayTimeout, invalidatePlaybackAttempt]);

  const seek = useCallback((time) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setProgress(time);
    }
  }, []);

  const seekQueue = useCallback((time) => {
    const audio = audioRef.current;
    const tracks = playlistRef.current;
    if (!audio || !tracks.length) return;

    const durations = tracks.map((track) => {
      const key = getTrackKey(track);
      if (!key || failedTrackKeysRef.current.has(key)) return 0;
      return normalizeDuration(trackDurationsRef.current[key]);
    });
    const knownTotal = durations.reduce((sum, value) => sum + value, 0);

    if (knownTotal <= 0) {
      const singleTrackDuration = normalizeDuration(audio.duration);
      if (singleTrackDuration <= 0) return;
      const target = Math.min(Math.max(time, 0), singleTrackDuration);
      const isSeekingToQueueEnd =
        target >= Math.max(singleTrackDuration - END_EPSILON_SECONDS, 0);
      audio.currentTime = target;
      setProgress(target);
      if (isSeekingToQueueEnd && !isLoopRef.current) {
        setEndedReason("manual");
        setIsQueueEnded(true);
        shouldAutoPlayRef.current = false;
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    const target = Math.min(Math.max(time, 0), knownTotal);
    const isSeekingToQueueEnd =
      target >= Math.max(knownTotal - END_EPSILON_SECONDS, 0);
    let accumulated = 0;
    let targetIndex = -1;
    let targetOffset = 0;

    for (let index = 0; index < tracks.length; index += 1) {
      const trackDuration = durations[index];
      if (trackDuration <= 0) continue;
      const nextAccumulated = accumulated + trackDuration;
      if (target <= nextAccumulated || index === tracks.length - 1) {
        targetIndex = index;
        const allowTrackEnd = isSeekingToQueueEnd && index === tracks.length - 1;
        targetOffset = clampTrackSeekOffset(
          target - accumulated,
          trackDuration,
          allowTrackEnd
        );
        break;
      }
      accumulated = nextAccumulated;
    }

    if (targetIndex < 0) return;

    if (isSeekingToQueueEnd && !isLoopRef.current) {
      setEndedReason("manual");
      setIsQueueEnded(true);
    } else {
      setEndedReason(null);
      setIsQueueEnded(false);
    }

    if (targetIndex !== currentIndexRef.current) {
      pendingSeekRef.current = targetOffset;
      shouldAutoPlayRef.current = isSeekingToQueueEnd ? false : !audio.paused;
      skipAutoPlayEffectRef.current = false;
      setCurrentIndex(targetIndex);
      if (isSeekingToQueueEnd && !isLoopRef.current) {
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    audio.currentTime = targetOffset;
    setProgress(targetOffset);
    if (isSeekingToQueueEnd && !isLoopRef.current) {
      shouldAutoPlayRef.current = false;
      audio.pause();
      setIsPlaying(false);
    }
  }, []);

  const playNext = useCallback(() => {
    const tracks = playlistRef.current;
    const total = tracks.length;
    clearAdvanceDelayTimeout();
    if (!total) return;

    const nextIndex = findNextPlayableIndex(currentIndexRef.current, {
      allowLoop: isLoopRef.current,
    });

    if (nextIndex < 0) {
      finishQueue("completed", "播放完成，要重新播放嗎？");
      return;
    }

    if (nextIndex === currentIndexRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      setProgress(0);
      tryPlayAudio(audioRef.current, "單曲循環重播失敗", {
        track: tracks[nextIndex],
      });
      return;
    }

    shouldAutoPlayRef.current = true;
    skipAutoPlayEffectRef.current = false;
    setCurrentIndex(nextIndex);
    setIsQueueEnded(false);
    setEndedReason(null);
    setIsRecovering(false);
  }, [clearAdvanceDelayTimeout, findNextPlayableIndex, finishQueue, tryPlayAudio]);

  const playPrev = useCallback(() => {
    const tracks = playlistRef.current;
    clearAdvanceDelayTimeout();
    if (!tracks.length) return;

    const prevIndex = findPrevPlayableIndex(currentIndexRef.current);
    if (prevIndex < 0) {
      if (audioRef.current) {
        audioRef.current.currentTime = 0;
      }
      setProgress(0);
      return;
    }

    shouldAutoPlayRef.current = true;
    skipAutoPlayEffectRef.current = false;
    setCurrentIndex(prevIndex);
    setIsQueueEnded(false);
    setEndedReason(null);
    setIsRecovering(false);
  }, [clearAdvanceDelayTimeout, findPrevPlayableIndex]);

  const selectTrack = useCallback((index) => {
    playByIndex(index);
  }, [playByIndex]);

  const removeTrack = useCallback((trackId) => {
    clearAdvanceDelayTimeout();
    const removedTrack = playlistRef.current.find((track) => track.id === trackId);
    clearTrackFailure(removedTrack);

    setPlaylist((prev) => {
      const index = prev.findIndex((track) => track.id === trackId);
      if (index === -1) return prev;
      const next = prev.filter((track) => track.id !== trackId);

      setCurrentIndex((prevIndex) => {
        if (next.length === 0) {
          stopAndResetAudio();
          return -1;
        }

        const audio = audioRef.current;
        const wasPlaying = Boolean(audio && !audio.paused);
        if (index < prevIndex) {
          return Math.max(prevIndex - 1, 0);
        }
        if (index === prevIndex) {
          shouldAutoPlayRef.current = wasPlaying;
          skipAutoPlayEffectRef.current = false;
          return Math.min(prevIndex, next.length - 1);
        }
        return prevIndex;
      });

      return next;
    });
  }, [clearAdvanceDelayTimeout, clearTrackFailure, stopAndResetAudio]);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    currentIndexRef.current = currentIndex;
  }, [currentIndex]);

  useEffect(() => {
    isLoopRef.current = isLoop;
  }, [isLoop]);

  useEffect(() => {
    trackDurationsRef.current = trackDurations;
  }, [trackDurations]);

  useEffect(() => {
    return () => {
      if (advanceDelayTimeoutRef.current) {
        clearTimeout(advanceDelayTimeoutRef.current);
        advanceDelayTimeoutRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || !playlist.length) return undefined;

    const cleaners = [];

    playlist.forEach((track) => {
      const normalizedTrack = sanitizeTrack(track);
      const key = getTrackKey(normalizedTrack);
      if (!key || !normalizedTrack?.voiceUrl) return;
      if (hasOwn.call(trackDurationsRef.current, key)) return;
      if (probingKeysRef.current.has(key)) return;

      probingKeysRef.current.add(key);
      const probe = new Audio();
      probe.preload = "metadata";

      const finalize = (seconds) => {
        setTrackDurations((prev) => {
          if (hasOwn.call(prev, key)) return prev;
          return { ...prev, [key]: normalizeDuration(seconds) };
        });
        probingKeysRef.current.delete(key);
        probe.removeEventListener("loadedmetadata", onMetadata);
        probe.removeEventListener("error", onError);
      };

      const onMetadata = () => finalize(probe.duration);
      const onError = () => finalize(0);

      probe.addEventListener("loadedmetadata", onMetadata);
      probe.addEventListener("error", onError);
      probe.src = normalizeAudioUrl(normalizedTrack.voiceUrl);
      probe.load();

      cleaners.push(() => {
        probingKeysRef.current.delete(key);
        probe.removeEventListener("loadedmetadata", onMetadata);
        probe.removeEventListener("error", onError);
      });
    });

    return () => {
      cleaners.forEach((clean) => clean());
    };
  }, [playlist]);

  useEffect(() => {
    if (currentIndex >= 0 && playlist[currentIndex] && audioRef.current) {
      const track = sanitizeTrack(playlist[currentIndex]);
      if (!track) {
        handleTrackPlaybackFailure(
          playlist[currentIndex],
          new Error("音檔資料無效"),
          "切換曲目"
        );
        return;
      }

      const audio = audioRef.current;
      const targetKey = getTrackKey(track);
      const shouldSwitchTrack = loadedTrackKeyRef.current !== targetKey;
      failureHandlingKeyRef.current = null;

      if (shouldSwitchTrack) {
        audio.src = normalizeAudioUrl(track.voiceUrl);
        loadedTrackKeyRef.current = targetKey;
        const knownDuration = normalizeDuration(trackDurationsRef.current[targetKey]);
        setDuration(knownDuration);
        setProgress(0);
      }

      if (shouldAutoPlayRef.current) {
        if (skipAutoPlayEffectRef.current) {
          skipAutoPlayEffectRef.current = false;
        } else {
          tryPlayAudio(audio, "切換曲目播放失敗", { track });
        }
      } else {
        skipAutoPlayEffectRef.current = false;
        invalidatePlaybackAttempt();
        audio.pause();
        setIsPlaying(false);
      }
      return;
    }

    invalidatePlaybackAttempt();
    shouldAutoPlayRef.current = false;
    skipAutoPlayEffectRef.current = false;
    loadedTrackKeyRef.current = null;
    failureHandlingKeyRef.current = null;
    setIsPlaying(false);
    setIsRecovering(false);
    if (!playlist.length) {
      setIsQueueEnded(false);
      setEndedReason(null);
      setProgress(0);
      setDuration(0);
    }
  }, [currentIndex, handleTrackPlaybackFailure, invalidatePlaybackAttempt, playlist, tryPlayAudio]);

  const currentTrack = currentIndex >= 0 ? playlist[currentIndex] : null;

  const queueDuration = useMemo(
    () =>
      playlist.reduce((sum, track) => {
        const key = getTrackKey(track);
        if (!key || failedTrackKeys.includes(key)) return sum;
        return sum + normalizeDuration(trackDurations[key]);
      }, 0),
    [failedTrackKeys, playlist, trackDurations]
  );

  const queueProgress = useMemo(() => {
    if (currentIndex < 0 || !playlist.length) return 0;

    let elapsed = 0;
    for (let index = 0; index < playlist.length; index += 1) {
      const track = playlist[index];
      const key = getTrackKey(track);
      if (!key || failedTrackKeys.includes(key)) continue;

      const trackDuration = normalizeDuration(trackDurations[key]);
      if (index < currentIndex) {
        elapsed += trackDuration;
        continue;
      }
      if (index === currentIndex) {
        elapsed +=
          trackDuration > 0 ? Math.min(progress, trackDuration) : Math.max(progress, 0);
      }
      break;
    }
    return elapsed;
  }, [currentIndex, failedTrackKeys, playlist, progress, trackDurations]);

  const playerPhase = useMemo(() => {
    if (!playlist.length) return "empty";
    if (isRecovering) return "recovering";
    if (isAdvancingQueue) return "advancing";
    if (isPlaying) return "playing";
    if (isQueueEnded) return "ended";
    if (currentIndex >= 0 && playlist[currentIndex]) return "paused";
    return "ready";
  }, [currentIndex, isAdvancingQueue, isPlaying, isQueueEnded, isRecovering, playlist]);

  const value = {
    currentTrack,
    playlist,
    isPlaying,
    isQueueEnded,
    isAdvancingQueue,
    isExpanded,
    isCompanion,
    progress,
    duration,
    queueProgress,
    queueDuration,
    isLoop,
    playerPhase,
    endedReason,
    playbackNotice,
    failedTrackKeys,
    lastSkippedTrack,
    setIsExpanded,
    setIsCompanion,
    clearPlaybackNotice,
    playTrack,
    setQueue,
    playByIndex,
    restartQueue,
    togglePlay,
    pause,
    seek,
    seekQueue,
    playNext,
    playPrev,
    setIsLoop,
    selectTrack,
    removeTrack,
    setAutoAdvanceDelay,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const context = useContext(AudioContext);
  if (!context) {
    throw new Error("useAudio must be used within an AudioProvider");
  }
  return context;
}
