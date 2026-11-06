import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin-route-auth";
import { AdminBlockError, setUserBlocked } from "@/lib/admin-user-block";
import prisma from "@/lib/prisma";

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;
  try {
    const input = await request.json().catch(() => null);
    const result = await setUserBlocked(prisma, session, params.id, input);
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof AdminBlockError ? error.status : 500;
    return NextResponse.json({ message: status === 500 ? "操作未完成，請重新整理確認狀態後重試" : error.message }, { status });
  }
}
