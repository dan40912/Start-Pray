import { toGlobalPrayerPayload } from "@/lib/globalPrayerPayload";
import { readActiveCategories } from "@/lib/homeCategories";
import { readHomeStats } from "@/lib/homeStats";
import { getDictionary } from "@/lib/i18n";
import prisma from "@/lib/prisma";

// 首頁地球下方與 /terms 最上方共用同一排數據，兩邊的數字必須一致，
// 所以「祝福光點」的取樣範圍跟首頁地球一樣：最近 100 則有位置的代禱。
const LOCATION_SAMPLE_SIZE = 100;

export function countLocationLights(globalPrayers) {
  return new Set(
    globalPrayers.map((prayer) => {
      const lat = Number(prayer.locationLat);
      const lng = Number(prayer.locationLng);
      return `${prayer.locationCity || "approx"}::${lat.toFixed(3)}::${lng.toFixed(3)}`;
    })
  ).size;
}

export function buildPlatformStats({ stats, locationLights, categoryCount, text }) {
  const proofText = text?.proofStats || getDictionary("zh-TW").home.proofStats;
  const rows = [
    ["totalPrayerCards", stats.totalPrayerCards],
    ["totalResponses", stats.totalResponses],
    ["totalVoiceResponses", stats.totalVoiceResponses],
    ["totalUsers", stats.totalUsers],
    ["locationLights", locationLights],
    ["categories", categoryCount],
  ];

  return rows.map(([key, value]) => ({
    key,
    value: Number(value || 0),
    label: proofText[key][0],
    copy: proofText[key][1],
  }));
}

export async function readPlatformStats({ locale = "zh-TW", text } = {}) {
  const [stats, categories, locatedCards] = await Promise.all([
    readHomeStats(),
    readActiveCategories(),
    prisma.homePrayerCard.findMany({
      where: {
        isBlocked: false,
        locationCity: { not: null },
        locationLat: { not: null },
        locationLng: { not: null },
      },
      orderBy: [{ createdAt: "desc" }],
      take: LOCATION_SAMPLE_SIZE,
      select: {
        id: true,
        isPrivate: true,
        locationCity: true,
        locationLat: true,
        locationLng: true,
      },
    }),
  ]);

  return buildPlatformStats({
    stats,
    locationLights: countLocationLights(locatedCards.map((card) => toGlobalPrayerPayload(card, locale))),
    categoryCount: categories.length,
    text: text || getDictionary(locale).home,
  });
}
