// Creates and removes a synthetic MySQL database. Never migrates the configured
// development database. Requires local MySQL with CREATE/DROP DATABASE rights.
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { spawn, spawnSync } = require("node:child_process");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
require("@next/env").loadEnvConfig(process.cwd());

const sourceUrl = new URL(process.env.DATABASE_URL);
assert.ok(
  ["localhost", "127.0.0.1", "[::1]"].includes(sourceUrl.hostname),
  "QA only runs against local MySQL"
);
const suffix = crypto.randomBytes(5).toString("hex");
const databaseName = `startpray_admin_qa_${suffix}`;
const databaseUrl = new URL(sourceUrl);
databaseUrl.pathname = `/${databaseName}`;
const port = Number(process.env.ADMIN_QA_PORT || 3191);
const origin = `http://127.0.0.1:${port}`;
const rootDb = new PrismaClient();
const db = new PrismaClient({ datasourceUrl: databaseUrl.toString() });
const otp = "246810";
const password = `qa-${suffix}-password`;
const adminSecret = crypto.randomBytes(32).toString("hex");
const customerSecret = crypto.randomBytes(32).toString("hex");
let server, tempDir, legacyPath;
let checks = 0;
const ok = (label) => {
  checks++;
  console.log(`PASS ${label}`);
};

function customerCookie(user) {
  const payload = Buffer.from(
    JSON.stringify({
      userId: user.id,
      email: user.email,
      sessionVersion: user.sessionVersion,
      exp: Math.floor(Date.now() / 1000) + 3600,
    })
  ).toString("base64url");
  const sig = crypto.createHmac("sha256", customerSecret).update(payload).digest("base64url");
  return `pc-auth-session=${payload}.${sig}`;
}
async function request(route, { cookie = "", method = "GET", body, headers = {} } = {}) {
  return fetch(`${origin}${route}`, {
    method,
    redirect: "manual",
    headers: {
      Cookie: cookie,
      Origin: origin,
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}
async function json(response, status) {
  const text = await response.text();
  assert.equal(response.status, status, text.slice(0, 350));
  return JSON.parse(text);
}
async function login() {
  const response = await request("/api/admin/auth/login", {
    method: "POST",
    body: { username: "qa-super", password, otp },
  });
  await json(response, 200);
  return response.headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
}

function executeSql(sql) {
  const result = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "db",
      "execute",
      "--stdin",
      "--schema",
      "prisma/schema.prisma",
    ],
    {
      env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
      input: sql,
      encoding: "utf8",
    }
  );
  assert.equal(result.status, 0, result.stdout + result.stderr);
}

async function main() {
  await rootDb.$executeRawUnsafe(
    `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
  );
  console.log(`Isolated database: ${databaseName}`);
  tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "startpray-admin-qa-"));
  // Historical migrations recreate existing tables. Pin the schema before
  // this migration so the test still exercises its SQL after it is committed.
  const baselineCommit = "d613b41fbbb7e70c916ccfe2272fc77e67e66538";
  const baseline = spawnSync("git", ["show", `${baselineCommit}:prisma/schema.prisma`], {
    encoding: "utf8",
  });
  assert.equal(baseline.status, 0, baseline.stderr);
  const baselinePath = path.join(tempDir, "baseline.prisma");
  await fs.writeFile(baselinePath, baseline.stdout);
  const schemaSql = spawnSync(
    process.execPath,
    [
      "node_modules/prisma/build/index.js",
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      baselinePath,
      "--script",
    ],
    { encoding: "utf8" }
  );
  assert.equal(schemaSql.status, 0, schemaSql.stderr);
  const newMigration = await fs.readFile(
    "prisma/migrations/20261104000100_admin_access_and_media_ownership/migration.sql",
    "utf8"
  );
  for (const sql of [schemaSql.stdout, newMigration]) {
    const result = spawnSync(
      process.execPath,
      [
        "node_modules/prisma/build/index.js",
        "db",
        "execute",
        "--stdin",
        "--schema",
        "prisma/schema.prisma",
      ],
      {
        env: { ...process.env, DATABASE_URL: databaseUrl.toString() },
        input: sql,
        encoding: "utf8",
      }
    );
    assert.equal(result.status, 0, result.stdout + result.stderr);
  }
  ok(
    "new migration applies to an isolated HEAD schema baseline (historical replay is separately blocked)"
  );
  const uploads = path.join(tempDir, "uploads");
  const voices = path.join(tempDir, "voices");
  await fs.mkdir(uploads);
  await fs.mkdir(voices);
  const imageName = `qa-${suffix}.webp`;
  const imageUrl = `/uploads/${imageName}`;
  const image = await require("sharp")({
    create: { width: 8, height: 8, channels: 3, background: "#446688" },
  })
    .webp()
    .toBuffer();
  await fs.writeFile(path.join(uploads, imageName), image);
  // Also test an existing public file, which must go through middleware.
  await fs.mkdir(path.join(process.cwd(), "public/uploads"), { recursive: true });
  legacyPath = path.join(process.cwd(), "public/uploads", `qa-legacy-${suffix}.webp`);
  await fs.writeFile(legacyPath, image);
  const owner = await db.user.create({
    data: { email: `owner-${suffix}@example.invalid`, name: "QA owner" },
  });
  const stranger = await db.user.create({
    data: { email: `other-${suffix}@example.invalid`, name: "QA stranger" },
  });
  const admin = await db.adminAccount.create({
    data: { username: "qa-super", role: "SUPER", passwordHash: await bcrypt.hash(password, 10) },
  });
  const category = await db.homePrayerCategory.create({
    data: { name: "健康", slug: `qa-${suffix}` },
  });
  const secretTitle = `PRIVATE-MARKER-${suffix}`;
  const card = await db.homePrayerCard.create({
    data: {
      slug: `qa-${suffix}`,
      image: imageUrl,
      title: secretTitle,
      description: secretTitle,
      reportCount: 1,
      tags: [],
      meta: [],
      detailsHref: "",
      categoryId: category.id,
      ownerId: owner.id,
      isPrivate: true,
    },
  });
  await db.mediaUpload.create({
    data: { url: `/uploads/qa-legacy-${suffix}.webp`, ownerId: owner.id },
  });
  const response = await db.prayerResponse.create({
    data: {
      message: secretTitle,
      voiceUrl: `/voices/qa-${suffix}.webm`,
      reportCount: 1,
      responderId: stranger.id,
      homeCardId: card.id,
      voiceModerationStatus: "PENDING",
    },
  });
  await fs.writeFile(path.join(voices, `qa-${suffix}.webm`), Buffer.from("synthetic-voice-data"));
  await db.homePrayerCardReport.create({
    data: { cardId: card.id, reporterId: stranger.id, reason: "other", remarks: secretTitle },
  });
  await db.prayerResponseReport.create({
    data: { responseId: response.id, reporterId: owner.id, reason: "other", remarks: secretTitle },
  });

  const env = {
    ...process.env,
    DATABASE_URL: databaseUrl.toString(),
    NEXT_BUILD_DIR: ".next-admin-qa",
    ADMIN_LOGIN_OTP: otp,
    ADMIN_TOTP_SECRET: "",
    ADMIN_SESSION_SECRET: adminSecret,
    CUSTOMER_SESSION_SECRET: customerSecret,
    UPLOADS_STORAGE_DIR: uploads,
    VOICES_STORAGE_DIR: voices,
    MEDIA_STORAGE_DRIVER: "local",
    ADMIN_PUBLIC_ORIGIN: origin,
    ALLOWED_ORIGINS: origin,
  };
  const serverLog = await fs.open(path.join(tempDir, "server.log"), "w");
  server = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "dev", "-H", "127.0.0.1", "-p", String(port)],
    {
      env,
      windowsHide: true,
      stdio: ["ignore", serverLog.fd, serverLog.fd],
    }
  );
  await serverLog.close();
  let ready = false;
  for (let i = 0; i < 90; i++) {
    if (server.exitCode !== null) throw new Error(`QA server exited; see ${tempDir}/server.log`);
    try {
      const r = await request("/api/admin/session");
      if (r.status === 401) {
        ready = true;
        break;
      }
    } catch {
      /* starting */
    }
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
  assert.ok(ready, `QA server did not become ready; see ${tempDir}/server.log`);
  let cookie = await login();
  const ownerCookie = customerCookie(owner),
    strangerCookie = customerCookie(stranger);
  await json(await request("/api/admin/users"), 401);
  ok("management API rejects anonymous requests");
  const summary = await json(await request("/api/admin/dashboard-summary", { cookie }), 200);
  assert.equal(summary.work.pendingVoices, 1);
  assert.equal(summary.work.reportedCards, 1);
  assert.equal(JSON.stringify(summary).includes(secretTitle), false);
  ok("dashboard work counts are complete aggregates without private content");
  for (const method of ["GET", "HEAD"]) {
    assert.equal((await request(imageUrl, { method })).status, 404);
  }
  assert.equal((await request(imageUrl, { headers: { Range: "bytes=0-3" } })).status, 404);
  assert.equal((await request(imageUrl, { cookie: strangerCookie })).status, 404);
  const ownerImage = await request(imageUrl, { cookie: ownerCookie });
  assert.equal(ownerImage.status, 200);
  assert.match(ownerImage.headers.get("cache-control"), /no-store/);
  assert.equal(
    (await request(imageUrl, { cookie: ownerCookie, headers: { Range: "bytes=0-3" } })).status,
    200
  ); // images don't implement ranges
  ok("private image GET/HEAD/Range deny outsiders and allow its owner without caching");
  const voiceUrl = `/voices/qa-${suffix}.webm`;
  assert.equal((await request(voiceUrl, { headers: { Range: "bytes=0-3" } })).status, 404);
  const ownerVoice = await request(voiceUrl, { cookie: ownerCookie, headers: { Range: "bytes=0-3" } });
  assert.equal(ownerVoice.status, 206);
  assert.match(ownerVoice.headers.get("content-range"), /^bytes 0-3\//);
  assert.equal((await ownerVoice.arrayBuffer()).byteLength, 4);
  const voiceHead = await request(voiceUrl, { cookie: ownerCookie, method: "HEAD" });
  assert.equal(voiceHead.status, 200);
  assert.equal((await voiceHead.arrayBuffer()).byteLength, 0);
  ok("private voice GET/HEAD and byte ranges preserve playback for authorized owners");
  assert.equal((await request(`/uploads/qa-legacy-${suffix}.webp`)).status, 404);
  assert.equal(
    (await request(`/uploads/qa-legacy-${suffix}.webp`, { cookie: ownerCookie })).status,
    200
  );
  ok("legacy public-directory media and registered draft previews use authorization");
  assert.equal(
    (await request(`/_next/image?url=${encodeURIComponent(imageUrl)}&w=640&q=75`)).status,
    400
  );
  ok("image optimizer cannot publish a cached protected upload");
  assert.equal((await request(imageUrl, { cookie })).status, 200);
  assert.equal(
    await db.adminLog.count({ where: { action: "media.review.read", actorId: admin.id } }),
    1
  );
  ok("administrator media reads are attributed and audited");

  for (const route of [
    "/api/admin/prayfor",
    "/api/admin/prayerresponse",
    "/api/admin/reports",
    "/api/admin/voice-moderation",
  ]) {
    const data = await json(await request(route, { cookie }), 200);
    assert.equal(JSON.stringify(data).includes(secretTitle), false, route);
    assert.equal(JSON.stringify(data).includes(stranger.email), false, route);
  }
  const detail = await json(await request(`/api/admin/prayfor/${card.id}`, { cookie }), 200);
  assert.equal(detail.title, secretTitle);
  assert.equal(
    await db.adminLog.count({ where: { action: "prayfor.detail.read", actorId: admin.id } }),
    1
  );
  ok("private lists redact content while detail reads require audit");

  await db.homePrayerCard.update({ where: { id: card.id }, data: { isPrivate: false } });
  assert.equal((await request(imageUrl)).status, 200);
  await db.homePrayerCard.update({ where: { id: card.id }, data: { isBlocked: true } });
  assert.equal((await request(imageUrl)).status, 404);
  await db.homePrayerCard.update({
    where: { id: card.id },
    data: { isBlocked: false, image: "/img/logo.png", meta: [`gallery::${imageUrl}`] },
  });
  assert.equal((await request(imageUrl)).status, 200);
  await db.homePrayerCard.update({ where: { id: card.id }, data: { isPrivate: true } });
  assert.equal((await request(imageUrl)).status, 404);
  ok("visibility changes and gallery JSON references affect existing media URLs immediately");

  const blockRoute = `/api/admin/users/${owner.id}/block`;
  await json(await request(blockRoute, { cookie, method: "PATCH", body: { block: true } }), 400);
  const action = {
    block: true,
    expectedBlocked: false,
    operationId: crypto.randomUUID(),
    reason: "QA verified repeated abuse",
  };
  await json(
    await request(blockRoute, {
      cookie,
      method: "PATCH",
      body: action,
      headers: { Origin: "https://cross-site.invalid" },
    }),
    403
  );
  const duplicateRequests = await Promise.all([
    request(blockRoute, { cookie, method: "PATCH", body: action }),
    request(blockRoute, { cookie, method: "PATCH", body: action }),
  ]);
  const duplicateResults = await Promise.all(duplicateRequests.map((response) => json(response, 200)));
  assert.deepEqual(duplicateResults.map((result) => result.replayed).sort(), [false, true]);
  const current = await db.user.findUnique({ where: { id: owner.id } });
  assert.equal(current.isBlocked, true);
  assert.equal(current.sessionVersion, 1);
  await json(await request(blockRoute, { cookie, method: "PATCH", body: action }), 200);
  assert.equal((await db.user.findUnique({ where: { id: owner.id } })).sessionVersion, 1);
  await json(
    await request(blockRoute, {
      cookie,
      method: "PATCH",
      body: { ...action, reason: "different reason" },
    }),
    409
  );
  assert.equal(
    await db.adminLog.count({ where: { operationKey: `${admin.id}:${action.operationId}` } }),
    1
  );
  ok("blocking requires explicit input, prevents CSRF and deduplicates retries");
  const restore = {
    block: false,
    expectedBlocked: true,
    operationId: crypto.randomUUID(),
    reason: "QA appeal reviewed and accepted",
  };
  await json(await request(blockRoute, { cookie, method: "PATCH", body: restore }), 200);
  assert.equal((await db.user.findUnique({ where: { id: owner.id } })).sessionVersion, 2);
  assert.equal((await request(imageUrl, { cookie: ownerCookie })).status, 404);
  const replayed = await json(
    await request(blockRoute, { cookie, method: "PATCH", body: action }),
    200
  );
  assert.equal(replayed.isBlocked, false);
  ok("restoration never revives old customer cookies or stale replay state");
  const races = await Promise.all(
    [1, 2].map(() =>
      request(blockRoute, {
        cookie,
        method: "PATCH",
        body: { ...action, operationId: crypto.randomUUID() },
      })
    )
  );
  assert.deepEqual(races.map((r) => r.status).sort(), [200, 409]);
  ok("concurrent opposing versions cannot overwrite each other");

  const voiceRoute = "/api/admin/voice-moderation";
  const voiceAction = { id: response.id, action: "APPROVE", expectedStatus: "PENDING" };
  await json(await request(voiceRoute, { cookie, method: "PATCH", body: voiceAction }), 200);
  assert.equal(
    (await db.prayerResponse.findUnique({ where: { id: response.id } })).voiceModeratedBy,
    admin.id
  );
  await json(await request(voiceRoute, { cookie, method: "PATCH", body: voiceAction }), 409);
  ok("voice moderation records the actual administrator and rejects stale decisions");

  executeSql(
    "CREATE TRIGGER qa_audit_failure BEFORE INSERT ON admin_log FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'QA audit unavailable'"
  );
  await json(
    await request(blockRoute, {
      cookie,
      method: "PATCH",
      body: { ...restore, operationId: crypto.randomUUID() },
    }),
    500
  );
  assert.equal((await db.user.findUnique({ where: { id: owner.id } })).isBlocked, true);
  await json(
    await request(voiceRoute, {
      cookie,
      method: "PATCH",
      body: { ...voiceAction, expectedStatus: "APPROVED", action: "REJECT" },
    }),
    500
  );
  assert.equal(
    (await db.prayerResponse.findUnique({ where: { id: response.id } })).voiceModerationStatus,
    "APPROVED"
  );
  assert.equal((await request(imageUrl, { cookie })).status, 503);
  executeSql("DROP TRIGGER qa_audit_failure");
  ok("audit failure rolls back restrictions and review decisions and denies private media");

  await json(
    await request(`/api/admin/accounts/${admin.id}`, {
      cookie,
      method: "PATCH",
      body: { role: "ADMIN" },
    }),
    400
  );
  ok("last active SUPER cannot be demoted");
  await db.adminAccount.update({ where: { id: admin.id }, data: { role: "ADMIN" } });
  await json(await request("/api/admin/accounts", { cookie }), 403);
  await db.adminAccount.update({ where: { id: admin.id }, data: { isActive: false } });
  await json(await request("/api/admin/users", { cookie }), 401);
  await db.adminAccount.update({
    where: { id: admin.id },
    data: { isActive: true, role: "SUPER", sessionVersion: { increment: 1 } },
  });
  await json(await request("/api/admin/users", { cookie }), 401);
  assert.equal((await request("/admin", { cookie })).status, 200);
  ok(
    "current roles, disabled accounts and revoked cookies override signed token claims without redirect loops"
  );
  cookie = await login();
  await json(
    await request(`/api/admin/accounts/${admin.id}`, {
      cookie,
      method: "PATCH",
      body: { password: `${password}-new` },
    }),
    200
  );
  await json(await request("/api/admin/users", { cookie }), 401);
  await db.adminAccount.update({
    where: { id: admin.id },
    data: { passwordHash: await bcrypt.hash(password, 10) },
  });
  executeSql("RENAME TABLE adminaccount TO qa_admin_unavailable");
  try {
    await json(await request("/api/admin/accounts", { cookie }), 503);
  } finally { executeSql("RENAME TABLE qa_admin_unavailable TO adminaccount"); }
  ok("database authorization outages fail closed instead of trusting token roles");
  cookie = await login();
  await json(await request("/api/admin/session", { cookie, method: "DELETE" }), 200);
  await json(await request("/api/admin/users", { cookie }), 401);
  ok("password reset and explicit sign-out revoke copied admin cookies");
  console.log(`Admin safety QA: ${checks} checks passed.`);
  if (process.env.ADMIN_QA_PREVIEW === "1") {
    const preview = {
      origin,
      username: "qa-super",
      password,
      otp,
      donePath: path.join(tempDir, "preview.done"),
    };
    await fs.writeFile(path.join(tempDir, "preview.json"), JSON.stringify(preview));
    console.log(`UI preview ready: ${tempDir}/preview.json`);
    for (let i = 0; i < 900; i++) {
      try {
        await fs.access(preview.donePath);
        break;
      } catch {
        /* waiting for UI verification */
      }
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (server) {
      server.kill();
      await new Promise((resolve) =>
        server.exitCode !== null ? resolve() : server.once("exit", resolve)
      );
    }
    await db.$disconnect();
    // The generated, checked identifier is the only database this runner removes.
    if (/^startpray_admin_qa_[a-f0-9]{10}$/.test(databaseName)) {
      await rootDb
        .$executeRawUnsafe(`DROP DATABASE IF EXISTS \`${databaseName}\``)
        .catch(console.error);
    }
    await rootDb.$disconnect();
    if (legacyPath) await fs.unlink(legacyPath).catch(() => {});
    if (tempDir) console.log(`Synthetic QA artifacts: ${tempDir}`);
  });
