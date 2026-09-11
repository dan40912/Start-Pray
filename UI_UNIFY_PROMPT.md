# Start Pray — UI 統一與首頁／詳情頁體驗一致化 Prompt

用途：把 `/`（首頁）與 `/prayfor/[id]`（代禱詳情）收斂到**同一套視覺語言與同一套互動模型**，並修掉已驗證的版面缺陷。

給執行的 agent：**先讀 `AGENTS.md`、`docs/architecture.md`，再動手。** 這是已上線的 prod 專案（https://startpray.online），處理的是人的需要與信任，不是一般 SaaS。

---

## 0. 硬約束

- 開新分支 `feat/ui-unify`，**不要**動 `fix/admin-visibility-and-voice-experience`。
- 不改資料庫 schema、不改 API 契約、不改 i18n key 名稱（文案內容可改）。
- 每個階段（P0 / P1 / P2）**分開 commit**，可獨立 revert。
- 只改 `zh-TW` 與共用樣式；`src/app/en/*` 走同一批共用元件，不要另外複製一份樣式。
- 不要為了統一而重寫 `src/app/admin/*`，那是內部後台，本次不在範圍內。
- 動任何 `.css` 之前先確認該選擇器目前生效於哪些頁面（`grep -rn "<選擇器>" src/`），避免誤傷 `global-prayer-room`、`overcomer`、`customer-portal`。

---

## 1. 現況事實（已實測驗證，不需重新調查）

| 事實 | 證據 |
|---|---|
| CSS 共 **20,973 行**、分散在 12 個 theme 檔 | `src/styles/*.css` + `src/app/globals.css` |
| 出現 **265 個不同 hex 色值** | 對 `src/styles/*.css` 與 `globals.css` 取 `#rrggbb` 去重 |
| **3 個互相打架的 `:root`** | `globals.css:2`、`theme-modern.css:1`、`theme-detail.css`（`--site-header-height: 72px`） |
| `globals.css` 的 `:root` 是一套**淺色**主題，但站台實際是深藍夜色 | `globals.css:2-18`（`--bg:#f3f4f6`、`--surface:#ffffff`、`--text-primary:#111827`） |
| `--accent-gold` 的值其實是**藍色** `#60a5fa`（歷史 rebrand 沒清乾淨） | `theme-modern.css` 的 `:root` |
| header 高度兩套：56/64px vs 72px | `globals.css:18-24` vs `theme-detail.css` |
| 公開頁的 `<body>` 掛著 **`admin-layout`**，且 `admin.css`（734 行）被全站載入 | `src/app/layout.js:3`、`:160`、`:240` |
| 實際同時存在 **4 套主色**：首頁金 `#fde68a` / 詳情頁藍漸層 / 播放語音紫漸層 / 播放器青色 | `theme-modern.css:962,1061`；`theme-detail.css` |
| 字體不一致：首頁 hero 用 `Noto_Serif_TC` 襯線，詳情頁用 `Inter` 無襯線粗黑 | `layout.js:28-33` vs `theme-modern.css` 的 `--font-heading` |

---

## 2. P0 — 已確認的缺陷（先修這五個，各自獨立）

### P0-1　行動版出現白色色塊（最明顯的破圖）

- **檔案**：`src/styles/theme-detail.css:2669-2676`
- **現況**：

  ```css
  .pdv2-comments-card .record-toolbar {
    position: sticky;
    background: linear-gradient(to bottom, rgba(255, 253, 248, 0.86), #fffdf8 35%);
  }
  ```

  `#fffdf8` 是舊淺色版留下的奶白色，在深色頁上直接變成一塊白方塊，包住「送出文字禱告」按鈕。
- **改成**：用深色底＋上緣淡出，與 `.pdv2-comments-card` 的 `rgba(4,6,12,0.95)` 銜接。
- **驗收**：375×812 檢視 `/prayfor/31`，捲到留言表單，按鈕周圍**不得**出現任何淺色矩形。

### P0-2　首頁卡片上標籤與人數文字重疊

- **檔案**：`src/components/HomePrayerExplorer.js:579-593`、`src/styles/theme-modern.css:1272-1277`
- **現況**：`.home-card__tag-row` 是 `display:flex` 但**沒有 `gap`、沒有 `flex-wrap`**；而 `.home-card__prayer-badge`（`HomePrayerExplorer.js:587`）**在所有 CSS 檔中完全沒有樣式規則** —— 它是一個裸 `<span>`，沒有 padding、沒有膠囊底，於是「13 人正在代禱」直接壓在 `個人` / `有語音` 兩顆 pill 上。
- **改成**：
  1. `.home-card__tag-row` 加 `gap: 0.4rem; flex-wrap: wrap;`
  2. 新增 `.home-card__prayer-badge` 規則，沿用 `.home-card__category`（`theme-modern.css:1285-1299`）的膠囊樣式，但用低對比（無邊框、`color: rgba(241,245,249,0.72)`）以區分層級。
  3. `.home-card__prayer-badge.is-empty` 再降一階對比。
- **驗收**：首頁「熱門禱告牆」每一張卡，三個標籤都各自成塊、互不重疊，窄螢幕自動換行。

### P0-3　封面 fallback 是純黑方塊，看起來像載入失敗

- **檔案**：`src/app/api/card-thumbnail/route.js:54-58`
- **現況**：產生 `<rect fill="#020617"/>` ＋ 白色 `Arial` 800 粗體標題。詳情頁 hero（`.pdv2-hero-image-wrap`，`theme-detail.css:1247`）高 `clamp(260px,44vw,460px)`，於是首屏是一塊滿版黑框，使用者第一反應是「圖壞了」。而且**下方 `.pdv2-title-row h1` 又把同一個標題再顯示一次**，資訊完全重複。
- **改成**：
  1. `route.js` 改為以 `title` 做穩定 hash → 從**新 token 的 3–4 個品牌色**中挑一個，輸出低飽和漸層底＋祈禱手符號水印，標題字級縮小（或直接不放標題，因為下方已經有 h1）。
  2. 字型改用專案已載入的家族，不要留 `Arial`。
- **驗收**：任一無自訂封面的卡片，hero 看起來像「刻意設計的素色卡」，不像空的黑框；不同標題產生不同顏色但同一風格。

### P0-4　封面圖沒有遮罩，標題壓在亮圖上讀不到

- **檔案**：`src/styles/theme-modern.css:1227-1235`
- **現況**：`.home-card__bg` 只有 `opacity: 0.94`，**沒有任何 scrim**。使用者上傳的是 LINE 對話截圖、迷因、新聞台截圖，`.home-card__title` 直接壓上去。
- **改成**：加 `.home-card__bg::after`，`linear-gradient(to bottom, rgba(2,6,23,0.15) 0%, rgba(2,6,23,0.55) 45%, rgba(2,6,23,0.88) 100%)`；並把 `.home-card__bg` 的 `opacity` 拉回 `1`（對比由 scrim 控制，不要用透明度壓圖）。
- **驗收**：把「為久不聚會的聖徒禱告」「海上救援志工守望圈」這兩張亮圖卡放大檢查，白色標題對比度 ≥ 4.5:1。

### P0-5　常駐播放器關不掉，且播的與當前頁面無關

- **檔案**：`src/components/GlobalPlayer.js`、`src/components/GlobalPlayerGate.js`
- **現況**：`GlobalPlayer.js` 有 `dismiss`（wellbeing overlay，`:121`）與 `player-notice__dismiss`（`:715`），但**播放列本身沒有關閉控制**。它固定佔住行動版約 13% 視窗高度、蓋住留言，且在 `/prayfor/31` 播的是「弟兄癌症手術禱告」——與當前卡片無關。
- **改成**：
  1. 播放列右上加關閉鈕，關閉狀態存 `sessionStorage`。
  2. **預設不顯示**；只有使用者主動按下任一播放鍵後才掛載（條件加在 `GlobalPlayerGate`）。
  3. `<body>` 的 `has-global-player` class 要跟著條件掛載，否則底部會空一塊留白。
- **驗收**：初次進站看不到播放列；按播放後出現且可關閉；關閉後同一 session 內不再自動彈回。

---

## 3. P1 — 建立單一 token 層（UI 統一的地基）

### P1-1　新增 `src/styles/tokens.css`，成為唯一的 `:root`

定義且**只在這裡定義**：

- **色**：一組深藍夜色階（`--sp-bg`、`--sp-surface`、`--sp-surface-raised`、`--sp-border`）＋**一個** accent。
  **建議留金色**（`#fde68a` 系）當唯一 accent，藍色全部降為背景／表面層。理由：金色目前只在首頁出現，是這個產品唯一有記憶點的顏色；藍色滿場都是，當 accent 會消失在背景裡。
- **語意色**：`--sp-accent`、`--sp-accent-ink`（accent 上的字色）、`--sp-danger`、`--sp-success`。
- **字**：`--sp-font-display`（`Noto_Serif_TC`）、`--sp-font-body`（`Inter`），以及 `--sp-text-1..4` 四級字色。
- **量**：`--sp-radius-sm/md/lg/full`、`--sp-space-*`、`--sp-header-h`（**單一值**）。

### P1-2　清掉打架的 `:root`

- `src/app/globals.css:2-24` 那整段淺色 `:root` → 改成 alias 指向 `--sp-*`（**不要直接刪**，站內大量選擇器還在用 `--accent`、`--surface`、`--text-primary`；先做 alias，再分批汰除）。
- `src/styles/theme-modern.css` 的 `:root` → 同樣改成 alias。特別注意 `--accent-gold` 目前值是藍色 `#60a5fa`，alias 過去時要**同時修正語意**，並全域改名為 `--sp-accent`。
- `theme-detail.css` 的 `--site-header-height: 72px` → 刪除，改用 `--sp-header-h`。

### P1-3　把 `admin.css` 從公開頁拿掉

- **檔案**：`src/app/layout.js:3`、`:160`、`:240`
- 公開頁的 `<body className="admin-layout">` 改掉，`admin.css` 只在 `src/app/admin/layout.js` 載入。
- **注意**：先 `grep -rn "admin-layout" src/styles/` 確認公開頁是否有選擇器依賴它，把需要的規則搬到 `tokens.css` 或 `theme-modern.css` 再移除，否則會掉版。

### P1-4　抽出共用卡片元件 `src/components/PrayerCard.js`

目前同一個「代禱卡」有**三套長不一樣的實作**：

- 首頁禱告牆：`HomePrayerExplorer.js` 的 `.home-card`
- 詳情頁「其他代禱事項」：`src/app/prayfor/[id]/page.js` 的相關卡
- 詳情頁 hero：`.pdv2-hero-card`

改成一個 `<PrayerCard variant="grid" | "compact" | "hero" />`，統一：

- 封面比例鎖 **3:2**（`aspect-ratio`），一律套 P0-4 的 scrim
- 標題最多 2 行（`-webkit-line-clamp`）
- metadata（作者／回應數／分類）**不要再用有框膠囊**，改成低對比純文字＋分隔點。目前「建立日期」「上傳者」「作者」「N 則」全做成 `border: 1px solid` 的膠囊，看起來像 disabled input（`theme-modern.css:1285-1299`）。

---

## 4. P2 — 首頁與詳情頁的體驗一致

### P2-1　CTA 收斂成一顆

- **檔案**：`src/app/prayfor/[id]/page.js`、`src/components/PrayerRequestActions.jsx`、`.pdv2-hero-actions`、`.pdv2-sticky-actions`
- **現況**：首屏出現 5 顆按鈕：`立即禱告` / `分享給小組` / `⋯` / `為這件事禱告` / `聆聽大家的禱告`。其中 **`立即禱告` 與 `為這件事禱告` 樣式不同但功能相同**。
- **改成**：主按鈕**只留一顆**「為這件事禱告」（accent 實心）；`分享` 降為 icon button；`聆聽大家的禱告` 降為文字連結錨點；移除重複的那顆。
- 首頁 hero（`HomePrayerHero.js`）的主按鈕**必須與詳情頁同一顆樣式、同一組文案**。

### P2-2　修掉文案與數字互相打臉

- **現況**：首頁 hero 寫「此刻，有人正等待著你的一句代禱」，正下方卡片卻顯示「**0 人已禱告**」（`src/lib/i18n/locales/zh-TW.js:91` 的 `countSuffix`）。
- **改成**：hero 卡片改為挑選 `responseCount > 0` 的卡；若全站確實沒有，改文案為「還沒有人回應這件事，你可以是第一個」。
- **同時**：移除首頁統計數字區（`.home-proof__stats`，目前顯示 40／130／50／15／8）。小數字當社會證明是反效果，改成「最近 3 則真實回應」的輪播。

### P2-3　詳情頁補上產品說明

從 Threads 直接落地 `/prayfor/31` 的人不知道這是什麼站。在 `.pdv2-hero-body` 的 `h1` 上方加一行 12 字以內的說明（例：`Start Pray · 有人在這裡為你禱告`），樣式與首頁 hero 的 eyebrow 一致。

### P2-4　種子回應的可信度（跨頁，但影響最大）

- **背景**：`PRAYER_REPLY_PROMPT.md` 生成的匿名回應，在 `/prayfor/31` 上是 **20 則同頭像、同名「匿名代禱者」、同樣 38–45 字、同樣「求主…／願主…」句式**。同一頁上的真人留言（「You will be fine」「加油希望你快點好起來」）一眼可辨，兩者並列時假的更假。
- **改成**（本次只做前端，不改生成策略）：
  1. 匿名頭像改為依 response id 產生的**色塊＋字符**，不要全部用同一張祈禱手 logo。
  2. 同一卡片上的「匿名代禱者」要能區分（例：`匿名 · A`、`匿名 · B`）。
  3. 回應區預設只顯示 5 則，其餘收在「看更多回應」後面。
- **另外建議（需擁有者決定，不要自行執行）**：把 `PRAYER_REPLY_PROMPT.md` 的產出量降到每卡 3–5 則，並要求長度分布 8–120 字。

### P2-5　留言卡的閱讀順序

- **現況**：`分享` / `⋯` 按鈕排在「名字」下方、「內文」上方且靠右，打斷閱讀。
- **改成**：操作鈕移到卡片右上（與名字同一行）或內文下方；內文必須緊接在名字之後。

---

## 5. 驗收清單

跑完後在 375×812 與 1280×800 兩個尺寸各檢查一次：

- [ ] 全站主按鈕**只有一種顏色**（accent），漸層按鈕全部消失
- [ ] 只有 `tokens.css` 含 `:root`
- [ ] 首頁 hero 主按鈕與詳情頁主按鈕：顏色、圓角、字級、高度**完全一致**
- [ ] 首頁卡片與詳情頁「其他代禱事項」卡片來自同一個 `<PrayerCard>`
- [ ] 行動版 `/prayfor/31` 沒有任何淺色矩形
- [ ] 首頁禱告牆沒有任何文字重疊
- [ ] 初次進站看不到底部播放器
- [ ] `admin.css` 不再出現在公開頁的 network 請求中
- [ ] Lighthouse 對比度項目無 fail

---

## 6. 不要做的事

- 不要一次改完 20,973 行 CSS。P1 的做法是**加 token ＋ alias**，讓舊選擇器繼續運作，之後再分批汰除。
- 不要刪 `theme-detail.css` / `theme-modern.css`，`global-prayer-room`、`overcomer`、`voices`、`customer-portal` 都還依賴它們。
- 不要改 `src/app/admin/*` 的視覺。
- 不要在沒有實測截圖前宣稱修好；每個 P0 項目都要附修前／修後的 375×812 截圖。
