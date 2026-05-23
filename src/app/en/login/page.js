import LoginPage from "@/app/login/page";
import { getDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

const text = getDictionary("en").auth.login;

export const metadata = buildPageMetadata({
  title: text.metadataTitle,
  description: text.metadataDescription,
  path: "/en/login",
  noIndex: true,
});

export default function EnglishLoginPage() {
  return <LoginPage locale="en" />;
}
