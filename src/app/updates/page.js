import PlatformUpdatesPage, { updatesMetadata } from "@/components/PlatformUpdatesPage";

export const metadata = updatesMetadata("zh-TW");

export default function UpdatesPage() {
  return <PlatformUpdatesPage locale="zh-TW" />;
}
