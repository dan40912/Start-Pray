---
tags: [start-pray, design, migration]
---

# 資料模型變更與本地 Migration 計畫（Commit 4 前置分析）

參見 [[05-Data-Model]]、[[20-Anonymous-Submission-Design]]、[[22-API-Changes]]。**本文件只提出計畫，撰寫時未建立、未套用任何 migration。**

## 現有模型（完整見 [[05-Data-Model]]，此處僅列與匿名投稿相關者）
- `HomePrayerCard`：`ownerId String?`（nullable）、`categoryId Int`（**必填** FK）、`isBlocked`、`reportCount`、`needsReview`、`isPrivate`。**無** `deletedAt`、**無**狀態 enum（不像 deprecated 的 `PrayerRequest` 有 `PrayerStatus`）、**無**管理 token 欄位
- `PrayerResponse`：`responderId String?`（nullable）、`guestSessionHash String?`、`ipHash String?`、`isAnonymous`、`isBlocked`、`reportCount`、`moderationStatus`（`ResponseModerationStatus`: PENDING/APPROVED/REJECTED）、`voiceModerationStatus`。**無** `deletedAt`、**無**管理 token 欄位
- 兩者皆已支援匿名擁有者，**這部分不需要改動**

## 必要變更分析（不預設全部都要新增）

| 欄位 | 是否必要 | 理由 | 舊資料影響 | 替代方案 |
|---|---|---|---|---|
| `userId nullable` | **不需要** | `HomePrayerCard.ownerId`、`PrayerResponse.responderId` 已經是 nullable | 無 | 不適用 |
| `submissionType`（MEMBER/ANONYMOUS enum） | **不需要** | 現有 `responderId`/`ownerId` 是否為 null，已足以判斷是會員還是匿名投稿，加這個欄位是冗余資訊 | 無 | 用 `responderId IS NULL` 判斷即可 |
| `anonymousSessionHash` | **不需要新增**（已存在） | `PrayerResponse.guestSessionHash` 就是這個欄位，只是命名不同；`HomePrayerCard` 目前沒有對應欄位，但若方案 1（附掛既有卡片）成立，也不需要，因為建卡本身不需要 guest session 追蹤（既有 `assertGuestCanCreate` 用 IP 而非 guestSessionHash） | 無 | 不適用 |
| `managementTokenHash`（**新欄位，唯一真正需要的變更**） | **視你對 [[20-Anonymous-Submission-Design]] 待確認事項 1 的回答而定** | 現有系統完全沒有「匿名使用者刪除自己投稿」的機制，這是唯一的真實缺口 | 無（nullable，舊資料為 null 即可） | 見下方兩個方案 |
| `deletedAt`（soft delete） | **待你決定** | 現有 `HomePrayerCard` 刪除是 hard delete（`prisma.homePrayerCard.delete`），若匿名刪除也要 hard delete 則不需要這欄位；若想要「軟刪除+保留稽核紀錄」則需要 | 無 | 若選 hard delete，可省略此欄位，改動範圍更小 |

## 兩個 Migration 草案（依 [[20-Anonymous-Submission-Design]] 的方案擇一）

### 方案 A：只在 `PrayerResponse` 新增管理 token（若採用「附掛既有卡片」的方案 1）
```prisma
model PrayerResponse {
  // ...既有欄位不變...
  managementTokenHash String? @db.VarChar(64)   // sha256 hex digest，64 字元
}
```
```sql
-- migration.sql 草案（additive-only）
ALTER TABLE `prayerresponse`
  ADD COLUMN `managementTokenHash` VARCHAR(64) NULL;
```
- 不影響任何既有查詢（新欄位預設 NULL，既有資料列不受影響）
- Rollback：`ALTER TABLE prayerresponse DROP COLUMN managementTokenHash;`（因為是新增且未被其他表參照，可安全回退）

### 方案 B：新增 `HomePrayerCard` 的管理 token + 訪客語音專用分類（若採用「新建卡片」的方案 2）
```prisma
model HomePrayerCard {
  // ...既有欄位不變...
  managementTokenHash String? @db.VarChar(64)
}
```
```sql
ALTER TABLE `home_prayer_card`
  ADD COLUMN `managementTokenHash` VARCHAR(64) NULL;
```
另需要（非 migration，是資料 seed）：在 `HomePrayerCategory` 新增一筆「訪客語音代禱」分類資料，供匿名建卡固定使用（避免把 `categoryId` 改成 nullable，降低對既有查詢邏輯的影響面）。
- Rollback：同上，`DROP COLUMN`；分類資料則直接刪除該筆 `HomePrayerCategory`（需確認屆時無 `HomePrayerCard` 已引用它，若有則不能刪分類，只能停用 `isActive=false`）

## Migration 執行策略
- **additive-first**：只新增 nullable 欄位，不刪除、不重新命名既有欄位
- **本次尚未執行**：因為方案 A/B 的選擇取決於你對 [[20-Anonymous-Submission-Design]] 待確認事項 1 的回答，尚未有結論前不建立 migration 檔案，避免建立後又要因為方向錯誤而回退
- `DATABASE_URL` 已確認指向 `localhost:3306/prayercoin_dev`（本機開發資料庫，非 Production），若你確認方案後，`npx prisma migrate dev --name add_anonymous_management_token` 可以安全在本機執行
- 驗收項目（待方向確認、migration 建立並套用後）：
  - 舊會員 `PrayerResponse`/`HomePrayerCard` 可讀（`managementTokenHash` 為 null，不影響既有欄位）
  - 舊會員資料可播放（未動音訊相關欄位）
  - 新會員投稿仍可正常建立（`managementTokenHash` 對會員路徑保持 null，只有匿名路徑會寫入）
  - 新匿名投稿可建立且 `userId`/`ownerId` 為 null
  - Admin 查詢（`/admin/prayerresponse`、`/admin/prayfor`）可同時看到會員與匿名投稿（因為查詢邏輯不需要依賴新欄位）
  - 可在空白測試 DB 上用 `prisma migrate reset` + `prisma migrate dev` 重建

## Storage 分析
| 檢查項 | 結果 |
|---|---|
| 現有 provider | 本地檔案系統（`local` driver，`MEDIA_STORAGE_DRIVER` 環境變數可切換，`object` driver 是未實作骨架） |
| Server 或 Client 上傳 | Server（Next.js API route 直接用 `writeFile` 寫入，non-streaming，適合目前 ≤12MB 的限制） |
| Client 是否能指定 path | 否——`resolveVoiceFolder(requestId)` 只接受數字 ID 或回退 `"misc"`，檔名是 `${Date.now()}-${sanitizeFileName(audio.name)}`，`sanitizeFileName` 用 `path.basename` + 字元白名單移除任何路徑穿越字元 |
| Client 是否能指定 filename | 部分——原始檔名會經過 `sanitizeFileName` 清洗，且加上時間戳前綴，無法覆蓋既有檔案或跳脫目錄 |
| Client 是否能指定 bucket | 否，only `local` driver 使用固定 `VOICES_STORAGE_DIR` |
| Server 是否驗證 MIME | 是（`isAllowedAudioFile`，MIME 白名單 + 副檔名白名單雙重檢查） |
| Server 是否驗證 size | 是（`MAX_AUDIO_BYTES = 12MB`） |
| 是否驗證 duration | **否**（見 [[22-API-Changes]] 待確認事項 2，現有程式碼明確註解「伺服器端時長解析未實作」） |
| DB 與 Storage 是否具備 transaction-like rollback | **否**——`writeFile` 成功後才呼叫 `prisma.prayerResponse.create`，若 DB 寫入失敗，已寫入的音訊檔會變成孤兒檔案，現有程式碼**沒有**清理邏輯 |
| Hidden Prayer 是否仍可取得音訊 | 是——`/voices/[...path]` 完全無驗證，不管 `isBlocked` 為何都能直接讀取 URL（既有風險，見 [[13-Risk-Register]]，非本次匿名化新增） |

## 待確認事項彙整（與 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]] 相同，此處不重複列出細節，僅標記本文件的決策相依性）
1. 方案 A（`PrayerResponse.managementTokenHash`）或方案 B（`HomePrayerCard.managementTokenHash` + 訪客分類）——**取決於你對「首頁錄音是新建卡片還是附掛回應」的回答**
2. 是否需要 `deletedAt`（soft delete）或維持 hard delete
3. 是否要順便修正「DB 寫入失敗但音訊檔已寫入」的孤兒檔案風險（建議：即使本次不做，也應記錄到 [[13-Risk-Register]]，已完成記錄）
