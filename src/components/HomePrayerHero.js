"use client";

import { useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";

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

export default function HomePrayerHero({ text, prayer }) {
  const copy = text.prayerHero;
  const [recorderActive, setRecorderActive] = useState(false);
  const description = toPlainText(prayer?.description);
  const playableVoiceHref = isPlayableVoiceHref(prayer?.voiceHref) ? prayer.voiceHref : null;

  return (
    <section className="prayer-hero" aria-labelledby="prayer-hero-title">
      <div className="prayer-hero__inner">
        {recorderActive ? (
          <PrayerRecorder text={text.recorder} prayerId={prayer?.id} onExit={() => setRecorderActive(false)} />
        ) : prayer ? (
          <>
            <span className="prayer-hero__eyebrow">{copy.eyebrow}</span>
            <h1 id="prayer-hero-title">{copy.headline}</h1>
            <p className="prayer-hero__subhead">{copy.subheadline}</p>

            <article className="prayer-hero__card" aria-label={copy.cardLabel}>
              <h2>{prayer.title}</h2>
              {description ? <p>{description}</p> : null}
              {playableVoiceHref ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <audio controls preload="metadata" src={playableVoiceHref} className="prayer-hero__card-audio" />
              ) : null}
            </article>

            <button type="button" className="prayer-hero__cta" onClick={() => setRecorderActive(true)}>
              {copy.primaryCta}
            </button>

            <p className="prayer-hero__anonymous-note">{copy.anonymousNote}</p>
          </>
        ) : (
          <>
            <span className="prayer-hero__eyebrow">{copy.eyebrow}</span>
            <h1 id="prayer-hero-title">{copy.emptyTitle}</h1>
            <p className="prayer-hero__subhead">{copy.emptyBody}</p>
          </>
        )}
      </div>

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

        .prayer-hero__cta {
          margin-top: 0.5rem;
          min-height: 48px;
          padding: 0.9rem 2.25rem;
          border: none;
          border-radius: 999px;
          background: var(--accent);
          color: #fff;
          font-size: 1.05rem;
          font-weight: 600;
          cursor: pointer;
        }

        .prayer-hero__cta:hover,
        .prayer-hero__cta:focus-visible {
          filter: brightness(1.05);
        }

        .prayer-hero__anonymous-note {
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        @media (max-width: 480px) {
          .prayer-hero {
            padding: 2.25rem 1rem;
          }

          .prayer-hero__cta {
            width: 100%;
            max-width: 320px;
          }
        }
      `}</style>
    </section>
  );
}
