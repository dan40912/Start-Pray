---
tags: [start-pray, design, api]
---

# 匿名投稿 API 設計草案（Commit 4 前置分析）

參見 [[20-Anonymous-Submission-Design]]、[[23-Database-Migration]]。**本文件為設計草案，尚未實作、尚未修改任何 API 程式碼。**

## 現有 API 現況（已確認，非猜測）
- `POST /api/responses`：**已支援**匿名文字投稿；語音投稿被單一 `if (!session && hasAudio)` 檢查擋下（`src/app/api/responses/route.js:94-103`）
- `POST /api/home-cards`：**已支援**匿名建卡（`assertGuestCanCreate`），但禁止 guest 附加語音/自訂圖片
- 皆使用 Next.js API Routes（同源，Next.js 預設對 same-origin 表單提交無 CORS 問題；未發現任何 CORS header 設定，也未發現獨立 CSRF token 機制——admin 端有 `isSameOriginAdminMutation` same-origin 檢查，customer/anonymous 端目前無等價機制）
- Rate limit：文字回應是 DB-backed（`prisma.prayerResponse.count`）；guest 建卡是 in-memory Map（`guestCreateAttempts`，僅存在單一 process 記憶體內）

## 方案 1：沿用 `POST /api/responses`（語音附掛於既有 HomePrayerCard）
若首頁錄音的定位是「對某個既有代禱卡片留下語音祝福」（例如系統自動指定一張公開卡片），則只需：
- 移除 94-103 的 `VOICE_LOGIN_REQUIRED` 檢查（比照文字回應，改成無條件允許）
- 修正 246-252 的 `session.userId` 崩潰 bug（改用 `identityWhere` 模式）
- 前端（`prayer-recorder/PrayerRecorder.js`）的「下一步：匿名送出」改為真正呼叫此 API，帶上 `requestId`（目標卡片 id）、`audio`（Blob）、`isAnonymous=true`
- **不需要新增 Prisma migration**——`responderId`、`guestSessionHash`、`ipHash` 皆已是既有欄位

### Request（沿用既有格式，`multipart/form-data`）
| 欄位 | 說明 |
|---|---|
| `requestId` | 目標 `HomePrayerCard.id`（首頁若無明確目標卡片，需另外決定「送給哪張卡片」的邏輯——見待確認事項） |
| `message` | 可選，文字禱告（首頁流程可能不需要） |
| `audio` | 錄音 Blob，欄位名沿用 `audio` |
| `isAnonymous` | 固定 `true`（首頁流程不會有已登入情境） |
| `website` | honeypot，維持既有反機器人設計 |

### Response（沿用既有 `toPublicPrayerResponse`，不需新增欄位）
不回傳 `guestSessionHash`/`ipHash`（`toPublicPrayerResponse` 已經做匿名化過濾，見 `src/lib/anonymous-prayer-avatar.js`）。

## 方案 2：新增獨立端點（首頁錄音建立全新的訪客禱告卡片，語音為主體而非附加回應）
若首頁定位是「陌生人自己留下一段禱告需求」（更貼近 `HomePrayerCard` 的語意，而非回應別人），則需要：
- 新增 `POST /api/anonymous-prayers`（或依現有慣例可能命名為 `POST /api/home-cards` 的語音變體）
- 這條路徑目前完全不存在（`HomePrayerCard` 從未支援語音本體，`voiceHref` 欄位在 guest 路徑被硬性禁止）
- 需要決定：語音本體要不要有對應的「標題/分類」（`HomePrayerCard.categoryId` 是必填 FK）——若首頁錄音不想要求使用者選分類，需要一個「訪客預設分類」或把 `categoryId` 改成 nullable（後者影響既有查詢邏輯，風險較高，不建議）

### 建議做法（若採方案 2）
新增一個固定的「訪客語音代禱」分類（`HomePrayerCategory` 新增一筆資料，非 schema 變更），`POST` 時固定帶入該 `categoryId`，`title`/`description` 可用預設文案（例如「一段匿名的語音禱告」）自動產生，`voiceHref` 由 server 端寫入。

### Request（新設計）
| 欄位 | 說明 | 驗證 |
|---|---|---|
| `audio` | 錄音檔（multipart） | MIME 白名單、大小 ≤ 既有 12MB 上限（沿用 `MAX_AUDIO_BYTES`，見待確認事項是否要與前端 60 秒/12MB 假設對齊） |
| `website` | honeypot | 同現有模式 |

**不接受**：`userId`、`ownerId`、`status`、`categoryId`（server 固定指定）、`isBlocked`、`needsReview`、任何 storage path/檔名欄位。

### Response
```json
{
  "id": 123,
  "managementToken": "（只回這一次的原始 token）",
  "detailsHref": "/prayfor/123"
}
```
不回傳：`ownerId`、`managementTokenHash`、內部 storage 路徑、admin 欄位。

## 錯誤碼（兩方案共用）
| Code | HTTP | 說明 |
|---|---|---|
| `INVALID_REQUEST` | 400 | 缺少必要欄位、honeypot 觸發 |
| `INVALID_AUDIO` | 400 | MIME 不在白名單、副檔名不符 |
| `RECORDING_TOO_SHORT` | 400 | 需搭配伺服器端時長驗證（見待確認事項，目前伺服器並未真正解析音訊時長） |
| `RECORDING_TOO_LONG` | 400 | 同上 |
| `FILE_TOO_LARGE` | 413 | 沿用既有 `MAX_AUDIO_BYTES` 邏輯 |
| `UNSUPPORTED_MEDIA_TYPE` | 415 | 沿用既有 `isAllowedAudioFile` |
| `RATE_LIMITED` | 429 | 沿用既有 guest rate limit 模式 |
| `STORAGE_UNAVAILABLE` | 503 | 沿用既有 `MEDIA_STORAGE_NOT_CONFIGURED` 錯誤處理 |
| `SUBMISSION_FAILED` | 500 | 通用錯誤，不回傳 stack trace（現有 `console.error` + 通用訊息模式已符合此要求） |

⚠️ **待確認且現有系統尚未做到的一點**：後端目前**沒有解析音訊實際時長**（`route.js:254` 註解明寫「伺服器端時長解析未實作，保守不觸發 TOO_LONG」）。前端 `usePrayerRecorder.js` 有 60 秒上限與 3 秒下限，但這是**前端自律**，並非後端強制驗證。若要做到「Server 驗證時長」，需要引入音訊解析能力（例如讀取 WebM/Opus 的時長 metadata），這是額外的技術工作，不在現有程式碼中，需要你確認優先度。

## Rate Limit 設計
沿用現有兩種模式，依方案而定：
- 方案 1（附掛既有卡片）：直接沿用 `/api/responses` 現有的 DB-backed 頻率限制（10 分鐘窗口 + 同卡片冷卻），已可處理多 instance 情境
- 方案 2（新端點）：建議比照 `home-cards` 的 guest 邏輯改寫成 **DB-backed**（而非目前 in-memory 的 `guestCreateAttempts`），例如新增查詢「同 `ipHash` 在過去 N 分鐘建立的訪客語音數量」，這樣才能在多 instance 部署下正確運作；若時間有限，POC 階段可先用 in-memory + 文件明確標註「多 instance 或重啟後失效，Production 前必須改為 DB-backed 或 Redis」

建議門檻（若現有系統無明確既有值，方案 2 適用）：
- 每 IP hash 每 10 分鐘最多 3 次（沿用 `guestCreateAttempts` 現有數值）
- 每 guestSessionHash 每小時最多 5 次

## CSRF / CORS / Origin
- Next.js API Routes 與前端同源，瀏覽器原生 same-origin policy 已提供基本保護；專案目前未設定任何 CORS header（無 `Access-Control-Allow-Origin`），維持現狀即可，不需要新增
- 沿用 admin 端已有的 `isSameOriginAdminMutation`（`src/middleware.js`）模式，可考慮比照套用到匿名投稿 API 的 middleware 層，但這是**新增的防護**，非既有行為，需要你確認是否要在 Commit 4 範圍內一併做

## 匿名刪除 API（草案，對應 [[20-Anonymous-Submission-Design]] 方案 C）
```text
DELETE /api/anonymous-prayers/:id
Header: X-Management-Token: <原始 token>
```
- Server 計算 `sha256(token)`，與 DB 儲存的 hash 比對（`crypto.timingSafeEqual`）
- 比對失敗回 404（不回 403，避免洩漏「這個 ID 存在但 token 錯」的資訊）
- 成功後：依現有慣例（`HomePrayerCard` 用 hard delete，見 `DELETE /api/customer/cards/[id]`）或改用 soft delete（目前 schema 無 `deletedAt`，需在 [[23-Database-Migration]] 中決定）
- Admin 不依賴此 token，後台既有 `/admin/prayerresponse`、`/admin/prayfor` 的下架/刪除功能不受影響

## 待確認事項（阻擋實作，需要你的裁示）
1. **首頁錄音送出後是新建 `HomePrayerCard` 還是建立 `PrayerResponse` 附掛到既有卡片？**（方案 1 vs 方案 2，直接決定要不要動 Schema）
2. 是否要做伺服器端音訊時長驗證？現有系統沒有這個能力，需額外開發或接受目前「前端自律、後端不驗證」的現狀
3. 匿名刪除要 soft delete 還是 hard delete？
4. 是否要在匿名 API 加上 same-origin/CSRF 檢查（目前系統對非 admin 路徑完全沒有這層防護）？
