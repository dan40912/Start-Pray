"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { useAudio } from "@/context/AudioContext";
import { getDictionary, localeFromPathname } from "@/lib/i18n";
import usePlaybackWellbeing from "@/lib/usePlaybackWellbeing";
import WellbeingNudge from "@/components/WellbeingNudge";

const FALLBACK_SPEAKER = "匿名上傳者";
const FALLBACK_TITLE = "代禱音訊";
const FALLBACK_EMPTY_HINT = "目前沒有可播放的音訊，先上傳文字或語音回應。";
const FALLBACK_TEXT_MESSAGE = "這位上傳者尚未留下文字訊息。";
const FALLBACK_VOICE_MESSAGE = "語音回應";
const PLAYER_PHASE_LABELS = {
  ready: "準備播放",
  playing: "播放中",
  paused: "已暫停",
  recovering: "正在跳過",
  advancing: "即將換下一位",
  ended: "播放完成",
  empty: "尚未載入",
};

const GLOBAL_PLAYER_BODY_CLASS = "has-global-player";
const COMPANION_ACTIVE_CLASS = "is-companion-active";
const COMPANION_BODY_CLASS = "companion-mode-active";
const COMPANION_OVERLAY_CLASS = "companion-overlay-open";
const GLOBAL_PLAYER_DEBUG_TAG = "[GlobalPlayer]";
// How long the companion card lingers in silence after a track finishes before
// the queue moves on to the next one (see AudioContext's setAutoAdvanceDelay).
const COMPANION_AUTO_ADVANCE_DELAY_MS = 3000;
// Typing out a very long message at a fixed per-character speed could take
// forever; these bounds keep the typewriter pass between ~0.6s and ~3.2s.
const TYPEWRITER_MIN_CHAR_DELAY_MS = 18;
const TYPEWRITER_MAX_CHAR_DELAY_MS = 60;
const TYPEWRITER_TARGET_DURATION_MS = 2200;

function logGlobalPlayer(event, details = {}) {
  console.log(`${GLOBAL_PLAYER_DEBUG_TAG} ${event}`, details);
}

function getSpeakerInitial(name) {
  return name?.charAt(0)?.toUpperCase() || "?";
}

function parsePrayerId(pathname = "") {
  const match = pathname.match(/^\/prayfor\/(\d+)/);
  if (!match) return null;
  return match[1];
}

function formatTime(value) {
  if (!value) return "0:00";
  const minutes = Math.floor(value / 60);
  const seconds = Math.floor(value % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function isSameTrack(left, right) {
  if (!left || !right) return false;
  if (left.id !== undefined && right.id !== undefined) {
    return String(left.id) === String(right.id);
  }
  if (left.voiceUrl && right.voiceUrl) {
    return String(left.voiceUrl) === String(right.voiceUrl);
  }
  return false;
}

function getTrackIdentity(track) {
  if (!track) return null;
  if (track.id !== undefined && track.id !== null) {
    return `id:${track.id}`;
  }
  if (track.voiceUrl) {
    return `url:${track.voiceUrl}`;
  }
  return null;
}

export default function GlobalPlayer({ onClose }) {
  const pathname = usePathname() || "";
  const prayerId = useMemo(() => parsePrayerId(pathname), [pathname]);
  const isPrayerDetailPage = Boolean(prayerId);

  const {
    currentTrack,
    playlist,
    isPlaying,
    isLoop,
    isQueueEnded,
    playerPhase,
    endedReason,
    playbackNotice,
    clearPlaybackNotice,
    isExpanded,
    setIsExpanded,
    togglePlay,
    pause,
    duration,
    queueProgress,
    queueDuration,
    seekQueue,
    playNext,
    playPrev,
    restartQueue,
    setIsLoop,
    selectTrack,
    removeTrack,
    setAutoAdvanceDelay,
  } = useAudio();

  const wellbeingLocale = localeFromPathname(pathname);
  const wellbeingText = getDictionary(wellbeingLocale).wellbeing;
  const {
    shouldPrompt: showWellbeingNudge,
    dismiss: dismissWellbeing,
    dismissForever: dismissWellbeingForever,
  } = usePlaybackWellbeing();

  const progressBarRef = useRef(null);
  const [isOverlayDismissed, setIsOverlayDismissed] = useState(false);
  const [overlayBackground, setOverlayBackground] = useState("");
  const [typedMessage, setTypedMessage] = useState("");
  const typewriterIntervalRef = useRef(null);
  const previousTrackIdentityRef = useRef(null);
  const previousPhaseRef = useRef(playerPhase);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;
    document.body.classList.add(GLOBAL_PLAYER_BODY_CLASS);
    return () => {
      document.body.classList.remove(GLOBAL_PLAYER_BODY_CLASS);
    };
  }, []);

  const hasTrack = Boolean(currentTrack);
  const hasQueue = playlist.length > 0;
  const hasStartedPlayback = hasTrack;
  const currentTrackIdentity = useMemo(() => getTrackIdentity(currentTrack), [currentTrack]);

  useEffect(() => {
    const previousTrackIdentity = previousTrackIdentityRef.current;
    const previousPhase = previousPhaseRef.current;
    const hasTrackChanged =
      Boolean(currentTrackIdentity) && currentTrackIdentity !== previousTrackIdentity;
    const shouldReopenOverlay =
      hasStartedPlayback &&
      playerPhase === "playing" &&
      (hasTrackChanged || previousPhase === "ready" || previousPhase === "ended");

    if (shouldReopenOverlay) {
      setIsOverlayDismissed(false);
    }

    previousTrackIdentityRef.current = currentTrackIdentity;
    previousPhaseRef.current = playerPhase;
  }, [currentTrackIdentity, hasStartedPlayback, playerPhase]);

  const displayTrack = hasStartedPlayback
    ? currentTrack
    : hasQueue
      ? playlist[0]
      : {
          id: "placeholder",
          speaker: FALLBACK_SPEAKER,
          requestTitle: FALLBACK_TITLE,
          message: "",
          avatarUrl: "",
          voiceUrl: "",
        };

  const trackSpeaker = displayTrack.speaker || FALLBACK_SPEAKER;
  const hasVoiceTrack = Boolean(displayTrack.voiceUrl);
  const overlayMessage =
    currentTrack?.message?.trim() || displayTrack.message?.trim() || FALLBACK_TEXT_MESSAGE;

  const activeQueueIndex = useMemo(() => {
    if (!hasQueue || !currentTrack) return -1;
    return playlist.findIndex((track) => isSameTrack(track, currentTrack));
  }, [currentTrack, hasQueue, playlist]);

  const queuePositionText =
    activeQueueIndex >= 0
      ? `第 ${activeQueueIndex + 1} / ${playlist.length} 首`
      : `待播 ${playlist.length || 1} 首`;

  const playerStatusLabel = PLAYER_PHASE_LABELS[playerPhase] || PLAYER_PHASE_LABELS.ready;
  const playerStatusClass =
    playerPhase === "playing"
      ? "is-playing"
      : playerPhase === "recovering"
        ? "is-recovering"
        : playerPhase === "advancing"
          ? "is-advancing"
          : playerPhase === "ended"
            ? "is-ended"
            : playerPhase === "ready"
              ? "is-ready"
              : "is-paused";
  const endedTitle =
    endedReason === "all_failed"
      ? "可播放音檔已全部跳過，要重新嘗試嗎？"
      : "播放完成，要重新播放嗎？";
  const showPlaybackNotice =
    Boolean(playbackNotice?.message) &&
    !(playerPhase === "ended" && playbackNotice?.message === endedTitle);

  const playButtonConfig = useMemo(() => {
    switch (playerPhase) {
      case "playing":
        return {
          icon: "fa-pause",
          label: "暫停",
          ariaLabel: "暫停播放",
          disabled: false,
        };
      case "paused":
        return {
          icon: "fa-play",
          label: "繼續播放",
          ariaLabel: "繼續播放",
          disabled: false,
        };
      case "recovering":
        return {
          icon: "fa-spinner fa-spin",
          label: "處理中",
          ariaLabel: "正在跳過無法播放的音檔",
          disabled: true,
        };
      case "advancing":
        return {
          icon: "fa-play",
          label: "即將播放下一則",
          ariaLabel: "即將播放下一則，點一下可以立即播放",
          disabled: false,
        };
      case "ended":
        return {
          icon: "fa-rotate-right",
          label: "重播",
          ariaLabel: "重新播放整個清單",
          disabled: false,
        };
      case "ready":
        return {
          icon: "fa-play",
          label: "播放",
          ariaLabel: "開始播放",
          disabled: false,
        };
      default:
        return {
          icon: "fa-play",
          label: "播放",
          ariaLabel: "目前沒有可播放的音訊",
          disabled: true,
        };
    }
  }, [playerPhase]);

  const nowMetaPrimary = displayTrack.requestTitle || FALLBACK_TITLE;
  const nowMetaSecondary = hasVoiceTrack
    ? FALLBACK_VOICE_MESSAGE
    : displayTrack.message?.trim() || FALLBACK_TEXT_MESSAGE;

  const effectiveProgress = hasQueue ? queueProgress : 0;
  const effectiveDuration = hasQueue
    ? Math.max(queueDuration, queueProgress, hasTrack ? duration : 0)
    : 0;
  const safeDuration = effectiveDuration > 0 ? effectiveDuration : 1;
  const progressPercent = Math.min(Math.max((effectiveProgress / safeDuration) * 100, 0), 100);

  // "advancing" is the brief, silent gap between one track finishing and the next
  // one starting (see COMPANION_AUTO_ADVANCE_DELAY_MS below) — the overlay should
  // stay open and keep showing the just-finished card through that gap instead of
  // disappearing and popping back in.
  const showCompanionOverlay =
    isPrayerDetailPage &&
    hasStartedPlayback &&
    (playerPhase === "playing" || playerPhase === "advancing") &&
    !isQueueEnded &&
    !isOverlayDismissed;

  // Ask the shared audio queue to pause for a few seconds of silence between prayer
  // cards while the companion overlay is open, instead of jumping to the next voice
  // immediately. This only affects playback while this overlay is visible — every
  // other page keeps the instant back-to-back behaviour.
  useEffect(() => {
    setAutoAdvanceDelay(showCompanionOverlay ? COMPANION_AUTO_ADVANCE_DELAY_MS : 0);
    return () => setAutoAdvanceDelay(0);
  }, [setAutoAdvanceDelay, showCompanionOverlay]);

  // Simple typewriter: re-type the current card's message from scratch whenever the
  // track or its text changes, capped so a long message doesn't take forever.
  useEffect(() => {
    if (typewriterIntervalRef.current) {
      clearInterval(typewriterIntervalRef.current);
      typewriterIntervalRef.current = null;
    }

    if (!showCompanionOverlay) {
      setTypedMessage("");
      return undefined;
    }

    const fullText = overlayMessage || "";
    if (!fullText) {
      setTypedMessage("");
      return undefined;
    }

    setTypedMessage("");
    const charDelayMs = Math.min(
      TYPEWRITER_MAX_CHAR_DELAY_MS,
      Math.max(TYPEWRITER_MIN_CHAR_DELAY_MS, Math.round(TYPEWRITER_TARGET_DURATION_MS / fullText.length))
    );
    let charIndex = 0;

    typewriterIntervalRef.current = setInterval(() => {
      charIndex += 1;
      setTypedMessage(fullText.slice(0, charIndex));
      if (charIndex >= fullText.length && typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
    }, charDelayMs);

    return () => {
      if (typewriterIntervalRef.current) {
        clearInterval(typewriterIntervalRef.current);
        typewriterIntervalRef.current = null;
      }
    };
    // overlayMessage already changes whenever currentTrackIdentity does, but keeping
    // the identity in the deps makes the "retype from scratch on a new card" intent explicit.
  }, [currentTrackIdentity, overlayMessage, showCompanionOverlay]);

  useEffect(() => {
    if (!isPrayerDetailPage) {
      setOverlayBackground("");
      return;
    }

    if (currentTrack?.coverImage) {
      setOverlayBackground(currentTrack.coverImage);
      return;
    }

    const firstCover = playlist.find((track) => track?.coverImage)?.coverImage;
    if (firstCover) {
      setOverlayBackground(firstCover);
      return;
    }

    if (typeof document === "undefined") return;
    const heroImage = document.querySelector(".pdv2-hero-image-wrap img");
    const fallbackImage =
      heroImage?.currentSrc?.trim() || heroImage?.getAttribute?.("src")?.trim() || "";
    setOverlayBackground(fallbackImage);
  }, [currentTrack?.coverImage, isPrayerDetailPage, playlist]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    const previous = document.querySelectorAll(`.comment-item.${COMPANION_ACTIVE_CLASS}`);
    previous.forEach((node) => node.classList.remove(COMPANION_ACTIVE_CLASS));

    if (!showCompanionOverlay) return undefined;
    const responseId = String(currentTrack?.id ?? "").trim();
    if (!responseId || responseId === "primary-track") return undefined;

    const target = document.getElementById(`prayer-response-${responseId}`);
    if (!target) return undefined;

    target.classList.add(COMPANION_ACTIVE_CLASS);

    return () => {
      target.classList.remove(COMPANION_ACTIVE_CLASS);
    };
  }, [currentTrack?.id, showCompanionOverlay]);

  useEffect(() => {
    if (typeof document === "undefined") return undefined;

    document.body.classList.toggle(COMPANION_BODY_CLASS, showCompanionOverlay);
    document.body.classList.toggle(COMPANION_OVERLAY_CLASS, showCompanionOverlay);

    return () => {
      document.body.classList.remove(COMPANION_BODY_CLASS);
      document.body.classList.remove(COMPANION_OVERLAY_CLASS);
    };
  }, [showCompanionOverlay]);

  const handleProgressClick = (event) => {
    if (!hasQueue || !progressBarRef.current || effectiveDuration <= 0) return;
    const rect = progressBarRef.current.getBoundingClientRect();
    const percent = Math.min(Math.max((event.clientX - rect.left) / rect.width, 0), 1);
    seekQueue(percent * effectiveDuration);
  };

  const handleTogglePlay = useCallback(
    (event) => {
      event?.stopPropagation?.();
      switch (playerPhase) {
        case "empty":
          logGlobalPlayer("播放鍵:阻擋:沒有播放清單", {
            queueSize: playlist.length,
            currentTrackId: currentTrack?.id ?? null,
          });
          return;
        case "recovering":
          logGlobalPlayer("播放鍵:阻擋:正在跳過錯誤音檔", {
            queueSize: playlist.length,
            currentTrackId: currentTrack?.id ?? null,
          });
          return;
        case "ready":
        case "ended":
          logGlobalPlayer("播放鍵:重新開始清單", {
            playerPhase,
            queueSize: playlist.length,
            currentTrackId: currentTrack?.id ?? null,
          });
          restartQueue();
          return;
        case "playing":
        case "paused":
          logGlobalPlayer("播放鍵:切換播放狀態", {
            playerPhase,
            queueSize: playlist.length,
            currentTrackId: currentTrack?.id ?? null,
          });
          togglePlay();
          return;
        default:
          return;
      }
    },
    [
      currentTrack?.id,
      playerPhase,
      playlist.length,
      restartQueue,
      togglePlay,
    ]
  );

  const handleOverlayClose = useCallback(
    (event) => {
      event?.stopPropagation?.();
      setIsOverlayDismissed(true);
      pause();
    },
    [pause]
  );

  const handleLoopToggle = useCallback(
    (event) => {
      event?.stopPropagation?.();
      if (!hasQueue) {
        logGlobalPlayer("loop-click-blocked:no-queue", {
          isLoop,
          isQueueEnded,
          queueSize: playlist.length,
        });
        return;
      }
      const nextLoop = !isLoop;
      setIsLoop(nextLoop);
      logGlobalPlayer("循環鍵:切換", {
        previousLoop: isLoop,
        nextLoop,
        isQueueEnded,
        queueSize: playlist.length,
        currentTrackId: currentTrack?.id ?? null,
      });
      if (nextLoop && isQueueEnded) {
        logGlobalPlayer("循環鍵:播放結束後立即重播", {
          queueSize: playlist.length,
          currentTrackId: currentTrack?.id ?? null,
        });
        restartQueue();
      }
    },
    [currentTrack?.id, hasQueue, isLoop, isQueueEnded, playlist.length, restartQueue, setIsLoop]
  );
  const handleQueueToggle = () => setIsExpanded(!isExpanded);

  const handleRestartFromBeginning = () => {
    if (!hasQueue) return;
    setIsLoop(false);
    restartQueue();
  };

  const handleEnableLoopFromBeginning = () => {
    if (!hasQueue) return;
    setIsLoop(true);
    restartQueue();
  };

  if (pathname?.startsWith("/me/create")) {
    return null;
  }

  const overlayBackgroundStyle = overlayBackground
    ? { backgroundImage: `url(${overlayBackground})` }
    : undefined;

  return (
    <>
      {showWellbeingNudge ? (
        <WellbeingNudge
          text={wellbeingText}
          onDismiss={dismissWellbeing}
          onDismissForever={dismissWellbeingForever}
        />
      ) : null}
      {showCompanionOverlay ? (
        <section className="companion-overlay" aria-live="polite">
          <div className="companion-overlay__bg" style={overlayBackgroundStyle} aria-hidden="true" />
          <div className="companion-overlay__scrim" aria-hidden="true" />

          <div className="companion-overlay__content">
            <header className="companion-overlay__header">
              <button
                type="button"
                className="companion-overlay__close btn-danger"
                onClick={handleOverlayClose}
                aria-label="關閉陪伴模式"
              >
                關閉
              </button>
            </header>

            <div className="companion-overlay__stage">
              <article className={`companion-overlay__card${hasVoiceTrack ? " is-voice" : ""}`}>
                <div className="companion-overlay__identity">
                  <div className={`companion-overlay__avatar ${isPlaying ? "is-speaking" : ""}`} aria-hidden="true">
                    {displayTrack.avatarUrl ? (
                      <img src={displayTrack.avatarUrl} alt={trackSpeaker} />
                    ) : (
                      <span>{getSpeakerInitial(trackSpeaker)}</span>
                    )}
                  </div>
                  <div className="companion-overlay__text">
                    <div className="companion-overlay__speaker-row">
                      <strong className="companion-overlay__speaker">{trackSpeaker}</strong>
                      <span className={`player-now__chip ${playerStatusClass}`}>
                        {playerStatusLabel}
                      </span>
                      {hasVoiceTrack ? (
                        <span
                          className="companion-overlay__voice-indicator"
                          aria-label={FALLBACK_VOICE_MESSAGE}
                          title={FALLBACK_VOICE_MESSAGE}
                        >
                          <i className="fa-solid fa-wave-square" aria-hidden="true" />
                        </span>
                      ) : null}
                    </div>
                    <p className="companion-overlay__message" title={overlayMessage}>
                      <span className="sr-only">{overlayMessage}</span>
                      <span aria-hidden="true">
                        {typedMessage}
                        {typedMessage.length < overlayMessage.length ? (
                          <span className="companion-overlay__caret" />
                        ) : null}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="companion-overlay__actions">
                  <button
                    type="button"
                    className="companion-overlay__btn companion-overlay__btn--play btn-primary"
                    onClick={handleTogglePlay}
                    aria-label={playButtonConfig.ariaLabel}
                    disabled={playButtonConfig.disabled}
                  >
                    <i className={`fa-solid ${playButtonConfig.icon}`} aria-hidden="true" />
                    <span className="companion-overlay__btn-text" aria-hidden="true">
                      {playButtonConfig.label}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="companion-overlay__btn companion-overlay__btn--close btn-danger"
                    onClick={handleOverlayClose}
                    aria-label="關閉陪伴模式"
                  >
                    <i className="fa-solid fa-xmark" aria-hidden="true" />
                  </button>
                </div>
              </article>
            </div>
          </div>
        </section>
      ) : null}

      <div
        className={`global-player glass-panel${isPrayerDetailPage ? " is-prayer-detail" : ""}${
          showCompanionOverlay ? " is-overlay-active" : ""
        }`}
      >
        {onClose && !showCompanionOverlay ? (
          <button
            type="button"
            className="global-player__close"
            onClick={onClose}
            aria-label="關閉播放器"
            title="關閉播放器"
          >
            <i className="fa-solid fa-xmark" aria-hidden="true" />
          </button>
        ) : null}
        {!showCompanionOverlay ? (
          <div className="player-progress">
            <div
              className="progress-bar"
              onClick={handleProgressClick}
              ref={progressBarRef}
              role="presentation"
            >
              <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
            </div>
            <div className="player-times">
              <span>{formatTime(effectiveProgress)}</span>
              <span>{formatTime(effectiveDuration)}</span>
            </div>
          </div>
        ) : null}

        <div className={`player-controls-container ${hasQueue ? "" : "is-idle"}`}>
          {hasQueue && !showCompanionOverlay ? (
            <section className="player-now" aria-live="polite">
              {displayTrack.avatarUrl ? (
                <img
                  src={displayTrack.avatarUrl}
                  alt={trackSpeaker}
                  className={`track-avatar ${hasTrack && isPlaying ? "pulse" : ""}`}
                />
              ) : (
                <div className={`track-avatar ${hasTrack && isPlaying ? "pulse" : ""}`} aria-hidden="true">
                  {getSpeakerInitial(trackSpeaker)}
                </div>
              )}
                <div className="player-now__body">
                  <div className="player-now__title-row">
                    <strong className="player-now__name">{trackSpeaker}</strong>
                    <span className={`player-now__chip ${playerStatusClass}`}>
                      {playerStatusLabel}
                    </span>
                    <span className="player-now__chip is-secondary">{queuePositionText}</span>
                  </div>
                <p className="player-now__meta">{nowMetaPrimary}</p>
                <p className="player-now__sub">{nowMetaSecondary}</p>
              </div>
            </section>
          ) : null}

          <div className="player-core">
            <div className={`player-controls ${hasQueue ? "" : "is-idle"}`}>
              <button
                className="control-btn btn-secondary"
                title="上一首"
                onClick={() => hasQueue && playPrev()}
                disabled={!hasQueue || playlist.length <= 1}
              >
                <i className="fa-solid fa-backward-step" aria-hidden="true" />
              </button>
              <button
                className="control-btn play-pause-btn btn-primary"
                onClick={handleTogglePlay}
                disabled={playButtonConfig.disabled}
                aria-label={playButtonConfig.ariaLabel}
              >
                <i className={`fa-solid ${playButtonConfig.icon}`} aria-hidden="true" />
              </button>
              <button
                className="control-btn btn-secondary"
                title="下一首"
                onClick={() => hasQueue && playNext()}
                disabled={!hasQueue || playlist.length <= 1}
              >
                <i className="fa-solid fa-forward-step" aria-hidden="true" />
              </button>
            </div>

            {hasQueue ? (
              <div className="player-actions">
                <button
                  className={`control-btn control-btn--loop btn-secondary ${isLoop ? "is-active" : ""}`}
                  title={isLoop ? "關閉循環播放" : "開啟循環播放"}
                  onClick={handleLoopToggle}
                  aria-label={isLoop ? "關閉循環播放" : "開啟循環播放"}
                >
                  <i className="fa-solid fa-repeat" aria-hidden="true" />
                </button>
                {playlist.length ? (
                  <button
                    className={`control-btn btn-secondary ${isExpanded ? "is-active" : ""}`}
                    title={isExpanded ? "收合播放清單" : "展開播放清單"}
                    onClick={handleQueueToggle}
                    aria-label={isExpanded ? "收合播放清單" : "展開播放清單"}
                  >
                    <i className="fa-solid fa-list" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        {showPlaybackNotice ? (
          <div className={`player-notice player-notice--${playbackNotice.type || "info"}`} role="status" aria-live="polite">
            <p className="player-notice__text">{playbackNotice.message}</p>
            <button
              type="button"
              className="player-notice__dismiss"
              onClick={clearPlaybackNotice}
              aria-label="關閉提示"
            >
              <i className="fa-solid fa-xmark" aria-hidden="true" />
            </button>
          </div>
        ) : null}

        {playerPhase === "ended" && hasQueue ? (
          <div className="player-ended-cta" role="status" aria-live="polite">
            <p className="player-ended-cta__title">{endedTitle}</p>
            <div className="player-ended-cta__actions">
              <button
                type="button"
                className="player-ended-cta__btn btn-secondary"
                onClick={handleRestartFromBeginning}
              >
                重新播放
              </button>
              <button
                type="button"
                className="player-ended-cta__btn player-ended-cta__btn--primary btn-primary"
                onClick={handleEnableLoopFromBeginning}
              >
                開啟循環重播
              </button>
            </div>
          </div>
        ) : null}

        {!hasQueue ? <div className="player-empty-hint">{FALLBACK_EMPTY_HINT}</div> : null}

        {playlist.length ? (
          <div className={`player-queue-panel ${isExpanded ? "is-open" : ""}`}>
            <div className="player-queue-header">
              <div>
                <p className="eyebrow">播放清單</p>
                <strong>{playlist.length} 首音檔</strong>
              </div>
              <button type="button" className="queue-toggle btn-secondary" onClick={handleQueueToggle}>
                {isExpanded ? "收合" : "展開"}
              </button>
            </div>
            {isExpanded ? (
              <ul className="player-queue-list">
                {playlist.map((track, index) => {
                  const isActive = currentTrack ? isSameTrack(currentTrack, track) : false;
                  return (
                    <li key={track.id ?? index} className={`player-queue-item${isActive ? " is-active" : ""}`}>
                      <button
                        type="button"
                        className="queue-track"
                        onClick={() => selectTrack(index)}
                        aria-current={isActive ? "true" : "false"}
                      >
                        <span className="queue-track__speaker">{track.speaker || FALLBACK_SPEAKER}</span>
                        <span className="queue-track__title">
                          {track.message || track.requestTitle || FALLBACK_TITLE}
                        </span>
                      </button>
                      <button
                        type="button"
                        className="queue-track__delete"
                        aria-label="移除此音檔"
                        onClick={() => removeTrack(track.id)}
                      >
                        <i className="fa-solid fa-xmark" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        ) : null}
      </div>
    </>
  );
}

