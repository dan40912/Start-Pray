import { NextResponse } from "next/server";

import { requireAdmin, roleSet } from "@/lib/admin-route-auth";
import prisma from "@/lib/prisma";

const SUPER_ONLY = roleSet("SUPER");
const ALLOWED_CATEGORIES = new Set(["ACTION", "SYSTEM"]);
const ALLOWED_LEVELS = new Set(["INFO", "WARNING", "ERROR", "CRITICAL"]);

function normalizeEnumParam(value, allowedValues) {
  const normalized = String(value || "").trim().toUpperCase();
  return allowedValues.has(normalized) ? normalized : null;
}

function parsePositiveInt(value, fallback, max) {
  const parsed = Number.parseInt(value || "", 10);
  const nextValue = Number.isNaN(parsed) ? fallback : parsed;
  return Math.min(Math.max(nextValue, 1), max);
}

export async function GET(request) {
  const { error } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = parsePositiveInt(searchParams.get("page"), 1, 10000);
    const limit = parsePositiveInt(searchParams.get("limit"), 20, 100);
    const skip = (page - 1) * limit;
    const category = normalizeEnumParam(searchParams.get("category"), ALLOWED_CATEGORIES);
    const level = normalizeEnumParam(searchParams.get("level"), ALLOWED_LEVELS);
    const search = searchParams.get("search")?.trim();

    const where = {
      AND: [
        category ? { category } : {},
        level ? { level } : {},
        search
          ? {
              OR: [
                { message: { contains: search } },
                { action: { contains: search } },
                { actorId: { contains: search } },
                { actorEmail: { contains: search } },
                { targetType: { contains: search } },
                { targetId: { contains: search } },
                { requestPath: { contains: search } },
              ],
            }
          : {},
      ],
    };

    const [logs, total, systemCount, actionCount] = await Promise.all([
      prisma.adminLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      prisma.adminLog.count({ where }),
      prisma.adminLog.count({ where: { category: "SYSTEM" } }),
      prisma.adminLog.count({ where: { category: "ACTION" } }),
    ]);

    return NextResponse.json({
      data: logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.max(Math.ceil(total / limit), 1),
      },
      summary: {
        total,
        system: systemCount,
        action: actionCount,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/logs error:", error);
    return NextResponse.json({ message: "無法載入管理紀錄" }, { status: 500 });
  }
}
