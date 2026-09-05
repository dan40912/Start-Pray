---
tags: [start-pray, design, voice, customer-portal]
---

# 禱告卡語音留言（Card Voice Message）

> 對應工作目錄中**尚未提交**的改動（截至 `c6b5b7d` 之後）。這是目前唯一還沒進入任何 Commit 的產品程式碼。

## 一句話說明
讓**卡片擁有者（已登入的 customer）**在建立／編輯自己的禱告卡時，錄一段最長 3 分鐘的語音留言，上傳後存成 `HomePrayerCard.voiceHref`。

## 與既有錄音功能的區別（重要）
專案裡現在有**三套**與錄音有關的東西，語意完全不同，不要混淆：

| 元件 | 使用者 | 寫入對象 | 長度上限 | 是否需登入 |
|---|---|---|---|---|
| `VoicePrayerOverlay.js`（既有） | 登入會員 | `PrayerResponse` | 依既有設定 | 需要 |
| `prayer-recorder/PrayerRecorder.js`（[[21-Recorder-State-Machine]]） | 匿名訪客 | `PrayerResponse`（我為你禱告） | 60s（`MAX_DURATION_SECONDS`） | 不需要 |
| `prayer-recorder/CardVoiceRecorder.js`（**本次新增**） | 卡片擁有者 | `HomePrayerCard.voiceHref` | 180s（`MAX_VOICE_DURATION_SECONDS`） | 需要 |

**這是「需求方自己說明代禱事項」的語音，不是「別人為你禱告」的回應。**

## 改動清單

### 新增
- `src/components/prayer-recorder/CardVoiceRecorder.js`（478 行）
  受控元件，介面為 `{ value, onChange, onUploadingChange, disabled }`。錄完 → 上傳 → 只把**已上傳的 URL** 透過 `onChange` 交還父表單；卡片本身的建立／更新仍走原本的 JSON payload，未改動。
- `src/app/api/customer/cards/voice/route.js`（77 行）
  `POST /api/customer/cards/voice`，multipart `audio` 欄位。刻意**比照 `src/app/api/customer/story-audio/route.js`** 的 auth／驗證／儲存模式，只換資料夾層級（`voices/prayer-cards/<userId>/`）。
- `tests/card-voice-recorder.test.mjs`（3 tests）
  常數守門：`MAX_VOICE_DURATION_SECONDS === 180`、且必須嚴格大於匿名回應的 60s、`MAX_VOICE_FILE_BYTES === 15MB`。防止有人只調其中一個常數。

### 修改
- `src/components/prayer-recorder/usePrayerRecorder.js`
  Hook 由 `usePrayerRecorder()` 改為 `usePrayerRecorder({ maxDurationSeconds = MAX_DURATION_SECONDS } = {})`。**預設值即原本的 60s，既有呼叫端（`PrayerRecorder.js`）零行為變更**；`CardVoiceRecorder` 傳入 180s。
- `src/app/customer-portal/create/page.js`
  `INITIAL_FORM` 新增 `voiceHref`；送出時 `voiceHref` 由寫死的 `""` 改為 `form.voiceHref.trim()`；錄音器只在 `authUser?.id` 存在時渲染（訪客建卡不提供）；送出按鈕新增 `isUploadingVoice` 阻擋。
- `src/app/customer-portal/edit/[id]/page.js`
  於描述欄下方插入錄音器，載入既有 `voiceHref` 時直接顯示為「已附加」；儲存按鈕新增 `isUploadingVoice` 阻擋。

## 設計決策

### DEC-A：重用 `usePrayerRecorder`，但**不**重用 `PrayerRecorder.js`
`PrayerRecorder` 的送出流程寫死 `POST /api/responses` 與匿名專屬欄位，語意不適用於卡片語音。因此只重用「錄音引擎」（權限／倒數／錄音／預覽／重錄／清理狀態機），UI 與送出邏輯另寫。
→ 與 [[25-Companion-Mode-Reuse-Audit]] 的判準一致：重用狀態機，不重用被特定 API 綁死的元件。

### DEC-B：以「參數化預設值」擴充 Hook，而非 fork
`maxDurationSeconds` 走預設參數，讓既有匿名流程不需要任何修改，也避免出現第二份幾乎相同的錄音 Hook。風險是兩個上限常數分散在兩處，因此補上 `tests/card-voice-recorder.test.mjs` 做守門。

### DEC-C：上傳與建卡分離（兩段式）
語音先獨立上傳取得 URL，再由表單一起送出。好處是不必改動既有 `POST /api/home-cards` 與 `PATCH /api/customer/cards/[id]` 的 JSON 契約（兩者本來就已接受 `voiceHref`）。代價是**使用者取消建卡時，已上傳的音檔會成為孤兒檔案**（見下方風險）。

### DEC-D：僅限登入者
新 API 走 `requireSessionUser()` + `ensureActiveCustomer()`，並回傳 401 / 403 / 503（媒體儲存未設定）。訪客建卡路徑上不顯示錄音器——**與匿名化的產品方向相反，但這是 customer-portal（既有會員後台），不在 [[07-Target-MVP]] 匿名首頁範圍內**。

## 已知缺口 / 風險
1. **完全沒有 CSS**：`card-voice-recorder*` 這些 class 在整個 repo 中**沒有任何樣式定義**，目前是瀏覽器預設外觀。上版前必須補樣式。
2. **孤兒音檔**：DEC-C 的必然結果——上傳成功但表單未送出／使用者按「移除」時，伺服器上的檔案不會被刪除。無清理機制。
3. **Ephemeral filesystem**：與 [[19-Security-Review]] 已標記的 Production Blocker 同一個問題——`writeFile` 寫本機磁碟，在 serverless／容器重啟後檔案消失。此功能沿用同一個儲存層，因此**繼承同一個 Blocker**。
4. **無 moderation**：`voiceModeration.js` 的常數被引用來當上限，但這條上傳路徑**沒有呼叫任何審核流程**；卡片語音不會進入既有的 `PrayerResponse` moderation 佇列。
5. **Real microphone Not Tested**：與先前所有錄音改動相同的環境限制。
6. **未提交**：改動仍在工作目錄，尚未 lint／build／`npm run test:unit` 全量驗證紀錄。

## 相關文件
[[21-Recorder-State-Machine]]｜[[25-Companion-Mode-Reuse-Audit]]｜[[19-Security-Review]]｜[[12-Change-Log]]｜[[13-Risk-Register]]｜[[03-Current-Feature-Inventory]]
