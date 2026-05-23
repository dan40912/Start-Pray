import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "平台原則與信任說明",
  description:
    "了解 Start Pray 如何處理匿名代禱、語音回應、位置隱私、內容檢舉與平台安全。",
  path: "/terms",
});

const PRINCIPLES = [
  {
    title: "人的需要優先",
    body:
      "Start Pray 處理的不是冷冰冰的資料，而是一個人的需要。每一則代禱背後，都可能是正在脆弱時刻的人，所以我們會優先考量清楚、溫柔與安全。",
  },
  {
    title: "可以匿名被代禱",
    body:
      "你可以選擇匿名發佈，也可以匿名回應。公開頁不要求你暴露真實姓名，也不鼓勵填寫不必要的個人資料。",
  },
  {
    title: "語音是禱告，不是表演",
    body:
      "語音功能是為了讓人聽見真實的代禱，不是為了比較誰說得比較好。平台不會用聲量、排名或競賽包裝禱告內容。",
  },
];

const SAFETY_ITEMS = [
  "私密代禱不會在公開頁顯示標題、描述、圖片、擁有者或詳情連結。",
  "全球禱告室只呈現大致位置光點，不顯示精準住址。",
  "公開內容與回應皆可被檢舉，管理員可審核與封鎖不合適內容。",
  "圖片只接受站內上傳或平台產生的縮圖，避免不明外部圖片進入資料庫。",
];

const DATA_ITEMS = [
  {
    title: "公開顯示",
    body: "公開代禱會顯示標題、描述、分類、圖片、回應數，以及你選擇顯示的名稱。",
  },
  {
    title: "可選擇隱藏",
    body: "真實姓名、精準位置、個人簡介與是否匿名回應，應該由你自己有意識地選擇。",
  },
  {
    title: "平台維護使用",
    body: "登入狀態、檢舉紀錄與必要的管理紀錄，只用於安全、協助與維護，不會拿來當成公開宣傳。",
  },
];

export default function TermsPage() {
  return (
    <>
      <SiteHeader activePath="/terms" />
      <main className="terms-page">
        <section className="terms-hero">
          <div>
            <p className="terms-hero__eyebrow">Trust & Safety</p>
            <h1>平台原則與信任說明</h1>
            <p>
              Start Pray 不是一般產品頁。這裡處理的是人的需要、回應、隱私與信任。
              這一頁整理我們目前怎麼看待這個空間。
            </p>
          </div>
          <div className="terms-hero__stats" aria-label="平台信任重點">
            <div>
              <span>Privacy</span>
              <strong>可匿名代禱</strong>
            </div>
            <div>
              <span>Safety</span>
              <strong>可檢舉審核</strong>
            </div>
            <div>
              <span>Location</span>
              <strong>不顯示精準位置</strong>
            </div>
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>我們如何看待這個平台</h2>
            <p>Start Pray 不是為了製造流量，而是希望讓有需要的人，可以比較安全地被看見。</p>
          </div>
          <div className="terms-grid">
            {PRINCIPLES.map((item) => (
              <article key={item.title} className="terms-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>隱私與安全邊界</h2>
            <p>公開頁面必須尊重使用者的選擇，尤其是私密代禱與位置資訊。</p>
          </div>
          <div className="terms-card terms-card--outline">
            <ul>
              {SAFETY_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>資料會如何被看見</h2>
            <p>我們盡量用清楚的方式說明，哪些內容會公開，哪些只用於帳號與維護。</p>
          </div>
          <div className="terms-grid">
            {DATA_ITEMS.map((item) => (
              <article key={item.title} className="terms-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="terms-download">
          <div>
            <h2>需要協助或通報問題？</h2>
            <p>如果你看到不合適內容、有隱私疑慮，或需要帳號協助，可以直接聯絡 Start Pray。</p>
          </div>
          <div className="terms-download__actions">
            <a className="button button--primary" href="mailto:startpraynow@gmail.com">
              聯絡 Start Pray
            </a>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
