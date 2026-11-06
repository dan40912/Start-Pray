import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export const metadata = {
  title: "怎麼開始 | Start Pray 一起禱告吧",
  description: "寫下你想請人代禱的事，或到代禱牆留一句祝福。第一次來 Start Pray，可以從這裡開始。"
};

export default function HowToPage() {
  return (
    <>
      <SiteHeader activePath="/howto" />

      <main className="howto-page">
        <section className="section soft-bg">
          <div className="hero-content">
            <h1>一句話，也可以是禱告的開始</h1>
            <p>
              如果你有一件事想請人一起禱告，可以先寫下你願意分享的部分。
              如果你今天有一點餘力，也可以讀讀別人的代禱，留一句祝福。
            </p>
            <div className="hero-actions">
              <Link href="/me/create" className="btn btn-primary">寫下代禱</Link>
              <Link href="/prayfor" className="btn btn-outline">逛逛代禱牆</Link>
            </div>
          </div>
        </section>

        <section className="section">
          <h2>我想請人為我禱告</h2>
          <p>
            想一想，今天最希望有人為你禱告的是什麼。寫到你覺得自在的程度就好，
            可以省略姓名、聯絡方式，以及你或他人想保留的細節。
          </p>
          <div className="gradient-card">
            <p>「下週我要做一項檢查，這幾天有點緊張。想請你們為我禱告，讓我在等待時能安心一些，也能好好睡一覺。」</p>
          </div>
        </section>

        <section className="section">
          <h2>我想陪伴一個人</h2>
          <p>
            在代禱牆讀到一則讓你掛心的代禱時，可以為對方禱告，也可以留一句話。
            無論你平常有沒有禱告的習慣，都可以用自己的話，讓對方知道你有讀到。
          </p>
          <div className="layout-grid columns-2">
            <div className="gradient-card">
              <h3>想為對方禱告</h3>
              <p>「主耶穌，求祢陪伴正在等檢查的人，讓他今晚能好好休息，在等候的時候有一點平安。」</p>
            </div>
            <div className="gradient-card">
              <h3>想留一句祝福</h3>
              <p>「等檢查的日子一定很不好熬。願你今晚能睡得安穩一些。」</p>
            </div>
          </div>
        </section>

        <section className="section soft-bg">
          <h2>送出代禱前，可以先想想這兩件事</h2>
          <div className="layout-grid columns-2">
            <div className="gradient-card">
              <h3>我想讓大家讀到內容嗎？</h3>
              <p>
                公開代禱可以在代禱牆被看見、被回應。如果你想把內容留給自己，
                可以選擇不公開。全球禱告室只會以匿名光點顯示大致位置。
              </p>
            </div>
            <div className="gradient-card">
              <h3>我之後想修改內容嗎？</h3>
              <p>
                訪客可以匿名送出文字代禱，送出後無法自行修改或刪除。
                如果你想日後回來管理這則代禱，可以先登入再寫。
              </p>
            </div>
          </div>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
