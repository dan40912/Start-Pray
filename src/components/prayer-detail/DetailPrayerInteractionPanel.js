"use client";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";
import CompanionOverlay from "@/components/home-companion/CompanionOverlay";
import PrayedReactionButton from "@/components/prayer-interaction/PrayedReactionButton";
import { usePrayerInteraction } from "@/components/prayer-interaction/usePrayerInteraction";
import { getDictionary, normalizeLocale } from "@/lib/i18n";

// Anonymous recording + "listen to others' responses" entry point for
// /prayfor/[id], placed right after the Prayer hero card so it sits in the
// first screen on both mobile and desktop without needing CSS reordering.
// Shares its state machine with the homepage via usePrayerInteraction, and
// renders the exact same PrayerRecorder / CompanionOverlay components — see
// docs/obsidian/27-Shared-Prayer-Interaction-Audit.md. The existing
// Comments.js voice/text/report flow (used by logged-in members) is left
// untouched; this panel is an additive, anonymous-first entry point.
export default function DetailPrayerInteractionPanel({ prayerId, locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const dictionary = getDictionary(locale);
  const recorderText = dictionary.home.recorder;
  const companionText = dictionary.home.companion;
  const prayedText = dictionary.home.prayed;

  const {
    recorderRef,
    recorderActive,
    recorderState,
    setRecorderState,
    openRecorder,
    closeRecorder,
    companionOpen,
    openCompanion,
    closeCompanion,
    playableResponses,
    hasCompanionEntry,
  } = usePrayerInteraction(prayerId);

  return (
    <section className="detail-interaction" aria-label={recorderText.entryCta}>
      {recorderActive ? (
        <PrayerRecorder
          ref={recorderRef}
          text={recorderText}
          prayerId={prayerId}
          onStateChange={setRecorderState}
          onExit={closeRecorder}
        />
      ) : (
        <div className="detail-interaction__actions">
          <button type="button" className="detail-interaction__cta" onClick={openRecorder}>
            {recorderText.entryCta}
          </button>
          {hasCompanionEntry ? (
            <button type="button" className="detail-interaction__companion-cta" onClick={openCompanion}>
              {companionText.listenEntry}
            </button>
          ) : null}
          <p className="detail-interaction__note">{recorderText.anonymousNote}</p>
          <PrayedReactionButton prayerId={prayerId} text={prayedText} />
        </div>
      )}

      {companionOpen ? (
        <CompanionOverlay responses={playableResponses} text={companionText} onExit={closeCompanion} />
      ) : null}

      <style jsx>{`
        .detail-interaction {
          margin: 1.25rem 0;
        }

        .detail-interaction__actions {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.75rem;
        }

        .detail-interaction__cta,
        .detail-interaction__companion-cta {
          min-height: 48px;
          padding: 0.85rem 2rem;
          border: none;
          border-radius: 999px;
          font-size: 1rem;
          font-weight: 600;
          cursor: pointer;
        }

        .detail-interaction__cta {
          background: var(--accent);
          color: #fff;
        }

        .detail-interaction__companion-cta {
          background: var(--accent-soft);
          color: var(--accent);
        }

        .detail-interaction__cta:focus-visible,
        .detail-interaction__companion-cta:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
        }

        .detail-interaction__note {
          flex-basis: 100%;
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        @media (max-width: 768px) {
          .detail-interaction__cta,
          .detail-interaction__companion-cta {
            flex: 1 1 auto;
            min-width: 140px;
          }
        }
      `}</style>
    </section>
  );
}
