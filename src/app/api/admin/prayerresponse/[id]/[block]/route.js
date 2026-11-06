import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction, logSystemError } from "@/lib/logger";
import prisma from "@/lib/prisma";

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  try {
    const { id } = params;
    const { block } = await request.json();

    if (!id) {
      return NextResponse.json({ message: "Missing ID" }, { status: 400 });
    }

    const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.prayerResponse.update({
      where: { id },
      data: { isBlocked: Boolean(block) },
    });

    await logAdminAction({
      action: updated.isBlocked ? "prayerresponse.block" : "prayerresponse.unblock",
      message: `Updated prayer response ${id} status to ${updated.isBlocked ? "Blocked" : "Active"}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "PrayerResponse",
      targetId: id,
      requestPath: request.url,
      metadata: { block: Boolean(block) },
      transaction: tx, required: true,
    });
    return updated;
    });

    return NextResponse.json(updated);
  } catch (err) {
    await logSystemError({
      message: `Failed to update prayer response status: ${params?.id ?? ""}`,
      error: err,
      requestPath: request.url,
    });

    return NextResponse.json({ message: "Failed to update prayer response status" }, { status: 500 });
  }
}

