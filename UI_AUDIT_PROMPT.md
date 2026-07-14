# UI/UX 全面審視 Prompt — Prayer Coin 前端

> 用途：貼給 Claude Code / Codex 等 agent，對本專案前端做一次完整體檢。
> 目標三件事：① 找出可精簡之處　② 找出文字被 CSS 吃掉（截斷/溢出/換行錯誤）的地方　③ 提出讓整體體驗更好的設計建議。

---

## 背景（已知專案現況，供 agent 直接使用，不需重新探索）

- 框架：Next.js 14（App Router）+ React 18，純 CSS（無 Tailwind、無 CSS-in-JS、無設計系統/token 套件）。
- 樣式檔案共 **11 個，總計約 20,100 行**：
  - `src/app/globals.css`（**8,943 行**，混雜 reset、排版、多個頁面的樣式）
  - `src/styles/theme-modern.css`（3,369 行）、`theme-detail.css`（2,340 行）、`prayer-detail.css`（2,186 行）、`prayer-modern.css`（969 行）、`theme-customer.css`（880 行）、`admin.css`（734 行）、`theme-profile.css`（355 行）、`theme-create.css`（188 行）、`comments.css`（69 行）、`fontawesome-lite.css`（75 行）
- Media query breakpoint **高達 17 種不一致寬度**（420/480/520/540/560/600/640/720/760/768/860/900/920/960/980/1024/1100px），代表沒有統一的響應式 token，容易在特定裝置寬度出現排版錯位或文字擠壓。
- 初步掃描（僅 CSS 檔）已發現 **121 處** `overflow: hidden` / `text-overflow` / `white-space: nowrap` / `-webkit-line-clamp` 等「會截斷文字」的宣告，是文字被吃掉的高風險來源，需逐一檢查是否有對應的 `title` 屬性、tooltip、或允許展開的機制。
- 頁面結構分三大區塊：
  - 前台使用者頁面：`src/app/*`（首頁、prayfor、overcomer、customer-portal、global-prayer-room、howto、terms 等）
  - **中英文路由重複**：`src/app/en/*` 幾乎鏡射 `src/app/*`（例如 `src/app/page.js` 7 行 vs `src/app/en/page.js` 19 行），需確認是否為刻意的 i18n 架構或是複製貼上造成的重複維護負擔。
  - 後台管理頁面：`src/app/admin/*`（dashboard、users、finance、wallet、content、moderation 等 12+ 頁）
  - 共用元件：`src/components/*`（含 `admin/` 與 `prayer-detail/` 子資料夾，約 26 個元件，命名上有 `Legacy*` 前綴的檔案，如 `LegacyFullpageNav.js`、`LegacyHeroSlider.js`、`LegacyMiniPlayer.js`，可能是可清理的技術債）

---

## 任務目標

請對本專案前端進行一次完整審視，產出一份**可執行的改善清單**，涵蓋以下三個面向：

### 1. 精簡（Simplification）
- 找出重複或高度相似的 CSS 規則（跨檔案的 class 命名衝突、覆蓋鏈過長、!important 濫用）。
- 找出未被任何元件使用的 CSS（dead code）。
- 評估 `src/app/en/*` 與根路由是否為必要的雙份維護，若非必要，提出合併/共用元件的方案。
- 找出 `Legacy*` 元件是否仍在使用，若已無引用則列入移除清單。
- 檢查是否有機會導入設計 token（顏色、間距、字級、統一 breakpoint 清單）取代目前 17 種不一致的 media query 寬度。

### 2. 文字被 CSS 吃掉（Text Clipping / Overflow）
針對前台與後台**所有頁面**，逐一檢查以下情境並列出檔案路徑 + 行號：
- `overflow: hidden`、`text-overflow: ellipsis`、`white-space: nowrap`、`-webkit-line-clamp` 是否用在「使用者輸入內容」或「動態長度文字」上（例如禱告內容、用戶暱稱、標題），且沒有 hover title / 展開按鈕 / tooltip 補救。
- 固定高度（`height`、`max-height`）搭配長文字時是否會裁切最後一行。
- 中文/長字串在窄螢幕（<480px）是否會被父層 `width` 或 `flex` 設定擠壓、換行錯位、或被按鈕/圖示遮住。
- 表單欄位（尤其後台 admin 的輸入框、下拉選單、表格儲存格）在長文字/長數字（例如錢包地址、交易 hash、email）時是否溢出容器。
- 按鈕/badge/標籤內文字在多語系或字數變動時是否會破版。
- `font-size` 是否有寫死 px 且未搭配 `line-height`，導致行距過窄使文字視覺上被切到。

### 3. 體驗設計（UX）
- 評估整體視覺一致性：顏色、字級、圓角、陰影是否跨頁面統一（可比對 `globals.css` 的 `:root` 變數與各 theme 檔案是否有各自覆蓋一套顏色）。
- 檢查前台使用者流程（登入、發布禱告、瀏覽、留言、提領）在手機寬度下的可用性。
- 檢查後台管理介面（12+ 個頁面）的資訊密度與導覽是否清楚，是否有機會統一表格/表單元件而非各頁各自刻一套樣式。
- 提出可行的下一步：哪些改動是「低風險高收益」（可以先做），哪些需要更大重構（列為後續規劃）。

---

## 執行方式建議

1. 先用 `grep`/`rg` 掃描全部 `overflow|text-overflow|white-space|line-clamp|ellipsis` 於 `src/app` 與 `src/styles`，建立風險清單（檔案:行號 + 該規則作用的 class/selector）。
2. 對照使用該 class 的元件，確認裡面放的是否為動態/使用者輸入內容。
3. 針對前台關鍵頁面（首頁、prayfor 詳情、customer-portal、global-prayer-room）與後台關鍵頁面（dashboard、users、finance）用瀏覽器在至少三種寬度（375px / 768px / 1440px）實際檢視，截圖標註出文字被裁切或跑版的位置。
4. 統整成一份 Markdown 報告，格式如下：

```
## [嚴重度: 高/中/低] 問題描述
- 位置：src/xxx/yyy.css:123 （或 .js 元件路徑）
- 現象：（例如：手機寬度 375px 下，禱告標題超過兩行時最後一個字被裁掉，且無 title 屬性可查看全文）
- 建議修法：（例如：改用 line-clamp: 2 + 加上 title={fullText}，或改為可展開「顯示更多」）
```

5. 最後附上「精簡建議」與「UX 改善建議」各自獨立成節，並標註優先順序（P0 立即修 / P1 本次迭代 / P2 之後排）。

---

## 交付要求

- 不要只列問題，每一項都要給具體修法（CSS 規則、元件邏輯調整、或需要設計決策的地方要明確指出）。
- 涉及 20,000+ 行 CSS 的全量重構不可能一次做完，請優先鎖定「使用者最常看到、文字最容易被吃掉」的頁面（首頁、prayfor 詳情頁、個人資料/customer-portal）。
- 若發現的問題數量龐大，先產出 Top 20 高優先度清單，其餘歸類到「待後續處理」附錄。
