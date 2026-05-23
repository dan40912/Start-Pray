import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { buildPageMetadata } from "@/lib/seo";

import LoginForm from "./LoginForm";

export const metadata = buildPageMetadata({
  title: "登入",
  description: "登入 Start Pray 會員中心，管理你的禱告內容、留言互動與個人資料。",
  path: "/login",
  noIndex: true,
});

export default function LoginPage({ locale: localeProp = "zh-TW" } = {}) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).auth.login;
  const trustBullets = text.trustBullets;

  return (
    <>
      <SiteHeader activePath={localizePath("/login", locale)} locale={locale} />

      <main>
        <div className="auth-wrapper">
          <div className="auth-grid">
            <section className="auth-card">
              <div>
                <h1>{text.title}</h1>
                <p>{text.copy}</p>
              </div>

              <ul className="auth-trust-list">
                {trustBullets.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>

              {/* <div className="social-buttons">
                <button className="social-button google" type="button">
                  使用 Google 登入
                </button>
                <button className="social-button facebook" type="button">
                  使用 Facebook 登入
                </button>
              </div> */}

              {/* <div className="auth-divider">或使用電子信箱登入</div> */}

              <LoginForm locale={locale} />

              <div className="auth-footer">
                <span>
                  {text.footerPrefix} <Link href={localizePath("/signup", locale)}>{text.footerLink}</Link>{text.footerSuffix}
                </span>
              </div>
            </section>

            {/* <aside className="auth-card">
              <div className="auth-note">
                <strong>登入安全提醒</strong>
                <ul className="auth-meta-list">
                  {securityTips.map((tip) => (
                    <li key={tip}>{tip}</li>
                  ))}
                </ul>
              </div>
              <div className="auth-note">
                <strong>禱告管理快速導覽</strong>
                <ul className="auth-meta-list">
                  {managementHighlights.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </div>
            </aside> */}
          </div>
        </div>
      </main>

      <SiteFooter locale={locale} />
    </>
  );
}
