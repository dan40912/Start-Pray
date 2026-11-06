// /src/app/api/admin/prayfor/[id]/block/route.js
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAdminAction, logSystemError } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin-route-auth";

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = params;
    const { block } = await request.json();

    const numericId = Number(id);
    if (typeof block !== "boolean") return NextResponse.json({ message: "請提供明確的封鎖狀態" }, { status: 400 });
    const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.homePrayerCard.update({
      where: { id: numericId },
      data: { isBlocked: block },
    });

    await logAdminAction({
      action: block ? "prayer.block" : "prayer.unblock",
      message: `更新禱告項目 ${numericId} 狀態為 ${block ? "Blocked" : "Active"}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "HomePrayerCard",
      targetId: String(numericId),
      requestPath: request.url,
      metadata: { block },
      transaction: tx, required: true,
    });
    return updated;
    });

    return NextResponse.json(updated);
  } catch (err) {
    await logSystemError({
      message: `更新禱告項目 ${params?.id ?? ""} 狀態失敗`,
      error: err,
      requestPath: request.url,
    });

    console.error("❌ 更新/解除禱告封鎖失敗:", err);
    return NextResponse.json({ message: "操作失敗" }, { status: 500 });
  }
}
