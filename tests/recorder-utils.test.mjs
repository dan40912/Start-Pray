import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  MIN_RECORDING_BYTES,
  PREFERRED_MIME_TYPES,
  formatDuration,
  hasRecordingSupport,
  isMobileBrowser,
  isRecordingTooShort,
  isSilentRecording,
  judgeRecording,
  selectSupportedMimeType,
  SILENCE_PEAK_THRESHOLD,
} from "../src/components/prayer-recorder/recorder-utils.js";

test("formatDuration pads seconds and floors fractional input", () => {
  assert.equal(formatDuration(0), "0:00");
  assert.equal(formatDuration(5), "0:05");
  assert.equal(formatDuration(65), "1:05");
  assert.equal(formatDuration(59.9), "0:59");
  assert.equal(formatDuration(-4), "0:00");
});

test("isRecordingTooShort compares against MIN_DURATION_SECONDS by default", () => {
  assert.equal(isRecordingTooShort(0), true);
  assert.equal(isRecordingTooShort(MIN_DURATION_SECONDS - 1), true);
  assert.equal(isRecordingTooShort(MIN_DURATION_SECONDS), false);
  assert.equal(isRecordingTooShort(MIN_DURATION_SECONDS + 1), false);
  assert.equal(isRecordingTooShort(10, 5), false);
});

test("selectSupportedMimeType returns the first candidate the browser supports", () => {
  const isTypeSupported = (type) => type === "audio/mp4;codecs=mp4a.40.2" || type === "audio/mp4";
  assert.equal(selectSupportedMimeType(PREFERRED_MIME_TYPES, isTypeSupported), "audio/mp4;codecs=mp4a.40.2");
});

test("selectSupportedMimeType returns undefined when nothing matches", () => {
  const isTypeSupported = () => false;
  assert.equal(selectSupportedMimeType(PREFERRED_MIME_TYPES, isTypeSupported), undefined);
});

test("selectSupportedMimeType returns undefined without a detector function", () => {
  assert.equal(selectSupportedMimeType(PREFERRED_MIME_TYPES, undefined), undefined);
});

test("hasRecordingSupport requires both getUserMedia and MediaRecorder", () => {
  assert.equal(hasRecordingSupport({ mediaDevices: { getUserMedia: () => {} } }, { MediaRecorder: function () {} }), true);
  assert.equal(hasRecordingSupport({ mediaDevices: {} }, { MediaRecorder: function () {} }), false);
  assert.equal(hasRecordingSupport({ mediaDevices: { getUserMedia: () => {} } }, {}), false);
  assert.equal(hasRecordingSupport(undefined, undefined), false);
});

test("duration constants match the existing VoicePrayerOverlay limits", () => {
  assert.equal(MAX_DURATION_SECONDS, 60);
  assert.equal(MIN_DURATION_SECONDS, 3);
});

// Measured on a real MediaRecorder in Chrome: 3s of a 440Hz tone decodes to a
// peak of 0.313 (≈50KB of opus), 3s of pure silence to a peak of exactly 0
// (≈1KB). The old `blob.size === 0` guard passed the silent one straight
// through to preview, which is what made "I recorded but there is no sound".
test("isSilentRecording flags a recording that captured nothing", () => {
  assert.equal(isSilentRecording(0), true);
  assert.equal(isSilentRecording(0.0001), true);
});

test("isSilentRecording keeps real speech, including quiet speech", () => {
  assert.equal(isSilentRecording(0.313), false);
  assert.equal(isSilentRecording(0.02), false);
  assert.equal(isSilentRecording(SILENCE_PEAK_THRESHOLD), false);
});

test("isSilentRecording treats an unmeasurable peak as not silent", () => {
  // A decode failure must never be reported to someone as "no sound captured".
  assert.equal(isSilentRecording(null), false);
  assert.equal(isSilentRecording(undefined), false);
  assert.equal(isSilentRecording(Number.NaN), false);
});

// Live captions open the microphone a second time. On Android the recogniser
// can take the input from the recording, so phones record without captions.
test("isMobileBrowser detects phones and tablets, including iPadOS", () => {
  const androidChrome =
    "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Mobile Safari/537.36";
  const iphone =
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";
  const mac =
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15";
  const windowsChrome =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36";

  assert.equal(isMobileBrowser({ userAgent: androidChrome }), true);
  assert.equal(isMobileBrowser({ userAgent: iphone }), true);
  assert.equal(isMobileBrowser({ userAgent: mac, maxTouchPoints: 5 }), true);
  assert.equal(isMobileBrowser({ userAgent: windowsChrome, userAgentData: { mobile: true } }), true);

  assert.equal(isMobileBrowser({ userAgent: mac, maxTouchPoints: 0 }), false);
  assert.equal(isMobileBrowser({ userAgent: windowsChrome, userAgentData: { mobile: false } }), false);
  assert.equal(isMobileBrowser(undefined), false);
});

test("judgeRecording rejects what the 2026-09-13 uploads contained", () => {
  // 30 seconds on the timer, 0.6 s of decoded audio.
  assert.deepEqual(judgeRecording({ analysis: { durationSeconds: 0.6, peak: 0 }, blobSize: 301 }), {
    ok: false,
    reason: "too-short",
    durationSeconds: 0.6,
  });
  const silent = judgeRecording({ analysis: { durationSeconds: 30, peak: 0 }, blobSize: 9000 });
  assert.equal(silent.ok, false);
  assert.equal(silent.reason, "silent");
});

test("judgeRecording accepts real speech and reports the decoded length", () => {
  assert.deepEqual(judgeRecording({ analysis: { durationSeconds: 9.18, peak: 0.4 }, blobSize: 148087 }), {
    ok: true,
    durationSeconds: 9.18,
  });
  // Stopped right on the 3-second tick decodes a touch short; that is fine.
  assert.equal(judgeRecording({ analysis: { durationSeconds: 2.8, peak: 0.3 }, blobSize: 40000 }).ok, true);
});

test("judgeRecording falls back to size only when the browser could not decode", () => {
  assert.deepEqual(judgeRecording({ analysis: null, blobSize: 50000 }), { ok: true, durationSeconds: null });
  assert.equal(judgeRecording({ analysis: null, blobSize: MIN_RECORDING_BYTES - 1 }).ok, false);
  assert.equal(judgeRecording({ analysis: null, blobSize: 0 }).reason, "empty");
});
