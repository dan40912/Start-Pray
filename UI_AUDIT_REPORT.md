# UI/UX 審視報告 — Prayer Coin 前端

> 依 `UI_AUDIT_PROMPT.md` 執行的靜態分析結果（2026-07-01）。
> 方法：全文檢索 + 交叉比對元件原始碼，非即時瀏覽器截圖（原因見文末「未完成事項」）。

---

## 一、最值得先查的問題（P0）

### P0-1｜兩套衝突的色彩變數系統同時全站生效，有「文字與背景同色而消失」的風險
- 位置：`src/app/globals.css:1-19`（淺色 `:root`，`--bg:#f3f4f6`、`--text-primary:#111827`）vs `src/styles/theme-modern.css:11-40`（另一組 `:root`，`--bg-primary:#0a0a0a` 近黑、`--text-main:#F8F9FA`）
- 載入方式：`src/app/layout.js` 第 1-4 行同時全站 `import` 這兩個檔案 + `admin.css` + `fontawesome-lite.css`，**不分前台/後台頁面**，兩套變數永遠同時存在。
- 現象：兩套變數命名不同（`--text-primary` vs `--text-main`），理論上不會直接互相覆蓋，但代表全站沒有單一色彩來源；一旦有元件誤用另一套主題的變數名稱（或直接寫死 hex 色），就可能出現深色背景配深色文字、或淺色背景配淺色文字，造成文字視覺上完全消失（比單純截斷更嚴重）。
- 建議修法：合併成一套設計 token（建議放在 `globals.css` 的 `:root`），依 route group（`/admin`、前台）用 `data-theme` 屬性切換，而非兩套變數並存。同時把 `theme-modern.css`、`admin.css` 從根 `layout.js` 移到各自的 `(customer)/layout.js`、`admin/layout.js`，避免全站互相汙染。

### P0-2｜導覽列使用者名稱寬度只有 84px，必截斷且完全沒有補救
- 位置：`src/app/globals.css:6664`（`header .nav-user { max-width: 84px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }`）
- 使用處：`src/components/site-chrome.js:247` — 內容是 `{siteText.nav.greeting}, {authUser.name}`（例如「你好，王小明」）
- 現象：84px 在中文字級下大約只容得下 4-5 個字，「你好，」三字就快滿了，使用者姓名幾乎必定被截斷，且沒有 `title` 屬性可 hover 查看全名。
- 建議修法：拿掉固定 `max-width`，改用 `flex: 1; min-width: 0;` 讓它在可用空間內自然截斷，並加上 `title={authUser.name}`；或行動版直接把姓名文字拿掉只顯示頭像。

---

## 二、文字被截斷但缺補救機制（P1）

以下皆為 `overflow:hidden + text-overflow:ellipsis`（或 `-webkit-line-clamp`）套用在**動態長度的使用者內容**上，且元件端沒有加 `title`／展開機制：

| 位置 | 對應元件與內容 | 修法 |
|---|---|---|
| `theme-detail.css:1903`（`.pdv2-player__summary strong/span`） | `VoiceWallPlayer.js:402-403` 播放器摘要：`currentTrack.speaker`、`currentTrack.message` | 加 `title={currentTrack?.message}`，或改兩行 `line-clamp:2` |
| `theme-detail.css:2020`（`.pdv2-player__queue-track strong/span`） | `VoiceWallPlayer.js:471+` 播放佇列曲目名稱 | 同上，佇列項目建議加 `title` |
| `theme-modern.css:1698`（`.player-now__name`） | `GlobalPlayer.js:724` 全站浮動播放器 `trackSpeaker`，**站內每頁都可能出現** | 加 `title={trackSpeaker}` |
| `theme-modern.css:1706`（`.player-now__meta` / `.player-now__sub`） | `GlobalPlayer.js:730-731` `nowMetaPrimary` / `nowMetaSecondary` | 加 `title` |
| `globals.css:6271`（`.cp-reply__card-info h3`） | `CustomerPortalClient.js:1230` 個人代禱卡片標題 `cardTitle` | 加 `title={cardTitle}`，或改 `line-clamp:2` 顯示更多行 |

## 三、輕微風險，建議留意（P2）

- `theme-modern.css:1290`（`.home-card__category`）：`HomePrayerExplorer.js:545` 分類標籤截斷，通常字數短、風險低，但若後台可自訂分類名稱，長分類名一樣會被吃字，建議後台限制分類名稱長度或補 `title`。
- `theme-modern.css:359`（`.prayer-card { height: 100%; overflow: hidden; }`）：卡片在 `grid-template-columns: repeat(auto-fill, minmax(300px,1fr))` 版面下，若同排其他卡片較矮，較高卡片內容可能被裁掉。目前程式沒有跑起來，無法截圖驗證，建議之後起本機環境時針對「摘要文字特別長的禱告卡片」實測一次。

---

## 四、精簡建議

### P0-3｜globals.css 與各 theme-*.css 有 105 個同名 class 重複定義
- 例如 `.btn`、`.btn-primary`、`.prayer-card`、`.form-group`、`.tag`、`.cp-button`、`.cp-section`、`.admin-section` 等，同時存在於 `globals.css` **和**對應的 `theme-modern.css` / `theme-customer.css` / `theme-create.css` / `admin.css`。
- 影響：最終樣式取決於 CSS import 順序與特異度，難以預期；改其中一份常常「改A壞B」。這很可能是目前 `globals.css` 累積到 8,943 行、且需要 33 處 `!important`（globals.css 23、prayer-modern.css 6、theme-modern.css 4）來蓋過衝突的根本原因。
- 建議：`globals.css` 只保留 reset、字型、排版變數等「全站共用」規則；頁面/功能專屬的 class（`.cp-*`、`.admin-*`、`.prayer-card` 等）應該只存在對應的 theme 檔案裡一份。

### P0-4｜3 個 Legacy 元件共 436 行，全專案零引用，可直接刪除
- `src/components/prayer-detail/LegacyFullpageNav.js`（137 行）
- `src/components/prayer-detail/LegacyHeroSlider.js`（177 行）
- `src/components/prayer-detail/LegacyMiniPlayer.js`（122 行）
- 已確認除了各自檔案內的 function 宣告，全 repo 沒有任何 import／引用，屬於安全可移除的死碼。

### P1｜`theme-modern.css`、`admin.css` 透過根 `layout.js` 全站載入，未按路由拆分
- 前台使用者會下載/解析後台管理用的 `admin.css`，後台管理員也會載入前台的深色主題 `theme-modern.css`。相對地 `theme-customer.css`、`theme-detail.css` 是有正確地只在對應頁面 import。建議統一做法：依 route group 拆分載入。

### 已確認「非問題」，修正先前假設
- 先前的初步 prompt 曾假設 `src/app/en/*` 是複製貼上造成的重複維護負擔。實際比對 `page.js` vs `en/page.js` 後確認：`/en` 路由是正規的 i18n 架構（共用 `HomeLandingPage` 元件 + `getDictionary("en")`），**不需要**列入精簡清單。

### 其他觀察
- Media query breakpoint 分散在 17 種寬度（420~1100px 間），無統一 token，建議收斂為 4-5 個標準斷點。

---

## 五、優先順序總表

| 優先度 | 項目 |
|---|---|
| P0 | 統一色彩變數系統、修正 `.nav-user` 84px 截斷、拆解 globals.css 與 theme-*.css 的 105 個重複選擇器、刪除 3 個 Legacy 死碼元件 |
| P1 | 5 處播放器/卡片文字截斷補 `title`、`theme-modern.css`/`admin.css` 改按路由載入 |
| P2 | 分類標籤長度風險、`.prayer-card` grid 等高裁切（需實機驗證）、統一 17 種 breakpoint |

---

## 未完成事項（環境限制）

無法在此 sandbox 內啟動專案做即時瀏覽器截圖驗證：專案需要 MySQL（`DATABASE_URL`）等服務，且 sandbox 未安裝 Chromium/Playwright。以上判斷全部基於原始碼與 CSS 靜態比對，**建議你在本機或已連線資料庫的環境下，針對 P0-2（導覽列姓名）與 P1 播放器區塊，實際用 375px 手機寬度看一次**，確認判斷無誤後再動手修。
