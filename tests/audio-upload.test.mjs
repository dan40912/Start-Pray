import { test } from "node:test";
import assert from "node:assert/strict";

import { buildSafeAudioFileName, resolveAudioExtension } from "../src/lib/audio-upload.js";

test("keeps an allowlisted extension from the recorder file name", () => {
  assert.equal(
    buildSafeAudioFileName({ name: "card-voice-1.webm", type: "audio/webm" }),
    "card-voice-1.webm"
  );
  assert.equal(buildSafeAudioFileName({ name: "memo.M4A", type: "audio/mp4" }), "memo.m4a");
});

test("never keeps a dangerous client-chosen extension", () => {
  assert.equal(buildSafeAudioFileName({ name: "evil.html", type: "audio/webm" }), "evil.webm");
  assert.equal(buildSafeAudioFileName({ name: "x.svg", type: "audio/mpeg" }), "x.mp3");
  assert.equal(
    buildSafeAudioFileName({ name: "evil.html.webm", type: "text/html" }),
    "evil.html.webm"
  );
});

test("derives the extension from the MIME type when the name has none", () => {
  assert.equal(
    buildSafeAudioFileName({ name: "blob", type: "audio/webm;codecs=opus" }),
    "blob.webm"
  );
  assert.equal(
    buildSafeAudioFileName({ name: "", type: "audio/mp4" }, "card-voice"),
    "card-voice.m4a"
  );
});

test("rejects files that are not a known audio format", () => {
  assert.equal(buildSafeAudioFileName({ name: "evil.html", type: "text/html" }), null);
  assert.equal(buildSafeAudioFileName({ name: "evil.html", type: "audio/x-unknown" }), null);
  assert.equal(resolveAudioExtension({ name: "a.exe", type: "" }), null);
});

test("strips directories and unsafe characters from the stem", () => {
  assert.equal(buildSafeAudioFileName({ name: "../../etc/pass wd.wav", type: "" }), "pass-wd.wav");
  assert.equal(buildSafeAudioFileName({ name: "..\\..\\a.ogg", type: "" }), "a.ogg");
});
