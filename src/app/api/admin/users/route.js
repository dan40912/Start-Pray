import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logSystemError } from "@/lib/logger";
import { requireAdmin } from "@/lib/admin-route-auth";

const ALLOWED_SORT_FIELDS = {
  createdAt: "createdAt",
  updatedAt: "updatedAt",
  reportCount: "reportCount",
  walletBalance: "walletBalance",
  name: "name",
};

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

export async function GET(request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status"); // all | active | blocked
    const sortKey = searchParams.get("sort") ?? "createdAt";
    const orderParam = searchParams.get("order")?.toLowerCase() === "asc" ? "asc" : "desc";
    const includeSummary = searchParams.get("includeSummary") === "true";

    const page = Math.max(parseInt(searchParams.get("page") ?? "1", 10), 1);
    const rawLimit = parseInt(searchParams.get("limit") ?? "25", 10);
    const limit = Math.min(Math.max(Number.isNaN(rawLimit) ? 25 : rawLimit, 1), 100);
    const skip = (page - 1) * limit;

    const where = {
      AND: [
        search
          ? {
              OR: [
                { name: { contains: search } },
                { email: { contains: search } },
              ],
            }
          : {},
        status === "blocked"
          ? { isBlocked: true }
          : status === "active"
          ? { isBlocked: false }
          : {},
      ],
    };

    const orderByField = ALLOWED_SORT_FIELDS[sortKey] ?? "createdAt";

    const [rawUsers, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { [orderByField]: orderParam },
        skip,
        take: limit,
        select: {
          id: true,
          email: true,
          name: true,
          createdAt: true,
          updatedAt: true,
          isBlocked: true,
          reportCount: true,
          walletBalance: true,
          // PRD-005 added these two and nothing ever read them back, so the
          // anti-abuse score existed only in the database.
          trustScore: true,
          flaggedCount: true,
        },
      }),
      prisma.user.count({ where }),
    ]);

    const users = rawUsers.map((user) => ({
      ...user,
      walletBalance: toNumber(user.walletBalance),
    }));

    let summary;
    if (includeSummary) {
      const [totalUsers, blockedUsers, walletAggregate] = await Promise.all([
        prisma.user.count(),
        prisma.user.count({ where: { isBlocked: true } }),
        prisma.user.aggregate({
          _sum: { walletBalance: true },
        }),
      ]);

      const walletSumDecimal = walletAggregate._sum.walletBalance;
      const walletBalanceSum = toNumber(walletSumDecimal);

      summary = {
        totalUsers,
        blockedUsers,
        walletBalanceSum,
        averageWalletBalance: totalUsers > 0 ? walletBalanceSum / totalUsers : 0,
      };
    }

    return NextResponse.json({
      data: users,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      summary,
    });
  } catch (err) {
    await logSystemError({
      message: "取得使用者列表失敗",
      error: err,
      requestPath: request.url,
      metadata: { query: Object.fromEntries(new URL(request.url).searchParams.entries()) },
    });

    console.error("/api/admin/users 發生錯誤:", err);
    return NextResponse.json(
      { message: "無法取得使用者列表", error: err.message },
      { status: 500 }
    );
  }
}
