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
