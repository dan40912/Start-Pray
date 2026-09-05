import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { readSessionUser } from "@/lib/server-session";
import {
  GUEST_RESPONSE_COOKIE,
  createGuestId,
  guestCookieOptions,
  hashDailyIp,
} from "@/lib/guest-response";
import {
  PRAYED_GUEST_WINDOW_MINUTES,
  isGuestRateLimited,
  isPrayerUnavailable,
  resolveActor,
} from "@/lib/prayed-reaction";
import { isTrustedOrigin } from "@/lib/origin-guard";

// "我已為你禱告" — anonymous-capable prayed reaction. Route lives under
// /api/home-cards/[id]/... (not /api/prayers/[id]/... from the spec's
// illustrative example) because /api/prayers/* is a deprecated, 410-Gone
// namespace — see docs/obsidian/28-Prayed-Reaction-Design.md.

function parsePrayerId(paramValue) {
  const id = Number(paramValue);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function loadPrayer(id) {
  return prisma.homePrayerCard.findUnique({
    where: { id },
    select: { id: true, isBlocked: true, isPrivate: true },
  });
}

export async function GET(request, { params }) {
  try {
    const id = parsePrayerId(params?.id);
    if (!id) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid prayer id" }, { status: 400 });
    }

    const prayer = await loadPrayer(id);
    if (isPrayerUnavailable(prayer)) {
      return NextResponse.json({ code: "PRAYER_NOT_FOUND", message: "找不到這件代禱" }, { status: 404 });
    }

    const session = readSessionUser();
    const guestId = session ? null : request.cookies.get(GUEST_RESPONSE_COOKIE)?.value || null;
    const actor = resolveActor({ session, guestId });

    const [count, existing] = await Promise.all([
      prisma.prayerPrayedReaction.count({ where: { prayerId: id } }),
      actor
        ? prisma.prayerPrayedReaction.findUnique({
            where: {
              prayerId_actorType_actorKeyHash: {
                prayerId: id,
                actorType: actor.actorType,
                actorKeyHash: actor.actorKeyHash,
              },
            },
            select: { id: true },
          })
        : null,
    ]);

    return NextResponse.json({ count, reacted: Boolean(existing) }, { status: 200 });
  } catch (error) {
    console.error("GET /api/home-cards/[id]/prayed error", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "目前無法記錄，請稍後再試。" }, { status: 500 });
  }
}

export async function POST(request, { params }) {
  try {
    if (!isTrustedOrigin(request)) {
      return NextResponse.json(
        { code: "INVALID_ORIGIN", message: "這個請求的來源不受信任，請重新整理頁面後再試一次。" },
        { status: 403 }
      );
    }

    const id = parsePrayerId(params?.id);
    if (!id) {
      return NextResponse.json({ code: "INVALID_REQUEST", message: "Invalid prayer id" }, { status: 400 });
    }

    const prayer = await loadPrayer(id);
    if (isPrayerUnavailable(prayer)) {
      return NextResponse.json({ code: "PRAYER_NOT_FOUND", message: "找不到這件代禱" }, { status: 404 });
    }

    // Identity is entirely server-resolved from session/guest cookie — the
    // request body is never read, so no client-supplied userId/guestHash/
    // actorKey/count/status/hidden/admin field can ever reach this logic.
    const session = readSessionUser();
    const now = new Date();
    let guestId = null;
    let ipHash = null;
    if (!session) {
      guestId = request.cookies.get(GUEST_RESPONSE_COOKIE)?.value || createGuestId();
      ipHash = hashDailyIp(request, now);
    }
    const actor = resolveActor({ session, guestId });
    if (!actor) {
      return NextResponse.json({ code: "IDENTITY_UNAVAILABLE", message: "目前無法記錄，請稍後再試。" }, { status: 500 });
    }

    if (!session) {
      const windowStart = new Date(now.getTime() - PRAYED_GUEST_WINDOW_MINUTES * 60 * 1000);
      const [distinctPrayers, ipCount] = await Promise.all([
        prisma.prayerPrayedReaction.findMany({
          where: { actorType: "GUEST", actorKeyHash: actor.actorKeyHash, createdAt: { gte: windowStart } },
          select: { prayerId: true },
          distinct: ["prayerId"],
        }),
        prisma.prayerPrayedReaction.count({ where: { ipHash, createdAt: { gte: windowStart } } }),
      ]);
      if (isGuestRateLimited({ distinctPrayerCount: distinctPrayers.length, ipCount })) {
        const result = NextResponse.json(
          { code: "RATE_LIMITED", message: "短時間內操作較多，請稍後再試。" },
          { status: 429 }
        );
        result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions());
        return result;
      }
    }

    // Idempotent: first request creates the row, every later one from the
    // same actor is a no-op (unique constraint on prayerId+actorType+actorKeyHash).
    try {
      await prisma.prayerPrayedReaction.create({
        data: {
          prayerId: id,
          actorType: actor.actorType,
          actorKeyHash: actor.actorKeyHash,
          userId: actor.userId,
          ipHash,
        },
      });
    } catch (err) {
      if (err?.code !== "P2002") throw err;
    }

    const count = await prisma.prayerPrayedReaction.count({ where: { prayerId: id } });
    const result = NextResponse.json({ count, reacted: true }, { status: 200 });
    if (!session) result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions());
    return result;
  } catch (error) {
    console.error("POST /api/home-cards/[id]/prayed error", error);
    return NextResponse.json({ code: "SERVER_ERROR", message: "目前無法記錄，請稍後再試。" }, { status: 500 });
  }
}
