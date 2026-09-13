// Pure helpers for the prayer recorder — no React, no side effects beyond
// reading browser feature-detection globals that are passed in explicitly
// where possible, so this file stays unit-testable with `node --test`.

export const MAX_DURATION_SECONDS = 60;
export const MIN_DURATION_SECONDS = 3;

// Ordered by preference; matches the fallback list already proven in
// src/components/VoicePrayerOverlay.js so Safari/iOS (audio/mp4) and
// Chrome/Android (audio/webm;codecs=opus) both have a working path.
export const PREFERRED_MIME_TYPES = [
  "audio/webm;codecs=opus",
  "audio/webm",
  "audio/mp4;codecs=mp4a.40.2",
  "audio/mp4",
];

export function selectSupportedMimeType(candidates = PREFERRED_MIME_TYPES, isTypeSupported) {
  const check = typeof isTypeSupported === "function" ? isTypeSupported : undefined;
  if (!check) return undefined;
  return candidates.find((type) => {
    try {
      return check(type);
    } catch {
      return false;
    }
  });
}

export function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds || 0));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function isRecordingTooShort(seconds, minSeconds = MIN_DURATION_SECONDS) {
  return (seconds || 0) < minSeconds;
}

export function hasRecordingSupport(nav = typeof navigator !== "undefined" ? navigator : undefined, win = typeof window !== "undefined" ? window : undefined) {
  return Boolean(nav?.mediaDevices?.getUserMedia && win?.MediaRecorder);
}

// Opus encodes near-silence to almost nothing, so a recording that captured no
// sound is still a structurally valid file — measured here: 3s of real audio is
// ~50KB, 3s of pure silence is ~1KB with a peak amplitude of exactly 0. The only
// guard before this was `blob.size === 0`, which a silent recording sails past;
// the person then previews it, hears nothing, and has no idea why.
//
// The threshold is deliberately far below speech. Quiet room tone through a
// laptop mic still peaks around 0.02–0.05; a muted or unplugged input peaks at
// 0 or a few 1e-4 of DC offset. 0.01 separates those without rejecting someone
// who simply spoke softly.
export const SILENCE_PEAK_THRESHOLD = 0.01;

// Live-meter counterpart to the peak check above. RMS runs lower than peak for
// the same signal, so this sits below SILENCE_PEAK_THRESHOLD: it decides only
// whether the meter has ever seen the microphone move, not whether the finished
// recording is usable.
export const SILENCE_RMS_THRESHOLD = 0.005;

export function isSilentRecording(peak, threshold = SILENCE_PEAK_THRESHOLD) {
  if (typeof peak !== "number" || Number.isNaN(peak)) return false;
  return peak < threshold;
}

// The timer starts when recording is requested; the first encoded packet lands a
// moment later, so a recording stopped on the 3-second tick decodes a little
// short. Half a second of slack keeps that from reading as a failure.
export const MIN_DECODED_SECONDS = MIN_DURATION_SECONDS - 0.5;

// Floor for recordings the browser could not decode, where size is the only
// evidence left. Speech runs ~15 KB/s; the broken uploads were 301 and 3,059 B.
export const MIN_RECORDING_BYTES = 4 * 1024;

// Live captions use the browser's SpeechRecognition, which opens the microphone
// a second time. On Android the system recogniser takes the input exclusively,
// which can leave the recording's own track silent. Desktop browsers share the
// input, so they keep captions; phones and tablets record without them.
export function isMobileBrowser(nav = typeof navigator !== "undefined" ? navigator : undefined) {
  if (!nav) return false;
  if (nav.userAgentData?.mobile === true) return true;
  const ua = String(nav.userAgent || "");
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua)) return true;
  // iPadOS presents a desktop Mac user agent; touch support gives it away.
  return /Macintosh/.test(ua) && Number(nav.maxTouchPoints) > 1;
}

/**
 * Decides whether a finished recording is worth sending.
 * @param {{ analysis: {durationSeconds:number, peak:number}|null, blobSize: number }} input
 * @returns {{ ok: boolean, reason?: "empty"|"too-short"|"silent", durationSeconds: number|null }}
 */
export function judgeRecording({ analysis, blobSize } = {}) {
  if (!blobSize) return { ok: false, reason: "empty", durationSeconds: null };

  if (!analysis) {
    return blobSize < MIN_RECORDING_BYTES
      ? { ok: false, reason: "empty", durationSeconds: null }
      : { ok: true, durationSeconds: null };
  }

  const { durationSeconds, peak } = analysis;
  if (isRecordingTooShort(durationSeconds, MIN_DECODED_SECONDS)) {
    return { ok: false, reason: "too-short", durationSeconds };
  }
  if (isSilentRecording(peak)) {
    return { ok: false, reason: "silent", durationSeconds };
  }
  return { ok: true, durationSeconds };
}
