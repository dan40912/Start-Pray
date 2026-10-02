import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

// Execute the actual submission callbacks with controlled network results.
// This harness intentionally omits JSX and microphone access; browser/device
// recording still needs separate verification.
function callback(file, name, endMarker, context) {
  const source = readFileSync(new URL(file, import.meta.url), "utf8");
  const start = source.indexOf(`  const ${name} =`);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, "submission callback must remain discoverable");
  return vm.runInNewContext(`${source.slice(start, end)}\n${name}`, context);
}

test("failed voice submission keeps the composer recording; retry closes only on success", async () => {
  let saved = false;
  const closed = [];
  const preview = { current: null };
  const file = new Blob(["recording"], { type: "audio/webm" });
  const submit = callback("../src/components/Comments.js", "handleVoiceComplete", "  // The server", {
    submitResponse: async ({ audioOverride }) => {
      assert.equal(audioOverride, file);
      return saved;
    },
    setShowVoiceOverlay: (value) => closed.push(value),
    successBlobUrlRef: preview,
    URL: { createObjectURL: () => "blob:retry-preview", revokeObjectURL() {} },
    setSuccessHasVoice() {},
  });
  assert.equal(await submit(file, "prayer"), false);
  assert.deepEqual(closed, []);
  assert.equal(preview.current, null);
  saved = true;
  assert.equal(await submit(file, "prayer"), true);
  assert.deepEqual(closed, [false]);
  assert.equal(preview.current, "blob:retry-preview");
});

for (const outcome of ["pending", "rejected"]) {
  test(`overlay preserves verified audio and unlocks retry after ${outcome} submission`, async () => {
    const busy = [];
    const notices = [];
    const recording = { blob: new Blob(["audio"], { type: "audio/webm" }), verified: true,
      transcript: "prayer", duration: 5, segments: [], url: "blob:original" };
    const submit = callback("../src/components/VoicePrayerOverlay.js", "handleSubmitVoice", "  // ── Render", {
      useCallback: (fn) => fn,
      recRef: { current: recording }, vcTx: "prayer", voiceBusy: false,
      pvAudioRef: { current: null }, setPvPlaying() {}, releaseMic() {},
      setVoiceBusy: (value) => busy.push(value), showToast: (text) => notices.push(text),
      File,
      onComplete: async () => {
        if (outcome === "rejected") throw new Error("network unavailable");
        return false;
      },
    });
    await submit();
    assert.deepEqual(busy, [true, false]);
    assert.equal(recording.verified, true);
    assert.equal(recording.url, "blob:original");
    assert.ok(recording.blob.size > 0);
    assert.match(notices[0], /錄音已保留/);
  });
}
