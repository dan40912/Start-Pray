import { test } from "node:test";
import assert from "node:assert/strict";

import { isTrustedOrigin } from "../src/lib/origin-guard.js";

function fakeRequest(headers) {
  return { headers: new Headers(headers) };
}

test("isTrustedOrigin rejects a request with no Origin header", () => {
  assert.equal(isTrustedOrigin(fakeRequest({ host: "example.com" })), false);
});

test("isTrustedOrigin allows a same-origin request (Origin host matches Host header)", () => {
  assert.equal(
    isTrustedOrigin(fakeRequest({ origin: "http://localhost:3000", host: "localhost:3000" })),
    true
  );
});

test("isTrustedOrigin rejects a cross-origin request (Origin host differs from Host header)", () => {
  assert.equal(
    isTrustedOrigin(fakeRequest({ origin: "https://evil.example", host: "localhost:3000" })),
    false
  );
});

test("isTrustedOrigin rejects a malformed Origin header", () => {
  assert.equal(isTrustedOrigin(fakeRequest({ origin: "not-a-url", host: "localhost:3000" })), false);
});

test("isTrustedOrigin honors ALLOWED_ORIGINS when set, ignoring the Host header", async () => {
  const original = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://start-pray.example, https://staging.start-pray.example";
  try {
    assert.equal(
      isTrustedOrigin(fakeRequest({ origin: "https://start-pray.example", host: "internal-host:8080" })),
      true
    );
    assert.equal(
      isTrustedOrigin(fakeRequest({ origin: "https://not-allowed.example", host: "internal-host:8080" })),
      false
    );
  } finally {
    if (original === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = original;
  }
});
