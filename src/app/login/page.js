import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { buildPageMetadata } from "@/lib/seo";

import LoginForm from "./LoginForm";

export const metadata = buildPageMetadata({
  title: "登入",
  description: "登入 Start Pray 會員中心，管理你的禱告內容、留言互動與個人資料。",
  path: "/login",
  noIndex: true,
});

export default function LoginPage() {
  const trustBullets = [
    "你可以用暱稱或匿名回應，不一定要公開真實姓名。",
    "登入後可以留下文字，也可以用語音為人禱告。",
    "你可以管理自己建立的代禱和回應。",
  ];

  return (
    <>
      <SiteHeader activePath="/login" />

      <main>
        <div className="auth-wrapper">
          <div className="auth-grid">
            <section className="auth-card">
              <div>
                <h1>歡迎回來</h1>
                <p>登入後，你可以建立代禱、留下回應，也可以用聲音為正在需要的人禱告。</p>
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

              <LoginForm />

              <div className="auth-footer">
                <span>
                  還沒有帳號？前往 <Link href="/signup">註冊 Start Pray</Link>。
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

      <SiteFooter />
    </>
  );
}
