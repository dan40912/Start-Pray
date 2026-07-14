# PRD-005 — 匿名下的真實性與防濫用 (Authenticity & Anti-Abuse under Anonymity)

- 階段：**P1**
- 狀態：未開始
- 依賴：PRD-002(發獎上限)互補;可同期。
- 對應風險：鼓勵匿名保護隱私是對的,但「匿名 + 可刷幣 + 反應式檢舉」很容易被拿來捏造代禱事項刷點數,真實性與問責是空的。

---

## 1. 目標 (Goal)

在**不犧牲匿名與隱私**的前提下,提高內容真實性、降低濫用:
- 用 rate limit 與帳號信任分數,擋住批量假卡/假回應。
- 把檢舉從「純事後」往「前置門檻 + 可累積」推進。

## 2. 背景與現況 (Background)

- 會員存取控制:`src/lib/customer-access.js`、session `src/lib/customer-session.js`。
- 建立卡片:`POST /api/home-cards`(需登入且未封鎖);前台入口 `/customer-portal/create`。
- 建立回應:`src/app/api/PrayerResponse/route.js`。
- 檢舉模型:`HomePrayerCardReport`、`PrayerResponseReport`、`OvercomerUserReport`(`schema.prisma` line 96–145),皆 `@@unique([target, reporter])`。
- 封鎖旗標:`User.isBlocked`、`PrayerResponse.isBlocked` 等。
- **現況**:沒有建立頻率限制;沒有帳號信任維度;檢舉達標後的自動處置不明確。

## 3. 範圍 (Scope)

**In scope**
- 建立卡片 / 回應的**頻率限制**(per user, 時間窗)。
- 帳號信任分數(`trustScore`):依帳齡、被檢舉數、被封鎖紀錄計算,低分者受更嚴格限制與「需審核才公開」。
- 檢舉達門檻自動把內容轉「待審 / 隱藏」,並寫 `AdminLog`。

**Out of scope(不要做)**
- ❌ 不要求實名、不收身分證件、不破壞匿名。
- ❌ 不接第三方反詐 / 風控服務。
- ❌ 不改代幣金額(PRD-002 管)。

## 4. 詳細實作步驟 (Implementation)

**Step 1 — Schema**
`User` model 新增:
```prisma
trustScore   Int      @default(50)  // 0–100, 預設中性 50
flaggedCount Int      @default(0)   // 累計被有效檢舉次數
```
`HomePrayerCard` 與 `PrayerResponse` 視需要新增 `needsReview Boolean @default(false)`(若 PRD-001 已給 PrayerResponse 審核狀態,回應就沿用那個,不要重複加)。
Migration:`add_trust_and_review`。

**Step 2 — Rate limit 模組(新檔)**
`src/lib/rateLimit.js`:
- `checkRateLimit({ userId, action, windowMs, max })`,以 DB 計數(查該 user 在 windowMs 內的 `createdAt` 筆數)實作,**不引入 Redis / 外部套件**。
- 預設:建立卡片 `max 5 / 1h`;建立回應 `max 20 / 1h`。常數寫檔頂。

**Step 3 — 信任分數**
`src/lib/trustScore.js`:
- `computeTrustScore(user)`:基準 50;帳齡每滿 N 天 +分(上限);每筆 `flaggedCount` -分;`isBlocked` 歷史大幅扣分。clamp 0–100。
- 低於門檻(例如 `< 25`)的使用者:建立的卡片 / 回應預設 `needsReview = true`(不立即公開),且 rate limit 上限砍半。

**Step 4 — 串進建立流程**
- `POST /api/home-cards` 與 `PrayerResponse` route:建立前 `checkRateLimit`,超限回 `429` 與友善訊息;依 `trustScore` 決定 `needsReview`。
- 前台只顯示 `needsReview = false`(且未 blocked)的內容;作者本人可看到自己待審的內容並標示「審核中」。

**Step 5 — 檢舉達標自動處置**
- 在三個 report 的建立 endpoint:寫入 report 後重算 target 的 `reportCount`;達門檻(沿用 `TokenRewardRule.allowedReports` 或新常數,擇一並註明)時,把 target 設 `needsReview = true` / 對回應設 `isBlocked = true`,作者 `flaggedCount += 1`,寫 `AdminLog`。

## 5. 資料模型變更摘要

- `User` +2 欄位;`HomePrayerCard`(+ 視情況 `PrayerResponse`)+ `needsReview`。
- 一個 migration `add_trust_and_review`。

## 6. 驗收標準 (Acceptance Criteria)

1. Migration applied; `npx prisma generate` + `npm run build` pass.
2. Creating 6 cards within an hour as one user → the 6th returns HTTP 429 with a friendly message; no card row created.
3. Creating 21 responses within an hour as one user → the 21st returns 429.
4. A brand-new / low-trust user (trustScore < 25) → their new card is created with `needsReview = true` and does NOT appear on the public wall, but IS visible to the author marked 審核中.
5. A normal-trust user's card appears publicly immediately (no regression).
6. When a card's reports reach the configured threshold, it auto-sets `needsReview = true`, the author's `flaggedCount` increments, and one `AdminLog` row is written.
7. `computeTrustScore` returns 50 for a fresh neutral account and decreases monotonically as `flaggedCount` rises (unit-checkable).
8. Anonymity preserved: no new field stores real identity, address, or precise location.
9. No new external dependency added (`git diff package.json` empty).
10. `npm run lint` + `npm run build` pass; `git diff --name-only` limited to the files in Section 4.

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ❌ 不要為了做 rate limit 而 `npm install` Redis / rate-limiter 套件 —— 用 DB 計數即可。若你認為非用不可,**停下來問**。
- ❌ 不要新增任何會洩漏真實身分 / 地址 / 精準座標的欄位(與全球禱告室隱私原則一致,見 `src/lib/prayerLocations.js`)。
- ⚠️ 若 PRD-001 已替 `PrayerResponse` 加了審核狀態,回應的「待審」**沿用那個**,不要再加 `needsReview` 到 PrayerResponse,避免兩套狀態打架。在回報中說明你的選擇。
- ✅ 所有門檻 / 常數集中可調,並在回報列出實際數值。
- ✅ 429 要有友善文案(走 i18n),不要回裸 500。
