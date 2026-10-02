import prisma from "@/lib/prisma";
import { renderPrayerOg } from "@/lib/prayer-og.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request, { params }) {
  const id = Number(params.id);
  if (!Number.isSafeInteger(id) || id <= 0) return new Response(null, { status: 404 });
  // Never render private, blocked, or pending cards into a public share image.
  const card = await prisma.homePrayerCard.findFirst({
    where: { id, isPrivate: false, isBlocked: false, needsReview: false },
    select: { title: true },
  });
  if (!card) return new Response(null, { status: 404 });
  return new Response(await renderPrayerOg(card.title), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=0, must-revalidate",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
