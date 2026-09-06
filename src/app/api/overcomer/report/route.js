import { NextResponse } from "next/server";

import prisma from "@/lib/prisma";
import { ensureActiveCustomer } from "@/lib/customer-access";
import { requireSessionUser } from "@/lib/server-session";

const VALID_REASONS = new Set([
  "spam_promotion",
  "hate_speech_harassment",
  "sexual_explicit",
  "violence_threat",
  "false_info",
  "privacy_violation",
  "other",
]);

async function findTargetUser({ targetUserId, targetUsername }) {
  if (targetUserId) {
    return prisma.user.findFirst({
      where: {
        id: targetUserId,
        isBlocked: false,
        publicProfileEnabled: true,
      },
      select: {
        id: true,
        username: true,
        name: true,
      },
    });
  }

  if (!targetUsername) return null;
  return prisma.user.findFirst({
    where: {
      username: { equals: targetUsername },
      isBlocked: false,
      publicProfileEnabled: true,
    },
    select: {
      id: true,
      username: true,
      name: true,
    },
  });
}

export async function POST(request) {
  try {
    const session = requireSessionUser();
    const user = await ensureActiveCustomer(session);

    const payload = await request.json().catch(() => null);
    const reason = payload?.reason;
    const remarks = typeof payload?.remarks === "string" ? payload.remarks.trim() : "";
    const targetUserId = payload?.targetUserId ? String(payload.targetUserId) : null;
    const targetUsername = payload?.targetUsername ? String(payload.targetUsername).trim() : null;

    if (!VALID_REASONS.has(reason)) {
      return NextResponse.json({ message: "檢舉原因不正確。" }, { status: 400 });
    }

    if (!targetUserId && !targetUsername) {
      return NextResponse.json({ message: "缺少被檢舉使用者資訊。" }, { status: 400 });
    }

    const targetUser = await findTargetUser({ targetUserId, targetUsername });
    if (!targetUser) {
      return NextResponse.json({ message: "找不到可檢舉的公開個人頁。" }, { status: 404 });
    }

    if (targetUser.id === user.id) {
      return NextResponse.json({ message: "不能檢舉自己的公開個人頁。" }, { status: 400 });
    }

    const metadata = {
      reason,
      remarks,
      targetUserId: targetUser.id,
      targetUsername: targetUser.username,
    };

    const existing = await prisma.overcomerUserReport.findUnique({
      where: {
        targetUserId_reporterId: {
          targetUserId: targetUser.id,
          reporterId: user.id,
        },
      },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ success: true, alreadyReported: true });
    }

    await prisma.$transaction(async (tx) => {
      await tx.overcomerUserReport.create({
        data: {
          targetUserId: targetUser.id,
          reporterId: user.id,
          reason,
          remarks: remarks || null,
        },
      });

      await tx.user.update({
        where: { id: targetUser.id },
        data: { reportCount: { increment: 1 } },
      });

      await tx.adminLog.create({
        data: {
          category: "ACTION",
          level: "WARNING",
          message: `使用者檢舉公開個人頁 ${targetUser.username || targetUser.id}`,
          action: "overcomer/report",
          actorId: user.id,
          actorEmail: user.email ?? null,
          targetType: "user",
          targetId: targetUser.id,
          requestPath: "/api/overcomer/report",
          metadata,
        },
      });
    });

    return NextResponse.json({ success: true, alreadyReported: false });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "請先登入後再檢舉。" }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "帳號已被停用，無法執行此操作。" }, { status: 403 });
    }

    console.error("POST /api/overcomer/report error", error);
    return NextResponse.json({ message: "檢舉失敗，請稍後再試。" }, { status: 500 });
  }
}
