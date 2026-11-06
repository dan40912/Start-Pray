const assert = require("node:assert/strict");
const { randomUUID, randomBytes, createHmac } = require("node:crypto");
const { readFileSync } = require("node:fs");
const { spawn, execFileSync } = require("node:child_process");
const { once } = require("node:events");
const { setTimeout: delay } = require("node:timers/promises");
const { PrismaClient } = require("@prisma/client");
require("@next/env").loadEnvConfig(process.cwd());

const url = new URL(process.env.DATABASE_URL);
assert.ok(["localhost", "127.0.0.1", "[::1]"].includes(url.hostname), "QA requires local MySQL");
const root = new PrismaClient();
const name = "startpray_analytics_qa_" + randomBytes(5).toString("hex");
url.pathname = "/" + name;
const db = new PrismaClient({ datasourceUrl: url.toString() });
const port = process.env.ANALYTICS_QA_PORT || "3195";
const origin = "http://127.0.0.1:" + port;
const adminSecret = randomBytes(32).toString("hex");
const env = {
  ...process.env,
  DATABASE_URL: url.toString(),
  ANALYTICS_ENABLED: "true",
  ADMIN_SESSION_SECRET: adminSecret,
  CUSTOMER_SESSION_SECRET: randomBytes(32).toString("hex"),
};
let server;
let created = false;
let output = "";

function cookie(browser, visit = randomUUID()) {
  return `sp_analytics_browser=${browser}; sp_analytics_visit=${visit}`;
}

function request(path, { session = "", body, headers = {} } = {}) {
  const isJson = body && !(body instanceof FormData);
  return fetch(origin + path, {
    redirect: "manual",
    method: body ? "POST" : "GET",
    headers: { Cookie: session, Origin: origin, ...(isJson ? { "Content-Type": "application/json" } : {}), ...headers },
    body: isJson ? JSON.stringify(body) : body,
  });
}

async function expect(response, status) {
  assert.equal(response.status, status, response.status === status ? "" : await response.text());
  return response;
}

async function view(session, page, source, headers = {}) {
  return request("/api/analytics", { session, body: { page, source }, headers: { "Sec-Fetch-Site": "same-origin", ...headers } });
}

async function main() {
  await root.$executeRawUnsafe("CREATE DATABASE `" + name + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  created = true;
  execFileSync(process.execPath, ["node_modules/prisma/build/index.js", "db", "push", "--skip-generate"], { env });
  await db.$executeRawUnsafe("DROP TABLE analytics_visit");
  await db.$executeRawUnsafe(readFileSync("prisma/migrations/20261106000300_add_analytics_visits/migration.sql", "utf8"));

  const admin = await db.adminAccount.create({ data: { username: "qa-analytics", passwordHash: "unused" } });
  const payload = Buffer.from(JSON.stringify({
    adminId: admin.id, username: admin.username, role: admin.role, sessionVersion: admin.sessionVersion,
    exp: Math.floor(Date.now() / 1000) + 3600,
  })).toString("base64url");
  const signature = createHmac("sha256", adminSecret).update(payload).digest("base64url");
  const adminCookie = `start-pray-admin-session=${payload}.${signature}`;

  const category = await db.homePrayerCategory.create({ data: { name: "QA", slug: "qa" } });
  const day = 86400000;
  const createdAt = new Date(Date.now() - 2 * day);
  const cardData = { categoryId: category.id, image: "", title: "QA", description: "QA", tags: [], meta: {}, detailsHref: "", createdAt };
  const card = await db.homePrayerCard.create({ data: { ...cardData, slug: "public" } });
  await db.homePrayerCard.create({ data: { ...cardData, slug: "private", isPrivate: true } });
  await db.prayerResponse.create({ data: { homeCardId: card.id, message: "QA", createdAt: new Date(createdAt.getTime() + 1000) } });

  server = spawn(process.execPath, ["node_modules/next/dist/bin/next", "start", "-H", "127.0.0.1", "-p", port], { env });
  server.stdout.on("data", (chunk) => { output += chunk; });
  server.stderr.on("data", (chunk) => { output += chunk; });
  for (let attempt = 0; attempt < 80; attempt++) {
    if (server.exitCode !== null) throw new Error(output);
    const ready = await request("/api/admin/analytics").catch(() => null);
    if (ready) break;
    await delay(250);
  }

  await expect(await request("/api/admin/analytics"), 401);
  await expect(await request("/api/admin/analytics?days=90", { session: adminCookie }), 400);
  const browser = randomUUID();
  const visit = randomUUID();
  const visitor = cookie(browser, visit);
  await expect(await view(visitor, "home", "threads", { "Sec-Fetch-Site": "cross-site" }), 403);
  await expect(await view(visitor, "home", "threads", { "Sec-GPC": "1" }), 204);
  await expect(await view(visitor, "/me/edit/123", "threads"), 400);
  assert.equal(await db.analyticsVisit.count(), 0);

  await expect(await view(visitor, "home", "threads"), 204);
  await expect(await view(visitor, "prayer", "direct"), 204);
  await expect(await view(visitor, "signup", "direct"), 204);

  const responseForm = new FormData();
  responseForm.set("requestId", String(card.id));
  responseForm.set("message", "This is a synthetic QA prayer response.");
  await expect(await request("/api/responses", { session: visitor, body: responseForm }), 201);
  await expect(await request(`/api/home-cards/${card.id}/prayed`, { session: visitor, body: {} }), 200);
  const signup = await expect(await request("/api/auth/signup", {
    session: visitor,
    body: { fullName: "QA", email: "qa@example.test", username: "qatester", password: "qa-test-password",
      confirmPassword: "qa-test-password", acceptedTerms: true },
  }), 201);
  const member = signup.headers.getSetCookie()[0].split(";")[0];
  const previousDate = new Date(Date.now() - day);
  await db.analyticsVisit.update({ where: { id: visit }, data: { createdAt: previousDate } });

  const secondVisit = randomUUID();
  await expect(await view(cookie(browser, secondVisit) + "; " + member, "prayer", "direct"), 204);
  // Confirm signed-in attribution and seed an approved independent voice
  // action for the retention aggregate without storing an audio recording.
  assert.equal((await db.analyticsVisit.findUniqueOrThrow({ where: { id: secondVisit } })).memberAtEntry, true);
  await db.analyticsVisit.update({ where: { id: secondVisit }, data: { voiceResponse: true } });
  const memberVisit = cookie(browser, secondVisit) + "; " + member;
  await expect(await view(memberVisit, "create", "direct"), 204);
  const newCard = { categoryId: category.id, title: "QA fixture", description: "A synthetic prayer request for QA." };
  await expect(await request("/api/home-cards", {
    session: memberVisit, body: { ...newCard, isPrivate: true },
  }), 201);
  assert.equal((await db.analyticsVisit.findUniqueOrThrow({ where: { id: secondVisit } })).createdPrayer, false);
  await expect(await request("/api/home-cards", { session: memberVisit, body: newCard }), 201);

  const report = await expect(await request("/api/admin/analytics", { session: adminCookie }), 200);
  assert.match(report.headers.get("cache-control"), /no-store/);
  const data = await report.json();
  assert.deepEqual(data.totals, {
    sessions: 2, browsers: 1, pageViews: 5, engaged: 2, created: 1,
    guestSessions: 1, memberSessions: 1, signups: 1, engagedGuests: 1, engagedMembers: 1,
    prayed: 1, textResponses: 1, voiceResponses: 1, prayerViews: 2, createViews: 1, signupViews: 1,
    prayerConversions: 2, createConversions: 1, signupConversions: 1,
  });
  assert.deepEqual(data.retention, { returning: 1, participants: 1, repeatParticipants: 1 });
  assert.deepEqual(data.coverage, { eligible: 1, replied: 1 });
  assert.equal(data.sources.find((row) => row.source === "threads").signups, 1);
  assert.equal(data.landings.find((row) => row.landing === "home").sessions, 1);
  assert.equal(data.trend.length, 7);
  assert.equal((await (await expect(await request("/api/admin/analytics?days=30", { session: adminCookie }), 200)).json()).trend.length, 30);
  assert.ok(!JSON.stringify(data).includes(browser));
  assert.ok(!JSON.stringify(data).includes("qa@example.test"));
  await expect(await request("/api/admin/session", { session: adminCookie }), 200);
  const html = await (await expect(await request("/admin/analytics", { session: adminCookie }), 200)).text();
  assert.ok(html.includes("static/chunks/app/admin/analytics/page-"), "analytics page bundle is loaded");
  console.log("PASS analytics migration, collection, opt-out, signup, public/private creation, text and prayed events, admin permissions, attribution, retention, coverage and date ranges");
}

main().catch((error) => {
  console.error(error, output);
  process.exitCode = 1;
}).finally(async () => {
  if (server && server.exitCode === null) {
    const closed = once(server, "exit");
    server.kill();
    await closed;
  }
  await db.$disconnect();
  if (created) await root.$executeRawUnsafe("DROP DATABASE `" + name + "`");
  await root.$disconnect();
});
