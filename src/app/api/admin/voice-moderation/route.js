// PRD-001 — 語音待審佇列 admin API
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-route-auth";
import { resolveServerAudioUrl } from "@/lib/server-audio";

const VOICE_SELECT = {
  id: true,
  message: true,
  voiceUrl: true,
  voiceModerationStatus: true,
  voiceAutoFlags: true,
  createdAt: true,
  responder: { select: { id: true, name: true, email: true, username: true } },
  homeCard: { select: { id: true, title: true } },
};

export async function GET(request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(parseInt(searchParams.get("page") || "1", 10), 1);
    const limit = Math.min(Math.max(parseInt(searchParams.get("limit") || "20", 10), 1), 100);
    const skip = (page - 1) * limit;

    const where = { voiceModerationStatus: "PENDING", voiceUrl: { not: null } };

    const [responses, total] = await Promise.all([
      prisma.prayerResponse.findMany({
        where,
        select: VOICE_SELECT,
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.prayerResponse.count({ where }),
    ]);

    return NextResponse.json({
      data: responses.map((response) => ({
        ...response,
        voiceUrl: resolveServerAudioUrl(response.voiceUrl),
        voiceAutoFlags: response.voiceAutoFlags ? JSON.parse(response.voiceAutoFlags) : [],
      })),
      pagination: { total, page, limit, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    console.error("GET /api/admin/voice-moderation error:", err);
    return NextResponse.json({ message: "無法取得語音待審列表" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { error, session } = requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const id = String(body?.id || "");
    const action = String(body?.action || "").toUpperCase();
    const remarks = typeof body?.remarks === "string" ? body.remarks.slice(0, 500) : null;

    if (!id || (action !== "APPROVE" && action !== "REJECT")) {
      return NextResponse.json({ message: "參數錯誤" }, { status: 400 });
    }

    const existing = await prisma.prayerResponse.findUnique({
      where: { id },
      select: { id: true, voiceUrl: true },
    });
    if (!existing || !existing.voiceUrl) {
      return NextResponse.json({ message: "找不到語音回應" }, { status: 404 });
    }

    const nextStatus = action === "APPROVE" ? "APPROVED" : "REJECTED";
    const adminId = session?.id ?? session?.sub ?? null;

    const updated = await prisma.prayerResponse.update({
      where: { id },
      data: {
        voiceModerationStatus: nextStatus,
        voiceModeratedAt: new Date(),
        voiceModeratedBy: adminId,
      },
      select: { id: true, voiceModerationStatus: true },
    });

    await prisma.adminLog.create({
      data: {
        category: "ACTION",
        level: "INFO",
        message: `語音回應 ${id} 審核為 ${nextStatus}${remarks ? `（${remarks}）` : ""}`,
        action: `voice-moderation:${action.toLowerCase()}`,
        actorId: adminId,
        actorEmail: session?.email ?? null,
        targetType: "PrayerResponse",
        targetId: id,
        requestPath: "/api/admin/voice-moderation",
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    console.error("PATCH /api/admin/voice-moderation error:", err);
    return NextResponse.json({ message: "審核操作失敗" }, { status: 500 });
  }
}
