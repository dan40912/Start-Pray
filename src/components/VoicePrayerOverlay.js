"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import GainAudio from "@/components/GainAudio";
import { analyzeRecording } from "@/components/prayer-recorder/analyze-recording";
import {
  SILENCE_RMS_THRESHOLD,
  isMobileBrowser,
  judgeRecording,
} from "@/components/prayer-recorder/recorder-utils";

const REC_MAX = 60;
const REC_MIN = 3;

// MediaRecorder is started with a 1-second timeslice, so a healthy recording
// hands over a chunk every second. If the microphone stops delivering, the
// chunks stop while the timer keeps counting. Five seconds without a chunk is
// well past any normal delivery jitter.
const INPUT_STALL_MS = 5000;

const FAIL_MESSAGES = {
  empty: "錄音未能完整保存，剛才的內容不會送出。請重新錄製。",
  silent: "錄音裡沒有收到任何聲音，可能是麥克風被靜音或被其他程式佔用。剛才的內容不會送出，請重新錄製。",
  tooShort: (seconds) =>
    `只錄到 ${seconds.toFixed(1)} 秒的聲音，麥克風可能在錄音途中被中斷了。剛才的內容不會送出，請重新錄製。`,
};

function failMessageFor(verdict) {
  if (verdict.reason === "silent") return FAIL_MESSAGES.silent;
  if (verdict.reason === "too-short" && Number.isFinite(verdict.durationSeconds)) {
    return FAIL_MESSAGES.tooShort(verdict.durationSeconds);
  }
  return FAIL_MESSAGES.empty;
}

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

function emptyRecording() {
  return { blob: null, url: null, duration: 0, transcript: "", segments: [], verified: false };
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
  // Captions run only where they can share the microphone with the recorder.
  // See isMobileBrowser in recorder-utils for why phones record without them.
  const SRRef = useRef(null);
  const captionsOnRef = useRef(false);
  const [captionsOn, setCaptionsOn] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined") return;
    SRRef.current = window.SpeechRecognition || window.webkitSpeechRecognition || null;
    captionsOnRef.current = Boolean(SRRef.current) && !isMobileBrowser();
    setCaptionsOn(captionsOnRef.current);
  }, []);

  // ── Recording infrastructure refs ───────────────────────────────────────
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const lastChunkAtRef = useRef(0);
  const chunkSeenRef = useRef(false);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const recogRef = useRef(null);
  const recStartMsRef = useRef(0);
  const segStartRef = useRef(0);
  const interimTranscriptRef = useRef("");
  const recRef = useRef(emptyRecording());
  const recSecRef = useRef(0);
  const pvAudioRef = useRef(null);
  const waveRef = useRef(null);
  const meterFillRef = useRef(null);
  const heardSoundRef = useRef(false);
  const timersRef = useRef([]);
  const recorderDoneRef = useRef(null);
  const recordingRunRef = useRef(0);
  const isFinishingRef = useRef(false);

  // ── UI state ────────────────────────────────────────────────────────────
  // phase: vperm | vdenied | vcount | vrec | vproc | vconfirm | vfail
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
  const [failMsg, setFailMsg] = useState("");
  // Same input detector as the homepage recorder: the wave bars animate even
  // with no signal, so on their own they cannot tell a muted mic from a live one.
  const [heardSound, setHeardSound] = useState(false);

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
    if (meterFillRef.current) meterFillRef.current.style.transform = "scaleX(0.02)";
    if (recogRef.current) {
      try { recogRef.current.stop(); } catch {}
      recogRef.current = null;
    }
  }, []);

  const stopRecorder = useCallback(() => {
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
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
      // A second, wider window for the level meter: 64 samples is too short
      // for a stable RMS reading.
      const levelAnalyser = audioCtxRef.current.createAnalyser();
      levelAnalyser.fftSize = 1024;
      src.connect(levelAnalyser);
      const samples = new Float32Array(levelAnalyser.fftSize);
      setWaveLive(true);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const bars = waveRef.current ? waveRef.current.querySelectorAll("i") : [];
        bars.forEach((b, i) => {
          b.style.height = `${Math.max(10, ((data[i + 2] || 0) / 255) * 56)}px`;
        });

        levelAnalyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        // Written straight to the element, like the bars, so the overlay does
        // not re-render sixty times a second. Scale matches the homepage meter.
        if (meterFillRef.current) {
          meterFillRef.current.style.transform = `scaleX(${Math.max(0.02, Math.min(1, rms * 6))})`;
        }
        if (!heardSoundRef.current && rms >= SILENCE_RMS_THRESHOLD) {
          heardSoundRef.current = true;
          setHeardSound(true);
        }
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

  // ── Give up on a recording ───────────────────────────────────────────────
  // Everything captured so far is discarded and the microphone released, so a
  // retry starts from a fresh stream rather than the one that just failed.
  const failRecording = useCallback(
    (message) => {
      recordingRunRef.current += 1;
      stopWaveAndRecog();
      clearTimers();
      stopRecorder();
      releaseMic();
      if (recRef.current.url) URL.revokeObjectURL(recRef.current.url);
      recRef.current = emptyRecording();
      setPreviewUrl("");
      setFailMsg(message);
      setPhase("vfail");
    },
    [clearTimers, releaseMic, stopRecorder, stopWaveAndRecog]
  );

  // ── Finish recording ─────────────────────────────────────────────────────
  // `force` only skips the timer's 3-second gate (auto-stop at the limit, a
  // lost microphone). It never skips checking the audio itself: the timer
  // proves time passed, not that anything was recorded.
  const finishRec = useCallback(
    async (force) => {
      if (isFinishingRef.current) return;
      if (!force && recSecRef.current < REC_MIN) {
        showToast("再多說一句祝福就可以送出");
        return;
      }
      isFinishingRef.current = true;
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

        const verdict = judgeRecording({
          analysis: await analyzeRecording(r.blob),
          blobSize: r.blob?.size || 0,
        });
        if (!verdict.ok) {
          failRecording(failMessageFor(verdict));
          return;
        }

        r.duration = verdict.durationSeconds ?? recSecRef.current;
        r.verified = true;
        r.transcript =
          r.segments.map((s) => s.t).join("，") || interimTranscriptRef.current.trim();
        setVcDur(r.duration);
        setVcTx(r.transcript);
        setVcHint(
          r.transcript
            ? "字幕可以修改，不會改變原語音。"
            : captionsOnRef.current
              ? "沒有取得即時字幕；可以自己補一句，或直接送出純語音。"
              : "可以在這裡補上一句文字，或直接送出純語音。"
        );
        setPhase("vconfirm");
      } catch {
        failRecording(FAIL_MESSAGES.empty);
      } finally {
        isFinishingRef.current = false;
      }
    },
    [clearTimers, failRecording, showToast, stopRecorderAndWait, stopWaveAndRecog]
  );

  // ── Start recording ──────────────────────────────────────────────────────
  const startRec = useCallback(() => {
    const runId = recordingRunRef.current + 1;
    recordingRunRef.current = runId;
    isFinishingRef.current = false;
    recSecRef.current = 0;
    setRecSec(0);
    chunksRef.current = [];
    chunkSeenRef.current = false;
    heardSoundRef.current = false;
    setHeardSound(false);
    recRef.current = emptyRecording();
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
      if (runId !== recordingRunRef.current || !e.data.size) return;
      chunksRef.current.push(e.data);
      chunkSeenRef.current = true;
      lastChunkAtRef.current = performance.now();
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
      lastChunkAtRef.current = performance.now();
      startWave();
      if (captionsOnRef.current) startRecog();
    };

    const audioTrack = mediaStreamRef.current?.getAudioTracks?.()[0];
    if (audioTrack) {
      audioTrack.onmute = () => {
        stopWaveAndRecog();
        showToast("麥克風輸入暫時中斷；請確認沒有其他程式正在使用麥克風。");
      };
      // Keep whatever was captured before the track ended — finishRec checks
      // the audio and turns this into a retry if too little was recorded.
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
      if (isFinishingRef.current || recorder.state !== "recording") return;

      // Armed only after a first chunk, so a browser that ignores the timeslice
      // and delivers everything at stop is never mistaken for a lost microphone.
      if (chunkSeenRef.current && performance.now() - lastChunkAtRef.current > INPUT_STALL_MS) {
        showToast("麥克風停止收音了，正在保存已錄到的部分");
        void finishRec(true);
        return;
      }

      if (recSecRef.current >= REC_MAX) {
        showToast("已達 60 秒上限，已自動保存錄音");
        void finishRec(true);
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
        // The countdown interval must die here. It used to keep ticking, so
        // every second after zero it called startRec() again: a new recorder,
        // a cleared chunk list, a fresh caption session. The uploaded file only
        // ever held the audio since the last restart — 0.18 s and 0.6 s on
        // 2026-09-13 — while the stacked record timers kept the clock moving.
        clearTimers();
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
    releaseMic();
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
      setPhase("vcount");
      runCountdown();
    } catch {
      setPhase("vdenied");
    }
  }, [releaseMic, runCountdown]);

  // ── Restart recording ────────────────────────────────────────────────────
  const restartRec = useCallback(async () => {
    stopWaveAndRecog();
    clearTimers();
    try { await stopRecorderAndWait(); } catch {}
    recordingRunRef.current += 1;
    if (pvAudioRef.current) pvAudioRef.current.pause();
    setPvPlaying(false);
    // A stream whose track has ended cannot record again; ask for a new one.
    const track = mediaStreamRef.current?.getAudioTracks?.()[0];
    if (!track || track.readyState !== "live") {
      await askMic();
      return;
    }
    setPhase("vcount");
    runCountdown();
  }, [askMic, clearTimers, runCountdown, stopRecorderAndWait, stopWaveAndRecog]);

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

    if (!r.blob || !r.verified) {
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
              {captionsOn
                ? "字幕使用瀏覽器內建語音辨識（免費）。不支援的瀏覽器仍可錄音，錄完可自行補上文字。"
                : "為了確保錄音完整，錄音時不會同步產生字幕；錄完可以自己補上文字。"}
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
            <div
              className="vpo-meter"
              role="img"
              aria-label={heardSound ? "目前有收到聲音" : "目前沒有收到聲音"}
            >
              <span ref={meterFillRef} className="vpo-meter-fill" />
            </div>
            {!heardSound && recSec >= 2 ? (
              <p className="vpo-meter-notice" role="status">
                還沒有收到聲音，檢查一下麥克風是不是被靜音了。
              </p>
            ) : null}
            <div className="vpo-live-transcript" aria-live="polite">
              {liveText || (
                <span className="vpo-pending">
                  {captionsOn
                    ? "開始說話，字幕會出現在這裡…"
                    : "開始說話吧，錄完可以自己補上文字"}
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
            <p className="vpo-proc-title">正在確認錄音</p>
            <div className="vpo-dots" aria-label="處理中">
              <i /><i /><i />
            </div>
            <p className="vpo-hint">你的錄音已保留，請不要關閉。</p>
          </div>
        )}

        {/* ── 錄音失敗 ── */}
        {phase === "vfail" && (
          <div className="vpo-center" role="alert">
            <div className="vpo-icon" aria-hidden="true">🎙</div>
            <p className="vpo-body">{failMsg}</p>
            <button type="button" className="vpo-btn vpo-btn--primary" onClick={askMic}>
              重新錄製
            </button>
            <button type="button" className="vpo-btn vpo-btn--ghost" onClick={handleCancel}>
              改用文字禱告
            </button>
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
