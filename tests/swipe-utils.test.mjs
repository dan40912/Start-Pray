import { test } from "node:test";
import assert from "node:assert/strict";

import {
  SWIPE_THRESHOLD_PX,
  resolveArrowKeyDirection,
  resolveSwipeDirection,
} from "../src/components/home-companion/swipe-utils.js";

test("resolveSwipeDirection ignores movement below the threshold", () => {
  assert.equal(resolveSwipeDirection(SWIPE_THRESHOLD_PX - 1, 0), null);
  assert.equal(resolveSwipeDirection(-(SWIPE_THRESHOLD_PX - 1), 0), null);
});

test("resolveSwipeDirection returns next for a leftward swipe", () => {
  assert.equal(resolveSwipeDirection(-100, 0), "next");
});

test("resolveSwipeDirection returns prev for a rightward swipe", () => {
  assert.equal(resolveSwipeDirection(100, 0), "prev");
});

test("resolveSwipeDirection ignores a mostly-vertical gesture", () => {
  // Horizontal delta clears the threshold but is not >= 1.5x the vertical delta.
  assert.equal(resolveSwipeDirection(60, 100), null);
});

test("resolveSwipeDirection allows a horizontal gesture with some vertical drift", () => {
  assert.equal(resolveSwipeDirection(-120, 20), "next");
});

test("resolveArrowKeyDirection maps arrow keys and ignores everything else", () => {
  assert.equal(resolveArrowKeyDirection("ArrowLeft"), "prev");
  assert.equal(resolveArrowKeyDirection("ArrowRight"), "next");
  assert.equal(resolveArrowKeyDirection("Enter"), null);
  assert.equal(resolveArrowKeyDirection(" "), null);
});
