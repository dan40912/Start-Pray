import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "編輯代禱",
  description: "登入後管理與編輯你的代禱。",
  path: "/customer-portal/edit",
  noIndex: true,
});

export default function CustomerPortalEditLayout({ children }) {
  return children;
}
