import { GlobalPrayerRoomPageExperience } from "@/components/GlobalPrayerRoom";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { toGlobalPrayerPayload } from "@/lib/globalPrayerPayload";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import prisma from "@/lib/prisma";
import { SITE_URL, absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "全球禱告室",
  description:
    "在 Start Pray 全球禱告室查看世界各地的代禱光點、最新禱告需求與語音禱告，為城市、家庭、教會與急迫事件一起守望。",
  path: "/global-prayer-room",
  image: "/img/categories/world.jpg",
  keywords: ["全球禱告室", "全球代禱", "禱告地圖", "語音禱告", "城市代禱", "Start Pray"],
});

function stringifyJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function GlobalPrayerRoomStructuredData({ prayers, locale = "zh-TW" }) {
  const text = getDictionary(locale).globalRoom;
  const roomPath = localizePath("/global-prayer-room", locale);
  const publicPrayers = prayers.filter((prayer) => !prayer.isPrivate).slice(0, 12);
  const locations = new Set(
    prayers
      .map((prayer) => `${prayer.locationCity || ""}, ${prayer.locationCountry || ""}`.trim())
      .filter(Boolean)
  );
  const audioCount = prayers.filter(
    (prayer) => prayer.voiceHref || Number(prayer.audioCount || 0) > 0
  ).length;

  const data = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    "@id": `${SITE_URL}${roomPath}#collection`,
    url: `${SITE_URL}${roomPath}`,
    name: text.structuredName,
    description: text.structuredDescription,
    inLanguage: locale === "en" ? "en" : "zh-Hant-TW",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl("/img/categories/world.jpg"),
    },
    about: ["全球代禱", "禱告地圖", "語音禱告", "城市守望"],
    mainEntity: {
      "@type": "ItemList",
      name: text.latestListName,
      numberOfItems: prayers.length,
      itemListElement: publicPrayers.map((prayer, index) => ({
        "@type": "ListItem",
        position: index + 1,
        url: `${SITE_URL}${localizePath(`/prayfor/${prayer.id}`, locale)}`,
        name: prayer.title || text.cityPrayer,
      })),
    },
    additionalProperty: [
      {
        "@type": "PropertyValue",
        name: text.locationCount,
        value: locations.size,
      },
      {
        "@type": "PropertyValue",
        name: text.audioCount,
        value: audioCount,
      },
    ],
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }}
    />
  );
}

export default async function GlobalPrayerRoomPage({ locale: localeProp = "zh-TW" } = {}) {
  const locale = normalizeLocale(localeProp);
  const cards = await prisma.homePrayerCard.findMany({
    where: {
      isBlocked: false,
      locationCity: { not: null },
      locationLat: { not: null },
      locationLng: { not: null },
    },
    orderBy: [{ createdAt: "desc" }],
    take: 200,
    select: {
      id: true,
      isPrivate: true,
      title: true,
      description: true,
      voiceHref: true,
      createdAt: true,
      locationCity: true,
      locationCountry: true,
      locationLat: true,
      locationLng: true,
      category: { select: { name: true, slug: true } },
      owner: { select: { name: true, username: true } },
      responses: {
        where: {
          isBlocked: false,
          reportCount: 0,
          voiceUrl: { not: null },
        },
        select: { voiceUrl: true },
      },
      _count: { select: { responses: true } },
    },
  });

  const prayers = cards.map((card) => toGlobalPrayerPayload(card, locale));

  return (
    <>
      <SiteHeader activePath={localizePath("/global-prayer-room", locale)} locale={locale} />
      <main>
        <GlobalPrayerRoomStructuredData prayers={prayers} locale={locale} />
        <GlobalPrayerRoomPageExperience prayers={prayers} locale={locale} />
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
