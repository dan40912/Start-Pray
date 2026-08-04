---
tags: [start-pray, qa, phase-1, phase-2, phase-3a]
---

# 手動 QA 步驟

參見 [[16-Final-Acceptance-Report]]、[[21-Recorder-State-Machine]]、[[15-Acceptance-Criteria]]。以下步驟可用於人工複驗 Commit 1-3 與 Phase 3A（匿名投稿核心）。

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

## 品質檢查
```bash
npm run lint
npm run build
npm run test:unit
npm run i18n:check
```
四者皆應無錯誤結束（exit code 0）。`test:unit`、`i18n:check` 為本輪新增/既有的自動化檢查。

## 已知限制
- 未使用真實會員帳密測試已登入狀態下的導覽列（建立代禱／問候語／登出）
- 自動化瀏覽器工具的點擊事件在本環境對 React 委派事件的觸發不穩定，人工用滑鼠/觸控實際點擊應該正常運作；如遇到按鈕無反應，請先嘗試真實點擊而非自動化腳本
- 錄音流程的完整「允許→倒數→錄音→停止→預覽→重錄」尚未用真實麥克風實測過（自動化環境無法授權裝置），需要人工在真機或桌機瀏覽器補測一次
