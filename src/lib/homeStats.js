import prisma from "./prisma";

export async function readHomeStats() {
  const publicHomeCardResponseWhere = {
    isBlocked: false,
    homeCard: {
      is: {
        isBlocked: false,
        isPrivate: false,
      },
    },
  };

  const [totalPrayerCards, totalUsers, totalResponses, totalVoiceResponses] = await Promise.all([
    prisma.homePrayerCard.count({ where: { isBlocked: false, isPrivate: false } }),
    prisma.user.count({ where: { isBlocked: false } }),
    prisma.prayerResponse.count({ where: publicHomeCardResponseWhere }),
    prisma.prayerResponse.count({
      where: {
        ...publicHomeCardResponseWhere,
        voiceUrl: { not: null },
      },
    }),
  ]);

  return {
    totalPrayerCards,
    totalUsers,
    totalResponses,
    totalVoiceResponses,
  };
}
