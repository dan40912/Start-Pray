import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction } from "@/lib/logger";
import { getThreadsPublishSettings } from "@/lib/siteSettings";
import { buildThreadsPostText, publishThreadsText } from "@/lib/threads-publishing";
import prisma from "@/lib/prisma";

const MAX_POST_LENGTH = 500;

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export async function POST(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const cardId = parseId(params?.id);
  if (!cardId) return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid request body" }, { status: 400 });
  }

  const action = body?.action === "skip" ? "skip" : body?.action === "recover" ? "recover" : "publish";
  if (body?.action && !["publish", "skip", "recover"].includes(body.action)) {
    return NextResponse.json({ message: "Invalid Threads action" }, { status: 400 });
  }
  const share = await prisma.prayerThreadsShare.findUnique({
    where: { cardId },
    include: { card: { select: { id: true, isPrivate: true, isBlocked: true, needsReview: true } } },
  });
  if (!share) return NextResponse.json({ message: "此代禱沒有提交 Threads 分享同意。" }, { status: 404 });

  if (action === "recover") {
    const staleBefore = new Date(Date.now() - 3 * 60 * 1000);
    if (share.status !== "PUBLISHING" || !share.lastAttemptAt || share.lastAttemptAt >= staleBefore) {
      return NextResponse.json({ message: "目前沒有逾時的 Threads 發布工作。" }, { status: 409 });
    }
    const changed = await prisma.prayerThreadsShare.updateMany({
      where: { id: share.id, status: "PUBLISHING", lastAttemptAt: { lt: staleBefore } },
      data: {
        status: "FAILED",
        lastError: "發布工作已逾時。請先確認官方 Threads 是否已出現貼文，再決定是否重試，以免重複發布。",
      },
    });
    if (!changed.count) return NextResponse.json({ message: "分享狀態已變更，請重新載入。" }, { status: 409 });
    return NextResponse.json({
      status: "FAILED",
      lastError: "發布工作已逾時。請先確認官方 Threads 是否已出現貼文，再決定是否重試，以免重複發布。",
    });
  }

  if (action === "skip") {
    if (!["PENDING", "FAILED"].includes(share.status)) {
      return NextResponse.json({ message: "目前狀態不能略過。" }, { status: 409 });
    }
    const changed = await prisma.prayerThreadsShare.updateMany({
      where: { id: share.id, status: { in: ["PENDING", "FAILED"] } },
      data: { status: "SKIPPED", lastError: null },
    });
    if (!changed.count) return NextResponse.json({ message: "分享狀態已變更，請重新載入。" }, { status: 409 });
    await logAdminAction({
      action: "threads.share.skip",
      message: `管理員略過代禱卡 ${cardId} 的 Threads 分享`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "HomePrayerCard",
      targetId: String(cardId),
      requestPath: request.url,
    });
    return NextResponse.json({ status: "SKIPPED" });
  }

  if (share.card.isPrivate || share.card.isBlocked) {
    return NextResponse.json({ message: "私密或已封鎖的代禱不能發布到 Threads。" }, { status: 409 });
  }
  if (share.card.needsReview) {
    return NextResponse.json({ message: "請先完成代禱內容審核，再發布到 Threads。" }, { status: 409 });
  }
  if (share.status === "PUBLISHED") {
    return NextResponse.json({ message: "這則代禱已發布到 Threads。", status: share.status, permalink: share.permalink }, { status: 409 });
  }

  let threadsSettings;
  try {
    threadsSettings = await getThreadsPublishSettings();
  } catch (settingsError) {
    return NextResponse.json(
      { message: settingsError.message || "Threads 設定尚未完成。" },
      { status: settingsError.status || 503 }
    );
  }

  const requestedText = typeof body?.text === "string" ? body.text.trim() : "";
  const postText = requestedText || share.postText || buildThreadsPostText(cardId);
  if (!postText || postText.length > MAX_POST_LENGTH) {
    return NextResponse.json({ message: `貼文內容需介於 1 到 ${MAX_POST_LENGTH} 個字元。` }, { status: 422 });
  }

  const claim = await prisma.prayerThreadsShare.updateMany({
    where: { id: share.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "PUBLISHING",
      postText,
      attempts: { increment: 1 },
      lastAttemptAt: new Date(),
      lastError: null,
    },
  });
  if (!claim.count) return NextResponse.json({ message: "這則 Threads 分享正在處理或已完成。" }, { status: 409 });

  try {
    const result = await publishThreadsText(postText, { settings: threadsSettings });
    await prisma.prayerThreadsShare.update({
      where: { id: share.id },
      data: {
        status: "PUBLISHED",
        threadsPostId: result.postId,
        permalink: result.permalink,
        publishedAt: new Date(),
        publishedByAdminId: session.adminId,
        lastError: null,
      },
    });
    await logAdminAction({
      action: "threads.share.publish",
      message: `管理員將代禱卡 ${cardId} 發布到 Threads`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "HomePrayerCard",
      targetId: String(cardId),
      requestPath: request.url,
      metadata: { threadsPostId: result.postId },
    });
    return NextResponse.json({ status: "PUBLISHED", ...result });
  } catch (publishError) {
    const message = String(publishError?.message || "Threads 發布失敗").slice(0, 1000);
    await prisma.prayerThreadsShare.update({
      where: { id: share.id },
      data: { status: "FAILED", lastError: message },
    });
    await logAdminAction({
      action: "threads.share.publish.failed",
      message: `管理員發布代禱卡 ${cardId} 到 Threads 失敗`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "HomePrayerCard",
      targetId: String(cardId),
      requestPath: request.url,
      metadata: { error: message },
    });
    return NextResponse.json({ message, status: "FAILED" }, { status: publishError?.status || 502 });
  }
}
