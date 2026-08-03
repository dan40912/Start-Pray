---
tags: [start-pray, decisions]
---

# 決策紀錄

參見 [[09-Change-Impact-Analysis]]、[[10-Implementation-Plan]]。所有決策目前狀態一律為 `Proposed`，需使用者裁示後更新為 `Accepted`/`Rejected`。

## DEC-001｜移除使用者註冊與登入
- 日期：2026-08-03
- 狀態：**Accepted（已執行，見 Commit 1 `6b8cc84`）**——僅隱藏導覽/頁尾入口，`/login`、`/signup`、API、資料表皆未變動
- 背景：[[01-Product-Vision]] 要求匿名優先、不需登入即可使用核心流程
- 決定：暫時從導覽列隱藏登入/註冊入口，**不刪除**頁面、API、資料表
- 原因：既有會員資料與後台管理仍需要這些機制存在；直接刪除風險過高且非必要
- 影響：見 [[06-Authentication-Dependencies]]、[[09-Change-Impact-Analysis]]
- 替代方案：完全移除（風險過高，不建議現階段採用）
- 待確認事項：是否有既有會員需要被告知或遷移

## DEC-002｜首頁成為唯一主要操作入口
- 日期：2026-08-03（執行：2026-08-04）
- 狀態：**Accepted（已執行，見 Commit 2 `04538e7`）**
- 背景：原首頁是地球 hero + 禱告牆瀏覽的複合頁面（`HomeLandingPage.js`）
- 決定：首頁改版為單一訊息 + 單一錄音行動
- 原因：符合「三秒內理解」「一個主要行動」設計原則
- 影響：新增 `HomePrayerHero.js` 取代原本掛載的 `HomeGlobeHero.js`；`HomeEntryCards`/`HomeProofSection`/`HomePrayerExplorer` 等下方區塊**維持不變**（Commit 8 才會處理是否收斂）
- 替代方案：保留現有首頁，另開一個極簡子頁作為主要入口（增加分流複雜度，不建議，未採用）
- 待確認事項：既有首頁瀏覽/分類功能收斂後放在哪個頁面（見 Commit 8 規劃）

## DEC-003｜移除地球與非核心視覺功能
- 日期：2026-08-03（執行：2026-08-04）
- 狀態：**Accepted（已執行，見 Commit 2 `04538e7`）**
- 背景：先前誤判為「首頁 three.js hero + `/global-prayer-room` Cesium 地球」兩套獨立實作；經 [[02-Current-Architecture]] 更正，實際只有一個 Cesium 元件 `GlobalPrayerRoomOptimized` 被首頁與全頁兩處呼叫
- 決定：首頁**不再掛載**該元件（改用 `HomePrayerHero.js`），`/global-prayer-room` 全頁與其呼叫的元件**維持不變、未刪除**
- 原因：Cesium 牽涉外部服務費用與既有分享連結，先不動 `/global-prayer-room`；首頁部分是首頁重構的一部分
- 影響：`HomeGlobeHero.js` 因此變成無呼叫者的孤兒元件（未刪除，見 [[13-Risk-Register]]），`GlobalPrayerRoom.js` 本身未變動
- 替代方案：直接刪除（不可逆、風險高，不建議現階段採用，未採用）
- 待確認事項：`/global-prayer-room` 是否有既有外部連結分享需要保留 301 或提示頁（本次未處理，因為路由本身沒有變動，不存在 404 風險）

## DEC-004｜採用匿名投稿
- 日期：2026-08-03
- 狀態：Proposed
- 背景：文字回應已支援匿名（`responderId` nullable + `guestSessionHash`），語音回應被 `VOICE_LOGIN_REQUIRED` 卡關
- 決定：移除語音回應的登入硬性檢查，改用既有 guest 追蹤機制 + 新增 rate limit
- 原因：schema 已支援，主要缺口在 API 層邏輯，改動範圍可控
- 影響：`src/app/api/responses/route.js`，需同批補上 abuse prevention（見 [[09-Change-Impact-Analysis]]）
- 替代方案：要求輕量註冊（違反匿名優先原則，不建議）
- 待確認事項：rate limit 的具體門檻（次數/時間窗）

## DEC-005｜手機優先
- 日期：2026-08-03
- 狀態：Proposed
- 背景：目前無 Tailwind，響應式靠純 CSS `@media`；`VoicePrayerOverlay.js` 尚未確認行動瀏覽器相容性完整度
- 決定：Phase 2 起所有錄音/播放流程以行動瀏覽器測試為主要驗收標準
- 原因：符合設計原則「手機優先」
- 影響：[[10-Implementation-Plan]] Phase 2
- 替代方案：桌面優先，行動裝置後補（不符合產品方向，不建議）
- 待確認事項：需支援的最低瀏覽器版本清單

## DEC-006｜舊功能先停用再移除
- 日期：2026-08-03
- 狀態：**Accepted（持續遵循中）**——Commit 1-3 皆以「隱藏/不掛載」而非刪除的方式執行，`HomeGlobeHero.js`、`VoicePrayerOverlay.js`、既有 Auth 系統皆完整保留
- 背景：使用者明確要求不得一次刪除大量程式碼
- 決定：所有「移除」類改動一律先走「暫時隱藏」，Phase 5 才視情況正式刪除
- 原因：降低風險、保留回滾能力
- 影響：貫穿 [[10-Implementation-Plan]] 全部 Phase
- 替代方案：直接刪除（不建議）
- 待確認事項：無

## DEC-007｜匿名使用下的內容刪除與管理方式
- 日期：2026-08-03
- 狀態：Proposed
- 背景：現有唯一刪除機制要求登入+擁有者比對；匿名投稿者目前完全無法管理自己的內容
- 決定：傾向在既有方案 D（`start_pray_guest` 簽章 cookie）基礎上，擴充方案 C 的管理 token 概念——沿用 `src/lib/guest-response.js` 的 HMAC 簽章模式，而非引入新技術棧
- 原因：地基已存在（見 [[05-Data-Model]]），改動風險最低、與現有程式模式一致
- 影響：需新增管理 token 產生/驗證邏輯，可能需要在 `PrayerResponse`/`HomePrayerCard` 增加對應欄位（需評估是否要新 migration，屬於 Phase 3 範圍，本次不執行）
- 替代方案比較：

| 方案 | 使用門檻 | 隱私 | 可管理性 | 技術成本 | 安全風險 | 建議 |
|---|---|---|---|---|---|---|
| A 完全匿名 | 最低 | 最高 | 無 | 最低 | 低（但使用者無法自救刪除） | 不建議單獨使用，管理性太差 |
| B 匿名裝置識別（localStorage/device token） | 低 | 高 | 同裝置可管理，清快取後失效 | 低 | 中（token 若無簽章可能被偽造） | 可作為 UX 層輔助，但需搭配簽章 |
| C 匿名刪除金鑰（管理 token） | 低 | 高 | 憑 token 可管理，token 遺失則無法管理 | 中 | 中（token 外洩風險，需限流+雜湊儲存） | **建議採用，並與方案 D 結合** |
| D 匿名 Session（現有 `start_pray_guest`） | 低 | 高 | 依賴 session 存續 | 已存在，成本最低 | 低（已有 HMAC 簽章基礎） | **建議作為底層機制，現況已部分實作** |

- 待確認事項：管理 token 的有效期、遺失後是否提供任何救濟管道（例如僅能走檢舉/聯絡管理員）
