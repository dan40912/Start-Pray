import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveServerAudioUrl } from "@/lib/server-audio";

const SAFE_RESPONSE_SELECT = {
  id: true,
  homeCardId: true,
  message: true,
  voiceUrl: true,
  voiceModerationStatus: true,
  isAnonymous: true,
  isBlocked: true,
  reportCount: true,
  createdAt: true,
  responder: {
    select: {
      name: true,
      avatarUrl: true,
      username: true,
      publicProfileEnabled: true,
      isBlocked: true,
    },
  },
};

export async function GET(_req, { params }) {
  const homeCardId = Number(params?.homeCardId);
  if (!Number.isInteger(homeCardId)) {
    return NextResponse.json({ error: "Invalid homeCardId" }, { status: 400 });
  }

  try {
    const homeCard = await prisma.homePrayerCard.findUnique({
      where: { id: homeCardId },
      select: { id: true, isBlocked: true, isPrivate: true },
    });

    if (!homeCard || homeCard.isBlocked || homeCard.isPrivate) {
      return NextResponse.json({ error: "Prayer card not found or unavailable." }, { status: 404 });
    }

    // Content policy (changed 2026-07-01): visibility now follows voiceModerationStatus
    // instead of reportCount. This field is repurposed as the single moderation gate for
    // the whole response (text + voice), not just the audio file: new responses default to
    // APPROVED, and a report flips it back to PENDING for re-review (see report route).
    // reportCount alone used to hide a response permanently after a single report with no
    // way back — that's what made replies vanish with no review path.
    const responses = await prisma.prayerResponse.findMany({
      where: {
        homeCardId,
        isBlocked: false,
        moderationStatus: "APPROVED",
        // NOT_APPLICABLE is included for legacy rows created before this policy change
        // that haven't been migrated to APPROVED yet; new rows never get NOT_APPLICABLE.
        voiceModerationStatus: { in: ["APPROVED", "NOT_APPLICABLE"] },
      },
      orderBy: { createdAt: "desc" },
      select: SAFE_RESPONSE_SELECT,
    });

    return NextResponse.json(
      responses.map((response) => {
        const { voiceModerationStatus, ...rest } = response;
        return {
          ...rest,
          voiceUrl: response.voiceUrl ? resolveServerAudioUrl(response.voiceUrl) : null,
          voicePending: false,
        };
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to fetch responses:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
