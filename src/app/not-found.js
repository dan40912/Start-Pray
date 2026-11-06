import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <SiteHeader />

      <main className="not-found-main" aria-labelledby="not-found-title">
        <div className="not-found-panel">
          <div className="not-found-copy">
            <p className="not-found-eyebrow"><span aria-hidden="true">404</span> 找不到這個頁面</p>
            <h1 id="not-found-title">這個連結目前無法開啟</h1>
            <p className="not-found-description">
              這則內容可能已移除、設為不公開，或網址已變更。
              如果是你建立的代禱，可以回會員中心確認狀態。
            </p>
            <nav className="not-found-actions" aria-label="接下來可以前往">
              <Link className="not-found-primary" href="/prayfor" prefetch={false}>
                返回禱告牆 <span aria-hidden="true">→</span>
              </Link>
              <Link className="not-found-secondary" href="/me" prefetch={false}>
                回到會員中心
              </Link>
            </nav>
            <p className="not-found-help">
              還需要幫忙？ <a href="mailto:startpraynow@gmail.com">聯絡支援</a>
            </p>
          </div>

          <div className="not-found-art" aria-hidden="true">
            <svg viewBox="0 0 180 180" fill="none">
              <circle cx="90" cy="90" r="79" className="not-found-orbit" />
              <circle cx="90" cy="90" r="58" className="not-found-orbit" />
              <path d="M47 120c20 5 36-2 46-17 11-16 23-23 41-19" className="not-found-trail" />
              <circle cx="47" cy="120" r="4" className="not-found-point" />
              <path d="M133 62c0 12-8 20-20 20 12 0 20 8 20 20 0-12 8-20 20-20-12 0-20-8-20-20Z" className="not-found-point" />
              <circle cx="62" cy="62" r="3" className="not-found-point" />
            </svg>
          </div>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
