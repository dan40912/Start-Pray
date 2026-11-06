import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { requireAdmin } from "@/lib/admin-route-auth";
import { readCustomerSessionFromRequest } from "@/lib/customer-session";
import { buildMediaPublicUrl, isLegacyUnreferencedMedia } from "@/lib/server-media-storage";
import { mayReadMedia, cardMediaReference, responseMediaReference } from "./media-access-policy.js";

export async function authorizeMediaRead(request, kind, segments) {
  const unavailable = (status = 404) =>
    NextResponse.json(
      { message: status === 503 ? "暫時無法確認媒體權限" : "File not found." },
      { status, headers: { "Cache-Control": "private, no-store" } }
    );
  try {
    const url = buildMediaPublicUrl(kind, segments);
    const decoded = decodeURIComponent(url);
    const variants = [...new Set([url, decoded])];
    const galleryFilters = variants.flatMap((value) => [
      { meta: { array_contains: [`gallery::${value}`] } },
      { meta: { path: "$.gallery", array_contains: [value] } },
      { meta: { path: "$.entries", array_contains: [`gallery::${value}`] } },
      { meta: { path: "$.info", array_contains: [`gallery::${value}`] } },
      { meta: { equals: `gallery::${value}` } },
    ]);
    const cardSelect = {
      ownerId: true,
      isPrivate: true,
      isBlocked: true,
      needsReview: true,
      category: { select: { isActive: true } },
    };
    const [cards, responses, profiles, banners] = await Promise.all([
      prisma.homePrayerCard.findMany({
        where: {
          OR: [{ image: { in: variants } }, { voiceHref: { in: variants } }, ...galleryFilters],
        },
        select: cardSelect,
      }),
      prisma.prayerResponse.findMany({
        where: { voiceUrl: { in: variants } },
        select: {
          responderId: true,
          isBlocked: true,
          moderationStatus: true,
          voiceModerationStatus: true,
          homeCard: { select: cardSelect },
        },
      }),
      prisma.user.findMany({
        where: { OR: [{ avatarUrl: { in: variants } }, { storyAudioUrl: { in: variants } }] },
        select: { id: true, isBlocked: true, publicProfileEnabled: true },
      }),
      prisma.siteBanner.findMany({
        where: { heroImage: { in: variants } },
        select: { isActive: true },
      }),
    ]);
    const references = [
      ...cards.map(cardMediaReference),
      ...responses.map(responseMediaReference),
      ...profiles.map((user) => ({
        public: user.publicProfileEnabled && !user.isBlocked,
        ownerIds: [user.id],
      })),
      ...banners.map((banner) => ({ public: banner.isActive, ownerIds: [] })),
    ];
    if (mayReadMedia(references)) return null;

    // Preserve access to files that predate media_upload/reference tracking.
    // A known private, moderated, or inactive reference always wins.
    if (references.length === 0 && await isLegacyUnreferencedMedia(kind, segments)) return null;

    const customerToken = readCustomerSessionFromRequest(request);
    if (customerToken) {
      const user = await prisma.user.findUnique({
        where: { id: customerToken.userId },
        select: { id: true, isBlocked: true, sessionVersion: true },
      });
      if (user && !user.isBlocked && user.sessionVersion === customerToken.sessionVersion) {
        if (mayReadMedia(references, user.id)) return null;
        if (references.length === 0) {
          const upload = await prisma.mediaUpload.findUnique({ where: { url } });
          if (upload?.ownerId === user.id) return null;
        }
      }
    }

    // Reviewers may inspect restricted media; this is an audited read, not a
    // public bypass. Failed authorization or audit never serves the bytes.
    const { error, session } = await requireAdmin(request);
    if (error) return unavailable(error.status === 503 ? 503 : 404);
    await prisma.adminLog.create({
      data: {
        category: "ACTION",
        level: "INFO",
        action: "media.review.read",
        message: "管理員讀取受限媒體",
        actorId: session.adminId,
        actorEmail: session.username,
        targetType: "Media",
        targetId: url,
        requestPath: `/api/media/${kind}`,
        metadata: { method: request.method, referenceCount: references.length },
      },
    });
    return null;
  } catch {
    return unavailable(503);
  }
}
