"use client";

import { useEffect, useRef, useState } from "react";
import GainAudio from "@/components/GainAudio";

import { usePrayerRecorder } from "./usePrayerRecorder";
import { formatDuration } from "./recorder-utils";
import { MAX_VOICE_DURATION_SECONDS, MAX_VOICE_FILE_BYTES } from "@/lib/voiceModeration";

// Optional voice message a card owner can attach when creating/editing their
// HomePrayerCard — see docs/obsidian and the plan this was built from.
// Reuses the same recording engine as the anonymous-response PrayerRecorder
// (usePrayerRecorder), but NOT that component itself: its submit handler is
// hardcoded to POST /api/responses with anonymous-specific fields, which
// doesn't apply here. This component only ever hands the parent form a
// finished upload URL via onChange — the whole card create/update request
// still goes through the existing JSON payload, unchanged.
export default function CardVoiceRecorder({ value, onChange, onUploadingChange, disabled = false }) {
  const recorder = usePrayerRecorder({ maxDurationSeconds: MAX_VOICE_DURATION_SECONDS });
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
    showPermissionExplanation,
    finishRecording,
    requestRerecord,
    cancelRerecordConfirm,
    confirmRerecord,
    cancel,
    retryAfterError,
  } = recorder;

  const audioRef = useRef(null);
  const uploadLockRef = useRef(false);
  const [attachState, setAttachState] = useState(value ? "attached" : "idle");
  const [attachError, setAttachError] = useState("");

  // If the parent's `value` changes to a real URL from outside (e.g. the
  // edit page finished loading the existing card), reflect that as attached
  // without re-entering the recorder flow.
  useEffect(() => {
    if (value && attachState === "idle") {
      setAttachState("attached");
    }
    if (!value && attachState === "attached") {
      setAttachState("idle");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const togglePlayback = () => {
    const audioEl = audioRef.current;
    if (!audioEl) return;
    if (audioEl.paused) {
      audioEl.play().catch(() => setTransientMessage("playback"));
    } else {
      audioEl.pause();
    }
  };

  const uploadRecording = async () => {
    if (uploadLockRef.current) return;
    const blob = getBlob();
    if (!blob) {
      setAttachError("找不到錄音內容，請重新錄製。");
      setAttachState("error");
      return;
    }
    if (blob.size > MAX_VOICE_FILE_BYTES) {
      setAttachError("這段錄音檔案過大，請重新錄製較短的內容。");
      setAttachState("error");
      return;
    }

    uploadLockRef.current = true;
    setAttachState("uploading");
    setAttachError("");
    onUploadingChange?.(true);

    try {
      const extension = blob.type?.includes("mp4") ? "m4a" : "webm";
      const formData = new FormData();
      formData.set("audio", blob, `card-voice-${Date.now()}.${extension}`);

      const response = await fetch("/api/customer/cards/voice", { method: "POST", body: formData });
      if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.message || "語音留言上傳失敗");
      }
      const result = await response.json();
      onChange?.(result.url);
      setAttachState("attached");
      cancel(); // reset the recorder hook back to idle now that we have a persisted URL
    } catch (error) {
      setAttachError(error.message || "語音留言上傳失敗，請稍後再試。");
      setAttachState("error");
    } finally {
      uploadLockRef.current = false;
      onUploadingChange?.(false);
    }
  };

  const handleRemove = () => {
    onChange?.("");
    setAttachState("idle");
    setAttachError("");
    cancel();
  };

  const handleReRecordFromAttached = () => {
    onChange?.("");
    setAttachState("idle");
    setAttachError("");
    showPermissionExplanation();
  };

  const isBusy = disabled || attachState === "uploading";

  return (
    <div className="card-voice-recorder">
      <div className="card-voice-recorder__head">
        <span>語音留言（選填，最長 3 分鐘）</span>
        <small>讓大家除了文字之外，也能聽見你想傳達的事情。</small>
      </div>

      {attachState === "attached" && value ? (
        <div className="card-voice-recorder__attached">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <GainAudio controls preload="metadata" src={value} />
          <div className="card-voice-recorder__actions">
            <button type="button" onClick={handleReRecordFromAttached} disabled={isBusy}>
              重新錄製
            </button>
            <button type="button" onClick={handleRemove} disabled={isBusy}>
              移除
            </button>
          </div>
        </div>
      ) : (
        <>
          {phase === "idle" ? (
            <button
              type="button"
              className="card-voice-recorder__start"
              onClick={showPermissionExplanation}
              disabled={isBusy}
            >
              錄一段語音留言
            </button>
          ) : null}

          {phase === "permission-explanation" ? (
            <div className="card-voice-recorder__step">
              <p>我們需要使用你的麥克風來錄下這段語音留言。錄音只會在你確認使用後上傳。</p>
              <div className="card-voice-recorder__actions">
                <button type="button" onClick={requestPermission}>
                  允許使用麥克風
                </button>
                <button type="button" onClick={cancel}>
                  取消
                </button>
              </div>
            </div>
          ) : null}

          {phase === "requesting-permission" ? (
            <p className="card-voice-recorder__notice" aria-live="polite">
              正在請求麥克風權限…
            </p>
          ) : null}

          {phase === "permission-denied" ? (
            <div className="card-voice-recorder__step">
              <p>無法使用麥克風。請在瀏覽器設定中允許麥克風權限後再試一次。</p>
              <div className="card-voice-recorder__actions">
                <button type="button" onClick={requestPermission}>
                  再試一次
                </button>
                <button type="button" onClick={cancel}>
                  返回
                </button>
              </div>
            </div>
          ) : null}

          {phase === "unsupported" ? (
            <div className="card-voice-recorder__step">
              <p>這個瀏覽器目前不支援錄音，請改用較新版本的 Safari、Chrome 或 Edge。</p>
              <button type="button" onClick={cancel}>
                返回
              </button>
            </div>
          ) : null}

          {phase === "countdown" ? (
            <div className="card-voice-recorder__step">
              <div className="card-voice-recorder__countdown" aria-live="assertive">
                {countdownValue}
              </div>
              <button type="button" onClick={cancel}>
                取消
              </button>
            </div>
          ) : null}

          {phase === "recording" ? (
            <div className="card-voice-recorder__step">
              <div className="card-voice-recorder__status" aria-live="polite">
                <span className="card-voice-recorder__rec-dot" aria-hidden="true" />
                錄音中 · {formatDuration(elapsedSeconds)}
              </div>
              <p className="card-voice-recorder__remaining">
                剩餘 {Math.max(0, maxDurationSeconds - elapsedSeconds)} 秒
              </p>
              <button
                type="button"
                className="card-voice-recorder__stop"
                onClick={finishRecording}
                aria-label="停止錄音"
              >
                停止錄音
              </button>
              {transientMessage === "too-short" ? (
                <p className="card-voice-recorder__notice" role="status">
                  再多說一句就可以完成
                </p>
              ) : null}
            </div>
          ) : null}

          {phase === "preview" ? (
            <div className="card-voice-recorder__step">
              <GainAudio
                ref={audioRef}
                src={previewUrl}
                preload="metadata"
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onEnded={() => setIsPlaying(false)}
                onError={() => setTransientMessage("playback")}
              />

              {attachState === "uploading" ? (
                <p className="card-voice-recorder__notice" role="status" aria-live="polite">
                  語音留言上傳中…
                </p>
              ) : attachState === "error" ? (
                <>
                  <p role="alert">{attachError}</p>
                  <div className="card-voice-recorder__actions">
                    <button type="button" onClick={uploadRecording} disabled={isBusy}>
                      重試
                    </button>
                    <button type="button" onClick={cancel} disabled={isBusy}>
                      返回
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <button type="button" onClick={togglePlayback}>
                    {isPlaying ? "暫停" : "播放"}
                  </button>
                  {transientMessage === "playback" ? (
                    <p className="card-voice-recorder__notice" role="status">
                      這段錄音無法播放，請重新錄製後再試。
                    </p>
                  ) : null}

                  {confirmingRerecord ? (
                    <div className="card-voice-recorder__confirm" role="alertdialog" aria-label="確定要重新錄製嗎？">
                      <p>確定要重新錄製嗎？</p>
                      <p>目前這段錄音將會被捨棄。</p>
                      <div className="card-voice-recorder__actions">
                        <button type="button" onClick={confirmRerecord}>
                          確定重錄
                        </button>
                        <button type="button" onClick={cancelRerecordConfirm}>
                          繼續使用這段
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="card-voice-recorder__actions">
                      <button type="button" onClick={requestRerecord} disabled={isBusy}>
                        重新錄製
                      </button>
                      <button
                        type="button"
                        className="card-voice-recorder__attach"
                        onClick={uploadRecording}
                        disabled={isBusy}
                      >
                        使用這段錄音
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          ) : null}

          {phase === "error" ? (
            <div className="card-voice-recorder__step">
              <p>
                {errorReason === "stream-lost"
                  ? "麥克風連線中斷，請確認沒有其他程式正在使用麥克風，然後再試一次。"
                  : errorReason === "empty"
                    ? "這段錄音沒有保存成功，請重新錄製一次。"
                    : "錄音裝置發生錯誤，請重新整理頁面或改用其他瀏覽器再試一次。"}
              </p>
              <div className="card-voice-recorder__actions">
                <button type="button" onClick={retryAfterError}>
                  再試一次
                </button>
                <button type="button" onClick={cancel}>
                  返回
                </button>
              </div>
            </div>
          ) : null}
        </>
      )}

      <style jsx>{`
        .card-voice-recorder {
          display: grid;
          gap: 0.6rem;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 14px;
          background: rgba(15, 23, 42, 0.46);
          padding: 0.95rem;
        }

        .card-voice-recorder__head {
          display: grid;
          gap: 0.2rem;
        }

        .card-voice-recorder__head span {
          color: #f8fafc;
          font-weight: 700;
        }

        .card-voice-recorder__head small {
          color: rgba(203, 213, 225, 0.8);
        }

        .card-voice-recorder__start {
          justify-self: start;
          min-height: 44px;
          padding: 0.65rem 1.5rem;
          border: none;
          border-radius: 999px;
          background: #3b82f6;
          color: #fff;
          font-weight: 700;
          cursor: pointer;
        }

        .card-voice-recorder__step {
          display: grid;
          gap: 0.6rem;
        }

        .card-voice-recorder__step p {
          margin: 0;
          color: rgba(226, 232, 240, 0.9);
        }

        .card-voice-recorder__actions {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .card-voice-recorder__actions button,
        .card-voice-recorder__step > button {
          min-height: 44px;
          min-width: 44px;
          padding: 0.55rem 1.2rem;
          border: none;
          border-radius: 999px;
          background: rgba(148, 163, 184, 0.22);
          color: #f8fafc;
          font-weight: 600;
          cursor: pointer;
        }

        .card-voice-recorder__actions button:focus-visible,
        .card-voice-recorder__step > button:focus-visible,
        .card-voice-recorder__start:focus-visible {
          outline: 3px solid #38bdf8;
          outline-offset: 2px;
        }

        .card-voice-recorder__attach {
          background: #3b82f6 !important;
        }

        .card-voice-recorder__countdown {
          font-size: 2.5rem;
          font-weight: 700;
          color: #38bdf8;
        }

        .card-voice-recorder__status {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-weight: 600;
          color: #f8fafc;
        }

        .card-voice-recorder__rec-dot {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #ef4444;
          animation: card-voice-recorder-pulse 1.4s ease-in-out infinite;
        }

        @media (prefers-reduced-motion: reduce) {
          .card-voice-recorder__rec-dot {
            animation: none;
          }
        }

        @keyframes card-voice-recorder-pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.35; }
        }

        .card-voice-recorder__remaining {
          font-size: 0.9rem;
        }

        .card-voice-recorder__notice {
          font-size: 0.85rem;
          background: rgba(59, 130, 246, 0.14);
          color: rgba(226, 232, 240, 0.95);
          padding: 0.5rem 0.9rem;
          border-radius: 0.6rem;
        }

        .card-voice-recorder__confirm {
          display: grid;
          gap: 0.4rem;
        }

        .card-voice-recorder__attached {
          display: grid;
          gap: 0.6rem;
        }

        .card-voice-recorder__attached audio {
          width: 100%;
        }

        @media (max-width: 480px) {
          .card-voice-recorder__actions button,
          .card-voice-recorder__step > button {
            flex: 1 1 auto;
          }
        }
      `}</style>
    </div>
  );
}
