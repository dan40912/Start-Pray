# PRD-006 — 雙資料模型整併 (Dual Data-Model Consolidation)

- 階段：**P1**
- 狀態：未開始
- 依賴：建議在 PRD-004/005 之前或同期做完,因為它們都查回應關聯。
- 對應風險：`PrayerRequest`(舊)與 `HomePrayerCard`(新)並存,`PrayerResponse` 兩邊都能掛,長期是 bug 與混亂來源。文件本身要反覆提醒「不要誤用」就是警訊。

---

## 1. 目標 (Goal)

把舊 `PrayerRequest` 流程**安全收斂**到 `HomePrayerCard`,讓 `PrayerResponse` 只需掛一種父層。
**本期目標是「凍結 + 遷移資料 + 標記淘汰」**,不是立刻 `DROP TABLE`(降低 Codex 一刀切造成資料遺失的風險)。

## 2. 背景與現況 (Background)

- `PrayerRequest`(`schema.prisma` line 51):舊代禱請求模型,有 `slug / title / description / status / owner / responses`。
- `HomePrayerCard`(line 199):現行主模型。
- `PrayerResponse`(line 68):同時有 `prayerRequestId` 與 `homeCardId` 兩個可空外鍵。
- 仍引用舊模型的地方(需 Codex 先 grep 確認):`src/components/PrayerRequestActions.jsx`、`src/app/api/prayers`、`src/app/api/prayfor`、可能的 admin `prayfor` 頁。

## 3. 範圍 (Scope)

**In scope**
- 盤點所有 `PrayerRequest` 的讀寫點,產出清單(寫進本 PRD 的「盤點結果」區塊回報)。
- 寫一支**冪等的遷移腳本**,把仍有價值的 `PrayerRequest` 轉成 `HomePrayerCard`,並把其 `PrayerResponse.prayerRequestId` 改掛到對應的 `homeCardId`。
- 在 schema 對 `PrayerRequest` 加棄用註解;前台/建立流程不再產生新的 `PrayerRequest`。

**Out of scope(本期嚴禁)**
- ❌ **不要 drop `prayerrequest` 表、不要刪 `PrayerResponse.prayerRequestId` 欄位。** 留待資料驗證無誤後的後續 PRD。
- ❌ 不改代幣 / 審核邏輯。

## 4. 詳細實作步驟 (Implementation)

**Step 0 — 盤點(先做,先回報)**
`grep -rn "prayerRequest\|PrayerRequest\|prayerrequest" src/ prisma/`,列出每個讀寫點與其作用,貼進回報。**在你確認盤點完整前,不要改任何程式。**

**Step 1 — 遷移腳本(新檔,冪等)**
`scripts/migrate-prayerrequest-to-homecard.js`(沿用 `scripts/` 既有風格,如 `seed-prayers.js`):
- 對每個尚未遷移的 `PrayerRequest`:建立對應 `HomePrayerCard`(map title/description/owner;分類用預設或 fallback category;`createdAt` 沿用)。
- 在來源 `PrayerRequest` 記錄對應的新 `homeCardId`(可用一個臨時 mapping 表或在 `meta` 註記;**不要刪來源**)。
- 把該 `PrayerRequest` 的每筆 `PrayerResponse`:set `homeCardId = 新卡 id`,**保留** `prayerRequestId`(回溯用)。
- 冪等:重跑不可產生重複卡(用 mapping 判斷已遷移者跳過)。
- 支援 `--dry-run`,先印出將建立 / 變更的筆數而不寫入。

**Step 2 — 凍結新建**
- 找出仍會「建立」`PrayerRequest` 的程式路徑,改成不再新建(或導向 `HomePrayerCard` 流程)。讀取舊資料的頁可暫時保留以相容。

**Step 3 — schema 標記棄用**
在 `schema.prisma` 的 `PrayerRequest` 上方加註:
```prisma
/// @deprecated 由 HomePrayerCard 取代,僅供歷史資料相容,勿用於新流程。見 PRD-006。
```
(Prisma 三斜線註解,不影響 migration。)

**Step 4 — 文件**
更新 `PROJECT_GUIDE.md` 特殊名詞表:標明 `PrayerRequest` 已凍結、遷移腳本位置、後續刪除待另開 PRD。

## 5. 資料模型變更

- **不刪欄位、不刪表。** 只加 Prisma 註解(無 migration 必要,但若你的 prisma 版本把註解視為 schema drift,產出一個 no-op / comment-only migration 並註明)。
- 資料變更全靠**腳本**,不靠 destructive migration。

## 6. 驗收標準 (Acceptance Criteria)

1. 盤點清單已產出並列在回報中,涵蓋所有 `PrayerRequest` 讀寫點。
2. `node scripts/migrate-prayerrequest-to-homecard.js --dry-run` prints counts and writes nothing.
3. Running the script for real: every legacy `PrayerRequest` with content has a corresponding `HomePrayerCard`; counts match dry-run.
4. After migration, every `PrayerResponse` that had a `prayerRequestId` now also has a valid `homeCardId`; `prayerRequestId` is still present (not nulled).
5. Re-running the script is idempotent: no duplicate `HomePrayerCard` rows created on the 2nd run.
6. The `prayerrequest` table and `PrayerResponse.prayerRequestId` column **still exist** (this PRD does not drop them) — verify via `npx prisma db pull` or DB inspection.
7. No code path creates a new `PrayerRequest` anymore; legacy read pages still render without error.
8. `PrayerRequest` carries the `@deprecated` doc comment; `PROJECT_GUIDE.md` updated.
9. `npm run lint` + `npm run build` pass.
10. The migrated cards appear correctly on `/prayfor` with their responses attached.

## 7. 給 Codex 的防錯提醒 (Guardrails)

- 🚨 **最高風險 PRD。** 任何 `DROP`、`DELETE`、把欄位設 `nullable→removed`、或刪表的動作都**禁止**。本期只做「複製 + 改掛 + 標記」。
- ✅ 一定先跑 `--dry-run` 並把數字貼出來,等於請使用者過目後再實跑。
- ✅ 遷移腳本必須冪等且可重跑。
- ⚠️ 動資料前先確認有 DB 備份(在回報中提醒使用者備份;見 `PROD_DB_MIGRATION_RUNBOOK.md`)。
- ❌ 不要在這個 PRD 裡順手改代幣或審核邏輯。
