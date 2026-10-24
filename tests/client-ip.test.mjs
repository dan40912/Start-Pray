import { test, afterEach } from "node:test";
import assert from "node:assert/strict";

import { readClientIp } from "../src/lib/client-ip.js";

function request(headers) {
  return { headers: new Headers(headers) };
}

afterEach(() => {
  delete process.env.TRUSTED_PROXY_HOPS;
});

test("without TRUSTED_PROXY_HOPS keeps the legacy leftmost entry", () => {
  assert.equal(readClientIp(request({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
  assert.equal(readClientIp(request({ "x-real-ip": "3.3.3.3" })), "3.3.3.3");
  assert.equal(readClientIp(request({})), "unknown");
});

test("with one trusted hop a forged leftmost entry is ignored", () => {
  process.env.TRUSTED_PROXY_HOPS = "1";
  assert.equal(readClientIp(request({ "x-forwarded-for": "6.6.6.6, 9.9.9.9" })), "9.9.9.9");
  assert.equal(readClientIp(request({ "x-forwarded-for": "9.9.9.9" })), "9.9.9.9");
});

test("with two trusted hops (Cloudflare + Nginx) picks the client entry", () => {
  process.env.TRUSTED_PROXY_HOPS = "2";
  assert.equal(
    readClientIp(request({ "x-forwarded-for": "6.6.6.6, 9.9.9.9, 172.68.0.1" })),
    "9.9.9.9"
  );
});

test("with trusted hops and no forwarded header falls back to x-real-ip", () => {
  process.env.TRUSTED_PROXY_HOPS = "1";
  assert.equal(readClientIp(request({ "x-real-ip": "3.3.3.3" })), "3.3.3.3");
  assert.equal(readClientIp(request({ "cf-connecting-ip": "6.6.6.6" })), "unknown");
});

test("an invalid TRUSTED_PROXY_HOPS value falls back to legacy behaviour", () => {
  process.env.TRUSTED_PROXY_HOPS = "abc";
  assert.equal(readClientIp(request({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" })), "1.1.1.1");
});
