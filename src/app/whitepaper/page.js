import { redirect } from "next/navigation";

export const metadata = {
  title: "平台原則與信任說明 | Start Pray",
  robots: {
    index: false,
    follow: false,
  },
};

export default function DeprecatedWhitepaperPage() {
  redirect("/terms");
}
