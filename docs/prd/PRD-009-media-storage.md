# PRD-009 — 媒體儲存可擴展性 (Media Storage Scalability)

- 階段：**P2**
- 狀態：未開始
- 依賴：無;與既有 `media:migrate` 腳本相關。
- 對應風險：語音 / 圖片存本地 `public/uploads`、`public/voices`,隨成長線性吃磁碟、無備援、難水平擴展。

---

## 1. 目標 (Goal)

把媒體讀寫**抽象到一個 storage 介面**之後,使「本地檔案系統」與「物件儲存(S3 相容)」可由設定切換。
**本期只做抽象層 + 設定切換 + 文件**,預設仍用本地,**不強制接雲端**(避免 Codex 亂接金鑰 / 產生費用)。

## 2. 背景與現況 (Background)

- 儲存 helper:`src/lib/server-media-storage.js`;URL helper:`src/lib/media-url.js`。
- 上傳:`src/app/api/upload-image/route.js`;語音相關 `src/lib/server-audio.js`。
- 對外讀取路由:`src/app/uploads/[...path]`、`src/app/voices/[...path]`。
- 既有遷移腳本:`scripts/migrate-media-to-storage.js`、稽核 `scripts/audit-missing-media.js`(`npm run media:migrate` / `media:audit`)。
- 既有 runbook:`MEDIA_STORAGE_RUNBOOK.md`。
- **現況**:邏輯與「本地路徑」耦合,換儲存後端需改多處。

## 3. 範圍 (Scope)

**In scope**
- 定義 storage 介面 `put / get / delete / getPublicUrl`,把現有本地實作收進 `LocalStorageDriver`。
- 由環境變數選 driver(預設 `local`)。
- 預留 `ObjectStorageDriver` 的**骨架 + 介面**,但不填實際 SDK 呼叫(留 TODO 與設定說明)。
- 更新 `MEDIA_STORAGE_RUNBOOK.md` 說明切換方式。

**Out of scope(本期嚴禁)**
- ❌ 不 `npm install` AWS SDK 或任何雲端 SDK。
- ❌ 不填入 / 不要求任何雲端金鑰。
- ❌ 不改變預設行為(預設必須仍是本地,既有上傳/讀取完全照舊)。

## 4. 詳細實作步驟 (Implementation)

**Step 1 — 介面**
新增 `src/lib/storage/index.js`:
```js
// 介面:所有 driver 必須實作
// put({ buffer, key, contentType }) -> { key }
// getPublicUrl(key) -> string
// delete(key) -> void
// exists(key) -> boolean
export function getStorageDriver() { /* 依 env 回傳 driver 單例 */ }
```
env：`MEDIA_STORAGE_DRIVER`(`local` | `object`,預設 `local`)。`.env.example` 補上此變數與註解。

**Step 2 — Local driver**
`src/lib/storage/localDriver.js`:把 `server-media-storage.js` 現有的本地寫檔 / 路徑 / URL 邏輯搬進來實作介面。`server-media-storage.js` 改為**薄包裝**呼叫 `getStorageDriver()`,對外簽名不變(避免動到呼叫端)。

**Step 3 — Object driver 骨架**
`src/lib/storage/objectDriver.js`:實作同介面,但方法內 `throw new Error('ObjectStorageDriver not configured — see MEDIA_STORAGE_RUNBOOK.md')` 或讀 env 後留 `// TODO: integrate S3-compatible SDK`。**不引入 SDK。**

**Step 4 — 讀取路由**
`src/app/uploads/[...path]`、`src/app/voices/[...path]`、`media-url.js`:改用 `getStorageDriver().getPublicUrl(...)`,使日後切 driver 時 URL 自動正確。本地 driver 行為與現在一致。

**Step 5 — 文件**
更新 `MEDIA_STORAGE_RUNBOOK.md`:說明 `MEDIA_STORAGE_DRIVER`、兩個 driver 的差異、未來接物件儲存要補什麼、既有 `media:migrate` 腳本如何配合。

## 5. 資料模型變更

- **無**。資料庫仍存相對 key / 路徑;不改 schema。

## 6. 驗收標準 (Acceptance Criteria)

1. With `MEDIA_STORAGE_DRIVER` unset or `local`, image upload via `/api/upload-image` works exactly as before and the file lands in `public/uploads`.
2. Existing images and voices still load through `/uploads/[...path]` and `/voices/[...path]` with no behavior change.
3. `server-media-storage.js` public function signatures are unchanged (no caller had to be modified for the local path).
4. Setting `MEDIA_STORAGE_DRIVER=object` and attempting an upload throws the documented "not configured" error (proving the switch is wired) — and switching back to `local` restores normal operation.
5. No cloud SDK added (`git diff package.json` shows no new dependency).
6. `.env.example` documents `MEDIA_STORAGE_DRIVER`.
7. `MEDIA_STORAGE_RUNBOOK.md` updated with switching instructions and the object-storage TODO.
8. `npm run media:audit` still runs without crashing.
9. `npm run lint` + `npm run build` pass.
10. `git diff --name-only` limited to: new `src/lib/storage/*`, `server-media-storage.js`, `media-url.js`, the two read routes, `.env.example`, and the runbook.

## 7. 給 Codex 的防錯提醒 (Guardrails)

- 🚨 **預設行為不可變。** 沒設 env 時,一切跟現在一模一樣。這是最重要的驗收點(#1, #2)。
- ❌ 不要 `npm install` 任何雲端 SDK,不要硬接 S3。本期只做介面與骨架。
- ❌ 不要改資料庫存的路徑格式 / 不動 schema。
- ✅ `server-media-storage.js` 對外簽名保持不變,只把內部換成呼叫 driver。
- ⚠️ 動到媒體前確認沒有破壞既有檔案讀取(跑驗收 #2 抽查現有圖片 / 語音)。
