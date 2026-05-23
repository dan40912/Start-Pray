import PrayforWallPage from "@/app/prayfor/page";
import { getDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

const text = getDictionary("en").prayerWall;

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: text.metadataTitle,
  description: text.metadataDescription,
  path: "/en/prayfor",
  image: "/img/categories/popular.jpg",
});

export default function EnglishPrayforWallPage(props) {
  return <PrayforWallPage {...props} locale="en" />;
}
