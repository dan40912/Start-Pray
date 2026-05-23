import { NextResponse } from "next/server";

import {
  clearAdminSessionCookie,
  readAdminSessionFromRequest,
} from "@/lib/admin-session";
import prisma from "@/lib/prisma";

export async function GET(request) {
  const session = readAdminSessionFromRequest(request);
  if (!session) {
    return NextResponse.json({ authenticated: false }, { status: 401 });
  }

  const account = await prisma.adminAccount.findUnique({
    where: { id: session.adminId },
    select: {
      id: true,
      username: true,
      role: true,
      isActive: true,
    },
  });

  if (!account?.isActive) {
    const response = NextResponse.json({ authenticated: false }, { status: 401 });
    clearAdminSessionCookie(response);
    return response;
  }

  return NextResponse.json({
    authenticated: true,
    user: {
      id: account.id,
      username: account.username,
      role: account.role,
    },
  });
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  clearAdminSessionCookie(response);
  return response;
}
