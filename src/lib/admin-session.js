import crypto from "node:crypto";
import { getAdminSessionSecret } from "@/lib/session-secrets";

export const ADMIN_SESSION_COOKIE = "start-pray-admin-session";

const SESSION_TTL_SECONDS = 8 * 60 * 60;

function encodePayload(payload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function decodePayload(payloadBase64) {
  try {
    const raw = Buffer.from(payloadBase64, "base64url").toString("utf8");
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
}

function signPayload(payloadBase64) {
  return crypto
    .createHmac("sha256", getAdminSessionSecret())
    .update(payloadBase64)
    .digest("base64url");
}

export function createAdminSessionToken(account) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    v: 2,
    sessionVersion: Number(account.sessionVersion ?? 0),
    adminId: account.id,
    username: account.username,
    role: account.role,
    exp: now + SESSION_TTL_SECONDS,
  };
  const payloadBase64 = encodePayload(payload);
  const signature = signPayload(payloadBase64);
  return `${payloadBase64}.${signature}`;
}

export function verifyAdminSessionToken(token) {
  if (typeof token !== "string" || !token.includes(".")) {
    return null;
  }

  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = signPayload(payloadBase64);
  const left = Buffer.from(signature);
  const right = Buffer.from(expected);
  if (left.length !== right.length || !crypto.timingSafeEqual(left, right)) {
    return null;
  }

  const payload = decodePayload(payloadBase64);
  if (!payload || typeof payload !== "object") return null;

  const now = Math.floor(Date.now() / 1000);
  if (typeof payload.exp !== "number" || payload.exp <= now) {
    return null;
  }

  if (!payload.adminId || !payload.username || !["SUPER", "ADMIN"].includes(payload.role)) {
    return null;
  }

  if (payload.sessionVersion !== undefined && (!Number.isInteger(payload.sessionVersion) || payload.sessionVersion < 0)) return null;

  return payload;
}

export function readAdminSessionFromRequest(request) {
  const token = request.cookies.get(ADMIN_SESSION_COOKIE)?.value;
  return verifyAdminSessionToken(token);
}

export function setAdminSessionCookie(response, token) {
  response.cookies.set(ADMIN_SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export function clearAdminSessionCookie(response) {
  response.cookies.set(ADMIN_SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}
