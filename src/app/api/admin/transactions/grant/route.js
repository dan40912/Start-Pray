import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { requireAdmin, roleSet } from "@/lib/admin-route-auth";
import { logAdminAction, logSystemError } from "@/lib/logger";
import prisma from "@/lib/prisma";

const SUPER_ONLY = roleSet("SUPER");
const MAX_NOTE_LENGTH = 300;

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object" && typeof value.toString === "function") {
    return Number(value.toString());
  }
  return Number(value);
}

export async function POST(request) {
  const { error, session } = await requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  let payload;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
  }

  const userId = typeof payload?.userId === "string" ? payload.userId.trim() : "";
  const amount = Number(payload?.amount);
  const note = typeof payload?.note === "string" ? payload.note.trim().slice(0, MAX_NOTE_LENGTH) : "";

  if (!userId) {
    return NextResponse.json({ message: "userId is required" }, { status: 400 });
  }

  if (!Number.isFinite(amount) || amount <= 0) {
    return NextResponse.json({ message: "amount must be a positive number" }, { status: 422 });
  }

  const amountDecimal = new Prisma.Decimal(amount);

  try {
    const result = await prisma.$transaction(async (tx) => {
      const targetUser = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, email: true, name: true, walletBalance: true },
      });

      if (!targetUser) {
        const notFoundError = new Error("USER_NOT_FOUND");
        notFoundError.code = "USER_NOT_FOUND";
        throw notFoundError;
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: amountDecimal },
        },
        select: { id: true, walletBalance: true, email: true, name: true },
      });

      const transaction = await tx.tokenTransaction.create({
        data: {
          userId,
          type: "ADMIN_GRANT",
          status: "COMPLETED",
          amount: amountDecimal,
          metadata: {
            adminId: session.adminId,
            adminUsername: session.username,
            note: note || null,
            requestSource: "admin_wallet_grant",
          },
        },
      });

      return { transaction, updatedUser };
    });

    await logAdminAction({
      action: "transaction.admin_grant",
      message: `Granted ${amountDecimal.toString()} tokens to user ${userId}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "User",
      targetId: userId,
      requestPath: request.url,
      metadata: {
        amount: amountDecimal.toString(),
        note: note || null,
        transactionId: result.transaction.id,
      },
    });

    return NextResponse.json({
      transaction: {
        ...result.transaction,
        amount: toNumber(result.transaction.amount),
      },
      user: {
        ...result.updatedUser,
        walletBalance: toNumber(result.updatedUser.walletBalance),
      },
    });
  } catch (caughtError) {
    if (caughtError?.code === "USER_NOT_FOUND") {
      return NextResponse.json({ message: "Target user not found" }, { status: 404 });
    }

    await logSystemError({
      message: "Failed to grant tokens from admin wallet",
      error: caughtError,
      requestPath: request.url,
      metadata: { userId, amount, note },
    });

    return NextResponse.json({ message: "Failed to grant tokens" }, { status: 500 });
  }
}
