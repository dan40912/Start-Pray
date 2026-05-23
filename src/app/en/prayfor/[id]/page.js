import PrayerDetailPage, { dynamic } from "@/app/prayfor/[id]/page";
import { readHomeCard } from "@/lib/homeCards";
import { sanitizeHtmlToPlainText } from "@/lib/htmlSanitizer";
import { buildPageMetadata } from "@/lib/seo";

export { dynamic };

function parseId(paramValue) {
  const raw = typeof paramValue === "string" ? paramValue.trim() : "";
  const match = raw.match(/^(\d+)/);
  return match ? Number(match[1]) : null;
}

function buildDescription(description) {
  const plain = sanitizeHtmlToPlainText(description).replace(/\s+/g, " ").trim();
  if (!plain) return "Pray with this need on Start Pray.";
  const snippet = plain.length > 130 ? `${plain.slice(0, 130).trim()}...` : plain;
  return `Pray with this need on Start Pray: ${snippet}`;
}

export async function generateMetadata({ params }) {
  const id = parseId(params?.id);
  if (!id) {
    return buildPageMetadata({
      title: "Prayer detail",
      description: "Pray with this need on Start Pray.",
      path: "/en/prayfor",
      image: "/img/categories/popular.jpg",
      locale: "en",
    });
  }
  const card = await readHomeCard(id);
  if (!card) {
    return buildPageMetadata({
      title: "Prayer detail",
      description: "Pray with this need on Start Pray.",
      path: "/en/prayfor",
      image: "/img/categories/popular.jpg",
      locale: "en",
    });
  }
  return buildPageMetadata({
    title: card.title ? `${card.title} - Prayer detail` : "Prayer detail",
    description: buildDescription(card.description),
    path: `/en/prayfor/${card.id}`,
    image: card.image || "/img/categories/popular.jpg",
    type: "article",
    locale: "en",
  });
}

export default function EnglishPrayerDetailPage(props) {
  return <PrayerDetailPage {...props} locale="en" />;
}
