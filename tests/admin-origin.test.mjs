import test from "node:test";
import assert from "node:assert/strict";
import { isSameOriginAdminMutation } from "../src/lib/admin-origin.js";

const request = (headers, method = "PATCH") => ({
  method,
  url: "http://localhost:3191/api/admin/users",
  headers: new Headers(headers),
});

test("admin origin uses the browser Host even when Next normalizes loopback URLs", () => {
  assert.equal(
    isSameOriginAdminMutation(request({ host: "127.0.0.1:3191", origin: "http://127.0.0.1:3191" })),
    true
  );
  for (const origin of ["https://evil.invalid", "null", "https://127.0.0.1:3191"]) {
    assert.equal(isSameOriginAdminMutation(request({ host: "127.0.0.1:3191", origin })), false);
  }
});

test("missing or cross-site referer cannot authorize an admin mutation", () => {
  assert.equal(isSameOriginAdminMutation(request({ host: "localhost:3191" })), false);
  assert.equal(
    isSameOriginAdminMutation(
      request({ host: "localhost:3191", referer: "http://localhost:3191/admin" })
    ),
    true
  );
  assert.equal(
    isSameOriginAdminMutation(
      request({ host: "localhost:3191", referer: "https://evil.invalid/admin" })
    ),
    false
  );
  assert.equal(isSameOriginAdminMutation(request({}, "GET")), true);
});

test("canonical deployment origin is explicit, not taken from forwarded headers", () => {
  const before = process.env.ADMIN_PUBLIC_ORIGIN;
  process.env.ADMIN_PUBLIC_ORIGIN = "https://admin.example.invalid";
  try {
    assert.equal(
      isSameOriginAdminMutation(
        request({ host: "internal:3191", origin: "https://admin.example.invalid" })
      ),
      true
    );
    assert.equal(
      isSameOriginAdminMutation(
        request({
          host: "evil.invalid",
          origin: "https://evil.invalid",
          "x-forwarded-host": "admin.example.invalid",
        })
      ),
      false
    );
  } finally {
    if (before === undefined) delete process.env.ADMIN_PUBLIC_ORIGIN;
    else process.env.ADMIN_PUBLIC_ORIGIN = before;
  }
});
