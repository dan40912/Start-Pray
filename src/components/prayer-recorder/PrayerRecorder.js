"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

import { usePrayerRecorder } from "./usePrayerRecorder";
import { formatDuration } from "./recorder-utils";

// Maps a POST /api/responses failure to one of the i18n error keys below.
// The API (src/app/api/responses/route.js) doesn't return a `code` for every
// failure path (e.g. file-too-large and bad-MIME both just return HTTP 422
// with no code), so this intentionally buckets by HTTP status first.
function mapSubmitErrorKey(status, code) {
  if (status === 429 || code === "RATE_LIMITED") return "rateLimited";
  if (status >= 500 || code === "SERVER_ERROR" || code === "VOICE_UNAVAILABLE") return "server";
  return "rejected";
}

export default function PrayerRecorder({ text, onExit }) {
  const recorder = usePrayerRecorder();
  const {
    phase,
    countdownValue,
    elapsedSeconds,
    previewUrl,
    isPlaying,
    setIsPlaying,
    errorReason,
    transientMessage,
    setTransientMessage,
    confirmingRerecord,
    maxDurationSeconds,
    getBlob,
    requestPermission,
    finishRecording,
    requestRerecord,
    cancelRerecordConfirm,
    confirmRerecord,
    cancel,
    retryAfterError,
  } = recorder;

  const audioRef = useRef(null);
  const [submitState, setSubmitState] = useState("idle"); // idle | uploading | success | failed
  const [submitErrorKey, setSubmitErrorKey] = useState("");

  useEffect(() => {
    requestPermission();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (transientMessage === "too-short") {
      const timeoutId = window.setTimeout(() => setTransientMessage(""), 2400);
      return () => window.clearTimeout(timeoutId);
    }
  }, [transientMessage, setTransientMessage]);

  const handleExit = () => {
    cancel();
    onExit?.();
  };

  const togglePlayback = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => setTransientMessage("playback"));
    } else {
      audioEl.pause();
    }
  };

  const handleSubmit = async () => {
    if (submitState === "uploading") return;
    const blob = getBlob();
    if (!blob) {
      setSubmitErrorKey("rejected");
      setSubmitState("failed");
      return;
    }
    setSubmitState("uploading");
    try {
      const cardResponse = await fetch("/api/home-cards?mode=one");
      const card = cardResponse.ok ? await cardResponse.json() : null;
      if (!card?.id) {
        setSubmitErrorKey("rejected");
        setSubmitState("failed");
        return;
      }

      const extension = blob.type?.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.set("requestId", String(card.id));
      formData.set("isAnonymous", "true");
      formData.set("website", "");
      formData.set("audio", blob, `prayer-${Date.now()}.${extension}`);

      const response = await fetch("/api/responses", { method: "POST", body: formData });
      if (response.ok) {
        setSubmitState("success");
        return;
      }
      const body = await response.json().catch(() => null);
      setSubmitErrorKey(mapSubmitErrorKey(response.status, body?.code));
      setSubmitState("failed");
    } catch {
      setSubmitErrorKey("network");
      setSubmitState("failed");
    }
  };

  const submitErrorText = {
    rateLimited: text.submitErrorRateLimited,
    rejected: text.submitErrorRejected,
    server: text.submitErrorServer,
    network: text.submitErrorNetwork,
  }[submitErrorKey] || text.submitErrorServer;

  return (
    <div className="prayer-recorder" role="group" aria-label={text.previewLabel}>
      {phase === "permission-explanation" && (
        <div className="prayer-recorder__step">
          <h2>{text.permissionTitle}</h2>
          <p>{text.permissionBody}</p>
          <div className="prayer-recorder__actions">
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={requestPermission}>
              {text.allowMic}
            </button>
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
              {text.cancel}
            </button>
          </div>
        </div>
      )}

      {phase === "requesting-permission" && (
        <div className="prayer-recorder__step" aria-live="polite">
          <p>{text.requesting}</p>
        </div>
      )}

      {phase === "permission-denied" && (
        <div className="prayer-recorder__step">
          <h2>{text.deniedTitle}</h2>
          <p>{text.deniedBody}</p>
          <div className="prayer-recorder__actions">
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={requestPermission}>
              {text.retry}
            </button>
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
              {text.back}
            </button>
          </div>
        </div>
      )}

      {phase === "unsupported" && (
        <div className="prayer-recorder__step">
          <h2>{text.unsupportedTitle}</h2>
          <p>{text.unsupportedBody}</p>
          <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
            {text.back}
          </button>
        </div>
      )}

      {phase === "countdown" && (
        <div className="prayer-recorder__step">
          <div className="prayer-recorder__countdown" aria-live="assertive">
            {countdownValue}
          </div>
          <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
            {text.cancel}
          </button>
        </div>
      )}

      {phase === "recording" && (
        <div className="prayer-recorder__step">
          <div className="prayer-recorder__status" aria-live="polite">
            <span className="prayer-recorder__rec-dot" aria-hidden="true" />
            {text.recordingLabel} · {formatDuration(elapsedSeconds)}
          </div>
          <p className="prayer-recorder__remaining">
            {text.remainingLabel} {Math.max(0, maxDurationSeconds - elapsedSeconds)}
            {text.seconds}
          </p>
          <button
            type="button"
            className="prayer-recorder__btn prayer-recorder__btn--primary prayer-recorder__stop"
            onClick={finishRecording}
            aria-label={text.stop}
          >
            {text.stop}
          </button>
          {transientMessage === "too-short" ? (
            <p className="prayer-recorder__notice" role="status">
              {text.tooShort}
            </p>
          ) : null}
        </div>
      )}

      {phase === "preview" && (
        <div className="prayer-recorder__step">
          <audio
            ref={audioRef}
            src={previewUrl}
            preload="metadata"
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => setIsPlaying(false)}
            onError={() => setTransientMessage("playback")}
          />

          {submitState === "idle" && (
            <>
              <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={togglePlayback}>
                {isPlaying ? text.pause : text.play}
              </button>
              {transientMessage === "playback" ? (
                <p className="prayer-recorder__notice" role="status">
                  {text.playbackError}
                </p>
              ) : null}

              {confirmingRerecord ? (
                <div className="prayer-recorder__confirm" role="alertdialog" aria-label={text.rerecordConfirmTitle}>
                  <p>{text.rerecordConfirmTitle}</p>
                  <p>{text.rerecordConfirmBody}</p>
                  <div className="prayer-recorder__actions">
                    <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={confirmRerecord}>
                      {text.rerecordConfirmYes}
                    </button>
                    <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={cancelRerecordConfirm}>
                      {text.rerecordConfirmNo}
                    </button>
                  </div>
                </div>
              ) : (
                <div className="prayer-recorder__actions">
                  <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={requestRerecord}>
                    {text.rerecord}
                  </button>
                  <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={handleSubmit}>
                    {text.nextStepAnonymous}
                  </button>
                </div>
              )}
            </>
          )}

          {submitState === "uploading" && (
            <p className="prayer-recorder__notice" role="status" aria-live="polite">
              {text.uploading}
            </p>
          )}

          {submitState === "success" && (
            <div className="prayer-recorder__step">
              <h2>{text.successTitle}</h2>
              <p>{text.successBody}</p>
              <div className="prayer-recorder__actions">
                <Link href="/prayfor/one" className="prayer-recorder__btn prayer-recorder__btn--primary">
                  {text.listenAnother}
                </Link>
                <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
                  {text.backToHome}
                </button>
              </div>
            </div>
          )}

          {submitState === "failed" && (
            <div className="prayer-recorder__step">
              <p role="alert">{submitErrorText}</p>
              <div className="prayer-recorder__actions">
                <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={handleSubmit}>
                  {text.retrySubmit}
                </button>
                <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
                  {text.back}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {phase === "error" && (
        <div className="prayer-recorder__step">
          <h2>
            {errorReason === "stream-lost"
              ? text.errorStreamLostTitle
              : errorReason === "empty"
                ? text.errorEmptyTitle
                : text.errorDeviceTitle}
          </h2>
          <p>
            {errorReason === "stream-lost"
              ? text.errorStreamLostBody
              : errorReason === "empty"
                ? text.errorEmptyBody
                : text.errorDeviceBody}
          </p>
          <div className="prayer-recorder__actions">
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={retryAfterError}>
              {text.retry}
            </button>
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
              {text.back}
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        .prayer-recorder {
          width: 100%;
          display: flex;
          justify-content: center;
        }

        .prayer-recorder__step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.85rem;
          text-align: center;
          max-width: 480px;
        }

        .prayer-recorder__step h2 {
          margin: 0;
          font-size: 1.35rem;
        }

        .prayer-recorder__step p {
          margin: 0;
          color: var(--text-secondary);
        }

        .prayer-recorder__actions {
          display: flex;
          gap: 0.75rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .prayer-recorder__btn {
          min-height: 48px;
          min-width: 44px;
          padding: 0.75rem 1.75rem;
          border: none;
          border-radius: 999px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .prayer-recorder__btn--primary {
          background: var(--accent);
          color: #fff;
        }

        .prayer-recorder__btn--ghost {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .prayer-recorder__btn:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
        }

        .prayer-recorder__countdown {
          font-size: 4rem;
          font-weight: 700;
          color: var(--accent);
        }

        .prayer-recorder__status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
        }

        .prayer-recorder__rec-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          animation: prayer-recorder-pulse 1.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-recorder__rec-dot {
            animation: none;
          }
        }

        @keyframes prayer-recorder-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .prayer-recorder__remaining {
          font-size: 0.9rem;
        }

        .prayer-recorder__stop {
          min-width: 160px;
        }

        .prayer-recorder__notice {
          font-size: 0.85rem;
          background: var(--accent-soft);
          color: var(--text-secondary);
          padding: 0.5rem 0.9rem;
          border-radius: 0.6rem;
        }

        .prayer-recorder__confirm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        @media (max-width: 480px) {
          .prayer-recorder__btn {
            width: 100%;
            max-width: 280px;
          }
        }
      `}</style>
    </div>
  );
}
