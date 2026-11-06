import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { logAdminAction } from "@/lib/logger";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const SUPER_ONLY = roleSet("SUPER");
const ALLOWED_ROLES = new Set(["SUPER", "ADMIN"]);
const MIN_PASSWORD_LENGTH = 8;

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  const { id } = params;
  if (!id) {
    return NextResponse.json({ message: "Missing id" }, { status: 400 });
  }

  try {
    const body = await request.json();
    const updateData = {};
    const metadata = {};

    const updated = await prisma.$transaction(async (tx) => {
    const existing = await tx.adminAccount.findUnique({ where: { id } });
    if (!existing) {
      return NextResponse.json({ message: "帳號不存在" }, { status: 404 });
    }

    if (typeof body.isActive === "boolean") {
      if (!body.isActive && existing.role === "SUPER") {
        const otherSuper = await tx.adminAccount.count({
          where: {
            role: "SUPER",
            isActive: true,
            NOT: { id },
          },
        });
        if (otherSuper === 0) {
          return NextResponse.json({ message: "至少需要一位啟用的超級管理員" }, { status: 400 });
        }
      }
      updateData.isActive = body.isActive;
      metadata.isActive = body.isActive;
    }

    if (body.role && ALLOWED_ROLES.has(body.role)) {
      if (existing.role === "SUPER" && body.role !== "SUPER") {
        const otherSuper = await tx.adminAccount.count({
          where: {
            role: "SUPER",
            isActive: true,
            NOT: { id },
          },
        });
        if (otherSuper === 0) {
          return NextResponse.json({ message: "至少需要一位啟用的超級管理員" }, { status: 400 });
        }
      }
      updateData.role = body.role;
      metadata.role = body.role;
    }

    if (body.password !== undefined && body.password !== null && body.password !== "") {
      if (typeof body.password !== "string" || body.password.length < MIN_PASSWORD_LENGTH) {
        return NextResponse.json(
          { message: `管理員密碼至少需要 ${MIN_PASSWORD_LENGTH} 個字元` },
          { status: 400 }
        );
      }
      updateData.passwordHash = await bcrypt.hash(body.password, 12);
      metadata.passwordReset = true;
    }

    // Clears the admin's personal 2FA (lost phone, staff change). The account
    // then falls back to the shared ADMIN_TOTP_SECRET until it enrolls again.
    if (body.resetTotp === true) {
      updateData.totpSecret = null;
      updateData.totpEnabledAt = null;
      updateData.totpLastUsedStep = null;
      metadata.totpReset = true;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "沒有可更新的欄位" }, { status: 400 });
    }

    updateData.sessionVersion = { increment: 1 };
    const updated = await tx.adminAccount.update({
      where: { id },
      data: updateData,
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
      action: "admin.update",
      message: `更新管理員 ${updated.username}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "AdminAccount",
      targetId: updated.id,
      metadata,
      requestPath: "/api/admin/accounts/[id]",
      transaction: tx,
      required: true,
    });

    return updated;
    }, { isolationLevel: "Serializable" });
    if (updated instanceof NextResponse) return updated;
    return NextResponse.json(updated);
  } catch (error) {
    if (error?.code === "P2034") return NextResponse.json({ message: "管理員資料已變更，請重新整理後再試" }, { status: 409 });
    console.error("❌ PATCH /api/admin/accounts/[id] error:", error);
    return NextResponse.json({ message: "更新管理員失敗" }, { status: 500 });
  }
}
