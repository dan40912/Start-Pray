"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GainAudio from "@/components/GainAudio";

const REC_MAX = 60;
const REC_MIN = 3;

function fmt(sec) {
  const s = Math.max(0, Math.floor(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

function WaveBars({ live, refEl }) {
  return (
    <div
      ref={refEl}
      className={`vpo-wave${live ? " live" : ""}`}
      aria-hidden="true"
    >
      {Array.from({ length: 12 }).map((_, i) => (
        <i key={i} style={{ animationDelay: `${(i * 0.11) % 0.36}s` }} />
      ))}
    </div>
  );
}

/**
 * Full in-browser voice recording overlay.
 * Props:
 *   onComplete(file: File, transcript: string) — called with recorded audio + transcript
 *   onCancel() — called when user closes without completing
 */
// Bare `{ audio: true }` leaves gain entirely to the device, and the recordings
// it produced measured -29 to -34 dBFS RMS — roughly 10-14 dB under a normal
// speech level, which is why they play back so quietly. autoGainControl asks the
// browser to ride the level up for a quiet microphone instead. It is on by
// default in some browsers and off in others, so state it rather than inherit it.
const MIC_CONSTRAINTS = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
};

export default function VoicePrayerOverlay({ onComplete, onCancel }) {
  // ── Speech recognition ref ──────────────────────────────────────────────
  const SRRef = useRef(null);
  useEffect(() => {
    if (typeof window === "undefined") return;
    SRRef.current = window.SpeechRecognition || window.webkitSpeechRecognition || null;
  }, []);

  // ── Recording infrastructure refs ───────────────────────────────────────
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recogRef = useRef(null);
  const recStartMsRef = useRef(0);
  const segStartRef = useRef(0);
  const interimTranscriptRef = useRef("");
  const recRef = useRef({ blob: null, url: null, duration: 0, transcript: "", segments: [] });
  const recSecRef = useRef(0);
  const pvAudioRef = useRef(null);
  const waveRef = useRef(null);
  const timersRef = useRef([]);
  const recorderDoneRef = useRef(null);
  const recordingRunRef = useRef(0);
  const isFinishingRef = useRef(false);

  // ── UI state ────────────────────────────────────────────────────────────
  // phase: vperm | vdenied | vcount | vrec | vproc | vconfirm
  const [phase, setPhase] = useState("vperm");
  const [recSec, setRecSec] = useState(0);
  const [countN, setCountN] = useState(3);
  const [liveText, setLiveText] = useState("");
  const [waveLive, setWaveLive] = useState(false);
  const [vcTx, setVcTx] = useState("");
  const [vcDur, setVcDur] = useState(0);
  const [vcHint, setVcHint] = useState("字幕可以修改，不會改變原語音。");
  const [pvPlaying, setPvPlaying] = useState(false);
  const [voiceBusy, setVoiceBusy] = useState(false);
  const [toastMsg, setToastMsg] = useState("");
  const [previewUrl, setPreviewUrl] = useState("");

  // ── Helpers ─────────────────────────────────────────────────────────────
  const clearTimers = useCallback(() => {
    timersRef.current.forEach((id) => {
      clearTimeout(id);
      clearInterval(id);
    });
    timersRef.current = [];
  }, []);

  const addTimer = useCallback((fn, ms, once = false) => {
    const id = once ? setTimeout(fn, ms) : setInterval(fn, ms);
    timersRef.current.push(id);
    return id;
  }, []);

  const toastTimerRef = useRef(null);
  const showToast = useCallback((msg) => {
    setToastMsg(msg);
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setToastMsg(""), 2400);
  }, []);

  useEffect(() => {
    return () => clearTimeout(toastTimerRef.current);
  }, []);

  // ── Cleanup on unmount ──────────────────────────────────────────────────
  useEffect(() => {
    return () => {
      clearTimers();
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
    };
  }, [clearTimers]);

  // ── Stop helpers ─────────────────────────────────────────────────────────
  const stopWaveAndRecog = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    setWaveLive(false);
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch {}
      recogRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {}
  }, []);

  const stopRecorderAndWait = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(recRef.current.blob);
    }
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!recorderDoneRef.current) return;
        recorderDoneRef.current = null;
        const fallbackBlob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        if (fallbackBlob.size > 0) {
          resolve(fallbackBlob);
        } else {
          reject(new Error("RECORDER_STOP_TIMEOUT"));
        }
      }, 5000);
      recorderDoneRef.current = {
        resolve: (blob) => {
          window.clearTimeout(timeoutId);
          resolve(blob);
        },
        reject: (error) => {
          window.clearTimeout(timeoutId);
          reject(error);
        },
      };
      try {
        if (recorder.state === "recording") {
          try { recorder.requestData(); } catch {}
        }
        recorder.stop();
      } catch (error) {
        recorderDoneRef.current = null;
        reject(error);
      }
    });
  }, []);

  const releaseMic = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  // ── Audio waveform analyser ──────────────────────────────────────────────
  const startWave = useCallback(() => {
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      audioCtxRef.current = audioCtxRef.current || new AC();
      const src = audioCtxRef.current.createMediaStreamSource(mediaStreamRef.current);
      const analyser = audioCtxRef.current.createAnalyser();
      analyser.fftSize = 64;
      src.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      setWaveLive(true);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const bars = waveRef.current ? waveRef.current.querySelectorAll("i") : [];
        bars.forEach((b, i) => {
          b.style.height = `${Math.max(10, ((data[i + 2] || 0) / 255) * 56)}px`;
        });
        rafRef.current = requestAnimationFrame(loop);
      };
      loop();
    } catch {
      setWaveLive(false);
    }
  }, []);

  // ── Speech recognition ───────────────────────────────────────────────────
  const startRecog = useCallback(() => {
    const SR = SRRef.current;
    if (!SR) return;
    const recog = new SR();
    recogRef.current = recog;
    recog.lang = "zh-TW";
    recog.continuous = true;
    recog.interimResults = true;
    recog.onresult = (ev) => {
      let interim = "";
      const now = (performance.now() - recStartMsRef.current) / 1000;
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const r = ev.results[i];
        if (r.isFinal) {
          const t = r[0].transcript.trim();
          if (t) {
            recRef.current.segments.push({
              s: +segStartRef.current.toFixed(1),
              e: +now.toFixed(1),
              t,
            });
            segStartRef.current = now;
          }
        } else {
          interim += r[0].transcript;
        }
      }
      interimTranscriptRef.current = interim.trim();
      const shown =
        recRef.current.segments.map((s) => s.t).join("，") +
        (interim ? `，${interim}` : "");
      if (shown) setLiveText(shown.replace(/^，/, ""));
    };
    recog.onerror = () => {
      // Recognition is optional. Recording must continue even when subtitles fail.
      recogRef.current = null;
    };
    recog.onend = () => {
      if (recogRef.current === recog) recogRef.current = null;
    };
    try {
      // Chrome's optional audioTrack overload is not consistently implemented.
      // The no-argument form is the interoperable microphone path today.
      recog.start();
    } catch {
      recogRef.current = null;
      setVcHint("這個瀏覽器無法同步產生字幕；錄音仍會完整保存，錄完可自行補上文字。");
    }
  }, []);

  // ── Finish recording ─────────────────────────────────────────────────────
  const finishRec = useCallback(
    async (force) => {
      if (isFinishingRef.current) return;
      if (!force && recSecRef.current < REC_MIN) {
        showToast("再多說一句祝福就可以送出");
        return;
      }
      isFinishingRef.current = true;
      recRef.current.duration = recSecRef.current;
      stopWaveAndRecog();
      clearTimers();
      setPhase("vproc");
      try {
        await stopRecorderAndWait();
        const r = recRef.current;
        if (!r.blob?.size && chunksRef.current.length) {
          r.blob = new Blob(chunksRef.current, {
            type: mediaRecorderRef.current?.mimeType || "audio/webm",
          });
          r.url = URL.createObjectURL(r.blob);
          setPreviewUrl(r.url);
        }
        if (!r.blob?.size) throw new Error("EMPTY_RECORDING");
        r.transcript =
          r.segments.map((s) => s.t).join("，") || interimTranscriptRef.current.trim();
        setVcDur(r.duration);
        setVcTx(r.transcript);
        setVcHint(
          r.transcript
            ? "字幕可以修改，不會改變原語音。"
            : "沒有取得即時字幕；可以自己補一句，或直接送出純語音。"
        );
        setPhase("vconfirm");
      } catch {
        setPhase("vrec");
        showToast("錄音未能完整保存，請重新錄製；剛才的內容不會送出。");
      } finally {
        isFinishingRef.current = false;
      }
    },
    [clearTimers, showToast, stopRecorderAndWait, stopWaveAndRecog]
  );

  // ── Start recording ──────────────────────────────────────────────────────
  const startRec = useCallback(() => {
    const runId = recordingRunRef.current + 1;
    recordingRunRef.current = runId;
    isFinishingRef.current = false;
    recSecRef.current = 0;
    setRecSec(0);
    chunksRef.current = [];
    recRef.current = { blob: null, url: null, duration: 0, transcript: "", segments: [] };
    recStartMsRef.current = performance.now();
    segStartRef.current = 0;
    interimTranscriptRef.current = "";
    setLiveText("");
    setPreviewUrl("");

    let recorder;
    try {
      const preferredTypes = [
        "audio/webm;codecs=opus",
        "audio/webm",
        "audio/mp4;codecs=mp4a.40.2",
        "audio/mp4",
      ];
      const mimeType = preferredTypes.find((type) => MediaRecorder.isTypeSupported?.(type));
      recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);
    } catch {
      showToast("這個瀏覽器無法錄音，請改用文字禱告");
      onCancel();
      return;
    }
    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (e) => {
      if (runId === recordingRunRef.current && e.data.size) chunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      if (runId !== recordingRunRef.current) return;
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "audio/webm",
      });
      if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
      recRef.current.blob = blob;
      recRef.current.url = URL.createObjectURL(blob);
      setPreviewUrl(recRef.current.url);
      recorderDoneRef.current?.resolve(blob);
      recorderDoneRef.current = null;
    };
    recorder.onerror = (event) => {
      recorderDoneRef.current?.reject(event.error || new Error("MEDIA_RECORDER_ERROR"));
      recorderDoneRef.current = null;
      showToast("錄音裝置發生錯誤，請重新錄製。");
    };
    recorder.onstart = () => {
      if (runId !== recordingRunRef.current) return;
      recStartMsRef.current = performance.now();
      startWave();
      startRecog();
    };

    const audioTrack = mediaStreamRef.current?.getAudioTracks?.()[0];
    if (audioTrack) {
      audioTrack.onmute = () => {
        stopWaveAndRecog();
        showToast("麥克風輸入暫時中斷；請確認沒有其他程式正在使用麥克風後重新錄製。");
      };
      audioTrack.onended = () => {
        if (recorder.state === "recording") void finishRec(true);
      };
    }

    // Deliver completed audio regularly instead of depending on one large
    // browser buffer at stop time. The final dataavailable still arrives first
    // and onstop resolves only after every chunk has been collected.
    recorder.start(1000);

    addTimer(() => {
      recSecRef.current += 1;
      setRecSec(recSecRef.current);
      if (recSecRef.current >= REC_MAX) {
        showToast("已達 60 秒上限，已自動保存錄音");
        finishRec(true);
      }
    }, 1000);
  }, [addTimer, finishRec, onCancel, showToast, startRecog, startWave, stopWaveAndRecog]);

  // ── Countdown then record ─────────────────────────────────────────────────
  const runCountdown = useCallback(() => {
    let n = 3;
    setCountN(3);
    clearTimers();
    addTimer(() => {
      n -= 1;
      if (n > 0) {
        setCountN(n);
      } else {
        setPhase("vrec");
        startRec();
      }
    }, 1000);
  }, [addTimer, clearTimers, startRec]);

  // ── Request mic access ────────────────────────────────────────────────────
  const askMic = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase("vdenied");
      return;
    }
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      setPhase("vcount");
      runCountdown();
    } catch {
      setPhase("vdenied");
    }
  }, [runCountdown]);

  // ── Restart recording ────────────────────────────────────────────────────
  const restartRec = useCallback(async () => {
    stopWaveAndRecog();
    clearTimers();
    try { await stopRecorderAndWait(); } catch {}
    recordingRunRef.current += 1;
    if (pvAudioRef.current) pvAudioRef.current.pause();
    setPvPlaying(false);
    setPhase("vcount");
    runCountdown();
  }, [clearTimers, runCountdown, stopRecorderAndWait, stopWaveAndRecog]);

  // ── Cancel / close ────────────────────────────────────────────────────────
  const handleCancel = useCallback(() => {
    clearTimers();
    stopWaveAndRecog();
    stopRecorder();
    releaseMic();
    if (pvAudioRef.current) pvAudioRef.current.pause();
    if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
    onCancel();
  }, [clearTimers, onCancel, releaseMic, stopRecorder, stopWaveAndRecog]);

  // ── Preview playback ──────────────────────────────────────────────────────
  const playPreview = useCallback(() => {
    if (!previewUrl || !pvAudioRef.current) {
      showToast("沒有可播放的錄音");
      return;
    }
    if (!pvAudioRef.current.paused) {
      pvAudioRef.current.pause();
      setPvPlaying(false);
      return;
    }
    pvAudioRef.current.play()
      .then(() => setPvPlaying(true))
      .catch(() => {
        setPvPlaying(false);
        showToast("這段錄音無法解碼播放，請重新錄製後再試。");
      });
  }, [previewUrl, showToast]);

  // ── Submit voice ──────────────────────────────────────────────────────────
  const handleSubmitVoice = useCallback(() => {
    const r = recRef.current;
    const edited = vcTx.trim();

    if (!r.blob) {
      showToast("錄音資料遺失，請重新錄製");
      return;
    }

    if (edited !== r.transcript) {
      const lines = edited ? edited.split(/[，。,.!?！？\n]+/).filter(Boolean) : [];
      r.segments = lines.map((t, i) => ({
        s: +((i * r.duration) / Math.max(lines.length, 1)).toFixed(1),
        e: +(((i + 1) * r.duration) / Math.max(lines.length, 1)).toFixed(1),
        t,
      }));
      r.transcript = edited;
    }

    if (pvAudioRef.current) pvAudioRef.current.pause();
    setPvPlaying(false);
    setVoiceBusy(true);
    releaseMic();

    const ext = r.blob.type?.includes("mp4") ? "m4a" : "webm";
    const file = new File([r.blob], `prayer-voice-${Date.now()}.${ext}`, {
      type: r.blob.type || "audio/webm",
    });
    onComplete(file, r.transcript);
  }, [onComplete, releaseMic, showToast, vcTx]);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="vpo-overlay" role="dialog" aria-modal="true" aria-label="語音禱告">
      <div className="vpo-backdrop" onClick={handleCancel} />
      <div className="vpo-panel">
        {toastMsg ? <div className="vpo-toast" role="status">{toastMsg}</div> : null}

        {/* ── 步驟 1：說明 & 請求麥克風 ── */}
        {phase === "vperm" && (
          <div className="vpo-center">
            <div className="vpo-icon" aria-hidden="true">🎙</div>
            <h3 className="vpo-title">用你的聲音，留下一段祝福。</h3>
            <p className="vpo-body">
              我們只會儲存這次禱告，不會公開你的身份。
            </p>
            <button type="button" className="vpo-btn vpo-btn--primary" onClick={askMic}>
              開啟麥克風
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={handleCancel}>
              改用文字禱告
            </button>
            <p className="vpo-hint">
              字幕使用瀏覽器內建語音辨識（免費）。不支援的瀏覽器仍可錄音，錄完可自行補上文字。
            </p>
          </div>
        )}

        {/* ── 麥克風被拒 ── */}
        {phase === "vdenied" && (
          <div className="vpo-center">
            <div className="vpo-icon" aria-hidden="true">🔇</div>
            <p className="vpo-body">
              你可以改用文字禱告，<br />或到瀏覽器設定開啟麥克風。
            </p>
            <button type="button" className="vpo-btn vpo-btn--primary" onClick={handleCancel}>
              改用文字禱告
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={askMic}>
              再試一次
            </button>
          </div>
        )}

        {/* ── 倒數 ── */}
        {phase === "vcount" && (
          <div className="vpo-center">
            <div className="vpo-breath-ring" aria-label={`倒數 ${countN}`}>
              <span className="vpo-countnum">{countN}</span>
            </div>
            <p className="vpo-countdown-label">深呼吸，慢慢說。</p>
            <p className="vpo-hint">你可以說：「願你今天有平安。」</p>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={handleCancel}>
              取消
            </button>
          </div>
        )}

        {/* ── 錄音中 ── */}
        {phase === "vrec" && (
          <div className="vpo-center">
            <div className="vpo-rec-header">
              <span className="vpo-rec-dot" aria-hidden="true" />
              <span className="vpo-rec-timer">{fmt(recSec)}</span>
              <span className="vpo-rec-remain">剩餘 {REC_MAX - recSec} 秒</span>
            </div>
            <WaveBars live={waveLive} refEl={waveRef} />
            <div className="vpo-live-transcript" aria-live="polite">
              {liveText || (
                <span className="vpo-pending">
                  {SRRef.current
                    ? "開始說話，字幕會出現在這裡…"
                    : "此瀏覽器不支援即時字幕，錄完可以自己補上"}
                </span>
              )}
            </div>
            <button
              type="button"
              className="vpo-btn vpo-btn--primary"
              onClick={() => finishRec(false)}
            >
              完成
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={restartRec}>
              重新錄
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={handleCancel}>
              取消
            </button>
          </div>
        )}

        {/* ── 處理中 ── */}
        {phase === "vproc" && (
          <div className="vpo-center">
            <p className="vpo-proc-title">正在整理成字幕</p>
            <div className="vpo-dots" aria-label="處理中">
              <i /><i /><i />
            </div>
            <p className="vpo-hint">你的錄音已保留，請不要關閉。</p>
          </div>
        )}

        {/* ── 確認字幕 & 送出 ── */}
        {phase === "vconfirm" && (
          <div className="vpo-confirm">
            <div className="vpo-confirm-header">
              <span className="vpo-hint">語音 {fmt(vcDur)}</span>
              <button type="button" className="vpo-chip" onClick={playPreview}>
                {pvPlaying ? "⏸ 暫停" : "▶ 播放"}
              </button>
            </div>
            <GainAudio
              ref={pvAudioRef}
              className="vpo-preview-audio"
              src={previewUrl}
              controls
              preload="metadata"
              onPlay={() => setPvPlaying(true)}
              onPause={() => setPvPlaying(false)}
              onEnded={() => setPvPlaying(false)}
              onError={() => showToast("瀏覽器無法讀取這段錄音，請重新錄製。")}
            />
            <textarea
              className="vpo-textarea"
              rows={4}
              aria-label="逐字稿（可修改）"
              placeholder="可以在這裡補上文字祝福，或直接送出純語音"
              value={vcTx}
              onChange={(e) => setVcTx(e.target.value)}
            />
            <p className="vpo-hint">{vcHint}</p>
            <button
              type="button"
              className={`vpo-btn vpo-btn--primary${voiceBusy ? " vpo-loading" : ""}`}
              disabled={voiceBusy}
              onClick={handleSubmitVoice}
            >
              {voiceBusy ? "送出中…" : "送出語音祝福"}
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={restartRec}>
              重新錄
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
