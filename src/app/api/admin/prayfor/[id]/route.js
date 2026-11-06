import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction, logSystemError } from "@/lib/logger";
import { buildThreadsPostText } from "@/lib/threads-publishing";
import prisma from "@/lib/prisma";

function parseId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function normalizeText(value, { required = false } = {}) {
  if (value === null || value === undefined) {
    return required ? null : undefined;
  }

  if (typeof value !== "string") {
    return required ? null : undefined;
  }

  const trimmed = value.trim();
  if (required) {
    return trimmed.length > 0 ? trimmed : null;
  }

  return trimmed;
}

function normalizeNullableText(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeEditableText(value) {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") return undefined;
  return value.trim();
}

function buildPrayforDetail(card) {
  return {
    id: card.id,
    title: card.title,
    description: card.description,
    image: card.image,
    alt: card.alt,
    detailsHref: card.detailsHref,
    voiceHref: card.voiceHref,
    categoryId: card.categoryId,
    category: card.category,
    owner: card.owner,
    isBlocked: card.isBlocked,
    isPrivate: card.isPrivate,
    needsReview: card.needsReview,
    threadsShare: card.threadsShare
      ? {
          ...card.threadsShare,
          suggestedPostText: card.threadsShare.postText || buildThreadsPostText(card.id, card.title),
        }
      : null,
    reportCount: card.reportCount,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    _count: {
      responses: card._count?.responses ?? 0,
    },
  };
}

export async function GET(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const cardId = parseId(params?.id);
  if (!cardId) {
    return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });
  }

  try {
    const card = await prisma.homePrayerCard.findUnique({
      where: { id: cardId },
      include: {
        threadsShare: true,
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    if (!card) {
      return NextResponse.json({ message: "Prayer item not found" }, { status: 404 });
    }

    await logAdminAction({
      action: "prayfor.detail.read", message: "管理員開啟內容詳情",
      actorId: session.adminId, actorEmail: session.username,
      targetType: "HomePrayerCard", targetId: String(card.id),
      requestPath: "/api/admin/prayfor/[id]", required: true,
    });
    return NextResponse.json(buildPrayforDetail(card));
  } catch (err) {
    await logSystemError({
      message: `Failed to fetch prayer item detail: ${params?.id ?? ""}`,
      error: err,
      requestPath: request.url,
      metadata: { id: params?.id },
    });

    return NextResponse.json({ message: "Failed to fetch prayer item detail" }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  const cardId = parseId(params?.id);
  if (!cardId) {
    return NextResponse.json({ message: "Invalid ID format" }, { status: 400 });
  }

  try {
    const body = await request.json();

    const title = normalizeText(body?.title, { required: true });
    if (!title) {
      return NextResponse.json({ message: "Title is required" }, { status: 400 });
    }

    const categoryId = Number(body?.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return NextResponse.json({ message: "Category is required" }, { status: 400 });
    }

    const category = await prisma.homePrayerCategory.findUnique({
      where: { id: categoryId },
      select: { id: true },
    });

    if (!category) {
      return NextResponse.json({ message: "Category does not exist" }, { status: 400 });
    }

    const updateData = {
      title,
      categoryId,
    };

    const description = normalizeEditableText(body?.description);
    if (description !== undefined) {
      updateData.description = description;
    }

    const image = normalizeEditableText(body?.image);
    if (image !== undefined) {
      updateData.image = image;
    }

    const detailsHref = normalizeEditableText(body?.detailsHref);
    if (detailsHref !== undefined) {
      updateData.detailsHref = detailsHref;
    }

    const alt = normalizeNullableText(body?.alt);
    if (alt !== undefined) {
      updateData.alt = alt;
    }

    const voiceHref = normalizeNullableText(body?.voiceHref);
    if (voiceHref !== undefined) {
      updateData.voiceHref = voiceHref;
    }

    if (typeof body?.isBlocked === "boolean") {
      updateData.isBlocked = body.isBlocked;
    }

    const updated = await prisma.$transaction(async (tx) => {
    const updated = await tx.homePrayerCard.update({
      where: { id: cardId },
      data: updateData,
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            isActive: true,
          },
        },
        owner: {
          select: {
            id: true,
            name: true,
            email: true,
            username: true,
          },
        },
        _count: {
          select: {
            responses: true,
          },
        },
      },
    });

    await logAdminAction({
      action: "prayer.update",
      message: `Updated prayer item ${cardId}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "HomePrayerCard",
      targetId: String(cardId),
      requestPath: request.url,
      metadata: {
        changedFields: Object.keys(updateData),
      },
      transaction: tx, required: true,
    });
    return updated;
    });

    return NextResponse.json(buildPrayforDetail(updated));
  } catch (err) {
    await logSystemError({
      message: `Failed to update prayer item: ${params?.id ?? ""}`,
      error: err,
      requestPath: request.url,
      metadata: { id: params?.id },
    });

    return NextResponse.json({ message: "Failed to update prayer item" }, { status: 500 });
  }
}

