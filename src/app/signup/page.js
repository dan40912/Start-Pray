import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { buildPageMetadata } from "@/lib/seo";
import SignupForm from "./SignupForm";

export const metadata = buildPageMetadata({
  title: "註冊",
  description: "建立 Start Pray 帳號，分享代禱需要，也用文字或語音為人禱告。",
  path: "/signup",
  noIndex: true,
});

const stepItems = [
  {
    index: "1",
    title: "分享你的聲音",
    description: "可以先說出你的禱告或心聲，不需要一次講得很完整。"
  },
  {
    index: "2",
    title: "有人會聽見",
    description: "你的聲音不會只是留在原地，願意代禱的人可以真實回應。"
  },
  {
    index: "3",
    title: "彼此陪伴",
    description: "透過文字和語音，一起參與別人的負擔。"
  }
];

export default function SignupPage() {
  return (
    <>
      <SiteHeader activePath="/signup" />

      <main>
        <div className="auth-wrapper">
          <div className="auth-grid">
            {/* Hero Section */}
            <section className="auth-card auth-hero">
              <div>
                <span className="badge-mini">STEP 1 · 分享你的聲音</span>
                <h1>讓你的聲音被聽見</h1>
                <p>
                  只要幾分鐘，分享你的禱告或心聲，別人就能用文字或聲音回應你，
                  讓你知道有人正在一起禱告。
                </p>
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
                <h1>建立 Start Pray 帳戶</h1>
                <p>
                  可以先用暱稱建立帳戶。公開頁只會顯示你選擇的名稱，電子信箱只用於登入與帳號通知。
                </p>
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

              <SignupForm />

              <div className="auth-footer">
                <span>
                  已經有禱告帳戶？
                  <Link href="/login" prefetch={false}>
                    前往登入
                  </Link>
                  。
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

      <SiteFooter />
    </>
  );
}
