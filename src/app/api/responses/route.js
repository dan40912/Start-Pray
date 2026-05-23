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
        { error: "Please provide a text message or voice recording." },
        { status: 422 }
      );
    }

    if (!hasAudio && message.length < MIN_MESSAGE_LENGTH_WITHOUT_AUDIO) {
      return NextResponse.json(
        {
          error: `Text response must be at least ${MIN_MESSAGE_LENGTH_WITHOUT_AUDIO} characters.`,
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
        { error: "Prayer card not found or unavailable." },
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
          { error: "Voice file is too large." },
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
      return NextResponse.json({ error: "Please sign in." }, { status: 401 });
    }
    if (err?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json(
        { error: "Your account is blocked." },
        { status: 403 }
      );
    }
    if (err?.code === "MEDIA_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { error: `Media storage is not configured. Set ${err.envName}.` },
        { status: 503 }
      );
    }

    console.error("Failed to create response:", err);
    return NextResponse.json(
      { error: "Failed to create response" },
      { status: 500 }
    );
  }
}
