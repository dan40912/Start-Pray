---
tags: [start-pray, impact-analysis]
---

# 改造影響分析

參見 [[06-Authentication-Dependencies]]、[[05-Data-Model]]、[[10-Implementation-Plan]]。

| 改動 | 影響頁面 | 影響元件 | 影響 API | 影響資料表 | 風險 | 建議順序 |
|---|---|---|---|---|---|---|
| 隱藏登入與註冊入口 | `/`、全站導覽（桌面＋手機） | `site-chrome.js` | 無（純 UI） | 無 | 低——純視覺，可逆 | **已完成**（2026-08-04） |
| 移除 Route guard | `/customer-portal/*` | 待確認是否存在專屬 guard | 無 | 無 | 低（若本來就沒有強制 guard，此項可能不適用，需先查證） | 3 |
| 投稿 API 改為匿名 | 錄音送出流程 | `VoicePrayerOverlay.js` | `POST /api/responses`（移除 `VOICE_LOGIN_REQUIRED`） | `PrayerResponse` | 中——需同時補 rate limit，否則開放濫用 | 4 |
| User ID 改為 nullable 或匿名識別 | — | — | — | 已經是 nullable（`HomePrayerCard.ownerId`、`PrayerResponse.responderId`） | 極低——**不需要 schema migration** | 不適用（已完成） |
| Storage 權限調整 | 播放/上傳 | `src/lib/storage/localDriver.js`、`/voices`、`/uploads` route | 檔案伺服 route | 無 | 中——目前完全無驗證，匿名化後仍需基本的防盜連/大小限制 | 4 |
| 首頁重構 | `/` | `HomeLandingPage.js`、`HomeGlobeHero.js`、`HomePrayerExplorer.js` | `/api/home-cards` | 無 | 高——是使用者第一印象，需分階段測試 | 2（UI 層先行，功能邏輯在第 4 步之後） |
| 地球功能停用 | `/`（hero）、`/global-prayer-room` | `HomeGlobeHero.js`、`GlobalPrayerRoom.js` | 無 | 無 | 中——牽涉 SEO、既有分享連結、Cesium 費用 | 2 |
| 導覽列簡化 | 全站 | `site-chrome.js` | 無 | 無 | 低 | **已完成**（2026-08-04，含桌面與手機導覽、頁尾空欄位防護） |
| 匿名播放 | 禱告牆/詳情頁 | `PrayerAudioPlayer.js`、`GlobalPlayer.js` | `/voices`、`/uploads` | 無 | 低——現況已可匿名播放 | 不適用（已完成） |
| 匿名「我為你禱告」 | 詳情頁 | 待新增的輕量互動元件 | `POST /api/responses`（或新端點） | `PrayerResponse` | 中——需防重複點擊灌水 | 4 |
| 匿名內容管理 | 全站 | 新增管理 token 機制 | 需新增/擴充 API | `PrayerResponse`、`HomePrayerCard` | 高——安全設計需謹慎（token 外洩風險），見 DEC-007 | 5 |
| 舊資料相容 | 會員中心、後台 | — | 既有會員/後台 API 全部保留 | 無需變更 | 低——本次策略是「不動舊資料」 | 貫穿全程 |
| Analytics 調整 | — | 無（本來就無第三方 analytics） | — | — | 極低 | 不適用 |
| SEO 與分享預覽 | `/prayfor/[id]`、首頁 | `src/lib/seo.js` | — | — | 中——地球/導覽簡化可能影響既有分享連結的 OG 預覽 | 2-3 之間需一併檢查 |
| Abuse prevention | 匿名送出全流程 | 需新增 | `POST /api/responses`、`POST /api/home-cards` | — | 高——匿名化最大風險來源 | 4（與投稿 API 改造同批） |
| Rate limiting | 同上 | 需新增（可複用 `ipHash`/`guestSessionHash`） | 同上 | — | 高——若無此項，匿名化等於開放濫用 | 4（必須與投稿 API 改造同時上線，不可分開） |
| 檢舉 | 卡片/回應/得勝者頁 | 三個 Report 按鈕元件 | `/api/prayfor/report` 等 | 三張 Report 表（`reporterId` 必填） | 中——匿名情境下需替代身份追蹤方式 | 5 |
| 音訊內容安全 | 後台審核 | `src/lib/voiceModeration.js`、`/admin/moderation` | `/api/admin/voice-moderation` | `PrayerResponse.voiceModerationStatus` | 高——匿名化後違規內容更難溯源，後台審核角色更關鍵，不可移除 | 貫穿全程，優先於 5 |

## 關鍵原則
- Rate limiting 與 Abuse prevention **必須**與「投稿 API 改為匿名」同批上線，不能先開放匿名再補防護
- 地球停用與首頁重構會動到使用者第一印象與既有分享連結，需要比其他項目更謹慎的分階段驗證
- 舊資料相容與 Analytics 調整在本次盤點下風險極低或不適用，不需特別投入

## 「隱藏登入/註冊入口」「導覽列簡化」實際執行後的過渡狀態說明
這兩項改動保留了「已登入會員」的例外：若瀏覽器仍有有效 customer session，導覽列會照常顯示會員專屬功能（建立代禱、問候語、登出）。**這只是 Phase 1 的過渡相容行為**，用意是不在匿名管理機制（[[11-Decision-Log]] DEC-007）就緒前就切斷既有會員的存取能力，**不代表 Target MVP 最終決定保留會員系統**。詳見 [[06-Authentication-Dependencies]] 2026-08-04 更新、[[10-Implementation-Plan]] Phase 1。
