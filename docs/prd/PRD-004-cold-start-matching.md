# PRD-004 — 冷啟動與代禱媒合 (Cold-Start & Prayer Matching)

- 階段：**P1**
- 狀態：未開始
- 依賴：無(但與 PRD-006 資料整併相關,建議排在其後或同期)
- 對應風險：平台的初衷是「需要被禱告的人得不到回應」,但平台本身一樣會有 —— 一張卡丟出去沒人回,比群組一句「阿們」更傷。

---

## 1. 目標 (Goal)

確保**每一張公開代禱卡都會被看見、被回應**,而不是只有熱門卡被洗版、冷門卡石沉大海。
做法:在禱告牆上提供「最需要被禱告」的入口,優先曝光「回應數少 / 較久未被回應」的卡。

## 2. 背景與現況 (Background)

- 禱告牆資料:`src/lib/homeCards.js`,API `src/app/api/home-cards/route.js`(`GET` 支援搜尋、分類篩選)。
- 前台牆頁:`src/app/prayfor/page.js`,瀏覽元件 `src/components/HomePrayerExplorer.js`。
- 卡片模型 `HomePrayerCard`(`schema.prisma` line 199),有 `responses` 關聯。
- **現況**:列表預設多以時間 / 分類排序,無「被回應程度」維度,新卡或冷門卡容易被埋。

## 3. 範圍 (Scope)

**In scope**
- 新增一種排序/篩選:`needsPrayer`(最需要被禱告)= 依「公開回應數遞增、最後回應時間越久越前」。
- 禱告牆新增一個明顯的分頁/切換:「最新 / 熱門 / 最需要陪伴」。
- 卡片上顯示輕量的「目前 N 人代禱 / 還沒有人代禱」狀態,鼓勵第一個回應。

**Out of scope(不要做)**
- ❌ 不做自動 email / 推播通知(另開 PRD)。
- ❌ 不做演算法式個人化推薦。
- ❌ 不改建立卡片流程。

## 4. 詳細實作步驟 (Implementation)

**Step 1 — 查詢層**
`src/lib/homeCards.js`:
- 新增 `listHomeCards` 的 `sort` 參數,支援 `latest`(現有預設)、`popular`、`needsPrayer`。
- `needsPrayer` 排序鍵:先依「已公開回應數(approved / 非 blocked)」**遞增**,再依「最後一則回應時間」**越舊越前**;完全沒回應的排最前。
- 只計入公開可見的回應(排除 `isBlocked = true`;若 PRD-001 已上線,語音待審不影響「回應數」計算,因為文字仍在 —— 以回應「則數」為準)。
- 用 Prisma `_count` on `responses` 取回應數;若排序需要在 DB 端做,評估用 raw query 或先抓候選再排序(資料量小時可記憶體排序,但要分頁安全 —— 見 Guardrails)。

**Step 2 — API**
`src/app/api/home-cards/route.js` 的 `GET`:
- 讀 `sort` query param,白名單驗證(只接受三個值,其他 fallback `latest`)。
- 回應每張卡附 `responseCount`、`lastRespondedAt`(可為 null)。

**Step 3 — 前台**
`src/components/HomePrayerExplorer.js`(+ `src/app/prayfor/page.js`):
- 加排序切換 UI(三個 tab/chip),預設「最新」。
- 切換時帶 `?sort=` 重新查詢;保留現有搜尋/分類篩選共存。
- 卡片角落顯示狀態徽章:`responseCount === 0` → 「還沒有人代禱 · 成為第一個」;否則「N 人正在代禱」。文案走 i18n。

**Step 4 — 文案**
i18n 補 `explorer.sort.latest / popular / needsPrayer`、`card.noResponseYet`、`card.responseCount`。

## 5. 資料模型變更

- **無 schema 變更**(用既有 `responses` 關聯與 `_count`)。
- 若效能需要,**可選**加 DB index;若要加,單獨在 PRD 回報並用獨立 migration,不要夾帶其他改動。

## 6. 驗收標準 (Acceptance Criteria)

1. `GET /api/home-cards?sort=needsPrayer` returns cards ordered with zero-response cards first, then by oldest `lastRespondedAt`.
2. `sort=latest` reproduces the current default ordering (no regression).
3. `sort=popular` orders by highest response count.
4. Invalid `sort` value falls back to `latest` without error.
5. Search + category filters still work in combination with each `sort` value.
6. Each card in the response payload includes `responseCount` (number) and `lastRespondedAt` (ISO string or null).
7. The prayer wall UI shows three sort tabs; default is 最新; switching updates the list and the URL query.
8. A card with no responses shows the「成為第一個」badge; a card with responses shows the count.
9. Blocked responses are excluded from `responseCount`.
10. `npm run lint` + `npm run build` pass; pagination still works on every sort mode (no duplicate/missing cards across pages).

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ⚠️ **分頁正確性最容易錯**:如果用「記憶體排序」務必先確認資料量;正式做法應在 DB 層排序 + 分頁。若你不確定資料量,**用 Prisma orderBy + `_count` 在 DB 端排序**,不要抓全表進記憶體。
- ❌ 不要動建立卡片或回應的流程。
- ❌ 不要加通知 / email。
- ✅ `sort` 一定要白名單驗證,避免注入或非預期排序欄位。
- ✅ 排序定義以本文件為準:zero-response 最前,其次最久未回應。
