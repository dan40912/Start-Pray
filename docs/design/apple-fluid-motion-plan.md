# Start Pray：流體互動與動效改進計畫

> 更新：2026-09-28（第四版；批次 2–6 的施工交接另見下方連結）
> 用途：供其他 AI 分批實作；完成一批後交回 review。
> 依據：apple-design skill、目前 working tree 的元件與樣式、[`start-pray-v3-wireframe-poc.html`](start-pray-v3-wireframe-poc.html)（PRD-010 Track A，2026-07-15）。本文是程式碼盤點及施工規格，尚無手機實機、LCP、FPS 或讀屏量測。
> 協作依據：[`docs/execution-handoff-2026-09-27.md`](../execution-handoff-2026-09-27.md) 的單一寫入者排程。本計畫**尚未**在那張表裡佔位，見文末。
> 批次 2–6 的實際施工順序、交付和驗收條件見 [`apple-fluid-motion-batches-2-6-handoff.md`](./apple-fluid-motion-batches-2-6-handoff.md)；若本計畫的舊敘述與交接文件不同，以交接文件為準。

## 目標與取捨

Start Pray 應讓人安靜地閱讀、禱告和留下聲音。動效要讓操作立即可理解、可以中斷、可以取消；視覺層次要支持內容，不以持續發光或大面積晃動吸引注意。保留現有夜色、暖金、實色內容卡與中文襯線標題。

這份計畫優先處理兩個實際互動：**播放器進度條**和**首頁代禱卡輪播**。它們都由使用者直接觸碰，改善後的差異可操作、可驗證。按壓回饋、錄音面板、導覽材質與排版採逐頁調整，不一次修改全站樣式。

Apple 的「彈簧」是設計原則，不是所有動畫都要引入新函式庫的命令。對非手勢的淡入、顏色及按鈕狀態，既有 CSS transition 足夠；對需要跟手、繼承速度且在途中反向的元件，才評估可中斷的 spring。先做互動原型，再決定是否抽共用工具。任何文中的數值都是原型起點，不能當成已量測結果。

**版本變動**：第二版加入與 POC 的對照（下一節）、新增批次 6「同步字幕播放」、修正第一版兩個錯誤前提（`tabular-nums` 與 safe-area 其實都已存在）。第三版依 review 修正四處：批次 6 的字幕缺口比原本寫的大（手機刻意無字幕）、批次 2 不加換卡骨架、批次 3 的字級修正不能只改一個選擇器、批次 1 的樣式檔與 B2 有交界；並把「schema 需核准」拆成本機編寫與套用正式庫兩個步驟。第四版修正批次 6 的公開審核條件與封鎖描述，並新增批次 2–6 的施工交接。

## 已核對的程式碼事實

| 領域     | 現況與含意                                                                                                                                                   | 位置                                                                                                                                             |
| -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| 首頁滑卡 | 已有 Pointer Events、約 10px 的方向判斷、pointer capture、跟手位移與 reduced-motion CSS；放手後以整段位移平均速度判斷是否切換，位置交給固定 420ms transition | [`HomePrayerHero.js`](../../src/components/HomePrayerHero.js)                                                                                    |
| 滑卡錄音 | 切卡前會檢查錄音、上傳與未送出預聽；必要時先顯示捨棄確認                                                                                                     | `HomePrayerHero.js` 的 `canSwitchNow`、`needsDiscardConfirm`、`attemptSwitch`                                                                    |
| 滑卡點擊 | `endDrag` 會先清空 `dragRef`，`handleClickCapture` 再讀它；拖曳後防誤點的效果需用事件序列驗證                                                                | `HomePrayerHero.js` 的 `endDrag`、`handleClickCapture`                                                                                           |
| 語音進度 | `GlobalPlayer.js` 中有兩個條件顯示的進度條：底部播放器與沉浸畫面；兩者都只用 click seek，且標成 `role="presentation"`                                        | [`GlobalPlayer.js`](../../src/components/GlobalPlayer.js)                                                                                        |
| 錄音面板 | `VoicePrayerOverlay.js` 包含權限、倒數、錄音、處理、預聽、失敗等狀態；面板可垂直捲動，取消會停止錄音並釋放麥克風                                             | [`VoicePrayerOverlay.js`](../../src/components/VoicePrayerOverlay.js)、[`theme-detail.css`](../../src/styles/theme-detail.css)                   |
| 視覺基礎 | `tokens.css` 已有 day/night 表面、暖金 accent、圓角與基本時間變數；其他 CSS 還保留局部 blur、固定色彩及多層覆寫                                              | [`tokens.css`](../../src/styles/tokens.css)、[`theme-modern.css`](../../src/styles/theme-modern.css)、[`globals.css`](../../src/app/globals.css) |

第二版新核對的事實：

| 領域                         | 現況與含意                                                                                                                                                                                                                                                                     | 位置                                                                                                                       |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| 字幕在手機上是**刻意關閉**的 | `captionsOnRef.current = Boolean(SRRef.current) && !isMobileBrowser()`。原因寫在 `recorder-utils.js`：即時字幕會第二次開啟麥克風，**Android 的系統辨識器會獨占輸入，可能讓錄音本身的音軌變成無聲**。桌面瀏覽器會共用輸入所以保留字幕。這是為了避免錄音資料遺失的修正，不是漏做 | [`VoicePrayerOverlay.js:86`](../../src/components/VoicePrayerOverlay.js:86)、`recorder-utils.js` 的 `isMobileBrowser`      |
| 逐句時間戳（僅部分桌面）     | 有字幕的情況下逐句產生 `segments: [{s, e, t}]`，使用者改字幕時依時長重新平均分配；送出時只傳出攤平的字串，`segments` 在交接點被丟掉。時間取自**辨識結果抵達的 `performance.now()`**，不是音訊解碼位置                                                                          | `VoicePrayerOverlay.js` 的 `recog.onresult`、`handleSubmitVoice` 的 `onComplete(file, r.transcript)`                       |
| 字幕落地                     | 語音辨識結果被當成回應的**文字內容**送出（`textOverride`），不是獨立的字幕軌                                                                                                                                                                                                   | [`Comments.js`](../../src/components/Comments.js) 的 `handleVoiceComplete`                                                 |
| 資料模型                     | `prisma/schema.prisma` 目前**沒有**任何 transcript／segment／音檔時長欄位；`/api/responses` 只存 `voiceUrl`                                                                                                                                                                    | `prisma/schema.prisma`、`src/app/api/responses/route.js`                                                                   |
| 公開讀取邊界                 | 公開回應 API 用 `SAFE_RESPONSE_SELECT` 白名單挑欄位；GET 同時要求 `moderationStatus: APPROVED`、`voiceModerationStatus` 通過、回應本身未封鎖；私密或封鎖的卡片整個回 404。回應者帳號的 `isBlocked` 目前沒有作為 GET 過濾條件                                                   | [`api/responses/[homeCardId]/route.js`](../../src/app/api/responses/%5BhomeCardId%5D/route.js)                             |
| 頁面上的獨立音訊控制         | 每則語音回應、hero、錄音預聽都用 `GainAudio` 搭**原生 `controls`**（為了把偏小的錄音推到可聽音量而走 Web Audio）；`VoiceWallPlayer` 另有自己的 `<audio>`。原生 controls 沒有給同步字幕的掛點                                                                                   | `Comments.js:601`、`HomePrayerHero.js:346`、`VoicePrayerOverlay.js:772`、`prayer-detail/VoiceWallPlayer.js`                |
| PRD 規格                     | PRD-010 §28 把字幕欄位列在 **Potential V2 schema additions**（仍是候選設計，不是已核准規格），字幕格式寫成 `{start, end, text}`，**與程式碼現產的 `{s, e, t}` 不同名**                                                                                                         | [`PRD-010`](../prd/PRD-010-prayer-first-product-redesign.md) §28                                                           |
| 首頁滑卡零網路               | `deck` 由 `prayers` prop 建成，註解寫明「一整副牌，不是一張卡。索引移動就是換卡，零網路」。換卡不會逐張抓資料                                                                                                                                                                  | [`HomePrayerHero.js:37`](../../src/components/HomePrayerHero.js:37)                                                        |
| 表單字級只涵蓋一部分         | `.form-control`／`textarea.form-control` 是 `font-size: 0.95rem`（約 15.2px），低於 iOS Safari 聚焦不放大的 16px 門檻。但 **`/me/create` 完全沒有用這個 class**（0 處），欄位是 `<label>` 內的裸 `<input>`，由頁面自己的 CSS 決定字級                                          | [`globals.css`](../../src/app/globals.css) `.form-control`、[`me/create/page.js:473`](../../src/app/me/create/page.js:473) |
| 進度條樣式集中在一個檔       | `.progress-bar`、`.progress-fill`、`.companion-overlay__progress`、`.global-player .progress-bar` 共 11 條規則**全部**在 `theme-modern.css`                                                                                                                                    | [`theme-modern.css`](../../src/styles/theme-modern.css) 1602、2145、3278 附近                                              |
| 已存在，第一版誤判           | `font-variant-numeric: tabular-nums` 已用於 7 處；`env(safe-area-inset-bottom)` 已用於 10 處。這兩項是**一致性**問題，不是缺口                                                                                                                                                 | `theme-detail.css`、`theme-modern.css`、`PrayerRecorder.js`、`globals.css`                                                 |

CSS 規則數與宣告數只能說明原始碼分布，不能直接推出「手機按下完全沒有回饋」、「所有動畫無法中斷」或效能瓶頸。這些結論要由實際元件與裝置驗證。

## 參考 V3 Wireframe POC：借什麼、不借什麼

POC 是 PRD-010 Track A 的可點擊線稿（2026-07-15），比目前的 Phase 0 token 系統早。它的價值在於**已經做出來的互動與細節**，不在它的配色與資訊架構。

### 借：POC 已證明可行的互動與細節

| POC 的做法                                                                                   | POC 位置                                    | 對應批次                                                       |
| -------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------- |
| `.btn:active{transform:scale(.96)}`，且 transition 只列 transform／background／border-color  | `.btn`、`.btn:active`                       | 批次 3                                                         |
| 主要按鈕 `min-height:52px`、返回鈕 44×44、chip `min-height:38px` 但用 padding 撐開實際點擊區 | `.btn`、`.back`、`.chip`                    | 批次 3                                                         |
| `:focus-visible{outline:3px solid var(--focus);outline-offset:2px}`，**按鈕和輸入欄位都有**  | `.btn:focus-visible`、`input:focus-visible` | 批次 3                                                         |
| 輸入欄位 `font-size:16px`，避開 iOS 聚焦自動放大                                             | `input[type=text],textarea,select`          | 批次 3（現站是 0.95rem，見上表）                               |
| 開關用 `role="switch" aria-checked`，不是裸 div                                              | `.switch`、`flip()`                         | 批次 3                                                         |
| 骨架載入：先出骨架再填內容，`color:transparent` 保留版位                                     | `.skeleton`、`startOnePrayer()`             | **不進批次 2**，只適用真正等待資料的畫面（見批次 2）           |
| 時間文字用 `tabular-nums`                                                                    | `.rec-timer`、`.ptimes`                     | 批次 1                                                         |
| 字幕容器用 `aria-live="polite"`                                                              | `.live-transcript`、`.lyrics`               | 批次 6，但**不照搬**（見批次 6 第 5 點）                       |
| 錄音波形用 Web Audio `AnalyserNode` 反映真實音量，失敗時退回 CSS 環境波形                    | `startWave()`                               | 批次 4（現站 `VoicePrayerOverlay` 已有同等實作，確認一致即可） |
| **同步字幕播放**：`.line.now` 隨播放進度逐句 highlight                                       | `.lyrics`、`paintPB()`                      | 批次 6（新增）                                                 |

### 不借：POC 的視覺與 IA 與 Phase 0 裁決衝突

Phase 0（[`DESIGN_COORDINATION.md`](../../DESIGN_COORDINATION.md)）已經裁決過配色與圓角，POC 早於那個裁決。**這次不動視覺方向**，下表只是避免實作時誤把 POC 的值當規格帶進來。

| 項目 | POC                   | 現站（Phase 0 裁決）                     | 這次                     |
| ---- | --------------------- | ---------------------------------------- | ------------------------ |
| 主色 | 松綠 `#2F6F73`        | 暖金 `#fbbf24`，唯一 accent              | 維持暖金                 |
| 底色 | 紙白 `#FFFDF8`        | day `#f6f7fb` / night `#0b1424` 兩種表面 | 維持兩表面               |
| 圓角 | 6／8／12px            | 8／12／14px                              | 維持 tokens.css          |
| 導覽 | 底部 5 分頁 app shell | 頂部 72px header                         | 維持頂部（改 IA 要另案） |
| 字體 | 全站無襯線            | 標題襯線 Noto Serif TC                   | 維持襯線標題             |

若之後真要往 POC 的視覺／IA 收斂，那是獨立的產品決定，要重開 PRD 與 review，不在本計畫範圍。

### POC 自己的兩個反例，不要跟著做

1. **`@media (prefers-reduced-motion:reduce){*{animation:none!important;transition:none!important}}`** —— 一條 `*` 全關。減少動態的意思是換成不引發前庭反應的回饋（短淡入、顏色或對比變化），不是拿掉回饋。全關會讓按壓狀態、載入中、焦點變化一起消失，對需要這個設定的人反而更難用。現站已有 9 處 scoped 的 reduced-motion 規則，延續那個做法。
2. **`.progress` 的 `seek(event)` 也是 click-only**（`onclick`，沒有 pointer 追蹤、沒有鍵盤、沒有 `role="slider"`）。POC 在這裡和 `GlobalPlayer.js` 是**同一個缺口**，所以批次 1 不能拿 POC 當解法參考，只能拿它當「連線稿也沒解」的證據。

## 施工順序

| 批次 | 優先               | 範圍                                       | 完成條件                                                       |
| ---- | ------------------ | ------------------------------------------ | -------------------------------------------------------------- |
| 1    | 高                 | 語音進度條可拖曳、鍵盤與讀屏可操作         | 兩種播放器畫面行為一致，取消手勢不 seek                        |
| 2    | 高                 | 首頁滑卡的防誤點、取消及可中斷回位         | 慢拖、快甩、反向抓取和錄音保護都正確                           |
| 3    | 中                 | 選定控制項的按壓回饋、tap target、輸入字級 | 手機按下立即可見，聚焦不放大整頁                               |
| 4    | 中                 | 錄音面板的狀態進出場                       | 錄音與預聽不因手勢誤關；長內容仍可捲動                         |
| 5    | 較低               | 導覽材質與中文排版逐頁收斂                 | 日／夜、手機、放大字與偏好設定都可讀                           |
| 6    | 較低，先交決策文件 | 同步字幕播放（含資料欄位）                 | 手機與辨識失敗時的字幕來源已定案；有字幕才同步，沒有的照常播放 |

每批單獨交付和 review。估時要在原型與實機檢查後再定，不以「半天零風險」「總共五天」作承諾。

批次 6 的 schema 要分成兩個步驟看，不要混為一談：**本機編寫 schema 與 migration 供 review** 不需要等核准，這正是它該交付的東西；**套用到正式資料庫**是另一個步驟，須按部署流程處理，本文不構成授權。PRD-010 §28 把字幕欄位列為 _Potential V2 schema additions_，仍是候選設計，所以批次 6 要先提出具體資料格式與遷移檔供 review，而不是把它當既有規格直接實作。

## 批次 1：語音進度條

**問題。** 底部播放器和沉浸模式只有點擊跳轉；鍵盤與讀屏使用者無法調整位置。這比裝飾效果更直接影響語音陪伴。POC 的 `.progress` 有同樣缺口，不能當解法參考。

**實作。**

1. 將兩處進度條收斂為同一個進度控制元件。優先評估原生 `input[type="range"]` 能否符合視覺及操作需求；若使用自訂 slider，需完整提供鍵盤、焦點及 ARIA 語意。
2. 指標按下時立即更新顯示位置；拖曳跟手並追蹤目前預覽時間；放開時才呼叫既有 `seekQueue`。既有播放狀態與佇列切換規則保持正確。
3. `pointercancel`、元件卸載、音軌切換或時長變更時**取消本次預覽，不提交 seek**。拖曳狀態使用 ref 或其他同步機制管理，避免快速事件讀到前一個 React state。只接受同一個 pointer 的事件，完成時釋放 capture。
4. 時長為 0、`NaN`、尚未載入或無佇列時停用 seek，避免除以 0。鍵盤需支援左右鍵與 Home／End，步進與 Shift 步進由使用情境決定，焦點樣式可見；讀屏能聽見目前時間與總長。
5. 播放中填色可評估 `scaleX` 取代 `width`，但前提是填色與把手位置同步、拖曳時不帶延遲，且實測確認值得改。不要把「任何 width 更新必然造成顯著卡頓」當作既定事實。
6. **借 POC：** 時間文字加 `font-variant-numeric: tabular-nums`（站上已有 7 處在用，播放器時間要一致），焦點樣式沿用可見的 outline + offset，不要只靠顏色。

**驗收。** 點擊、慢拖、拖出軌道再拖回、取消手勢、音軌切換、時長未知、鍵盤與讀屏均正常；底部播放器和沉浸畫面結果一致。需在手機實機確認觸控不誤觸其他播放器控制。關閉沉浸畫面時保留原有播放邏輯。

## 批次 2：首頁代禱卡輪播

**保留。** 現有跟手拖曳、垂直捲動判斷、鄰卡預覽、循環卡片和錄音保護。不要為套用動畫範例而重寫整個輪播。

**先修正事件邊界。** 將 `pointerup` 與 `pointercancel` 分開：取消只回到安全畫面，不觸發切卡。核對拖曳後 click 抑制，目前 `dragRef` 清空時機可能使防誤點失效。錄音中不得開始切卡；若預聽尚未送出，**先讓使用者決定是否捨棄，確認後才使卡片離開**。

**再做可中斷原型。** 記錄最近約 80–120ms 的指標位置估算放手速度；從目前實際呈現的位置與速度接續回位或切換。若飛行中再次按下，要立即停止原動畫並從畫面當下的位置跟手，不要跳到邏輯目標。需要更改目標時保留當前速度。初版只切相鄰一張；「甩過兩格」可能讓人失去閱讀脈絡，不列入必做，待手機操作比較後再決定。

先在元件內完成原型；如果既有 CSS 動畫無法滿足抓住反向與速度接續，再選用可靠的 spring 工具或實作共用 helper。自寫 helper 必須處理 `requestAnimationFrame` 清理、卸載、隱藏頁籤、重新指向、速度單位與到位判定；不要直接貼用舊版文件的 50 行示意碼。減少動態時以短淡入／靜態切換替代大幅位移，仍保留目前是哪一張卡的清楚回饋。

**不要加 POC 的換卡骨架。** POC 的 `startOnePrayer()` 會先掛 `.skeleton` 再填內容，因為它每次換卡都當成一次取資料。現站不是這樣：`HomePrayerHero.js:37` 的 `deck` 由 `prayers` prop 一次建好，註解寫明「索引移動就是換卡，零網路」。在零等待的切換上加骨架，只會讓每次滑動閃一下，是退步不是進步。骨架留給首次載入或真正在等資料的畫面（站上已有 `pdv2-skeleton`、`skeleton-float`，那才是它們的位置）。

**驗收。** 慢拖未過門檻回位、快速輕甩、反向拖、連續操作、pointercancel、垂直捲頁、鍵盤換卡、少量卡片循環皆無跳動或誤開連結；錄音、預聽、上傳與確認流程維持正確。比較手機錄影與主執行緒長幀，不在量測前承諾固定 FPS。

## 批次 3：按壓回饋與觸控細節

在首頁主要入口、代禱卡動作、詳情頁主要動作、播放器控制選幾種代表元件先做。按下時可以用背景、邊框、陰影或約 0.96–0.99 的小幅縮放；優先避免與元件現有的 `translate`、`scale`、定位或 hover transform 互相覆蓋。只有證實自訂回饋在觸控裝置可見後，才考慮調整 iOS 原生 tap highlight。

不新增一條對全站 `button`、`[role="button"]`、卡片一律寫 `transform: scale(...)` 的規則。按鈕尺寸以至少 44×44 CSS px 為設計目標；有難以放大的圖示時可擴大實際點擊區。鍵盤 `:focus-visible` 要清楚，減少動態模式仍以顏色或對比提供按下回饋。

**借 POC 的三個具體值：**

1. `:focus-visible` 用 `outline: 3px solid` + `outline-offset: 2px`，**輸入欄位也要有**（POC 兩者都給了，現站 focus-visible 只有 28 處且集中在按鈕）。
2. 主要按鈕 `min-height` 往 52px 靠，返回／圖示鈕維持 44×44。這是設計目標，不是一次全站改寫。
3. **輸入欄位字級要達到 iOS 不放大的門檻，但這不是改一個選擇器就好。** `.form-control` 確實是 `font-size: 0.95rem`（約 15.2px），值得提到 16px／1rem；但 **`/me/create` 一次都沒有用 `.form-control`**（0 處），它的欄位是 `<label>` 內的裸 `<input>`，由頁面自己的 CSS 決定字級。所以做法是：逐頁列出實際的輸入欄位，用開發者工具讀**計算後**的字級（不是原始碼裡的宣告），找出低於 16px 的那些，再各自修正。改完必須用 iPhone Safari 實測聚焦行為 —— 這是唯一能確認的方式，桌面模擬器不會重現自動放大。同時確認提字級後 `padding` 與版面沒有破版。清單至少涵蓋 `/me/create`、登入、註冊、詳情頁回應表單、後台登入。**不要寫成「一行修好所有表單」。**

**驗收。** 手機按下立即有狀態，滑開可取消；原本使用 transform 的按鈕和卡片不跳位；hover、鍵盤及 disabled 狀態正確。iOS Safari 聚焦每一種輸入欄位都不放大整頁。測試首頁、禱告牆、詳情、建立代禱與 footer/nav 的代表控制。

## 批次 4：錄音面板

先改善開啟、取消、錯誤與完成時的視覺狀態，讓面板沿同一空間方向進出；非手勢的進出場可以用短 CSS transition。面板有麥克風權限、倒數、錄音、處理與預聽狀態，且 `max-height: 92dvh`、`overflow-y: auto`，**不可對整個 `.vpo-panel` 加 `touch-action: none`**。

第一版保留既有關閉按鈕與取消語意，不新增整片面板下拉即關。若後續原型證明下拉有幫助，只能由明確的把手開始、與內容捲動分流，並限制在安全狀態；錄音中、處理中及有未送出預聽時須沿用取消確認或禁止手勢關閉。`pointercancel` 只還原面板，不提交關閉。錄音資源的停止與釋放仍走既有 `handleCancel`。

材質調整使用 `tokens.css` 的 day/night 語意表面；如果修正 24px 圓角或局部 hex，先做頁面截圖比較，避免把錄音面板的辨識度一併削掉。

**與 POC 對照：** POC 的波形（`startWave()` 用 `AnalyserNode`，失敗退回 CSS 動畫）與現站 `VoicePrayerOverlay` 是同一套做法，這批不需要改寫，只要確認失敗退路仍然有效（拒絕權限、`AudioContext` 建立失敗、瀏覽器不支援辨識三種情況各看一次）。

**驗收。** 長內容可捲動、虛擬鍵盤不遮住動作、錄音不因滑動誤失、預聽能返回、背景遮罩與面板同步、Escape／焦點行為正確；減少動態時以短淡入或靜態狀態取代位移。

## 批次 5：浮動材質與排版

`tokens.css` 已將內容卡設定為實色。先只針對真正浮動、且內容會從下方經過的頁首或工具列試一個半透明版本；先在 day/night 與有圖片、文字的背景下量對比和效能。遇到不支援 `backdrop-filter`、要求減少透明度或高對比時，使用實色背景及清楚邊界。不要將所有既有 blur 一次改成三種固定值，也不要把半透明放回內容卡。

若頁首高度要隨放大文字成長，須同時檢查 nav 換行、選單、`body` 的預留空間、anchor 的 `scroll-padding` 和手機安全區。只改 `--header-h: max(72px, 4.5rem)` 無法保證內容不被裁切。

中文排版先選首頁標題、代禱正文、詳情標題與表單說明做比較。正文約 1.6–1.8 的行高、大標約 1.2 為原型範圍；襯線中文標題的字距需依實際斷行調整。不要對全站 `p, li` 統一套 `line-height: 1.75`，以免後台表格、導覽、按鈕和表單密度一起改變。

**不借 POC 的配色與圓角**，理由見前節對照表。`env(safe-area-inset-bottom)` 站上已有 10 處在用，這批只需檢查一致性，不是新增。

**驗收。** 320、390、430、768、1440px；日／夜表面；繁中及英文長標籤；系統字級放大；減少動態、減少透明度、高對比及 blur fallback。頁首不遮擋內容，文字在最不利背景仍可讀。

## 批次 6：同步字幕播放（新增，需先決策）

**為什麼值得做。** 這不是動效，是語音代禱平台的實質功能：讓聽的人跟上說的人。PRD-010 把「Captions/transcripts are available for voice playback」列為可存取性條件，POC 也做出可用的版本（`.lyrics .line.now` 隨 `paintPB()` 逐句 highlight）。

**這批的缺口比第一版寫的大，先講清楚範圍。** 第一版寫「只差傳遞、儲存、播放」，那句話**只對部分桌面錄音成立**，不能當成施工前提。核對後的實情：

- **手機上沒有字幕可傳。** `VoicePrayerOverlay.js:86` 用 `!isMobileBrowser()` 刻意關掉辨識，理由是即時字幕會第二次開啟麥克風，而 **Android 的系統辨識器會獨占輸入，可能讓錄音本身變成無聲**。這是避免錄音資料遺失的修正。**不得為了拿字幕而在手機重新開啟辨識** —— 那會用遺失真人錄音的風險去換一個顯示效果。
- **桌面的時間戳也只是近似。** `{s, e, t}` 的時間取自辨識結果**抵達**時的 `performance.now()`，不是音訊解碼位置；使用者編輯字幕後改成依時長平均分配。長錄音會累積偏移。
- 所以「傳遞、儲存、播放」是桌面路徑的工程工作，**手機路徑目前根本沒有字幕來源**。

**因此批次 6 的第一步不是寫程式，是先回答三個問題**（產出一份決策文件供 review，不要邊做邊決定）：

1. **手機使用者的字幕從哪來？** 候選：(a) 不提供，明確標示這則沒有字幕；(b) 引導使用者在確認畫面自己補打（現有的字幕編輯欄位已經支援，只是目前預設空白）；(c) 伺服器端或第三方 STT —— 這會牽涉費用、隱私與外送真人語音，屬於另一個提案，**不在本批範圍**。先選 (a) 或 (b)。
2. **時間不準時要不要退回純文字？** 建議預設：只有 `transcriptJson` 存在且通過基本合理性檢查（段落遞增、`end` 不超過音檔時長、段數與文字量相稱）才做逐句同步；否則**只顯示完整文字，不做 highlight**。會誤導的同步比沒有同步更糟。
3. **哪一個播放介面要做同步？** 站上的語音播放不只一處：`GlobalPlayer` 的佇列播放、`VoiceWallPlayer` 自己的 `<audio>`，以及每則回應／hero／預聽用的 `GainAudio` + **原生 `controls`**。原生 controls 沒有給同步字幕的掛點，硬要做就得換成自訂播放器。建議只先在 `GlobalPlayer` 的沉浸畫面做一處，其餘維持「完整文字可讀」。

**決策通過後的實作順序。**

1. **schema 與 migration 在本機寫好供 review，這一步不必等核准。** PRD-010 §28 把這些欄位列為 _Potential V2 schema additions_ —— 仍是候選設計，所以本批要**先提交具體資料格式與遷移檔**讓人 review，而不是把它當既有規格直接實作。要分清兩件事：**(a) 本機編寫 schema／migration 供 review** 可以直接做；**(b) 套用到正式資料庫**是獨立步驟，須走部署流程，本文不構成授權。
2. **欄位必須 nullable、無 NOT NULL、無 backfill。** 既有語音回應留 NULL 是正確結果，播放端要照常播放並顯示現有文字，不得因為沒有字幕就隱藏該筆或顯示成查詢失敗。migration 前後用 count 驗證既有筆數不變。
3. **統一 segment 欄位名。** PRD-010 §28 寫 `{start, end, text}`，程式碼現產 `{s, e, t}`。挑一個為準並在邊界轉換；不要兩種格式並存。同時決定攤平的字串是否繼續存進回應文字（目前是），或改由字幕欄位單一來源產生 —— 這會影響既有回應的顯示，要明確。
4. **把 `segments` 傳出來。** 改 `onComplete` 的簽章或改傳物件；`Comments.handleVoiceComplete` 一併更新。字幕關閉（手機）、辨識失敗、瀏覽器不支援、使用者清空字幕時，`segments` 為空都是**正常路徑**，必須能純語音送出。
5. **公開資料流要整條走完，並遵守現行審核與私密邊界。** 新欄位不會自動出現在公開 API —— `api/responses/[homeCardId]` 用 `SAFE_RESPONSE_SELECT` 白名單挑欄位，所以要**刻意加入**。GET 同時檢查 `moderationStatus` 和 `voiceModerationStatus`，並排除封鎖的回應；私密與封鎖卡片維持整個 404。現行 GET 沒有依回應者帳號的 `isBlocked` 過濾，不能把它寫成既有保障。POST 須在伺服器驗證字幕格式、長度、時間和文字審核，不讓新欄位繞過 `message` 的限制。**用真實請求驗證公開 API 的實際回傳內容，不要假設。**
6. **逐句 highlight 不照搬 POC 的 `aria-live="polite"`。** 順序是：先確保**完整字幕**能被讀屏取得（這是 PRD 的可存取性條件，不做同步也要成立），再實測是否真的需要播報當前句。持續播報每一句會反覆打斷閱讀，多數情況下應該讓字幕區塊是可讀的靜態內容，而不是 live region。捲動跟隨要能被使用者接手：手動捲動後停止自動跟隨，由使用者主動恢復。減少動態時取消位移與縮放，只用顏色與粗細區分當前句。

**驗收。** 手機未補字與手動補字（若採此方案）、桌面錄音有字幕與無字幕都能完成送出；舊回應（欄位為 NULL）行為不變且不顯示為錯誤；辨識失敗與不支援辨識的瀏覽器能完成純語音送出；編輯字幕後仍可播放；**以真實請求分別確認兩個審核狀態未核准、回應封鎖、私密卡、封鎖卡都不外洩字幕**；讀屏能取得完整字幕；手動捲動不被自動跟隨搶走；減少動態模式無位移。migration 檔與資料格式已交付 review；migration 前後既有回應 count 一致。`npm run lint`、`npm run build`。**手機是否重新開啟辨識：不在本批選項內。**

## 與其他工作協調

[`docs/execution-handoff-2026-09-27.md`](../execution-handoff-2026-09-27.md) 已建立單一寫入者排程（A：OG 與圖片；B1：詳情頁；C1：後台；B2：首頁／禱告牆）。**本計畫的批次目前不在那張表裡**，開工前要先補進去並取得寫入時段，不要因為「檔案不同」就同時動手。

依現行排程建議的插入點：

| 批次            | 主要檔案                                                                                                       | 與現有排程的關係                                                                                                    |
| --------------- | -------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| 1（進度條）     | `GlobalPlayer.js`（無人持有）**＋ `theme-modern.css`（進度條 11 條規則全在這裡）**                             | JS 可獨立改，但樣式檔 B2 也可能動。**開工前要把 `theme-modern.css` 的寫入時段一併排好**，不能只登記 JS              |
| 6（字幕）       | `VoicePrayerOverlay.js`、`Comments.js`、`prisma/schema.prisma`、`api/responses/[homeCardId]`、`/api/responses` | Comments.js 與 B1 的回應區改動相鄰，**排在 B1 review 後**。決策文件與 migration 檔可先寫、先 review，不必等寫入時段 |
| 2（滑卡）       | `HomePrayerHero.js`                                                                                            | 需確認 B2 是否同時處理首頁 hero，**排在 B2 範圍確定後**                                                             |
| 3（按壓／字級） | `tokens.css`、`globals.css` 的 `.form-control`                                                                 | `globals.css` 與 C1 的 badge 調整衝突，**需錯開時段**                                                               |
| 4（錄音面板）   | `VoicePrayerOverlay.js`、`theme-detail.css`                                                                    | `theme-detail.css` 由 B1 持有，**排在 B1 review 後**                                                                |
| 5（材質／排版） | `theme-modern.css`、`tokens.css`                                                                               | `theme-modern.css` 與 B2 相關，**排在 B2 review 後**                                                                |

開工先執行 `git status --short`、`git branch --show-current`、`git worktree list`，回報現有未提交變更。不要重置、清理或覆蓋別人的檔案；未追蹤的文件與進度試算表原樣保留。優先使用獨立 worktree／分支。

每批交付請列出檔案與 diff、使用者可見差異、手機或鍵盤操作證據、`npm run lint` 結果；修改 build、server component 或 API 時再跑 `npm run build`。涉及純函式速度／門檻判斷時可補有意義的測試；視覺與手勢感受需用互動原型和實機檢查。未實測的項目明確標示，不寫成已通過。

本計畫只授權本機可 review 的 UI 工作。批次 6 可以在本機編寫 schema 與 migration 供 review；**套用到正式資料庫、部署，以及修改私密卡公開規則都不在授權範圍**，須另按流程處理。
