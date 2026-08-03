---
tags: [start-pray, implementation-plan]
---

# 分階段實作計畫

參見 [[09-Change-Impact-Analysis]]、[[11-Decision-Log]]。**本次盤點僅完成 Phase 0，Phase 1 以後尚未執行，需等待 [[11-Decision-Log]] 中的決策確認。**

## Phase 0：建立基準 —— ✅ 已完成（本次盤點）
- 目標：確認專案可正常運作，建立可回滾的起點
- 修改檔案：無（純檢查）
- 執行內容：
  - `git status` / `git log -1` → branch `main`，commit `4f06e73a`，working tree clean
  - `node_modules` 已存在，未重新安裝
  - `npm run lint` → ✅ 通過，無警告或錯誤
  - 檢查測試現況 → **專案無自動化測試套件**（無 test script、無 `*.test.js`），僅有 `scripts/qa-flow.mjs` 可作腳本化 QA
- 驗收條件：以上四項皆有明確記錄 ✅
- 測試方式：見上
- 回滾方式：不適用（無程式異動）
- 風險：無自動化測試意味著後續每個 Phase 都需要更仰賴手動 QA / `qa-flow.mjs` / 瀏覽器實測
- 完成狀態：**完成**

## Phase 1：UI 收斂但不破壞後端 —— 部分完成（2026-08-04）
- 目標：讓首頁視覺與導覽收斂，但不動任何 API/資料庫邏輯
- 已修改檔案：
  - `src/components/site-chrome.js` — 新增 `SHOW_ACCOUNT_NAV_ENTRIES`、`SHOW_GLOBAL_ROOM_NAV_ENTRY` 兩個常數（預設 `false`）；`PRIMARY_NAV` 改為以 `key` 對應 i18n 字典（原本用位置索引，改動時一併修正避免錯位）；主導覽與頁尾的登入/註冊/會員中心/全球禱告室連結依常數條件式隱藏；已登入會員的導覽列（建立代禱／問候語／登出）不受影響
  - `src/components/HomeGlobeHero.js` — 新增 `SHOW_HOME_GLOBE_VISUAL` 常數（預設 `false`）；不再掛載 `HeroGlobe`（避免載入 Cesium），改用既有的 `GlobeSkeleton` 靜態裝飾；同步隱藏「進入全球禱告室」CTA 與地球縮放按鈕；標題/副標題/主要 CTA（分享代禱需要）/統計數字維持不變
- 驗收條件：`/login`、`/signup`、`/customer-portal`、`/global-prayer-room` 頁面**仍可透過直接網址訪問**（只是拿掉入口，未刪除路由或元件）；桌面與手機導覽、頁尾皆不顯示登入/註冊/會員中心/全球禱告室；頁尾不留空欄位；所有支援語系（zh-TW、en）皆無 `undefined`/空白/未翻譯；`npm run lint`、`npm run build` 皆通過
- 測試方式：
  - `npm run lint` ✅
  - `npm run build` ✅（確認 `/login`、`/signup`、`/customer-portal`、`/global-prayer-room` 等路由仍存在且成功編譯）
  - i18n 覆蓋檢查：確認專案僅支援 `zh-TW`（預設）與 `en`（`src/lib/i18n/index.js` 的 `SUPPORTED_LOCALES`），且 `nav.prayerWall/globalRoom/overcomer/about/howto/portal` 等 key 在兩個語系字典（`src/lib/i18n/locales/zh-TW.js`、`en.js`）中皆存在，改用 key 對應後不會有缺字
  - `npm run dev`（本機啟動，`.env.local` 已提供可用的 `DATABASE_URL`，實際連得上資料庫）+ 瀏覽器實測：
    - 桌面（1280×800）：導覽列僅顯示 禱告牆/得勝者/平台介紹/使用方式/切換語言/分享代禱需要，無登入/註冊/會員中心/全球禱告室 ✅
    - 手機（375×812）：漢堡選單開關前後，nav 項目與桌面一致，同樣不含被隱藏的四項 ✅
    - 頁尾：Start Pray 欄僅剩 禱告牆/得勝者/平台介紹/使用方式；帳號與幫助欄僅剩「聯絡我們」；無空欄位 ✅
    - 英文版 `/en`：Prayer Wall / Stories / About / How It Works 正確顯示，無 undefined ✅
    - 直接訪問 `/login`、`/global-prayer-room`、`/customer-portal` 皆正常開啟（分別回傳「登入」「全球禱告室」「會員中心」頁面標題）✅
- 回滾方式：把 `site-chrome.js`、`HomeGlobeHero.js` 內的常數改回 `true`，或 `git revert` 對應 commit
- 風險：無自動化測試套件可執行；`scripts/qa-flow.mjs` 需要完整跑一輪帳號/投稿流程，本次僅做導覽/i18n/路由層級的目視驗收，未跑該腳本
- 過渡狀態（重要）：已登入會員的導覽列（建立代禱／問候語／登出）本次**刻意維持不變**，這是 Phase 1 的過渡相容行為，不代表 Target MVP 最終仍保留會員系統。詳見 [[06-Authentication-Dependencies]]、[[09-Change-Impact-Analysis]] 的 2026-08-04 更新
- 未執行的部分：首頁「移除非核心視覺」「建立新的首頁核心區塊」尚未進行——這牽涉版面與文案的產品設計決策（錄音按鈕放在哪、既有 `HomeEntryCards`/`HomeProofSection`/`HomePrayerExplorer` 區塊如何取捨），需要先確認設計方向再動手，避免在沒有共識下重寫最重要的第一畫面；Cesium 地球 hero 本身也尚未移除（僅停止掛載，元件與 `/global-prayer-room` 全頁維持原樣）
- 完成狀態：**部分完成**（導覽收斂 + 地球隱藏已完成並經瀏覽器實測；首頁核心區塊重建待下一輪確認後執行）

## Phase 2：匿名錄音流程 —— 待執行
- 目標：未登入狀態下可完整走完「授權→錄音→預覽→重錄」，尚不涉及送出 API
- 修改檔案（預期）：`src/components/VoicePrayerOverlay.js`（確認/補齊行動瀏覽器錯誤處理、失敗重試 UI）
- 驗收條件：手機瀏覽器（iOS Safari、Android Chrome）皆可完成錄音預覽，麥克風被拒絕時有清楚提示
- 測試方式：真機或瀏覽器裝置模擬 + 手動 QA
- 回滾方式：單一 commit revert
- 風險：不同瀏覽器對 `MediaRecorder`/`getUserMedia` 支援度不同，需要相容性測試
- 完成狀態：**未開始**

## Phase 3：匿名投稿 —— 待執行（需先有 DEC-007 決策）
- 目標：語音回應可在不登入狀態下送出
- 修改檔案（預期）：`src/app/api/responses/route.js`（移除/調整 `VOICE_LOGIN_REQUIRED` 檢查，改用 `guestSessionHash`/`ipHash`）、新增 rate limit 邏輯、`src/lib/storage/localDriver.js` 或相關檔案補檔案大小/時長限制
- 驗收條件：匿名使用者可送出語音回應並成功落入 `PrayerResponse`（`responderId = null`）；rate limit 生效（同一裝置短時間重複送出會被擋）
- 測試方式：手動以無痕視窗模擬匿名使用者測試；檢查資料庫寫入結果
- 回滾方式：feature 層級可用環境變數或條件判斷快速關閉，程式碼本身走單一 commit revert
- 風險：**這是本次改造中風險最高的一步**，濫用/垃圾內容風險需在上線前確認 rate limit 與內容審核已到位
- 完成狀態：**未開始**

## Phase 4：公開播放與禱告回應 —— 待執行
- 目標：完善「我為你禱告」互動與匿名內容管理雛形
- 修改檔案（預期）：新增輕量互動元件、`/api/responses` 或新端點支援「我為你禱告」單獨動作、防重複點擊機制
- 驗收條件：同一裝置對同一則禱告短時間內重複點擊不會重複計數；基本統計數字正確
- 測試方式：手動 QA + 檢查資料庫計數
- 回滾方式：單一 commit revert
- 風險：需避免與現有「送出文字回應」邏輯混淆，需先在 DEC 中定義清楚「我為你禱告」到底是不是等於送出回應
- 完成狀態：**未開始**

## Phase 5：清理舊功能 —— 待執行（僅在前面全部驗證完成後才可進行）
- 目標：正式移除不再使用的登入 UI、地球功能、孤立元件
- 修改檔案（預期）：視 Phase 1-4 實際結果而定，執行前需重新盤點屆時的「未使用」清單，不可依本次盤點結果直接刪除
- 驗收條件：移除後 `npm run lint`、`npm run build` 皆通過；`qa-flow.mjs` 通過
- 測試方式：完整回歸測試（手動，因無自動化測試）
- 回滾方式：需要提前建立安全分支/tag，方便整批回滾
- 風險：一次刪除過多會難以定位問題根因，務必分成多個小 commit（登入頁、地球、未用套件分開清理，見 Commit 規則）
- 完成狀態：**未開始**

## 總原則提醒
- 每個 Phase 完成後才能進入下一個 Phase
- 每個 Phase 對應獨立 commit（或多個小 commit），不得混合不同目的
- Phase 3、5 屬高風險，執行前需再次確認 [[13-Risk-Register]]
