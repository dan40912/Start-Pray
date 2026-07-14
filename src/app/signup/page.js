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
  const stepItems = text.steps.map(([index, title, description]) => ({ index, title, description }));

  return (
    <>
      <SiteHeader activePath={localizePath("/signup", locale)} locale={locale} />

      <main className="auth-page auth-page--signup">
        <div className="auth-wrapper">
          <div className="auth-grid">
            {/* Hero Section */}
            <section className="auth-card auth-hero">
              <div>
                <span className="badge-mini">{text.badge}</span>
                <h1>{text.heroTitle}</h1>
                <p>{text.heroCopy}</p>
              </div>

              <div className="stepper">
                {stepItems.map((step) => (
                  <div key={step.index} className="step-item">
                    <div className="step-index">{step.index}</div>
                    <div className="step-body">
                      <h3>{step.title}</h3>
                      <p>{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* <div className="hero-stats">
                {heroStats.map((stat) => (
                  <div key={stat.label} className="hero-stat">
                    <span>{stat.label}</span>
                    <strong>{stat.value}</strong>
                  </div>
                ))}
              </div> */}
            </section>

            {/* Signup Section */}
            <section className="auth-card">
              <div>
                <h1>{text.title}</h1>
                <p>{text.copy}</p>
              </div>
{/* 
              <div className="social-buttons">
                <button className="social-button google" type="button">
                  使用 Google 註冊
                </button>
                <button className="social-button facebook" type="button">
                  使用 Facebook 註冊
                </button>
              </div> */}
{/* 
              <div className="auth-divider">或使用電子信箱註冊</div> */}

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

            {/* Side Notes */}
            {/* <aside className="auth-card">
              <div className="auth-note">
                <strong>為什麼需要註冊？</strong>
                <ul className="auth-meta-list">
                  {signupReasons.map((reason) => (
                    <li key={reason}>{reason}</li>
                  ))}
                </ul>
              </div>
              <div className="auth-note">
                <strong>註冊後你可以做什麼？</strong>
                <ul className="auth-meta-list">
                  {postSignupBenefits.map((benefit) => (
                    <li key={benefit}>{benefit}</li>
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
