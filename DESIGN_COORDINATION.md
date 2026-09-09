# 設計統整：三份評估的裁決與分工

> 統整對象：
> - **A**「客戶入口網站路由 UI 評估」— 會員中心 / 路由 / IA
> - **B**「使用者體驗評估與改善」— 首頁 hero 滑動手感
> - **C**「StartPray 產品評審與設計改善」— 陌生人首訪 / 可信度 / CSS 漂移
>
> 本文是三個 session 的共同施工契約。動手前先讀「四、檔案所有權」。

---

## 一、先把重疊講清楚

三份評估各自獨立跑，但有大量重疊。合併後只有 **11 件事**，不是 30 件。

| 主題 | A 說 | B 說 | C 說 | 合併後的結論 |
|---|---|---|---|---|
| 「太 AI」 | 視覺習慣：漸層／glass／emoji／24px 圓角 | 純 CSS 漸層是 AI 指紋，真實照片不是 | 假回應 20 則同長度同句式 | **兩個獨立問題**：視覺語言（A+B）＋內容可信度（C）。分開修 |
| 主色 | 「單色實心，一個主色」 | — | 「金色 #fbbf24 當唯一 accent」 | 見「二、裁決 2」 |
| 深色 vs 淺色 | **往淺色靠**（和 /signup 統一） | 深色 + ambient 照片 | **統一成深色** | 直接衝突。見「二、裁決 1」 |
| 襯線標題 | 建議導入 | — | 首頁有、詳情頁沒有 | 一致同意。`Noto_Serif_TC` **已經在 layout.js 載入了**，只是沒有規則 |
| 卡片元件 | 會員中心列表 | hero deck | 首頁／牆／詳情三套卡 | **同一件事**：抽 `<PrayerCard>`。這是 B 階段 3 的前置 |
| CTA 過多 | 第一屏沒有主 CTA | — | 詳情頁五顆按鈕、兩顆同功能 | 同一條規則：**每屏一顆主 CTA** |
| 空狀態 / 錯誤態 | `Failed to load responses.` 紅框英文 | — | `0 人已禱告` 打臉 hero 文案 | 同一類：**誠實的空狀態**，不要用錯誤框當空狀態、不要用假數字撐場面 |

---

## 二、四個裁決（我以設計統整的身分決定，可推翻）

### 裁決 1：深色 / 淺色 —— 不是二選一，是「兩種情境，一套系統」

A 說整站往淺色，C 說整站往深色。**兩邊都對一半，而且都比實際需要的工程量大。**

程式碼的實情（已驗證）：

```
globals.css  :root  --bg:#f3f4f6  --surface:#ffffff   ← 淺色
theme-modern.css :root --bg-primary:#0a0a0a           ← 深色，且在 layout.js 全站載入
```

兩者變數名不同 → **不會互相覆蓋，是同時存在**。所以站上是「深色外殼 + 淺色元件」。
C 抓到的「送出文字禱告外面那塊白方塊」就是唯一誠實使用 `--surface:#ffffff` 的元件——它不是 bug，它是唯一沒有繞過 token 的元件。

而且 live CSS 的顏色統計是**淺色佔多數**（`#ffffff` 36 次、`#f8fbff` 26、`#f8fafc` 19，對上 `#0f172a` 15）。所以「整站改深色」比「整站改淺色」還貴。

**裁決：保留兩種表面，但由 token 層統一管理、由路由明確宣告。**

| 表面 | 用在哪 | 為什麼 |
|---|---|---|
| **night（深）** | 首頁 hero／globe、全球禱告室、語音播放、GlobalPlayer | 這裡的情緒是「世界此刻在禱告」，夜色是內容的一部分 |
| **day（淺）** | 註冊／登入、我的頁面、建立代禱、詳情頁閱讀區、admin | 這裡要讀字、填表、建立信任 |

實作上**不是兩個 theme 檔**，是一套語意 token + 一個 scope：

```css
/* tokens.css — 唯一的 :root */
:root { --surface-1: …; --text-1: …; --accent: …; }
[data-surface="night"] { --surface-1: …; --text-1: …; }
```

每個 route 的 layout 宣告 `data-surface`。元件只用語意 token，**永遠不寫 hex**。
這樣 A 抱怨的「從溫暖的白色 /signup 跨進冰冷深藍會員中心」也解掉了——因為 /signup 和 /me 都是 `day`，不再有斷層。

### 裁決 2：主色 = 暖金，藍色降為背景層

C 說金色 `#fbbf24`。查了：**`#fbbf24` 全站只出現 1 次**，而且 `--accent-gold` 的值是 `#60a5fa`（藍）、`--accent-purple` 是 `#3b82f6`（也是藍）。所以「金色主題」目前只存在於變數名裡。

**裁決：採納金色，但要真的做。** 理由不是 C 說了算，是它同時解掉 A 的問題——A 指出「藍紫漸層主按鈕」是 AI 指紋前三名。換成單色暖金實心按鈕，一次解決兩份評估。

- `--accent: #fbbf24`（唯一 accent，實心，不做漸層）
- 藍 `#1d4ed8 / #2563eb` 降級成 `--surface-*` 的冷底色與連結色
- 刪掉 `--accent-gold` / `--accent-purple` / `--accent-cyan` 這組名不副實的變數

### 裁決 3：溫度靠這四件事，不靠改亮度

A 的核心焦慮是「禱告被做成 sci-fi dashboard」。這不需要整站翻淺色，用四個具體動作處理：

1. **標題一律襯線**（`Noto_Serif_TC`，已載入）。詳情頁改掉無襯線粗黑，和首頁對齊
2. **拿掉 glassmorphism 與發光陰影**（`--border-glass`、`--shadow-glass`）→ 實色卡片 + 一層極淡邊框
3. **圓角 24px → 14px**；emoji（🙏🎧⚠️）改線性 icon 或直接拿掉
4. **用真實照片當氛圍層**（B 的方案 B）—— 純 CSS 漸層是 AI 指紋，照片不是

### 裁決 4：文案去「光點化」，用語全站統一為「代禱」

現況已驗證：`代禱事項` 44、`祈禱卡` 30、`代禱卡` 20、`禱告卡` 6、`禱告需求` 5 —— 同一個東西五個名字，共 105 處。

**這件事必須一次做完、由一個 session 做完。** 三個 session 各自改，只會變成第六種說法。

- 事物 → **代禱**（複合詞：一則代禱／我的代禱／為他代禱）
- 「定義這個禱告光點」→「你想為什麼事禱告？」
- 「決定全球禱告室中被點亮的大致光點」→「你的禱告會出現在世界地圖上（只顯示大概位置）」

---

## 三、地基（Phase 0）—— 必須先做完，其他人才能動

這三件事是「體驗一致」的全部前提。**在 Phase 0 合併進 main 之前，A 和 B 不要碰 `globals.css`。**

| # | 內容 | 產出 |
|---|---|---|
| 0-1 | 建 `src/styles/tokens.css`：唯一 `:root` + `[data-surface="night"]`。刪掉其餘 **7 個** `:root`（globals×4、theme-modern×2、theme-detail×1、prayer-modern×1） | 一套顏色、一套字級、一套圓角、**一個** header 高度 |
| 0-2 | 抽 `src/components/PrayerCard.js`，首頁 hero／禱告牆／詳情頁「其他代禱」／會員中心共用 | 卡片只有一種長相 |
| 0-3 | 用語統一（裁決 4），105 處一次換完 | 使用者不會以為是不同功能 |

**順帶清掉的死碼（Phase 0 一起做，零風險）：**

```
src/styles/theme-profile.css    355 行   ← 沒有任何檔案 import
src/styles/theme-create.css     188 行   ← 同上
src/styles/prayer-detail.css   2186 行   ← 同上
src/styles/prayer-modern.css    969 行   ← 同上
src/styles/comments.css          69 行   ← 同上
────────────────────────────────────────
                              3767 行 = 全站 CSS 的 18%
```

外加：`src/app/v3-wireframe/**`（5 個 route）**全站零 inbound link**，`v3-wireframe.css` 225 行。
`admin.css`（734 行）在 `layout.js` 全站載入，公開頁不需要 → 移到 admin layout。

> ⚠️ A 提到「刪掉 `/customer-portal/edit`」——**只能刪 `edit/page.js`（批次 CMS 表單）**。
> `edit/[id]/page.js` 有從 `CustomerPortalClient.js:1140` 連進去，**不能刪**。

---

## 四、檔案所有權（最重要的一段）

三個 session 都要改 `globals.css`。這是唯一會炸的地方。

| Session | 擁有的檔案 | 禁止碰 |
|---|---|---|
| **Phase 0**（單一 session 做，建議 C） | `tokens.css`、`globals.css` 的 `:root`、5 個死檔、`PrayerCard.js`、全站用語 | — |
| **A** 會員中心 | `src/app/customer-portal/**`、`theme-customer.css`、`site-chrome.js` | `globals.css`、`theme-modern.css` |
| **B** 首頁滑動 | `HomePrayerHero.js`、`HomeLandingPage.js`、`src/lib/homeCards.js`、`api/home-cards/**` | `globals.css` 的 `:root`、`PrayerCard.js` 內部 |
| **C** 詳情頁／可信度 | `theme-detail.css`、`prayfor/[id]/**`、`GlobalPlayer*`、種子資料 | `customer-portal/**` |

**B 可以現在就開工**：階段 1（deck API）+ 階段 2（pointer 拖曳）完全是資料層與互動層，不碰 token。
**B 的階段 3（ambient 照片 + 露肩）必須等 Phase 0 的 `PrayerCard` 落地**，否則會做出第四種卡片。

---

## 五、施工順序

```
Phase 0  地基（阻塞其他所有人）
         tokens.css + PrayerCard + 用語統一 + 死碼清除
                │
        ┌───────┼───────────────┬──────────────────┐
        ▼       ▼               ▼                  ▼
Phase 1  A: 會員中心第一屏   B: deck + 拖曳     C: 可信度 P0
         禱告優先、空狀態      （可與 Phase 0 平行）  假回應、0人已禱告、白方塊
                │                    │                  │
                └────────────────────┴──────────────────┘
                                     ▼
Phase 2  視覺一致性收尾
         襯線標題、金色 accent、去 glass、圓角、B 的 ambient + 露肩
                                     ▼
Phase 3  路由整理（最後做，因為會動到很多 import）
         /customer-portal → /me（rewrite 保留舊連結）
         刪 edit/page.js、刪 v3-wireframe、登入後隱藏語言切換
```

---

## 六、我砍掉或延後的項目（附理由）

| 項目 | 出處 | 處置 | 理由 |
|---|---|---|---|
| 卡內 56px 縮圖（方案 C） | B | **砍** | 與 ambient 背景重複，且吃垂直高度。B 自己也說可以不做 |
| `/en/*` 真正做 i18n | A | **延後** | 工程量遠超這一輪。先做便宜版：**登入後隱藏語言切換**，不要給做不到的承諾 |
| `/customer-portal` → `/me` | A | **延後到 Phase 3** | 對，`customer-portal` 是 B2B 電商術語，該改。但它會動到大量 import，跟 A/B/C 的檔案全面衝突。等三邊都合併完再一次做 |
| 拿掉首頁統計數字（40/130/50/8） | C | **採納，Phase 1** | 小數字當社會證明會反效果。改成「最近 3 則真實回應」滾動 |
| 底部播放器加關閉鍵 | C | **採納，Phase 1** | 但 B 要注意：錄音器和 hero 佔同一位置（B 已標記），改動要對齊 |
| 通知機制（有人為你禱告時通知你） | A | **獨立追蹤，不進這一輪** | A 說得對：「再美的 UI 也救不了沒有回來的理由」。但這是產品功能不是 UI，混進來會拖垮整輪。**建議另開一條線，優先級不低於本輪** |

---

## 七、需要你決定的兩件事

### 決定 1：深色／淺色方向
我的建議是「裁決 1」的**兩種表面、一套 token**。
若你偏好 A 的「整站淺色」或 C 的「整站深色」，請現在說 —— 這會改寫 Phase 0 的內容，而且 Phase 0 一旦開始就不好回頭。

### 決定 2：種子回應要不要留
C 指出 25 則回應裡 20 則是生成的（同頭像、同名、38–45 字、同句式），而旁邊真人的「You will be fine」「加油希望你快點好起來」一眼可辨。

三個選項：
- **(a) 減量 + 拉開差異**：留 3–5 則，長度 8～120 字，不同匿名色塊與代號
- **(b) 全部拿掉**，改成「還沒有人回應，你可以是第一個」
- **(c) 保留但標註來源**

我傾向 **(b)**。這是可信度問題不是 UI 問題 ——「一個禱告平台連為你禱告的人都是假的」比空白傷得更重。但這牽涉冷啟動策略，是你的決定。

---

*本文由統整 session 產出，依據三份評估 + 對 `prayer-coin` 的程式碼驗證。所有數字（20,973 行 CSS／265 色／8 個 `:root`／3,767 行死碼／105 處用語）皆為實測。*

---

# 施工狀態（Phase 0 已完成）

分支 `design/phase0-foundation`，三個 commit，production build 通過。

## 已完成

| # | 項目 | 實測結果 |
|---|---|---|
| 0-1 | `src/styles/tokens.css` 成為唯一 token 來源 | **8 個競爭的 `:root` → 1 個檔案**。night 是 `<html data-surface>` scope，由 `layout.js` 依路徑決定 |
| 0-1b | 收編層把舊變數名接上語意 token | 舊選擇器自動跟著 surface 走，不必改完 17,000 行。白方塊那一類 bug 從源頭消失 |
| 0-2 | `src/components/PrayerCard.js` | 禱告牆與詳情頁「其他代禱」共用一份。首頁 hero 刻意不併（滿版沉浸卡 ≠ 格狀卡） |
| 0-3 | 用語統一 | **105 處、5 種說法 → 代禱**，量詞 張 → 則 |
| 0-4 | 死碼清除 | **−3,992 行**：5 個零 import 的 CSS 檔 + 整個 `v3-wireframe` route 樹 + `<body class="admin-layout">` no-op |
| — | `admin.css`（734 行）移出公開頁 | 只在 `src/app/admin/layout.js` 載入 |
| — | 單一 accent | 四套主色（藍紫漸層／淡金／藍青／青綠）→ 一個實心暖金 `#fbbf24` |
| — | 單一 header 高度 | `.site-header` 曾寫死 72px 而 body 只留 56/64px，**每一頁的頁首都壓著內容 8–16px**。現由 token 決定 |
| — | 對比修正 | 13 處 `color:#fff` 壓在 accent 上（換成暖金後只有 1.8:1）→ `--text-on-accent`，實測 **10.8:1** |

## 已修掉的版面缺陷（皆為三份評估點名、且已在 375×812 實測）

- `.home-card__prayer-badge` 在全站 CSS 中**沒有任何規則**，是裸 `<span>`；`.home-card__tag-row` 沒有 `gap` 也沒有 `flex-wrap` → 「13 人正在代禱」壓在分類標籤上。**實測重疊數 0**
- 封面圖沒有遮罩 → 加上兩端壓暗的 scrim（標題在上緣、metadata 在下緣，單向漸層保不住其中一邊）
- 卡片 metadata 是有框有底的膠囊，看起來像 disabled input → 降為低對比純文字 + 分隔點
- 行動版留言工具列殘留 `#fffdf8`（舊淺色版的奶白）→ 那塊包住「送出文字禱告」的白方塊
- 建立頁**完全沒有標題**：整段 hero 被 `--editor-only` 用 `display:none` 蓋掉，卻仍在 DOM 裡。換成一行真正的頁首，死碼（JSX、`HERO_POINTS`、兩份 CSS）清掉
- 詳情頁「立即禱告」與「為這件事禱告」導向同一處 → 前者降為次級外框，一屏一顆主按鈕
- 文案去「光點化」：「定義這個禱告光點」→「你想為什麼事禱告？」

## 與原計畫的兩處修正

**1. `--header-h` 定為 72px，不是 64px。** 原本計畫取 64，實測發現 `.site-header` 一直是 72px，只是 body 少留了空間。以實際渲染值為準才不會全站位移。

**2. `customer-portal` 與 `overcomer` 暫時標成 night，不是 day。** 裁決 1 說它們屬於 day，這個判斷沒變。但它們的樣式整套寫死深色（`theme-customer.css` + 各頁 styled-jsx），現在改 day 會得到一個半深半淺的頁面 —— 比統一深色更糟。`layout.js` 的 `NIGHT_PREFIXES` 留了 TODO，**這是 A 的 Phase 1 工作**，機制已經在，屆時是「改一行 + 重寫那些樣式」。

---

# 全部完成

四個階段都做完了，在 `design/phase0-foundation` 分支上，八個 commit。
`next build` 通過（91 頁）、`next lint` 乾淨、45 個單元測試全過。

## Phase 1 — 可信度與明顯破圖

| 項目 | 結果 |
|---|---|
| 播放器 | **不再預設出現**。改看 `currentTrack`（預鋪佇列的 index 是 −1），並加上關閉鈕，關閉狀態存 sessionStorage |
| **語音按鈕其實是壞的** | 這是修播放器時才浮出來的：31 張卡中 14 張標了語音，**其中 8 張的 `voiceHref` 指向 `/legacy/prayfor/details.html?...`，是 HTML 不是音檔**。那些「播放語音」按下去什麼都不會發生 —— 只是常駐播放列蓋住了這件事，看起來像在播（播的是別張卡）。`HomePrayerHero` 早就有這個判斷，但只寫在那一個元件裡，所以同一筆資料在 hero 被擋掉、在牆上長出按不動的按鈕。收進 `lib/voice.js`，13 顆按鈕變成 6 顆會動的 |
| 封面 fallback | 純黑方塊 → 依標題取色的夜色漸層 + 守望光暈 + 角落襯線標題 |
| `0 人已禱告` | → 「還沒有人回應這件事，你可以是第一個」 |
| 首頁統計數字 | 移除（40/130/50/8 這種量級是在替使用者確認「這裡沒人」） |
| 匿名回應 | 每位匿名代禱者有自己的代號與色塊，預設只顯示 5 則。**沒有動任何回應資料** |
| 留言閱讀順序 | 分享/⋯ 收回名字那一行，內文緊接名字 |

## Phase 2 — 帳號流程

- `/signup`、`/login`、`/me`、`/me/create`、`/overcomer` 全部轉成 **day**。從溫暖白色跨進冰冷深藍的斷層沒有了
- 頁首與漢堡鈕跟著 surface 走（漢堡鈕本來寫死白色，在白底上完全看不見）
- **會員中心第一屏翻成禱告優先**：48px 頭像收到角落、email 拿掉、「今天想為什麼禱告？」+ 兩顆動作，個人檔案走原本就有的 modal
- 兩個 0 的統計卡在沒有內容時不出現
- `Failed to load responses.` → 中文 + 重新載入按鈕（API 的英文訊息留在 console）
- 註冊頁單一錯誤不再顯示兩次
- 頁尾會看 session，不再對已登入的人說「登入 / 註冊」
- `/me` 隱藏語言切換（`/en/me` 只是 redirect 回中文）

## Phase 3 — 首頁滑動

- **deck**：SSR 一次帶 10 張，滑動 = 索引移動，零網路。順帶修掉「第一張用 needsPrayer、之後用 id 排序」的不一致
- **手指跟隨**：pointer events + 軸向鎖定（前 10px）+ 邊界阻尼 + 速度判定（快速輕彈也算）+ `prefers-reduced-motion`
- **只動 transform**，不再抽換 DOM
- **露肩 + 氛圍層**：鄰卡露出來當「還有更多」的證據；當前卡的照片重度模糊當背景，佔 0px 版面
- 標題是連結（拖過 8px 就不算點擊）、非當前卡 `inert`、點鄰卡是切過去不是跳頁
- 互動 hook 等停下來 180ms 才發請求

> 施工筆記：位移最後是在 JS 算好寫進 inline transform。原本把 `--i` 放進 CSS `calc()`，**只改自訂屬性時 transform 的過渡不會可靠地重新啟動** —— 卡片內容換了，軌道卻停在原地。

## Phase 4 — 路由

- `/customer-portal` → **`/me`**（`/en/customer-portal` → `/en/me`），舊網址用 **307** 轉址保留。刻意不用 308：永久轉址會被瀏覽器硬快取
- `CustomerPortalClient` → `MyPrayersClient`
- 刪掉 `/customer-portal/edit`（那個沒有任何連結指向、要人填 slug 與 meta 行的工程師表單）。`/me/edit/[id]` 保留
- 建立頁的 localStorage 草稿 key 刻意不改名，否則所有人正在寫的草稿會消失

## 順手修掉的

- 全球禱告室的地圖控制鈕被拉伸成 **211px 高的長條**壓在地球上（flex 換行後 `align-items` 預設 stretch），而且那層透明容器高 647px，連拖曳轉動地球都會被它吃掉

---

# 數字

| | 之前 | 之後 |
|---|---|---|
| CSS 行數 | 20,973 | 17,357 |
| 含 `:root` 的檔案 | 8 個區塊、4 個檔案 | **1 個檔案** |
| 主色 | 4 套 | 1 個 |
| header 高度 | 56 / 64 / 72 | 1 個 |
| 「代禱」的說法 | 5 種、105 處 | 1 種 |
| 會動的語音按鈕（禱告牆） | 6 / 13 | 6 / 6 |
| accent 上文字的對比 | 1.8:1（13 處） | 10.8:1 |

---

# 沒有做到的兩件事

1. **登入後的會員中心畫面沒有在瀏覽器裡實測。** 要驗證得先建立帳號或輸入密碼，那不是我會做的事。程式改動與樣式都經過 build 與 lint，但第一屏的實際排版請你自己開一次。
2. **種子回應的數量沒有動。** 前端的可信度問題（同頭像、同名、一次攤開 20 則）已經處理，但「每張卡要生成幾則」是冷啟動策略，屬於你的決定。若要減量，作法是把多出來的標成不公開，不是從 DB 刪除。
