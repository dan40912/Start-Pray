import { test } from "node:test";
import assert from "node:assert/strict";
import { authenticator } from "otplib";
import { hasAdminOtpConfig, verifyAdminOtpCode } from "../src/lib/admin-otp.js";

const secret = "JBSWY3DPEHPK3PXP";
const env = { ADMIN_TOTP_SECRET: secret };
const epoch = 1700000010000;
const codeAt = (time) => authenticator.clone({ epoch: time }).generate(secret);

test("accepts current TOTP and a code submitted across a refresh boundary", () => {
  const code = codeAt(epoch);
  assert.equal(verifyAdminOtpCode(code, env, epoch), true);
  assert.equal(verifyAdminOtpCode(code, env, epoch + 30000), true);
  assert.equal(verifyAdminOtpCode(code, env, epoch + 60000), false);
  assert.equal(verifyAdminOtpCode(codeAt(epoch + 30000), env, epoch), false);
});

test("accepts spaced and full-width digits without accepting malformed codes", () => {
  const code = codeAt(epoch);
  assert.equal(verifyAdminOtpCode(`${code.slice(0, 3)} ${code.slice(3)}`, env, epoch), true);
  const wide = code.replace(/\d/g, (digit) => String.fromCharCode(digit.charCodeAt(0) + 0xfee0));
  assert.equal(verifyAdminOtpCode(wide, env, epoch), true);
  for (const invalid of [null, 123456, "", "12345", "1234567", "abc123", "123-456"]) {
    assert.equal(verifyAdminOtpCode(invalid, env, epoch), false);
  }
});

test("missing config fails closed; TOTP takes priority over static fallback", () => {
  assert.equal(hasAdminOtpConfig({}), false);
  assert.equal(verifyAdminOtpCode("123456", {}, epoch), false);
  assert.equal(hasAdminOtpConfig({ ADMIN_LOGIN_OTP: "123456" }), true);
  assert.equal(verifyAdminOtpCode("123456", { ADMIN_LOGIN_OTP: "123456" }, epoch), true);
  assert.equal(verifyAdminOtpCode("123456", { ...env, ADMIN_LOGIN_OTP: "123456" }, epoch), false);
});
