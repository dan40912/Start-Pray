import test from "node:test";
import assert from "node:assert/strict";
import { getPlayerRouteState, shouldShowPlayer } from "../src/lib/player-visibility.mjs";

test("English and Chinese routes have the same player permissions", () => {
  for (const path of [
    "/",
    "/prayfor/9",
    "/global-prayer-room",
    "/me",
    "/me/create",
    "/admin",
    "/login",
  ]) {
    assert.deepEqual(
      getPlayerRouteState(`/en${path === "/" ? "" : path}`),
      getPlayerRouteState(path)
    );
  }
  assert.equal(getPlayerRouteState("/en/prayfor/9").supported, true);
  assert.equal(getPlayerRouteState("/en/me/create").blocked, true);
});

test("dismissal hides an idle player but cannot hide resumed playback or companion mode", () => {
  const state = {
    supported: true,
    hasPlaybackState: true,
    dismissedKey: "same-track",
    trackKey: "same-track",
    isPlaying: false,
    isCompanion: false,
  };
  assert.equal(shouldShowPlayer(state), false);
  assert.equal(shouldShowPlayer({ ...state, isPlaying: true }), true);
  assert.equal(shouldShowPlayer({ ...state, isCompanion: true }), true);
  assert.equal(shouldShowPlayer({ ...state, supported: false, isPlaying: true }), false);
  assert.equal(shouldShowPlayer({ ...state, hasPlaybackState: false, isCompanion: true }), false);
});
