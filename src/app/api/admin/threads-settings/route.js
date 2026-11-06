import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction } from "@/lib/logger";
import { readThreadsAdminSettings, saveThreadsAdminSettings } from "@/lib/siteSettings";

export async function GET(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    return NextResponse.json(await readThreadsAdminSettings(), {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (loadError) {
    console.error("GET /api/admin/threads-settings error:", loadError);
    return NextResponse.json({ message: "無法載入 Threads 設定" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const payload = await request.json().catch(() => null);
  if (!payload || typeof payload.enabled !== "boolean") {
    return NextResponse.json({ message: "請提供 Threads 開關狀態。" }, { status: 400 });
  }

  const userId = payload.userId;
  const accessToken = payload.accessToken;
  const graphApiVersion = payload.graphApiVersion;
  const clearAccessToken = payload.clearAccessToken === true;
  if (typeof userId !== "string" || userId.trim().length > 191) {
    return NextResponse.json({ message: "Threads 帳號 ID 格式不正確。" }, { status: 400 });
  }
  if (accessToken !== undefined && (typeof accessToken !== "string" || accessToken.length > 8192)) {
    return NextResponse.json({ message: "Access Token 格式不正確。" }, { status: 400 });
  }
  if (clearAccessToken && typeof accessToken === "string" && accessToken.trim()) {
    return NextResponse.json({ message: "清除 Token 時請不要同時填入新 Token。" }, { status: 400 });
  }
  if (
    typeof graphApiVersion !== "string" ||
    graphApiVersion.trim().length > 32 ||
    !/^v\d+\.\d+$/.test(graphApiVersion.trim())
  ) {
    return NextResponse.json({ message: "Graph API 版本請使用例如 v1.0 的格式。" }, { status: 400 });
  }

  try {
    const updated = await saveThreadsAdminSettings({
      enabled: payload.enabled,
      userId,
      accessToken: typeof accessToken === "string" ? accessToken : "",
      clearAccessToken,
      graphApiVersion,
      updatedBy: session.username,
    });
    await logAdminAction({
      action: updated.enabled ? "threads.settings.enable" : "threads.settings.update",
      message: updated.enabled ? "啟用 Threads 發布功能" : "更新 Threads 發布設定",
      actorId: session.adminId,
      actorEmail: session.username,
      requestPath: request.url,
      metadata: {
        enabled: updated.enabled,
        userId: updated.userId,
        graphApiVersion: updated.graphApiVersion,
        accessTokenConfigured: updated.accessTokenConfigured,
      },
    });
    return NextResponse.json(updated, {
      headers: { "Cache-Control": "private, no-store" },
    });
  } catch (saveError) {
    if (Number.isInteger(saveError?.status)) {
      return NextResponse.json({ message: saveError.message }, { status: saveError.status });
    }
    console.error("PATCH /api/admin/threads-settings error:", saveError);
    return NextResponse.json({ message: "儲存 Threads 設定失敗" }, { status: 500 });
  }
}
