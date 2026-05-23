import HomePrayerExplorer from "@/components/HomePrayerExplorer";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { readActiveCategories } from "@/lib/homeCategories";
import { readHomeCards } from "@/lib/homeCards";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "禱告牆",
  description: "瀏覽 Start Pray 代禱牆，找到需要陪伴的人，透過文字或語音留下真實的禱告回應。",
  path: "/prayfor",
  image: "/img/categories/popular.jpg",
});

const WALL_CARD_LIMIT = 24;
const WALL_SORT_OPTIONS = [
  { key: "responses", label: "熱門", helper: "最多人回應" },
  { key: "recent", label: "最新", helper: "剛建立的需要" },
  { key: "needsPrayer", label: "最需要禱告", helper: "回應較少、較新的需要" },
];
const ALLOWED_SORTS = new Set(WALL_SORT_OPTIONS.map((option) => option.key));

export default async function PrayforWallPage({ searchParams = {}, locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).prayerWall;
  const sortText = text.sortOptions;
  const localizedSortOptions = WALL_SORT_OPTIONS.map((option) => ({
    ...option,
    label: sortText[option.key]?.[0] || option.label,
    helper: sortText[option.key]?.[1] || option.helper,
  }));
  const requestedSort = typeof searchParams?.sort === "string" ? searchParams.sort : "";
  const initialSort = ALLOWED_SORTS.has(requestedSort) ? requestedSort : "responses";
  const [categories, topCards] = await Promise.all([
    readActiveCategories(),
    readHomeCards({ sort: initialSort, limit: WALL_CARD_LIMIT }),
  ]);

  return (
    <>
      <SiteHeader activePath={localizePath("/prayfor", locale)} locale={locale} />

      <main>
        <section>
          <HomePrayerExplorer
            initialCategories={categories}
            initialCards={topCards}
            cardLimit={WALL_CARD_LIMIT}
            initialSort={initialSort}
            showSortControls
            sortOptions={localizedSortOptions}
            locale={locale}
          />
        </section>
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
