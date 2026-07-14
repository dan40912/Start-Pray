import prisma from "./prisma";

const CARD_DEFAULT_INCLUDE = {
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
      responses: { where: { isBlocked: false, moderationStatus: "APPROVED" } },
    },
  },
};

function parseLimit(limit) {
  const value = Number(limit);
  if (!Number.isFinite(value) || value <= 0) {
    return undefined;
  }
  return Math.floor(value);
}

function buildWhereClause({ categorySlug, categoryId, search }) {
  const where = {
    isBlocked: false,
    isPrivate: false,
    needsReview: false, // PRD-005:待審卡片不出現在公開列表
  };
  const and = [];

  if (categoryId) {
    and.push({ categoryId: Number(categoryId) });
  } else if (categorySlug) {
    and.push({ category: { slug: categorySlug } });
  }

  const normalizedQuery = search?.trim();
  if (normalizedQuery) {
    const makeContainsFilter = () => ({ contains: normalizedQuery });
    and.push({
      OR: [
        { title: makeContainsFilter() },
        { description: makeContainsFilter() },
        { category: { name: makeContainsFilter() } },
      ],
    });
  }

  if (and.length > 0) {
    where.AND = and;
  }

  return where;
}

function buildOrder(sort) {
  if (sort === "responses") {
    return [{ responses: { _count: "desc" } }, { createdAt: "desc" }];
  }
  if (sort === "needsPrayer") {
    // 回應數少的優先,同回應數時最久未建立(最舊)優先 → 最需要陪伴
    return [{ responses: { _count: "asc" } }, { createdAt: "asc" }];
  }
  if (sort === "recent" || sort === "created") {
    return [{ createdAt: "desc" }];
  }
  if (sort === "updated") {
    return [{ updatedAt: "desc" }];
  }

  return [{ sortOrder: "asc" }, { createdAt: "desc" }];
}

export async function readHomeCards(options = {}) {
  const { sort = "recent", limit, skip, categorySlug, categoryId, search, include } = options;

  const orderBy = buildOrder(sort);
  const where = buildWhereClause({ categorySlug, categoryId, search });

  return prisma.homePrayerCard.findMany({
    where,
    include: include ?? CARD_DEFAULT_INCLUDE,
    orderBy,
    take: parseLimit(limit),
    skip: Number.isFinite(skip) && skip > 0 ? Math.floor(skip) : undefined,
  });
}

export async function readHomeCard(id) {
  console.log("[homeCards] readHomeCard", { id });
  return prisma.homePrayerCard.findFirst({
    where: { id: Number(id), isBlocked: false, isPrivate: false },
    include: {
      category: true,
      owner: { select: { id: true, name: true, avatarUrl: true, bio: true } },
      _count: { select: { responses: { where: { isBlocked: false, moderationStatus: "APPROVED" } } } },
    },
  });
}

export async function createHomeCard(payload = {}) {
  const cardOwnerId = payload.ownerId;
  if (cardOwnerId != null && typeof cardOwnerId !== "string") {
    throw new Error("Owner ID must be a string when provided");
  }

  return prisma.homePrayerCard.create({
    data: {
      slug: payload.slug || crypto.randomUUID(),
      image: payload.image || "/img/personal.jpg",
      alt: payload.alt || "",
      title: payload.title || "Untitled",
      description: payload.description || "",
      tags: payload.tags || [],
      meta: payload.meta || [],
      detailsHref: payload.detailsHref || "",
      voiceHref: payload.voiceHref || "", // 蝣箔??ㄐ銝?雿輻 TEMP_VOICE_URL
      locationCity: payload.locationCity || null,
      locationCountry: payload.locationCountry || null,
      locationLat: payload.locationLat ?? null,
      locationLng: payload.locationLng ?? null,
      isPrivate: Boolean(payload.isPrivate),
      needsReview: Boolean(payload.needsReview),
      categoryId: Number(payload.categoryId),
      ownerId: cardOwnerId ?? null,
    },
    include: CARD_DEFAULT_INCLUDE,
  });
}

export async function readRelatedHomeCards(id, limit = 3) {
  console.log("[homeCards] readRelatedHomeCards", { id, limit });
  return prisma.homePrayerCard.findMany({
    where: { id: { not: Number(id) }, isBlocked: false, isPrivate: false },
    orderBy: [{ createdAt: "desc" }],
    take: Math.max(0, Number(limit) || 0),
    include: CARD_DEFAULT_INCLUDE,
  });
}

export async function readAdjacentHomeCards(id) {
  const cardId = Number(id);
  if (!Number.isInteger(cardId) || cardId <= 0) {
    return { prev: null, next: null };
  }

  const [prev, next] = await Promise.all([
    prisma.homePrayerCard.findFirst({
      where: {
        isBlocked: false,
        isPrivate: false,
        id: { lt: cardId },
      },
      orderBy: [{ id: "desc" }],
      include: CARD_DEFAULT_INCLUDE,
    }),
    prisma.homePrayerCard.findFirst({
      where: {
        isBlocked: false,
        isPrivate: false,
        id: { gt: cardId },
      },
      orderBy: [{ id: "asc" }],
      include: CARD_DEFAULT_INCLUDE,
    }),
  ]);

  return { prev, next };
}
