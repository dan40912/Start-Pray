import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { ensureActiveCustomer } from "@/lib/customer-access";
import { readSessionUser } from "@/lib/server-session";
import { REPORT_REASON_SET } from "@/constants/reportReasons";
import {
  GUEST_RESPONSE_COOKIE,
  createGuestId,
  guestCookieOptions,
  hashDailyIp,
  hashGuestId,
} from "@/lib/guest-response";
import {
  GUEST_REPORT_WINDOW_MINUTES,
  buildGuestReportActorId,
  isGuestRateLimited,
  isResponseAlreadyHidden,
} from "@/lib/prayer-response-report";

function normalizeRemarks(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 600);
}

// Anonymous visitors report through the same endpoint as logged-in members
// (see docs/obsidian/26-Anonymous-Reporting-Design.md) — Server decides the
// reporter's identity from session/guest cookie, never from the request body.
async function handleGuestReport({ request, response, responseId, reason, remarks }) {
  const now = new Date();
  const guestId = request.cookies.get(GUEST_RESPONSE_COOKIE)?.value || createGuestId();
  const guestSessionHash = hashGuestId(guestId);
  const ipHash = hashDailyIp(request, now);
  const actorId = buildGuestReportActorId(guestSessionHash);
  const windowStart = new Date(now.getTime() - GUEST_REPORT_WINDOW_MINUTES * 60 * 1000);

  const [guestCount, ipCount] = await Promise.all([
    prisma.adminLog.count({
      where: { action: "prayer-response/report", actorId, createdAt: { gte: windowStart } },
    }),
    prisma.adminLog.count({
      where: {
        action: "prayer-response/report",
        createdAt: { gte: windowStart },
        // MySQL's Prisma JSON filter takes `path` as a JSON-path *string*
        // (e.g. "$.ipHash"), unlike Postgres/Mongo which take a string array.
        metadata: { path: "$.ipHash", equals: ipHash },
      },
    }),
  ]);

  if (isGuestRateLimited({ guestCount, ipCount })) {
    const result = NextResponse.json(
      { code: "RATE_LIMITED", message: "短時間內檢舉次數較多，請稍後再試。" },
      { status: 429 }
    );
    result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions());
    return result;
  }

  const alreadyHidden = isResponseAlreadyHidden(response);

  if (!alreadyHidden) {
    await prisma.prayerResponse.update({
      where: { id: responseId },
      data: {
        reportCount: { increment: 1 },
        // Same content-policy field the authenticated flow uses (see the
        // comment in the session branch below) — no second hidden field.
        moderationStatus: "PENDING",
      },
    });
  }

  // Guest reports don't get a PrayerResponseReport row: reporterId there is a
  // required FK to User, which an anonymous visitor doesn't have. AdminLog
  // (actorId is a free-form string, no FK) is the audit trail instead.
  await prisma.adminLog.create({
    data: {
      category: "ACTION",
      level: "WARNING",
      message: `匿名訪客檢舉禱告回應 ${responseId}`,
      action: "prayer-response/report",
      actorId,
      targetType: "prayer_response",
      targetId: responseId,
      requestPath: "/api/prayer-response/report",
      metadata: {
        reason,
        remarks,
        homeCardId: response.homeCardId ?? null,
        guest: true,
        ipHash,
        alreadyHidden,
      },
    },
  });

  const result = NextResponse.json({ success: true }, { status: 200 });
  result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions());
  return result;
}

async function handleAuthenticatedReport({ session, response, responseId, reason, remarks }) {
  const user = await ensureActiveCustomer(session);
  const reporterId = user.id;
  const shouldBlock = Boolean(response.homeCard?.ownerId) && response.homeCard.ownerId === reporterId;

  await prisma.$transaction(async (tx) => {
    const existing = await tx.prayerResponseReport.findUnique({
      where: {
        responseId_reporterId: {
          responseId,
          reporterId,
        },
      },
    });

    if (existing) {
      await tx.prayerResponseReport.update({
        where: { id: existing.id },
        data: {
          reason,
          remarks: remarks || null,
        },
      });

      if (shouldBlock) {
        await tx.prayerResponse.update({
          where: { id: responseId },
          data: { isBlocked: true },
        });
      }
    } else {
      await tx.prayerResponseReport.create({
        data: {
          responseId,
          reporterId,
          reason,
          remarks: remarks || null,
        },
      });

      await tx.prayerResponse.update({
        where: { id: responseId },
        data: {
          reportCount: { increment: 1 },
          // Content policy (changed 2026-07-01): a report sends the response back to
          // PENDING for re-review instead of leaving it silently visible or permanently
          // hidden. If the card owner is the reporter, isBlocked still wins (harder gate).
          ...(shouldBlock
            ? { isBlocked: true }
            : { moderationStatus: "PENDING" }),
        },
      });
    }

    await tx.adminLog.create({
      data: {
        category: "ACTION",
        level: "WARNING",
        message: `使用者檢舉禱告回應 ${responseId}`,
        action: "prayer-response/report",
        actorId: reporterId,
        actorEmail: user.email ?? null,
        targetType: "prayer_response",
        targetId: responseId,
        requestPath: "/api/prayer-response/report",
        metadata: {
          reason,
          remarks,
          homeCardId: response.homeCardId ?? null,
          autoBlocked: shouldBlock,
        },
      },
    });
  });

  return NextResponse.json({ success: true });
}

export async function POST(request) {
  try {
    const session = readSessionUser();

    const payload = await request.json().catch(() => null);
    const responseId = payload?.responseId ? String(payload.responseId) : "";
    const reason = payload?.reason ? String(payload.reason) : "";
    const remarks = normalizeRemarks(payload?.remarks ?? "");

    if (!responseId) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "缺少檢舉目標" }, { status: 400 });
    }

    if (!REPORT_REASON_SET.has(reason)) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "檢舉原因不正確" }, { status: 400 });
    }

    const response = await prisma.prayerResponse.findUnique({
      where: { id: responseId },
      select: {
        id: true,
        isBlocked: true,
        moderationStatus: true,
        homeCardId: true,
        homeCard: { select: { ownerId: true } },
      },
    });

    if (!response) {
      return NextResponse.json({ code: "RESPONSE_NOT_FOUND", message: "找不到禱告回應" }, { status: 404 });
    }

    if (session) {
      return await handleAuthenticatedReport({ session, response, responseId, reason, remarks });
    }

    return await handleGuestReport({ request, response, responseId, reason, remarks });
  } catch (error) {
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json(
        { code: "ACCOUNT_BLOCKED", message: "帳號已被停用，無法執行此操作" },
        { status: 403 }
      );
    }

    console.error("POST /api/prayer-response/report error", error);
    return NextResponse.json({ code: "REPORT_FAILED", message: "檢舉失敗，請稍後再試" }, { status: 500 });
  }
}
