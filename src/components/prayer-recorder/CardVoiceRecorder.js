"use client";

import { useState } from "react";
import GainAudio from "@/components/GainAudio";
import VoicePrayerOverlay from "@/components/VoicePrayerOverlay";
import { MAX_VOICE_DURATION_SECONDS, MAX_VOICE_FILE_BYTES } from "@/lib/voiceModeration";

// Optional voice message a card owner can attach when creating/editing their
// HomePrayerCard. Recording happens in the same VoicePrayerOverlay that
// /prayfor uses for voice responses, so both look and behave the same — only
// the time limit (3 minutes), the wording and what happens on submit differ.
// This component only ever hands the parent form a finished upload URL via
// onChange — the whole card create/update request still goes through the
// existing JSON payload, unchanged.
const CARD_OVERLAY_COPY = {
  dialogLabel: "錄一段語音留言",
  title: "錄一段語音留言",
  intro: "錄完可以先重聽，確定之後才會附在這張代禱卡上。",
  dismiss: "先不錄了",
  deniedBody: "可以到瀏覽器設定開啟麥克風後再試一次，或先只用文字送出代禱。",
  countdownHint: "說說你想請大家一起記念的事。",
  tooShort: "再多說一句就可以完成",
  unsupported: "這個瀏覽器無法錄音，請改用較新版本的 Safari、Chrome 或 Edge。",
  submit: "使用這段錄音",
  submitting: "上傳中…",
};

export default function CardVoiceRecorder({ value, onChange, onUploadingChange, disabled = false }) {
  const [showOverlay, setShowOverlay] = useState(false);
  const [uploadError, setUploadError] = useState("");

  const openOverlay = () => {
    setUploadError("");
    setShowOverlay(true);
  };

  // Returning false keeps the overlay open with the recording intact, so a
  // failed upload can be retried without recording again.
  const handleComplete = async (file) => {
    if (file.size > MAX_VOICE_FILE_BYTES) {
      setUploadError("這段錄音檔案過大，請重新錄製較短的內容。");
      return false;
    }

    setUploadError("");
    onUploadingChange?.(true);
    try {
      const formData = new FormData();
      formData.set("audio", file, file.name.replace(/^prayer-voice-/, "card-voice-"));

      const response = await fetch("/api/customer/cards/voice", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "語音留言上傳失敗");
      }
      const result = await response.json();
      onChange?.(result.url);
      setShowOverlay(false);
      return true;
    } catch (error) {
      setUploadError(error.message || "語音留言上傳失敗，請稍後再試。");
      return false;
    } finally {
      onUploadingChange?.(false);
    }
  };

  const handleRemove = () => {
    onChange?.("");
    setUploadError("");
  };

  return (
    <div className="card-voice-recorder">
      <div className="card-voice-recorder__head">
        <span>語音留言（選填，最長 3 分鐘）</span>
        <small>讓大家除了文字之外，也能聽見你想傳達的事情。</small>
      </div>

      {value ? (
        <div className="card-voice-recorder__attached">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <GainAudio controls preload="metadata" src={value} />
          <div className="card-voice-recorder__actions">
            <button type="button" className="card-voice-recorder__chip" onClick={openOverlay} disabled={disabled}>
              重新錄製
            </button>
            <button type="button" className="card-voice-recorder__chip" onClick={handleRemove} disabled={disabled}>
              移除
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className="card-voice-recorder__start" onClick={openOverlay} disabled={disabled}>
          <i className="fa-solid fa-microphone" aria-hidden="true" />
          錄一段語音留言
        </button>
      )}

      {showOverlay ? (
        <VoicePrayerOverlay
          maxSeconds={MAX_VOICE_DURATION_SECONDS}
          withTranscript={false}
          copy={CARD_OVERLAY_COPY}
          onComplete={handleComplete}
          onCancel={() => setShowOverlay(false)}
          submissionError={uploadError}
        />
      ) : null}

      <style jsx>{`
        .card-voice-recorder {
          display: grid;
          gap: 0.75rem;
          border: 1px solid var(--line-1);
          border-radius: 14px;
          background: var(--surface-3);
          padding: 0.95rem;
        }

        .card-voice-recorder__head {
          display: grid;
          gap: 0.2rem;
        }

        .card-voice-recorder__head span {
          color: var(--text-1);
          font-weight: 700;
        }

        .card-voice-recorder__head small {
          color: var(--text-2);
        }

        /* Same pill as the voice button on /prayfor (.comments__voice-btn),
           but on theme tokens: /prayfor is always dark, this form follows the
           light/dark setting. */
        .card-voice-recorder__start {
          justify-self: start;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          min-height: 44px;
          padding: 0.6rem 1.1rem;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent-text);
          font-size: 0.9rem;
          font-weight: 700;
          border: 1px solid rgba(251, 191, 36, 0.42);
          cursor: pointer;
          transition: background 0.15s ease;
        }

        .card-voice-recorder__start:hover:not(:disabled) {
          background: rgba(251, 191, 36, 0.22);
        }

        .card-voice-recorder__start:disabled,
        .card-voice-recorder__chip:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .card-voice-recorder__attached {
          display: grid;
          gap: 0.6rem;
        }

        .card-voice-recorder__attached :global(audio) {
          width: 100%;
        }

        .card-voice-recorder__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        /* Same chip shape as the preview controls inside the overlay (.vpo-chip). */
        .card-voice-recorder__chip {
          min-height: 40px;
          padding: 0.45rem 1rem;
          border: none;
          border-radius: 999px;
          background: transparent;
          box-shadow: inset 0 0 0 1px var(--line-2);
          color: var(--text-1);
          font-size: 0.85rem;
          font-weight: 600;
          cursor: pointer;
        }

        .card-voice-recorder__chip:hover:not(:disabled) {
          background: var(--surface-3);
        }

        .card-voice-recorder__start:focus-visible,
        .card-voice-recorder__chip:focus-visible {
          outline: 3px solid var(--accent);
          outline-offset: 3px;
        }

        @media (max-width: 480px) {
          .card-voice-recorder__start {
            justify-self: stretch;
          }
        }
      `}</style>
    </div>
  );
}
