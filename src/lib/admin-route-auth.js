import { NextResponse } from "next/server";

import { readAdminSessionFromRequest } from "@/lib/admin-session";
import prisma from "@/lib/prisma";

const DEFAULT_ROLES = new Set(["SUPER", "ADMIN"]);

// A signed token proves who signed in, not whether access is still allowed.
export async function requireAdmin(request, roles = DEFAULT_ROLES) {
  const token = readAdminSessionFromRequest(request);
  const reject = (status, message) => ({
    error: NextResponse.json(
      { message },
      { status, headers: { "Cache-Control": "private, no-store" } }
    ),
    session: null,
  });
  if (!token) return reject(401, "Unauthorized");
  try {
    const account = await prisma.adminAccount.findUnique({
      where: { id: token.adminId },
      select: { id: true, username: true, role: true, isActive: true, sessionVersion: true },
    });
    if (!account?.isActive || (token.sessionVersion ?? 0) !== account.sessionVersion) {
      return reject(401, "登入已失效，請重新登入");
    }
    if (roles && !roles.has(account.role)) return reject(403, "Forbidden");
    return { error: null, session: { ...token, username: account.username, role: account.role } };
  } catch {
    // Database failures must never fall back to the role stored in the cookie.
    return reject(503, "暫時無法確認管理權限，請稍後再試");
  }
}

export function roleSet(...roles) {
  return new Set(roles);
}
