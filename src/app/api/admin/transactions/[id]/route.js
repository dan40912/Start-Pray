import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logAdminAction, logSystemError } from "@/lib/logger";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const VALID_STATUS = new Set(["PENDING", "PROCESSING_CHAIN", "COMPLETED", "FAILED"]);
const SUPER_ONLY = roleSet("SUPER");

function toNumber(value) {
  if (value === null || value === undefined) return 0;
  if (typeof value === "number") return value;
  if (typeof value === "string") return Number(value);
  if (typeof value === "bigint") return Number(value);
  if (typeof value === "object") {
    if (typeof value.toNumber === "function") return value.toNumber();
    if (typeof value.valueOf === "function") {
      const nextValue = value.valueOf();
      if (typeof nextValue === "number") return nextValue;
      if (typeof nextValue === "string") return Number(nextValue);
    }
  }
  return Number(value);
}

function validateWithdrawTransition(currentStatus, nextStatus) {
  if (nextStatus === "PROCESSING_CHAIN" && currentStatus !== "PENDING") {
    return "Withdraw can move to PROCESSING_CHAIN only from PENDING.";
  }

  if (nextStatus === "COMPLETED" && !["PENDING", "PROCESSING_CHAIN"].includes(currentStatus)) {
    return "Withdraw can move to COMPLETED only from PENDING or PROCESSING_CHAIN.";
  }

  if (nextStatus === "FAILED" && !["PENDING", "PROCESSING_CHAIN"].includes(currentStatus)) {
    return "Withdraw can move to FAILED only from PENDING or PROCESSING_CHAIN.";
  }

  return null;
}

export async function PATCH(request, { params }) {
  const { error, session } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  const { id } = params;

  if (!id) {
    return NextResponse.json({ message: "Missing transaction id" }, { status: 400 });
  }

  let payload;
  try {
    payload = await request.json();
  } catch (error) {
    return NextResponse.json({ message: "Invalid request payload" }, { status: 400 });
  }

  const nextStatus = payload.status;
  const txHash = payload.txHash?.trim();

  if (!nextStatus || !VALID_STATUS.has(nextStatus)) {
    return NextResponse.json({ message: "Unsupported status" }, { status: 400 });
  }

  try {
    const existing = await prisma.tokenTransaction.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    if (!existing) {
      return NextResponse.json({ message: "Transaction not found" }, { status: 404 });
    }

    if (
      (existing.status === "COMPLETED" || existing.status === "FAILED") &&
      existing.status !== nextStatus
    ) {
      return NextResponse.json(
        { message: "Completed or failed transaction cannot be updated" },
        { status: 400 }
      );
    }

    if (existing.status === nextStatus && (!txHash || txHash === existing.txHash)) {
      return NextResponse.json(existing);
    }

    if (existing.type === "WITHDRAW") {
      const transitionError = validateWithdrawTransition(existing.status, nextStatus);
      if (transitionError) {
        return NextResponse.json({ message: transitionError }, { status: 400 });
      }
    }

    const updateData = {
      status: nextStatus,
      updatedAt: new Date(),
    };

    if (txHash) {
      updateData.txHash = txHash;
    }

    if (existing.type === "WITHDRAW" && nextStatus === "COMPLETED" && existing.status !== "COMPLETED") {
      await prisma.$transaction(async (tx) => {
        const latestTransaction = await tx.tokenTransaction.findUnique({
          where: { id },
          select: {
            id: true,
            userId: true,
            amount: true,
            status: true,
            type: true,
          },
        });

        if (!latestTransaction) {
          const missingTransactionError = new Error("TRANSACTION_NOT_FOUND");
          missingTransactionError.code = "TRANSACTION_NOT_FOUND";
          throw missingTransactionError;
        }

        if (latestTransaction.type !== "WITHDRAW") {
          const invalidTypeError = new Error("INVALID_TRANSACTION_TYPE");
          invalidTypeError.code = "INVALID_TRANSACTION_TYPE";
          throw invalidTypeError;
        }

        if (!["PENDING", "PROCESSING_CHAIN"].includes(latestTransaction.status)) {
          const transitionConflictError = new Error("WITHDRAW_STATE_CONFLICT");
          transitionConflictError.code = "WITHDRAW_STATE_CONFLICT";
          throw transitionConflictError;
        }

        const user = await tx.user.findUnique({
          where: { id: latestTransaction.userId },
          select: { id: true, walletBalance: true },
        });

        if (!user) {
          const missingUserError = new Error("USER_NOT_FOUND");
          missingUserError.code = "USER_NOT_FOUND";
          throw missingUserError;
        }

        const updatedResult = await tx.tokenTransaction.updateMany({
          where: {
            id,
            status: {
              in: ["PENDING", "PROCESSING_CHAIN"],
            },
          },
          data: updateData,
        });

        if (updatedResult.count !== 1) {
          const transitionConflictError = new Error("WITHDRAW_STATE_CONFLICT");
          transitionConflictError.code = "WITHDRAW_STATE_CONFLICT";
          throw transitionConflictError;
        }

        // Check-and-decrement in one UPDATE so two withdrawals completed at the
        // same time cannot both pass a stale balance read and overdraw.
        const debited = await tx.user.updateMany({
          where: {
            id: latestTransaction.userId,
            walletBalance: { gte: latestTransaction.amount },
          },
          data: {
            walletBalance: {
              decrement: latestTransaction.amount,
            },
          },
        });

        if (debited.count !== 1) {
          const insufficientBalanceError = new Error("INSUFFICIENT_BALANCE");
          insufficientBalanceError.code = "INSUFFICIENT_BALANCE";
          throw insufficientBalanceError;
        }
      });
    } else {
      await prisma.tokenTransaction.update({
        where: { id },
        data: updateData,
      });
    }

    await logAdminAction({
      action: "transaction.update",
      message: `Updated transaction ${id} status to ${nextStatus}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "TokenTransaction",
      targetId: id,
      requestPath: request.url,
      metadata: {
        previousStatus: existing.status,
        nextStatus,
        txHash: txHash ?? null,
        type: existing.type,
        userId: existing.userId,
      },
    });

    const refreshed = await prisma.tokenTransaction.findUnique({
      where: { id },
      include: {
        user: {
          select: { id: true, name: true, email: true },
        },
        relatedHomeCard: {
          select: { id: true, title: true, slug: true },
        },
        relatedResponse: {
          select: { id: true, message: true, homeCardId: true },
        },
      },
    });

    return NextResponse.json({
      ...refreshed,
      amount: toNumber(refreshed.amount),
      gasFee: refreshed.gasFee !== null ? toNumber(refreshed.gasFee) : null,
    });
  } catch (error) {
    if (error?.code === "INSUFFICIENT_BALANCE") {
      return NextResponse.json({ message: "Insufficient user balance for withdrawal." }, { status: 409 });
    }

    if (error?.code === "WITHDRAW_STATE_CONFLICT") {
      return NextResponse.json(
        { message: "Withdrawal status changed by another admin. Please refresh and try again." },
        { status: 409 },
      );
    }

    if (error?.code === "USER_NOT_FOUND") {
      return NextResponse.json({ message: "User not found." }, { status: 404 });
    }

    if (error?.code === "TRANSACTION_NOT_FOUND") {
      return NextResponse.json({ message: "Transaction not found." }, { status: 404 });
    }

    if (error?.code === "INVALID_TRANSACTION_TYPE") {
      return NextResponse.json({ message: "Invalid transaction type for this operation." }, { status: 400 });
    }

    await logSystemError({
      message: `Failed to update transaction ${id}`,
      error,
      requestPath: request.url,
      metadata: { id, body: payload },
    });

    console.error("❌ PATCH /api/admin/transactions/[id] error:", error);
    return NextResponse.json({ message: "Failed to update transaction" }, { status: 500 });
  }
}
