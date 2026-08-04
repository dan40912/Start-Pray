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
- **更新（2026-08-04，Commit 2 完成後）**：首頁核心區塊重建已完成——新增 `HomePrayerHero.js` 取代 `HomeGlobeHero.js` 成為首頁第一屏，Cesium 地球 hero 完全不再掛載於首頁（`HomeGlobeHero.js` 本身未刪除，變成孤兒元件，`/global-prayer-room` 全頁不受影響）
- 完成狀態：**完成**（導覽收斂、地球隱藏、首頁核心區塊重建皆已完成並經瀏覽器實測）

## Phase 2：匿名錄音流程 —— 完成（2026-08-04，對應 Commit 3）
- 目標：未登入狀態下可完整走完「授權→錄音→預覽→重錄」，尚不涉及送出 API
- 已修改/新增檔案：
  - 新增 `src/components/prayer-recorder/recorder-utils.js`（純函式：MIME 選擇、時長格式化、支援度偵測）
  - 新增 `src/components/prayer-recorder/usePrayerRecorder.js`（錄音狀態機 hook，重用 `VoicePrayerOverlay.js` 的權限/MIME/停止逾時/清理技巧，不含字幕/Auth/上傳）
  - 新增 `src/components/prayer-recorder/PrayerRecorder.js`（UI，依 [[21-Recorder-State-Machine]] 的狀態渲染）
  - 修改 `src/components/HomePrayerHero.js`（CTA 點擊後同頁切換成 `PrayerRecorder`）
  - 修改 `src/lib/i18n/locales/zh-TW.js`、`en.js`（新增 `home.recorder.*`）
  - 新增 `tests/recorder-utils.test.mjs` + `package.json` 新增 `test:unit` script
- 驗收條件：麥克風被拒絕/不支援時有清楚提示；錄音/預覽/重錄狀態機邏輯完整；`npm run lint`、`npm run build`、`npm run test:unit`、`npm run i18n:check` 皆通過
- 測試方式：
  - `npm run test:unit`（`node --test`）✅ 7/7 通過
  - `npm run i18n:check` ✅ 462 keys 一致
  - Browser tested（真實瀏覽器，非 Mock）：權限拒絕畫面（自動化環境本身封鎖麥克風，觸發真實 reject 路徑）、不支援瀏覽器畫面（移除 `window.MediaRecorder` 後驗證）、桌面/手機版面、中英文案
  - **Real microphone Not Tested**：完整「允許→倒數→錄音→停止→預覽→重錄」全流程需要真實麥克風輸入，自動化環境無法提供，需人工在真機/桌機瀏覽器補測
- 回滾方式：`git revert` 對應 commit，或刪除 `src/components/prayer-recorder/` 並將 `HomePrayerHero.js` 的 CTA 改回單純顯示 Prototype 文字（Commit 2 當時的行為）
- 風險：Cleanup（timer/stream/Object URL）邏輯未能實測（無法模擬完整錄音後卸載元件），僅程式碼比對確認與 `VoicePrayerOverlay.js` 一致
- 完成狀態：**完成**（前端錄音狀態機；不含匿名投稿 API/字幕，明確排除於本階段）

## Phase 3A：匿名投稿（核心送出，無需 Migration）—— 完成（2026-08-04）
- 目標：語音回應可在不登入狀態下送出，走既有 `PrayerResponse` 表（依 [[20-Anonymous-Submission-Design]] 方案 1，使用者已確認採用此方向，不需要 Prisma migration）
- 已修改檔案：
  - `src/app/api/responses/route.js`：移除 94-103 行的 `VOICE_LOGIN_REQUIRED` 硬性檢查；修正 246-252 行的 bug（`recentVoiceCount` 查詢原本無條件讀取 `session.userId`，guest 情境下會直接拋出例外，改用既有的 `identityWhere` 模式）
  - `src/components/prayer-recorder/usePrayerRecorder.js`：新增 `getBlob()` 存取器，暴露錄音完成後的 Blob 供上傳使用
  - `src/components/prayer-recorder/PrayerRecorder.js`：「下一步：匿名送出」改為真正呼叫 `GET /api/home-cards?mode=one`（取得一張既有公開卡片）+ `POST /api/responses`（帶上錄音 Blob），新增 `uploading`/`success`/`failed` 三種送出狀態畫面
  - `src/lib/i18n/locales/zh-TW.js`、`en.js`：新增送出中/成功/失敗相關文案
- 驗收條件：匿名使用者可送出語音回應並成功落入 `PrayerResponse`（`responderId = null`）；重複送出會被既有 rate limit 擋下且不崩潰
- 測試方式：
  - `npm run lint`、`npm run build`、`npm run test:unit`、`npm run i18n:check` 皆通過
  - **Real API tested（非 Mock）**：在真實瀏覽器對本機開發資料庫（`localhost:3306/prayercoin_dev`）直接呼叫 `GET /api/home-cards?mode=one` 取得真實卡片（id=5），再 `POST /api/responses` 送出合成音訊 Blob，回傳 `201`，`voiceUrl` 指向的檔案可透過 `/voices/[...path]` 實際讀回（bytes 數一致）；針對同一 guest 對不同卡片送出第二筆語音，驗證修正後的 `recentVoiceCount` 查詢不再崩潰（回傳 `201`，非 500）
  - 前端 UI 層級的「preview → 點擊送出 → uploading → success/failed」畫面切換邏輯經程式碼審查確認正確，但**未能透過自動化瀏覽器完整走一次**（麥克風存取在此環境被封鎖，無法到達 preview 階段），標記 `Real microphone UI flow Not Tested`
- 回滾方式：`git revert` 對應 commit（純 API + 前端邏輯改動，無 schema 變更，回滾零風險）
- 風險：
  - 本次在本機開發資料庫留下 2 筆測試用 `PrayerResponse` 與對應音訊檔（`id=5`、`id=39` 卡片各一筆），因為**目前系統沒有任何刪除 `PrayerResponse` 的 API**（見 [[20-Anonymous-Submission-Design]] 依賴矩陣），無法自動清理，需要你視情況透過 `prisma studio` 或後台手動清除
  - 尚未實作：Management Token（匿名刪除自己投稿的能力）、DB-backed 的 guest 語音專屬 rate limit（沿用既有文字回應的 rate limit，未新增獨立限制）、伺服器端音訊時長驗證（沿用現況「前端自律，後端不驗證」）
- 完成狀態：**完成**（核心匿名語音送出可用；管理 Token/刪除能力為 Phase 3B，尚未開始）

## Phase 3B：匿名管理 Token（刪除能力）—— 未開始
- 目標：匿名使用者可用一次性 Token 刪除自己剛送出的語音回應
- 依賴：需要 Schema migration（`PrayerResponse.managementTokenHash`，見 [[23-Database-Migration]] 方案 A）與新的 `DELETE` API
- 狀態：**設計已完成**（[[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]]），尚未實作、尚未建立 migration

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
