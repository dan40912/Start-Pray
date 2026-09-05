"use client";

import { useEffect, useRef, useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";
import CompanionOverlay from "@/components/home-companion/CompanionOverlay";
import PrayedReactionButton from "@/components/prayer-interaction/PrayedReactionButton";
import { resolveArrowKeyDirection, resolveSwipeDirection } from "@/components/home-companion/swipe-utils";
import { usePrayerInteraction } from "@/components/prayer-interaction/usePrayerInteraction";

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
  const [switchConfirm, setSwitchConfirm] = useState(null); // { direction } | null
  const [blockedMessage, setBlockedMessage] = useState("");

  const {
    recorderRef,
    recorderActive,
    recorderState,
    setRecorderState,
    openRecorder,
    closeRecorder,
    discardRecorder,
    companionOpen,
    openCompanion,
    closeCompanion,
    playableResponses,
    hasCompanionEntry,
  } = usePrayerInteraction(currentPrayer?.id);

  const adjacentGenerationRef = useRef(0);
  const heroRef = useRef(null);
  const touchStartRef = useRef(null);

  useEffect(() => {
    setCurrentPrayer(prayer || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prayer?.id]);

  useEffect(() => {
    if (!currentPrayer?.id) {
      setAdjacent({ prev: null, next: null });
      return;
    }
    const generation = ++adjacentGenerationRef.current;

    fetch(`/api/home-cards/${currentPrayer.id}/adjacent`)
      .then((res) => (res.ok ? res.json() : { prev: null, next: null }))
      .then((data) => {
        if (generation !== adjacentGenerationRef.current) return;
        setAdjacent(data || { prev: null, next: null });
      })
      .catch(() => {
        if (generation !== adjacentGenerationRef.current) return;
        setAdjacent({ prev: null, next: null });
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
    discardRecorder();
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
            onExit={closeRecorder}
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
                <div className="prayer-hero__voice">
                  <span className="prayer-hero__voice-label">{copy.voiceLabel}</span>
                  {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                  <audio controls preload="metadata" src={playableVoiceHref} className="prayer-hero__card-audio" />
                </div>
              ) : null}
            </article>

            <div className="prayer-hero__actions">
              <button type="button" className="prayer-hero__cta" onClick={openRecorder}>
                {text.recorder.entryCta}
              </button>
              {hasCompanionEntry ? (
                <button
                  type="button"
                  className="prayer-hero__companion-cta"
                  onClick={openCompanion}
                >
                  {companionText.listenEntry}
                </button>
              ) : null}
            </div>

            <PrayedReactionButton prayerId={currentPrayer?.id} text={text.prayed} />

            <p className="prayer-hero__anonymous-note">{text.recorder.anonymousNote}</p>

            {adjacent.prev || adjacent.next ? (
              <div className="prayer-hero__nav">
                <button
                  type="button"
                  className="prayer-hero__nav-btn"
                  onClick={() => attemptSwitch("prev")}
                  disabled={!adjacent.prev}
                  aria-label={copy.prevPrayer}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M15 5l-7 7 7 7" />
                  </svg>
                </button>
                <p className="prayer-hero__swipe-hint">{copy.swipeHint}</p>
                <button
                  type="button"
                  className="prayer-hero__nav-btn"
                  onClick={() => attemptSwitch("next")}
                  disabled={!adjacent.next}
                  aria-label={copy.nextPrayer}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M9 5l7 7-7 7" />
                  </svg>
                </button>
              </div>
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
          onExit={closeCompanion}
        />
      ) : null}

      <style jsx>{`
        /* "夜禱 / Night Vigil" — see the design handbook. The whole hero runs on
           one warm accent (--nv-ember) against a deep indigo ground, instead of
           the light-theme --accent/--text-secondary tokens this section used to
           borrow from globals.css, which rendered dark-grey text on a near-black
           page. Tokens are declared locally so nothing else on the site shifts
           until the palette is adopted globally. */
        .prayer-hero {
          --nv-night: #0c1526;
          --nv-dusk: #16223a;
          --nv-dusk-2: #1c2c48;
          --nv-line: rgba(160, 178, 210, 0.14);
          --nv-ember: #e2a05a;
          --nv-ember-bright: #f4c185;
          --nv-ember-soft: rgba(226, 160, 90, 0.14);
          --nv-ember-glow: rgba(226, 160, 90, 0.5);
          --nv-moonlight: #e7ebf3;
          --nv-mist: #8a93a8;
          --nv-mist-dim: #616b80;

          position: relative;
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: calc(100svh - var(--site-header-height, 56px));
          padding: 3.5rem 1.25rem 4rem;
          overflow: hidden;
          background:
            radial-gradient(ellipse 60% 45% at 20% 8%, rgba(226, 160, 90, 0.1), transparent 62%),
            radial-gradient(ellipse 50% 40% at 85% 90%, rgba(226, 160, 90, 0.06), transparent 60%),
            linear-gradient(180deg, #05070c 0%, var(--nv-night) 42%, #0a121f 100%);
        }

        .prayer-hero__inner {
          position: relative;
          z-index: 1;
          width: 100%;
          max-width: 640px;
          margin: 0 auto;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1.15rem;
          text-align: center;
        }

        .prayer-hero__eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 0.6rem;
          font-size: 0.78rem;
          font-weight: 600;
          letter-spacing: 0.14em;
          text-transform: uppercase;
          color: var(--nv-ember-bright);
        }

        .prayer-hero__eyebrow::before {
          content: "";
          width: 6px;
          height: 6px;
          border-radius: 50%;
          background: var(--nv-ember-bright);
          box-shadow: 0 0 10px 2px var(--nv-ember-glow);
        }

        .prayer-hero__inner h1 {
          margin: 0;
          font-family: var(--font-serif-tc), "Noto Serif TC", Georgia, serif;
          font-weight: 600;
          font-size: clamp(2rem, 1.2rem + 3.4vw, 3.1rem);
          line-height: 1.34;
          color: var(--nv-moonlight);
          text-wrap: balance;
        }

        .prayer-hero__subhead {
          margin: 0;
          max-width: 40ch;
          font-size: 1.02rem;
          line-height: 1.85;
          color: var(--nv-mist);
        }

        .prayer-hero__card {
          position: relative;
          width: 100%;
          max-width: 560px;
          margin-top: 0.75rem;
          padding: 1.75rem 1.85rem;
          border-radius: 20px;
          border: 1px solid var(--nv-line);
          background: linear-gradient(165deg, var(--nv-dusk-2), var(--nv-dusk) 72%);
          box-shadow:
            0 40px 70px -42px rgba(2, 6, 16, 0.92),
            0 0 60px -30px var(--nv-ember-glow),
            inset 0 1px 0 rgba(255, 255, 255, 0.03);
          text-align: left;
          display: flex;
          flex-direction: column;
          gap: 0.7rem;
        }

        .prayer-hero__card h2 {
          margin: 0;
          font-family: var(--font-serif-tc), "Noto Serif TC", Georgia, serif;
          font-weight: 600;
          font-size: 1.4rem;
          line-height: 1.45;
          color: var(--nv-moonlight);
        }

        .prayer-hero__card p {
          margin: 0;
          color: var(--nv-mist);
          font-size: 0.95rem;
          line-height: 1.85;
          white-space: pre-line;
        }

        .prayer-hero__voice {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
          margin-top: 0.4rem;
          padding: 0.85rem 0.95rem;
          border: 1px solid var(--nv-line);
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.03);
        }

        .prayer-hero__voice-label {
          font-size: 0.8rem;
          color: var(--nv-ember-bright);
        }

        .prayer-hero__card-audio {
          width: 100%;
        }

        .prayer-hero__actions {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 0.7rem;
          margin-top: 0.6rem;
        }

        .prayer-hero__cta,
        .prayer-hero__companion-cta {
          min-height: 48px;
          padding: 0.85rem 2rem;
          border: none;
          border-radius: 999px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
          transition: transform 0.18s ease, filter 0.18s ease, background 0.2s ease;
        }

        .prayer-hero__cta {
          background: linear-gradient(135deg, var(--nv-ember-bright), var(--nv-ember));
          color: #241505;
          box-shadow: 0 16px 32px -14px rgba(226, 160, 90, 0.6);
        }

        .prayer-hero__companion-cta {
          background: rgba(255, 255, 255, 0.05);
          border: 1px solid var(--nv-line);
          color: var(--nv-moonlight);
        }

        .prayer-hero__cta:hover,
        .prayer-hero__cta:focus-visible {
          transform: translateY(-1px);
          filter: brightness(1.04);
        }

        .prayer-hero__companion-cta:hover,
        .prayer-hero__companion-cta:focus-visible {
          background: rgba(255, 255, 255, 0.09);
        }

        .prayer-hero__anonymous-note {
          margin: 0;
          font-size: 0.82rem;
          color: var(--nv-mist-dim);
        }

        .prayer-hero__nav {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 1rem;
          margin-top: 0.35rem;
        }

        .prayer-hero__nav-btn {
          flex-shrink: 0;
          width: 44px;
          height: 44px;
          display: grid;
          place-items: center;
          border-radius: 50%;
          border: 1px solid var(--nv-line);
          background: rgba(255, 255, 255, 0.04);
          color: var(--nv-moonlight);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .prayer-hero__nav-btn svg {
          width: 18px;
          height: 18px;
        }

        .prayer-hero__nav-btn:hover:not(:disabled) {
          border-color: var(--nv-ember);
          background: var(--nv-ember-soft);
          color: var(--nv-ember-bright);
        }

        .prayer-hero__nav-btn:disabled {
          opacity: 0.3;
          cursor: not-allowed;
        }

        .prayer-hero__swipe-hint {
          margin: 0;
          font-size: 0.8rem;
          color: var(--nv-mist-dim);
        }

        .prayer-hero__notice {
          margin: 0;
          font-size: 0.85rem;
          background: var(--nv-ember-soft);
          border: 1px solid rgba(226, 160, 90, 0.28);
          color: var(--nv-ember-bright);
          padding: 0.55rem 0.95rem;
          border-radius: 10px;
        }

        .prayer-hero__confirm {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.6rem;
          padding: 1.1rem 1.3rem;
          border: 1px solid var(--nv-line);
          border-radius: 16px;
          background: rgba(6, 14, 28, 0.9);
          color: var(--nv-mist);
          font-size: 0.9rem;
        }

        .prayer-hero__confirm-actions {
          display: flex;
          gap: 0.6rem;
        }

        .prayer-hero__confirm-actions button {
          min-height: 44px;
          padding: 0.6rem 1.4rem;
          border: 1px solid var(--nv-line);
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.05);
          color: var(--nv-moonlight);
          font-weight: 500;
          cursor: pointer;
        }

        .prayer-hero__confirm-actions button:first-child {
          background: var(--nv-ember);
          border-color: var(--nv-ember);
          color: #241505;
        }

        @media (max-width: 480px) {
          .prayer-hero {
            padding: 2.5rem 1rem 3rem;
          }

          .prayer-hero__card {
            padding: 1.4rem 1.25rem;
          }

          .prayer-hero__cta,
          .prayer-hero__companion-cta {
            width: 100%;
            max-width: 320px;
          }
        }

        @media (prefers-reduced-motion: reduce) {
          .prayer-hero__cta,
          .prayer-hero__companion-cta,
          .prayer-hero__nav-btn {
            transition: none;
          }
        }
      `}</style>
    </section>
  );
}
