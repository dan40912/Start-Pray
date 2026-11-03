import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAdminAction } from "@/lib/logger";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const SUPER_ONLY = roleSet("SUPER");
const ALLOWED_ROLES = new Set(["SUPER", "ADMIN"]);
const MIN_PASSWORD_LENGTH = 8;

function sanitizeUsername(username) {
  return username?.trim().toLowerCase();
}

export async function GET(request) {
  const { error } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  try {
    const accounts = await prisma.adminAccount.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        totpEnabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json(accounts);
  } catch (error) {
    console.error("❌ GET /api/admin/accounts error:", error);
    return NextResponse.json({ message: "無法取得管理員帳號" }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, session } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  try {
    const body = await request.json();
    const username = sanitizeUsername(body.username);
    const password = body.password ?? "";
    const role = body.role ?? "ADMIN";

    if (!username || !password) {
      return NextResponse.json({ message: "請填寫帳號與密碼" }, { status: 400 });
    }

    if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
      return NextResponse.json(
        { message: `管理員密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元` },
        { status: 400 }
      );
    }

    if (!ALLOWED_ROLES.has(role)) {
      return NextResponse.json({ message: "不支援的角色" }, { status: 400 });
    }

    const existing = await prisma.adminAccount.findUnique({ where: { username } });
    if (existing) {
      return NextResponse.json({ message: "帳號已存在" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const account = await prisma.adminAccount.create({
      data: {
        username,
        passwordHash,
        role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        lastLoginAt: true,
        totpEnabledAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await logAdminAction({
      action: "admin.create",
      message: `新增管理員 ${account.username}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "AdminAccount",
      targetId: account.id,
      metadata: { role: account.role },
      requestPath: request.url,
    });

    return NextResponse.json(account, { status: 201 });
  } catch (error) {
    console.error("❌ POST /api/admin/accounts error:", error);
    return NextResponse.json({ message: "新增管理員失敗" }, { status: 500 });
  }
}
