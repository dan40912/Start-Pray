import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import { logAdminAction, logSystemError } from "@/lib/logger";
import prisma from "@/lib/prisma";
import { normalizeYoutubeUrl } from "@/lib/youtube";

const MAX_NAME_LENGTH = 80;
const MAX_USERNAME_LENGTH = 40;
const MAX_TEXT_LENGTH = 191;
const MAX_BIO_LENGTH = 1000;
const MAX_URL_LENGTH = 2048;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeString(value, maxLength) {
  if (value === null) return null;
  if (value === undefined) return undefined;
  if (typeof value !== "string") return undefined;

  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, maxLength);
}

function normalizeEmail(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const next = value.trim().toLowerCase();
  if (!next) return null;
  if (!EMAIL_REGEX.test(next)) {
    throw new Error("Invalid email format");
  }
  return next.slice(0, MAX_TEXT_LENGTH);
}

function normalizeUsername(value) {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== "string") return undefined;

  const next = value.trim().toLowerCase();
  if (!next) return null;
  return next.slice(0, MAX_USERNAME_LENGTH);
}

function toEditablePayload(body) {
  const payload = {};

  const email = normalizeEmail(body.email);
  if (email !== undefined) payload.email = email;

  const name = normalizeString(body.name, MAX_NAME_LENGTH);
  if (name !== undefined) payload.name = name;

  const username = normalizeUsername(body.username);
  if (username !== undefined) payload.username = username;

  const faithTradition = normalizeString(body.faithTradition, MAX_TEXT_LENGTH);
  if (faithTradition !== undefined) payload.faithTradition = faithTradition;

  const country = normalizeString(body.country, MAX_TEXT_LENGTH);
  if (country !== undefined) payload.country = country;

  const avatarUrl = normalizeString(body.avatarUrl, MAX_TEXT_LENGTH);
  if (avatarUrl !== undefined) payload.avatarUrl = avatarUrl;

  const bio = normalizeString(body.bio, MAX_BIO_LENGTH);
  if (bio !== undefined) payload.bio = bio;

  const storyAudioUrl = normalizeString(body.storyAudioUrl, MAX_URL_LENGTH);
  if (storyAudioUrl !== undefined) payload.storyAudioUrl = storyAudioUrl;

  if (Object.prototype.hasOwnProperty.call(body, "storyYoutubeUrl")) {
    if (body.storyYoutubeUrl === null || body.storyYoutubeUrl === undefined || body.storyYoutubeUrl === "") {
      payload.storyYoutubeUrl = null;
    } else if (typeof body.storyYoutubeUrl === "string") {
      payload.storyYoutubeUrl = normalizeYoutubeUrl(body.storyYoutubeUrl);
    }
  }

  const solanaAddress = normalizeString(body.solanaAddress, MAX_TEXT_LENGTH);
  if (solanaAddress !== undefined) payload.solanaAddress = solanaAddress;

  const bscAddress = normalizeString(body.bscAddress, MAX_TEXT_LENGTH);
  if (bscAddress !== undefined) payload.bscAddress = bscAddress;

  if (typeof body.isAddressVerified === "boolean") {
    payload.isAddressVerified = body.isAddressVerified;
  }

  return payload;
}

const USER_SELECT_FIELDS = {
  id: true,
  email: true,
  name: true,
  username: true,
  faithTradition: true,
  country: true,
  avatarUrl: true,
  bio: true,
  storyAudioUrl: true,
  storyYoutubeUrl: true,
  storyUpdatedAt: true,
  solanaAddress: true,
  bscAddress: true,
  isAddressVerified: true,
  isBlocked: true,
  reportCount: true,
  walletBalance: true,
  createdAt: true,
  updatedAt: true,
};

export async function GET(request, { params }) {
  const { error } = await requireAdmin(request);
  if (error) return error;

  try {
    const user = await prisma.user.findUnique({
      where: { id: params.id },
      select: USER_SELECT_FIELDS,
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    return NextResponse.json(user);
  } catch (err) {
    await logSystemError({
      message: `Failed to fetch user ${params?.id ?? ""}`,
      error: err,
      requestPath: request.url,
      metadata: { userId: params?.id },
    });

    return NextResponse.json({ message: "Failed to fetch user", error: err.message }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  const { error, session } = await requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json();
    const updateData = toEditablePayload(body ?? {});

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ message: "No editable fields provided" }, { status: 400 });
    }

    if (
      Object.prototype.hasOwnProperty.call(updateData, "storyAudioUrl") ||
      Object.prototype.hasOwnProperty.call(updateData, "storyYoutubeUrl")
    ) {
      updateData.storyUpdatedAt = new Date();
    }

    const existing = await prisma.user.findUnique({
      where: { id: params.id },
      select: { id: true },
    });

    if (!existing) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    const updated = await prisma.user.update({
      where: { id: params.id },
      data: updateData,
      select: USER_SELECT_FIELDS,
    });

    await logAdminAction({
      action: "user.profile.update",
      message: `Updated profile fields for user ${params.id}`,
      actorId: session.adminId,
      actorEmail: session.username,
      targetType: "User",
      targetId: params.id,
      requestPath: request.url,
      metadata: { changedFields: Object.keys(updateData) },
    });

    return NextResponse.json(updated);
  } catch (err) {
    if (err?.code === "P2002") {
      return NextResponse.json({ message: "Email or username already exists" }, { status: 409 });
    }

    if (err instanceof Error && err.message === "Invalid email format") {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    if (err instanceof Error && err.message.includes("YouTube")) {
      return NextResponse.json({ message: err.message }, { status: 400 });
    }

    await logSystemError({
      message: `Failed to update user ${params?.id ?? ""}`,
      error: err,
      requestPath: request.url,
      metadata: { userId: params?.id },
    });

    return NextResponse.json({ message: "Failed to update user", error: err.message }, { status: 500 });
  }
}
