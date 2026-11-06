import assert from "node:assert/strict";
import test from "node:test";
import { pageType, trafficSource } from "../src/lib/analytics-shared.mjs";
import { analyticsWindow, fillAnalyticsDays } from "../src/lib/analytics-window.mjs";

test("only supported pages are measured, using groups instead of private identifiers", () => {
  assert.equal(pageType("/en/prayfor/123"), "prayer");
  assert.equal(pageType("/en/overcomer/sensitive-name"), "story");
  assert.equal(pageType("/en/me/create"), "create");
  assert.equal(pageType("/me/edit/123"), null);
  assert.equal(pageType("/admin/analytics"), null);
});

test("traffic attribution only returns allowlisted categories", () => {
  const site = "https://startpray.online";
  assert.equal(trafficSource(new URL(site + "?utm_source=LINE"), ""), "line");
  assert.equal(trafficSource(new URL(site), "https://www.threads.com/private/path"), "threads");
  assert.equal(trafficSource(new URL(site), "https://threads.com.example.org"), "other");
  assert.equal(trafficSource(new URL(site + "?utm_source=someone"), ""), "other");
  assert.equal(trafficSource(new URL(site), site + "/prayfor/12"), "direct");
});

test("calendar windows and zero-filled dates use Taipei midnight", () => {
  const window = analyticsWindow(7, new Date("2026-11-06T16:01:00Z"));
  assert.equal(window.start.toISOString(), "2026-10-31T16:00:00.000Z");
  assert.equal(window.today, "2026-11-07");
  const trend = fillAnalyticsDays([{ day: window.today, sessions: 2 }], window.start, 7);
  assert.equal(trend[0].day, "2026-11-01");
  assert.equal(trend[0].sessions, 0);
  assert.equal(trend[6].sessions, 2);
});
