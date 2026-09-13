import { test } from "node:test";
import assert from "node:assert/strict";

import { parseByteRange } from "../src/lib/byte-range.js";

test("no header, or a form we do not handle, serves the whole file", () => {
  assert.equal(parseByteRange(null, 1000), null);
  assert.equal(parseByteRange("", 1000), null);
  assert.equal(parseByteRange("items=0-10", 1000), null);
  assert.equal(parseByteRange("bytes=0-10,20-30", 1000), null);
  assert.equal(parseByteRange("bytes=-", 1000), null);
});

test("bounded, open-ended and suffix ranges resolve to inclusive offsets", () => {
  assert.deepEqual(parseByteRange("bytes=0-1", 1000), { start: 0, end: 1 });
  assert.deepEqual(parseByteRange("bytes=500-", 1000), { start: 500, end: 999 });
  assert.deepEqual(parseByteRange("bytes=-100", 1000), { start: 900, end: 999 });
  assert.deepEqual(parseByteRange("bytes=-5000", 1000), { start: 0, end: 999 });
});

test("an end past the file is clamped, as Safari's bytes=0-1 probe expects", () => {
  assert.deepEqual(parseByteRange("bytes=0-99999", 1000), { start: 0, end: 999 });
});

test("ranges that cannot be met are unsatisfiable", () => {
  assert.deepEqual(parseByteRange("bytes=1000-", 1000), { unsatisfiable: true });
  assert.deepEqual(parseByteRange("bytes=50-10", 1000), { unsatisfiable: true });
  assert.deepEqual(parseByteRange("bytes=-0", 1000), { unsatisfiable: true });
  assert.deepEqual(parseByteRange("bytes=0-1", 0), { unsatisfiable: true });
});
