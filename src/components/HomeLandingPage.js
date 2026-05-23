import Link from "next/link";

import HomeGlobeHero from "@/components/HomeGlobeHero";
import HomePrayerExplorer from "@/components/HomePrayerExplorer";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { readActiveCategories } from "@/lib/homeCategories";
import { readHomeCards } from "@/lib/homeCards";
import { readHomeStats } from "@/lib/homeStats";
import prisma from "@/lib/prisma";
import { SITE_URL, absoluteUrl, buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

const PAGE_TEXT = {
  trustTitle: "更多認識 Start Pray",
  aboutTitle: "我們為什麼做這件事",
  aboutCopy: "我希望有需要的人，可以安全地說出來；也希望有心代禱的人，不只是按個讚，而是真的能參與進去。",
  howtoTitle: "如何參與",
  howtoCopy: "你可以先看看禱告牆，留一句話、錄一段聲音，或把需要帶回小組一起禱告。",
  policyTitle: "信任與平台原則",
  policyCopy: "我希望這裡是可以安心使用的地方，所以保留匿名、檢舉，也不顯示精準位置。",
  learnMore: "了解平台",
  guide: "看如何開始",
  whitepaper: "閱讀信任說明",
};
const HOME_SORT_OPTIONS = [
  { key: "responses", label: "熱門代禱", helper: "已經有人開始回應" },
  { key: "needsPrayer", label: "更需要代禱", helper: "回應還比較少的需要" },
];
const HOME_STEPS = [
  {
    title: "先看見需要",
    copy: "先從禱告牆或全球代禱室開始，看看有哪些人正需要被記念。",
  },
  {
    title: "留下你的禱告",
    copy: "可以只是一句話，也可以是一段聲音。不需要說得很完整，真誠就好。",
  },
  {
    title: "帶進小組",
    copy: "有些需要不該只有一個人承擔，也可以分享給小組或教會一起禱告。",
  },
];
const PRIVACY_POINTS = [
  "你可以用暱稱，也可以匿名回應。",
  "地圖只會顯示大概位置，不會顯示精準定位。",
  "選擇私密的代禱，不會出現在公開禱告牆或公開詳頁。",
];

function toGlobalPrayerPayload(card) {
  const isPrivate = Boolean(card.isPrivate);

  return {
    id: card.id,
    isPrivate,
    title: isPrivate ? "匿名代禱" : card.title,
    description: isPrivate ? "這個城市有人正需要被記念。" : card.description,
    createdAt: card.createdAt?.toISOString?.() ?? null,
    voiceHref: isPrivate ? null : card.voiceHref,
    locationCity: card.locationCity,
    locationCountry: card.locationCountry,
    locationLat: Number(card.locationLat),
    locationLng: Number(card.locationLng),
    category: isPrivate ? null : card.category,
    owner: isPrivate ? null : card.owner,
    responseCount: isPrivate ? 0 : card._count?.responses ?? 0,
    audioCount: isPrivate
      ? 0
      : (card.responses || []).filter((response) => Boolean(response.voiceUrl)).length,
  };
}

function buildHeroStats(stats, globalPrayers) {
  const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
  const locationLights = new Set(
    globalPrayers.map((prayer) => {
      const lat = Number(prayer.locationLat);
      const lng = Number(prayer.locationLng);
      return `${prayer.locationCity || "approx"}::${lat.toFixed(3)}::${lng.toFixed(3)}`;
    })
  ).size;
  const todayNew = globalPrayers.filter((prayer) => {
    const time = prayer.createdAt ? new Date(prayer.createdAt).getTime() : 0;
    return Number.isFinite(time) && time >= oneDayAgo;
  }).length;
  const audioPrayers = globalPrayers.filter(
    (prayer) => prayer.voiceHref || Number(prayer.audioCount || 0) > 0
  ).length;

  return {
    totalPrayers: stats.totalPrayerCards.toLocaleString("zh-TW"),
    locationLights: locationLights.toLocaleString("zh-TW"),
    todayNew: todayNew.toLocaleString("zh-TW"),
    audioPrayers: audioPrayers.toLocaleString("zh-TW"),
  };
}

function toClientValue(value) {
  if (value == null) return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  if (typeof value.toNumber === "function") return value.toNumber();
  if (Array.isArray(value)) return value.map(toClientValue);

  return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, toClientValue(entry)]));
}

function formatStat(value) {
  return Number(value || 0).toLocaleString("zh-TW");
}

function HomeStorySection() {
  return (
    <section className="section home-story">
      <div className="section__container home-story__grid">
        <div>
          <p className="section-kicker">WHY START PRAY</p>
          <h2>為什麼我想做 Start Pray</h2>
        </div>
        <div className="home-story__copy">
          <p>
            有些需要不一定會出現在聚會裡，也不一定能很快說出口。有時候，人只敢先寫下一句話，或只希望有人願意聽見。
          </p>
          <p>
            我希望 Start Pray 可以成為一個比較安靜、清楚的入口。讓需要被看見，也讓有心代禱的人知道自己可以怎麼參與。
          </p>
        </div>
      </div>
    </section>
  );
}

function HomeHowToSection() {
  return (
    <section className="section home-start">
      <div className="section__container">
        <div className="section-heading">
          <p className="section-kicker">HOW TO START</p>
          <h2>可以從這裡開始</h2>
        </div>
        <div className="home-start__grid">
          {HOME_STEPS.map((step, index) => (
            <article className="home-start__card" key={step.title}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

function HomeVoicePrivacySection() {
  return (
    <section className="section home-care">
      <div className="section__container home-care__grid">
        <article>
          <p className="section-kicker">VOICE</p>
          <h2>聲音會讓禱告更靠近</h2>
          <p>
            有時候一段短短的聲音，比一大段文字更容易讓人感覺被記念。你可以聽見別人的需要，也可以用自己的聲音為他禱告。
          </p>
        </article>
        <article>
          <p className="section-kicker">PRIVACY</p>
          <h2>哪些內容會被看見</h2>
          <ul>
            {PRIVACY_POINTS.map((point) => (
              <li key={point}>{point}</li>
            ))}
          </ul>
          <Link href="/whitepaper" className="link-arrow" prefetch={false}>
            查看我們怎麼保護這個空間
          </Link>
        </article>
      </div>
    </section>
  );
}

function HomeResponseStatsSection({ stats }) {
  const statItems = [
    { label: "公開代禱", value: formatStat(stats.totalPrayerCards), copy: "目前公開被看見的需要" },
    { label: "公開回應", value: formatStat(stats.totalPublicResponses), copy: "大家用文字和聲音留下的回應" },
    { label: "30 天內回應", value: formatStat(stats.recentPublicResponses), copy: "最近仍然有人在參與" },
    { label: "語音回應", value: formatStat(stats.totalVoiceResponses), copy: "用聲音為人禱告的紀錄" },
  ];

  return (
    <section className="section home-response-stats">
      <div className="section__container">
        <div className="section-heading">
          <p className="section-kicker">LIVE CARE</p>
          <h2>這裡真的有人在回應</h2>
          <p>這裡只統計公開、未封鎖、未被檢舉的內容。私密代禱不會被拿來做公開數字。</p>
        </div>
        <div className="home-response-stats__grid">
          {statItems.map((item) => (
            <article key={item.label}>
              <strong>{item.value}</strong>
              <span>{item.label}</span>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export const metadata = buildPageMetadata({
  title: "Start Pray 一起禱告吧",
  description:
    "Start Pray 讓你分享代禱需要，也用文字和聲音參與別人的禱告。",
  path: "/",
  image: "/img/categories/popular.jpg",
  keywords: ["Start Pray", "一起禱告", "代禱平台", "語音禱告", "全球禱告地圖", "基督徒禱告"],
});

function HomeStructuredData({ stats, globalPrayerCount }) {
  const data = {
    "@context": "https://schema.org",
    "@type": "WebPage",
    "@id": `${SITE_URL}/#home`,
    url: SITE_URL,
    name: "Start Pray 一起禱告吧",
    description:
      "看見正在被記念的代禱需要，也用文字和聲音參與別人的禱告。",
    inLanguage: "zh-Hant-TW",
    isPartOf: {
      "@id": `${SITE_URL}/#website`,
    },
    about: [
      "禱告",
      "代禱",
      "語音禱告",
      "全球禱告地圖",
      "基督信仰社群",
    ],
    primaryImageOfPage: {
      "@type": "ImageObject",
      url: absoluteUrl("/img/categories/popular.jpg"),
    },
    mainEntity: {
      "@type": "ItemList",
      name: "全球代禱摘要",
      numberOfItems: Number(globalPrayerCount || 0),
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "全球代禱數",
          description: String(stats?.totalPrayers || "0"),
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "地圖光點",
          description: String(stats?.locationLights || "0"),
        },
        {
          "@type": "ListItem",
          position: 3,
          name: "24 小時新增",
          description: String(stats?.todayNew || "0"),
        },
      ],
    },
    potentialAction: {
      "@type": "ViewAction",
      target: `${SITE_URL}/global-prayer-room`,
      name: "進入全球禱告室",
    },
  };

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

export default async function HomeLandingPage() {
  const [categories, topCards, stats, globalPrayerCards] = await Promise.all([
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
  ]);

  const globalPrayers = globalPrayerCards.map(toGlobalPrayerPayload);
  const heroStats = buildHeroStats(stats, globalPrayers);
  const clientCategories = toClientValue(categories);
  const clientTopCards = toClientValue(topCards);

  return (
    <>
      <SiteHeader activePath="/" />

      <main className="home-page">
        <HomeStructuredData stats={heroStats} globalPrayerCount={globalPrayers.length} />
        <HomeGlobeHero
          prayers={globalPrayers}
          primaryHref="/global-prayer-room"
          secondaryHref="/customer-portal/create"
          stats={heroStats}
        />

        <HomeStorySection />
        <HomeHowToSection />
        <HomeVoicePrivacySection />

        <section>
          <HomePrayerExplorer
            initialCategories={clientCategories}
            initialCards={clientTopCards}
            initialSort="responses"
            showSortControls
            sortOptions={HOME_SORT_OPTIONS}
            moreHref="/prayfor?sort=needsPrayer"
            moreLabel="看看還有哪些人需要代禱"
          />
        </section>

        <section className="section bg-legal-links" id="trust-links">
          <div className="section__container">
            <h2>{PAGE_TEXT.trustTitle}</h2>
            <div className="info-links-grid">
              <div className="info-link-group">
                <h3>{PAGE_TEXT.aboutTitle}</h3>
                <p>{PAGE_TEXT.aboutCopy}</p>
                <Link href="/about" className="link-arrow" prefetch={false}>
                  {PAGE_TEXT.learnMore}
                </Link>
              </div>
              <div className="info-link-group">
                <h3>{PAGE_TEXT.howtoTitle}</h3>
                <p>{PAGE_TEXT.howtoCopy}</p>
                <Link href="/howto" className="link-arrow" prefetch={false}>
                  {PAGE_TEXT.guide}
                </Link>
              </div>
              <div className="info-link-group">
                <h3>{PAGE_TEXT.policyTitle}</h3>
                <p>{PAGE_TEXT.policyCopy}</p>
                <Link href="/whitepaper" className="link-arrow" prefetch={false}>
                  {PAGE_TEXT.whitepaper}
                </Link>
              </div>
            </div>
          </div>
        </section>
        <HomeResponseStatsSection stats={stats} />
      </main>

      <SiteFooter />
    </>
  );
}
