import { test } from "node:test";
import assert from "node:assert/strict";

import { MAX_VOICE_DURATION_SECONDS, MAX_VOICE_FILE_BYTES } from "../src/lib/voiceModeration.js";
import { MAX_DURATION_SECONDS } from "../src/components/prayer-recorder/recorder-utils.js";

// Cheap guard against someone bumping one of these two duration constants
// (the 60s anonymous-response limit vs. the 180s card-voice-message limit)
// and forgetting the other — see CardVoiceRecorder.js, which relies on
// MAX_VOICE_DURATION_SECONDS being strictly longer than the default.
test("MAX_VOICE_DURATION_SECONDS is 180 (3 minutes)", () => {
  assert.equal(MAX_VOICE_DURATION_SECONDS, 180);
});

test("MAX_VOICE_DURATION_SECONDS is strictly greater than the 60s anonymous-response limit", () => {
  assert.ok(MAX_VOICE_DURATION_SECONDS > MAX_DURATION_SECONDS);
});

test("MAX_VOICE_FILE_BYTES is a positive byte count sized for a 3-minute recording", () => {
  assert.ok(MAX_VOICE_FILE_BYTES > 0);
  assert.equal(MAX_VOICE_FILE_BYTES, 15 * 1024 * 1024);
});
