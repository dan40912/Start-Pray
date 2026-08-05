---
tags: [start-pray, data-model]
---

# 資料模型

來源：`prisma/schema.prisma`（MySQL），32 個 migration。參見 [[02-Current-Architecture]]、[[06-Authentication-Dependencies]]。

> **2026-08-04 確認**：Commit 1-3（導覽收斂、首頁 Hero、首頁錄音前端）皆未修改 `prisma/schema.prisma`，本文件內容仍完全反映現況。Commit 4 前置分析（[[20-Anonymous-Submission-Design]]、[[23-Database-Migration]]）會基於本文件提出**變更草案**，但尚未核准、尚未套用。
>
> **2026-08-05 更新**：「我已為你禱告」（Commit 1）新增 `PrayerPrayedReaction` 表（additive，本機開發 DB 已套用並 Real DB tested），是本文件建立以來**第一個真正執行的 Schema 變更**。設計過程詳見 [[28-Prayed-Reaction-Design]]，含執行時發現的既有 migration 歷史/drift 問題記錄。

| 資料模型 | 用途 | 重要欄位 | 關聯 | 是否依賴 User ID | 未登入後的影響 |
|---|---|---|---|---|---|
| `User`（`@@map("user")`） | 會員帳號 | `id`、`email`(unique)、`passwordHash`、`isBlocked`、`trustScore`、`walletBalance`、`resetToken` | 被 `PrayerRequest`/`PrayerResponse`/`HomePrayerCard` 以**nullable** FK 引用 | 是（自身即為 User 表） | 匿名使用者不建立 User 列 |
| `PrayerRequest`（deprecated） | 舊版禱告請求，已被 `HomePrayerCard` 取代 | — | — | 待確認 | 不影響新流程 |
| `HomePrayerCard`（`home_prayer_card`） | 目前的禱告卡片主體 | `ownerId String?`（**nullable**）、`categoryId Int`（必填） | `owner User?`（nullable）、`HomePrayerCategory` | 否（已支援匿名擁有者） | 無影響，已可匿名建立 |
| `HomePrayerCategory` | 禱告分類 | 名稱/排序 | 被 `HomePrayerCard` 引用（必填 FK） | 否 | 無影響 |
| `PrayerResponse`（`prayerresponse`） | 對禱告卡片的回應（文字/語音） | `responderId String?`（**nullable**）、`responder User?`、`guestSessionHash String? @db.VarChar(64)`、`ipHash String? @db.VarChar(64)`、`isAnonymous`、`voiceModerationStatus` | `responder User?`（nullable）、`HomePrayerCard` | 否，已有 guest 追蹤欄位 | 文字回應已支援匿名；語音回應目前被 API 層擋下（非 schema 層限制） |
| `HomePrayerCardReport` | 檢舉禱告卡片 | `reporterId String`（**必填**） | `User`（required） | **是** | 匿名使用者目前無法檢舉，需替代方案 |
| `PrayerResponseReport` | 檢舉回應 | `reporterId String`（**必填**） | `User`（required） | **是** | 同上 |
| `OvercomerUserReport` | 檢舉得勝者頁面 | `reporterId String`（**必填**） | `User`（required） | **是** | 同上 |
| `SiteBanner` | 首頁/站內 banner | — | 無 User 依賴 | 否 | 無影響 |
| `SiteSetting` | 站台設定（後台用） | — | 無 User 依賴 | 否 | 無影響 |
| `TokenRewardRule` | 代幣獎勵規則設定 | — | 無 User 依賴 | 否 | 無影響 |
| `TokenTransaction` | 代幣交易紀錄 | `userId String`（**必填**，`onDelete: Cascade`） | `User`（required） | **是** | 匿名使用者無法獲得代幣獎勵（現況：guest 的 `rewardStatus` 為 `BLOCKED`） |
| `AdminAccount` | 後台管理員帳號 | 與 `User` 分離的獨立表 | 無 | 是（自身） | 不受影響（後台維持登入） |
| `AdminLog` | 後台操作日誌 | — | 關聯 `AdminAccount` | 是（admin 端） | 不受影響 |
| `PrayerPrayedReaction`（`prayer_prayed_reaction`，**2026-08-05 新增**） | 「我已為你禱告」輕量匿名反應 | `actorType`（`USER`/`GUEST` enum）、`actorKeyHash String @db.VarChar(64)`（**唯一防重複鍵，永遠非 NULL**）、`userId String?`（僅供查詢用，不參與唯一性）、`ipHash String?`（rate limit 用） | `HomePrayerCard`（required, `onDelete: Cascade`）、`User?`（optional, `onDelete: SetNull`） | 否，`actorKeyHash` 對登入/匿名皆非 NULL | 完全支援匿名；`@@unique([prayerId, actorType, actorKeyHash])` 防止同一人（含匿名）對同一 Prayer 重複建立 |

## 特別檢查結果

| 檢查項 | 結果 |
|---|---|
| 禱告資料是否強制綁定使用者 | 否，`HomePrayerCard.ownerId` 為 nullable |
| 音訊是否強制綁定使用者 | 否，`PrayerResponse.responderId` 為 nullable；但 **API 層**（非 schema）強制語音回應需登入（`VOICE_LOGIN_REQUIRED`，`src/app/api/responses/route.js:94-103`） |
| 上傳 API 是否需要登入 | 部分：`POST /api/responses` 文字免登入，語音需登入；`POST /api/home-cards` 待確認（見 [[14-Open-Questions]]） |
| 播放是否需要登入 | 否，`/voices/[...path]`、`/uploads/[...path]` 無驗證即可讀取 |
| 「我為你禱告」是否需要登入 | 若以文字回應實現則否；若指語音回應則是（受 `VOICE_LOGIN_REQUIRED` 限制） |
| 權限規則是否依賴 User ID | 檢舉功能（三張 Report 表）與代幣交易依賴；一般瀏覽/文字回應不依賴 |
| Storage policy 是否限制登入者 | 否，本地檔案路由完全無存取控管（見 [[13-Risk-Register]]） |
| 刪除與管理權限如何處理 | 目前僅「登入會員刪除自己的卡片」（`DELETE /api/customer/cards/[id]`，需 `requireActiveCustomerUser` + 擁有者比對）；匿名情境下無現成刪除機制，需在 [[11-Decision-Log]] DEC-007 中設計 |

## 匿名化關鍵結論
`PrayerResponse` 與 `HomePrayerCard` 的 schema **已經**支援 nullable owner/responder，且已有 `guestSessionHash`/`ipHash` 這類匿名追蹤欄位存在（見 migration `20260711000100_add_guest_response_moderation`）。這代表：
- **不需要修改 schema** 就能讓文字回應與（理論上）語音回應匿名化
- 真正的限制在 **API 層的登入檢查**（`src/app/api/responses/route.js`），屬於程式邏輯而非資料模型限制
- 唯一需要新設計的是「匿名情境下的刪除/管理」與「檢舉」— 這兩者目前綁死在 `User.id` 上
