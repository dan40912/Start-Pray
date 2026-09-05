import { hashActorId } from "./guest-response.js";

// Pure/deterministic helpers for POST/GET /api/home-cards/[id]/prayed — kept
// separate from the route so they're unit-testable without a DB. See
// docs/obsidian/28-Prayed-Reaction-Design.md for the design rationale.
export const PRAYED_GUEST_WINDOW_MINUTES = 10;
export const PRAYED_GUEST_MAX_DISTINCT_PRAYERS = 20;
export const PRAYED_IP_MAX_REQUESTS = 50;

// Distinct HMAC namespace from hashGuestId's "guest:" prefix, even though
// today both ultimately hash a guest id — keeps future guest-identity uses
// from accidentally colliding if their inputs ever overlap.
export function actorKeyHashForUser(userId) {
  return hashActorId("prayed-user", userId);
}

export function actorKeyHashForGuest(guestId) {
  return hashActorId("guest", guestId);
}

export function resolveActor({ session, guestId }) {
  if (session?.userId) {
    return { actorType: "USER", actorKeyHash: actorKeyHashForUser(session.userId), userId: session.userId };
  }
  if (guestId) {
    return { actorType: "GUEST", actorKeyHash: actorKeyHashForGuest(guestId), userId: null };
  }
  return null;
}

export function isPrayerUnavailable(prayer) {
  if (!prayer) return true;
  return Boolean(prayer.isBlocked) || Boolean(prayer.isPrivate);
}

export function isGuestRateLimited({ distinctPrayerCount, ipCount }) {
  return distinctPrayerCount >= PRAYED_GUEST_MAX_DISTINCT_PRAYERS || ipCount >= PRAYED_IP_MAX_REQUESTS;
}
