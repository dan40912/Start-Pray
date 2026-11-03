import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkAuthLimit,
  createAttemptLimiter,
  recordAuthAttempt,
  resetAuthAttempts,
  tooManyAttemptsMessage,
} from "../src/lib/auth-rate-limit.js";

const MINUTE = 60 * 1000;

function scope() {
  return {
    account: createAttemptLimiter({ windowMs: 15 * MINUTE, max: 3 }),
    ip: createAttemptLimiter({ windowMs: 15 * MINUTE, max: 5 }),
  };
}

test("blocks after max failures and reports when to retry", () => {
  const limits = scope();
  const keys = { account: "account:a@example.com", ip: "ip:1.1.1.1" };
  const start = 1_000_000;
  for (let i = 0; i < 3; i += 1) {
    assert.equal(checkAuthLimit(limits, keys, start + i).allowed, true);
    recordAuthAttempt(limits, keys, start + i);
  }
  const blocked = checkAuthLimit(limits, keys, start + 10);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 15 * 60);
});

test("unblocks once the window has passed", () => {
  const limits = scope();
  const keys = { account: "account:b@example.com" };
  const start = 2_000_000;
  for (let i = 0; i < 3; i += 1) recordAuthAttempt(limits, keys, start);
  assert.equal(checkAuthLimit(limits, keys, start + 15 * MINUTE - 1).allowed, false);
  assert.equal(checkAuthLimit(limits, keys, start + 15 * MINUTE).allowed, true);
});

test("a successful login resets the account counter", () => {
  const limits = scope();
  const keys = { account: "account:c@example.com" };
  for (let i = 0; i < 3; i += 1) recordAuthAttempt(limits, keys);
  resetAuthAttempts(limits, keys);
  assert.equal(checkAuthLimit(limits, keys).allowed, true);
});

test("the per-IP limit blocks spraying across many accounts", () => {
  const limits = scope();
  for (let i = 0; i < 5; i += 1) {
    recordAuthAttempt(limits, { account: `account:user${i}`, ip: "ip:2.2.2.2" });
  }
  assert.equal(checkAuthLimit(limits, { account: "account:new", ip: "ip:2.2.2.2" }).allowed, false);
  assert.equal(checkAuthLimit(limits, { account: "account:new", ip: "ip:3.3.3.3" }).allowed, true);
});

test("an unresolvable IP is never used as a shared lockout key", () => {
  const limits = scope();
  for (let i = 0; i < 10; i += 1) {
    recordAuthAttempt(limits, { account: `account:user${i}`, ip: "ip:unknown" });
  }
  assert.equal(
    checkAuthLimit(limits, { account: "account:other", ip: "ip:unknown" }).allowed,
    true
  );
});

test("message rounds up to whole minutes", () => {
  assert.equal(tooManyAttemptsMessage(61), "嘗試次數過多，請 2 分鐘後再試。");
  assert.equal(tooManyAttemptsMessage(1), "嘗試次數過多，請 1 分鐘後再試。");
});
