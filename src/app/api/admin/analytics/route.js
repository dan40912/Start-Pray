import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-route-auth";
import { analyticsEnabled } from "@/lib/server-analytics";
import { analyticsWindow, fillAnalyticsDays } from "@/lib/analytics-window.mjs";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

const localDay = Prisma.sql`DATE_FORMAT(DATE_ADD(createdAt, INTERVAL 8 HOUR), '%Y-%m-%d')`;
const engaged = Prisma.sql`(prayed OR textResponse OR voiceResponse OR createdPrayer)`;
const responded = Prisma.sql`(textResponse OR voiceResponse)`;

function numeric(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key, value === null || typeof value !== "string" ? Number(value) : value,
  ]));
}

export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;
  const days = Number(new URL(request.url).searchParams.get("days") || 7);
  if (![7, 30].includes(days)) {
    return NextResponse.json({ message: "請選擇 7 或 30 天。" }, { status: 400 });
  }

  const { start, end, today } = analyticsWindow(days);
  const observed = Prisma.sql`createdAt >= ${start} AND createdAt < ${end} AND pageViews > 0`;
  const responseHeaders = { "Cache-Control": "private, no-store" };

  try {
    const [totals, trend, sources, landings, retention, coverage] = await prisma.$transaction([
      prisma.$queryRaw`
        SELECT COUNT(*) AS sessions, COUNT(DISTINCT browserId) AS browsers, SUM(pageViews) AS pageViews,
               SUM(${engaged}) AS engaged, SUM(createdPrayer) AS created,
               SUM(NOT memberAtEntry) AS guestSessions, SUM(memberAtEntry) AS memberSessions,
               SUM(NOT memberAtEntry AND signedUp) AS signups,
               SUM(NOT memberAtEntry AND ${engaged}) AS engagedGuests,
               SUM(memberAtEntry AND ${engaged}) AS engagedMembers,
               SUM(prayed) AS prayed, SUM(textResponse) AS textResponses, SUM(voiceResponse) AS voiceResponses,
               SUM(openedPrayer) AS prayerViews, SUM(openedCreate) AS createViews, SUM(openedSignup) AS signupViews,
               SUM(openedPrayer AND (prayed OR ${responded})) AS prayerConversions,
               SUM(openedCreate AND createdPrayer) AS createConversions,
               SUM(openedSignup AND signedUp) AS signupConversions
        FROM analytics_visit WHERE ${observed}
      `,
      prisma.$queryRaw`
        SELECT ${localDay} AS day, COUNT(*) AS sessions, COUNT(DISTINCT browserId) AS browsers,
               SUM(${engaged}) AS engaged
        FROM analytics_visit WHERE ${observed}
        GROUP BY day ORDER BY day
      `,
      prisma.$queryRaw`
        SELECT source, COUNT(*) AS sessions, SUM(${engaged}) AS engaged,
               SUM(NOT memberAtEntry) AS guestSessions, SUM(NOT memberAtEntry AND signedUp) AS signups
        FROM analytics_visit WHERE ${observed}
        GROUP BY source ORDER BY sessions DESC, source
      `,
      prisma.$queryRaw`
        SELECT landing, COUNT(*) AS sessions, SUM(${engaged}) AS engaged
        FROM analytics_visit WHERE ${observed}
        GROUP BY landing ORDER BY sessions DESC, landing
      `,
      prisma.$queryRaw`
        SELECT SUM(visitDays > 1) AS returning,
               SUM(engagedDays > 0) AS participants, SUM(engagedDays > 1) AS repeatParticipants
        FROM (
          SELECT COUNT(DISTINCT ${localDay}) AS visitDays,
                 COUNT(DISTINCT IF(${engaged}, ${localDay}, NULL)) AS engagedDays
          FROM analytics_visit WHERE ${observed} GROUP BY browserId
        ) AS browsers
      `,
      prisma.$queryRaw`
        SELECT COUNT(*) AS eligible, SUM(EXISTS (
          SELECT 1 FROM prayerresponse r
          WHERE r.homeCardId = c.id AND r.isBlocked = false AND r.moderationStatus = 'APPROVED'
            AND r.voiceModerationStatus IN ('APPROVED', 'NOT_APPLICABLE')
            AND (c.ownerId IS NULL OR r.responderId IS NULL OR c.ownerId <> r.responderId)
            AND (c.guestSessionHash IS NULL OR r.guestSessionHash IS NULL OR c.guestSessionHash <> r.guestSessionHash)
            AND r.createdAt >= c.createdAt AND r.createdAt < DATE_ADD(c.createdAt, INTERVAL 1 DAY)
        )) AS replied
        FROM home_prayer_card c
        WHERE c.createdAt >= ${start} AND c.createdAt <= DATE_SUB(${end}, INTERVAL 1 DAY)
          AND c.isPrivate = false AND c.isBlocked = false AND c.needsReview = false
      `,
    ]);

    return NextResponse.json({
      enabled: analyticsEnabled(),
      today,
      updatedAt: end.toISOString(),
      totals: numeric(totals[0]),
      retention: numeric(retention[0]),
      coverage: numeric(coverage[0]),
      trend: fillAnalyticsDays(trend.map(numeric), start, days),
      sources: sources.map(numeric),
      landings: landings.map(numeric),
    }, { headers: responseHeaders });
  } catch (error) {
    console.error("Unable to load admin analytics", error.code || error.name);
    return NextResponse.json({ message: "暫時無法讀取分析資料，請稍後重試。" }, {
      status: 503, headers: responseHeaders,
    });
  }
}
