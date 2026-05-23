import GlobalPrayerRoomPage from "@/app/global-prayer-room/page";
import { getDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

const text = getDictionary("en").globalRoom;

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: text.metadataTitle,
  description: text.metadataDescription,
  path: "/en/global-prayer-room",
  image: "/img/categories/world.jpg",
  keywords: ["Start Pray", "global prayer room", "prayer map", "voice prayer"],
});

export default function EnglishGlobalPrayerRoomPage() {
  return <GlobalPrayerRoomPage locale="en" />;
}
