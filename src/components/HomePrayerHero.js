"use client";

import { useEffect, useRef, useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";
import CompanionOverlay from "@/components/home-companion/CompanionOverlay";
import { resolveArrowKeyDirection, resolveSwipeDirection } from "@/components/home-companion/swipe-utils";

// HomePrayerCard.voiceHref sometimes points at a legacy HTML page
// (e.g. "/legacy/prayfor/details.html?prayer=pc-509#voice") rather than a
// playable audio file. Only render a native <audio> element when the href
// looks like a real media asset, so we never silently show a broken player.
const AUDIO_EXTENSION_PATTERN = /\.(mp3|wav|webm|m4a|aac|ogg)$/i;
function isPlayableVoiceHref(href) {
  if (typeof href !== "string" || !href) return false;
  if (href.startsWith("/voices/") || href.startsWith("/uploads/")) return true;
  return AUDIO_EXTENSION_PATTERN.test(href);
}

function toPlainText(value) {
  if (!value) return "";
  return String(value)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<[^>]*>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
}

const BLOCKING_RECORDER_PHASES = new Set(["requesting-permission", "countdown", "recording"]);

export default function HomePrayerHero({ text, prayer }) {
  const copy = text.prayerHero;
  const companionText = text.companion;

  const [currentPrayer, setCurrentPrayer] = useState(prayer || null);
  const [adjacent, setAdjacent] = useState({ prev: null, next: null });
  const [playableResponses, setPlayableResponses] = useState([]);
  const [recorderActive, setRecorderActive] = useState(false);
  const [recorderState, setRecorderState] = useState(null);
  const [companionOpen, setCompanionOpen] = useState(false);
  const [switchConfirm, setSwitchConfirm] = useState(null); // { direction } | null
  const [blockedMessage, setBlockedMessage] = useState("");

  const recorderRef = useRef(null);
  const requestGenerationRef = useRef(0);
  const heroRef = useRef(null);
  const touchStartRef = useRef(null);

  useEffect(() => {
    setCurrentPrayer(prayer || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayer?.id]);

  useEffect(() => {
    if (!currentPrayer?.id) {
      setAdjacent({ prev: null, next: null });
      setPlayableResponses([]);
      return;
    }
    const generation = ++requestGenerationRef.current;

    fetch(`/api/home-cards/${currentPrayer.id}/adjacent`)
      .then((res) => (res.ok ? res.json() : { prev: null, next: null }))
      .then((data) => {
        if (generation !== requestGenerationRef.current) return;
        setAdjacent(data || { prev: null, next: null });
      })
      .catch(() => {
        if (generation !== requestGenerationRef.current) return;
        setAdjacent({ prev: null, next: null });
      });

    fetch(`/api/responses/${currentPrayer.id}`)
      .then((res) => (res.ok ? res.json() : []))
      .then((data) => {
        if (generation !== requestGenerationRef.current) return;
        setPlayableResponses(Array.isArray(data) ? data.filter((item) => item.voiceUrl) : []);
      })
      .catch(() => {
        if (generation !== requestGenerationRef.current) return;
        setPlayableResponses([]);
      });
  }, [currentPrayer?.id]);

  useEffect(() => {
    if (!blockedMessage) return;
    const timeoutId = window.setTimeout(() => setBlockedMessage(""), 2400);
    return () => window.clearTimeout(timeoutId);
  }, [blockedMessage]);

  const canSwitchNow = () => {
    if (companionOpen) return false;
    if (!recorderActive || !recorderState) return true;
    if (recorderState.submitState === "uploading") return false;
    if (BLOCKING_RECORDER_PHASES.has(recorderState.phase)) return false;
    return true;
  };

  const needsDiscardConfirm = () =>
    recorderActive &&
    recorderState?.phase === "preview" &&
    recorderState?.submitState === "idle" &&
    !recorderState?.confirmingRerecord;

  const blockedMessageForState = () => {
    if (companionOpen) return "";
    if (recorderState?.submitState === "uploading") return companionText.switchBlockedUploading;
    if (recorderState?.phase === "countdown") return companionText.switchBlockedCountdown;
    if (recorderState?.phase === "recording") return companionText.switchBlockedRecording;
    if (recorderState?.phase === "requesting-permission") return companionText.switchBlockedRequesting;
    return companionText.switchBlockedGeneric;
  };

  const performSwitch = (direction) => {
    const target = direction === "next" ? adjacent.next : adjacent.prev;
    if (!target) return;
    recorderRef.current?.discard?.();
    setRecorderActive(false);
    setRecorderState(null);
    setSwitchConfirm(null);
    setCurrentPrayer(target);
  };

  const attemptSwitch = (direction) => {
    const target = direction === "next" ? adjacent.next : adjacent.prev;
    if (!target) return;
    if (!canSwitchNow()) {
      setBlockedMessage(blockedMessageForState());
      return;
    }
    if (needsDiscardConfirm()) {
      setSwitchConfirm({ direction });
      return;
    }
    performSwitch(direction);
  };

  const handleTouchStart = (event) => {
    const touch = event.touches?.[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches?.[0];
    if (!touch) return;
    const direction = resolveSwipeDirection(touch.clientX - start.x, touch.clientY - start.y);
    if (direction) attemptSwitch(direction);
  };

  useEffect(() => {
    const handleKeyDown = (event) => {
      const tag = document.activeElement?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      if (companionOpen) return; // CompanionOverlay owns its own keyboard handling
      const direction = resolveArrowKeyDirection(event.key);
      if (direction) attemptSwitch(direction);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adjacent, canSwitchNow, companionOpen, needsDiscardConfirm]);

  const description = toPlainText(currentPrayer?.description);
  const playableVoiceHref = isPlayableVoiceHref(currentPrayer?.voiceHref) ? currentPrayer.voiceHref : null;
  const hasCompanionEntry = playableResponses.length > 0;

  return (
    <section
      className="prayer-hero"
      aria-labelledby="prayer-hero-title"
      ref={heroRef}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <div className="prayer-hero__inner">
        {recorderActive ? (
          <PrayerRecorder
            ref={recorderRef}
            text={text.recorder}
            prayerId={currentPrayer?.id}
            onStateChange={setRecorderState}
            onExit={() => {
              setRecorderActive(false);
              setRecorderState(null);
            }}
          />
        ) : currentPrayer ? (
          <>
            <span className="prayer-hero__eyebrow">{copy.eyebrow}</span>
            <h1 id="prayer-hero-title">{copy.headline}</h1>
            <p className="prayer-hero__subhead">{copy.subheadline}</p>

            <article className="prayer-hero__card" aria-label={copy.cardLabel}>
              <h2>{currentPrayer.title}</h2>
              {description ? <p>{description}</p> : null}
              {playableVoiceHref ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls preload="metadata" src={playableVoiceHref} className="prayer-hero__card-audio" />
              ) : null}
            </article>

            <div className="prayer-hero__actions">
              <button type="button" className="prayer-hero__cta" onClick={() => setRecorderActive(true)}>
                {copy.primaryCta}
              </button>
              {hasCompanionEntry ? (
                <button
                  type="button"
                  className="prayer-hero__companion-cta"
                  onClick={() => setCompanionOpen(true)}
                >
                  {companionText.listenEntry}
                </button>
              ) : null}
            </div>

            <p className="prayer-hero__anonymous-note">{copy.anonymousNote}</p>

            {adjacent.prev || adjacent.next ? (
              <p className="prayer-hero__swipe-hint">{copy.swipeHint}</p>
            ) : null}

            {blockedMessage ? (
              <p className="prayer-hero__notice" role="status">
                {blockedMessage}
              </p>
            ) : null}

            {switchConfirm ? (
              <div className="prayer-hero__confirm" role="alertdialog" aria-label={companionText.discardConfirmTitle}>
                <p>{companionText.discardConfirmTitle}</p>
                <p>{companionText.discardConfirmBody}</p>
                <div className="prayer-hero__confirm-actions">
                  <button type="button" onClick={() => performSwitch(switchConfirm.direction)}>
                    {companionText.discardConfirmYes}
                  </button>
                  <button type="button" onClick={() => setSwitchConfirm(null)}>
                    {companionText.discardConfirmNo}
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <>
            <span className="prayer-hero__eyebrow">{copy.eyebrow}</span>
            <h1 id="prayer-hero-title">{copy.emptyTitle}</h1>
            <p className="prayer-hero__subhead">{copy.emptyBody}</p>
          </>
        )}
      </div>

      {companionOpen && currentPrayer ? (
        <CompanionOverlay
          responses={playableResponses}
          text={companionText}
          onExit={() => setCompanionOpen(false)}
        />
      ) : null}

      <style jsx>{`
        .prayer-hero {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100svh - var(--site-header-height, 56px));
          padding: 3rem 1.25rem;
        }

        .prayer-hero__inner {
          width: 100%;
          max-width: 720px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          text-align: center;
        }

        .prayer-hero__eyebrow {
          font-size: 0.85rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--accent);
        }

        .prayer-hero__inner h1 {
          margin: 0;
          font-size: clamp(1.75rem, 1.1rem + 3vw, 2.75rem);
          line-height: 1.3;
        }

        .prayer-hero__subhead {
          margin: 0;
          max-width: 42ch;
          font-size: 1.05rem;
          color: var(--text-secondary);
        }

        .prayer-hero__card {
          width: 100%;
          max-width: 560px;
          margin-top: 0.5rem;
          padding: 1.25rem 1.5rem;
          border-radius: 1rem;
          background: var(--accent-soft);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 0.6rem;
        }

        .prayer-hero__card h2 {
          margin: 0;
          font-size: 1.15rem;
        }

        .prayer-hero__card p {
          margin: 0;
          color: var(--text-secondary);
          font-size: 0.95rem;
          white-space: pre-line;
        }

        .prayer-hero__card-audio {
          width: 100%;
        }

        .prayer-hero__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.75rem;
          margin-top: 0.5rem;
        }

        .prayer-hero__cta,
        .prayer-hero__companion-cta {
          min-height: 48px;
          padding: 0.9rem 2.25rem;
          border: none;
          border-radius: 999px;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
        }

        .prayer-hero__cta {
          background: var(--accent);
          color: #fff;
        }

        .prayer-hero__companion-cta {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .prayer-hero__cta:hover,
        .prayer-hero__cta:focus-visible,
        .prayer-hero__companion-cta:focus-visible {
          filter: brightness(1.05);
        }

        .prayer-hero__anonymous-note {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .prayer-hero__swipe-hint {
          margin: 0.25rem 0 0;
          font-size: 0.8rem;
          color: var(--text-muted);
        }

        .prayer-hero__notice {
          margin: 0;
          font-size: 0.85rem;
          background: var(--accent-soft);
          color: var(--text-secondary);
          padding: 0.5rem 0.9rem;
          border-radius: 0.6rem;
        }

        .prayer-hero__confirm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .prayer-hero__confirm-actions {
          display: flex;
          gap: 0.75rem;
        }

        .prayer-hero__confirm-actions button {
          min-height: 44px;
          padding: 0.6rem 1.5rem;
          border: none;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-weight: 600;
          cursor: pointer;
        }

        @media (max-width: 480px) {
          .prayer-hero {
            padding: 2.25rem 1rem;
          }

          .prayer-hero__cta,
          .prayer-hero__companion-cta {
            width: 100%;
            max-width: 320px;
          }
        }
      `}</style>
    </section>
  );
}
