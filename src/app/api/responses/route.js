import path from "path";
import { writeFile } from "node:fs/promises";

import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { ensureActiveCustomer } from "@/lib/customer-access";
import {
  buildMediaPublicUrl,
  ensureMediaWriteDirectory,
} from "@/lib/server-media-storage";
import { computeRewardEligibleAt, readTokenRewardRule } from "@/lib/tokenRewards";
import { evaluateVoiceUpload, serializeVoiceFlags } from "@/lib/voiceModeration";
import { assertStorageWritable } from "@/lib/storage";
import { readSessionUser } from "@/lib/server-session";
import { toPublicPrayerResponse } from "@/lib/anonymous-prayer-avatar";
import {
  GUEST_RESPONSE_COOKIE,
  createGuestId,
  guestCookieOptions,
  hashDailyIp,
  hashGuestId,
} from "@/lib/guest-response";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const MAX_MESSAGE_LENGTH = 2000;
const MIN_MESSAGE_LENGTH_WITHOUT_AUDIO = 8;
const RECENT_WINDOW_MINUTES = 10;
const SAME_CARD_COOLDOWN_MINUTES = 2;
const MAX_RECENT_RESPONSES = 8;
const SAME_CARD_COOLDOWN_SECONDS = SAME_CARD_COOLDOWN_MINUTES * 60;
const GUEST_MAX_RECENT_RESPONSES = 5;
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
  return value.trim();
}

function isAllowedAudioFile(file) {
  if (!file?.name) return false;
  const mimeType = String(file.type || "").toLowerCase();
  const extension = path.extname(file.name).toLowerCase();
  return ALLOWED_AUDIO_MIME_TYPES.has(mimeType) || ALLOWED_AUDIO_EXTENSIONS.has(extension);
}

export async function POST(req) {
  try {
    const session = readSessionUser();
    if (session) await ensureActiveCustomer(session);

    const form = await req.formData();
    const requestId = form.get("requestId");
    const message = normalizeMessage(form.get("message"));
    const isAnonymous = form.get("isAnonymous") === "true";
    const audio = form.get("audio");
    const honeypot = String(form.get("website") || "").trim();

    const hasAudio = Boolean(audio && audio.name);
    if (honeypot) {
      return NextResponse.json(
        { code: "INVALID_SUBMISSION", error: "這次送出未完成，請重新整理頁面後再試一次。" },
        { status: 422 }
      );
    }
    if (!message && !hasAudio) {
      return NextResponse.json(
        { code: "EMPTY_RESPONSE", error: "請先寫下禱告內容，再按「送出文字禱告」。" },
        { status: 422 }
      );
    }

    if (message.length > MAX_MESSAGE_LENGTH) {
      return NextResponse.json(
        {
          code: "TEXT_TOO_LONG",
          error: `文字禱告最多 ${MAX_MESSAGE_LENGTH} 個字，目前超出 ${message.length - MAX_MESSAGE_LENGTH} 個字。`,
        },
        { status: 422 }
      );
    }

    if (!hasAudio && message.length < MIN_MESSAGE_LENGTH_WITHOUT_AUDIO) {
      return NextResponse.json(
        {
          code: "TEXT_TOO_SHORT",
          error: `文字禱告至少需要 ${MIN_MESSAGE_LENGTH_WITHOUT_AUDIO} 個字，目前還差 ${MIN_MESSAGE_LENGTH_WITHOUT_AUDIO - message.length} 個字。`,
        },
        { status: 422 }
      );
    }

    const homeCardId = Number(requestId);
    if (!Number.isInteger(homeCardId)) {
      return NextResponse.json({ code: "CARD_UNAVAILABLE", error: "這則代禱目前無法回應，請立即禱告，為另一人禱告。", action: { label: "立即禱告", href: "/prayfor/one" } }, { status: 400 });
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
        { code: "CARD_UNAVAILABLE", error: "這則代禱目前無法回應，請立即禱告，為另一人禱告。", action: { label: "立即禱告", href: "/prayfor/one" } },
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

    let guestId = null;
    let guestSessionHash = null;
    let ipHash = null;
    if (!session) {
      guestId = req.cookies.get(GUEST_RESPONSE_COOKIE)?.value || createGuestId();
      guestSessionHash = hashGuestId(guestId);
      ipHash = hashDailyIp(req, now);
    }
    const identityWhere = session
      ? { responderId: session.userId }
      : { OR: [{ guestSessionHash }, { ipHash }] };

    const [recentResponsesCount, sameCardRecentCount] = await Promise.all([
      prisma.prayerResponse.count({
        where: {
          ...identityWhere,
          createdAt: { gte: recentStart },
        },
      }),
      prisma.prayerResponse.count({
        where: {
          ...identityWhere,
          homeCardId,
          createdAt: { gte: sameCardCooldownStart },
        },
      }),
    ]);

    const recentLimit = session ? MAX_RECENT_RESPONSES : GUEST_MAX_RECENT_RESPONSES;
    if (recentResponsesCount >= recentLimit) {
      return NextResponse.json(
        { code: "RATE_LIMITED", error: "短時間內送出的文字禱告較多，請 10 分鐘後再試；你寫的內容仍會保留在畫面上。", retryAfterSeconds: RECENT_WINDOW_MINUTES * 60 },
        { status: 429 }
      );
    }

    if (sameCardRecentCount > 0) {
      return NextResponse.json(
        {
          code: "RATE_LIMITED",
          error: "你剛剛已為這則需要禱告，請約 2 分鐘後再送出；你寫的內容仍會保留在畫面上。",
          retryAfterSeconds: SAME_CARD_COOLDOWN_SECONDS,
        },
        {
          status: 429,
          headers: { "Retry-After": String(SAME_CARD_COOLDOWN_SECONDS) },
        }
      );
    }

    let voiceUrl = null;
    // Content policy (changed 2026-07-01): responses are auto-approved on upload and
    // only go back to PENDING if someone reports them — see the report endpoint. The
    // old "every voice recording sits in PENDING until an admin manually approves it"
    // gate left every past voice reply permanently invisible, because no admin screen
    // ever consumed the review queue. TOO_LARGE / RATE_LIMIT are abuse-prevention
    // signals (not content judgment), so those still auto-reject on upload.
    let voiceModerationStatus = "APPROVED";
    let voiceAutoFlags = null;
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

      // PRD-009:依 storage driver 判斷是否可寫
      assertStorageWritable();

      const bytes = Buffer.from(await audio.arrayBuffer());
      const folderName = resolveVoiceFolder(requestId);
      const sanitizedOriginal = sanitizeFileName(audio.name);
      const filename = `${Date.now()}-${sanitizedOriginal}`;
      const folderPath = await ensureMediaWriteDirectory("voices", [folderName]);
      const filePath = path.join(folderPath, filename);

      await writeFile(filePath, bytes);
      voiceUrl = buildMediaPublicUrl("voices", [folderName, filename]);

      // PRD-001 語音審核:預設 APPROVED,規則式自動退高風險檔案(TOO_LARGE/RATE_LIMIT)
      const recentVoiceWindowStart = new Date(
        now.getTime() - RECENT_WINDOW_MINUTES * 60 * 1000
      );
      const recentVoiceCount = await prisma.prayerResponse.count({
        where: {
          ...identityWhere,
          voiceUrl: { not: null },
          createdAt: { gte: recentVoiceWindowStart },
        },
      });
      const { flags, autoReject } = evaluateVoiceUpload({
        durationSeconds: null, // 伺服器端時長解析未實作,保守不觸發 TOO_LONG
        fileSizeBytes: Number(audio.size) || bytes.length,
        recentUploadCount: recentVoiceCount,
      });
      voiceAutoFlags = serializeVoiceFlags(flags);
      voiceModerationStatus = autoReject ? "REJECTED" : "APPROVED";
    }

    const rewardRule = session ? await readTokenRewardRule() : null;
    const isSelfResponse =
      Boolean(session && homeCard.ownerId) && homeCard.ownerId === session.userId;
    const rewardEligibleAt = !session || isSelfResponse
      ? null
      : computeRewardEligibleAt(rewardRule.observationDays, now);
    const linkCount = (message.match(/https?:\/\//gi) || []).length;
    const moderationStatus = !session && (recentResponsesCount >= 3 || linkCount >= 2)
      ? "PENDING"
      : "APPROVED";

    const response = await prisma.prayerResponse.create({
      data: {
        message,
        voiceUrl,
        voiceModerationStatus,
        voiceAutoFlags,
        isAnonymous: session ? isAnonymous : true,
        moderationStatus,
        guestSessionHash,
        ipHash,
        rewardStatus: !session || isSelfResponse ? "BLOCKED" : "PENDING",
        rewardEligibleAt,
        rewardEvaluatedAt: !session || isSelfResponse ? now : null,
        isSettled: !session || isSelfResponse,
        ...(session ? { responder: { connect: { id: session.userId } } } : {}),
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

    const publicResponse = toPublicPrayerResponse(response);
    const payload = { ...publicResponse, pendingReview: moderationStatus === "PENDING" };
    const result = NextResponse.json(payload, { status: 201 });
    if (!session) result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions());
    return result;
  } catch (err) {
    if (err?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json(
        { code: "ACCOUNT_BLOCKED", error: "這個帳號目前無法送出禱告；若你認為有誤，請透過平台介紹頁的聯絡方式與我們聯繫。", action: { label: "查看聯絡方式", href: "/about" } },
        { status: 403 }
      );
    }
    if (err?.code === "MEDIA_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { code: "VOICE_UNAVAILABLE", error: "語音服務暫時無法使用；你可以關閉語音視窗，改送出文字禱告。" },
        { status: 503 }
      );
    }

    console.error("Failed to create response:", err);
    return NextResponse.json(
      { code: "SERVER_ERROR", error: "文字禱告暫時無法送出；你寫的內容仍會保留，請稍後重新送出。" },
      { status: 500 }
    );
  }
}
