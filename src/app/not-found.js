import Link from "next/link";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function NotFound() {
  return (
    <div className="not-found-page">
      <SiteHeader />

      <main className="not-found-main" aria-labelledby="not-found-title">
        <section className="not-found-panel">
          <div className="not-found-code" aria-hidden="true">
            404
          </div>

          <div className="not-found-copy">
            <p className="not-found-eyebrow">找不到這個頁面</p>
            <h1 id="not-found-title">這個連結目前無法開啟</h1>
            <p>
              這則內容可能已被移除、設為不公開，或網址已經變更。若你是從會員中心進來，請回到管理頁確認代禱狀態；公開搜尋不會顯示不公開的代禱內容。
            </p>
          </div>

          <div className="not-found-actions">
            <Link className="btn btn-primary" href="/me" prefetch={false}>
              回到會員中心
            </Link>
            <Link className="btn btn-outline" href="/prayfor" prefetch={false}>
              返回禱告牆
            </Link>
            <a className="btn btn-quiet" href="mailto:startpraynow@gmail.com">
              聯絡支援
            </a>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
