# PRD-002 — 代幣獎勵去風險化 (Token Incentive De-risking)

- 階段：**P0**
- 狀態：未開始
- 依賴：建議在 PRD-001 之後(審核狀態可當作發獎前置條件),但不強制。
- 對應風險：把「代禱回應」直接綁上代幣獎勵會扭曲動機(為賺幣而灌水),與「先照顧人」理念衝突。

---

## 1. 目標 (Goal)

降低「為了賺幣而回應」的誘因,讓代幣回到「肯定真誠陪伴」而非「按則計酬」。
**本期不移除代幣系統**(那是產品決策,需你拍板),而是加上防灌水與動機緩衝機制,並把開關交給管理員。

## 2. 背景與現況 (Background)

- 獎勵邏輯:`src/lib/tokenRewards.js`。預設規則 `DEFAULT_RULE = { rewardTokens: 10, observationDays: 3, allowedReports: 0 }`。
- 規則存 `TokenRewardRule`(`schema.prisma` line 174),單例 `RULE_ID = 1`。
- 回應上的獎勵欄位:`PrayerResponse.tokensAwarded / isSettled / rewardStatus / rewardEligibleAt / rewardEvaluatedAt`(line 72–79)。
- 交易紀錄:`TokenTransaction`(line 295),關聯 `PrayerResponseTransactions`。
- 後台規則設定頁:`src/app/admin/finance` / `src/app/admin/wallet` / `src/app/admin/settings`(確認哪個掛規則)。
- **現況問題**:每則通過觀察期且檢舉數達標的回應固定發 10 代幣,責任完全在「則數」,鼓勵刷量。

## 3. 範圍 (Scope)

**In scope**
- 加「每日 / 每張卡」發獎上限,封住刷量的經濟誘因。
- 發獎前置條件加上「語音須通過審核(若有語音)」與「回應字數 / 內容下限」。
- 後台新增一個總開關 `rewardsEnabled`,可一鍵停發(理念上的安全閥)。
- 把規則參數全部移到 `TokenRewardRule`,程式不再寫死。

**Out of scope(不要做)**
- 不刪除 `TokenTransaction` / `walletBalance` / 區塊鏈地址欄位。
- 不改提領流程(`src/lib/withdrawals.js`)。
- 不做任何鏈上互動。

## 4. 詳細實作步驟 (Implementation)

**Step 1 — 擴充規則模型**
`prisma/schema.prisma` 的 `TokenRewardRule` 新增(沿用既有型別風格):
```prisma
rewardsEnabled         Boolean @default(true)
dailyRewardCap         Int     @default(3)   // 每位 responder 每天最多被獎勵的回應數
perCardRewardCap       Int     @default(1)   // 同一張卡同一 responder 最多獎勵次數
minMessageLength       Int     @default(15)  // 回應文字最少字數才有資格
requireVoiceApproved   Boolean @default(true)
```
Migration:`npx prisma migrate dev --name extend_token_reward_rule` → `npx prisma generate`。

**Step 2 — 規則讀寫**
`src/lib/tokenRewards.js`:
- `DEFAULT_RULE` 補上新欄位預設值。
- `readTokenRewardRule` / `updateTokenRewardRule` 帶上新欄位(沿用現有 `ensureDecimal` / `getPositiveInteger` 風格,新增 `getNonNegativeInteger` 與 `getBoolean` helper)。

**Step 3 — 發獎資格判斷(核心)**
找到實際「結算 / 發獎」的函式(在 `tokenRewards.js` 或呼叫它的排程 / API;先 grep `tokensAwarded`、`isSettled`、`rewardStatus` 找出落點)。在發獎前依序檢查,任一不過就**不發且 `rewardStatus = BLOCKED`**(沿用既有 enum,line 237):
1. `rule.rewardsEnabled === true`。
2. 回應 `message` 去除空白後長度 ≥ `minMessageLength`。
3. 若有 `voiceUrl` 且 `rule.requireVoiceApproved`,則 `voiceModerationStatus === 'APPROVED'`(PRD-001 欄位;若 PRD-001 尚未做,這條用 feature flag 跳過 —— 見 Guardrails)。
4. 該 responder 當日(UTC 日界)已 `REWARDED` 的回應數 < `dailyRewardCap`。
5. 該 responder 在這張卡已 `REWARDED` 的回應數 < `perCardRewardCap`。

**Step 4 — 後台 UI**
在掛 `TokenRewardRule` 的 admin 頁加上新欄位的表單控制(toggle / number input),沿用該頁既有的儲存 action,呼叫 `updateTokenRewardRule`。`rewardsEnabled` 要明顯(例如紅色警示文字「關閉後將停止所有代幣發放」)。

**Step 5 — 不破壞既有資料**
- 既有已 `REWARDED` 的回應**不回溯重算**。
- 新規則只作用在「尚未結算(`isSettled = false`)」的回應。

## 5. 資料模型變更摘要

- `TokenRewardRule` +5 欄位,一個 migration `extend_token_reward_rule`。
- 不動 `PrayerResponse` 結構(沿用既有 `rewardStatus`)。

## 6. 驗收標準 (Acceptance Criteria)

1. Migration applied; `npx prisma generate` succeeds; `npm run build` passes.
2. With `rewardsEnabled = false`, no new response ever reaches `rewardStatus = REWARDED`; they end up `BLOCKED`.
3. A response with `message` shorter than `minMessageLength` never gets rewarded (ends `BLOCKED`).
4. After a responder has `dailyRewardCap` rewarded responses in one UTC day, the next eligible one is `BLOCKED`, not `REWARDED`.
5. A second response by the same user on the same card exceeding `perCardRewardCap` is `BLOCKED`.
6. Admin settings page can read and persist all 5 new fields; reload shows the saved values.
7. Pre-existing `REWARDED` responses are unchanged (no balance recalculation) — verify a known row before/after.
8. `walletBalance`, `TokenTransaction`, withdrawal flow untouched (no diffs in `src/lib/withdrawals.js`).
9. `npm run lint` + `npm run build` pass.
10. `git diff --name-only` contains only: `schema.prisma`, one migration dir, `src/lib/tokenRewards.js`, the admin settings page/action, and (if used) `src/lib/featureFlags.js`.

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ❌ 不要「順手」移除或停用代幣系統 —— 只加防護與開關。
- ❌ 不要回溯重算既有餘額或交易。
- ⚠️ Step 3 第 3 點依賴 PRD-001 的 `voiceModerationStatus`。**若該欄位尚不存在**,用 `src/lib/featureFlags.js` 加一個 `VOICE_MODERATION_GATING`(預設 false)把該條件包起來,而不是讓 build 失敗。在回報中明確說明你走了哪條路。
- ✅ 所有 cap / 開關一律從 `TokenRewardRule` 讀,**不可寫死**在判斷式裡。
- ✅ 「當日」以 UTC 日界計算,與既有時間欄位一致。
