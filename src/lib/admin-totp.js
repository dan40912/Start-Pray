// Per-admin TOTP (2FA) helpers.
//
// Each AdminAccount can enroll its own authenticator secret. Accounts that
// have not enrolled yet keep using the shared ADMIN_TOTP_SECRET (or the
// temporary ADMIN_LOGIN_OTP) so this can roll out without locking anyone out.
// Once every admin has enrolled, removing ADMIN_TOTP_SECRET from the env makes
// personal 2FA mandatory.
//
// Secrets are stored AES-256-GCM encrypted. The key comes from
// ADMIN_TOTP_ENCRYPTION_KEY, or is derived from ADMIN_SESSION_SECRET when that
// is unset — rotating ADMIN_SESSION_SECRET then invalidates enrolled secrets,
// so set a dedicated key in production. See docs/security-hardening.md.
import crypto from "node:crypto";

import { authenticator } from "otplib";

import { getAdminSessionSecret } from "@/lib/session-secrets";

const TOTP_ISSUER = "Start Pray Admin";
const SETUP_TOKEN_TTL_SECONDS = 10 * 60;
const ENCRYPTED_PREFIX = "v1";

function encryptionKey() {
  const material = process.env.ADMIN_TOTP_ENCRYPTION_KEY?.trim() || getAdminSessionSecret();
  return crypto.createHash("sha256").update(`admin-totp-key:${material}`).digest();
}

export function encryptTotpSecret(secret) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(secret, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [ENCRYPTED_PREFIX, iv, tag, encrypted]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptTotpSecret(stored) {
  try {
    const [prefix, iv, tag, encrypted] = String(stored || "").split(".");
    if (prefix !== ENCRYPTED_PREFIX || !iv || !tag || !encrypted) return null;
    const decipher = crypto.createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / authenticator.allOptions().step);
}

/**
 * Verifies a TOTP code against a base32 secret.
 * @returns {number|null} the time step the code belongs to, or null if invalid.
 */
export function verifyTotpCode(code, secret, now = Date.now()) {
  const token = typeof code === "string" ? code.trim() : "";
  if (!/^\d{6}$/.test(token) || !secret) return null;
  try {
    const delta = authenticator.checkDelta(token, secret);
    return typeof delta === "number" ? currentStep(now) + delta : null;
  } catch {
    return null;
  }
}

function sharedTotpSecret() {
  return process.env.ADMIN_TOTP_SECRET?.trim() || null;
}

function staticOtp() {
  return process.env.ADMIN_LOGIN_OTP?.trim() || null;
}

/**
 * Describes how a given admin account proves its second factor:
 *   { kind: "personal", secret } — enrolled per-admin secret
 *   { kind: "shared", secret }   — legacy shared ADMIN_TOTP_SECRET
 *   { kind: "static", code }     — temporary ADMIN_LOGIN_OTP
 *   null                         — nothing configured for this account
 */
export function resolveAdminOtpMethod(account) {
  if (account?.totpEnabledAt && account?.totpSecret) {
    const secret = decryptTotpSecret(account.totpSecret);
    if (secret) return { kind: "personal", secret };
    console.warn(
      `admin-totp: cannot decrypt the personal 2FA secret of admin ${account.id}; ` +
        "falling back to the shared secret. Re-enroll this admin's 2FA."
    );
  }

  const shared = sharedTotpSecret();
  if (shared) return { kind: "shared", secret: shared };

  const fixed = staticOtp();
  if (fixed) return { kind: "static", code: fixed };

  return null;
}

/**
 * Checks a login OTP for an account.
 * @returns {{ ok: boolean, step: number|null }} step is set for TOTP methods
 *   so the caller can reject replays of an already used code.
 */
export function verifyAdminOtp(method, code) {
  if (!method) return { ok: false, step: null };
  if (method.kind === "static") {
    const token = Buffer.from(typeof code === "string" ? code.trim() : "");
    const expected = Buffer.from(method.code);
    const ok = token.length === expected.length && crypto.timingSafeEqual(token, expected);
    return { ok, step: null };
  }
  const step = verifyTotpCode(code, method.secret);
  return { ok: step !== null, step };
}

export function generateTotpSecret() {
  return authenticator.generateSecret(20);
}

export function buildOtpAuthUri(username, secret) {
  return authenticator.keyuri(username, TOTP_ISSUER, secret);
}

function signSetupPayload(payloadBase64) {
  return crypto
    .createHmac("sha256", getAdminSessionSecret())
    .update(`admin-totp-setup:${payloadBase64}`)
    .digest("base64url");
}

// The secret being enrolled is carried in a short-lived signed token held by
// the admin's browser until they confirm a code, so no "pending" column is
// needed. The token is bound to the admin id and expires after 10 minutes.
export function createTotpSetupToken(adminId, secret, now = Date.now()) {
  const payload = {
    adminId,
    secret: encryptTotpSecret(secret),
    exp: Math.floor(now / 1000) + SETUP_TOKEN_TTL_SECONDS,
  };
  const payloadBase64 = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${payloadBase64}.${signSetupPayload(payloadBase64)}`;
}

export function readTotpSetupToken(token, adminId, now = Date.now()) {
  if (typeof token !== "string" || !token.includes(".")) return null;
  const [payloadBase64, signature] = token.split(".");
  if (!payloadBase64 || !signature) return null;

  const expected = Buffer.from(signSetupPayload(payloadBase64));
  const actual = Buffer.from(signature);
  if (expected.length !== actual.length || !crypto.timingSafeEqual(expected, actual)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(payloadBase64, "base64url").toString("utf8"));
    if (payload?.adminId !== adminId) return null;
    if (typeof payload.exp !== "number" || payload.exp <= Math.floor(now / 1000)) return null;
    return decryptTotpSecret(payload.secret);
  } catch {
    return null;
  }
}
