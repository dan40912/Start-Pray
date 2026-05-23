import HomeLandingPage from "@/components/HomeLandingPage";
import { getDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

const text = getDictionary("en").home;

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: text.metadataTitle,
  description: text.metadataDescription,
  path: "/en",
  image: "/img/categories/popular.jpg",
  keywords: ["Start Pray", "prayer", "prayer wall", "voice prayer", "global prayer room"],
});

export default function EnglishHomePage() {
  return <HomeLandingPage locale="en" />;
}
