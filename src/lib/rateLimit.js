// PRD-005 — 以資料庫計數實作的頻率限制(不使用 Redis / 外部套件)。
import prisma from "@/lib/prisma";

// 預設門檻(集中於此,方便調整)
export const RATE_LIMITS = {
  createCard: { windowMs: 60 * 60 * 1000, max: 5 },
  createResponse: { windowMs: 60 * 60 * 1000, max: 20 },
};

const COUNTERS = {
  createCard: (userId, since) =>
    prisma.homePrayerCard.count({
      where: { ownerId: userId, createdAt: { gte: since } },
    }),
  createResponse: (userId, since) =>
    prisma.prayerResponse.count({
      where: { responderId: userId, createdAt: { gte: since } },
    }),
};

/**
 * @returns {Promise<{ allowed: boolean, current: number, max: number, retryAfterSeconds: number }>}
 */
export async function checkRateLimit({ userId, action, multiplier = 1 }) {
  const config = RATE_LIMITS[action];
  const counter = COUNTERS[action];
  if (!userId || !config || !counter) {
    return { allowed: true, current: 0, max: Infinity, retryAfterSeconds: 0 };
  }
  const since = new Date(Date.now() - config.windowMs);
  const current = await counter(userId, since);
  const max = Math.max(1, Math.floor(config.max * multiplier));
  return {
    allowed: current < max,
    current,
    max,
    retryAfterSeconds: Math.ceil(config.windowMs / 1000),
  };
}
