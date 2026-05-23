import path from "path";
import { writeFile } from "node:fs/promises";

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureActiveCustomer } from "@/lib/customer-access";
import {
  buildMediaPublicUrl,
  ensureMediaWriteDirectory,
} from "@/lib/server-media-storage";
import { requireSessionUser } from "@/lib/server-session";
import { computeRewardEligibleAt, readTokenRewardRule } from "@/lib/tokenRewards";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH_WITHOUT_AUDIO = 8;
const RECENT_WINDOW_MINUTES = 10;
const SAME_CARD_COOLDOWN_MINUTES = 2;
const MAX_RECENT_RESPONSES = 8;
const SAME_CARD_COOLDOWN_SECONDS = SAME_CARD_COOLDOWN_MINUTES * 60;
const ALLOWED_AUDIO_MIME_TYPES = new Set([
  "audio/webm",
  "audio/mpeg",
  "audio/mp3",
  "audio/mp4",
  "audio/m4a",
  "audio/aac",
  "audio/ogg",
  "audio/wav",
  "audio/x-m4a",
]);
const ALLOWED_AUDIO_EXTENSIONS = new Set([".webm", ".mp3", ".mp4", ".m4a", ".aac", ".ogg", ".wav"]);

function resolveVoiceFolder(requestId) {
  const normalized = typeof requestId === "string" ? requestId.trim() : "";
  return /^\d+$/.test(normalized) ? normalized : "misc";
}

function sanitizeFileName(input) {
  const base = path.basename(input ?? "").replace(/[^\w.-]+/g, "-");
  return base || "voice.webm";
}

function normalizeMessage(value) {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, MAX_MESSAGE_LENGTH);
}

function isAllowedAudioFile(file) {
  if (!file?.name) return false;
  const mimeType = String(file.type || "").toLowerCase();
  const extension = path.extname(file.name).toLowerCase();
  return ALLOWED_AUDIO_MIME_TYPES.has(mimeType) || ALLOWED_AUDIO_EXTENSIONS.has(extension);
}

export async function POST(req) {
  try {
    const session = requireSessionUser();
    await ensureActiveCustomer(session);

    const form = await req.formData();
    const requestId = form.get("requestId");
    const message = normalizeMessage(form.get("message"));
    const isAnonymous = form.get("isAnonymous") === "true";
    const audio = form.get("audio");

    const hasAudio = Boolean(audio && audio.name);
    if (!message && !hasAudio) {
      return NextResponse.json(
        { error: "請寫下一句代禱，或上傳一段語音後再送出。" },
        { status: 422 }
      );
    }

    if (!hasAudio && message.length < MIN_MESSAGE_LENGTH_WITHOUT_AUDIO) {
      return NextResponse.json(
        {
          error: `文字回應至少需要 ${MIN_MESSAGE_LENGTH_WITHOUT_AUDIO} 個字。若不知道怎麼開始，可以先寫一句簡短的祝福。`,
        },
        { status: 422 }
      );
    }

    const homeCardId = Number(requestId);
    if (!Number.isInteger(homeCardId)) {
      return NextResponse.json({ error: "Invalid requestId" }, { status: 400 });
    }

    const homeCard = await prisma.homePrayerCard.findUnique({
      where: { id: homeCardId },
      select: {
        id: true,
        ownerId: true,
        isBlocked: true,
        isPrivate: true,
      },
    });

    if (!homeCard || homeCard.isBlocked || homeCard.isPrivate) {
      return NextResponse.json(
        { error: "這則代禱目前無法公開回應，可能已被移除、隱藏或進入審核。" },
        { status: 404 }
      );
    }

    const now = new Date();
    const recentStart = new Date(
      now.getTime() - RECENT_WINDOW_MINUTES * 60 * 1000
    );
    const sameCardCooldownStart = new Date(
      now.getTime() - SAME_CARD_COOLDOWN_MINUTES * 60 * 1000
    );

    const [recentResponsesCount, sameCardRecentCount] = await Promise.all([
      prisma.prayerResponse.count({
        where: {
          responderId: session.userId,
          createdAt: { gte: recentStart },
        },
      }),
      prisma.prayerResponse.count({
        where: {
          responderId: session.userId,
          homeCardId,
          createdAt: { gte: sameCardCooldownStart },
        },
      }),
    ]);

    if (recentResponsesCount >= MAX_RECENT_RESPONSES) {
      return NextResponse.json(
        { error: "短時間內送出的回應較多，請稍後再試。" },
        { status: 429 }
      );
    }

    if (sameCardRecentCount > 0) {
      return NextResponse.json(
        {
          error: "你剛剛已經回應過這則代禱，請約 2 分鐘後再送出下一則。",
          retryAfterSeconds: SAME_CARD_COOLDOWN_SECONDS,
        },
        {
          status: 429,
          headers: { "Retry-After": String(SAME_CARD_COOLDOWN_SECONDS) },
        }
      );
    }

    let voiceUrl = null;
    if (hasAudio) {
      if (Number(audio.size) > MAX_AUDIO_BYTES) {
        return NextResponse.json(
          { error: "語音檔太大，請改用 12MB 以下的檔案，或錄短一點再試一次。" },
          { status: 422 }
        );
      }

      if (!isAllowedAudioFile(audio)) {
        return NextResponse.json(
          { error: "目前只接受常見音訊格式，例如 webm、mp3、m4a、aac、ogg 或 wav。" },
          { status: 422 }
        );
      }

      const bytes = Buffer.from(await audio.arrayBuffer());
      const folderName = resolveVoiceFolder(requestId);
      const sanitizedOriginal = sanitizeFileName(audio.name);
      const filename = `${Date.now()}-${sanitizedOriginal}`;
      const folderPath = await ensureMediaWriteDirectory("voices", [folderName]);
      const filePath = path.join(folderPath, filename);

      await writeFile(filePath, bytes);
      voiceUrl = buildMediaPublicUrl("voices", [folderName, filename]);
    }

    const rewardRule = await readTokenRewardRule();
    const isSelfResponse =
      Boolean(homeCard.ownerId) && homeCard.ownerId === session.userId;
    const rewardEligibleAt = isSelfResponse
      ? null
      : computeRewardEligibleAt(rewardRule.observationDays, now);

    const response = await prisma.prayerResponse.create({
      data: {
        message,
        voiceUrl,
        isAnonymous,
        rewardStatus: isSelfResponse ? "BLOCKED" : "PENDING",
        rewardEligibleAt,
        rewardEvaluatedAt: isSelfResponse ? now : null,
        isSettled: isSelfResponse,
        responder: { connect: { id: session.userId } },
        homeCard: { connect: { id: homeCardId } },
      },
      include: {
        responder: {
          select: {
            name: true,
            avatarUrl: true,
            username: true,
            publicProfileEnabled: true,
            isBlocked: true,
          },
        },
      },
    });

    return NextResponse.json(response, { status: 201 });
  } catch (err) {
    if (err?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ error: "請先登入，才能留下文字或語音代禱。", code: "LOGIN_REQUIRED" }, { status: 401 });
    }
    if (err?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json(
        { error: "這個帳號目前無法送出回應，若你認為有誤，請聯絡管理員。" },
        { status: 403 }
      );
    }
    if (err?.code === "MEDIA_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: "語音儲存服務尚未設定完成。文字回應仍可送出，語音請稍後再試。" },
        { status: 503 }
      );
    }

    console.error("Failed to create response:", err);
    return NextResponse.json(
      { error: "回應暫時無法送出，請稍後再試一次。" },
      { status: 500 }
    );
  }
}
