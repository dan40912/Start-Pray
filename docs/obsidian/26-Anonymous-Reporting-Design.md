---
tags: [start-pray, design, reporting, anonymous, commit-c1]
---

# 匿名檢舉設計盤點（Commit C1 前置分析）

參見 [[25-Companion-Mode-Reuse-Audit]]、[[20-Anonymous-Submission-Design]]、[[19-Security-Review]]。**本節為修改前的純讀碼盤點**，以實際程式與 DB schema 為準，不依文件猜測。

## 十三個問題的答案

**1. 現有 Report API 為什麼要求登入？**
`src/app/api/prayer-response/report/route.js` 第一行呼叫 `requireSessionUser()`，未帶有效 `start-pray-customer-session` cookie 會直接拋出 `UNAUTHENTICATED` → 401。這不是刻意的「防濫用」設計，而是因為它接下來會寫入 `PrayerResponseReport` 資料表，而該表的 `reporterId` 目前是**必填、有 FK 約束**的欄位（見問題 5），登入是滿足這個 FK 約束的手段，不是產品規則本身要求一定要登入。

**2. API 目前使用哪個 userId／session 欄位？**
`session.userId`（由 `readSessionUser()` 解析 `start-pray-customer-session` cookie 而來），直接作為 `PrayerResponseReport.reporterId` 寫入，也用來比對 `homeCard.ownerId === reporterId` 判斷是否為「卡片擁有者檢舉自己卡片下的回應」（`shouldBlock` 分支）。

**3. Guest cookie 或 Guest session 是否已存在？**
已存在。`src/lib/guest-response.js` 定義 `GUEST_RESPONSE_COOKIE = "start_pray_guest"`，已被 `POST /api/responses`（文字／語音回應送出）使用：沒有登入時，讀取既有 cookie 或呼叫 `createGuestId()` 產生新的，回應時用 `result.cookies.set(GUEST_RESPONSE_COOKIE, guestId, guestCookieOptions())` 寫回。

**4. Guest session 是否已有 HMAC／hash？**
已有。`hashGuestId(guestId)` 用 HMAC-SHA256（`crypto.createHmac("sha256", secret())`）對 `guest:${guestId}` 雜湊，產出的 `guestSessionHash` 才是實際寫入 DB 的值（`PrayerResponse.guestSessionHash`），原始 `guestId` 只存在於使用者瀏覽器的簽章 cookie 中，Server 端不落地明文 guest id 以外的任何識別資料。另有 `hashDailyIp(request, now)`：以「日期 + client IP」做 HMAC，逐日輪替，避免永久記錄可反查的原始 IP。

**5. 檢舉後實際修改哪個欄位？**
兩種情況：
- 一般情況（非卡片擁有者檢舉）：`PrayerResponse.moderationStatus` 設為 `"PENDING"`，並且 `reportCount` 遞增。
- 卡片擁有者檢舉自己卡片下的某則回應：`PrayerResponse.isBlocked` 設為 `true`（更強的下架）。
兩者都是**既有欄位**，Commit C1 不需要新增欄位就能重用同一組規則。

**6. 是否立即設為 hidden？**
是，立即生效（無非同步佇列、無 Admin 手動核准才生效的中間態）。`moderationStatus: "PENDING"` 或 `isBlocked: true` 一旦寫入，下一次任何公開查詢就會立刻排除它（見問題 8）。

**7. 是否只是建立 Report 等待 Admin？**
不是。`PrayerResponseReport` 資料列本身只是**稽核紀錄**（誰、何時、為何檢舉），不是「等待審核」的佇列——真正決定公開可見性的是 `PrayerResponse.moderationStatus`／`isBlocked` 這兩個欄位，兩者在同一個 transaction 內與 Report 列一起寫入，沒有時間差。

**8. 公開 API 是否已排除 hidden？**
是。`GET /api/responses/[homeCardId]/route.js` 的 `where` 條件已經是：
```js
{ homeCardId, isBlocked: false, moderationStatus: "APPROVED", voiceModerationStatus: { in: ["APPROVED", "NOT_APPLICABLE"] } }
```
也就是說，這條查詢原本就已經是「白名單制」（只回傳 `APPROVED`），而不是「黑名單制」（排除某個 hidden flag）。這代表 Commit C1 完全不需要修改這個查詢——只要匿名檢舉能把 `moderationStatus` 從 `APPROVED` 改成非 `APPROVED`，這條既有查詢就會自動排除它。

**9. Playlist API 是否已排除 hidden？**
是，同一條路徑。首頁陪伴模式（`CompanionOverlay.js`）的播放清單資料來源就是 `GET /api/responses/[homeCardId]`（透過 `HomePrayerHero.js` 取得），沒有另外一套 Playlist 專屬查詢，因此問題 8 的結論同樣適用：不需要修改。

**10. 同一使用者重複檢舉目前如何處理？**
登入使用者：`PrayerResponseReport` 有 `@@unique([responseId, reporterId])`，API 用 `findUnique` 先查是否已有該筆，若有則走 `update`（更新 reason/remarks，不重複遞增 `reportCount`、不重複寫入新列），若無則 `create` + 遞增 `reportCount`。這是**冪等**的設計。
匿名訪客：**目前完全沒有對應機制**（因為 `PrayerResponseReport.reporterId` 無法接受匿名身分，見問題 5、11），這是 Commit C1 必須補上的部分，設計見下方「匿名檢舉的冪等策略」。

**11. 是否已有 rate limit？**
Report API 本身**沒有**任何 rate limit（沒有頻率檢查、沒有時間窗口限制），只靠上述的 unique constraint 冪等防重複。`src/lib/rateLimit.js` 現有的 `checkRateLimit()` 只覆蓋 `createCard`／`createResponse` 兩種動作，且**只接受 `userId`**（不支援 guest 識別），無法直接套用在檢舉功能上。Commit C1 需要另外設計一個以 `guestSessionHash`／`ipHash` 為鍵的頻率限制（見下方章節）。

**12. Admin 是否仍看得到 hidden 項目？**
是。所有 Admin 查詢（`/admin/prayerresponse`、`/admin/prayfor` 等）都是獨立的 API／頁面，**沒有**套用問題 8 那個 `moderationStatus: "APPROVED"` 過濾條件（那是公開查詢專屬的限制），所以 `moderationStatus: "PENDING"` 或 `isBlocked: true` 的項目對 Admin 端完全可見、可稽核、可回復（如果 Admin UI 有提供狀態切換功能——未在本次盤點範圍內逐一確認每個 Admin 頁面的操作按鈕，但 API／查詢層級沒有排除）。

**13. hidden 項目的音訊 URL 是否仍可直接取得？**
分兩層看：
- **透過正常 API 查詢**：不行。一旦被檢舉並轉為 `PENDING`／`isBlocked`，`GET /api/responses/[homeCardId]` 不會再把它列在回傳陣列中，前端也就拿不到它的 `voiceUrl`。
- **直接持有舊 URL 存取**：`voices/[...path]`、`uploads/[...path]` 兩個檔案路由（`src/app/api/voices/[...path]/route.js` 類的靜態檔案服務）**沒有做任何存取權限驗證**（此為 [[13-Risk-Register]] 已記錄的既有風險，非本次新增），如果有人在檢舉前就已經複製了完整音檔網址，該網址本身在檢舉後**仍然可以直接讀取**，因為檔案本身沒有被刪除、也沒有被移到需要驗證的路徑。這是一個**既有、非本次引入**但需要在本次誠實記錄的殘留風險，見 [[19-Security-Review]] 與 [[13-Risk-Register]]。

## 匿名檢舉的冪等策略（設計決策）

`PrayerResponseReport.reporterId` 是 `String`（非 nullable）且是 `User` 的必填 FK：
```prisma
model PrayerResponseReport {
  reporterId String
  reporter   User   @relation(fields: [reporterId], references: [id])
  @@unique([responseId, reporterId])
}
```
匿名訪客沒有 `User.id`，**無法**在不違反 FK 約束的情況下寫入這張表。這裡有兩條路：

1. **新增 Migration**：把 `reporterId` 改為 nullable，新增 `guestSessionHash` 欄位，並改用 `@@unique([responseId, reporterId])` + 另一個 `@@unique([responseId, guestSessionHash])` 做雙軌唯一鍵。
2. **不新增 Migration**：匿名檢舉不寫入 `PrayerResponseReport`，只直接更新 `PrayerResponse.moderationStatus`／`reportCount`（沿用既有欄位、既有語意），冪等性改用「response 本身是否已經非 APPROVED」來判斷（而非「這個特定 guest 是否報過」），並用 `AdminLog`（`actorId` 欄位本身就是無 FK 限制的自由字串）留稽核紀錄，搭配 DB-backed rate limit 防濫用。

**選擇方案 2**，理由：
- 使用者指令明確傾向「優先避免為本功能建立大型資料模型」與「如果不需要永久保存 reporter，只需立即 hidden：可以採 API idempotency + rate limit」。
- 方案 1 的 migration 雖然是 additive（不破壞既有資料），但仍然是本 Commit 範圍聲明要盡量避免的「新 Schema」。
- 方案 2 完全重用現有欄位（`moderationStatus`、`reportCount`、`AdminLog`），零 migration，且因為 `moderationStatus` 的冪等判斷是以「response 目前狀態」為準（不是「這個特定 reporter 是否報過」），反而更簡單、無法被繞過（不像方案 1 的 unique constraint 只能擋同一個 guestSessionHash，如果攻擊者清 cookie 換身分，仍能造成多次寫入，只是每次都是 no-op，不會反覆改變 `moderationStatus`）。

**已知限制（誠實記錄）**：因為匿名檢舉不寫入 `PrayerResponseReport`，系統**無法精確追蹤是哪一個匿名使用者檢舉了哪一則內容**（不像登入使用者有 `reporterId` 可稽核）。稽核僅能靠 `AdminLog` 的 `actorId: "guest:<guestSessionHash>"` 與 metadata 中的 `ipHash`，且僅記錄「有嘗試檢舉」的事件，不構成可反查真實身分的個資。此限制已在 [[13-Risk-Register]]、[[19-Security-Review]] 中記錄。

## Rate limit 設計
不重用 `src/lib/rateLimit.js`（其 `COUNTERS` 只認 `userId`），改在 `src/app/api/prayer-response/report/route.js` 內以 `prisma.adminLog.count()` 查詢做兩個維度的頻率限制（皆為 DB-backed、非 in-memory，可跨 instance）：
- 每 Guest（`actorId = "guest:<guestSessionHash>"`）10 分鐘最多 5 次
- 每 IP（`metadata.ipHash` 相符）10 分鐘最多 10 次

每次匿名檢舉請求（無論是否為 idempotent no-op）都會寫入一筆 `AdminLog`，因此重複嘗試一樣會計入頻率限制，能防止「持續對已 hidden 的內容發送檢舉請求」造成的濫用查詢。

## 對 Commit C1 範圍的影響
| 項目 | 需要修改 | 不需要修改 |
|---|---|---|
| `POST /api/prayer-response/report` | 是（新增 guest 分支） | 登入分支邏輯完全不變 |
| `GET /api/responses/[homeCardId]` | 否 | 已經是白名單制查詢，匿名檢舉生效後自動排除 |
| `PrayerResponse` schema | 否 | 沿用 `moderationStatus`／`reportCount`／`isBlocked` |
| `PrayerResponseReport` schema | 否（不新增 migration） | 匿名檢舉不寫入此表 |
| `CompanionOverlay.js` | 是（移除 `authUser` 門檻、無障礙補強） | 播放/移除/Loop/Stop/Exit 邏輯不變 |
| `Comments.js`／`ResponseReportButton.jsx` | 否 | 這兩處呼叫同一支 API，但都在既有登入情境下使用，API 新增的 guest 分支不影響其行為 |

## 實際落地與測試（2026-08-05，Real API/DB tested，見 [[19-Security-Review]]、[[24-Manual-QA]]）

- 實作方式與上方設計決策一致：`src/app/api/prayer-response/report/route.js` 新增 `handleGuestReport`（不寫 `PrayerResponseReport`）與 `handleAuthenticatedReport`（原邏輯逐行搬移，未變更行為），由 `readSessionUser()` 是否有值決定走哪一支。
- **實作過程中發現並修正一個真實 Bug**：IP 維度的頻率限制第一版使用 Prisma 的陣列型 JSON path 篩選 `metadata: { path: ["ipHash"], equals: ipHash }`，這是 Postgres/MongoDB 的語法；在本專案的 MySQL provider 下會丟出 `PrismaClientValidationError`（`Argument path: Invalid value provided. Expected String`），導致真實請求回傳 500。已修正為 MySQL 需要的字串型 JSON path `path: "$.ipHash"`，修正後 Real Browser tested 確認 200 成功。這證明「未經真實 DB 測試的程式碼，即使邏輯設計正確，也可能因為 provider 差異而整支壞掉」——本次能抓到是因為堅持用真實本機 DB（`prayercoin_dev`）而非 Mock 驗證。
- Real API/Browser tested 項目（DEV TEST DATA，測試對象為既有測試列 `PrayerResponse.id = cmsdx6kap0000exqkokopc86x`，`homeCardId = 5`）：
  - 匿名訪客在 `/prayfor/5` 的陪伴模式三點選單可見、可點擊，送出檢舉後：`moderationStatus` APPROVED → PENDING、`reportCount` 0 → 1、`isBlocked` 維持 `false`（正確，因為訪客不是卡片擁有者）
  - 同一（已隱藏）Response 再次檢舉：回傳 200 冪等成功，`reportCount` 未再遞增
  - 偽造 `reporterId`／`userId`／`hidden`／`admin` 欄位：伺服器完全忽略，行為與正常請求一致
  - 缺少 `responseId`：400 `INVALID_REQUEST`；不存在的 `responseId`：404 `RESPONSE_NOT_FOUND`；不合法的 `reason`：400 `INVALID_REQUEST`
  - 連續發送 6 次請求：第 6 次前已達 `GUEST_REPORT_MAX_PER_GUEST=5`門檻，正確回傳 429 `RATE_LIMITED`（HttpOnly cookie 無法被 `document.cookie` 清除，證實同一瀏覽器分頁全程被視為同一個 Guest，無法用前端手法繞過）
  - 檢舉成功後：`GET /api/responses/5` 立刻不再回傳該筆；直接打已知的 `voiceUrl` 仍是 200（見 [[19-Security-Review]] 的「Remaining risk」）
  - 陪伴入口（「聆聽大家的禱告」）在該 Prayer 僅剩 0 筆可播放回應時，離開陪伴模式後正確消失；重新整理／重新進入亦不再顯示，直到用 Prisma 手動把測試列復原為 `APPROVED` 才恢復
  - X（本地移除）在同一次測試中確認維持純前端行為：點擊後無任何 `prayer-response/report` 網路請求、DB 未變動，離開再重新進入陪伴模式後項目重新出現
- **測試資料復原**：測試結束後已用 Prisma 將 `cmsdx6kap0000exqkokopc86x` 復原為 `{ isBlocked: false, moderationStatus: "APPROVED", reportCount: 0 }`，與測試前記錄的原始狀態一致。
