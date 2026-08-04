import { NextResponse } from "next/server";

import { readAdjacentHomeCards } from "@/lib/homeCards";

// Thin adapter over the existing readAdjacentHomeCards() lib function (already
// used for /prayfor/[id] prev/next navigation) — no new query logic, no new
// data source. Used by the homepage swipe/companion browsing (Commit B, see
// docs/obsidian/25-Companion-Mode-Reuse-Audit.md).
function toPublicSummary(card) {
  if (!card) return null;
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    voiceHref: card.voiceHref,
  };
}

export async function GET(_req, { params }) {
  const id = Number(params?.id);
  if (!Number.isInteger(id)) {
    return NextResponse.json({ error: "Invalid id" }, { status: 400 });
  }

  try {
    const { prev, next } = await readAdjacentHomeCards(id);
    return NextResponse.json(
      { prev: toPublicSummary(prev), next: toPublicSummary(next) },
      { status: 200 }
    );
  } catch (err) {
    console.error("Failed to fetch adjacent home cards:", err);
    return NextResponse.json({ error: "Failed to fetch" }, { status: 500 });
  }
}
