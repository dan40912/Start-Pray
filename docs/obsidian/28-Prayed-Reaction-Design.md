---
tags: [start-pray, design, prayed-reaction, commit-1]
---

# 「我已為你禱告」（Prayed Reaction）設計（Commit 1 前置分析）

參見 [[26-Anonymous-Reporting-Design]]、[[27-Shared-Prayer-Interaction-Audit]]、[[05-Data-Model]]。**本節為修改前的純讀碼盤點**，以實際 `prisma/schema.prisma`、DB provider、既有程式碼為準。

## 十個問題的答案

**1. Prayer（`HomePrayerCard`）是否已有 prayed count 欄位？**
沒有。完整讀過 `prisma/schema.prisma` 的 `HomePrayerCard` model（225-263 行）：`id`/`slug`/`image`/`alt`/`title`/`description`/`tags`/`meta`/`detailsHref`/`voiceHref`/`location*`/`isPrivate`/`sortOrder`/`categoryId`/`createdAt`/`updatedAt`/`ownerId`/`isBlocked`/`reportCount`/`isSettled`/`settledAmount`/`needsReview`——沒有任何計數或反應相關欄位。

**2. 是否已有 Reaction 類型資料表？**
沒有。`grep -niE "prayed|prayCount|reaction|acknowledg" prisma/schema.prisma` 完全沒有結果。這與 [[25-Companion-Mode-Reuse-Audit]] 先前的結論一致（該文件也確認過同一件事）。

**3. 是否已有 anonymous session hash？**
有，且已被兩個既有功能重用：`src/lib/guest-response.js` 的 `hashGuestId()`（HMAC-SHA256 對 `guest:${guestId}` 雜湊）——`PrayerResponse.guestSessionHash` 與 Commit C1 的匿名檢舉（`AdminLog.actorId`）都直接使用這個函式。

**4. Guest cookie 是否可直接重用？**
可以。`GUEST_RESPONSE_COOKIE = "start_pray_guest"`（HttpOnly、簽章、`guestCookieOptions()` 已定義好 SameSite/Secure/maxAge），本 Commit 沿用同一顆 cookie，不新建第二顆。

**5. 是否可以無 Migration 完成？**
不行。沒有任何既有欄位或資料表可以承載「一個 Prayer 被哪些人按過已禱告」這件事，且防止重複需要一個可靠的唯一鍵，這在應用層 without DB constraint 是無法保證正確性的（併發請求下可能競態產生重複列）。必須新增一張表。

**6. 若必須 Migration，最小 additive 方案是什麼？**
新增一張表 `PrayerPrayedReaction` + 一個 enum `PrayedActorType`，不修改、不刪除、不更名 `HomePrayerCard`/`PrayerResponse`/`User` 的任何既有欄位，只在 `HomePrayerCard`/`User` 上各加一個新的反向關聯陣列欄位（Prisma relation 語法要求，純新增，不影響既有欄位或資料）。**沒有快取計數欄位**（例如 `HomePrayerCard.prayedCount`）——刻意不加，因為 `readHomeCard()`（`src/lib/homeCards.js:93-103`）既有的「回應數」就是用 `_count: { select: { responses: {...} } }` 即時計算，不是快取欄位；本次沿用同一慣例，用 `prisma.prayerPrayedReaction.count()` 即時計算，避免快取失效/不同步的額外複雜度。

**7. 如何防止同一 Guest 重複增加？**
**不使用**「`prayerId` + nullable `userId`/`guestSessionHash` 各自獨立」的唯一索引方案——因為 MySQL 的 UNIQUE INDEX 對 NULL 值的處理是「每個 NULL 都視為不同」，也就是說如果 `userId` 是 nullable 且匿名列一律 `userId = NULL`，`@@unique([prayerId, userId])` 完全無法阻止同一個 Prayer 被同一個匿名訪客重複建立多筆 NULL 列。改採規格文件建議的 fallback 方案：**`actorType` + `actorKeyHash`**（兩者皆為必填、非 nullable），對登入者與匿名者都产生一個非 NULL 的雜湊值，才能讓 `@@unique([prayerId, actorType, actorKeyHash])` 真正生效。

**8. 登入者與匿名者如何共用同一 API？**
同一支 `POST /api/home-cards/[id]/prayed`（路由慣例說明見下方「API 路徑決策」）。Server 端用 `readSessionUser()` 判斷：有 session 用 `actorType: "USER"` + `hashActorId("prayed-user", session.userId)`；無 session 用既有 Guest cookie 機制取得/建立 `guestId`，`actorType: "GUEST"` + `hashActorId("guest", guestId)`（與 `hashGuestId()` 完全相同的雜湊，只是重構後共用同一個底層函式，見下方實作）。

**9. Hidden／deleted Prayer 如何拒絕？**
`HomePrayerCard` 沒有「deleted」這個概念（沒有軟刪除欄位，也沒有找到任何硬刪除的既有 API），所以「deleted」在這張表的語意上等同於「`findUnique` 查無此列」。「hidden」則對應既有的 `isBlocked`/`isPrivate` 兩個欄位。本 Commit 直接沿用 `POST /api/responses`（`src/app/api/responses/route.js:128`）已經在用的同一組檢查：`if (!homeCard || homeCard.isBlocked || homeCard.isPrivate) return 404`，不新建第二套判斷邏輯。

**10. Admin 是否需要查看 Reaction 明細？**
本 Commit **不新增** Admin UI 來查看/管理 `PrayerPrayedReaction` 明細——規格文件的 Commit 1 範圍本身沒有要求建立新的 Admin 頁面。資料仍可透過 `npx prisma studio` 或直接查詢資料庫檢視（與 Commit C1 的匿名檢舉稽核記錄在 `AdminLog` 不同，這裡的稽核記錄就是資料表本身，因為每一列都是一個獨立、可稽核的反應紀錄，不需要額外的日誌層）。記錄為已知限制，若未來需要 Admin 稽核介面，屬於後續 Commit 範圍。

## Schema 決策

```prisma
enum PrayedActorType {
  USER
  GUEST
}

model PrayerPrayedReaction {
  id           Int             @id @default(autoincrement())
  prayerId     Int
  prayer       HomePrayerCard  @relation(fields: [prayerId], references: [id], onDelete: Cascade)
  actorType    PrayedActorType
  actorKeyHash String          @db.VarChar(64)
  userId       String?
  user         User?           @relation(fields: [userId], references: [id])
  createdAt    DateTime        @default(now())

  @@unique([prayerId, actorType, actorKeyHash])
  @@index([prayerId])
  @@map("prayer_prayed_reaction")
}
```

- `actorKeyHash` 是**唯一真正用於防重複的鍵**，永遠非 NULL（登入與匿名都會產生一個值）
- `userId` 是**額外**保留的 nullable FK，只在 `actorType: "USER"` 時填值，純粹為了將來若需要人工查詢「這個會員按過哪些 Prayer」時有 FK 可用；它**不參與**唯一性判斷（唯一性完全由 `actorKeyHash` 負責），所以即使它是 nullable 也不影響防重複的正確性
- 不新增 `guestSessionHash` 欄位——匿名列的 `actorKeyHash` 本身就等於 `hashGuestId(guestId)`，重複儲存沒有意義

## Actor 身分雜湊：重構 `guest-response.js`（新增，不變更既有行為）
```js
// 新增的通用函式，hashGuestId 改為呼叫它，輸出值完全不變
export function hashActorId(kind, value) {
  return value ? hmac(`${kind}:${value}`) : null;
}
export function hashGuestId(value) {
  return hashActorId("guest", value); // 與重構前輸出完全相同
}
```
`POST /api/responses`、`POST /api/prayer-response/report` 對 `hashGuestId()` 的既有呼叫**不受影響**（輸出值不變，純內部重構）。Prayed reaction 的登入身分雜湊用新的 `hashActorId("prayed-user", session.userId)`，加上 `"prayed-user"` 前綴是為了與其他 kind（如未來若有其他登入者身分雜湊用途）保持命名空間隔離，避免不同用途的雜湊輸入意外相同。

## API 路徑決策（偏離規格文件示範路徑，原因說明）
規格文件示範路徑是 `POST /api/prayers/[id]/prayed`。讀碼發現 **`/api/prayers/*` 整個命名空間已經是 410 Gone 的棄用端點**（`src/app/api/prayers/[id]/route.js`、`.../responses/route.js` 皆直接回傳 `{message: "This endpoint has been deprecated..."}`），採用這個路徑會建立一個立即衝突（父路由已棄用）且違反「重用既有 route conventions」的指示。改用與 Commit B 的 `/api/home-cards/[id]/adjacent`（已驗證可正常運作，即使 `/api/home-cards/[id]/route.js` 本身也是 410）相同的慣例：

- `POST /api/home-cards/[id]/prayed`
- `GET /api/home-cards/[id]/prayed`

## Migration 執行前確認
```
DATABASE_URL host: localhost
DB name: prayercoin_dev
```
確認為本機開發 DB（非 Production），符合規格文件「只對 localhost／test DB 執行」的條件。

## Migration 實際執行過程（發現兩個與本次改動無關的既有問題）
1. **`prisma migrate dev` 失敗**：Shadow database 重放既有 migration 歷史時，在 `20251010_add_token_reward_tables` 這個既有（非本次新增）migration 上失敗，錯誤是 `Table 'user' already exists`（P3006/P3018）。這代表 migration 歷史本身在「從空白重放」情境下不乾淨，與本次新增的 `PrayerPrayedReaction` 完全無關。
2. **`prisma db push` 也不安全**：執行後顯示會刪除 `home_prayer_card.visibility`（31 筆非空值）、`token_transaction.direction`（1 筆非空值）兩個欄位，並移除 enum `token_transaction_type` 的 `TRANSFER` 值——代表本機開發 DB 的實際結構與目前 `schema.prisma` 之間存在**既有 drift**（DB 有 schema.prisma 沒有定義的欄位/值），研判是先前 `feature/roadmap-prd-implementation` 分支合併留下、後續程式碼清理但未同步 migration 的殘留。另外也發現 DB 裡有一張 `api_rate_limit_bucket` 表，同樣不在目前 `schema.prisma` 定義中（孤兒表，本次未使用、未處理）。

以上兩點都是**修改前就存在、與本次功能無關**的環境問題，不在本次範圍內修復（貿然修復有更高風險去動到不相關的既有資料）。改採第三條路徑：
3. **手動撰寫 migration SQL**（比照既有 migration 檔案的實際語法慣例，例如 `20250929025833_add_prayer_response_reports`），只包含本次新增的 `CREATE TABLE prayer_prayed_reaction` 與兩個 `ADD CONSTRAINT` 外鍵，**不觸碰任何既有表**；用 `npx prisma db execute --file <sql>` 直接對本機開發 DB 執行（此指令不經過 shadow DB，也不做既有 drift 的自動同步，只精準執行我提供的 SQL）；執行後用 `npx prisma migrate resolve --applied` 把這個 migration 標記為已套用，讓 `_prisma_migrations` 追蹤表保持正確，不影響未來的 migration 歷史。

**Real DB tested**（非 Mock，對本機開發 DB `prayercoin_dev`）：用 Prisma Client 對一筆真實 `HomePrayerCard`（id=2）建立測試 Reaction、確認重複建立會被 `@@unique([prayerId, actorType, actorKeyHash])` 正確擋下（`P2002`）、確認 `count()` 正確、測試後已刪除測試列。

**已知限制**：`prisma migrate dev`/`prisma migrate deploy` 在這個既有 migration 歷史上是否能對一個全新環境（例如未來的 Production 或 CI）順利重放，本次**未驗證**（因為本機開發 DB 已經是「非空白」狀態，繞過了這個問題，而不是解決了它）。這是既有風險，已記錄於 [[13-Risk-Register]]，若要正式部署本次改動，建議先在一個乾淨環境驗證完整 migration 歷史可以重放成功。
