---
tags: [start-pray, changelog]
---

# 變更歷程

參見 [[10-Implementation-Plan]]。

## 2026-08-03 — 第一階段盤點（本次）
- 建立 `docs/obsidian/` 知識庫，15 份文件
- **無任何程式碼、Schema、路由變更**
- Phase 0 基準確認：`npm run lint` 通過；確認無自動化測試套件
- Branch：`main`，Commit：`4f06e73aa95724ecb68bc5e0c8e4db8041f50ece`（盤點期間 working tree 維持 clean，僅新增 `docs/obsidian/*`）

## 2026-08-04 — Phase 1（部分）：導覽收斂 + 首頁地球暫時隱藏
- 修改檔案：`src/components/site-chrome.js`、`src/components/HomeGlobeHero.js`
- 內容：新增可回滾的常數旗標，隱藏登入/註冊/會員中心/全球禱告室的導覽與頁尾入口；首頁不再掛載 Cesium 地球視覺（保留裝飾用 `GlobeSkeleton`）
- 過程中發現並更正文件錯誤：先前 [[02-Current-Architecture]]、[[03-Current-Feature-Inventory]] 誤記為「三.js 首頁地球 + Cesium 全頁地球」兩套實作，實際上是同一個 Cesium 元件 `GlobalPrayerRoomOptimized` 被兩處呼叫；`three.js` 依賴與 `CesiumPrayerGlobe`/`LegacyPrayerGlobe` 是未使用的孤兒程式碼
- 驗證：`npm run lint` ✅、`npm run build` ✅；**未**做瀏覽器實測（本機無 Docker/MySQL 環境）
- 尚未執行：首頁核心區塊重建（等待設計方向確認）、commit（尚未依使用者要求建立 git commit）
- Commit hash：尚未建立（變更仍在工作目錄中，未提交）

## 2026-08-04 — Phase 1 補強：i18n／手機導覽／頁尾空欄位／過渡狀態記錄
- 修改檔案：`src/components/site-chrome.js`（僅新增頁尾空欄位過濾與旗標註解，無行為變更）
- 新增檔案：`.claude/launch.json`（本機預覽用的 dev server 設定，供 `npm run dev` 走瀏覽器驗收，非產品程式碼）
- 補強內容：
  - 逐一核對 `src/lib/i18n/locales/zh-TW.js`、`en.js` 確認 `nav.*` 六個 key 皆存在，且專案僅支援這兩個語系（`SUPPORTED_LOCALES`），無缺字風險
  - 確認 `.nav-links` 桌面/手機共用同一份 markup（CSS media query 切換樣式，非獨立元件），因此可見性規則自動同步套用於兩者
  - `SiteFooter` 的 `footerColumns` 渲染前加上 `.filter((column) => column.links.length > 0)`，防止未來旗標調整導致某欄目變成只剩空標題
  - 常數旁補上更完整的註解，說明這是 Phase 1 暫時性導覽開關、不代表底層功能已移除、匿名化完成後應與相關程式碼一併刪除
- 驗證（本次改用 `npm run dev` + 瀏覽器實測，`.env.local` 提供可用的 DATABASE_URL）：
  - 桌面（1280×800）、手機（375×812，含點擊漢堡選單展開）皆確認導覽列不含登入/註冊/會員中心/全球禱告室
  - 頁尾確認無空欄位，且不含被隱藏的四項
  - `/login`、`/global-prayer-room`、`/customer-portal` 直接訪問皆正常
  - `/en` 英文導覽正確顯示 Prayer Wall/Stories/About/How It Works，無 undefined
  - `npm run lint`、`npm run build` 皆通過
- 已登入會員的導覽（建立代禱/問候語/登出）維持不變，並已在 [[06-Authentication-Dependencies]]、[[09-Change-Impact-Analysis]]、[[10-Implementation-Plan]] 明確記錄：**這是 Phase 1 過渡相容行為，不代表 Target MVP 最終仍保留會員系統**
- 順便發現一個與本次改動無關的既有小問題，已記錄到 [[14-Open-Questions]]：`HomeGlobeHero.js` 的 hero 文案 `TEXT` 是寫死的中文物件，並未走 i18n 字典，`/en` 頁面上「分享代禱需要」等 hero CTA 文字目前仍顯示中文
- 尚未執行：首頁核心區塊重建、Cesium 移除、commit（未依使用者要求建立）

## 2026-08-04 — Commit 1 與 Commit 2 正式建立
- 建立分支 `poc/minimal-prayer-redesign`（原改動皆在 `main` 工作目錄中未提交，依使用者要求切分支後才 commit，保留原有未提交修改）
- Commit `6b8cc84` `refactor: simplify account and global navigation`：`src/components/site-chrome.js` + 5 份 obsidian 文件
- Commit `04538e7` `refactor: replace globe hero with minimal prayer entry`：新增 `src/components/HomePrayerHero.js`，修改 `src/components/HomeLandingPage.js`、`src/lib/i18n/locales/{zh-TW,en}.js`；`HomeGlobeHero.js` 的暫時性修改已用 `git restore` 還原，未進入任何 Commit
- Phase 1 階段性驗收（[[16-Final-Acceptance-Report]]）結論：**Phase 1 通過，可進入錄音功能開發**
- `.claude/launch.json`、`output/spreadsheet/startpray-progress-tracker.xlsx`（既有 post-commit hook 自動產生）皆未進入任何 Commit

## 2026-08-04 — Commit 3（進行中）：首頁錄音前端流程
- 新增 `src/components/prayer-recorder/`（`recorder-utils.js`、`usePrayerRecorder.js`、`PrayerRecorder.js`）
- 修改 `src/components/HomePrayerHero.js`（CTA 改為切換至 `PrayerRecorder`）、`src/lib/i18n/locales/{zh-TW,en}.js`（新增 `home.recorder.*`）
- 新增 `tests/recorder-utils.test.mjs`，`package.json` 新增 `test:unit` script（`node --test tests/`，7/7 通過）
- 盤點確認 `VoicePrayerOverlay.js` 的錄音引擎與 Auth/上傳完全解耦，新 hook 重用其權限/MIME/停止逾時/清理技巧，但不搬移字幕/語音辨識
- Browser tested（真實瀏覽器行為）：權限拒絕、不支援瀏覽器兩條路徑；桌面 1280×800、手機 375×812；中英文案
- Real microphone Not Tested（自動化環境無法授權真實麥克風）
- 明確不處理：匿名投稿 API、Schema、Storage、字幕
- 詳見 [[21-Recorder-State-Machine]]、[[15-Acceptance-Criteria]]

## 2026-08-04 — Commit：docs: document current architecture and redesign progress（`4eaea7e`）
- 整理 9 份先前一直未提交的 obsidian 文件（00/01/02/04/05/07/11/13/16），修正過時內容（首頁地球描述、DEC 狀態、[[07-Target-MVP]] 支援度表）

## 2026-08-04 — Commit：docs: design anonymous prayer submission architecture（`78103e0`）
- 新增 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]]
- 重大發現：匿名文字投稿與匿名建卡**已經在運作**（非提案），唯一硬性卡點只有語音的 `VOICE_LOGIN_REQUIRED`；核心匿名語音送出**不需要 Schema migration**

## 2026-08-04 — Commit：feat: support anonymous prayer submission（Phase 3A，待建立 Commit）
- 修改 `src/app/api/responses/route.js`（移除語音登入卡點、修正 guest 崩潰 bug）、`src/components/prayer-recorder/usePrayerRecorder.js`（暴露 `getBlob`）、`src/components/prayer-recorder/PrayerRecorder.js`（真正呼叫送出 API）、`src/lib/i18n/locales/{zh-TW,en}.js`
- Real API tested：真實呼叫本機開發 DB，成功寫入 2 筆測試 `PrayerResponse` 並可讀回音訊檔；驗證 guest 崩潰 bug 已修正
- 已知殘留：本機 DB 留有 2 筆測試資料未清理（無刪除 API）；管理 Token（Phase 3B）尚未實作
- 詳見 [[10-Implementation-Plan]] Phase 3A/3B、[[15-Acceptance-Criteria]]

## 2026-08-04 — Commit：refactor: present prayer needs as the homepage focus（Commit A，待建立）
- 產品方向修正：首頁從「訪客錄下自己的新需要」改為「顯示一件既有 Prayer，訪客為它禱告」（`PrayerResponse` 語意，不建立新 `HomePrayerCard`）
- 新增 [[25-Companion-Mode-Reuse-Audit]]：盤點既有陪伴模式（`AudioContext.js`/`GlobalPlayer.js`）與「我已為你禱告」機制，發現後者完全不存在，需要新 Schema
- 修改 `HomeLandingPage.js`、`HomePrayerHero.js`、`prayer-recorder/PrayerRecorder.js`、i18n 兩檔
- Real API tested：首頁綁定的真實 `prayerId` 與送出後 API 回傳的 `homeCardId` 完全一致
- 詳見 [[10-Implementation-Plan]]「最終首頁改造」章節

## 2026-08-04 — Commit：feat: add prayer browsing and companion playback（Commit B，待建立）
- 新增左右滑動/鍵盤切換 Prayer、全螢幕陪伴模式（重用 `AudioContext`/`useAudio()`，零新增播放狀態）
- 修正 `GlobalPlayerGate.js`：首頁原本不在白名單，會導致陪伴模式一開始播放就被自動暫停
- 新增 `src/app/api/home-cards/[id]/adjacent/route.js`（薄 adapter，重用 `readAdjacentHomeCards`）、`src/components/home-companion/`（`CompanionOverlay.js`、`swipe-utils.js`）
- Real API/Browser tested：鍵盤與觸控 swipe 切換 6 張真實卡片、陪伴模式載入真實 9 筆回應資料、`/global-prayer-room`與`/prayfor/[id]` 回歸正常
- 已知限制：Real Audio Playback Not Tested（既有種子資料與測試環境限制）；三點選單/檢舉僅登入者可見（既有 API 要求登入）；Recording/Countdown/Uploading 阻擋狀態需真實麥克風才能測試
- 詳見 [[10-Implementation-Plan]] Commit B、[[25-Companion-Mode-Reuse-Audit]]

## 2026-08-05 — Commit：refactor: unify anonymous prayer interactions across prayer pages（Commit C1，待建立）
- 匿名檢舉：`POST /api/prayer-response/report` 新增 guest 分支（不寫 `PrayerResponseReport`，改沿用 `PrayerResponse.moderationStatus`/`reportCount` 冪等隱藏 + `AdminLog` 稽核 + DB-backed rate limit），登入分支邏輯完全不變；`CompanionOverlay.js` 三點選單對所有訪客開放
- 共用元件：新增 `src/components/prayer-interaction/usePrayerInteraction.js`（Recorder/Companion/可播放清單狀態），`HomePrayerHero.js` 與新的 `src/components/prayer-detail/DetailPrayerInteractionPanel.js` 共用同一顆 Hook
- `/prayfor/[id]` 新增匿名錄音/陪伴入口（`DetailPrayerInteractionPanel`，插入於 hero card 之後），重用與首頁完全相同的 `PrayerRecorder`/`CompanionOverlay`；未修改既有 `Comments.js`/`VoicePrayerOverlay.js`（服務登入會員，決策見 [[27-Shared-Prayer-Interaction-Audit]]）
- 修正實作中發現的真實 Bug：guest 檢舉的 IP 頻率限制第一版用了 Postgres/Mongo 的 Prisma JSON path 陣列語法，在 MySQL provider 下觸發 500；已修正為 MySQL 需要的字串型 path，Real API tested 通過
- 新增 `docs/obsidian/19-Security-Review.md`、`26-Anonymous-Reporting-Design.md`、`27-Shared-Prayer-Interaction-Audit.md`
- Real API/Browser tested：匿名檢舉全流程（成功/冪等重複/偽造欄位/rate limit/hidden 後公開查詢排除/陪伴入口消失）、`/prayfor/[id]` 匿名錄音入口（permission-denied 真實路徑）、Mobile 375/390/412 與 Desktop 1280/1440 無橫向捲動、X 與 Report 行為分離、`/global-prayer-room`/`/login`/`/signup`/`/customer-portal`/`/admin` 回歸正常
- 已知限制：Real microphone 錄音全流程 Not Tested（環境限制）；匿名檢舉無法逐筆追蹤同一訪客的重複檢舉（設計取捨，見 [[26-Anonymous-Reporting-Design]]）；已流出的音檔直接網址在檢舉後仍可存取（既有風險，非本次引入）
- 詳見 [[10-Implementation-Plan]] Commit C1、[[27-Shared-Prayer-Interaction-Audit]]、[[26-Anonymous-Reporting-Design]]、[[19-Security-Review]]

## 2026-08-05 — Commit：feat: add anonymous prayed reactions（Commit 1，待建立）
- 新增 `PrayerPrayedReaction` 表（additive Schema 變更，本機開發 DB 已套用，Real DB tested）+ `GET`/`POST /api/home-cards/[id]/prayed`
- 唯一防重複鍵改用 `actorType`+`actorKeyHash`（兩者永遠非 NULL），而非規格文件建議的 nullable `userId`/`guestSessionHash`——因為 MySQL 的 UNIQUE INDEX 允許多個 NULL 並存，無法單靠 nullable 欄位防止匿名重複
- Migration 執行過程中發現兩個既有、與本次無關的環境問題（`prisma migrate dev` shadow DB 重放既有 migration 失敗、`prisma db push` 會刪除既有 drift 欄位），改用手動 SQL + `prisma db execute` + `migrate resolve` 精準套用，未觸碰任何既有表
- 新增共用 `usePrayedReaction`/`PrayedReactionButton`，首頁與 `/prayfor/[id]` 共用同一套元件，含 stale-response 防護
- Real DB/API/Browser tested：建立、冪等重複、hidden/deleted 拒絕、偽造欄位無效、rate limit（20 個不同 Prayer/10 分鐘）、Prayer 切換狀態正確重置、reload 狀態保留
- 已知限制：migration 未在全新環境驗證重放；Admin 無查看明細介面（規格未要求）；Real microphone 迴歸 Not Tested
- 詳見 [[10-Implementation-Plan]] Commit 1、[[28-Prayed-Reaction-Design]]

後續每個 Implementation Plan Phase 執行後，應在此新增一筆紀錄（日期、Phase、實際修改檔案、commit hash）。
