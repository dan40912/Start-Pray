import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  PREFERRED_MIME_TYPES,
  formatDuration,
  hasRecordingSupport,
  isRecordingTooShort,
  isSilentRecording,
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
