# PRD-001 — 語音回應審核管線 (Voice Response Moderation Pipeline)

- 階段：**P0**
- 狀態：未開始
- 依賴：無(可獨立做)
- 對應風險：語音內容無法像文字一樣關鍵字過濾,目前只有事後 `report` / `isBlocked`,缺事前/自動審核。

---

## 1. 目標 (Goal)

讓每一則**語音回應**在公開給其他使用者之前,先經過一道審核狀態機;
高風險內容能被自動標記或攔下,管理員能在後台一站式處理待審佇列。

成功定義:新上傳的語音預設**不公開**,需通過審核(自動或人工)才會出現在代禱卡上。

## 2. 背景與現況 (Background)

- 語音回應存在 `PrayerResponse.voiceUrl`(`prisma/schema.prisma` line 71)。
- 上傳/建立回應的 route：`src/app/api/PrayerResponse/route.js`。
- 音訊處理 helper：`src/lib/server-audio.js`、儲存 `src/lib/server-media-storage.js`,實際檔案在 `public/voices`。
- 現有審核相關欄位:`isBlocked`、`reportCount`、`PrayerResponseReport` model(line 113)。
- 後台 moderation 頁:`src/app/admin/moderation`、`src/app/admin/prayerresponse`。
- **目前缺口**:沒有「待審 / 通過 / 退回」的狀態;`voiceUrl` 一存就公開。

## 3. 範圍 (Scope)

**In scope**
- 新增語音回應的審核狀態欄位與狀態機。
- 上傳後預設進入待審;前台只顯示已通過的語音。
- 後台待審佇列頁與「通過 / 退回」操作。
- 一個**可插拔的自動預審 hook**(先做規則式:時長上限、檔案大小、上傳頻率);預留 ASR 轉文字接口但**本期不串外部 AI 服務**(避免 Codex 亂接 API 與金鑰)。

**Out of scope(本期不做,不要做)**
- 不串接任何外部語音辨識 / 內容分類雲端 API。
- 不改文字回應的現有流程。
- 不動代幣獎勵邏輯(那是 PRD-002)。

## 4. 詳細實作步驟 (Implementation)

> 每一步請依序做完並 `npm run lint` 後再進下一步。

**Step 1 — Schema**
在 `prisma/schema.prisma` 的 `PrayerResponse` model 內新增:
```prisma
voiceModerationStatus VoiceModerationStatus @default(PENDING)
voiceModeratedAt      DateTime?
voiceModeratedBy      String?   // AdminAccount.id, nullable
voiceAutoFlags        String?   @db.Text // JSON array of rule codes, e.g. ["TOO_LONG"]
```
並新增 enum:
```prisma
enum VoiceModerationStatus {
  PENDING
  APPROVED
  REJECTED
  NOT_APPLICABLE // 純文字回應,無語音時用
}
```
- 文字-only 回應(`voiceUrl` 為 null)在建立時 status 設為 `NOT_APPLICABLE`。
- 建立 migration:`npx prisma migrate dev --name add_voice_moderation`,然後 `npx prisma generate`。

**Step 2 — 自動預審規則模組(新檔)**
新增 `src/lib/voiceModeration.js`,匯出:
```js
// 回傳 { flags: string[], autoReject: boolean }
export function evaluateVoiceUpload({ durationSeconds, fileSizeBytes, recentUploadCount }) { ... }
```
規則(常數寫在檔案頂部,方便日後調):
- `TOO_LONG`：durationSeconds > 180 → flag(不自動退,只標記)。
- `TOO_LARGE`：fileSizeBytes > 15MB → `autoReject = true`。
- `RATE_LIMIT`：同一 responder 過去 10 分鐘上傳語音 > 5 次 → `autoReject = true`。
- 規則查不到對應資料時走「保守 = 不自動退、進人工 PENDING」。

**Step 3 — 上傳 route**
在 `src/app/api/PrayerResponse/route.js`:
- 取得語音時長(用 `src/lib/server-audio.js`;若無現成函式,在該檔補一個 `getAudioDurationSeconds(filePath)`,失敗時回傳 null 並當作 `TOO_LONG` 不成立)。
- 呼叫 `evaluateVoiceUpload`,把 `flags` 存進 `voiceAutoFlags`(JSON.stringify)。
- `autoReject === true` → 建立時 `voiceModerationStatus = REJECTED`;否則 `PENDING`。

**Step 4 — 前台只顯示已通過的語音**
- 找出讀取代禱卡回應的查詢(`src/lib/homeCards.js` 與 `/prayfor/[id]` 對應 server component / API)。
- 對「語音」欄位加條件:只有 `voiceModerationStatus === 'APPROVED'` 或 `NOT_APPLICABLE` 才回傳 `voiceUrl`;`PENDING`/`REJECTED` 時 `voiceUrl` 回 null,並附 `voicePending: true` 給前端顯示「語音審核中」。
- **文字訊息照常顯示**,不要因為語音待審就把整則回應藏起來。

**Step 5 — 後台待審佇列**
- 在 `src/app/admin/moderation` 新增「語音待審」分頁/區塊(沿用既有 admin layout 與 session 驗證 `src/lib/admin-route-auth.js`)。
- 新增 admin API:`src/app/api/admin/voice-moderation/route.js`
  - `GET`：列出 `voiceModerationStatus = PENDING` 的回應(分頁、含 card 標題、responder、flags、可試聽 voiceUrl)。
  - `PATCH`：body `{ id, action: 'APPROVE' | 'REJECT', remarks? }` → 更新 status、`voiceModeratedAt = now`、`voiceModeratedBy = adminId`。
  - 每次操作寫一筆 `AdminLog`(category 用既有最接近的;若無對應,用 `MODERATION`)。

## 5. 資料模型變更摘要

- `PrayerResponse` +4 欄位、新 enum `VoiceModerationStatus`。
- 一個 migration:`add_voice_moderation`。
- **不刪除、不改名**任何現有欄位。

## 6. 驗收標準 (Acceptance Criteria)

Codex 必須逐條驗證並回報 PASS/FAIL:

1. `npx prisma migrate status` shows the new migration applied; `npx prisma generate` succeeds.
2. Creating a **text-only** response → `voiceModerationStatus = NOT_APPLICABLE` and the response renders immediately on the card (unchanged behavior).
3. Creating a response **with voice** under normal conditions → status = `PENDING`; the card detail page shows the text but the voice player is replaced by a "語音審核中" indicator (`voiceUrl` not exposed in API payload).
4. Uploading a voice file > 15MB → status = `REJECTED` automatically; `voiceAutoFlags` contains `"TOO_LARGE"`.
5. Uploading 6 voice responses within 10 minutes as the same user → the 6th is `REJECTED` with flag `"RATE_LIMIT"`.
6. Admin `GET /api/admin/voice-moderation` returns only `PENDING` items; requires a valid admin session (401/redirect otherwise).
7. Admin `PATCH ... action=APPROVE` → status becomes `APPROVED`, the voice now plays on the public card, and one `AdminLog` row is written.
8. Admin `PATCH ... action=REJECT` → voice stays hidden; one `AdminLog` row written.
9. `npm run lint` and `npm run build` both pass with no new errors.
10. No file outside the list in Section 4 was modified (verify via `git diff --name-only`).

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ❌ 不要引入新的 npm 套件做音訊解析,先用 `server-audio.js` 既有能力;若真的需要,**停下來問**,不要自己 `npm install`。
- ❌ 不要呼叫任何外部 API 或讀取金鑰。
- ❌ 不要把待審語音的 `voiceUrl` 寫進前台 payload —— 這是本 PRD 的核心,務必確認 payload 真的拿掉了。
- ✅ enum 值與欄位名稱**完全照本文件**,大小寫一致。
- ✅ 文字回應流程必須完全不受影響(回頭跑驗收標準 #2)。
- ⚠️ migration 命名固定為 `add_voice_moderation`,不要自行加時間戳前綴以外的字。
