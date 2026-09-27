import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SEEK_STEP_LARGE_SECONDS,
  SEEK_STEP_SECONDS,
  clampTime,
  isSeekableDuration,
  percentFromTime,
  ratioFromPointer,
  resolveKeyboardSeek,
  timeFromRatio,
} from "../src/components/player/scrubber-utils.js";

test("isSeekableDuration rejects unknown, zero and negative durations", () => {
  assert.equal(isSeekableDuration(12), true);
  assert.equal(isSeekableDuration(0), false);
  assert.equal(isSeekableDuration(-1), false);
  assert.equal(isSeekableDuration(NaN), false);
  assert.equal(isSeekableDuration(Infinity), false);
  assert.equal(isSeekableDuration(undefined), false);
  assert.equal(isSeekableDuration(null), false);
});

test("timeFromRatio never divides by an unusable duration", () => {
  assert.equal(timeFromRatio(0.5, 0), null);
  assert.equal(timeFromRatio(0.5, NaN), null);
  assert.equal(timeFromRatio(0.5, Infinity), null);
  assert.equal(timeFromRatio(NaN, 10), null);
});

test("timeFromRatio clamps a pointer dragged past either end", () => {
  assert.equal(timeFromRatio(-0.4, 10), 0);
  assert.equal(timeFromRatio(1.8, 10), 10);
  assert.equal(timeFromRatio(0.25, 10), 2.5);
});

test("ratioFromPointer returns null for a zero-width or missing track", () => {
  assert.equal(ratioFromPointer(100, null), null);
  assert.equal(ratioFromPointer(100, { left: 0, width: 0 }), null);
  assert.equal(ratioFromPointer(100, { left: 0, width: NaN }), null);
  assert.equal(ratioFromPointer(NaN, { left: 0, width: 200 }), null);
});

test("ratioFromPointer measures from the track's left edge and clamps", () => {
  const rect = { left: 40, width: 200 };
  assert.equal(ratioFromPointer(40, rect), 0);
  assert.equal(ratioFromPointer(140, rect), 0.5);
  assert.equal(ratioFromPointer(240, rect), 1);
  // 拖出軌道兩端仍然只會停在兩端，不會變成負值或大於 1。
  assert.equal(ratioFromPointer(-500, rect), 0);
  assert.equal(ratioFromPointer(5000, rect), 1);
});

test("percentFromTime degrades to 0 instead of NaN", () => {
  assert.equal(percentFromTime(5, 0), 0);
  assert.equal(percentFromTime(5, NaN), 0);
  assert.equal(percentFromTime(NaN, 10), 0);
  assert.equal(percentFromTime(2.5, 10), 25);
  assert.equal(percentFromTime(99, 10), 100);
  assert.equal(percentFromTime(-3, 10), 0);
});

test("clampTime keeps a target inside the track", () => {
  assert.equal(clampTime(-5, 10), 0);
  assert.equal(clampTime(50, 10), 10);
  assert.equal(clampTime(4, 10), 4);
  assert.equal(clampTime(4, 0), null);
});

test("resolveKeyboardSeek steps by 5 seconds, or 15 with Shift", () => {
  assert.equal(resolveKeyboardSeek({ key: "ArrowRight" }, 20, 100), 20 + SEEK_STEP_SECONDS);
  assert.equal(resolveKeyboardSeek({ key: "ArrowLeft" }, 20, 100), 20 - SEEK_STEP_SECONDS);
  assert.equal(
    resolveKeyboardSeek({ key: "ArrowRight", shiftKey: true }, 20, 100),
    20 + SEEK_STEP_LARGE_SECONDS
  );
  assert.equal(
    resolveKeyboardSeek({ key: "ArrowLeft", shiftKey: true }, 20, 100),
    20 - SEEK_STEP_LARGE_SECONDS
  );
});

test("resolveKeyboardSeek follows the ARIA slider directions for up and down", () => {
  assert.equal(resolveKeyboardSeek({ key: "ArrowUp" }, 20, 100), 25);
  assert.equal(resolveKeyboardSeek({ key: "ArrowDown" }, 20, 100), 15);
});

test("resolveKeyboardSeek jumps to both ends", () => {
  assert.equal(resolveKeyboardSeek({ key: "Home" }, 20, 100), 0);
  assert.equal(resolveKeyboardSeek({ key: "End" }, 20, 100), 100);
});

test("resolveKeyboardSeek clamps at the ends instead of overshooting", () => {
  assert.equal(resolveKeyboardSeek({ key: "ArrowLeft" }, 2, 100), 0);
  assert.equal(resolveKeyboardSeek({ key: "ArrowRight" }, 98, 100), 100);
});

test("resolveKeyboardSeek ignores keys that belong to other controls", () => {
  assert.equal(resolveKeyboardSeek({ key: "Tab" }, 20, 100), null);
  assert.equal(resolveKeyboardSeek({ key: "Enter" }, 20, 100), null);
  assert.equal(resolveKeyboardSeek({ key: " " }, 20, 100), null);
  assert.equal(resolveKeyboardSeek({ key: "Escape" }, 20, 100), null);
});

test("resolveKeyboardSeek refuses to seek when the duration is unknown", () => {
  assert.equal(resolveKeyboardSeek({ key: "ArrowRight" }, 0, 0), null);
  assert.equal(resolveKeyboardSeek({ key: "End" }, 0, NaN), null);
  assert.equal(resolveKeyboardSeek({ key: "Home" }, 0, undefined), null);
});

test("resolveKeyboardSeek treats an unknown current position as 0", () => {
  assert.equal(resolveKeyboardSeek({ key: "ArrowRight" }, NaN, 100), SEEK_STEP_SECONDS);
  assert.equal(resolveKeyboardSeek({ key: "ArrowLeft" }, undefined, 100), 0);
});
