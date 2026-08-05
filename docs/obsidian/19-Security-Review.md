---
tags: [start-pray, security, commit-c1, commit-1]
---

# 安全檢查（Commit C1：匿名檢舉；Commit 1：Prayed Reaction）

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

## Prayed Reaction 安全檢查（Commit 1，見 [[28-Prayed-Reaction-Design]]）

### Mitigated（Real API/DB tested）
| 項目 | 說明 |
|---|---|
| Forged actor（偽造身分） | Server 完全不讀取 request body，身分只能來自 session 或簽章 Guest cookie；`userId`/`guestHash`/`actorKey`/`count`/`status`/`admin` 等偽造欄位即使送入也無效。Real API tested。 |
| Duplicate reaction（重複建立） | 資料庫層級 `@@unique([prayerId, actorType, actorKeyHash])` 約束，非僅應用層檢查；Real DB tested 確認並發/重複 create 會拋出 `P2002` 並被正確吞下（回傳既有計數，不報錯）。 |
| Count inflation（灌水） | 冪等設計：同一 actor 對同一 Prayer 永遠只會有一列，`count()` 是即時查詢真實列數，不是可被前端操縱的快取值。 |
| Hidden Prayer（`isBlocked`） | `loadPrayer()` 查詢時即檢查，Real API tested：對已封鎖卡片操作回傳 404。 |
| Deleted Prayer（等同查無此列） | `findUnique` 找不到即 404，Real API tested。 |
| Rate limit | DB-backed（非 in-memory）：Guest 10 分鐘 20 個不同 Prayer、IP 10 分鐘 50 次，Real API tested 對 21 個不同 Prayer 送出請求，第 21 次正確 429。 |
| Stale client count（前端顯示與後端不同步） | 前端 `count`/`reacted` 完全來自 API 回傳值，沒有任何前端本地遞增邏輯；Prayer 切換時用 generation counter 忽略過期回應，避免顯示錯誤 Prayer 的計數。Real Browser tested。 |

### Partially mitigated
| 項目 | 說明 | 殘留風險 |
|---|---|---|
| CSRF/Origin | 與既有匿名寫入 API（`/api/responses`、`/api/prayer-response/report`）相同，未額外新增 Origin/Referer 驗證 | 見下方「CSRF／Origin／CORS」段落（Commit 2 範圍），非本次新增攻擊面 |
| Rate limit 查詢效能 | `prayer_prayed_reaction` 目前只有 `[prayerId]`、`[ipHash, createdAt]` 索引，guest 維度（`actorType`+`actorKeyHash`+`createdAt`）查詢無複合索引 | Production 規模下可能變慢，本機規模 Real API tested 無明顯延遲，見 [[13-Risk-Register]] |

### Production requirement
| 項目 | 說明 |
|---|---|
| Migration 在全新環境的可重放性 | 本次繞過了 `prisma migrate dev`（因既有、非本次的 migration 歷史問題），未驗證乾淨環境下完整重放是否成功，見 [[28-Prayed-Reaction-Design]]、[[13-Risk-Register]] |

### Remaining risk
| 項目 | 說明 |
|---|---|
| Admin 無法查看 Reaction 明細 | 規格文件本輪未要求新增 Admin UI；資料僅能透過 Prisma Studio 或直接查詢檢視，見 [[28-Prayed-Reaction-Design]] 問題 10 |

## CSRF／Origin／CORS（Commit 2，2026-08-05）

盤點了全部三支匿名可寫入 API（`POST /api/responses`、`POST /api/prayer-response/report`、`POST /api/home-cards/[id]/prayed`），修改前皆**沒有**任何 Origin/Referer 驗證，只靠 cookie-based session/guest 身分。

### 已實作並 Real tested
新增 `src/lib/origin-guard.js`（`isTrustedOrigin(request)`，刻意不 import `next/server`，因為 `next/server` 在純 `node --test` 環境下無法解析，會導致單元測試整份失敗——已在開發過程中實際踩到並修正這個問題），套用到三支 API 的 `POST` handler 最前面（`GET` 端點不需要，因為讀取操作沒有 CSRF 風險）。

判斷邏輯：
- 沒有 `Origin` header → 拒絕（403 `INVALID_ORIGIN`）。已用真實 fetch() 呼叫這個 App 自己的一支測試端點確認：本 App 對同源 POST **一定會**送出 `Origin`（Real tested，非假設）
- 有 `Origin` 且已設定 `ALLOWED_ORIGINS` 環境變數（Production 用，逗號分隔，程式碼內**不寫死任何網域**）→ 檢查是否在允許清單內
- 未設定 `ALLOWED_ORIGINS`（本機開發預設）→ 檢查 `Origin` 的 host 是否等於請求的 `Host` header（即「是否真的同源」）

**Real tested（非 Mock，對正在執行的本機 dev server 發送真實 HTTP 請求，非瀏覽器內建工具阻擋能偽造 Origin 的限制，改用 Node 直接發送）**：
- 偽造 `Origin: https://evil.example` 打三支 API，皆正確回傳 `403 INVALID_ORIGIN`
- 完全不帶 `Origin` header 打 `/api/home-cards/[id]/prayed`，同樣正確回傳 `403`
- 從真實瀏覽器頁面（同源）呼叫三支 API，皆正常運作（`200`/`201`/`404`-業務邏輯層級，未被 Origin 檢查誤擋）——確認沒有破壞任何既有功能
- 5 個單元測試（`tests/origin-guard.test.mjs`）涵蓋：同源允許、無 Origin 拒絕、跨源拒絕、Origin 格式錯誤拒絕、`ALLOWED_ORIGINS` 白名單模式

### 已知限制
- 這是**額外的縱深防禦層**，不是唯一防線；即使 Origin 檢查被繞過，既有的身分驗證（session/guest）、rate limit、資料庫唯一約束仍然有效
- `ALLOWED_ORIGINS` 尚未在任何 `.env.example`/部署文件中記錄——Production 部署前需要設定這個環境變數，否則會退回「Origin host 必須等於 Host header」這個較嚴格的預設值，可能在有 CDN/反向代理改寫 Host 的情況下誤擋合法請求，需要在真正部署前用實際 Production 網域驗證一次

## Storage 與直接 URL（Commit 2，2026-08-05）

檢查 `/voices/[...path]`、`/uploads/[...path]`、`src/lib/storage/`（driver 抽象層，`localDriver.js`/`objectDriver.js`）。

| 問題 | 答案 |
|---|---|
| URL 是否永久公開？ | 是。預設 `MEDIA_STORAGE_DRIVER=local`，檔案直接寫入 `public/voices`、`public/uploads`，由 Next.js 當作一般靜態檔案提供，**沒有任何存取驗證**（既有風險，[[13-Risk-Register]] 已記錄，非本次引入） |
| Hidden 後已知 URL 是否仍可用？ | 是。Commit C1 的匿名檢舉、Commit 1 的既有 hidden 機制都只影響**查詢層**（`moderationStatus`/`isBlocked` 過濾），完全不影響檔案本身是否存在，Real API tested 已確認（見 [[26-Anonymous-Reporting-Design]]） |
| Deleted 後是否仍可用？ | 系統目前**沒有**刪除 `PrayerResponse`/音檔的既有 API（見 [[20-Anonymous-Submission-Design]]），此問題目前不適用；但值得注意的是，本次 Commit 2 測試時手動用 Prisma 刪除測試 `PrayerResponse` 資料列後，實際上傳的檔案**仍留在磁碟上**（孤兒檔案，非本次引入的既有行為，測試後已手動清除） |
| Cloud Run 是否使用 ephemeral filesystem？ | **無法從這個 repo 確認**。`docker-compose.yml` 只有本機開發用設定（bind mount 整個 repo，非 Production 專用的 volume 掛載策略），沒有找到 Production 部署設定檔（Cloud Run YAML、Kubernetes manifest 等）明確說明 `public/voices`/`public/uploads` 是否掛載到持久化磁碟。`src/lib/storage/objectDriver.js` 存在但註解明確寫「骨架，尚未串接雲端 SDK」 |
| Production Storage 是否持久化？ | 同上，**無法確認**，标记为 Production Blocker |
| 是否需要 signed URL？ | 若要真正解決「hidden 後已知 URL 仍可用」的殘留風險，需要 signed URL 或私有 bucket + 短效存取權杖；目前的 `local`/`object` driver 皆未實作此能力 |

**本次未進行任何破壞性改動**（未切換 storage driver、未修改既有檔案路由的存取邏輯）。標記為：

> **Production Blocker**：部署前需要確認（1）Production 實際使用的 filesystem 是否持久化，如果是 ephemeral（例如 Cloud Run 預設），現有 `local` driver 會導致每次重新部署音檔全部遺失；（2）是否要完成 `objectDriver.js` 的雲端 SDK 串接並切換 `MEDIA_STORAGE_DRIVER=object`；（3）是否需要 signed URL 機制解決「已檢舉/隱藏內容的直接網址仍可用」的問題。這三項都不在本次 Commit 2 範圍內實作，因為都涉及 Production 環境本身的架構決策，不是本機開發可以獨立驗證或安全變更的項目。

## 集中式 Rate Limit 現況盤點（Commit 2，2026-08-05）

| 使用位置 | 實作方式 | DB-backed／In-memory |
|---|---|---|
| `src/lib/rateLimit.js`（`checkRateLimit`，`createCard`/`createResponse`） | 查詢既有資料表（`homePrayerCard`/`prayerResponse`）計數 | **DB-backed** |
| `POST /api/responses`（文字/語音回應頻率限制） | 直接查詢 `prayerResponse` 表（`identityWhere` + 時間窗口） | **DB-backed** |
| `POST /api/prayer-response/report`（Commit C1，匿名檢舉） | 查詢 `AdminLog` 表（`actorId`／`metadata.ipHash` JSON path + 時間窗口） | **DB-backed** |
| `POST /api/home-cards/[id]/prayed`（Commit 1，Prayed reaction） | 查詢 `prayerPrayedReaction` 表本身 | **DB-backed** |

**結論**：本專案目前**所有**匿名寫入 API 的 rate limit 皆為 DB-backed（查詢 MySQL 既有/新增資料表），**沒有**使用記憶體內計數器（例如 Node process 內的 `Map`/`WeakMap`），因此不存在「多 instance 各自維護獨立計數、導致實際限制形同虛設」的 in-memory 風險——DB 是所有 instance 共用的單一事實來源，這個結論適用於 Cloud Run 多 instance 部署。

**已知限制**（非本次新引入，已分別記錄於各自的設計文件）：
- 部分查詢缺少專用複合索引（`AdminLog`、`prayer_prayed_reaction` 的 guest 維度查詢），Production 規模下可能變慢，但**正確性不受影響**，只是效能考量
- 沒有 cleanup／expiry 機制主動刪除過期的計數用資料列（例如 `AdminLog`、`PrayerPrayedReaction` 不會自動清除超過時間窗口的舊資料）——這些資料本身也是既有的稽核/功能資料，不是純粹的計數暫存，所以「不主動清除」是合理的既有設計，而非疏漏
