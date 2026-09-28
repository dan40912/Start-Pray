# 批次 6A：同步字幕的決策、資料格式與 migration 草案

**日期：** 2026-09-28
**分支：** `codex/batch6a-caption-decisions`（獨立 worktree，基底 `main` = `43bea6b`）
**狀態：** 待 review。本階段**不改任何程式碼**、不動公開 API、不套資料庫。
**依據：** [`apple-fluid-motion-batches-2-6-handoff.md`](./apple-fluid-motion-batches-2-6-handoff.md) 批次 6A、[`apple-fluid-motion-plan.md`](./apple-fluid-motion-plan.md)
**與批次 1 的關係：** 無交集。6A 不碰 `GlobalPlayer.js`、`theme-modern.css`。

---

## 一、先講三件推翻既有前提的程式碼事實

這三件事會直接改變 6A 的方案，所以放最前面。

### 1. `VoiceWallPlayer` 是死碼，不是播放入口

交接文件與前一版計畫都把它列為「站上的語音播放不只一處」的其中一處。實際上：

```
$ grep -rn "VoiceWallPlayer" src/
src/components/prayer-detail/VoiceWallPlayer.js:63:  export default function VoiceWallPlayer(...)
src/components/prayer-detail/VoiceWallPlayer.js:108: console.error(...)
```

**沒有任何檔案 import 它。** 416 行、含自己的 `<audio>` 與 `setQueue([], -1)`。字幕方案不需要考慮它；它本身該另案清掉（不在 6A 範圍）。

### 2. 手機「手動補文字」的 UI 已經存在，不需要新做

`VoicePrayerOverlay.js:783` 的 `vpo-textarea` 是**無條件渲染**的，`value={vcTx}` + `onChange`。手機因為 `captionsOn === false` 不會自動填入，所以它現在就是一個空白的輸入框。

也就是說決策 1(b) 不是新功能，是**把既有欄位的標籤與說明講清楚**（桌面是「字幕可以修改」，手機得是「可以補一句文字，留空也能送出」）。

### 3. 現行程式碼正在「製造假的同步時間」—— 這是 6B 必須拔掉的一行

`handleSubmitVoice`（`VoicePrayerOverlay.js:611`）在使用者編輯過文字後，會依標點切句再**平均分配**時間戳：

```js
if (edited !== r.transcript) {
  const lines = edited ? edited.split(/[，。,.!?！？\n]+/).filter(Boolean) : [];
  r.segments = lines.map((t, i) => ({
    s: +((i * r.duration) / Math.max(lines.length, 1)).toFixed(1),
    e: +(((i + 1) * r.duration) / Math.max(lines.length, 1)).toFixed(1),
    t,
  }));
}
```

目前這些 segment 沒被送出所以無害。但在手機上，`r.transcript` 是空字串，使用者手打的任何文字都會走進這個分支 —— **一旦 6B 開始傳遞 segments，手打的文字就會被配上完全虛構的時間**。這正是交接文件第 1 條禁止的事。決策見 §三.2。

---

## 二、已核對的程式碼事實

| 項目 | 事實 | 位置 |
| --- | --- | --- |
| 手機不啟用辨識 | `captionsOnRef.current = Boolean(SRRef.current) && !isMobileBrowser()`。理由：辨識會第二次開麥克風，Android 系統辨識器獨占輸入會讓**錄音本身變無聲** | `VoicePrayerOverlay.js:86`、`recorder-utils.js:77-88` |
| 桌面片段來源 | `recog.onresult` 內 `push({ s, e, t })`，時間取自 `performance.now() - recStartMs`，即**辨識結果抵達時間**，非音訊解碼位置 | `VoicePrayerOverlay.js:291-305` |
| 片段目前被丟棄 | `onComplete(file, r.transcript)` 只傳攤平字串 | `VoicePrayerOverlay.js:630` |
| 字幕落地為 `message` | `submitResponse({ audioOverride: file, textOverride: transcript \|\| "" })` | `Comments.js:436` |
| `message` 是必填 | `message String`（非 nullable） | `prisma/schema.prisma` PrayerResponse |
| 表名 | `@@map("prayerresponse")` —— migration SQL 要用這個名字，不是 `PrayerResponse` | 同上 |
| 文字限制 | `MAX_MESSAGE_LENGTH = 2000`；無音檔時 `MIN_MESSAGE_LENGTH_WITHOUT_AUDIO = 8` | `api/responses/route.js:30-40` |
| 送出頻率限制 | 會員 8 則／訪客 5 則（`RECENT_WINDOW_MINUTES = 10`），同卡冷卻 2 分鐘 | 同上 |
| 自動送審規則 | `moderationStatus = !session && (recentResponsesCount >= 3 \|\| linkCount >= 2) ? "PENDING" : "APPROVED"`，`linkCount` 只數 `message` 裡的 `https?://` | `api/responses/route.js:287-290` |
| 公開 GET 的三道閘門 | `isBlocked: false`、`moderationStatus: "APPROVED"`、`voiceModerationStatus: { in: ["APPROVED", "NOT_APPLICABLE"] }` | `api/responses/[homeCardId]/route.js` |
| 卡片層 | 卡片 `isBlocked` 或 `isPrivate` → 整個 404 | 同上 |
| 帳號封鎖**沒有**被過濾 | `responder.isBlocked` 有被 `select`，但 `where` 完全沒有用到它 | 同上 |
| 公開序列化是**黑名單** | `toPublicPrayerResponse` 用 `delete` 拔掉 `guestSessionHash`／`ipHash`／`moderationStatus`。真正的白名單是查詢層的 `SAFE_RESPONSE_SELECT` | `lib/anonymous-prayer-avatar.js` |

> **這一條特別重要：** 因為序列化是黑名單，新欄位只要被加進 `SAFE_RESPONSE_SELECT` 就會直接出現在公開回應裡。控制點只有那一個 select，6B 的 review 要盯著它。

---

## 三、六個決策

### 決策 1：手機不重啟辨識；手動補文字為選填

**採用交接文件的預設。** 手機維持 `captionsOn === false`。不得為了取得字幕而在手機重新開啟 `SpeechRecognition` —— 那是用遺失真人錄音的風險換一個顯示效果。

- 手機錄完 → 確認畫面出現空白文字框，文案明說「可以補一句文字，留白也能直接送出」。
- 沒補 → `transcriptJson = NULL`，純語音照常送出，播放端顯示「這段語音沒有文字」。
- 有補 → 存為**無時間的完整文字**（見 §四格式 `kind: "manual"`），不做逐句同步。

伺服器或第三方 STT：**不在本批範圍**（費用、隱私、把真人語音外送第三方，需要獨立提案）。

### 決策 2：只有通過合理性檢查的桌面片段才同步；手動文字一律不同步

桌面片段可以保留，但時間只是近似（§二）。因此：

- **拔掉**「編輯後依標點平均分配時間」那段邏輯（§一.3）。使用者一旦編輯過文字，桌面片段的對應關係就已經不可信 → 降級為 `kind: "manual"`。
- 只有**未經編輯**且通過 §七 合理性檢查的辨識片段才存成 `kind: "asr"` 並做逐句 highlight。
- 任一檢查不過 → 存成 `kind: "manual"`（保留文字，丟掉時間），或整筆 `NULL`。**寧可沒有同步，不要錯的同步。**

### 決策 3：只有沉浸畫面做逐句同步；其他入口一律提供完整文字

第一階段逐句 highlight 只做 `GlobalPlayer` 沉浸畫面（唯一的自訂播放 UI）。其餘入口用原生 `<audio controls>`，沒有掛點，但**完整文字必須看得到**，不能因為沒有自訂播放器就讓字幕消失。詳見 §六。

讀屏順序：**先確保完整文字是可讀的靜態內容**（這是 PRD-010 的可存取性條件，不做同步也要成立），再評估是否需要播報當前句。不直接照搬 POC 的 `aria-live="polite"` —— 每句都播報會反覆打斷閱讀。

### 決策 4：格式用 `{start, end, text}`，秒為單位

見 §四。統一採 PRD-010 §28 的命名；錄音端現產的 `{s, e, t}` 在**送出邊界**轉換一次，站上不並存兩種格式。

### 決策 5：字幕文字與 `message` 的關係 —— 同一段文字，不是第二個自由欄位

**這是最需要 review 拍板的一條。** 兩個選項：

| | A：字幕文字 = `message`（建議） | B：字幕獨立於 `message` |
| --- | --- | --- |
| 儲存 | `message` 照舊存攤平文字；`transcriptJson` 只存**時間切分**，其 `text` 必須是 `message` 的切片 | `transcriptJson.text` 可與 `message` 不同 |
| 審核 | 沿用既有的長度／連結／PENDING 規則，**零繞過風險** | 必須為第二個欄位重做一整套檢查 |
| 現行相容 | 與目前「辨識結果當成 `message` 送出」完全一致 | 要改變既有回應的顯示語意 |
| 風險 | 切片必須驗證確實來自 `message`，否則等於 B | 多一個能繞過 `linkCount` 與 2000 字上限的公開文字欄位 |

**建議採 A。** 理由：`linkCount` 只數 `message`（`api/responses/route.js:287`），若字幕是獨立文字欄位，貼連結的內容可以完全避開自動送審。採 A 之後，伺服器只要驗證「所有 segment 的 `text` 串接後等於 `message` 的正規化形式」，就自動繼承全部既有規則。

### 決策 6：公開邊界照現況，不順手改政策

公開 GET 必須同時滿足：卡片非 `isPrivate`、卡片非 `isBlocked`、回應 `isBlocked: false`、`moderationStatus: "APPROVED"`、`voiceModerationStatus ∈ {APPROVED, NOT_APPLICABLE}`。字幕**跟著完全相同的條件**輸出，不另開通道。

兩點要說清楚、不要寫成既有保障：

1. **`NOT_APPLICABLE` 是為舊資料開的門**（程式碼註解明載）。新回應不會拿到它。字幕只在 `APPROVED` 時輸出會更嚴格，但會讓舊的純文字回應連帶看不到字幕 —— 由於舊回應本來就沒有 `transcriptJson`，實務上無差異，**建議沿用既有的 `in` 條件**以免引入不一致。
2. **帳號被封鎖（`responder.isBlocked`）目前不是過濾條件。** 公開 GET 會照常輸出被封鎖帳號的回應（僅在匿名時隱藏身分）。這是**現況**，不是字幕造成的。6A 不改它，但把它列為未決事項 §十.1，因為「封鎖的回應」與「封鎖的回應者」是兩件事，值得產品面決定。

---

## 四、資料格式

### 欄位

```prisma
/// 逐句字幕。NULL = 這段語音沒有文字（手機未補字、辨識失敗、純語音）。
transcriptJson        Json?
/// 字幕的來源與可信度，決定播放端要不要做逐句同步。
transcriptStatus      TranscriptStatus?
/// 音檔長度（秒）。同時是字幕時間的上界檢查依據。
audioDurationSeconds  Float?
```

```prisma
enum TranscriptStatus {
  ASR_SYNCED   // 桌面辨識、未經編輯、通過合理性檢查 → 可逐句同步
  MANUAL_TEXT  // 手動輸入或編輯過 → 只有文字，不同步
  NONE         // 明確沒有文字（保留給「曾經嘗試但失敗」與 NULL 區分）
}
```

### JSON 形狀

```json
{
  "version": 1,
  "kind": "asr",
  "segments": [
    { "start": 0.0, "end": 2.4, "text": "願主賜你力量" },
    { "start": 2.4, "end": 5.8, "text": "陪你走過這段治療" }
  ]
}
```

四種狀態的表示法：

| 情況 | `transcriptJson` | `transcriptStatus` | `message` |
| --- | --- | --- | --- |
| 桌面辨識、未編輯、檢查通過 | `{version:1, kind:"asr", segments:[…]}` | `ASR_SYNCED` | 片段串接後的文字 |
| 桌面辨識但使用者編輯過 | `{version:1, kind:"manual", segments:[]}` | `MANUAL_TEXT` | 編輯後的文字 |
| 手機手動補字 | `{version:1, kind:"manual", segments:[]}` | `MANUAL_TEXT` | 手打的文字 |
| 手機沒補字／辨識失敗／純語音 | `NULL` | `NULL` | `""`（現行允許：有音檔時 message 可為空） |
| **2026-09-28 之前的所有舊回應** | `NULL` | `NULL` | 原值不動 |

`kind: "manual"` 仍寫 `segments: []` 而不是省略，讓播放端只需判斷陣列長度，不必分辨「沒有欄位」與「空陣列」。

---

## 五、資料流

```
[錄音端 VoicePrayerOverlay]
  桌面：SpeechRecognition → segments {s,e,t}（時間 = 辨識抵達時刻，近似）
  手機：captionsOn=false → 無 segments，textarea 空白供選填
        ↓ 使用者可編輯文字（編輯過 → 降級 manual，丟掉時間）
        ↓ onComplete(file, { text, segments, durationSeconds, kind })   ← 6B 要改的簽章
[Comments.handleVoiceComplete]
        ↓ submitResponse({ audioOverride, textOverride: text, transcript })
[POST /api/responses]
        ↓ 既有：message 長度／linkCount／頻率／音檔檢查
        ↓ 新增：§七 字幕驗證（不合格 → 降級 manual 或丟棄，不整筆拒絕）
        ↓ prisma.create({ message, voiceUrl, transcriptJson, transcriptStatus, audioDurationSeconds })
[GET /api/responses/[homeCardId]]
        ↓ 三道閘門（§決策 6）全過才把 transcriptJson 放進 SAFE_RESPONSE_SELECT 輸出
[播放端]
        沉浸畫面 → 逐句 highlight（僅 ASR_SYNCED）
        其他入口 → 完整文字（§六）
```

---

## 六、播放入口 × 完整文字的位置

已對 `src/` 做完整盤點（`<GainAudio` 與 `<audio` 全部出現點）。

**A. 走共用佇列 → `GlobalPlayer`（自訂 UI，可做同步）**

| 入口 | 檔案 |
| --- | --- |
| 首頁／禱告牆卡片播放 | `HomePrayerExplorer.js:357,366` |
| 詳情頁佇列 | `prayer-detail/DetailAudioQueueBootstrap.js:101,107` |
| 陪伴（沉浸）模式 | `prayer-interaction/usePrayerInteraction.js:87` |
| 全球禱告室抽屜 | `GlobalPrayerRoom.js:4586` |
| `PrayerAudioPlayer` | `PrayerAudioPlayer.js:83` |

→ **第一階段只有沉浸畫面做逐句同步**；底部播放列先不做（空間不足），但其來源回應在 B 區都有完整文字。

**B. 原生 `controls`（無同步掛點）—— 完整文字必須在這裡看得到**

| 入口 | 檔案 | 完整文字放哪 |
| --- | --- | --- |
| 回應清單的每則語音 | `Comments.js:601` | **主要位置**：音訊下方顯示 `message`（現行已顯示），標示為字幕來源 |
| 送出成功的「重聽」 | `Comments.js:632` | 自己剛錄的，沿用確認畫面已顯示的文字 |
| 首頁 hero 卡片語音 | `HomePrayerHero.js:346` | 卡片既有文字區 |
| 送出前預聽 | `VoicePrayerOverlay.js:772` | 確認畫面的 textarea 本身 |
| 錄音器預聽 | `CardVoiceRecorder.js:139,243`、`PrayerRecorder.js:509` | 送出前，尚無公開字幕 |

**C. 非代禱回應（不在字幕範圍）**

`admin/prayerresponse/page.js:608`、`admin/users/page.js:541`、`me/MyPrayersClient.js:1260,1753`、`overcomer/[slug]/page.js:145,284`（`storyAudioUrl`，不同模型）。

→ 但 **admin 審核頁需要看得到字幕文字**（§八），這是 6B 要補的一處。

**D. 死碼：** `prayer-detail/VoiceWallPlayer.js` —— 無人 import。

---

## 七、伺服器驗證規則（POST 端）

前端傳來的都當成不可信。以下任一不過 → **降級**（丟掉 segments，保留文字，`transcriptStatus = MANUAL_TEXT`），不整筆拒絕，避免使用者辛苦錄的音因為字幕格式問題而送不出去。

| # | 規則 | 不過的處置 |
| --- | --- | --- |
| 1 | 頂層必須是物件，`version === 1`，`kind ∈ {"asr","manual"}`，`segments` 是陣列 | 降級 |
| 2 | `segments.length <= 200` | 降級 |
| 3 | 每段 `text` 是字串且 `trim()` 後非空；所有 `text` 長度總和 `<= MAX_MESSAGE_LENGTH`(2000) | 降級 |
| 4 | 每段 `start`／`end` 是有限非負數（拒絕 `NaN`／`Infinity`／負值／字串） | 降級 |
| 5 | 每段 `start < end` | 降級 |
| 6 | 陣列依 `start` 遞增且不重疊（`segments[i].end <= segments[i+1].start`） | 降級 |
| 7 | `end <= audioDurationSeconds * 1.05`（5% 容差給編碼誤差） | 降級 |
| 8 | `audioDurationSeconds` 有限、`> 0`、`<= 監管上限`（依現行 `MIN_AUDIO_SECONDS` 與錄音上限校準） | 降級並清空該欄位 |
| 9 | **沒有音檔就不能有字幕**（純文字回應 `transcriptJson` 必須是 `NULL`） | 丟棄字幕 |
| 10 | **決策 5-A 的核心檢查**：所有 `text` 串接正規化後必須等於 `message` 的正規化形式（去空白、統一標點） | 降級為 `MANUAL_TEXT` |

`kind: "manual"` 時只需通過 1、3、9、10（`segments` 必為空陣列）。

**不得只信前端**：`audioDurationSeconds` 應以伺服器端既有的音檔解析結果為準（`api/responses/route.js` 已有 `MIN_AUDIO_SECONDS` 的時長判斷邏輯可沿用），前端傳來的值只作交叉檢查。

---

## 八、審核矩陣

| 狀態 | 音訊 | `message` | 字幕 |
| --- | --- | --- | --- |
| 卡片 `isPrivate` 或 `isBlocked` | 整個 404 | 404 | 404 |
| 回應 `isBlocked: true` | 不輸出 | 不輸出 | 不輸出 |
| `moderationStatus: PENDING`（訪客連發或含 2 個以上連結） | 不輸出 | 不輸出 | **不輸出** |
| `voiceModerationStatus: PENDING / REJECTED` | 不輸出 | 不輸出 | **不輸出** |
| `voiceModerationStatus: NOT_APPLICABLE`（舊資料） | 輸出 | 輸出 | 輸出（舊資料本來就沒有字幕，實務上為 NULL） |
| 全部通過 | 輸出 | 輸出 | 輸出 |
| 回應者帳號 `isBlocked: true` | **目前照常輸出** | 照常輸出 | 照常輸出（現況，見 §十.1） |

**Admin 端：** `admin/prayerresponse` 的詳情目前只播音訊 + 顯示 `message`。既然字幕文字 = `message`（決策 5-A），審核員看到的內容不會有缺口；若日後改採選項 B，admin 必須同步顯示第二個文字欄位，否則會出現「審核員沒看過但公開得到」的內容。

---

## 九、Schema 與 migration 草案

**刻意不在 `prisma/migrations/` 下建立資料夾**，避免被誤認為可執行。以下是完整草案，review 通過後由 6B 建檔。

### `schema.prisma` 追加

```prisma
model PrayerResponse {
  // …既有欄位不動…

  // PRD-010 §28 同步字幕。三個欄位全部 nullable、無預設、無 backfill。
  transcriptJson       Json?
  transcriptStatus     TranscriptStatus?
  audioDurationSeconds Float?
}

enum TranscriptStatus {
  ASR_SYNCED
  MANUAL_TEXT
  NONE
}
```

### `migration.sql` 草案

```sql
-- 同步字幕（PRD-010 §28）。表名是 `prayerresponse`，不是 `PrayerResponse` ——
-- model 上有 @@map("prayerresponse")，照 model 名寫會建錯表。
--
-- 只增不減，刻意如此：
--   * 三個欄位都 NULL-able、沒有預設值，既有列一筆都不會被動到
--   * 不刪除、改名、收窄任何既有欄位
--   * 不做 backfill —— 這次之前的回應本來就沒有字幕，NULL 是誠實的值。
--     播放端要把它顯示成「這段語音沒有文字」，不是隱藏該筆或顯示查詢失敗。
--
-- 套用前後用 count 驗證既有筆數不變：
--   SELECT COUNT(*) FROM `prayerresponse`;
--   SELECT COUNT(*) FROM `prayerresponse` WHERE `voiceUrl` IS NOT NULL;
--
-- ADD COLUMN ... NULL 在 MySQL 8 是 online operation，服務中可執行。
ALTER TABLE `prayerresponse`
  ADD COLUMN `transcriptJson` JSON NULL,
  ADD COLUMN `transcriptStatus` ENUM('ASR_SYNCED', 'MANUAL_TEXT', 'NONE') NULL,
  ADD COLUMN `audioDurationSeconds` DOUBLE NULL;
```

**不加索引。** 字幕只會跟著回應一起被讀出來，沒有「依字幕查詢」的需求；MySQL 的 JSON 欄位也無法直接建一般索引。

**驗證方式：** 只在本機／測試環境跑 `npx prisma migrate dev` 與 `npx prisma migrate status`，前後比對上面兩個 count。正式資料庫套用另循 `PROD_DB_MIGRATION_RUNBOOK.md`，不在本批授權範圍。

---

## 十、未決事項（需要 review 拍板）

1. **帳號被封鎖的人，他過去的回應要不要繼續公開？** 目前 `responder.isBlocked` 有被 select 但沒被過濾。這是既有政策問題，字幕只是讓它更顯眼。**6A 不改**，但建議獨立決定。
2. **決策 5 選 A 還是 B？** 建議 A（字幕文字 = `message`）。選 B 要接受多一個能繞過 `linkCount` 自動送審的公開文字欄位，並為它補一整套檢查與 admin 顯示。
3. **`transcriptStatus = NONE` 要不要留？** 目前設計 `NULL` 與 `NONE` 都代表沒有文字。若不需要區分「從未嘗試」與「嘗試過但失敗」，可以砍掉 `NONE` 只留兩個值。
4. **底部播放列要不要也做同步？** 第一階段不做。空間只有一行，且它常駐於所有頁面。
5. **`VoiceWallPlayer.js` 死碼清除** —— 416 行，無人 import。建議另開一批處理，不混進字幕。

---

## 十一、6A 交付清單對照

| 交接文件要求 | 本文件 |
| --- | --- |
| 資料流圖或簡表 | §五 |
| 格式範例 | §四 |
| 手機有／無手動文字兩條流程 | §三決策 1、§四狀態表 |
| 每個播放入口的完整文字位置 | §六 |
| 審核矩陣 | §八 |
| 伺服器驗證規則 | §七 |
| schema／migration 草案 | §九 |
| 舊資料退路 | §四狀態表末列、§九 migration 註解 |
| 未決事項 | §十 |

**未驗證項目：** 本文件全部結論來自讀 working tree（`43bea6b`）。沒有跑過 migration、沒有實機錄音、沒有讀屏測試、沒有對公開 API 發過請求 —— 這些都屬於 6B 的驗收，不在 6A。
