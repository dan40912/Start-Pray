---
tags: [start-pray, security, commit-c1]
---

# 安全檢查（Commit C1：匿名檢舉）

參見 [[26-Anonymous-Reporting-Design]]、[[13-Risk-Register]]。本文件檢查匿名檢舉功能（`POST /api/prayer-response/report` 的 guest 分支）的安全面向，分類為 Mitigated／Partially mitigated／Production requirement／Remaining risk。以本機開發環境 Real API tested 為準，未宣稱涵蓋 Production 環境的額外防護（例如 CDN/WAF 層級規則）。

## Mitigated（已在本 Commit 內處理，Real API tested）

| 項目 | 說明 |
|---|---|
| Guest identity spoofing（偽造匿名身分） | 身分完全由 Server 端決定：讀取（或新建）簽章的 `start_pray_guest` HttpOnly cookie，經 HMAC-SHA256 雜湊後才作為 `actorId`／rate limit 鍵值使用，Client 無法讀取或竄改 cookie 內容（`httpOnly: true`，Real Browser tested：`document.cookie` 無法清除此 cookie）。 |
| Reporter impersonation（冒充其他人檢舉） | Request body 只讀取 `responseId`／`reason`／`remarks`；`reporterId`／`userId`／`guestHash`／`hidden`／`admin` 等欄位即使被送入 payload 也完全不會被程式碼讀取。Real API tested：送出這些偽造欄位，回應與正常請求一致（伺服器忽略之）。 |
| Forged responseId → IDOR | `responseId` 一律先用 `prisma.prayerResponse.findUnique` 查詢是否存在，不存在回傳 404；不存在的操作路徑不會觸及任何寫入。Real API tested。 |
| Report spam（同一 Response 被大量檢舉洗版） | 因為冪等判斷是「Response 目前是否仍是 APPROVED」而非逐筆計數，一旦成功隱藏，後續請求一律走 no-op 成功分支，不會重複遞增 `reportCount` 或建立大量資料列。Real API tested：連續多次檢舉同一已隱藏項目，`reportCount` 維持不變。 |
| Duplicate report（重複檢舉） | 同上；此外登入者原本就有 `@@unique([responseId, reporterId])` 資料庫層級約束（未變更）。 |
| Rate limit bypass（單純重試） | DB-backed（非 in-memory）頻率限制：每 Guest 10 分鐘 5 次、每 IP 10 分鐘 10 次，透過 `AdminLog` 計數，重開瀏覽器分頁或重試請求不會重置計數（狀態在資料庫，不在記憶體）。Real API tested：連續發送超過門檻的請求，第 5 次後正確回傳 429 `RATE_LIMITED`。 |
| Hidden bypass（繞過隱藏機制看到已檢舉內容） | 公開查詢（`GET /api/responses/[homeCardId]`）本來就是白名單制（只回傳 `moderationStatus: "APPROVED"` 且 `isBlocked: false`），未新增例外路徑。Real API tested：檢舉成功後立即用同一支公開 API 查詢，該筆不再出現。 |
| Deleted bypass | 系統目前沒有硬刪除 `PrayerResponse` 的路徑（既有限制，非本次新增），故不適用；`findUnique` 找不到資料會回傳 404，行為正確。 |
| Stack trace / 內部錯誤洩漏 | 例外處理只回傳固定的中文訊息與 `code`，`console.error` 只寫入伺服器端 log，不回傳給 Client。Real API tested：故意觸發 500（見下方 Partially mitigated）時，回應本體只有 `{code, message}`，無 stack trace。 |
| Guest token 完整明碼記錄於 log | `AdminLog.metadata` 只存 `guestSessionHash`（HMAC 雜湊後的值）與 `ipHash`（HMAC(日期+IP) 雜湊），從未寫入原始 guest cookie 值或原始 IP。 |

## Partially mitigated

| 項目 | 說明 | 殘留風險 |
|---|---|---|
| CSRF | 沿用整個專案既有的 cookie-based session 模式，本 API **未額外新增** Origin/Referer 驗證（既有登入分支本來就沒有，本次沒有引入新的攻擊面，但也沒有補強）。 | 若之後要補強，建議與其他既有 API 一併處理（見 [[13-Risk-Register]] 既有的「CSRF/CORS 對匿名 API」項目），非本 Commit 範圍。 |
| Direct audio URL exposure（已檢舉音檔的直接網址） | 隱藏只影響「透過正常 API 查詢」，`/voices/[...path]` 檔案路由本身沒有存取驗證（既有限制）。Real API tested：檢舉後直接 `fetch` 已知的 `voiceUrl` 仍回傳 200。 | 若攻擊者在檢舉前已取得完整網址，該網址持續可用；需要 Storage 層級的存取控制或改為簽章網址才能真正阻斷，非本 Commit 範圍，記錄於 [[13-Risk-Register]]。 |
| 開發過程中發現並修正的 Bug：MySQL JSON path 篩選語法 | 第一次實作用 Prisma 的陣列型 `path: ["ipHash"]`（Postgres/Mongo 語法），在 MySQL provider 下觸發 `PrismaClientValidationError` → 500。已修正為 MySQL 需要的字串型 `path: "$.ipHash"`，Real API tested 通過。 | 記錄此處是提醒：本 Commit 的 IP 維度頻率限制**已修正並驗證**，非未解決風險，但顯示這條路徑在合併前曾經是壞的，值得在 Code Review 時留意類似的 provider-specific 語法。 |

## Production requirement（本機可行，Production 需要額外處理）

| 項目 | 說明 |
|---|---|
| 分散式 Rate limit | 目前的頻率限制查詢 `AdminLog` 資料表本身是 DB-backed（非 in-memory），理論上可以跨 instance 運作而不像純記憶體計數器那樣重置；但**沒有專用索引**（`AdminLog` 只有 `[category, createdAt]`／`[createdAt]` 索引，`actorId` 與 JSON `metadata` 皆為全表掃描等級的查詢效率），Production 規模下需要評估效能，或改用專用的頻率限制資料表／服務。 |
| CORS | 本機開發環境未設定跨網域限制；Production 部署需確認 API 只接受同源請求（若尚未在既有 middleware 層處理）。 |
| Cookie Secure 旗標 | `guestCookieOptions()` 已經是 `secure: process.env.NODE_ENV === "production"`（既有邏輯，未變更），本機測試時為 `false` 是預期行為，Production 環境會自動變成 `true`。 |

## Remaining risk（誠實記錄，非本 Commit 能單獨解決）

| 項目 | 說明 |
|---|---|
| 無法精確追蹤「同一匿名者」的重複檢舉 | 因為選擇不寫入 `PrayerResponseReport`（該表 `reporterId` 是必填 User FK），匿名檢舉沒有像登入使用者一樣的、逐筆可稽核的「誰檢舉了什麼」記錄，只有 `AdminLog` 的粗粒度嘗試記錄。見 [[26-Anonymous-Reporting-Design]] 的設計決策說明。 |
| Anonymous moderation abuse（惡意大量檢舉他人正當內容） | 目前的防護只有頻率限制（速度層面），沒有內容層面的濫用偵測（例如同一 Guest 短時間內檢舉多個不同 Response）；此為既有 Admin 後台稽核（`moderationStatus: PENDING` 可人工復核）需要承擔的角色，非本 API 本身能完全防堵。 |
| `/voices`、`/uploads` 檔案路由無存取驗證 | 既有風險（[[13-Risk-Register]] 已記錄），本次的隱藏機制無法讓已流出的直接網址失效。 |
