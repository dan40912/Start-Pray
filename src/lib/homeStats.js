import prisma from "./prisma";

export async function readHomeStats() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const publicHomeCardWhere = { isBlocked: false, isPrivate: false };
  const publicResponseWhere = {
    isBlocked: false,
    reportCount: 0,
    homeCard: publicHomeCardWhere,
  };

  const [
    totalPrayerCards,
    totalUsers,
    totalVoiceResponses,
    totalPublicResponses,
    recentPublicResponses,
    anonymousResponses,
  ] = await Promise.all([
    prisma.homePrayerCard.count({ where: publicHomeCardWhere }),
    prisma.user.count({ where: { isBlocked: false } }),
    prisma.prayerResponse.count({
      where: {
        ...publicResponseWhere,
        voiceUrl: { not: null },
      },
    }),
    prisma.prayerResponse.count({ where: publicResponseWhere }),
    prisma.prayerResponse.count({
      where: {
        ...publicResponseWhere,
        createdAt: { gte: thirtyDaysAgo },
      },
    }),
    prisma.prayerResponse.count({
      where: {
        ...publicResponseWhere,
        isAnonymous: true,
      },
    }),
  ]);

  return {
    totalPrayerCards,
    totalUsers,
    totalVoiceResponses,
    totalPublicResponses,
    recentPublicResponses,
    anonymousResponses,
  };
}
