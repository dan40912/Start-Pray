import PlatformUpdatesPage, { updatesMetadata } from "@/components/PlatformUpdatesPage";

export const metadata = updatesMetadata("en");

export default function UpdatesPage() {
  return <PlatformUpdatesPage locale="en" />;
}
