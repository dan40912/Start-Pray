// Pure gesture-direction helpers for homepage Prayer swipe navigation.
// No React, no DOM — kept unit-testable with `node --test`.

export const SWIPE_THRESHOLD_PX = 50;
// Horizontal movement must be at least this many times larger than vertical
// movement before it counts as a swipe, so vertical page scrolling on mobile
// doesn't get misread as a left/right gesture.
export const SWIPE_DIRECTION_RATIO = 1.5;

// Returns "next" | "prev" | null. deltaX/deltaY are endX-startX / endY-startY.
export function resolveSwipeDirection(deltaX, deltaY) {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  if (absX < SWIPE_THRESHOLD_PX) return null;
  if (absX < absY * SWIPE_DIRECTION_RATIO) return null;
  return deltaX < 0 ? "next" : "prev";
}

// Keyboard equivalent: left arrow = prev, right arrow = next. Returns null for
// anything else so callers can no-op instead of special-casing every key.
export function resolveArrowKeyDirection(key) {
  if (key === "ArrowLeft") return "prev";
  if (key === "ArrowRight") return "next";
  return null;
}
