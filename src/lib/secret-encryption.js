import crypto from "node:crypto";

import { getAdminSessionSecret } from "./session-secrets.js";

const SECRET_PREFIX = "v1";

function encryptionKey() {
  const material =
    process.env.SITE_SETTINGS_ENCRYPTION_KEY?.trim() ||
    process.env.ADMIN_TOTP_ENCRYPTION_KEY?.trim() ||
    getAdminSessionSecret();
  return crypto.createHash("sha256").update(`site-settings-key:${material}`).digest();
}

export function encryptSettingSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [SECRET_PREFIX, iv, tag, encrypted]
    .map((part) => (typeof part === "string" ? part : part.toString("base64url")))
    .join(".");
}

export function decryptSettingSecret(stored) {
  try {
    const [prefix, iv, tag, encrypted] = String(stored || "").split(".");
    if (prefix !== SECRET_PREFIX || !iv || !tag || !encrypted) return null;
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
