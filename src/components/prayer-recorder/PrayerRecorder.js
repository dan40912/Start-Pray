"use client";

import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import GainAudio from "@/components/GainAudio";
import Link from "next/link";

import { usePrayerRecorder } from "./usePrayerRecorder";
import { formatDuration, hasRecordingSupport } from "./recorder-utils";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";

// Maps a POST /api/responses failure to one of the i18n error keys below.
// The API (src/app/api/responses/route.js) doesn't return a `code` for every
// failure path (e.g. file-too-large and bad-MIME both just return HTTP 422
// with no code), so this intentionally buckets by HTTP status first.
// Mirrors the server's own limits in src/app/api/responses/route.js so the
// button disables before a round trip rather than after a 422.
const TEXT_MIN_LENGTH = 8;
const TEXT_MAX_LENGTH = 2000;

function mapSubmitErrorKey(status, code) {
  if (status === 429 || code === "RATE_LIMITED") return "rateLimited";
  if (status >= 500 || code === "SERVER_ERROR" || code === "VOICE_UNAVAILABLE") return "server";
  return "rejected";
}

const PrayerRecorder = forwardRef(function PrayerRecorder({ text, prayerId, onExit, onStateChange }, ref) {
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
    inputLevel,
    heardSound,
  } = recorder;

  const audioRef = useRef(null);
  const [submitState, setSubmitState] = useState("idle"); // idle | uploading | success | failed
  // null = the chooser is showing. Entering this component no longer drops
  // straight into a microphone prompt, because when that prompt is blocked the
  // whole flow used to dead-end with no way to still pray.
  const [mode, setMode] = useState(null); // null | "text" | "voice"
  const [draft, setDraft] = useState("");
  // "checking" until the Permissions API answers. "denied" is the only state
  // that disables the voice option — "prompt" still gets to try.
  const [micState, setMicState] = useState("checking"); // checking | ready | denied | unsupported
  const [submitErrorKey, setSubmitErrorKey] = useState("");

  // Probe, don't prompt. permissions.query() reports the current state without
  // showing the browser dialog, so the chooser can render with an honest voice
  // button instead of firing a permission prompt at someone who may only have
  // wanted to type. Safari has no "microphone" permission name — the query
  // throws there, and we fall back to "ready" so those users can still try.
  useEffect(() => {
    let active = true;
    (async () => {
      if (!hasRecordingSupport()) {
        if (active) setMicState("unsupported");
        return;
      }
      try {
        const status = await navigator.permissions.query({ name: "microphone" });
        if (!active) return;
        setMicState(status.state === "denied" ? "denied" : "ready");
        status.onchange = () => setMicState(status.state === "denied" ? "denied" : "ready");
      } catch {
        if (active) setMicState("ready");
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const chooseVoice = () => {
    setMode("voice");
    requestPermission();
  };

  useEffect(() => {
    if (transientMessage === "too-short") {
      const timeoutId = window.setTimeout(() => setTransientMessage(""), 2400);
      return () => window.clearTimeout(timeoutId);
    }
  }, [transientMessage, setTransientMessage]);

  // Lets a parent (HomePrayerHero) know whether it's safe to switch to a
  // different Prayer or open companion playback right now — e.g. mid-recording
  // or mid-upload should block navigation (see docs/obsidian/10-Implementation-Plan.md
  // Commit B, section on state protection).
  useEffect(() => {
    onStateChange?.({ phase, submitState, confirmingRerecord });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, submitState, confirmingRerecord]);

  useImperativeHandle(
    ref,
    () => ({
      discard: () => cancel(),
    }),
    [cancel]
  );

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

  const trimmedDraft = draft.trim();
  const draftTooShort = trimmedDraft.length > 0 && trimmedDraft.length < TEXT_MIN_LENGTH;
  const draftTooLong = trimmedDraft.length > TEXT_MAX_LENGTH;
  const canSubmitText = trimmedDraft.length >= TEXT_MIN_LENGTH && !draftTooLong;

  // Same endpoint, same anonymous flag and same success/failure states as the
  // voice path — only the payload differs, so both routes land the person on
  // the identical "你的禱告已送出" screen.
  const handleSubmitText = async () => {
    if (submitState === "uploading" || !canSubmitText || !prayerId) return;
    setSubmitState("uploading");
    try {
      const formData = new FormData();
      formData.set("requestId", String(prayerId));
      formData.set("isAnonymous", "true");
      formData.set("website", "");
      formData.set("message", trimmedDraft);

      const response = await fetch("/api/responses", { method: "POST", body: formData });
      if (response.ok) {
        const saved = await response.json().catch(() => null);
        setSubmitState("success");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED, { detail: saved }));
        }
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

  const handleSubmit = async () => {
    if (submitState === "uploading") return;
    const blob = getBlob();
    if (!blob || !prayerId) {
      setSubmitErrorKey("rejected");
      setSubmitState("failed");
      return;
    }
    setSubmitState("uploading");
    try {
      const extension = blob.type?.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.set("requestId", String(prayerId));
      formData.set("isAnonymous", "true");
      formData.set("website", "");
      formData.set("audio", blob, `prayer-${Date.now()}.${extension}`);

      const response = await fetch("/api/responses", { method: "POST", body: formData });
      if (response.ok) {
        const saved = await response.json().catch(() => null);
        setSubmitState("success");
        if (typeof window !== "undefined") {
          window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED, { detail: saved }));
        }
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

  // Shared by the voice and the text path so both land on the same
  // confirmation — only the retry handler differs.
  const renderSubmitState = (onRetry) => (
    <>
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
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--primary" onClick={onRetry}>
              {text.retrySubmit}
            </button>
            <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
              {text.back}
            </button>
          </div>
        </div>
      )}
    </>
  );

  const submitErrorText = {
    rateLimited: text.submitErrorRateLimited,
    rejected: text.submitErrorRejected,
    server: text.submitErrorServer,
    network: text.submitErrorNetwork,
  }[submitErrorKey] || text.submitErrorServer;

  return (
    <div className="prayer-recorder" role="group" aria-label={text.previewLabel}>
      {mode === null && submitState === "idle" && (
        <div className="prayer-recorder__step">
          <h2>{text.chooseTitle}</h2>
          <div className="prayer-recorder__choices">
            <button
              type="button"
              className="prayer-recorder__choice"
              onClick={() => setMode("text")}
            >
              <span className="prayer-recorder__choice-title">{text.chooseText}</span>
              <span className="prayer-recorder__choice-hint">{text.chooseTextHint}</span>
            </button>
            <button
              type="button"
              className="prayer-recorder__choice"
              onClick={chooseVoice}
              disabled={micState === "denied" || micState === "unsupported"}
            >
              <span className="prayer-recorder__choice-title">{text.chooseVoice}</span>
              <span className="prayer-recorder__choice-hint">
                {micState === "denied"
                  ? text.chooseVoiceDenied
                  : micState === "unsupported"
                    ? text.chooseVoiceUnsupported
                    : text.chooseVoiceHint}
              </span>
            </button>
          </div>
          <button type="button" className="prayer-recorder__btn prayer-recorder__btn--ghost" onClick={handleExit}>
            {text.cancel}
          </button>
        </div>
      )}

      {mode === "text" && (
        <div className="prayer-recorder__step">
          {submitState === "idle" && (
            <>
              <h2>{text.textTitle}</h2>
              <textarea
                className="prayer-recorder__textarea"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={text.textPlaceholder}
                rows={5}
                maxLength={TEXT_MAX_LENGTH}
                aria-label={text.textTitle}
              />
              <p className="prayer-recorder__counter" aria-live="polite">
                {draftTooLong
                  ? text.textTooLong
                  : draftTooShort
                    ? text.textTooShort
                    : `${trimmedDraft.length} / ${TEXT_MAX_LENGTH}`}
              </p>
              <div className="prayer-recorder__actions">
                <button
                  type="button"
                  className="prayer-recorder__btn prayer-recorder__btn--primary"
                  onClick={handleSubmitText}
                  disabled={!canSubmitText}
                >
                  {text.textSubmit}
                </button>
                <button
                  type="button"
                  className="prayer-recorder__btn prayer-recorder__btn--ghost"
                  onClick={() => setMode(null)}
                >
                  {text.back}
                </button>
              </div>
              <p className="prayer-recorder__notice">{text.anonymousNote}</p>
            </>
          )}
          {renderSubmitState(handleSubmitText)}
        </div>
      )}

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
          <div
            className="prayer-recorder__meter"
            role="img"
            aria-label={heardSound ? text.meterActive : text.meterSilent}
          >
            <span
              className="prayer-recorder__meter-fill"
              style={{ transform: `scaleX(${Math.max(0.02, inputLevel)})` }}
            />
          </div>
          {!heardSound && elapsedSeconds >= 2 ? (
            <p className="prayer-recorder__notice" role="status">
              {text.noSoundYet}
            </p>
          ) : null}
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
          <GainAudio
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

          {renderSubmitState(handleSubmit)}
        </div>
      )}

      {phase === "error" && (
        <div className="prayer-recorder__step">
          <h2>
            {errorReason === "stream-lost"
              ? text.errorStreamLostTitle
              : errorReason === "silent"
                ? text.errorSilentTitle
                : errorReason === "empty"
                  ? text.errorEmptyTitle
                  : text.errorDeviceTitle}
          </h2>
          <p>
            {errorReason === "stream-lost"
              ? text.errorStreamLostBody
              : errorReason === "silent"
                ? text.errorSilentBody
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

        .prayer-recorder__choices {
          display: grid;
          gap: 0.6rem;
          width: 100%;
        }

        .prayer-recorder__choice {
          display: flex;
          flex-direction: column;
          gap: 0.2rem;
          padding: 0.85rem 1rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(255, 255, 255, 0.06);
          color: inherit;
          text-align: left;
          cursor: pointer;
        }

        .prayer-recorder__choice:hover:not(:disabled) {
          border-color: rgba(226, 160, 90, 0.7);
          background: rgba(226, 160, 90, 0.12);
        }

        .prayer-recorder__choice:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .prayer-recorder__choice-title {
          font-weight: 600;
        }

        .prayer-recorder__choice-hint {
          font-size: 0.82rem;
          opacity: 0.75;
        }

        .prayer-recorder__textarea {
          width: 100%;
          padding: 0.75rem 0.9rem;
          border-radius: 0.75rem;
          border: 1px solid rgba(148, 163, 184, 0.35);
          background: rgba(255, 255, 255, 0.06);
          color: inherit;
          font: inherit;
          resize: vertical;
        }

        .prayer-recorder__counter {
          font-size: 0.8rem;
          opacity: 0.7;
          font-variant-numeric: tabular-nums;
        }

        /* Shows the microphone is actually picking something up. Without it a
           muted input looks identical to a working one until after the fact. */
        .prayer-recorder__meter {
          width: min(260px, 100%);
          height: 6px;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.25);
          overflow: hidden;
        }

        .prayer-recorder__meter-fill {
          display: block;
          width: 100%;
          height: 100%;
          border-radius: 999px;
          background: #34d399;
          transform-origin: left center;
          transition: transform 90ms linear;
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-recorder__meter-fill {
            transition: none;
          }
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
});

export default PrayerRecorder;
