import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-route-auth";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;
  try {
    const [totalUsers, blockedUsers, totalPrayers, totalResponses, pendingCards, pendingResponses, pendingVoices, reportedCards, reportedResponses] = await prisma.$transaction([
      prisma.user.count(), prisma.user.count({ where: { isBlocked: true } }),
      prisma.homePrayerCard.count(), prisma.prayerResponse.count(),
      prisma.homePrayerCard.count({ where: { isBlocked: false, needsReview: true } }),
      prisma.prayerResponse.count({ where: { isBlocked: false, moderationStatus: "PENDING" } }),
      prisma.prayerResponse.count({ where: { isBlocked: false, voiceModerationStatus: "PENDING" } }),
      prisma.homePrayerCard.count({ where: { isBlocked: false, reportCount: { gt: 0 } } }),
      prisma.prayerResponse.count({ where: { isBlocked: false, reportCount: { gt: 0 } } }),
    ]);
    return NextResponse.json({
      canManageUsers: session.role === "SUPER",
      metrics: { totalUsers, blockedUsers, totalPrayers, totalResponses },
      work: { pendingCards, pendingResponses, pendingVoices, reportedCards, reportedResponses },
      updatedAt: new Date().toISOString(),
    }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ message: "無法更新待辦摘要；請重試，勿將舊資料視為目前狀態" }, { status: 503 });
  }
}
