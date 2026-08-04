"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { useAudio } from "@/context/AudioContext";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";

const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Builds the shape AudioContext's playlist expects (id + voiceUrl are the only
// hard requirements — see getTrackKey/sanitizeTrack in src/context/AudioContext.js).
// message doubles as the queue-list label; anonymous responses have no responder,
// so we fall back to the anonymousLabel text.
function toTrack(response, anonymousLabel) {
  return {
    id: response.id,
    voiceUrl: response.voiceUrl,
    message: response.message || "",
    speaker: response.responder?.name || anonymousLabel,
    requestTitle: response.message || anonymousLabel,
  };
}

export default function CompanionOverlay({ responses, text, onExit }) {
  const {
    playlist,
    currentTrack,
    isPlaying,
    isLoop,
    playerPhase,
    playbackNotice,
    clearPlaybackNotice,
    setQueue,
    playByIndex,
    togglePlay,
    pause,
    setIsLoop,
    removeTrack,
  } = useAudio();

  const overlayRef = useRef(null);
  const previouslyFocusedRef = useRef(null);
  const menuTriggerRefs = useRef({});
  const [openMenuTrackId, setOpenMenuTrackId] = useState(null);
  const [reportState, setReportState] = useState({}); // trackId -> "confirming" | "sending" | "sent" | "failed"
  const [reportSuccessMessage, setReportSuccessMessage] = useState("");

  useEffect(() => {
    if (!reportSuccessMessage) return;
    const timeoutId = window.setTimeout(() => setReportSuccessMessage(""), 3000);
    return () => window.clearTimeout(timeoutId);
  }, [reportSuccessMessage]);

  useEffect(() => {
    const tracks = responses.map((response) => toTrack(response, text.anonymousLabel));
    setQueue(tracks, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    previouslyFocusedRef.current = document.activeElement;
    const closeButton = overlayRef.current?.querySelector('[data-companion-close="true"]');
    closeButton?.focus();
    return () => {
      if (previouslyFocusedRef.current instanceof HTMLElement) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, []);

  const handleExit = () => {
    pause();
    setQueue([]);
    onExit?.();
  };

  // Closes the per-item "..." menu and returns focus to its trigger button,
  // rather than leaving focus stranded on a now-hidden menu item.
  const closeItemMenu = (trackId) => {
    setOpenMenuTrackId(null);
    const trigger = menuTriggerRefs.current[trackId];
    trigger?.focus?.();
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        if (openMenuTrackId) {
          event.preventDefault();
          event.stopPropagation();
          closeItemMenu(openMenuTrackId);
          return;
        }
        event.preventDefault();
        handleExit();
        return;
      }
      if (event.key !== "Tab") return;
      const container = overlayRef.current;
      if (!container) return;
      const focusable = Array.from(container.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [openMenuTrackId]);

  // Click-outside-closes-menu: only wired up while a menu is actually open.
  useEffect(() => {
    if (!openMenuTrackId) return undefined;
    const handlePointerDown = (event) => {
      const container = overlayRef.current;
      if (!container) return;
      const menuEl = container.querySelector(`[data-companion-menu="${openMenuTrackId}"]`);
      if (menuEl && !menuEl.contains(event.target)) {
        setOpenMenuTrackId(null);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openMenuTrackId]);

  const activeIndex = useMemo(() => {
    if (!currentTrack) return -1;
    return playlist.findIndex((track) => track.id === currentTrack.id);
  }, [currentTrack, playlist]);

  const handleReportClick = (trackId) => {
    setReportState((prev) => ({ ...prev, [trackId]: "confirming" }));
  };

  const handleReportCancel = (trackId) => {
    setReportState((prev) => ({ ...prev, [trackId]: undefined }));
    closeItemMenu(trackId);
  };

  const handleReportConfirm = async (trackId) => {
    setReportState((prev) => ({ ...prev, [trackId]: "sending" }));
    try {
      // Server decides the reporter's identity (session or guest cookie) —
      // no reporterId/userId is ever sent from the client. Works the same
      // for logged-in members and anonymous visitors on both the homepage
      // and /prayfor/[id] (see docs/obsidian/26-Anonymous-Reporting-Design.md).
      const response = await fetch("/api/prayer-response/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ responseId: trackId, reason: "other" }),
      });
      if (!response.ok) throw new Error("report failed");
      setReportState((prev) => ({ ...prev, [trackId]: "sent" }));
      // Backend has already hidden the response (moderationStatus/isBlocked).
      // removeTrack is the same local-removal used by X — reused here only to
      // stop playback/adjust the index immediately; the backend hide is what
      // makes it not reappear next time the playlist is fetched.
      removeTrack(trackId);
      setOpenMenuTrackId(null);
      setReportSuccessMessage(text.reportSuccess);
      // Same "responses changed, please refetch" signal PrayerRecorder fires on a
      // new submission — reused here so the companion-entry count on the page
      // underneath (and DetailAudioQueueBootstrap's bottom-player queue on
      // /prayfor/[id]) drop this response too, not just the open overlay's local
      // playlist. Without this, the entry button/bottom queue would still count a
      // response the backend just hid.
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED));
      }
    } catch {
      setReportState((prev) => ({ ...prev, [trackId]: "failed" }));
    }
  };

  const isEmpty = playlist.length === 0;

  return (
    <div
      className="companion"
      role="dialog"
      aria-modal="true"
      aria-label={text.companionTitle}
      ref={overlayRef}
    >
      <div className="companion__header">
        {!isEmpty ? (
          <span className="companion__position">
            {activeIndex >= 0 ? activeIndex + 1 : 1} / {playlist.length}
          </span>
        ) : null}
        <button
          type="button"
          className="companion__btn companion__btn--ghost"
          onClick={handleExit}
          data-companion-close="true"
        >
          {text.exit}
        </button>
      </div>

      {reportSuccessMessage ? (
        <p className="companion__notice" role="status">
          {reportSuccessMessage}
        </p>
      ) : null}

      {playbackNotice?.message ? (
        <p className="companion__notice" role="status">
          {playbackNotice.message}
          <button type="button" onClick={clearPlaybackNotice} aria-label={text.dismissNotice}>
            ×
          </button>
        </p>
      ) : null}

      {isEmpty ? (
        <div className="companion__empty">
          <p>{text.emptyPlaylist}</p>
          <button type="button" className="companion__btn companion__btn--primary" onClick={handleExit}>
            {text.exit}
          </button>
        </div>
      ) : (
        <>
          <div className="companion__controls">
            <button
              type="button"
              className="companion__btn companion__btn--primary"
              onClick={togglePlay}
              disabled={playerPhase === "recovering"}
            >
              {isPlaying ? text.pause : text.play}
            </button>
            <button
              type="button"
              className={`companion__btn companion__btn--ghost${isLoop ? " is-active" : ""}`}
              onClick={() => setIsLoop(!isLoop)}
              aria-pressed={isLoop}
            >
              {text.loop}
            </button>
            <button type="button" className="companion__btn companion__btn--ghost" onClick={pause}>
              {text.stop}
            </button>
          </div>

          <ul className="companion__list">
            {playlist.map((track, index) => {
              const isActive = currentTrack?.id === track.id;
              const state = reportState[track.id];
              return (
                <li key={track.id} className={`companion__item${isActive ? " is-active" : ""}`}>
                  <button
                    type="button"
                    className="companion__item-main"
                    onClick={() => playByIndex(index)}
                    aria-current={isActive ? "true" : "false"}
                  >
                    <span className="companion__item-speaker">{track.speaker}</span>
                    {track.message ? <span className="companion__item-message">{track.message}</span> : null}
                  </button>

                  <div className="companion__item-actions">
                    <button
                      type="button"
                      className="companion__item-remove"
                      aria-label={text.removeFromPlaylist}
                      onClick={() => removeTrack(track.id)}
                    >
                      ×
                    </button>

                    <div className="companion__menu" data-companion-menu={track.id}>
                      <button
                        type="button"
                        ref={(el) => {
                          menuTriggerRefs.current[track.id] = el;
                        }}
                        className="companion__item-menu-trigger"
                        aria-label={text.moreOptions}
                        aria-haspopup="menu"
                        aria-expanded={openMenuTrackId === track.id}
                        onClick={() => setOpenMenuTrackId(openMenuTrackId === track.id ? null : track.id)}
                      >
                        ⋯
                      </button>
                      {openMenuTrackId === track.id ? (
                        <div className="companion__menu-panel" role="menu">
                          {state === "confirming" ? (
                            <>
                              <p>{text.reportConfirm}</p>
                              <button type="button" role="menuitem" onClick={() => handleReportConfirm(track.id)}>
                                {text.reportConfirmYes}
                              </button>
                              <button type="button" role="menuitem" onClick={() => handleReportCancel(track.id)}>
                                {text.reportConfirmNo}
                              </button>
                            </>
                          ) : state === "sending" ? (
                            <p role="status" aria-live="polite">
                              {text.reportSending}
                            </p>
                          ) : state === "failed" ? (
                            <>
                              <p role="alert">{text.reportFailed}</p>
                              <button type="button" role="menuitem" onClick={() => handleReportClick(track.id)}>
                                {text.retry}
                              </button>
                            </>
                          ) : (
                            <button type="button" role="menuitem" onClick={() => handleReportClick(track.id)}>
                              {text.report}
                            </button>
                          )}
                        </div>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </>
      )}

      <style jsx>{`
        .companion {
          position: fixed;
          inset: 0;
          z-index: 200;
          background: #050b17;
          color: #f5f7fb;
          display: flex;
          flex-direction: column;
          padding: 1.25rem;
          overflow-y: auto;
        }

        .companion__header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }

        .companion__position {
          font-size: 0.85rem;
          opacity: 0.75;
        }

        .companion__btn {
          min-height: 44px;
          min-width: 44px;
          padding: 0.6rem 1.25rem;
          border: none;
          border-radius: 999px;
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
        }

        .companion__btn--primary {
          background: #38bdf8;
          color: #04121f;
        }

        .companion__btn--ghost {
          background: rgba(255, 255, 255, 0.12);
          color: #f5f7fb;
        }

        .companion__btn--ghost.is-active {
          background: #38bdf8;
          color: #04121f;
        }

        .companion__btn:focus-visible,
        .companion__item-remove:focus-visible,
        .companion__item-menu-trigger:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 2px;
        }

        .companion__notice {
          margin: 1rem 0 0;
          padding: 0.5rem 0.9rem;
          border-radius: 0.6rem;
          background: rgba(255, 255, 255, 0.12);
          font-size: 0.85rem;
          display: flex;
          justify-content: space-between;
          gap: 0.5rem;
        }

        .companion__empty {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          text-align: center;
        }

        .companion__controls {
          display: flex;
          gap: 0.75rem;
          margin: 1.5rem 0;
          flex-wrap: wrap;
        }

        .companion__list {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .companion__item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.06);
          border-radius: 0.75rem;
          padding: 0.5rem 0.75rem;
        }

        .companion__item.is-active {
          background: rgba(56, 189, 248, 0.18);
        }

        .companion__item-main {
          flex: 1;
          text-align: left;
          background: none;
          border: none;
          color: inherit;
          cursor: pointer;
          display: flex;
          flex-direction: column;
          gap: 0.15rem;
          padding: 0.4rem 0;
          min-height: 44px;
        }

        .companion__item-speaker {
          font-weight: 600;
          font-size: 0.9rem;
        }

        .companion__item-message {
          font-size: 0.8rem;
          opacity: 0.75;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .companion__item-actions {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          position: relative;
        }

        .companion__item-remove,
        .companion__item-menu-trigger {
          min-width: 44px;
          min-height: 44px;
          border: none;
          background: transparent;
          color: inherit;
          font-size: 1.1rem;
          cursor: pointer;
        }

        .companion__menu-panel {
          position: absolute;
          right: 0;
          top: 100%;
          background: #101a2c;
          border-radius: 0.6rem;
          padding: 0.5rem;
          display: flex;
          flex-direction: column;
          gap: 0.4rem;
          min-width: 180px;
          z-index: 1;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
        }

        .companion__menu-panel button {
          min-height: 44px;
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 0.5rem;
          color: inherit;
          cursor: pointer;
        }

        @media (prefers-reduced-motion: reduce) {
          .companion {
            scroll-behavior: auto;
          }
        }
      `}</style>
    </div>
  );
}
