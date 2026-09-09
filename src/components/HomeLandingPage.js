import Link from "next/link";

import HomeGlobeHero from "@/components/HomeGlobeHero";
import HomePrayerExplorer from "@/components/HomePrayerExplorer";
import HomePrayerHero from "@/components/HomePrayerHero";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { toGlobalPrayerPayload } from "@/lib/globalPrayerPayload";
import { readActiveCategories } from "@/lib/homeCategories";
import { readHomeCards } from "@/lib/homeCards";
import { readHomeStats } from "@/lib/homeStats";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import prisma from "@/lib/prisma";
import { SITE_URL, absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PAGE_TEXT = getDictionary("zh-TW").home;

function buildHeroStats(stats, globalPrayers, locale = "zh-TW") {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const locationLights = countLocationLights(globalPrayers);
  const todayNew = globalPrayers.filter((prayer) => {
    const time = prayer.createdAt ? new Date(prayer.createdAt).getTime() : 0;
    return Number.isFinite(time) && time >= oneDayAgo;
  }).length;
  const audioPrayers = globalPrayers.filter(
    (prayer) => prayer.voiceHref || Number(prayer.audioCount || 0) > 0
  ).length;

  return {
    totalPrayers: stats.totalPrayerCards.toLocaleString(locale),
    locationLights: locationLights.toLocaleString(locale),
    todayNew: todayNew.toLocaleString(locale),
    audioPrayers: audioPrayers.toLocaleString(locale),
  };
}

function countLocationLights(globalPrayers) {
  return new Set(
    globalPrayers.map((prayer) => {
      const lat = Number(prayer.locationLat);
      const lng = Number(prayer.locationLng);
      return `${prayer.locationCity || "approx"}::${lat.toFixed(3)}::${lng.toFixed(3)}`;
    })
  ).size;
}

function toClientValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(toClientValue);

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toClientValue(entry)]));
}

export const metadata = buildPageMetadata({
  title: "Start Pray 一起禱告吧",
  description:
    "Start Pray 讓你看見全球正在被守望的禱告需要，建立代禱，並透過文字與語音禱告彼此陪伴。",
  path: "/",
  image: "/img/categories/popular.jpg",
  keywords: ["Start Pray", "一起禱告", "代禱平台", "語音禱告", "全球禱告地圖", "基督徒禱告"],
});

function stringifyJsonLd(data) {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}

function HomeStructuredData({ stats, globalPrayerCount, text = PAGE_TEXT, locale = "zh-TW" }) {
  const normalizedLocale = normalizeLocale(locale);
  const isEnglish = normalizedLocale === "en";
  const heroText = text.globeHero || {};
  const homePath = localizePath("/", normalizedLocale);
  const roomPath = localizePath("/global-prayer-room", normalizedLocale);
  const pageUrl = `${SITE_URL}${homePath === "/" ? "" : homePath}`;
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/#home`,
    url: pageUrl,
    name: text.metadataTitle || PAGE_TEXT.metadataTitle,
    description: text.metadataDescription || PAGE_TEXT.metadataDescription,
    inLanguage: isEnglish ? "en" : "zh-Hant-TW",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    about: [
      isEnglish ? "prayer" : "禱告",
      isEnglish ? "prayer needs" : "代禱",
      isEnglish ? "voice prayer" : "語音禱告",
      isEnglish ? "global prayer map" : "全球禱告地圖",
      isEnglish ? "faith community" : "基督信仰社群",
    ],
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl("/img/categories/popular.jpg"),
    },
    mainEntity: {
      "@type": "ItemList",
      name: isEnglish ? "Global prayer summary" : "全球代禱摘要",
      numberOfItems: Number(globalPrayerCount || 0),
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: heroText.totalPrayers || "全球代禱數",
          description: String(stats?.totalPrayers || "0"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: heroText.locationLights || "地圖光點",
          description: String(stats?.locationLights || "0"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: heroText.todayNew || "24 小時新增",
          description: String(stats?.todayNew || "0"),
        },
      ],
    },
    potentialAction: {
      "@type": "ViewAction",
      target: `${SITE_URL}${roomPath}`,
      name: heroText.roomCta || "進入全球禱告室",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: stringifyJsonLd(data) }}
    />
  );
}

function HomeProofSection({ text = PAGE_TEXT, locale = "zh-TW" }) {
  const promises = text.promises.map(([title, copy]) => ({ title, copy }));

  return (
    <section className="home-proof section" aria-labelledby="home-proof-title">
      <div className="section__container home-proof__container">
        <div className="home-proof__head">
          <span>{text.proofEyebrow}</span>
          <h2 id="home-proof-title">{text.proofTitle}</h2>
          <p>{text.proofCopy}</p>
          <div className="home-proof__actions">
            <Link
              href={localizePath("/customer-portal/create", locale)}
              className="home-proof__action home-proof__action--primary"
              prefetch={false}
            >
              {text.proofPrimary}
            </Link>
            <Link href={localizePath("/prayfor/one", locale)} className="home-proof__action" prefetch={false}>
              {text.proofSecondary}
            </Link>
          </div>
        </div>

        <div className="home-proof__promise" aria-labelledby="home-proof-promise-title">
          <h3 id="home-proof-promise-title">{text.promiseTitle}</h3>
          <div className="home-proof__promise-grid">
            {promises.map((item) => (
              <article key={item.title}>
                <strong>{item.title}</strong>
                <p>{item.copy}</p>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function HomeFinalCta({ text = PAGE_TEXT, locale = "zh-TW" }) {
  return (
    <section className="home-final-cta section" aria-labelledby="home-final-cta-title">
      <div className="section__container home-final-cta__panel">
        <div>
          <h2 id="home-final-cta-title">{text.finalCtaTitle}</h2>
          <p>{text.finalCtaCopy}</p>
        </div>
        <div className="home-final-cta__actions">
          <Link
            href={localizePath("/customer-portal/create", locale)}
            className="home-final-cta__button home-final-cta__button--primary"
            prefetch={false}
          >
            {text.finalCtaPrimary}
          </Link>
          <Link href={localizePath("/prayfor/one", locale)} className="home-final-cta__button" prefetch={false}>
            {text.finalCtaSecondary}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default async function HomeLandingPage({ locale: localeProp = "zh-TW" } = {}) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).home;
  const [categories, topCards, stats, globalPrayerCards, featuredPrayerCards] = await Promise.all([
    readActiveCategories(),
    readHomeCards({ sort: "responses", limit: 12 }),
    readHomeStats(),
    prisma.homePrayerCard.findMany({
      where: {
        isBlocked: false,
        locationCity: { not: null },
        locationLat: { not: null },
        locationLng: { not: null },
      },
      orderBy: [{ createdAt: "desc" }],
      take: 100,
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
    }),
    // Hero 一次帶一整副牌。過去只送一張，之後每滑一次都要先打一次
    // /api/home-cards/:id/adjacent 才知道下一張是誰 —— 每一次滑動都在
    // 等一趟往返。首頁本來就已經跑了 12 筆與 100 筆的查詢，多帶 9 張
    // 幾乎沒有成本。
    readHomeCards({ sort: "needsPrayer", limit: 10 }),
  ]);

  const globalPrayers = globalPrayerCards.map((card) => toGlobalPrayerPayload(card, locale));
  const heroStats = buildHeroStats(stats, globalPrayers, locale);
  const clientCategories = toClientValue(categories);
  const clientTopCards = toClientValue(topCards);
  // HomeGlobeHero is a client component, so Date/Decimal values from Prisma
  // have to be flattened the same way the other client props are.
  const clientGlobalPrayers = toClientValue(globalPrayers);
  const featuredPrayers = toClientValue(featuredPrayerCards || []);

  return (
    <>
      <SiteHeader activePath={localizePath("/", locale)} locale={locale} />

      <main className="home-page">
        <HomeStructuredData stats={heroStats} globalPrayerCount={globalPrayers.length} text={text} locale={locale} />
        <HomePrayerHero text={text} prayers={featuredPrayers} />

        <HomeProofSection text={text} locale={locale} />

        <section>
          <HomePrayerExplorer
            initialCategories={clientCategories}
            initialCards={clientTopCards}
            intro={{
              eyebrow: text.explorerEyebrow,
              title: text.explorerTitle,
              copy: text.explorerCopy,
              primaryLabel: text.explorerPrimary,
              primaryHref: localizePath("/customer-portal/create", locale),
              secondaryLabel: text.explorerSecondary,
              secondaryHref: localizePath("/prayfor/one", locale),
            }}
            locale={locale}
          />
        </section>

        <HomeGlobeHero
          prayers={clientGlobalPrayers}
          stats={heroStats}
          primaryHref={localizePath("/global-prayer-room", locale)}
          secondaryHref={localizePath("/customer-portal/create", locale)}
        />

        <section className="section bg-legal-links" id="trust-links">
          <div className="section__container">
            <h2>{text.trustTitle}</h2>
            <div className="info-links-grid">
              <div className="info-link-group">
                <h3>{text.aboutTitle}</h3>
                <p>{text.aboutCopy}</p>
                <Link href={localizePath("/about", locale)} className="link-arrow" prefetch={false}>
                  {text.learnMore}
                </Link>
              </div>
              <div className="info-link-group">
                <h3>{text.howtoTitle}</h3>
                <p>{text.howtoCopy}</p>
                <Link href={localizePath("/howto", locale)} className="link-arrow" prefetch={false}>
                  {text.guide}
                </Link>
              </div>
              <div className="info-link-group">
                <h3>{text.policyTitle}</h3>
                <p>{text.policyCopy}</p>
                <Link href={localizePath("/terms", locale)} className="link-arrow" prefetch={false}>
                  {text.terms}
                </Link>
              </div>
            </div>
          </div>
        </section>

        <HomeFinalCta text={text} locale={locale} />
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
