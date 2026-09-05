"use client";

import { useEffect } from "react";

import { usePrayedReaction } from "./usePrayedReaction";

// "我已為你禱告" — shared by HomePrayerHero and DetailPrayerInteractionPanel.
// See docs/obsidian/28-Prayed-Reaction-Design.md.
export default function PrayedReactionButton({ prayerId, text }) {
  const { count, reacted, status, justReacted, react, dismissJustReacted } = usePrayedReaction(prayerId);

  useEffect(() => {
    if (!justReacted) return undefined;
    const timeoutId = window.setTimeout(dismissJustReacted, 3000);
    return () => window.clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justReacted]);

  if (!prayerId) return null;

  return (
    <div className="prayed-reaction">
      <button
        type="button"
        className="prayed-reaction__btn"
        aria-pressed={reacted}
        disabled={reacted || status === "loading"}
        onClick={react}
      >
        {text.label}
      </button>
      <span className="prayed-reaction__count" aria-live="polite">
        {count} {text.countSuffix}
      </span>

      {status === "error" ? (
        <p className="prayed-reaction__notice prayed-reaction__notice--error" role="alert">
          {text.error}
        </p>
      ) : null}

      {justReacted ? (
        <p className="prayed-reaction__notice" role="status" aria-live="polite">
          {text.success}
        </p>
      ) : null}

      <style jsx>{`
        .prayed-reaction {
          display: flex;
          flex-wrap: wrap;
          align-items: center;
          gap: 0.6rem;
        }

        .prayed-reaction__btn {
          min-height: 44px;
          min-width: 44px;
          padding: 0.6rem 1.5rem;
          border: none;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 0.95rem;
          font-weight: 600;
          cursor: pointer;
        }

        .prayed-reaction__btn[aria-pressed="true"] {
          background: var(--accent);
          color: #fff;
        }

        .prayed-reaction__btn:disabled {
          cursor: default;
          opacity: 0.9;
        }

        .prayed-reaction__btn:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 2px;
        }

        .prayed-reaction__count {
          font-size: 0.85rem;
          color: var(--text-muted);
        }

        .prayed-reaction__notice {
          flex-basis: 100%;
          margin: 0;
          font-size: 0.85rem;
          color: var(--text-secondary);
        }

        .prayed-reaction__notice--error {
          color: var(--danger, #dc2626);
        }
      `}</style>
    </div>
  );
}
