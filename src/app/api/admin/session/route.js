import { NextResponse } from "next/server";
import { clearAdminSessionCookie } from "@/lib/admin-session";
import { requireAdmin } from "@/lib/admin-route-auth";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const { error, session } = await requireAdmin(request);
  if (error) {
    if (error.status === 401) clearAdminSessionCookie(error);
    return error;
  }
  return NextResponse.json({ authenticated: true, user: {
    id: session.adminId, username: session.username, role: session.role,
  } }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function DELETE(request) {
  const { error, session } = await requireAdmin(request);
  if (error && error.status !== 401) return error;
  if (session) {
    try {
      // Sign out all sessions for this administrator, including copied cookies.
      await prisma.adminAccount.updateMany({
        where: { id: session.adminId, sessionVersion: session.sessionVersion ?? 0 },
        data: { sessionVersion: { increment: 1 } },
      });
    } catch {
      return NextResponse.json({ message: "登出未完成，請重試" }, { status: 503 });
    }
  }
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "private, no-store" } });
  clearAdminSessionCookie(response);
  return response;
}
