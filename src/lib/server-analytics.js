import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { BROWSER_COOKIE, VISIT_COOKIE } from "./analytics-shared.mjs";

const UUID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
const ACTION_COLUMNS = {
  signup: Prisma.sql`signedUp`,
  create: Prisma.sql`createdPrayer`,
  prayed: Prisma.sql`prayed`,
  text: Prisma.sql`textResponse`,
  voice: Prisma.sql`voiceResponse`,
};

export function analyticsEnabled() {
  return process.env.ANALYTICS_ENABLED === "true";
}

export function analyticsIdentity(request) {
  if (!analyticsEnabled() || request.headers.get("sec-gpc") === "1" ||
      request.headers.get("dnt") === "1" || /bot|spider|crawl|preview/i.test(request.headers.get("user-agent") || "")) {
    return null;
  }
  const id = request.cookies.get(VISIT_COOKIE)?.value;
  const browserId = request.cookies.get(BROWSER_COOKIE)?.value;
  return UUID.test(id) && UUID.test(browserId) ? { id, browserId } : null;
}

export async function recordAnalyticsPage({ id, browserId }, page, source, memberAtEntry) {
  await prisma.$executeRaw`
    INSERT INTO analytics_visit
      (id, browserId, createdAt, landing, source, memberAtEntry, pageViews, openedPrayer, openedCreate, openedSignup)
    VALUES
      (${id}, ${browserId}, ${new Date()}, ${page}, ${source}, ${memberAtEntry}, 1, ${page === "prayer"}, ${page === "create"}, ${page === "signup"})
    ON DUPLICATE KEY UPDATE
      memberAtEntry = IF(browserId = ${browserId} AND pageViews = 0, ${memberAtEntry}, memberAtEntry),
      landing = IF(browserId = ${browserId}, COALESCE(landing, ${page}), landing),
      source = IF(browserId = ${browserId}, COALESCE(source, ${source}), source),
      pageViews = IF(browserId = ${browserId}, LEAST(pageViews + 1, 500), pageViews),
      openedPrayer = openedPrayer OR (browserId = ${browserId} AND ${page === "prayer"}),
      openedCreate = openedCreate OR (browserId = ${browserId} AND ${page === "create"}),
      openedSignup = openedSignup OR (browserId = ${browserId} AND ${page === "signup"})
  `;
}

export async function recordAnalyticsAction(request, action) {
  const identity = analyticsIdentity(request);
  if (!identity) return;
  const { id, browserId } = identity;
  const column = ACTION_COLUMNS[action];
  try {
    await prisma.$executeRaw`
      INSERT INTO analytics_visit (id, browserId, createdAt, ${column})
      VALUES (${id}, ${browserId}, ${new Date()}, true)
      ON DUPLICATE KEY UPDATE ${column} = ${column} OR browserId = ${browserId}
    `;
  } catch {
    // A metrics outage must not change the outcome of a successful submission.
    console.warn("Unable to record analytics action", action);
  }
}
