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
