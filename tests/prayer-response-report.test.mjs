import { test } from "node:test";
import assert from "node:assert/strict";

import {
  GUEST_REPORT_MAX_PER_GUEST,
  GUEST_REPORT_MAX_PER_IP,
  buildGuestReportActorId,
  isGuestRateLimited,
  isResponseAlreadyHidden,
} from "../src/lib/prayer-response-report.js";

test("buildGuestReportActorId prefixes the guest hash so it can't collide with a real userId", () => {
  assert.equal(buildGuestReportActorId("abc123"), "guest:abc123");
});

test("isResponseAlreadyHidden is false for a normal APPROVED, unblocked response", () => {
  assert.equal(isResponseAlreadyHidden({ isBlocked: false, moderationStatus: "APPROVED" }), false);
});

test("isResponseAlreadyHidden is true once moderationStatus leaves APPROVED", () => {
  assert.equal(isResponseAlreadyHidden({ isBlocked: false, moderationStatus: "PENDING" }), true);
});

test("isResponseAlreadyHidden is true when isBlocked, even if moderationStatus is still APPROVED", () => {
  assert.equal(isResponseAlreadyHidden({ isBlocked: true, moderationStatus: "APPROVED" }), true);
});

test("isResponseAlreadyHidden treats a missing response as not-hidden (caller handles 404 separately)", () => {
  assert.equal(isResponseAlreadyHidden(null), false);
});

test("isGuestRateLimited allows requests under both thresholds", () => {
  assert.equal(isGuestRateLimited({ guestCount: 0, ipCount: 0 }), false);
  assert.equal(
    isGuestRateLimited({ guestCount: GUEST_REPORT_MAX_PER_GUEST - 1, ipCount: GUEST_REPORT_MAX_PER_IP - 1 }),
    false
  );
});

test("isGuestRateLimited blocks once the per-guest threshold is reached", () => {
  assert.equal(isGuestRateLimited({ guestCount: GUEST_REPORT_MAX_PER_GUEST, ipCount: 0 }), true);
});

test("isGuestRateLimited blocks once the per-IP threshold is reached, even for a fresh guest", () => {
  assert.equal(isGuestRateLimited({ guestCount: 0, ipCount: GUEST_REPORT_MAX_PER_IP }), true);
});
