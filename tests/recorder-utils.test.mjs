import { test } from "node:test";
import assert from "node:assert/strict";

import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  PREFERRED_MIME_TYPES,
  formatDuration,
  hasRecordingSupport,
  isRecordingTooShort,
  selectSupportedMimeType,
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
