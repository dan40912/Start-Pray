# PRD-XXX — <功能名稱> (<English Name>)

> 複製這份檔案,改名為 `PRD-0XX-<short-slug>.md`,填完後加進 `roadmap.md` 的表格並指定階段(P0/P1/P2)。
> 寫 PRD 的黃金原則:**寫到讓一個容易出錯的 agent 也無從自由發揮**。具體檔案路徑、具體欄位名、具體門檻數字、可驗證的驗收標準。

- 階段：P?
- 狀態：未開始
- 依賴：<其他 PRD 編號,或「無」>
- 對應問題 / 動機：<這個功能要解決什麼?一句話>

---

## 1. 目標 (Goal)
<一兩句話講清楚「做完後世界有什麼不同」。給一個可判斷的成功定義。>

## 2. 背景與現況 (Background)
<列出相關的**現有檔案路徑**(API route、lib helper、component、schema model 與行號)。Codex 沒有你腦中的脈絡,這段越具體越不會走偏。>

## 3. 範圍 (Scope)
**In scope**
- <要做的事,逐條>

**Out of scope(不要做)**
- ❌ <明確列出「不准做」的事 —— 這比 in-scope 更能防止 agent 暴衝>

## 4. 詳細實作步驟 (Implementation)
> 拆成有序的 Step,每步講動哪個檔、加什麼。會動到的新檔請寫出**完整路徑**。

**Step 1 — <子任務>**
<具體做法。若涉及程式介面,直接給 function 簽名 / 欄位定義範例。>

**Step 2 — ...**

## 5. 資料模型變更 (Schema Changes)
<若動 Prisma:列出新增/修改的欄位與 enum、migration 名稱(固定命名)。明確寫「不刪什麼」。若無變更寫「無」。>

## 6. 驗收標準 (Acceptance Criteria)
> 每條都要**可被客觀驗證**(指令輸出、HTTP 狀態碼、畫面行為)。Codex 完成後須逐條回報 PASS/FAIL。

1. <criterion>
2. ...
9. `npm run lint` + `npm run build` pass.
10. `git diff --name-only` 僅含本 PRD 第 4 節列出的檔案。

## 7. 給 Codex 的防錯提醒 (Guardrails)
- ❌ <最容易做錯 / 暴衝的事>
- ✅ <必須遵守的硬規則>
- ⚠️ <有條件 / 需停下來問的情況>
