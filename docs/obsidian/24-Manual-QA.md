---
tags: [start-pray, qa, phase-1, phase-2, phase-3a, commit-b, commit-1, commit-2]
---

# 手動 QA 步驟

參見 [[16-Final-Acceptance-Report]]、[[21-Recorder-State-Machine]]、[[15-Acceptance-Criteria]]、[[25-Companion-Mode-Reuse-Audit]]。以下步驟可用於人工複驗 Commit 1-3、Phase 3A（匿名投稿核心）、Commit B（瀏覽/陪伴模式）、Commit C1（匿名檢舉/共用元件）、Commit 1（Prayed reaction）與 Commit 2（真機驗證/安全收尾）。

## 人工驗證矩陣（Commit 2，2026-08-05）

以下矩陣需要人工在真實裝置上補測；本輪自動化只能驗證 Desktop Chrome（透過此對話使用的瀏覽器自動化環境）欄位，其餘欄位誠實標記為 Not Tested，不得填寫 Passed。

| 功能 | Desktop Chrome | Android Chrome | iOS Safari | 結果 |
|---|---|---|---|---|
| 麥克風允許 | Not Tested（環境無法授權裝置） | Not Tested | Not Tested | Blocked |
| 麥克風拒絕 | Passed（Real Browser tested，瀏覽器層級真實拒絕） | Not Tested | Not Tested | Mock Verified（僅 Desktop） |
| 3、2、1 倒數 | Not Tested（需先取得麥克風權限） | Not Tested | Not Tested | Blocked |
| 錄音 | Not Tested | Not Tested | Not Tested | Blocked |
| 停止 | Not Tested | Not Tested | Not Tested | Blocked |
| 預覽 | Not Tested | Not Tested | Not Tested | Blocked |
| 匿名送出（語音） | Not Tested（送出邏輯本身已用真實上傳的音檔 Real API tested，見下方，但未走完整「錄音→送出」UI 流程） | Not Tested | Not Tested | Not Tested |
| 匿名送出（文字） | Passed（Real API tested，多次） | Not Tested | Not Tested | Not Tested（僅 Desktop 驗證） |
| 真實音訊播放 | Passed（Real Browser tested，見下方「真實音訊播放驗證」，用可解碼的 dev fixture 確認完整播放並觸發「播放完成」） | Not Tested | Not Tested | Not Tested（僅 Desktop 驗證） |
| 陪伴 Auto-next | Passed（Commit B 已用真實回應資料驗證自動跳過失敗曲目的路徑；本輪用可解碼音檔驗證正常結束後的行為） | Not Tested | Not Tested | Not Tested |
| Loop | Passed（Real Browser tested，`aria-pressed` 正確切換，console log 確認 play→ended→replay 週期觸發） | Not Tested | Not Tested | Not Tested |
| Stop | Passed（Real Browser tested：按鈕還原、audio 暫停、全螢幕不關閉） | Not Tested | Not Tested | Not Tested |
| Exit | Passed（Real Browser tested：全螢幕關閉、queue 清空） | Not Tested | Not Tested | Not Tested |
| X | Passed（Real Browser tested：僅前端移除，Network 面板確認零 API 請求） | Not Tested | Not Tested | Not Tested |
| Report（檢舉） | Passed（Real API/Browser tested，見 [[26-Anonymous-Reporting-Design]]） | Not Tested | Not Tested | Not Tested |
| Prayed reaction | Passed（Real API/Browser tested，見 [[28-Prayed-Reaction-Design]]） | Not Tested | Not Tested | Not Tested |
| Swipe（首頁） | Passed（Real Browser tested，真實 `TouchEvent`） | Not Tested | Not Tested | Not Tested |
| `/prayfor/[id]` 匿名錄音入口 | Passed（Real Browser tested：可開啟 Recorder，第一屏內可見） | Not Tested | Not Tested | Not Tested |

**結論**：Desktop Chrome（本自動化環境）欄位已盡可能 Real tested；Android Chrome／iOS Safari 兩欄**全部 Not Tested**，因為這個開發環境沒有真實行動裝置可供操作。這不是「未執行測試」的疏漏，而是本工具鏈的已知邊界，已誠實記錄，不得回報為 Passed。

## 環境啟動
```bash
git switch poc/minimal-prayer-redesign
git status
git log --oneline --decorate -5
npm install
npm run dev
```
需要 `.env.local`／`.env` 內有可用的 `DATABASE_URL`；本機若無 Docker/MySQL，請先確認資料庫可連線（`npx prisma studio` 可快速驗證）。

## 桌面驗證（1280×800、1440×900）
1. 開啟 `http://localhost:3000/`
2. 確認導覽列只有：禱告牆、得勝者、平台介紹、使用方式、切換語言、開始錄下你的禱告
3. 確認畫面**沒有**地球、沒有統計數字方塊、沒有「進入全球禱告室」按鈕
4. 點擊「開始錄下你的禱告」，確認出現「（原型階段）完整錄音功能即將推出，敬請期待。」提示
5. 捲動到頁尾，確認三欄（Start Pray／安心使用／帳號與幫助）皆無「登入」「註冊」「會員中心」「全球禱告室」

## 手機驗證（375×812、390×844）
1. 將瀏覽器縮小或使用裝置模擬器
2. 確認錄音 CTA 在不捲動的情況下可見
3. 點擊漢堡選單，確認選單內容與桌面一致，且可正常開關
4. 確認畫面無橫向捲動

## 英文驗證
1. 開啟 `http://localhost:3000/en`
2. 確認導覽列顯示 Prayer Wall / Stories / About / How It Works
3. 確認 Hero 顯示「Leave a prayer, and let a stranger pray for you」等英文文案，無中文殘留

## 舊路由回歸
依序直接開啟以下網址，確認皆可正常載入（不需要能完整操作，只要頁面能開啟）：
```text
http://localhost:3000/login
http://localhost:3000/signup
http://localhost:3000/customer-portal
http://localhost:3000/global-prayer-room
```
`/global-prayer-room` 應仍可看到 3D 地球（Cesium）正常運作。

## 錄音流程驗證（Commit 3，需要真實麥克風）
1. 點擊「開始錄下你的禱告」
2. 確認出現麥克風請求（`正在請求麥克風權限…`）
3. 允許權限後，確認 3-2-1 倒數，接著進入錄音中畫面（計時、剩餘秒數、「停止錄音」按鈕）
4. 說幾句話後點擊「停止錄音」，確認進入預覽畫面，可播放/暫停
5. 點擊「重新錄製」，確認出現「確定要重新錄製嗎？」確認對話框；確認後應重新走一次權限/倒數/錄音
6. 點擊「匿名送出」，確認先顯示「正在留下你的禱告…」，成功後顯示「你的禱告已經留下。會有人聆聽，並為你禱告。」，並提供「聆聽一則其他人的禱告」（會連到 `/prayfor/one`）與「回到首頁」
7. 拒絕麥克風權限（瀏覽器設定或系統層級拒絕），確認顯示「無法使用麥克風」，並可點擊「再試一次」或「返回」
8. 若瀏覽器不支援錄音（可用瀏覽器開發者工具刪除 `window.MediaRecorder` 測試），確認顯示「這個瀏覽器目前不支援錄音」

## 匿名投稿驗證（Phase 3A，可用瀏覽器 DevTools Console 直接測試 API，不需要真實麥克風）
1. 開啟瀏覽器 DevTools Console，於 `http://localhost:3000/` 執行：
   ```js
   const cardRes = await fetch('/api/home-cards?mode=one');
   const card = await cardRes.json();
   console.log(card.id);
   ```
2. 確認回傳一個真實卡片 `id`
3. 用該 `id` 送出一筆合成語音：
   ```js
   const bytes = new Uint8Array(2000).fill(1);
   const blob = new Blob([bytes], { type: 'audio/webm' });
   const fd = new FormData();
   fd.set('requestId', String(card.id));
   fd.set('isAnonymous', 'true');
   fd.set('website', '');
   fd.set('audio', blob, 'test.webm');
   const res = await fetch('/api/responses', { method: 'POST', body: fd });
   console.log(res.status, await res.json());
   ```
4. 確認回傳 `201`，且 `responder` 為 `null`、`isAnonymous` 為 `true`、`voiceUrl` 有值
5. 用回傳的 `voiceUrl` 直接開啟網址，確認音檔可讀回
6. 立即對同一 `requestId` 再送一次，確認回傳 `429 RATE_LIMITED`（同卡片 2 分鐘冷卻），而非 500 錯誤
7. **測試後請注意**：這會在你所連線的資料庫留下真實測試資料列與檔案，僅在確認連線的是本機/測試 DB（非 Production）時執行

## Prayer 瀏覽與陪伴模式驗證（Commit B）

### 左右滑動 / 鍵盤切換（桌面 1280×800、手機 375×812）
1. 開啟 `http://localhost:3000/`，確認首頁顯示一張真實 Prayer 卡片（標題/描述）
2. 桌面：焦點在頁面上（非輸入框）時按右方向鍵 `→`，確認畫面切換到下一張 Prayer；按左方向鍵 `←` 確認切回上一張
3. 手機/觸控模擬：在卡片區域用手指從右向左滑動（水平位移 > 50px 且水平位移明顯大於垂直位移），確認切到下一張；由左向右滑動切回上一張
4. 垂直滑動（例如捲動頁面手勢）不應觸發卡片切換
5. 若目前為第一張/最後一張（無 prev/next），確認對應方向的切換被忽略，不會出錯或空白
6. 點擊頁面上任一輸入框（若有）後按方向鍵，確認**不會**觸發 Prayer 切換（避免干擾打字）

### 陪伴入口顯示規則
1. 切換到一張目前**沒有**任何可播放語音回應的 Prayer，確認「聆聽其他人的禱告」陪伴入口**不顯示**
2. 切換到一張**有**可播放語音回應（`voiceUrl` 不為空）的 Prayer，確認陪伴入口**顯示**，且可看到回應數量
3. 可用 DevTools Console 快速確認某張卡片的回應資料：
   ```js
   const res = await fetch('/api/responses/<PRAYER_ID>');
   console.log(await res.json());
   ```

### 全螢幕陪伴模式（重用 AudioContext／GlobalPlayer）
1. 點擊陪伴入口，確認進入全螢幕覆蓋層，顯示目前播放清單位置（例如 `1/9`）
2. 確認底部/畫面上有 Loop（循環）、Stop（停止）、Exit（離開）三個按鈕，皆為真正的 `<button>` 元素（可用 Tab 鍵聚焦，聚焦時有可見樣式）
3. 點擊 Loop，確認按鈕呈現 `aria-pressed="true"`（可用 DevTools Elements 面板確認屬性），再次點擊應變回 `false`
4. 點擊 Stop，確認播放暫停，但全螢幕畫面**不會**關閉
5. 按 `Escape` 鍵或點擊 Exit，確認全螢幕關閉、回到原本瀏覽中的同一張 Prayer 卡片畫面，且底部不再殘留播放列（`setQueue([])`）
6. 若已登入會員帳號重新測試：確認三點選單出現，點擊後可見「檢舉」選項；點擊檢舉、確認提示文字、確認送出後該則語音從播放清單中消失（`removeTrack`），且此為**本地移除**，重新整理頁面或重新進入陪伴模式後，若後端未真正標記隱藏，該則語音可能重新出現（這是預期行為，X 與 Report 語意不同，見 [[25-Companion-Mode-Reuse-Audit]]）
7. 匿名（未登入）狀態下，確認畫面上**沒有**三點選單/檢舉按鈕（避免顯示一個必定失敗的按鈕）
8. **已知限制**：本機種子音檔與自動化測試用的合成音檔目前皆無法在瀏覽器中真正解碼播放，僅能驗證「自動跳過失敗曲目、顯示提示訊息」路徑；播放品質本身需要人工用真實有效的音檔（例如自己實際錄一則）補測

### 錄音與 Prayer 切換的狀態保護（需要真實麥克風，人工測試）
1. 點擊「開始錄下你的禱告」進入權限請求/倒數/錄音中任一狀態，嘗試左右滑動或按方向鍵切換 Prayer，確認被擋下並顯示提示訊息（不會中斷錄音）
2. 錄完進入預覽（尚未送出）狀態，嘗試切換 Prayer，確認出現「確定要放棄目前尚未送出的錄音嗎？」之類的二次確認對話框；取消應留在原畫面，確認應放棄錄音並切換
3. 送出中（uploading）狀態，嘗試切換，確認同樣被擋下
4. 送出成功或失敗畫面，確認允許自由切換 Prayer

### 舊路由回歸（Commit B 改動了 `GlobalPlayerGate.js`，需確認未破壞既有頁面）
```text
http://localhost:3000/global-prayer-room
http://localhost:3000/prayfor/1
```
確認 Cesium 地球正常載入、`/prayfor/[id]` 的既有播放器功能正常，Console 無新增錯誤。

## 匿名檢舉與 /prayfor/[id] 共用元件驗證（Commit C1）

### 匿名檢舉（不需要真實麥克風，可用 DevTools Console 測試 API，也可透過陪伴模式 UI 測試）
1. 開啟任一有真實可播放語音回應的 Prayer（首頁或 `/prayfor/[id]` 皆可），進入陪伴模式
2. 確認**未登入**狀態下也能看到每則回應旁的「⋯」三點選單
3. 點擊「⋯」，確認選單開啟，出現「檢舉」選項；點擊選單外部，確認選單自動關閉
4. 點擊「檢舉」，確認出現確認對話框；點擊「取消」，確認選單關閉且沒有送出任何請求（可用瀏覽器 DevTools Network 面板確認沒有 `prayer-response/report` 請求）
5. 再次點擊「檢舉」→「確定檢舉」，確認：
   - 顯示「已檢舉，此內容不會再顯示。」
   - 該筆立刻從播放清單消失、正在播放的音訊立即停止或切到下一筆
   - 播放清單歸零時顯示「目前沒有可播放的禱告。」空狀態
6. 離開陪伴模式，確認若可播放回應數已變為 0，「聆聽大家的禱告」入口按鈕**不再顯示**
7. 用 DevTools Console 確認後端狀態真的改變（僅限本機開發 DB，非 Production）：
   ```js
   const res = await fetch('/api/responses/<PRAYER_ID>');
   console.log(await res.json()); // 剛剛被檢舉的那筆應該已經不在陣列中
   ```
8. 對同一則已檢舉的回應重複呼叫檢舉 API，確認回傳 `200 {success:true}`（冪等，不是錯誤）
9. 快速連續呼叫檢舉 API 6 次以上（可對同一 responseId），確認第 5 次之後開始回傳 `429 RATE_LIMITED`
10. 嘗試在 request body 加入 `reporterId`/`userId`/`hidden`/`admin` 等欄位，確認伺服器行為與正常請求一致（欄位被忽略，不會被拿來當作身分或直接標記 hidden）
11. **測試後請注意**：這會讓資料庫中的測試回應變成 `PENDING` 狀態並從公開查詢消失（非刪除），如需復原請用 `npx prisma studio` 手動改回 `moderationStatus: APPROVED`、`reportCount: 0`

### X 與 Report 行為分離驗證
1. 進入陪伴模式，點擊某一項目旁的「×」（本地移除），確認該項目立刻從清單消失，但 Network 面板**沒有**任何新的 API 請求
2. 離開陪伴模式，重新進入，確認剛剛用「×」移除的項目**重新出現**（證明「×」只是前端暫時隱藏，未通知後端）
3. 對比：用「檢舉」流程移除的項目，離開再重新進入陪伴模式後**不會**重新出現（見上方步驟 5-6）

### `/prayfor/[id]` 匿名錄音驗證（不需要真實麥克風即可驗證權限請求路徑）
1. 開啟任一 `http://localhost:3000/prayfor/<id>`（**不要**登入）
2. 確認在 Prayer 標題／圖片下方，馬上能看到「為這件事禱告」與（若有回應）「聆聽大家的禱告」兩顆按鈕，不需要往下捲動太多
3. 點擊「為這件事禱告」，確認出現與首頁完全相同的錄音流程 UI（權限說明/倒數/錄音等狀態），這代表匿名訪客不再被導向登入頁
4. 確認頁面下方 `Comments.js` 原本的「🎙 語音禱告」按鈕（僅登入者可用）與新的匿名錄音入口**同時存在、互不干擾**——未登入點擊舊按鈕仍會看到「請先登入」提示，這是刻意保留的既有行為，不是 Bug
5. 確認送出成功後（需要真實麥克風才能走到這步，Real microphone Not Tested），`Comments.js` 下方的既有回應列表與底部 mini-player 佇列都能顯示新回應（`PRAYER_RESPONSE_CREATED` 事件已串接，但完整送出流程本身 Not Tested）

### Mobile／Desktop 版面驗證
1. 依序用 375×812、390×844、412×915 檢視 `/prayfor/[id]`，確認無橫向捲動，且錄音入口在第一屏內可見（不需捲動或僅需捲動一點點）
2. 用 1280×800、1440×900 檢視同一頁面，確認錄音入口仍在首屏附近，版面未被破壞

## 「我已為你禱告」驗證（Commit 1）

### 基本流程（首頁與 `/prayfor/[id]` 皆測試一次）
1. 開啟首頁或任一 `/prayfor/<id>`，確認能看到「我已為你禱告」按鈕與目前的人數（例如「0 人已禱告」）
2. 點擊按鈕，確認：
   - 按鈕立刻進入禁止重複點擊的狀態
   - 短暫顯示「謝謝你為這件事禱告。」
   - 人數變成「1 人已禱告」
   - 按鈕維持在「已按下」的樣式（不會變回可點擊）
3. 再次點擊同一顆按鈕（若因為畫面延遲還能點到），確認人數**不會**變成 2（後端冪等）
4. 重新整理頁面，確認按鈕仍顯示「已按下」狀態、人數維持正確——這是靠瀏覽器裡的 Guest cookie，不是靠瀏覽器暫存的畫面狀態

### Prayer 切換狀態驗證（僅首頁，需先按過至少一則 Prayer 的「我已為你禱告」）
1. 在首頁對目前這則 Prayer 按下「我已為你禱告」
2. 用左右方向鍵或滑動切換到下一則 Prayer，確認新 Prayer 的按鈕是**未按過**的初始狀態（不會誤繼承上一則的「已按下」樣式）
3. 切換回原本那則 Prayer，確認正確顯示「已按下」、人數正確——證明狀態是跟著各自的 Prayer id 走，不是單一全域開關

### 錯誤與邊界（可用 DevTools Console 直接測試 API，不需要真實裝置）
```js
// 對一個不存在的 Prayer id 呼叫，預期 404
const res1 = await fetch('/api/home-cards/999999/prayed', { method: 'POST' });
console.log(res1.status); // 404

// 嘗試偽造欄位，預期完全無效（Server 不會讀取 request body）
const res2 = await fetch('/api/home-cards/2/prayed', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ userId: 'fake', count: 9999, admin: true }),
});
console.log(await res2.json());
```
確認以上兩種情況都不會造成錯誤的資料寫入。

### Accessibility 快速檢查
1. 用 Tab 鍵將焦點移到「我已為你禱告」按鈕，確認有清楚可見的 focus 樣式
2. 用瀏覽器 DevTools 檢查該按鈕的 `aria-pressed` 屬性：未按過應為 `false`，按下後應變成 `true`
3. 確認按鈕本身是真正的 `<button>` 元素（可用鍵盤 Enter/Space 觸發，不是 `<div>` 假裝的按鈕）

### 測試後清理（僅限本機開發 DB）
測試會在 `prayer_prayed_reaction` 表留下真實測試列，測試後可用 `npx prisma studio` 手動清除，或執行：
```js
// 在專案根目錄執行，會清空整張表——僅限本機開發 DB，測試用
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
await prisma.prayerPrayedReaction.deleteMany({});
await prisma.$disconnect();
```

## 真實音訊播放驗證（Commit 2，2026-08-05，Real Browser tested）

之前所有輪次都因為既有種子音檔與合成假位元組無法解碼，只能驗證「播放失敗」路徑。本輪新增 `scripts/dev/generate-test-audio.mjs`——一支會產生小型、**真正合法可解碼**的 WAV 測試音檔（440Hz 正弦波，非靜音）的產生器腳本。**這支腳本本身可以提交**（純程式碼）；**產生出來的音檔本身不可以提交**（專案的全域安全規則明確禁止提交錄音測試檔），需要人工在本機執行：
```bash
node scripts/dev/generate-test-audio.mjs public/dev-test-audio.wav 1.5
```
產生後可暫時放進 `public/` 目錄供本機 dev server 提供（Next.js 會自動 serve `public/` 下的檔案），測試完畢後手動刪除。

**Real Browser tested 結果**：
1. 直接用 `new Audio(url)` 載入該檔案，確認 `loadedmetadata`（`duration: 1.5`）、`canplaythrough`、`playing` 事件皆正確觸發，`currentTime` 真的會前進——證明檔案本身合法可解碼，不同於過去的假位元組測試檔
2. 透過真實的 `POST /api/responses` 上傳流程（而非直接寫入 DB）把這個檔案送出成為一筆真實 `PrayerResponse`，確認 Storage/寫檔/URL 產生的既有流程對真正的音訊檔案運作正常
3. 在 `/prayfor/[id]` 開啟陪伴模式，點擊播放（使用真實 OS 層級的滑鼠點擊，非程式模擬），確認：
   - Console 記錄 `[AudioContext] 嘗試播放:開始` → `嘗試播放:成功`
   - 播放完整個 1.5 秒後正確觸發 `ended` 事件，UI 顯示「播放完成，要重新播放嗎？」——這個提示只有在音訊**真正播放到結尾**才會出現，證明播放引擎、`<audio>` 元素與這筆音訊的整合完全正常
   - 開啟 Loop 後，Console 記錄重複的 `播放結束` → `嘗試播放:開始` → `嘗試播放:成功` 循環，證明 Loop 邏輯確實會在結束時重新觸發播放
   - Stop／Exit／X 均在有真實可播放音訊的情況下重新驗證一次，行為與先前用不可播放音檔測試時一致
4. **已知限制**：在這個特定的自動化瀏覽器環境（Chrome DevTools Protocol 自動化、無真實音訊輸出裝置）中，`HTMLMediaElement.play()` 這個 Promise 本身會 resolve（確認播放請求被接受），且第一次測試時完整觀察到播完整段音訊的完整生命週期；但後續嘗試在極短時間窗口內用程式反覆採樣 `audio.currentTime` 時，多次採樣落在 `paused: true`——初步判斷是這個特定 headless 自動化環境對「音訊持續播放中」狀態回報不穩定（沒有真實喇叭/音訊裝置），而非播放引擎本身的邏輯錯誤（因為透過 `ended` 事件與 UI 提示已經證明過至少一次完整播放確實發生）。這個限制記錄為「Real Audio Playback: 解碼與觸發播放 Passed；持續播放的即時逐幀狀態在此自動化環境 Not Fully Observable」，比先前「完全無法播放」的結論更精確，但仍不宣稱在真實使用者裝置上的播放體驗已 100% 驗證完成——建議人工在真機瀏覽器上補測一次實際聽感

## Recorder／Companion 壓力測試結果（Commit 2，2026-08-05）

| 測試項目 | 方法 | 結果 |
|---|---|---|
| Prayed reaction 快速連續點擊 | 同時觸發兩次 click handler（`Promise.all`），檢查後端計數 | Passed（Real API tested：count 仍為 1，未被雙擊灌水） |
| Companion X 快速點擊 | Real Browser tested（Commit C1 既有測試延伸） | Passed（純前端操作，無 API 請求） |
| Companion Loop 快速切換 | Real Browser tested | Passed（`aria-pressed` 正確反映最終狀態） |
| PrayerRecorder 送出雙擊防護 | 程式碼審查（`handleSubmit` 內 `if (submitState === "uploading") return;`） | Implemented（程式碼確認），**Not Tested**（需要真實麥克風才能進入 preview 階段觸發雙擊送出） |
| Recorder 卸載清理（MediaStream／Timer／Object URL） | 程式碼審查（`usePrayerRecorder.js` 內對應的 `useEffect` cleanup function） | Implemented（程式碼確認，邏輯與 Commit 3 起未變更），**Not Tested**（無法在此環境模擬「錄音中卸載元件」的真實情境） |
| Browser back／頁面離開時音訊/錄音狀態 | 未測試 | **Not Tested**（需要真實瀏覽器導覽操作，且需要處於錄音狀態才有意義） |
| Network offline／reconnect | 未測試 | **Not Tested**（此工具鏈無法可靠模擬網路中斷；`fetch` 失敗的例外處理路徑已在既有 Report／Prayed reaction 的 `catch` 區塊程式碼審查確認存在，但未實際斷網驗證） |
| 0 tracks（陪伴模式空清單） | Real Browser tested（Commit B 既有驗證） | Passed（顯示空狀態，只保留 Exit） |
| 1 track | Real Browser tested（本輪，含真實可播放音訊） | Passed |
| 多筆混合（部分可解碼／部分不可解碼） | Real API tested（分別建立於不同卡片） | Passed（各自獨立驗證：可解碼者正常播放，不可解碼者觸發既有自動跳過邏輯，Commit B 已驗證過跳過路徑本身） |

## 品質檢查
```bash
npm run lint
npm run build
npm run test:unit
npm run i18n:check
```
四者皆應無錯誤結束（exit code 0）。`test:unit`、`i18n:check` 為本輪新增/既有的自動化檢查。

## 已知限制
- 未使用真實會員帳密測試已登入狀態下的導覽列（建立代禱／問候語／登出）、`Comments.js` 既有的登入者檢舉/語音回應迴歸
- 自動化瀏覽器工具的點擊事件在本環境對 React 委派事件的觸發不穩定，人工用滑鼠/觸控實際點擊應該正常運作；如遇到按鈕無反應，請先嘗試真實點擊而非自動化腳本（本輪改用 `element[reactPropsKey].onClick()` 直接呼叫 handler 驗證，見 [[27-Shared-Prayer-Interaction-Audit]]）
- 錄音流程的完整「允許→倒數→錄音→停止→預覽→重錄→送出」尚未用真實麥克風實測過（自動化環境無法授權裝置），需要人工在真機或桌機瀏覽器補測一次，首頁與 `/prayfor/[id]` 皆適用
- 陪伴模式的 Loop/Stop/Playlist X 按鈕、錄音中/倒數中/送出中的切換保護、Preview 未送出時的二次確認，皆已實作但未經自動化點擊測試（原因同上，環境限制），需要人工補測，見上方「Prayer 瀏覽與陪伴模式驗證」
- ~~種子/測試音檔在此環境無法真正播放~~（**Commit 2 部分解除**：改用 `scripts/dev/generate-test-audio.mjs` 產生的真正可解碼音檔後，確認解碼/播放/`ended`/Loop 事件皆正確觸發；但持續播放的逐幀狀態在此 headless 自動化環境仍不完全可觀察，播放品質本身仍需要人工在真機用真實音檔補測，見上方「真實音訊播放驗證」）
- `/prayfor/[id]` 上 `GlobalPlayer.js` 內建的既有全螢幕陪伴 UI 與本輪新增的 `CompanionOverlay.js` 並存但視覺不同，未逐一測試 `GlobalPlayer.js` 內建陪伴 UI 的所有既有觸發路徑（該元件本身未被修改，非本輪引入的風險，但也未做回歸測試），見 [[13-Risk-Register]]
- 「我已為你禱告」的 migration 未在全新（空白）環境驗證過完整重放，見 [[28-Prayed-Reaction-Design]]、[[13-Risk-Register]]
- Admin 後台尚無查看 Prayed reaction 明細的介面（本輪規格未要求新增）
- Android Chrome／iOS Safari 兩欄的整個測試矩陣皆為 Not Tested（此開發環境無真實行動裝置），見上方「人工驗證矩陣」
- PrayerRecorder 的雙擊送出防護、卸載清理、Browser back、Network offline/reconnect 皆只完成程式碼審查，未經真實互動測試（需要真實麥克風才能進入可測試的狀態），見上方「Recorder／Companion 壓力測試結果」
- Storage 是否使用 ephemeral filesystem（Cloud Run 等）無法從本 repo 的既有設定檔確認，已標記為 Production Blocker，見 [[19-Security-Review]]
