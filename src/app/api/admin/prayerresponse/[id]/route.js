import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction, logSystemError } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { resolveServerAudioUrl } from "@/lib/server-audio";

const VOICE_MODERATION_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED", "NOT_APPLICABLE"]);
const RESPONSE_MODERATION_STATUSES = new Set(["PENDING", "APPROVED", "REJECTED"]);

function normalizeMessage(value) {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeVoiceUrl(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function buildResponseDetail(response) {
  return {
    id: response.id,
    message: response.message,
    voiceUrl: resolveServerAudioUrl(response.voiceUrl),
    isAnonymous: response.isAnonymous,
    isBlocked: response.isBlocked,
    reportCount: response.reportCount,
    moderationStatus: response.moderationStatus,
    responseSource: response.responderId ? (response.voiceUrl ? "MEMBER_VOICE" : "MEMBER_TEXT") : "GUEST_TEXT",
    voiceModerationStatus: response.voiceModerationStatus,
    createdAt: response.createdAt,
    responder: response.responder,
    homeCard: response.homeCard,
  };
}

export async function GET(request, { params }) {
  const { error } = requireAdmin(request);
  if (error) return error;

  const responseId = params?.id;
  if (!responseId) {
    return NextResponse.json({ message: "Missing ID" }, { status: 400 });
  }

  try {
    const response = await prisma.prayerResponse.findUnique({
      where: { id: responseId },
      include: {
        responder: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
        homeCard: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    if (!response) {
      return NextResponse.json({ message: "Prayer response not found" }, { status: 404 });
    }

    return NextResponse.json(buildResponseDetail(response));
  } catch (err) {
    await logSystemError({
      message: `Failed to fetch prayer response detail: ${responseId}`,
      error: err,
      requestPath: request.url,
      metadata: { id: responseId },
    });

    return NextResponse.json({ message: "Failed to fetch prayer response detail" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { error, session } = requireAdmin(request);
  if (error) return error;

  const responseId = params?.id;
  if (!responseId) {
    return NextResponse.json({ message: "Missing ID" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const message = normalizeMessage(body?.message);
    if (!message) {
      return NextResponse.json({ message: "Message is required" }, { status: 400 });
    }

    const updateData = {
      message,
      voiceUrl: normalizeVoiceUrl(body?.voiceUrl),
    };

    if (typeof body?.isAnonymous === "boolean") {
      updateData.isAnonymous = body.isAnonymous;
    }

    if (typeof body?.isBlocked === "boolean") {
      updateData.isBlocked = body.isBlocked;
    }

    if (
      typeof body?.moderationStatus === "string" &&
      RESPONSE_MODERATION_STATUSES.has(body.moderationStatus)
    ) {
      updateData.moderationStatus = body.moderationStatus;
      if (body.moderationStatus === "APPROVED") updateData.reportCount = 0;
    }

    if (
      typeof body?.voiceModerationStatus === "string" &&
      VOICE_MODERATION_STATUSES.has(body.voiceModerationStatus)
    ) {
      updateData.voiceModerationStatus = body.voiceModerationStatus;
      // Approving a response back out of review clears the report count that put it
      // there, so it doesn't stay flagged in the reports column after being cleared.
      if (body.voiceModerationStatus === "APPROVED") {
        updateData.reportCount = 0;
      }
    }

    const updated = await prisma.prayerResponse.update({
      where: { id: responseId },
      data: updateData,
      include: {
        responder: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
            avatarUrl: true,
          },
        },
        homeCard: {
          select: {
            id: true,
            title: true,
            slug: true,
          },
        },
      },
    });

    await logAdminAction({
      action: "prayerresponse.update",
      message: `Updated prayer response ${responseId}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "PrayerResponse",
      targetId: responseId,
      requestPath: request.url,
      metadata: {
        changedFields: Object.keys(updateData),
      },
    });

    return NextResponse.json(buildResponseDetail(updated));
  } catch (err) {
    await logSystemError({
      message: `Failed to update prayer response: ${responseId}`,
      error: err,
      requestPath: request.url,
      metadata: { id: responseId },
    });

    return NextResponse.json({ message: "Failed to update prayer response" }, { status: 500 });
  }
}
