---
tags: [start-pray, inventory]
---

# 目前功能與頁面完整盤點

參見 [[02-Current-Architecture]]、[[05-Data-Model]]、[[06-Authentication-Dependencies]]。本文件記錄**目前實際存在**的所有頁面與功能，不只是預計保留的部分。

## 3.2 頁面／Route 清單

「建議處理」僅使用：保留 / 簡化 / 合併到首頁 / 暫時隱藏 / 移除 / 待確認

| 頁面／Route | 頁面目的 | 主要元件 | 是否需要登入 | 使用的 API | 建議處理 |
|---|---|---|---|---|---|
| `/`（`src/app/page.js`） | 首頁：地球 hero + 禱告牆瀏覽 | `HomeLandingPage.js`、`HomeGlobeHero.js`（three.js）、`HomePrayerExplorer.js` | 否 | `/api/home-cards`、`/api/banner`、`/api/home-categories` | 簡化（成為核心錄音入口） |
| `/en`（同構 `/en/*`） | 英文版首頁與各頁 i18n 變體 | 同對應中文頁 | 依對應頁 | 同對應頁 | 待確認（是否維持雙語） |
| `/prayfor`（`src/app/prayfor/page.js`） | 禱告牆列表 | 列表元件 | 否 | `/api/home-cards` | 合併到首頁 |
| `/prayfor/[id]` | 單則禱告卡片詳情/播放 | `PrayerAudioPlayer.js`、`VoiceWallPlayer.js` | 否（讀取），登入才能檢舉 | `/api/home-cards`、`/api/responses/[homeCardId]` | 簡化 |
| `/prayfor/one` | 單卡片變體視圖 | 同上 | 否 | 同上 | 待確認 |
| `/global-prayer-room` | 全球禱告室：Cesium 3D 地球（`GlobalPrayerRoomOptimized`，見 [[02-Current-Architecture]]） | `GlobalPrayerRoom.js`（6630 行） | 否 | `/api/home-cards` 等 | **已處理**：導覽入口已隱藏（`SHOW_GLOBAL_ROOM_NAV_ENTRY=false`），路由本身保留可直接訪問 |
| `/overcomer`、`/overcomer/[slug]` | 得勝者見證/公開個人頁 | — | 否（瀏覽），登入才能檢舉 | `/api/overcomer/*` | 待確認 |
| `/login` | 使用者登入 | `LoginForm.js` | — | `/api/auth/login` | **已處理**：導覽/頁尾入口已隱藏，頁面保留 |
| `/signup` | 使用者註冊 | `SignupForm.js` | — | `/api/auth/signup` | **已處理**：同上 |
| `/forgot-password` | 忘記密碼請求 | — | — | `/api/auth/request-reset` | 暫時隱藏入口（本次未特別處理，本來就無主導覽入口） |
| `/reset-password` | 密碼重設表單 | — | — | `/api/auth/reset-password` | 暫時隱藏入口（同上） |
| `/customer-portal` | 會員中心：個人檔案/我的禱告/收到的回應 | `CustomerPortalClient.js` | 是 | `/api/customer/*` | **已處理**：導覽/頁尾入口已隱藏，已登入會員仍可透過既有 session 直接訪問 |
| `/customer-portal/create` | 建立禱告卡片（會員） | — | 是（判斷邏輯待確認，見 [[14-Open-Questions]]） | `/api/home-cards`（POST） | 合併到首頁（改為匿名投稿流程） |
| `/customer-portal/edit`、`/edit/[id]` | 編輯禱告卡片 | — | 是 | `/api/customer/cards/[id]` | 暫時隱藏 |
| `/admin`、`/admin/dashboard` | 後台登入/儀表板 | — | 是（admin） | `/api/admin/*` | 保留 |
| `/admin/users` | 使用者管理（SUPER only） | — | 是（admin, SUPER） | `/api/admin/users*` | 保留 |
| `/admin/moderation` | 語音/內容審核 | — | 是（admin） | `/api/admin/voice-moderation` | 保留（匿名化後更重要） |
| `/admin/prayfor` | 禱告卡片管理 | — | 是（admin） | `/api/admin/prayfor*` | 保留 |
| `/admin/prayerresponse` | 回應/錄音管理 | — | 是（admin） | `/api/admin/prayerresponse*` | 保留 |
| `/admin/content` | Banner 內容管理 | — | 是（admin） | `/api/admin/banners*` | 保留 |
| `/admin/home-categories` | 首頁分類管理 | — | 是（admin） | `/api/admin/home-categories*` | 保留 |
| `/admin/analytics`、`/finance`、`/wallet`、`/marketing`、`/support` | 後台各分析/財務面板 | — | 是（admin） | 對應 `/api/admin/*` | 保留（不擴張） |
| `/admin/log`（SUPER only） | 系統日誌 | — | 是（admin, SUPER） | `/api/admin/logs` | 保留 |
| `/admin/settings`（SUPER only） | 權限設定 | — | 是（admin, SUPER） | `/api/admin/site-settings` | 保留 |
| `/about`、`/howto`、`/terms`、`/whitepaper` | 靜態資訊頁 | — | 否 | 無 | 保留但簡化導覽入口 |
| `/v3-wireframe/{page,pray,playback,share,world}` | 實驗性簡化錄音/播放/分享/世界原型 | `V3WireframeApp.js` | 待確認 | 待確認 | 待確認（可能已是新方向雛形，需人工確認是否要作為 MVP 基礎） |
| `/uploads/[...path]`、`/voices/[...path]` | 檔案伺服路由（非頁面） | — | **否，完全無驗證** | — | 待確認＋需補防護（見 [[13-Risk-Register]]） |
| `/not-found`、`/global-error` | 404／全域錯誤頁 | — | 否 | 無 | 保留 |

## 3.3 功能清單

| 功能 | 入口 | 使用者流程 | 前端檔案 | 後端／API | 資料表 | 外部服務 | 建議處理 |
|---|---|---|---|---|---|---|---|
| 註冊 | `/signup` | 填表→建立 User | `SignupForm.js` | `POST /api/auth/signup` | `User` | 無 | 暫時隱藏入口 |
| 登入 | `/login` | 帳密登入→建立 customer session | `LoginForm.js` | `POST /api/auth/login` | `User` | 無 | 暫時隱藏入口 |
| 登出 | 導覽列 | 清除 session cookie | `site-chrome.js` | `POST /api/auth/logout` | — | 無 | 暫時隱藏 |
| Session | 全站 | customer/admin 兩套 cookie 分別驗證 | `useAuthSession.js`、`auth-storage.js` | `src/lib/customer-session.js`、`admin-session.js` | `User`、`AdminAccount` | 無 | admin 保留，customer 暫時隱藏 |
| 個人資料 | `/customer-portal` | 檢視/編輯個人檔案 | `CustomerPortalClient.js` | `GET/PATCH /api/customer/profile` | `User` | 無 | 暫時隱藏 |
| 首頁 | `/` | 進站→瀏覽/錄音 | `HomeLandingPage.js` | `/api/home-cards` | `HomePrayerCard` | 無 | 簡化為核心 |
| 地球／地圖 | ~~首頁 hero（`HomeGlobeHero.js`）~~已移除引用、`/global-prayer-room` 全頁 | 視覺瀏覽 | `/global-prayer-room` 呼叫 Cesium 元件 `GlobalPrayerRoomOptimized`（`GlobalPrayerRoom.js:819`，見 [[02-Current-Architecture]] 更正說明）；`HomeGlobeHero.js` 自 2026-08-04 起已無任何呼叫者，成為孤兒元件（連同 `three.js`/`CesiumPrayerGlobe`/`LegacyPrayerGlobe`），是 Phase 5 清理候選 | `/api/home-cards` | `HomePrayerCard` | Cesium ion tiles（CDN 動態載入，僅 `/global-prayer-room`） | **已處理**：首頁改用 `HomePrayerHero.js`，`/global-prayer-room` 全頁與路由本身維持不變 |
| 首頁極簡錄音入口（新） | `/`（`HomePrayerHero.js` → `PrayerRecorder`） | 點擊 CTA→同頁切換成錄音流程 | `HomePrayerHero.js`、`src/components/prayer-recorder/*` | 尚未接入（見下方「上傳」列） | — | 瀏覽器 MediaRecorder | **新增於 2026-08-04**，見 [[21-Recorder-State-Machine]] |
| 錄音（既有，會員回應流程） | `VoicePrayerOverlay`（`/prayfor/[id]` 經 `Comments.js`） | 授權→倒數→錄→停→預覽 | `VoicePrayerOverlay.js` | 錄音本身無 API，送出見下 | — | 瀏覽器 MediaRecorder | 保留，需去除登入關卡（Phase 3 範圍） |
| 麥克風授權 | 首頁：`usePrayerRecorder.js`；既有回應流程：`VoicePrayerOverlay.js` | `getUserMedia` 請求 | 兩處各自實作（首頁版重用既有技巧但獨立成 hook，不共用程式碼） | — | — | 瀏覽器 API | 保留 |
| 倒數 | 同上 | 開始錄音前 3-2-1 | 同上 | — | — | 無 | 保留 |
| 暫停 | 不存在（僅有「停止」，非錄音中暫停） | 已於首頁版盤點確認：`VoicePrayerOverlay.js` 與新版 `usePrayerRecorder.js` 皆無錄音中暫停功能，僅能完成或取消 | — | — | — | — | 待確認是否需要（未列入 Commit 3 範圍） |
| 停止 | 同上 | 手動停止錄音 | 同上 | — | — | — | 保留 |
| 重錄 | 同上（首頁版另加「確定要重新錄製嗎？」確認對話框） | 播放確認後可重錄 | 同上 | — | — | — | 保留 |
| 音訊預覽 | 同上 | 錄完可播放確認 | 同上 | — | — | — | 保留 |
| 上傳 | 送出流程 | 音檔上傳到本地磁碟 | — | `POST /api/responses`（audio 分支） | `PrayerResponse` | 無（本地檔案系統） | 需修改後端（去除語音登入檢查） |
| 語音轉文字 | 錄音時 | 即時字幕，瀏覽器端 | `VoicePrayerOverlay.js`（Web Speech API） | 無（無後端 STT） | — | 瀏覽器 SpeechRecognition | 保留（成本低，屬前端功能） |
| 字幕 | 同上 | 即時顯示轉寫文字 | `VoicePrayerOverlay.js` | — | `PrayerResponse`（若儲存文字稿，待確認） | 瀏覽器 API | 保留 |
| 播放 | 禱告牆/詳情頁 | 點擊播放音檔 | `PrayerAudioPlayer.js`、`GlobalPlayer.js` | `GET /voices/[...path]` | `PrayerResponse`/`HomePrayerCard` | 無 | 保留，需確認匿名可播放（已可） |
| 播放進度 | 播放器 | 進度條/全域播放器 | `GlobalPlayer.js`、`GlobalPlayerGate.js` | — | — | — | 保留 |
| 禱告標題 | 建立禱告卡片 | 文字欄位 | `customer-portal/create` | `POST /api/home-cards` | `HomePrayerCard` | — | 保留 |
| 禱告內容 | 同上 | 文字/錄音內容 | 同上 | 同上 | `HomePrayerCard` | — | 保留 |
| 匿名名稱 | 送出回應 | 已有 `isAnonymous` + 匿名頭像產生 | `src/lib/anonymous-prayer-avatar.js` | `POST /api/responses` | `PrayerResponse.isAnonymous` | 無 | 保留、擴大使用 |
| 禱告分類 | 首頁/建立卡片 | 分類篩選 | `HomePrayerExplorer.js` | `/api/home-categories` | `HomePrayerCategory` | — | 保留但簡化 |
| 送出 | 建立卡片/回應 | 表單送出 | 各表單元件 | `POST /api/home-cards`、`POST /api/responses` | `HomePrayerCard`、`PrayerResponse` | — | 保留，需匿名化 |
| 刪除 | 會員中心 | 擁有者刪除自己卡片 | `CustomerPortalClient.js` | `DELETE /api/customer/cards/[id]` | `HomePrayerCard` | — | 需修改（匿名情境下的替代機制） |
| 分享 | 詳情頁/v3-wireframe | 待確認實際分享機制（連結/社群） | `v3-wireframe/share` | 待確認 | — | — | 待確認 |
| 我為你禱告 | 回應/詳情頁 | 目前透過送出**文字回應**達成，未確認是否有獨立「一鍵」按鈕 | `VoicePrayerOverlay.js` 等 | `POST /api/responses` | `PrayerResponse` | — | 待確認＋簡化為一鍵 |
| 檢舉 | 卡片/回應/得勝者頁 | 舉報內容 | `OvercomerReportButton.jsx`、`ResponseReportButton.jsx`、`PrayerRequestActions.jsx` | `POST /api/prayfor/report`、`/api/prayer-response/report`、`/api/overcomer/report` | `HomePrayerCardReport`、`PrayerResponseReport`、`OvercomerUserReport` | — | 需修改（目前全部要求登入，匿名化後需替代方案） |
| 管理後台 | `/admin/*` | 內容/使用者/財務管理 | 見頁面表 | `/api/admin/*` | 多表 | — | 保留 |
| 錯誤處理 | 全站 | Next.js `global-error.js` | `src/app/global-error.js` | — | — | — | 保留 |
| Loading | 各頁 | 元件層級 loading 狀態 | 各元件 | — | — | — | 保留，行動裝置需驗證 |
| 空狀態 | 禱告牆/會員中心 | 待確認實際空狀態設計 | 待確認 | — | — | — | 待確認 |
| 網路中斷 | 錄音/上傳流程 | 待確認是否有重試機制 | `VoicePrayerOverlay.js` | — | — | — | 待確認（MVP 需補「上傳失敗與重試」） |
| 手機版功能 | 全站 | 純 CSS `@media` 響應式，無 Tailwind | `globals.css` 等主題 CSS | — | — | — | 保留並強化（手機優先） |
| 第三方登入 | `/login` | Google/Facebook 按鈕**已註解，非啟用狀態** | `src/app/login/page.js`（約 40-47 行） | 無 | — | 無（未串接） | 移除（本來就未啟用） |

## 補充：導覽入口
- `src/components/site-chrome.js`：`SiteHeader`（主導覽：禱告牆、全球禱告室、得勝者、平台介紹、使用方式、會員中心）與 `SiteFooter`（同上 + 條款、登入、註冊、社群連結）
- `src/app/admin/layout.js`：後台側邊欄導覽（依角色顯示）

延伸分析見 [[06-Authentication-Dependencies]]、[[05-Data-Model]]。
