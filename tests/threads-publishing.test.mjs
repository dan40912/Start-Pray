import test from "node:test";
import assert from "node:assert/strict";

import { buildThreadsPostText, publishThreadsText } from "../src/lib/threads-publishing.js";
import { decryptSettingSecret, encryptSettingSecret } from "../src/lib/secret-encryption.js";

const jsonResponse = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

test("Threads text publishing creates a container, publishes it, then reads its permalink", async () => {
  const calls = [];
  const responses = [
    jsonResponse({ id: "container-1" }),
    jsonResponse({ id: "post-2" }),
    jsonResponse({ permalink: "https://www.threads.net/@startpray/post/post-2" }),
  ];
  const fetchImpl = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    return responses.shift();
  };

  const result = await publishThreadsText("一起禱告", {
    fetchImpl,
    settings: {
      userId: "user-1",
      accessToken: "test-token",
      graphApiVersion: "v1.0",
    },
  });

  assert.deepEqual(result, {
    postId: "post-2",
    permalink: "https://www.threads.net/@startpray/post/post-2",
  });
  assert.equal(calls.length, 3);
  assert.match(calls[0].url, /\/v1\.0\/user-1\/threads$/);
  assert.match(calls[1].url, /\/v1\.0\/user-1\/threads_publish$/);
  assert.equal(calls[0].options.headers.Authorization, "Bearer test-token");
  assert.equal(calls[0].options.body.get("media_type"), "TEXT");
  assert.equal(calls[0].options.body.get("text"), "一起禱告");
  assert.equal(calls[1].options.body.get("creation_id"), "container-1");
});

test("Threads API errors are surfaced and missing credentials fail before any request", async () => {
  let requestCount = 0;
  await assert.rejects(
    publishThreadsText("測試貼文", { settings: {}, fetchImpl: async () => { requestCount += 1; } }),
    /Threads 設定尚未完成/
  );
  assert.equal(requestCount, 0);

  await assert.rejects(
    publishThreadsText("測試貼文", {
      settings: { userId: "user-1", accessToken: "token" },
      fetchImpl: async () => jsonResponse({ error: { message: "Permission denied" } }, 403),
    }),
    /Permission denied/
  );
});

test("default post copy follows the configured template and links to the card", () => {
  const text = buildThreadsPostText(42, "為家人健康代禱", "https://startpray.online");
  assert.match(text, /startpray\.online\/prayfor\/42/);
  assert.match(text, /請幫他\/她代禱:/);
  assert.match(text, /為家人健康代禱/);
  assert.match(text, /奉主耶穌基督的名求，阿們。/);
  assert.match(text, /如果您有需要代禱的/);
});

test("Threads credentials can be encrypted at rest without exposing plaintext", () => {
  const previous = process.env.SITE_SETTINGS_ENCRYPTION_KEY;
  process.env.SITE_SETTINGS_ENCRYPTION_KEY = "test-settings-encryption-key";
  try {
    const token = "threads-user-token-for-test";
    const encrypted = encryptSettingSecret(token);
    assert.notEqual(encrypted, token);
    assert.equal(encrypted.includes(token), false);
    assert.equal(decryptSettingSecret(encrypted), token);
    assert.equal(decryptSettingSecret(`${encrypted}broken`), null);
  } finally {
    if (previous === undefined) delete process.env.SITE_SETTINGS_ENCRYPTION_KEY;
    else process.env.SITE_SETTINGS_ENCRYPTION_KEY = previous;
  }
});
