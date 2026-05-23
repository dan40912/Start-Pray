import prisma from "./prisma";
import { buildOvercomerSlug } from "./overcomer";

const RESPONSES_TAKE = 20;
const CARDS_TAKE = 12;
const INDEX_TAKE = 18;

const PUBLIC_HOME_CARD_WHERE = {
  isBlocked: false,
  isPrivate: false,
};

const PUBLIC_RESPONSE_WHERE = {
  isBlocked: false,
  reportCount: 0,
  homeCardId: { not: null },
  homeCard: {
    is: PUBLIC_HOME_CARD_WHERE,
  },
};

const OVERCOMER_SELECT = {
  id: true,
  name: true,
  username: true,
  bio: true,
  avatarUrl: true,
  storyAudioUrl: true,
  storyYoutubeUrl: true,
  storyUpdatedAt: true,
  createdAt: true,
  updatedAt: true,
  publicProfileEnabled: true,
  homePrayerCards: {
    where: PUBLIC_HOME_CARD_WHERE,
    orderBy: { createdAt: "desc" },
    take: CARDS_TAKE,
    select: {
      id: true,
      title: true,
      description: true,
      image: true,
      alt: true,
      detailsHref: true,
      updatedAt: true,
      _count: { select: { responses: true } },
    },
  },
  prayerResponses: {
    where: PUBLIC_RESPONSE_WHERE,
    orderBy: { createdAt: "desc" },
    take: RESPONSES_TAKE,
    select: {
      id: true,
      message: true,
      voiceUrl: true,
      reportCount: true,
      createdAt: true,
      homeCard: {
        select: {
          id: true,
          title: true,
          image: true,
          alt: true,
          detailsHref: true,
          slug: true,
        },
      },
    },
  },
  _count: {
    select: {
      homePrayerCards: { where: PUBLIC_HOME_CARD_WHERE },
      prayerResponses: { where: PUBLIC_RESPONSE_WHERE },
    },
  },
};

function enrichProfile(user) {
  if (!user) return null;
  return {
    ...user,
    slug: buildOvercomerSlug(user),
    homePrayerCards: user.homePrayerCards ?? [],
    prayerResponses: user.prayerResponses ?? [],
  };
}

export async function readOvercomerProfile(username) {
  const raw = username?.trim();
  if (!raw) return null;

  const normalized = raw.toLowerCase();

  let user = null;
  try {
    user = await prisma.user.findFirst({
      where: {
        username: { equals: normalized, mode: "insensitive" },
        isBlocked: false,
        publicProfileEnabled: true,
      },
      select: OVERCOMER_SELECT,
    });
  } catch (error) {
    console.warn("[overcomer] findFirst failed, fallback to findUnique", error);
    user = await prisma.user.findFirst({
      where: {
        username: normalized,
        isBlocked: false,
        publicProfileEnabled: true,
      },
      select: OVERCOMER_SELECT,
    });
  }

  return enrichProfile(user);
}

export async function listPublicOvercomers() {
  const users = await prisma.user.findMany({
    where: {
      isBlocked: false,
      publicProfileEnabled: true,
      username: { not: null },
    },
    orderBy: [
      { updatedAt: "desc" },
      { createdAt: "desc" },
    ],
    take: INDEX_TAKE,
    select: {
      id: true,
      name: true,
      username: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      updatedAt: true,
      homePrayerCards: {
        where: PUBLIC_HOME_CARD_WHERE,
        select: { id: true },
      },
      prayerResponses: {
        where: PUBLIC_RESPONSE_WHERE,
        select: { id: true },
      },
    },
  });

  return users
    .map((user) => ({
      ...user,
      _count: {
        homePrayerCards: user.homePrayerCards?.length ?? 0,
        prayerResponses: user.prayerResponses?.length ?? 0,
      },
      slug: buildOvercomerSlug(user),
    }))
    .filter((user) => Boolean(user.slug));
}

export function buildOvercomerCardPath(card) {
  if (!card?.id) return null;
  return `/prayfor/${card.id}`;
}

export function buildOvercomerResponsePath(response) {
  const card = response?.homeCard;
  if (!card?.id) return null;
  return `/prayfor/${card.id}`;
}
