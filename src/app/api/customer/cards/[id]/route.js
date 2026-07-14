import { NextResponse } from "next/server";

import { ensureActiveCustomer } from "@/lib/customer-access";
import { isDefaultThumbnailUrl } from "@/lib/default-thumbnail";
import prisma from "@/lib/prisma";
import { sanitizePrayerLocationPayload } from "@/lib/prayerLocations";
import { requireSessionUser } from "@/lib/server-session";

const GALLERY_PREFIX = "gallery::";
const UPLOADS_PREFIX = "/uploads/";
const STATIC_IMAGE_PREFIX = "/img/";

function isInternalUploadUrl(value) {
  return typeof value === "string" && value.startsWith(UPLOADS_PREFIX);
}

function isSupportedInternalImageUrl(value) {
  if (!value) return true;
  return (
    isInternalUploadUrl(value) ||
    isDefaultThumbnailUrl(value) ||
    (typeof value === "string" && value.startsWith(STATIC_IMAGE_PREFIX))
  );
}

function normalizeTags(value) {
  if (Array.isArray(value)) {
    return value.map((tag) => String(tag).trim()).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeMeta(value) {
  const normalizeEntry = (entry) => {
    const normalized = String(entry).trim();
    if (!normalized) return "";
    if (!normalized.startsWith(GALLERY_PREFIX)) return normalized;

    const url = normalized.slice(GALLERY_PREFIX.length).trim();
    if (!isInternalUploadUrl(url)) {
      throw new Error("Gallery images must use uploaded files.");
    }
    return `${GALLERY_PREFIX}${url}`;
  };

  if (Array.isArray(value)) {
    return value.map(normalizeEntry).filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split("\n")
      .map(normalizeEntry)
      .filter(Boolean);
  }

  return [];
}

function sanitizeUpdatePayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Please provide the fields to update.");
  }

  const title = body.title?.trim();
  const description = body.description?.trim();
  const image = body.image?.trim();
  const alt = body.alt?.trim();
  const slug = body.slug?.trim();
  const detailsHref = body.detailsHref?.trim();
  const voiceHref = body.voiceHref?.trim();
  const isPrivate = Boolean(body.isPrivate);

  const rawCategoryId = body.categoryId ?? body.category?.id;
  const categoryId = rawCategoryId != null ? Number(rawCategoryId) : null;

  if (!title) {
    throw new Error("Title is required.");
  }

  if (!categoryId) {
    throw new Error("Category is required.");
  }

  if (!isSupportedInternalImageUrl(image)) {
    throw new Error("Image must be uploaded from this site or use the default thumbnail.");
  }

  return {
    title,
    description: description ?? "",
    image: image ?? "",
    alt: alt ?? "",
    slug: slug ?? null,
    detailsHref: detailsHref ?? null,
    voiceHref: voiceHref ?? null,
    tags: normalizeTags(body.tags),
    meta: normalizeMeta(body.meta),
    isPrivate,
    categoryId,
    ...sanitizePrayerLocationPayload(body),
  };
}

async function getOwnedCard(cardId, userId) {
  const card = await prisma.homePrayerCard.findUnique({
    where: { id: cardId },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      _count: { select: { responses: true } },
    },
  });

  if (!card) {
    return {
      response: NextResponse.json({ message: "Prayer card not found." }, { status: 404 }),
    };
  }

  if (card.ownerId !== userId) {
    return {
      response: NextResponse.json(
        { message: "You do not have permission to manage this prayer card." },
        { status: 403 }
      ),
    };
  }

  return { card };
}

async function requireActiveCustomerUser() {
  const session = requireSessionUser();
  return ensureActiveCustomer(session);
}

export async function GET(request, { params }) {
  const cardId = Number.parseInt(params?.id ?? "", 10);
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ message: "Invalid prayer card id." }, { status: 400 });
  }

  try {
    const user = await requireActiveCustomerUser();
    const { response, card } = await getOwnedCard(cardId, user.id);
    if (response) return response;

    return NextResponse.json(card);
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "Your account is blocked." }, { status: 403 });
    }

    console.error("GET /api/customer/cards/[id] error:", error);
    return NextResponse.json({ message: "Failed to load prayer card." }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const cardId = Number.parseInt(params?.id ?? "", 10);
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ message: "Invalid prayer card id." }, { status: 400 });
  }

  try {
    const user = await requireActiveCustomerUser();
    const payload = await request.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      return NextResponse.json(
        { message: "Please provide the fields to update." },
        { status: 400 }
      );
    }

    const { response } = await getOwnedCard(cardId, user.id);
    if (response) return response;

    const data = {};
    if (Object.prototype.hasOwnProperty.call(payload, "isBlocked")) {
      data.isBlocked = Boolean(payload.isBlocked);
    }
    if (Object.prototype.hasOwnProperty.call(payload, "isPrivate")) {
      data.isPrivate = Boolean(payload.isPrivate);
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { message: "Only visibility can be updated via PATCH." },
        { status: 400 }
      );
    }

    const updated = await prisma.homePrayerCard.update({
      where: { id: cardId },
      data,
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { responses: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "Your account is blocked." }, { status: 403 });
    }

    console.error("PATCH /api/customer/cards/[id] error:", error);
    return NextResponse.json({ message: "Failed to update prayer card." }, { status: 500 });
  }
}

export async function PUT(request, { params }) {
  const cardId = Number.parseInt(params?.id ?? "", 10);
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ message: "Invalid prayer card id." }, { status: 400 });
  }

  try {
    const user = await requireActiveCustomerUser();
    const body = await request.json().catch(() => null);
    const updates = sanitizeUpdatePayload(body);

    const { response } = await getOwnedCard(cardId, user.id);
    if (response) return response;

    const updated = await prisma.homePrayerCard.update({
      where: { id: cardId },
      data: {
        title: updates.title,
        description: updates.description,
        image: updates.image,
        alt: updates.alt,
        slug: updates.slug,
        detailsHref: updates.detailsHref,
        voiceHref: updates.voiceHref,
        tags: updates.tags,
        meta: updates.meta,
        isPrivate: updates.isPrivate,
        locationCity: updates.locationCity,
        locationCountry: updates.locationCountry,
        locationLat: updates.locationLat,
        locationLng: updates.locationLng,
        categoryId: updates.categoryId,
      },
      include: {
        category: { select: { id: true, name: true, slug: true } },
        _count: { select: { responses: true } },
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "Your account is blocked." }, { status: 403 });
    }

    const message = error instanceof Error ? error.message : "Failed to update prayer card.";
    const status = /required|invalid|provide|title|category|image|gallery|uploaded|thumbnail/i.test(message)
      ? 400
      : 500;

    console.error("PUT /api/customer/cards/[id] error:", error);
    return NextResponse.json({ message }, { status });
  }
}

export async function DELETE(request, { params }) {
  const cardId = Number.parseInt(params?.id ?? "", 10);
  if (!Number.isFinite(cardId)) {
    return NextResponse.json({ message: "Invalid prayer card id." }, { status: 400 });
  }

  try {
    const user = await requireActiveCustomerUser();
    const { response } = await getOwnedCard(cardId, user.id);
    if (response) return response;

    await prisma.homePrayerCard.delete({ where: { id: cardId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "Your account is blocked." }, { status: 403 });
    }

    console.error("DELETE /api/customer/cards/[id] error:", error);
    return NextResponse.json({ message: "Failed to delete prayer card." }, { status: 500 });
  }
}
