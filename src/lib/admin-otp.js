import { authenticator } from "otplib";
import { normalizeAdminOtpCode } from "./admin-otp-input.js";

export function hasAdminOtpConfig(env = process.env) {
  return Boolean(env.ADMIN_TOTP_SECRET?.trim() || env.ADMIN_LOGIN_OTP?.trim());
}

export function verifyAdminOtpCode(code, env = process.env, epoch = Date.now()) {
  const otp = normalizeAdminOtpCode(code);
  if (!otp) return false;

  const secret = env.ADMIN_TOTP_SECRET?.trim();
  if (secret) {
    if (!/^\d{6}$/.test(otp)) return false;
    // Allow the previous step for codes submitted just as the app refreshes.
    // Clone so request-specific time/options never mutate the shared instance.
    const verifier = authenticator.clone({ epoch, window: [1, 0] });
    return verifier.check(otp, secret);
  }

  const fallback = env.ADMIN_LOGIN_OTP?.trim();
  return Boolean(fallback) && otp === fallback;
}
