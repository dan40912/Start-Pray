import PlatformStats from "@/components/PlatformStats";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { readPlatformStats } from "@/lib/platformStats";
import { buildPageMetadata } from "@/lib/seo";

// 頁首的平台數據每次都從資料庫讀，不能在 build 時靜態產生。
export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "使用條款與上傳規則",
  description:
    "Start Pray 的上傳規則，以及每一條規則背後的原因：匿名代禱、圖片與語音、位置隱私、檢舉與審核。",
  path: "/terms",
});

const WHY_WE_EXIST = [
  {
    title: "人的需要優先",
    body:
      "這裡處理的不是資料，而是一個人的需要。每一則代禱背後，可能都是某個人最脆弱的時刻。所以每一條規則，我們都先問：這樣做，會不會讓一個正在難過的人更安全一點？",
  },
  {
    title: "開口不該有門檻",
    body:
      "最需要被代禱的時候，往往也是最沒有力氣註冊、填資料的時候。所以你可以不登入、匿名寫下需要。我們寧可多做一些保護，也不要讓任何人因為怕被認出來而不敢開口。",
  },
  {
    title: "禱告不是表演",
    body:
      "語音與文字回應，是為了讓人聽見真實的陪伴，不是比誰說得好。我們不做排行、不比聲量，也不把禱告包裝成競賽。",
  },
];

// 每一條上傳規則都附上「為什麼」。數字須與程式裡的實際限制一致：
// home-cards / upload-image / customer/cards/voice / responses 路由與 voiceModeration。
const UPLOAD_RULES = [
  {
    title: "沒有帳號，也可以先寫下需要",
    rules: [
      "訪客可以直接送出文字代禱，會以「匿名使用者」顯示，並使用系統產生的預設圖片。",
      "送出前需要確認：內容裡沒有真實姓名、電話、住址或其他個資。",
      "同一個網路一小時內最多送出 3 則訪客代禱。",
      "訪客內容無法自己修改或刪除，需要時請聯絡我們協助。",
    ],
    why:
      "我們希望難過的人不必先註冊才能被陪伴。但訪客的內容之後沒辦法由你自己管理，所以才請你在送出前，先把能認出你的資訊留在心裡。",
  },
  {
    title: "把需要說清楚，也讓人讀得完",
    rules: [
      "標題最多 120 字，內文最多 3,000 字，並選擇一個代禱分類。",
      "登入後可以管理自己的代禱：編輯、切換公開或不公開。",
    ],
    why:
      "三千字足夠把一件事的來龍去脈說清楚；再長，願意為你禱告的人可能就讀不完了。分類則讓關心同一件事的人更容易找到你。",
  },
  {
    title: "照片：最多 3 張，而且只留下畫面",
    rules: [
      "圖片需要登入後上傳，每則代禱最多 3 張。",
      "支援 JPG、PNG、WEBP，每張 10MB 以內。",
      "上傳後會壓縮成 WebP（最長邊 1600px），並移除照片裡附帶的拍攝資訊，例如 GPS 位置。",
      "不接受外部圖片網址，只能使用站內上傳或系統產生的圖片。",
    ],
    why:
      "手機拍的照片常常悄悄記下拍攝地點。我們寧可多做一步，也不要讓一張照片把你家的位置交出去。外部圖片連結則可能在之後被換成別的內容，出現在一則代禱旁邊，對誰都不公平。",
  },
  {
    title: "語音：有些話，用說的比較容易",
    rules: [
      "登入後可以在自己的代禱卡片上附一段語音留言，最長 3 分鐘、15MB 以內。",
      "錄音只會在你按下確認後才上傳；確認前可以重錄。",
      "為別人代禱時，也可以用語音回應（需要登入），檔案 12MB 以內，支援 webm、mp3、m4a、aac、ogg、wav。",
    ],
    why:
      "有時候哭著說出來，比打字容易。三分鐘是一個人願意安靜聽完的長度。語音承載的是真實的聲音，所以需要登入，讓每一段聲音都有人負責。",
  },
  {
    title: "回應：一句真心話就夠了",
    rules: [
      "文字回應至少 8 個字、最多 2,000 字；只送語音時可以不寫字。",
      "訪客可以留下文字回應，會以匿名代禱者顯示。",
      "回應送出後會直接出現在代禱下方，不需要等待審核。",
    ],
    why:
      "一個等待被陪伴的人，不該再等好幾天才看見別人的祝福。所以我們選擇先相信人，再把保護的按鈕交到每一個人手上（見下方「檢舉與審核」）。",
  },
  {
    title: "讓這裡保持安靜的速度",
    rules: [
      "會員一小時內最多建立 5 則代禱；新帳號或曾被檢舉的帳號次數會減半，內容也可能先經過審核再公開。",
      "10 分鐘內最多送出 8 則回應（訪客 5 則）；同一則代禱 2 分鐘內只能回應一次。",
      "10 分鐘內上傳超過 5 段語音，之後的語音會自動退回。",
      "訪客回應含有多個網址，或短時間內回應較多時，會先進入審核。",
    ],
    why:
      "真實的陪伴不會是一分鐘幾十則。這些限制是用來擋下廣告與洗版，不是在懷疑你。如果你真的碰到限制，休息一下再回來，你寫的內容都還在。",
  },
];

const PRIVACY_ITEMS = [
  {
    title: "不公開的代禱",
    body:
      "勾選「不公開內容」後，公開頁不會出現標題、內文、圖片、上傳者或詳情連結，也不接受公開回應。全球禱告室只會顯示一個匿名光點，座標會再模糊到約十公里的範圍。",
  },
  {
    title: "位置只到城市",
    body:
      "公開代禱會用你選擇的地點出現在全球禱告室，不會顯示住址。挑選位置時，請選城市或大範圍的區域，不要點在自己家門口。",
  },
  {
    title: "訪客的識別只用來擋洗版",
    body:
      "訪客送出代禱或回應時，我們會記錄經過雜湊處理的瀏覽器識別與當日網路識別，只讓管理員分辨「一個人送了五則」和「五個人各送一則」，不會公開，也不會拿來做任何宣傳。",
  },
];

const REPORT_ITEMS = [
  "每一則回應都可以被檢舉，訪客也可以。",
  "被檢舉的回應會立刻從公開頁隱藏，等管理員看過後再決定是否恢復。",
  "如果是代禱發起人檢舉自己代禱底下的回應，該回應會直接移除。",
  "檢舉理由包含：垃圾訊息或推廣、仇恨或騷擾、色情露骨、暴力威脅、洩露個資、不實資訊與其他。",
  "被檢舉或違規的帳號，建立內容的次數會降低；嚴重者會被停用，無法再上傳圖片或語音。",
];

const DATA_ITEMS = [
  {
    title: "會公開的",
    body: "公開代禱的標題、內文、分類、圖片、語音留言、回應數，以及你選擇顯示的名稱。",
  },
  {
    title: "由你決定的",
    body: "真實姓名、代禱是否公開、位置選在哪裡、個人簡介，以及回應時要不要匿名。",
  },
  {
    title: "只用來守護這裡的",
    body: "登入狀態、檢舉紀錄、雜湊過的訪客識別與管理紀錄，只用於安全、協助與維護。",
  },
];

export default async function TermsPage() {
  const platformStats = await readPlatformStats();

  return (
    <>
      <SiteHeader activePath="/terms" />
      <main className="terms-page">
        <section className="terms-section terms-stats" aria-labelledby="terms-stats-title">
          <div className="terms-section__header">
            <p className="terms-hero__eyebrow">此刻的 Start Pray</p>
            <h2 id="terms-stats-title">這些數字背後，都是一個一個真實的人</h2>
          </div>
          <PlatformStats items={platformStats} tone="light" label="Start Pray 平台數據" />
        </section>

        <section className="terms-hero">
          <div>
            <p className="terms-hero__eyebrow">使用條款 · 為什麼這樣設計</p>
            <h1>這些規則，是為了守護每一個願意開口的人</h1>
            <p>
              Start Pray 開始於一個很簡單的念頭：當一個人撐不下去的時候，應該有地方可以說出來，
              並且知道有人正在為他禱告。
            </p>
            <p>
              願意把心裡最重的事寫下來，需要很大的勇氣。所以我們寫下的每一條規則，都不是為了管人，
              而是為了讓這份勇氣被好好接住。下面每一條，我們都把「為什麼」一起寫給你。
            </p>
          </div>
          <div className="terms-hero__stats" aria-label="我們的三個承諾">
            <div>
              <span>可以匿名</span>
              <strong>不用註冊也能開口</strong>
            </div>
            <div>
              <span>可以不公開</span>
              <strong>只留下一個光點</strong>
            </div>
            <div>
              <span>可以檢舉</span>
              <strong>被檢舉先隱藏</strong>
            </div>
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>我們為什麼做這件事</h2>
            <p>我們不追求流量。我們在意的是：一個有需要的人，能不能在這裡安全地被看見。</p>
          </div>
          <div className="terms-grid terms-grid--three">
            {WHY_WE_EXIST.map((item) => (
              <article key={item.title} className="terms-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>上傳規則，以及背後的原因</h2>
            <p>每一個數字都有它的理由。如果某條規則讓你覺得不合理，歡迎直接告訴我們。</p>
          </div>
          <div className="terms-grid terms-grid--two">
            {UPLOAD_RULES.map((item) => (
              <article key={item.title} className="terms-card terms-rule">
                <h3>{item.title}</h3>
                <ul>
                  {item.rules.map((rule) => (
                    <li key={rule}>{rule}</li>
                  ))}
                </ul>
                <p className="terms-rule__why">
                  <strong>為什麼？</strong>
                  {item.why}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>隱私與位置</h2>
            <p>全球禱告室讓人看見世界各地正在被守望，但它永遠不該讓人找到你家。</p>
          </div>
          <div className="terms-grid terms-grid--three">
            {PRIVACY_ITEMS.map((item) => (
              <article key={item.title} className="terms-card">
                <h3>{item.title}</h3>
                <p>{item.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>檢舉與審核</h2>
            <p>
              我們選擇先相信人，讓祝福即時出現；同時把保護的按鈕交到每一個人手上。
              一句傷人的話，不該在一則代禱底下多停留一分鐘。
            </p>
          </div>
          <div className="terms-card terms-card--outline">
            <ul>
              {REPORT_ITEMS.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </div>
        </section>

        <section className="terms-section">
          <div className="terms-section__header">
            <h2>你的資料會如何被看見</h2>
            <p>哪些會公開、哪些由你決定、哪些只用來守護這個空間，我們盡量說清楚。</p>
          </div>
          <div className="terms-grid terms-grid--three">
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
            <h2>有任何不舒服，都可以告訴我們</h2>
            <p>看到不合適的內容、擔心自己的隱私、想修改訪客代禱，或只是覺得哪條規則不對，都歡迎來信。</p>
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
