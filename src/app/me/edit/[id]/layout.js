import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "編輯代禱內容",
  description: "登入後更新你的代禱內容。",
  path: "/me/edit",
  noIndex: true,
});

export default function CustomerPortalEditIdLayout({ children }) {
  return children;
}
