import { test } from "node:test";
import assert from "node:assert/strict";

import {
  PRAYED_GUEST_MAX_DISTINCT_PRAYERS,
  PRAYED_IP_MAX_REQUESTS,
  actorKeyHashForGuest,
  actorKeyHashForUser,
  isGuestRateLimited,
  isPrayerUnavailable,
  resolveActor,
} from "../src/lib/prayed-reaction.js";
import { hashGuestId } from "../src/lib/guest-response.js";

test("actorKeyHashForUser is deterministic for the same userId", () => {
  assert.equal(actorKeyHashForUser("user-1"), actorKeyHashForUser("user-1"));
});

test("actorKeyHashForUser differs between different users", () => {
  assert.notEqual(actorKeyHashForUser("user-1"), actorKeyHashForUser("user-2"));
});

test("actorKeyHashForGuest matches the existing hashGuestId (same guest identity across features)", () => {
  assert.equal(actorKeyHashForGuest("guest-abc"), hashGuestId("guest-abc"));
});

test("actorKeyHashForUser and actorKeyHashForGuest never collide even with the same raw input", () => {
  assert.notEqual(actorKeyHashForUser("same-value"), actorKeyHashForGuest("same-value"));
});

test("resolveActor returns a USER actor when a session is present", () => {
  const actor = resolveActor({ session: { userId: "user-1" }, guestId: "guest-abc" });
  assert.equal(actor.actorType, "USER");
  assert.equal(actor.userId, "user-1");
  assert.equal(actor.actorKeyHash, actorKeyHashForUser("user-1"));
});

test("resolveActor returns a GUEST actor when there is no session but a guestId", () => {
  const actor = resolveActor({ session: null, guestId: "guest-abc" });
  assert.equal(actor.actorType, "GUEST");
  assert.equal(actor.userId, null);
  assert.equal(actor.actorKeyHash, actorKeyHashForGuest("guest-abc"));
});

test("resolveActor returns null when neither a session nor a guestId is available", () => {
  assert.equal(resolveActor({ session: null, guestId: null }), null);
});

test("isPrayerUnavailable is false for a normal, visible prayer", () => {
  assert.equal(isPrayerUnavailable({ isBlocked: false, isPrivate: false }), false);
});

test("isPrayerUnavailable is true when blocked or private", () => {
  assert.equal(isPrayerUnavailable({ isBlocked: true, isPrivate: false }), true);
  assert.equal(isPrayerUnavailable({ isBlocked: false, isPrivate: true }), true);
});

test("isPrayerUnavailable is true for a missing (not found / deleted) prayer", () => {
  assert.equal(isPrayerUnavailable(null), true);
});

test("isGuestRateLimited allows requests under both thresholds", () => {
  assert.equal(isGuestRateLimited({ distinctPrayerCount: 0, ipCount: 0 }), false);
  assert.equal(
    isGuestRateLimited({
      distinctPrayerCount: PRAYED_GUEST_MAX_DISTINCT_PRAYERS - 1,
      ipCount: PRAYED_IP_MAX_REQUESTS - 1,
    }),
    false
  );
});

test("isGuestRateLimited blocks once the distinct-prayer threshold is reached", () => {
  assert.equal(isGuestRateLimited({ distinctPrayerCount: PRAYED_GUEST_MAX_DISTINCT_PRAYERS, ipCount: 0 }), true);
});

test("isGuestRateLimited blocks once the IP threshold is reached, even for a fresh guest", () => {
  assert.equal(isGuestRateLimited({ distinctPrayerCount: 0, ipCount: PRAYED_IP_MAX_REQUESTS }), true);
});
