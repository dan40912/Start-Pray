import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";
import { resolveServerAudioUrl } from "@/lib/server-audio";

const SAFE_RESPONSE_SELECT = {
  id: true,
  homeCardId: true,
  message: true,
  voiceUrl: true,
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

    const responses = await prisma.prayerResponse.findMany({
      where: { homeCardId, isBlocked: false, reportCount: 0 },
      orderBy: { createdAt: "desc" },
      select: SAFE_RESPONSE_SELECT,
    });

    return NextResponse.json(
      responses.map((response) => ({
        ...response,
        voiceUrl: resolveServerAudioUrl(response.voiceUrl),
      })),
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to fetch responses:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
