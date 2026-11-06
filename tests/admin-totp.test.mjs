import { test } from "node:test";
import assert from "node:assert/strict";
import { authenticator } from "otplib";
import { verifyAdminOtp, verifyTotpCode } from "../src/lib/admin-totp.js";

const secret = "JBSWY3DPEHPK3PXP";
const epoch = 1700000010000;
const step = Math.floor(epoch / 30000);
const codeAt = (time) => authenticator.clone({ epoch: time }).generate(secret);

test("TOTP returns the matched step for replay protection across a refresh", () => {
  const code = codeAt(epoch);
  assert.equal(verifyTotpCode(code, secret, epoch), step);
  assert.equal(verifyTotpCode(code, secret, epoch + 30000), step);
  assert.equal(verifyTotpCode(code, secret, epoch + 60000), null);
  assert.equal(verifyTotpCode(codeAt(epoch + 30000), secret, epoch), null);
});

test("personal and shared login methods accept pasted digits and preserve the step", (t) => {
  t.mock.method(Date, "now", () => epoch + 30000);
  const wide = codeAt(epoch).replace(/\d/g, (digit) =>
    String.fromCharCode(digit.charCodeAt(0) + 0xfee0)
  );
  for (const kind of ["personal", "shared"]) {
    assert.deepEqual(verifyAdminOtp({ kind, secret }, `${wide.slice(0, 3)} ${wide.slice(3)}`), {
      ok: true,
      step,
    });
    assert.deepEqual(verifyAdminOtp({ kind, secret }, codeAt(epoch - 30000)), {
      ok: false,
      step: null,
    });
  }
});

test("malformed codes and missing secrets fail closed", () => {
  for (const code of [null, 123456, "", "12345", "1234567", "abc123", "123-456"]) {
    assert.equal(verifyTotpCode(code, secret, epoch), null);
  }
  assert.equal(verifyTotpCode(codeAt(epoch), "", epoch), null);
  assert.deepEqual(verifyAdminOtp(null, codeAt(epoch)), { ok: false, step: null });
});

test("static fallback normalizes pasted codes and still rejects mismatches", () => {
  const method = { kind: "static", code: "123456" };
  assert.deepEqual(verifyAdminOtp(method, "１２３ ４５６"), { ok: true, step: null });
  assert.deepEqual(verifyAdminOtp(method, "654321"), { ok: false, step: null });
});
