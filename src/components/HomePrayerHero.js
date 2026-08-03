"use client";

import { useState } from "react";

import PrayerRecorder from "@/components/prayer-recorder/PrayerRecorder";

export default function HomePrayerHero({ text }) {
  const copy = text.prayerHero;
  const [recorderActive, setRecorderActive] = useState(false);

  return (
    <section className="prayer-hero" aria-labelledby="prayer-hero-title">
      <div className="prayer-hero__inner">
        {recorderActive ? (
          <PrayerRecorder text={text.recorder} onExit={() => setRecorderActive(false)} />
        ) : (
          <>
            <span className="prayer-hero__eyebrow">{copy.eyebrow}</span>
            <h1 id="prayer-hero-title">{copy.headline}</h1>
            <p className="prayer-hero__subhead">{copy.subheadline}</p>

            <button type="button" className="prayer-hero__cta" onClick={() => setRecorderActive(true)}>
              {copy.primaryCta}
            </button>

            <p className="prayer-hero__anonymous-note">{copy.anonymousNote}</p>
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
