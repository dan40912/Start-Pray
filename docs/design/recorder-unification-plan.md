# 錄音體驗統一計畫

**日期：** 2026-09-28
**分支：** `codex/recorder-unification`（獨立 worktree，基底 `main` = `9f0eead`）
**視角：** apple-design skill（*Designing Fluid Interfaces* WWDC 2018、*Principles of Great Design* WWDC 2026）
**狀態：** 待 review。本文件**不改任何程式碼**。

> **先講最重要的排程結論：** 這份計畫與 [`apple-fluid-motion-batches-2-6-handoff.md`](./apple-fluid-motion-batches-2-6-handoff.md) 的**批次 4 直接衝突**。批次 4 是「把 `VoicePrayerOverlay` 的狀態與進出場做好」—— 但那是三份錄音實作裡的其中一份，而且是唯一沒有接上共用狀態機的那一份。**先做批次 4 等於把一個即將被換掉的元件磨亮。** 建議批次 4 併入本計畫的 R1／R3，見 §七。

---

## 一、現況：統一做到一半，停在半路

不是「兩邊各自長出來」，是**有人已經開始統一、抽好了共用層，但沒有把最舊的那一份遷過去**。證據在 `usePrayerRecorder.js` 自己的檔頭：

```js
// …adapted from src/components/VoicePrayerOverlay.js (permission handling,
// MIME fallback, stop-with-timeout, cleanup) but stripped of
// speech-recognition/subtitles, auth, and upload — this hook only ever
// produces a local Blob.
```

`recorder-utils.js` 裡也有：

```js
// Ordered by preference; matches the fallback list already proven in
// src/components/VoicePrayerOverlay.js …
```

所以方向早就定了：**`usePrayerRecorder` 是目標，`VoicePrayerOverlay` 是來源。** 這份計畫只是把沒走完的那一段走完。

現在的分佈：

```
共用（三邊都用）
  recorder-utils.js       112 行  MIME 選擇、時長格式、judgeRecording、isMobileBrowser
  analyze-recording.js            RMS／時長分析

usePrayerRecorder.js      407 行  ← 狀態機
  ├─ PrayerRecorder.js    846 行  首頁 hero、詳情互動面板
  └─ CardVoiceRecorder.js 479 行  /me/create、/me/edit/[id]

VoicePrayerOverlay.js     808 行  ← 自己一套狀態機 + 自己一套 UI
  └─ Comments.js                  代禱詳情頁的回應錄音
```

**重複的正好是狀態機與 UI**，判斷層早就共用了。

---

## 二、三邊實際差在哪（逐項核對）

| | `VoicePrayerOverlay`（回應） | `PrayerRecorder`（hero／詳情） | `CardVoiceRecorder`（建立／編輯卡） |
| --- | --- | --- | --- |
| 狀態機 | 自己的 7 個 phase：`vperm` `vcount` `vrec` `vproc` `vconfirm` `vdenied` `vfail` | `usePrayerRecorder` 的 9 個：`idle` `permission-explanation` `requesting-permission` `permission-denied` `unsupported` `countdown` `recording` `preview` `error` | 同左 |
| 時長常數 | 自己的 `REC_MAX = 60`／`REC_MIN = 3` | `recorder-utils` 的 `MAX/MIN_DURATION_SECONDS`（同值） | 同左，可覆寫（卡片語音 180s） |
| 麥克風參數 | 自己**逐字複製**一份 `MIC_CONSTRAINTS` | hook 裡一份 | 同 hook |
| 樣式 | `theme-detail.css` 的 **45 條 `.vpo-*`** | styled-jsx 內嵌 | styled-jsx 內嵌 |
| **重錄** | `restartRec` **直接重來，沒有確認** | `confirmingRerecord` **兩段式確認** | 同 hook |
| 字幕 | 有（桌面才啟用） | 無 | 無 |
| 「處理中」狀態 | 有 `vproc` | **無** | 無 |
| 錯誤文案 | `FAIL_MESSAGES`：空檔／靜音／過短各有專屬句子 | `errorReason` 較粗 | 同 hook |
| 輸入停滯偵測 | `INPUT_STALL_MS = 5000` | 無 | 無 |
| 音量回饋 | AnalyserNode 波形 | `inputLevel`／`heardSound` | 同 hook |

三種樣式系統、兩套詞彙、同一個動作兩種安全性。

---

## 三、Apple 的判準：要統一的是行為，不是外框

### 這件事本身就是 §16.4「Familiarity」的定義

> Be consistent: things that look the same must behave the same and live in the same place, so people can predict what happens next.

三個錄音器長得像、用詞不同、重錄的後果不同。使用者在首頁錄過一次之後，到詳情頁回應時**不能靠上次的經驗預測會發生什麼** —— 尤其「重新錄」在一邊會問、在另一邊直接把剛才那段抹掉。

### 但三個情境是真的不同，不該壓成一個元件

| 情境 | 形態 | 為什麼不同是對的 |
| --- | --- | --- |
| 回應別人的代禱 | **Modal bottom sheet** | 這是一個有始有終的任務，需要遮罩把其他事推遠（§12「Dim to focus」） |
| 首頁 hero | **Inline，且錄完自動接下一張** | 它活在一副可滑的牌裡，錄音是牌面上的一個動作，不是離開頁面 |
| 建立／編輯自己的卡片 | **Inline 在表單裡**，上限 180 秒 | 它是表單的一個欄位，旁邊還有標題、內容要填 |

所以目標**不是「一個元件」**，而是：

> **一個狀態機 + 一套詞彙 + 一套畫面語言 + 一組文案，三個外殼。**

Apple 自己的錄音介面也是這樣：Voice Memos、訊息裡的語音、通話錄音外框完全不同，但按下去的反應、波形的意義、停止與重來的後果完全一樣。

---

## 四、目標架構

```
recorder-utils.js  ·  analyze-recording.js          （判斷層，已共用，不動）
          ↓
usePrayerRecorder                                   （唯一狀態機）
  補上目前只有 overlay 有的能力：
    · processing 階段（送出前的處理空窗）
    · FAIL_MESSAGES 等級的錯誤文案（空檔／靜音／過短）
    · 輸入停滯偵測（5 秒沒有任何輸入 → 提示麥克風可能被佔用）
          ↓
<RecorderStage>                                     （唯一畫面語言）
  倒數 · 錄音中 · 處理中 · 預聽 · 錯誤 五個畫面的共用 markup 與 CSS
  用 tokens.css 的語意 token，不再是 styled-jsx ×2 + theme-detail ×1
          ↓
三個外殼（只負責容器、進出場、情境限制）
  <VoicePrayerSheet>   modal + 遮罩 + 字幕（桌面）
  <HeroRecorder>       inline + 錄完自動接下一張
  <CardVoiceRecorder>  inline + 180s 上限
```

**詞彙以 hook 的為準**，`v*` 那組廢掉 —— `vproc` 看不出是什麼，`processing` 看得出。

---

## 五、Apple 逐條套用在統一後的錄音體驗

### 1. 重錄一律要確認（§16.2 Agency / forgiveness）

> confirmation dialog only for genuinely destructive, irreversible actions (use sparingly; overusing it trains people to click through)

重錄**就是**那種動作：剛才那段聲音沒有別的地方留著，按下去就永遠沒了。這個專案的其他地方很少用確認框，正因為少用，用在這裡才有效。`usePrayerRecorder` 已經有 `confirmingRerecord`，overlay 沒有 —— 統一時往「有確認」收，不是往「沒有」收。

同理，`handleCancel`（關閉整個面板）在錄音中或有未送出預聽時也必須先問。

### 2. 錯誤文案往最好的那一份收（§16 Feedback 四類：status / completion / warning / error）

overlay 的 `FAIL_MESSAGES` 是三邊最好的：它分辨「檔案是空的」「錄到了但全是靜音」「只錄到 1.4 秒就被中斷」，而且每一句都說明**剛才的內容不會送出**。hook 家族的 `errorReason` 沒有這個粒度。統一時把它搬進 hook，三邊一起得到。

這是「統一」真正的價值：不是三份變一份，是**三邊都拿到最好的那一份**。

### 3. 按下就有反應，不要等權限往返（§1 Response）

目前按下「開啟麥克風」之後，`getUserMedia` 可能要等使用者在瀏覽器對話框按允許。這段空窗如果畫面不動，會被當成沒反應。`usePrayerRecorder` 已經有 `requesting-permission` 這個 phase（overlay 沒有），統一後三邊都要在那個 phase 顯示「正在等待麥克風權限」。

### 4. 波形要是真的（§13 Causality / Harmony / Utility）

三邊都已經用 AnalyserNode 反映真實音量，失敗時退回 CSS 動畫 —— 這點已經對了，統一時不要退化成裝飾性的假波形。使用者要能從波形看出「它真的聽到我了」，這是錄音介面唯一重要的即時回饋。

**Utility**：不要為錄音加音效或震動。這是禱告平台，安靜本身是設計的一部分。

### 5. 減少動態要換一種回饋，不是拿掉回饋（§14）

倒數環的縮放、波形的跳動、進出場的位移，在 `prefers-reduced-motion` 下都要收掉；但**必須保留**：現在是第幾秒、有沒有收到聲音、現在是哪一個階段。目前三邊各有各的 reduced-motion 規則（`PrayerRecorder.js` 有 3 處、`CardVoiceRecorder.js` 有 1 處、overlay 在 `theme-detail.css` 有 1 處），統一後只需要一份。

### 6. 每個狀態都要能回答四個問題（§16 Wayfinding）

> Where am I? Where can I go? What's there? How do I get out?

錄音特別需要，因為它有時間壓力。逐狀態檢查：

| 狀態 | 我在哪 | 怎麼出去 | 出去會不會弄丟東西 |
| --- | --- | --- | --- |
| 倒數 | 「3、2、1」＋「深呼吸，慢慢說」 | 取消 | 還沒錄，不會 |
| 錄音中 | 波形＋已錄秒數＋剩餘秒數 | 完成／取消 | **取消會丟 → 要問** |
| 處理中 | 「正在處理，請不要關閉」 | 不提供出口 | — |
| 預聽 | 可播放＋時長 | 送出／重錄／取消 | **重錄與取消都會丟 → 要問** |
| 錯誤 | 具體哪裡出錯（§5.2） | 重試／改用文字 | 已經丟了，說清楚 |

### 7. 計時器用等寬數字（§15）

錄音秒數每秒跳一次，非等寬數字會讓整行左右抖。批次 1 已經在播放器的時間文字上做了 `font-variant-numeric: tabular-nums`；錄音計時器同理。`PrayerRecorder.js:757` 已經有，另外兩邊沒有。

---

## 六、明確不做的事

| 不做 | 為什麼 |
| --- | --- |
| 不把三個外殼壓成一個元件 | modal／hero inline／表單 inline 是三種真實情境（§三）。壓成一個會逼出一堆 `variant` prop，比現在更難懂 |
| 不把字幕搬進共用 hook | 字幕只在桌面存在，而且 [批次 6A](./batch6a-caption-decisions.md) 已決定它的條件與格式。它屬於 `VoicePrayerSheet` 這個外殼，不屬於狀態機 |
| 不動 `recorder-utils` 與 `analyze-recording` | 判斷層已經共用且有單元測試，這次不碰 |
| 不在手機重新啟用語音辨識 | 6A 已裁決：Android 的系統辨識器會獨占麥克風，可能讓錄音變無聲 |
| 不一次換掉三邊的 CSS | R2 先抽共用畫面，三邊逐一切換並各自截圖比對 |
| 不趁機改時長上限 | 60s／180s 是產品決定，不是技術債 |

---

## 七、分階段，以及與既有批次的衝突

### 與批次 4 的關係：建議合併

批次 4（錄音面板狀態與進出場）的範圍是 `VoicePrayerOverlay.js` + `theme-detail.css`。本計畫的 R1 會把那個檔案的狀態機整個換掉，R2 會把它的 45 條 `.vpo-*` 換成共用樣式。**兩者在同一批檔案上，且批次 4 的產出會被 R1／R2 覆寫。**

建議：**批次 4 的驗收條件（狀態盤點、Escape／焦點、長內容可捲動、資源釋放、不加 `touch-action: none`）原封不動移到 R3**，批次 4 本身取消。這樣只做一次，而且做的是統一後的版本。

### 階段

| 階段 | 範圍 | 可獨立驗收的結果 |
| --- | --- | --- |
| **R1** 行為統一 | `VoicePrayerOverlay.js` 改用 `usePrayerRecorder`；把 overlay 獨有的 `processing`、`FAIL_MESSAGES`、輸入停滯偵測補進 hook；廢掉重複的 `MIC_CONSTRAINTS`／`REC_MAX`／`REC_MIN` | **畫面刻意不動。** 三邊行為一致（含重錄確認），`git diff` 只有邏輯 |
| **R2** 畫面統一 | 抽 `<RecorderStage>`；三邊逐一切換；styled-jsx ×2 + `.vpo-*` → 一套 token 化 class | 三邊畫面一致，每一邊都有切換前後截圖 |
| **R3** 體驗收尾 | §五 逐條：重錄／取消確認、`requesting-permission` 的等待狀態、reduced-motion 收斂成一份、wayfinding 表逐格檢查、計時器等寬數字。**含原批次 4 的全部驗收項** | 依 §五.6 的表逐狀態驗收 |

**每階段一個 commit，做完停下來交 review**，照交接文件的共通規則 1。

### 其他交界

| 對象 | 交界 | 處置 |
| --- | --- | --- |
| 批次 6B | 會改 `VoicePrayerOverlay` 的 `onComplete` 簽章與 `Comments.js` | **R1 先於 6B。** 6B 在統一後的介面上加字幕傳遞，比在兩份實作上各做一次便宜 |
| 批次 2 / B2 | `HomePrayerHero.js` 內嵌 `PrayerRecorder` | R1／R2 不改 hero 的手勢邏輯，只改它內嵌的錄音器。仍須與 B2 排開寫入時段 |
| B1 | `theme-detail.css`（`.vpo-*` 所在） | **R2 排在 B1 review 之後** |
| C1 | 無交集 | — |

---

## 八、驗收證據（三階段共通）

每個外殼 × 每個狀態都要走一次：權限說明、等待權限、權限被拒、不支援、倒數、錄音中、達到上限自動停、處理中、預聽、重錄確認、取消確認、空檔／靜音／過短三種錯誤。

外殼各自的額外項：

- `VoicePrayerSheet`：長內容可捲動、虛擬鍵盤不遮動作、Escape 與焦點返回、背景遮罩、桌面字幕仍然運作、**不得對整片面板加 `touch-action: none`**
- `HeroRecorder`：錄音中不得被滑卡打斷、未送出預聽時走既有捨棄確認、錄完自動接下一張仍然正確
- `CardVoiceRecorder`：180 秒上限、表單其他欄位不受影響、編輯既有卡片時的既有音檔

`npm run lint`；`recorder-utils` 既有單元測試必須續綠；改到 build 路徑時 `npm run build`。

**未驗證要明列：** 實機麥克風（iOS Safari／Android Chrome）、讀屏、真實權限拒絕流程。模擬事件不算實機通過。

---

## 九、一句話總結

這不是重構三個元件，是**把已經抽好的共用層用完**，並在過程中讓三邊都拿到目前只有其中一邊有的那些好東西 —— 具體的錯誤文案、重錄前的確認、等待權限時的回饋。使用者感受到的差別是：在站上任何地方錄音，按下去的反應、看到的字、按錯時的後果，都一樣。
