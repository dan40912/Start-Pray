import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { ensureActiveCustomer } from "@/lib/customer-access";
import { requireSessionUser } from "@/lib/server-session";
import { REPORT_REASON_SET } from "@/constants/reportReasons";

// PRD-005:檢舉數達此門檻,卡片自動轉待審並標記作者
const REPORT_REVIEW_THRESHOLD = 3;

function normalizeRemarks(value) {
  if (!value) return "";
  return String(value).trim().slice(0, 600);
}

export async function POST(request) {
  try {
    const session = requireSessionUser();
    const user = await ensureActiveCustomer(session);

    const payload = await request.json().catch(() => null);
    const cardIdRaw = payload?.cardId;
    const reasonRaw = payload?.reason;
    const remarksRaw = payload?.remarks;

    const cardId = Number(cardIdRaw);
    const reason = typeof reasonRaw === "string" ? reasonRaw : "";
    const remarks = normalizeRemarks(remarksRaw);

    if (!Number.isInteger(cardId) || cardId <= 0) {
      return NextResponse.json({ message: "缺少正確的禱告事項資訊" }, { status: 400 });
    }

    if (!REPORT_REASON_SET.has(reason)) {
      return NextResponse.json({ message: "檢舉原因不正確" }, { status: 400 });
    }

    const card = await prisma.homePrayerCard.findUnique({
      where: { id: cardId },
      select: {
        id: true,
        isBlocked: true,
        isPrivate: true,
        reportCount: true,
        title: true,
        ownerId: true,
        needsReview: true,
      },
    });

    if (!card || card.isBlocked || card.isPrivate) {
      return NextResponse.json({ message: "找不到這則禱告事項" }, { status: 404 });
    }

    const reporterId = user.id;

    await prisma.$transaction(async (tx) => {
      const existing = await tx.homePrayerCardReport.findUnique({
        where: {
          cardId_reporterId: {
            cardId,
            reporterId,
          },
        },
      });

      if (existing) {
        await tx.homePrayerCardReport.update({
          where: { id: existing.id },
          data: {
            reason,
            remarks: remarks || null,
          },
        });
      } else {
        await tx.homePrayerCardReport.create({
          data: {
            cardId,
            reporterId,
            reason,
            remarks: remarks || null,
          },
        });

        await tx.homePrayerCard.update({
          where: { id: cardId },
          data: { reportCount: { increment: 1 } },
        });

        // PRD-005:檢舉達門檻 → 卡片轉待審,作者 flaggedCount +1
        const newReportCount = (card.reportCount ?? 0) + 1;
        if (newReportCount >= REPORT_REVIEW_THRESHOLD && !card.needsReview) {
          await tx.homePrayerCard.update({
            where: { id: cardId },
            data: { needsReview: true },
          });
          if (card.ownerId) {
            await tx.user.update({
              where: { id: card.ownerId },
              data: { flaggedCount: { increment: 1 } },
            });
          }
          await tx.adminLog.create({
            data: {
              category: "ACTION",
              level: "WARNING",
              message: `禱告事項 ${cardId} 檢舉達門檻，已自動轉為待審`,
              action: "prayfor/auto-review",
              actorId: reporterId,
              actorEmail: user.email ?? null,
              targetType: "home_prayer_card",
              targetId: String(cardId),
              requestPath: "/api/prayfor/report",
              metadata: { newReportCount, threshold: REPORT_REVIEW_THRESHOLD },
            },
          });
        }
      }

      await tx.adminLog.create({
        data: {
          category: "ACTION",
          level: "WARNING",
          message: `使用者檢舉禱告事項 ${cardId}`,
          action: "prayfor/report",
          actorId: reporterId,
          actorEmail: user.email ?? null,
          targetType: "home_prayer_card",
          targetId: String(cardId),
          requestPath: "/api/prayfor/report",
          metadata: {
            reason,
            remarks,
            cardTitle: card.title ?? null,
          },
        },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "請先登入後再檢舉" }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "帳號已被停用，無法執行此操作" }, { status: 403 });
    }

    console.error("POST /api/prayfor/report error", error);
    return NextResponse.json({ message: "檢舉失敗，請稍後再試" }, { status: 500 });
  }
}

