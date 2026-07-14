import { NextResponse } from "next/server";

import fallbackCards from "@/data/homeCards.json";
import { ensureActiveCustomer } from "@/lib/customer-access";
import { buildDefaultThumbnailUrl, isDefaultThumbnailUrl } from "@/lib/default-thumbnail";
import { createHomeCard, readHomeCards } from "@/lib/homeCards";
import { sanitizePrayerLocationPayload } from "@/lib/prayerLocations";
import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rateLimit";
import { readSessionUser } from "@/lib/server-session";
import { isLowTrust } from "@/lib/trustScore";

const GALLERY_PREFIX = "gallery::";
const UPLOADS_PREFIX = "/uploads/";
const MAX_TITLE_LENGTH = 120;
const MAX_DESCRIPTION_LENGTH = 3000;
const GUEST_CREATE_WINDOW_MS = 60 * 60 * 1000;
const GUEST_CREATE_LIMIT = 3;
const guestCreateAttempts = new Map();

function isInternalUploadUrl(value) {
  return typeof value === "string" && value.startsWith(UPLOADS_PREFIX);
}

function sanitizeCreatePayload(body) {
  if (!body || typeof body !== "object") {
    throw new Error("Invalid payload");
  }

  if (!body.title || typeof body.title !== "string") {
    throw new Error("Title is required");
  }

  if (!body.categoryId) {
    throw new Error("categoryId is required");
  }

  const title = body.title.trim().slice(0, MAX_TITLE_LENGTH);
  const description =
    typeof body.description === "string" ? body.description.trim().slice(0, MAX_DESCRIPTION_LENGTH) : "";

  if (!title) {
    throw new Error("Title is required");
  }

  if (!description) {
    throw new Error("Description is required");
  }

  const image = typeof body.image === "string" ? body.image.trim() : "";
  const coverImage = image || buildDefaultThumbnailUrl(title);
  if (!isInternalUploadUrl(coverImage) && !isDefaultThumbnailUrl(coverImage)) {
    throw new Error("Image must be uploaded from this site or use the default thumbnail");
  }

  const normalizedMeta = Array.isArray(body.meta)
    ? body.meta
        .map((entry) => (typeof entry === "string" ? entry.trim() : ""))
        .filter(Boolean)
        .map((entry) => {
          if (!entry.startsWith(GALLERY_PREFIX)) return entry;
          const url = entry.slice(GALLERY_PREFIX.length).trim();
          if (!isInternalUploadUrl(url)) {
            throw new Error("Gallery images must use uploaded files");
          }
          return `${GALLERY_PREFIX}${url}`;
        })
    : [];

  return {
    title,
    slug: body.slug?.trim(),
    image: coverImage,
    alt: body.alt?.trim(),
    description,
    tags: Array.isArray(body.tags) ? body.tags : [],
    meta: normalizedMeta,
    detailsHref: body.detailsHref?.trim(),
    voiceHref: body.voiceHref?.trim(),
    categoryId: Number(body.categoryId),
    isPrivate: Boolean(body.isPrivate),
    ...sanitizePrayerLocationPayload(body),
  };
}

function getClientKey(request) {
  const forwarded = request.headers.get("x-forwarded-for") || "";
  const firstForwarded = forwarded.split(",")[0]?.trim();
  return (
    firstForwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip") ||
    "unknown"
  );
}

function assertGuestCanCreate(request, body, payload) {
  if (typeof body?.website === "string" && body.website.trim()) {
    const error = new Error("目前無法建立這則代禱，請稍後再試。");
    error.status = 400;
    throw error;
  }

  if (body?.acceptedGuestTerms !== true) {
    const error = new Error("請先確認訪客送出提醒。");
    error.status = 422;
    throw error;
  }

  if (payload.voiceHref) {
    const error = new Error("請登入後再加入語音連結。");
    error.status = 401;
    throw error;
  }

  if (!isDefaultThumbnailUrl(payload.image)) {
    const error = new Error("請登入後再上傳圖片。");
    error.status = 401;
    throw error;
  }

  if (Array.isArray(payload.meta) && payload.meta.some((entry) => String(entry).startsWith(GALLERY_PREFIX))) {
    const error = new Error("請登入後再加入多張圖片。");
    error.status = 401;
    throw error;
  }

  const key = getClientKey(request);
  const now = Date.now();
  const recentAttempts = (guestCreateAttempts.get(key) || []).filter(
    (timestamp) => now - timestamp < GUEST_CREATE_WINDOW_MS
  );
  if (recentAttempts.length >= GUEST_CREATE_LIMIT) {
    const error = new Error("短時間內送出的訪客代禱較多，請稍後再試。");
    error.status = 429;
    throw error;
  }
  recentAttempts.push(now);
  guestCreateAttempts.set(key, recentAttempts);
}

function toLowerSafe(value) {
  return typeof value === "string" ? value.toLowerCase() : "";
}

function parseLimit(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return undefined;
  return Math.floor(numeric);
}

function filterFallbackCards(options = {}) {
  const { search, sort, limit, categoryId, categorySlug, skip } = options;

  const limitValue = parseLimit(limit);
  const query = toLowerSafe(search?.trim?.());
  const slugFilter = categorySlug?.trim?.().toLowerCase?.() || null;
  const categoryIdFilter = categoryId != null ? String(categoryId).trim() : null;

  let results = Array.isArray(fallbackCards) ? [...fallbackCards] : [];

  if (slugFilter) {
    results = results.filter((card) => toLowerSafe(card?.category?.slug) === slugFilter);
  }

  if (categoryIdFilter) {
    results = results.filter((card) => {
      const cardCategoryId = card?.categoryId ?? card?.category?.id;
      return cardCategoryId != null && String(cardCategoryId) === categoryIdFilter;
    });
  }

  if (query) {
    results = results.filter((card) => {
      const haystack = [
        card?.title,
        card?.description,
        Array.isArray(card?.meta) ? card.meta.join(" ") : "",
        Array.isArray(card?.tags) ? card.tags.join(" ") : "",
        card?.category?.name,
      ]
        .map(toLowerSafe)
        .join(" ");

      return haystack.includes(query);
    });
  }

  if (sort === "responses") {
    results.sort((a, b) => {
      const aCount = a?._count?.responses ?? a?.responsesCount ?? 0;
      const bCount = b?._count?.responses ?? b?.responsesCount ?? 0;
      return bCount - aCount;
    });
  } else if (sort === "needsPrayer") {
    results.sort((a, b) => {
      const aCount = a?._count?.responses ?? a?.responsesCount ?? 0;
      const bCount = b?._count?.responses ?? b?.responsesCount ?? 0;
      if (aCount !== bCount) return aCount - bCount;
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  } else if (sort === "recent" || sort === "created") {
    results.sort((a, b) => {
      const aDate = a?.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bDate = b?.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bDate - aDate;
    });
  }

  const skipValue = Number(skip);
  const start = Number.isFinite(skipValue) && skipValue > 0 ? Math.floor(skipValue) : 0;
  if (start > 0) {
    results = results.slice(start);
  }

  if (limitValue) {
    results = results.slice(0, limitValue);
  }

  return results;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get("mode");

  const options = {};

  // PRD-004:對外只接受 latest / popular / needsPrayer,非白名單一律 fallback latest
  const SORT_ALIASES = {
    latest: "recent",
    recent: "recent",
    popular: "responses",
    responses: "responses",
    needsPrayer: "needsPrayer",
  };
  const rawSort = searchParams.get("sort");
  if (rawSort) options.sort = SORT_ALIASES[rawSort] || "recent";

  const limit = searchParams.get("limit");
  if (limit) options.limit = limit;

  const skip = searchParams.get("skip");
  if (skip) options.skip = Number(skip);

  const categorySlug = searchParams.get("category");
  if (categorySlug && categorySlug !== "popular" && categorySlug !== "all") {
    options.categorySlug = categorySlug;
  }

  const categoryId = searchParams.get("categoryId");
  if (categoryId) options.categoryId = categoryId;

  const search = searchParams.get("search") || searchParams.get("q");
  if (search) options.search = search;

  if (!options.sort && categorySlug === "popular") {
    options.sort = "responses";
  }
  if (mode === "one") {
    options.sort = "needsPrayer";
    options.limit = 1;
  }

  try {
    // PRD-004:附帶公開回應數與最後回應時間;回應數排除已封鎖回應
    const include = {
      category: true,
      owner: { select: { name: true, username: true, avatarUrl: true } },
      _count: { select: { responses: { where: { isBlocked: false, moderationStatus: "APPROVED" } } } },
      responses: {
        where: { isBlocked: false, moderationStatus: "APPROVED" },
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { createdAt: true },
      },
    };
    const cards = await readHomeCards({ ...options, include });
    const mapped = cards.map((card) => {
      const { responses, ...rest } = card;
      return {
        ...rest,
        responseCount: card._count?.responses ?? 0,
        lastRespondedAt: responses?.[0]?.createdAt ?? null,
      };
    });
    return NextResponse.json(mode === "one" ? mapped[0] || null : mapped, { status: 200 });
  } catch (error) {
    console.error("[GET /api/home-cards] database error", error);
    const fallback = filterFallbackCards(options);
    return NextResponse.json(mode === "one" ? fallback[0] || null : fallback, {
      status: 200,
      headers: { "x-fallback-data": "static-home-cards" },
    });
  }
}

export async function POST(request) {
  try {
    const session = readSessionUser();
    const user = session?.userId ? await ensureActiveCustomer(session) : null;
    const body = await request.json();
    const payload = sanitizeCreatePayload(body);
    const category = await prisma.homePrayerCategory.findFirst({
      where: { id: payload.categoryId, isActive: true },
      select: { id: true },
    });
    if (!category) {
      return NextResponse.json({ message: "Please choose an active category." }, { status: 422 });
    }
    if (!user) {
      assertGuestCanCreate(request, body, payload);
    }

    // PRD-005:登入會員的頻率限制與信任分數判斷
    let needsReview = false;
    if (user?.id) {
      const profile = await prisma.user.findUnique({
        where: { id: user.id },
        select: { createdAt: true, flaggedCount: true, isBlocked: true },
      });
      const lowTrust = isLowTrust(profile || {});
      const limit = await checkRateLimit({
        userId: user.id,
        action: "createCard",
        multiplier: lowTrust ? 0.5 : 1,
      });
      if (!limit.allowed) {
        return NextResponse.json(
          { message: "短時間內建立的代禱卡較多，請稍後再試。" },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        );
      }
      needsReview = lowTrust;
    }

    let created = await createHomeCard({
      ...payload,
      needsReview,
      ownerId: user?.id ?? null,
    });
    const expectedDetailsHref = `/prayfor/${created.id}`;
    if (created.detailsHref !== expectedDetailsHref) {
      created = await prisma.homePrayerCard.update({
        where: { id: created.id },
        data: { detailsHref: expectedDetailsHref },
        include: {
          category: true,
          owner: {
            select: {
              name: true,
              username: true,
              avatarUrl: true,
            },
          },
          _count: {
            select: {
              responses: true,
            },
          },
        },
      });
    }
    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "Please sign in." }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "Your account is blocked." }, { status: 403 });
    }
    if (Number.isInteger(error?.status)) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error("--- CREATE CARD ERROR ---");
    console.error(error);
    console.error("-------------------------");
    return NextResponse.json(
      { message: error.message || "Failed to create card" },
      { status: 400 }
    );
  }
}
