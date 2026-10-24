import crypto from "node:crypto";

import { readClientIp } from "./client-ip.js";

export const GUEST_RESPONSE_COOKIE = "start_pray_guest";

function secret() {
  return process.env.GUEST_FINGERPRINT_SECRET || process.env.CUSTOMER_SESSION_SECRET || "start-pray-dev-guest-secret";
}

function hmac(value) {
  return crypto.createHmac("sha256", secret()).update(String(value)).digest("hex");
}

export function createGuestId() {
  return crypto.randomBytes(24).toString("base64url");
}

// Generalized form of hashGuestId — lets other anonymous-identity features
// (e.g. prayed reactions, see src/lib/prayed-reaction.js) mint their own
// namespaced actor hashes off the same HMAC secret without colliding with
// guest-response hashes that happen to share an input value.
export function hashActorId(kind, value) {
  return value ? hmac(`${kind}:${value}`) : null;
}

export function hashGuestId(value) {
  return hashActorId("guest", value);
}

export { readClientIp };

export function hashDailyIp(request, now = new Date()) {
  const day = now.toISOString().slice(0, 10);
  return hmac(`ip:${day}:${readClientIp(request)}`);
}

export function guestCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  };
}
