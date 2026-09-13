import { test } from "node:test";
import assert from "node:assert/strict";

import { isWebmBuffer, readWebmDurationSeconds } from "../src/lib/audio-duration.js";

// Builds a WebM laid out the way Chrome's MediaRecorder writes one: an
// unknown-size Segment and Clusters, no Duration element, Opus SimpleBlocks.
const UNKNOWN_SIZE = [0x01, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff, 0xff];

function element(id, payload) {
  assert.ok(payload.length < 127, "test helper only encodes 1-byte sizes");
  return [...id, 0x80 | payload.length, ...payload];
}

function uint16(value) {
  return [(value >> 8) & 0xff, value & 0xff];
}

function simpleBlock(relativeMs) {
  const rel = relativeMs & 0xffff;
  return element([0xa3], [0x81, ...uint16(rel), 0x80, 0xfb, 0x03, 0xff, 0xfe, 0xff, 0xfe, 0xff, 0xfe]);
}

function cluster(timecodeMs, blockOffsets) {
  const timecode = element([0xe7], uint16(timecodeMs));
  return [0x1f, 0x43, 0xb6, 0x75, ...UNKNOWN_SIZE, ...timecode, ...blockOffsets.flatMap(simpleBlock)];
}

function webm(clusters, { duration } = {}) {
  const header = element([0x1a, 0x45, 0xdf, 0xa3], element([0x42, 0x82], [0x77, 0x65, 0x62, 0x6d]));
  const infoChildren = [...element([0x2a, 0xd7, 0xb1], [0x0f, 0x42, 0x40])];
  if (duration !== undefined) {
    const view = new DataView(new ArrayBuffer(8));
    view.setFloat64(0, duration);
    infoChildren.push(...element([0x44, 0x89], [...new Uint8Array(view.buffer)]));
  }
  const info = element([0x15, 0x49, 0xa9, 0x66], infoChildren);
  const tracks = element([0x16, 0x54, 0xae, 0x6b], [0xae, 0x83, 0xd7, 0x81, 0x01]);
  return Uint8Array.from([
    ...header,
    0x18, 0x53, 0x80, 0x67, ...UNKNOWN_SIZE,
    ...info,
    ...tracks,
    ...clusters.flat(),
  ]);
}

test("isWebmBuffer recognises the EBML magic and nothing else", () => {
  assert.equal(isWebmBuffer(webm([cluster(0, [0])])), true);
  assert.equal(isWebmBuffer(Uint8Array.from([0x00, 0x00, 0x00, 0x20, 0x66, 0x74, 0x79, 0x70])), false);
  assert.equal(isWebmBuffer(new Uint8Array(0)), false);
});

test("a file holding 0.6s reads as 0.6s, not as the timer's 30s", () => {
  // Mirrors the 301-byte upload of 2026-09-13: ten 60 ms packets, then nothing.
  const offsets = [0, 59, 120, 180, 240, 300, 360, 421, 480, 540];
  const seconds = readWebmDurationSeconds(webm([cluster(0, offsets)]));
  assert.ok(Math.abs(seconds - 0.6) < 0.01, `got ${seconds}`);
});

test("blocks across several clusters use each cluster's own timecode", () => {
  const seconds = readWebmDurationSeconds(
    webm([cluster(0, [0, 60, 120]), cluster(10000, [0, 60]), cluster(29940, [0, 60])])
  );
  assert.ok(Math.abs(seconds - 30.06) < 0.01, `got ${seconds}`);
});

test("a declared Duration element wins over block timestamps", () => {
  const seconds = readWebmDurationSeconds(webm([cluster(0, [0, 60])], { duration: 12500 }));
  assert.equal(seconds, 12.5);
});

test("a truncated final block still counts its timestamp", () => {
  const whole = webm([cluster(0, [0, 60]), cluster(5000, [0])]);
  const seconds = readWebmDurationSeconds(whole.subarray(0, whole.length - 6));
  assert.ok(seconds >= 5 && seconds < 5.2, `got ${seconds}`);
});

test("files without any audio block, or that are not WebM, return null", () => {
  assert.equal(readWebmDurationSeconds(webm([])), null);
  assert.equal(readWebmDurationSeconds(Uint8Array.from([1, 2, 3, 4, 5])), null);
  assert.equal(readWebmDurationSeconds(null), null);
});
