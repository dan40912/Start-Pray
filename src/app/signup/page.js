import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";
import SignupForm from "./SignupForm";

export const metadata = buildPageMetadata({
  title: "註冊",
  description: "建立 Start Pray 帳號，開始發佈禱告內容並用文字彼此陪伴。",
  path: "/signup",
  noIndex: true,
});

export default function SignupPage({ locale: localeProp = "zh-TW" } = {}) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).auth.signup;

  return (
    <>
      <SiteHeader activePath={localizePath("/signup", locale)} locale={locale} />
      <main className="auth-page auth-page--compact auth-page--signup">
        <div className="auth-wrapper">
          <section className="auth-card auth-card--compact auth-card--signup">
            <div className="auth-card__intro">
              <h1>{text.title}</h1>
              <p>{text.copy}</p>
            </div>

            <SignupForm locale={locale} />

            <div className="auth-footer">
              <span>
                {text.footerPrefix}
                <Link href={localizePath("/login", locale)} prefetch={false}>
                  {text.footerLink}
                </Link>
                {text.footerSuffix}
              </span>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter locale={locale} />
    </>
  );
}
