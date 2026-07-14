# PRD-007 — 手機版使用流程 (Mobile UX)

- 階段：**P2**
- 狀態：未開始
- 依賴：無
- 對應落差：README 自列「改善手機版使用流程」為最需要協助項;「全球」平台但手機體驗不順。

---

## 1. 目標 (Goal)

讓三條最關鍵的使用者旅程在手機(viewport ≤ 414px)上順手:
(1) 瀏覽禱告牆、(2) 建立代禱卡、(3) 錄製 / 上傳語音回應。
不做大改版,聚焦「不卡、不爆版、拇指可及」。

## 2. 背景與現況 (Background)

- 導覽:`src/components/site-chrome.js`。
- 牆:`src/app/prayfor/page.js` + `src/components/HomePrayerExplorer.js`。
- 建立:`src/app/customer-portal/create`。
- 錄音 / 播放:`src/components/PrayerAudioPlayer.js`、`HeroPlayButton.js`、`GlobalPlayer.js`。
- 樣式:`src/app/globals.css`、`src/styles/*.css`,部分頁用 `style jsx`。
- **現況**:桌機優先,手機上可能有導覽、表單、播放器爆版或觸控目標過小的問題。

## 3. 範圍 (Scope)

**In scope**
- 響應式修正上述三條旅程的版面與觸控目標(最小 44×44px)。
- 手機上的導覽(漢堡選單 / 底部列擇一,沿用既有結構)。
- 建立卡片表單在手機上的可用性(欄位不溢出、城市選單可點、圖片上傳可用)。
- 錄音 / 播放控制在手機可操作。

**Out of scope(不要做)**
- ❌ 不做原生 App / PWA 安裝(另開 PRD)。
- ❌ 不重寫設計系統 / 不換 CSS 框架。
- ❌ 不改任何後端 / API / 資料模型。

## 4. 詳細實作步驟 (Implementation)

**Step 0 — 量測(先做,先回報)**
列出在 375px / 414px 下實際出問題的畫面與元件(可用瀏覽器 devtools)。**先產出問題清單再改**,避免無的放矢。建議附 before 截圖(專案根目錄已有 `tmp-global-prayer-room*.png` 之類截圖慣例)。

**Step 1 — 全域基礎**
- 確認 `src/app/globals.css` 有正確的 `box-sizing: border-box`、圖片 `max-width:100%`、`viewport` meta(在 root layout)。
- 統一一組手機斷點變數(如 `--bp-mobile: 640px`),避免各頁各寫魔術數字。

**Step 2 — 導覽**
- `site-chrome.js`:手機寬度下收合導覽,確保可開關、可點、不擋內容、z-index 正確。

**Step 3 — 禱告牆**
- 卡片改單欄;排序/篩選 chip 可橫向捲動;搜尋框全寬。

**Step 4 — 建立卡片**
- 表單欄位全寬、label 不截斷;城市下拉(`PrayerLocationField.js`)在手機可正常選;圖片上傳按鈕夠大;送出按鈕固定可達。

**Step 5 — 錄音 / 播放**
- 播放 / 錄音按鈕 ≥ 44px;進度條可拖;`GlobalPlayer` 在手機不遮蓋底部內容或與導覽打架。

> 全程只改 CSS / 版面 / 必要的 client 互動;不要動資料流。

## 5. 資料模型變更

- **無**。純前端 / 樣式。

## 6. 驗收標準 (Acceptance Criteria)

在 375px 與 414px viewport 下逐條驗:

1. 問題清單(Step 0)已產出並列在回報中,附 before 截圖。
2. No horizontal scroll / overflow on:首頁、`/prayfor`、`/customer-portal/create`、`/prayfor/[id]`。
3. 導覽可在手機開關,選單項目可點,不遮蓋主內容。
4. 禱告牆為單欄;排序/篩選控制可用且不爆版。
5. 建立卡片表單:所有欄位可輸入、城市選單可選、圖片上傳可觸發、送出鈕可點。
6. 所有主要互動元素觸控目標 ≥ 44×44px。
7. 語音播放 / 錄音控制在手機可操作;`GlobalPlayer` 不與導覽重疊。
8. 桌機版(≥1024px)外觀無回歸 —— 附 desktop 前後對照。
9. `npm run lint` + `npm run build` pass.
10. `git diff --name-only` 僅含 CSS / 元件檔,無 API / schema / lib 資料層變更。

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ❌ 不要動任何 API route、Prisma、`src/lib` 資料邏輯。
- ❌ 不要為了響應式而引入 Tailwind / Bootstrap 等新框架。
- ✅ 先量測列清單,再針對性修;不要全站盲改 CSS。
- ✅ 每改一個頁面,順手確認桌機版沒壞(最常見回歸)。
- ⚠️ 截圖存到專案約定位置或 `tmp/`,不要塞進 `public/`。
