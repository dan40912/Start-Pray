import SignupPage from "@/app/signup/page";
import { getDictionary } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

const text = getDictionary("en").auth.signup;

export const metadata = buildPageMetadata({
  title: text.metadataTitle,
  description: text.metadataDescription,
  path: "/en/signup",
  noIndex: true,
});

export default function EnglishSignupPage() {
  return <SignupPage locale="en" />;
}
