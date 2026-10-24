import { NextResponse } from "next/server";

import { ensureActiveCustomer } from "@/lib/customer-access";
import prisma from "@/lib/prisma";
import { requireSessionUser } from "@/lib/server-session";
import { WITHDRAW_BLOCKING_STATUSES, WITHDRAW_CHAIN, WITHDRAW_MIN_AMOUNT } from "@/lib/withdrawals";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

function clampLimit(value) {
  const parsed = Number.parseInt(value ?? `${DEFAULT_LIMIT}`, 10);
  if (Number.isNaN(parsed) || parsed < 1) return DEFAULT_LIMIT;
  return Math.min(parsed, MAX_LIMIT);
}

export async function GET(request) {
  try {
    const session = requireSessionUser();
    const user = await ensureActiveCustomer(session);
    const { searchParams } = new URL(request.url);
    const limit = clampLimit(searchParams.get("limit"));

    const records = await prisma.tokenTransaction.findMany({
      where: {
        userId: user.id,
        type: "WITHDRAW",
      },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        amount: true,
        status: true,
        txHash: true,
        targetAddress: true,
        createdAt: true,
        updatedAt: true,
        metadata: true,
      },
    });

    return NextResponse.json({
      minAmount: WITHDRAW_MIN_AMOUNT,
      chain: WITHDRAW_CHAIN,
      records: records.map((item) => ({
        ...item,
        amount: toNumber(item.amount),
      })),
    });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "請先登入。" }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "帳號已被停用。" }, { status: 403 });
    }

    console.error("GET /api/customer/withdrawals error", error);
    return NextResponse.json({ message: "載入提領紀錄失敗。" }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const session = requireSessionUser();
    const activeUser = await ensureActiveCustomer(session);

    const payload = await request.json().catch(() => null);
    const amount = Number(payload?.amount);

    if (!Number.isFinite(amount) || amount < WITHDRAW_MIN_AMOUNT) {
      return NextResponse.json(
        { message: `提領金額至少需要 ${WITHDRAW_MIN_AMOUNT}。` },
        { status: 422 }
      );
    }

    // Serialize withdraw requests per user: lock the user row first, then run
    // the pending-order and balance checks inside the same transaction. Without
    // the lock, parallel requests could all pass the "no pending order" check
    // and create several pending withdrawals at once.
    const result = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM \`user\` WHERE id = ${activeUser.id} FOR UPDATE`;

      const [user, pendingOrder] = await Promise.all([
        tx.user.findUnique({
          where: { id: activeUser.id },
          select: {
            id: true,
            walletBalance: true,
            bscAddress: true,
            isAddressVerified: true,
          },
        }),
        tx.tokenTransaction.findFirst({
          where: {
            userId: activeUser.id,
            type: "WITHDRAW",
            status: { in: WITHDRAW_BLOCKING_STATUSES },
          },
          select: { id: true, status: true, createdAt: true },
        }),
      ]);

      if (!user) {
        return { error: NextResponse.json({ message: "找不到使用者。" }, { status: 404 }) };
      }

      const targetAddress = user.bscAddress?.trim();
      if (!targetAddress) {
        return { error: NextResponse.json({ message: "此功能目前未開放。" }, { status: 422 }) };
      }

      if (!user.isAddressVerified) {
        return { error: NextResponse.json({ message: "此功能目前未開放。" }, { status: 422 }) };
      }

      if (pendingOrder) {
        return {
          error: NextResponse.json(
            { message: "你目前已有待處理的提領申請。" },
            { status: 409 }
          ),
        };
      }

      if (toNumber(user.walletBalance) < amount) {
        return { error: NextResponse.json({ message: "此功能目前未開放。" }, { status: 422 }) };
      }

      const created = await tx.tokenTransaction.create({
        data: {
          userId: activeUser.id,
          type: "WITHDRAW",
          status: "PENDING",
          amount,
          targetAddress,
          metadata: {
            chain: WITHDRAW_CHAIN,
            requestSource: "customer_portal",
          },
        },
        select: {
          id: true,
          amount: true,
          status: true,
          targetAddress: true,
          createdAt: true,
        },
      });

      return { created };
    });

    if (result.error) {
      return result.error;
    }

    const { created } = result;

    return NextResponse.json(
      {
        ...created,
        amount: toNumber(created.amount),
      },
      { status: 201 }
    );
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "請先登入。" }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "帳號已被停用。" }, { status: 403 });
    }

    console.error("POST /api/customer/withdrawals error", error);
    return NextResponse.json({ message: "建立提領申請失敗。" }, { status: 500 });
  }
}
