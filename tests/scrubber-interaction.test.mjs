import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as utils from "../src/components/player/scrubber-utils.js";

// Exercise the shipped hook's event handlers without a browser or audio device.
function harness() {
  const source = readFileSync(new URL("../src/components/GlobalPlayer.js", import.meta.url), "utf8");
  const start = source.indexOf("function useQueueScrubber(");
  const end = source.indexOf("function isSameTrack(", start);
  assert.ok(start >= 0 && end > start);
  const seeks = [];
  const timers = [];
  const effects = [];
  const hook = vm.runInNewContext(`${source.slice(start, end)}\nuseQueueScrubber`, {
    ...utils,
    useRef: (value) => ({ current: value }),
    useState: (value) => [value, () => {}],
    useCallback: (fn) => fn,
    useEffect: (fn) => effects.push(fn),
    window: { setTimeout: (fn) => timers.push(fn), clearTimeout() {} },
    SEEK_SETTLE_TOLERANCE_SECONDS: 0.75, SEEK_SETTLE_TIMEOUT_MS: 1200,
    formatTime: String,
  });
  const result = hook({ progress: 10, duration: 100, trackKey: "first", onSeek: (t) => seeks.push(t) });
  result.barRef.current = {
    getBoundingClientRect: () => ({ left: 0, width: 200 }),
    setPointerCapture() {}, releasePointerCapture() {}, focus() {},
  };
  effects.forEach((fn) => fn());
  return { ...result, seeks };
}

const event = (x = 100) => ({ pointerId: 1, button: 0, clientX: x });

test("scrubbing previews without seeking and commits once on release", () => {
  const h = harness();
  h.barProps.onPointerDown(event());
  h.barProps.onPointerMove(event(150));
  assert.deepEqual(h.seeks, []);
  h.barProps.onPointerUp(event(150));
  h.barProps.onPointerUp(event(150));
  assert.deepEqual(h.seeks, [75]);
});

for (const cancel of ["onPointerCancel", "onLostPointerCapture"]) {
  test(`${cancel} discards the gesture and allows a fresh drag`, () => {
    const h = harness();
    h.barProps.onPointerDown(event());
    h.barProps[cancel](event());
    h.barProps.onPointerUp(event());
    assert.deepEqual(h.seeks, []);
    h.barProps.onPointerDown(event(50));
    h.barProps.onPointerUp(event(50));
    assert.deepEqual(h.seeks, [25]);
  });
}
