import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { readBanner, writeBanner } from "@/lib/banner";

function validatePayload(payload) {
  if (!payload || typeof payload !== "object") {
    return "Invalid payload";
  }

  if (!payload.headline || typeof payload.headline !== "string") {
    return "Headline is required";
  }

  if (!payload.subheadline || typeof payload.subheadline !== "string") {
    return "Subheadline is required";
  }

  if (!payload.description || typeof payload.description !== "string") {
    return "Description is required";
  }

  if (!payload.primaryCta || typeof payload.primaryCta !== "object") {
    return "Primary CTA is required";
  }

  if (!payload.primaryCta.label || !payload.primaryCta.href) {
    return "Primary CTA label and href are required";
  }

  if (payload.secondaryCta) {
    if (!payload.secondaryCta.label || !payload.secondaryCta.href) {
      return "Secondary CTA must include label and href";
    }
  }

  if (payload.heroImage && typeof payload.heroImage !== "string") {
    return "Hero image must be a string";
  }

  return null;
}

export async function GET() {
  const banner = await readBanner();
  return NextResponse.json(banner, { status: 200 });
}

export async function PUT(request) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const validationError = validatePayload(body);

    if (validationError) {
      return NextResponse.json({ message: validationError }, { status: 400 });
    }

    const updated = await writeBanner(body);
    return NextResponse.json(updated, { status: 200 });
  } catch (caughtError) {
    return NextResponse.json({ message: "Failed to update banner" }, { status: 500 });
  }
}
