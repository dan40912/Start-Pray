import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { logSystemError } from "@/lib/logger";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const SUPER_ONLY = roleSet("SUPER");

const VALID_TYPES = new Set(["EARN_PRAYER", "EARN_RESPONSE", "ADMIN_GRANT", "WITHDRAW", "DONATE"]);
const VALID_STATUS = new Set(["PENDING", "PROCESSING_CHAIN", "COMPLETED", "FAILED"]);
const SORTABLE_FIELDS = {
  createdAt: { createdAt: "desc" },
  amount: { amount: "desc" },
};

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;

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

function clampPage(value) {
  const numeric = Number.parseInt(value ?? "1", 10);
  return Number.isNaN(numeric) || numeric < 1 ? 1 : numeric;
}

function clampLimit(value) {
  const numeric = Number.parseInt(value ?? `${DEFAULT_LIMIT}`, 10);
  if (Number.isNaN(numeric) || numeric < 1) return DEFAULT_LIMIT;
  return Math.min(numeric, MAX_LIMIT);
}

function getOrder(sortKey, orderParam) {
  const base = SORTABLE_FIELDS[sortKey] ?? SORTABLE_FIELDS.createdAt;
  const field = Object.keys(base)[0];
  const direction = orderParam === "asc" ? "asc" : "desc";
  return { [field]: direction };
}

export async function GET(request) {
  const { error } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  const url = new URL(request.url);
  const { searchParams } = url;
  const page = clampPage(searchParams.get("page"));
  const limit = clampLimit(searchParams.get("limit"));
  const skip = (page - 1) * limit;
  const typeParam = searchParams.get("type");
  const statusParam = searchParams.get("status");
  const search = (searchParams.get("search") ?? "").trim();
  const includeSummary = searchParams.get("includeSummary") === "true";
  const sort = searchParams.get("sort") ?? "createdAt";
  const orderParam = searchParams.get("order") ?? "desc";

  const whereClauses = [];

  if (typeParam && VALID_TYPES.has(typeParam)) {
    whereClauses.push({ type: typeParam });
  }

  if (statusParam && VALID_STATUS.has(statusParam)) {
    whereClauses.push({ status: statusParam });
  }

  if (search) {
    whereClauses.push({
      OR: [
        { txHash: { contains: search } },
        { targetAddress: { contains: search } },
        { user: { email: { contains: search } } },
        { user: { name: { contains: search } } },
        { userId: { contains: search } },
      ],
    });
  }

  const where = whereClauses.length ? { AND: whereClauses } : {};

  try {
    const orderBy = getOrder(sort, orderParam);

    const [records, total] = await Promise.all([
      prisma.tokenTransaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              bscAddress: true,
              isAddressVerified: true,
            },
          },
          relatedHomeCard: {
            select: { id: true, title: true, slug: true, categoryId: true },
          },
          relatedResponse: {
            select: { id: true, message: true, homeCardId: true },
          },
        },
      }),
      prisma.tokenTransaction.count({ where }),
    ]);

    let summary = null;

    if (includeSummary) {
      const [statusCounts, typeSums, walletAggregate, pendingWithdraw] = await Promise.all([
        prisma.tokenTransaction.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
        prisma.tokenTransaction.groupBy({
          by: ["type"],
          _sum: { amount: true },
        }),
        prisma.user.aggregate({
          _sum: { walletBalance: true },
        }),
        prisma.tokenTransaction.aggregate({
          where: { type: "WITHDRAW", status: "PENDING" },
          _sum: { amount: true },
          _count: { _all: true },
        }),
      ]);

      summary = {
        total:
          typeSums.reduce((acc, item) => acc + toNumber(item._sum.amount), 0) || 0,
        status: statusCounts.reduce((acc, item) => {
          acc[item.status.toLowerCase()] = item._count._all;
          return acc;
        }, {}),
        totalsByType: typeSums.reduce((acc, item) => {
          acc[item.type.toLowerCase()] = toNumber(item._sum.amount);
          return acc;
        }, {}),
        walletBalanceTotal: toNumber(walletAggregate._sum.walletBalance),
        pendingWithdraw: {
          count: pendingWithdraw._count._all ?? 0,
          amount: toNumber(pendingWithdraw._sum.amount),
        },
      };
    }

    const data = records.map((entry) => ({
      ...entry,
      amount: toNumber(entry.amount),
      gasFee: entry.gasFee !== null ? toNumber(entry.gasFee) : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    }));

    return NextResponse.json({
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      summary,
    });
  } catch (error) {
    await logSystemError({
      message: "無法取得交易資料",
      error,
      requestPath: request.url,
      metadata: { query: Object.fromEntries(searchParams.entries()) },
    });

    console.error("❌ GET /api/admin/transactions error:", error);
    return NextResponse.json({ message: "無法取得交易資料" }, { status: 500 });
  }
}
