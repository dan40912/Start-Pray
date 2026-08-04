---
tags: [start-pray, risk]
---

# 風險登記

參見 [[09-Change-Impact-Analysis]]、[[10-Implementation-Plan]]。

| 風險 | 說明 | 影響範圍 | 建議緩解措施 |
|---|---|---|---|
| 無自動化測試套件 | 專案內無 `*.test.js`、無 test script，僅有 `scripts/qa-flow.mjs` | 全專案，尤其 Phase 3/5 | 每個 Phase 上線前手動走一次 `qa-flow.mjs` + 真機測試；優先考慮為 `POST /api/responses` 補上最基本的 API 測試 |
| `/voices`、`/uploads` 檔案路由無存取驗證 | 任何人可直接讀取音檔/圖片路徑 | 隱私、內容安全 | 匿名化後風險不會變得更差（本來就無驗證），但應趁機加上基本的 rate limit/防目錄遍歷檢查 |
| 語音回應移除登入檢查後的濫用風險 | 沒有 rate limit 就開放匿名語音上傳，可能被灌爆 | Storage 空間、內容審核負擔 | Phase 3 必須同批上線 rate limit（依 `ipHash`/`guestSessionHash`）與檔案大小/時長限制 |
| 首頁地球 hero 停用後的 SEO/分享連結影響（**更正**：僅有一套 Cesium 實作，非 two.js+Cesium 兩套，見 [[02-Current-Architecture]]） | `/global-prayer-room` 路由本身未變動，僅首頁不再掛載同一元件的 embed 變體，故實際上無 404 風險 | SEO、既有連結 | 已確認：`/global-prayer-room` 全頁路由與功能皆保留，2026-08-04 Browser tested 通過 |
| Cesium 費用與 API token（`NEXT_PUBLIC_CESIUM_ION_TOKEN`）持續計費 | 若地球頁面停用但 token 仍在使用中 | 成本 | 確認停用後是否需要停用/輪替 Cesium ion token |
| 匿名投稿者遺失內容管理能力 | 現有刪除機制綁定登入會員 | 使用者信任、內容申訴壓力 | 依 DEC-007 建立管理 token 機制；文件化「token 遺失後僅能走檢舉/聯絡管理員」 |
| 檢舉功能要求登入 | 三張 Report 表 `reporterId` 必填 | 匿名使用者無法檢舉不當內容 | 需設計匿名檢舉替代方案（例如以 `ipHash` 記錄 + 後台審核） |
| 一次改動範圍過大導致難以定位問題 | 使用者明確要求分階段、小 commit | 全專案 | 嚴格遵守 [[10-Implementation-Plan]] 的 Phase 劃分與 Commit 規則 |
| 舊會員系統與新匿名流程並存的邏輯分歧 | 兩套投稿路徑（會員 vs 匿名）需要長期並存 | 後端維護複雜度 | 明確文件化兩條路徑的差異（本文件 + [[06-Authentication-Dependencies]]），避免未來修改時遺漏其中一條 |
| 首頁錄音前端（Commit 3）未經真實麥克風測試 | 自動化瀏覽器環境無法授權真實麥克風裝置，只驗證了權限拒絕/不支援兩條路徑 | 允許權限後的倒數/錄音/預覽/重錄全流程可能存在自動化環境無法發現的真機問題（例如 iOS Safari 特有行為） | 需要人工在真機（iOS Safari、Android Chrome）與桌機瀏覽器補測一次，見 [[24-Manual-QA]] |
| 自動化瀏覽器工具的座標點擊無法穩定觸發 React 委派事件 | `computer` action 分派的合成點擊事件未被 React 18 的事件委派系統接住 | 影響本輪對互動元件的自動化驗收深度，需改用直接呼叫 handler 或人工測試 | 已記錄於 [[16-Final-Acceptance-Report]]、[[21-Recorder-State-Machine]]；後續互動性驗收優先安排人工測試 |
| ~~「下一步：匿名送出」按鈕目前只顯示 Prototype 文案~~（**已解除**，2026-08-04 Phase 3A 已接上真實 API） | 已於 Phase 3A 接上 `POST /api/responses`，不再是 Prototype | — | 不適用 |
| 本機開發資料庫殘留測試資料 | Phase 3A 驗證時用合成音訊對真實開發 DB 送出 2 筆測試 `PrayerResponse`（卡片 id=5、id=39 各一筆） | 開發資料庫資料不乾淨，非 Production | 目前系統沒有刪除 `PrayerResponse` 的 API（見 [[20-Anonymous-Submission-Design]]），需要你透過 `npx prisma studio` 或後台手動清除，或等 Phase 3B 管理 Token/刪除 API 完成後處理 |
| 匿名語音沒有獨立於文字回應的 rate limit | Phase 3A 沿用既有文字回應的頻率限制（10 分鐘 5 則、同卡片 2 分鐘冷卻），未新增語音專屬的、以檔案大小/次數為準的限制 | 語音檔案比文字佔用更多 Storage，理論上可能被用來更快耗用磁碟空間 | 待 Phase 3B 或後續安全補強階段（[[19-Security-Review]]，尚未建立）一併處理，屬已知限制，非本次引入的新洞 |
| 匿名投稿目前無管理/刪除能力 | Phase 3A 只做送出，未做管理 Token（Phase 3B） | 使用者無法自行刪除已送出的語音，只能靠檢舉或聯絡管理員 | 設計已完成（[[20-Anonymous-Submission-Design]] 方案 C），待你核准後實作 Phase 3B |
| 陪伴模式三點選單/檢舉僅登入者可見 | Commit B 的 Report API 沿用既有 `requireSessionUser()`，匿名首頁訪客看不到檢舉入口（避免顯示一定會 401 的按鈕） | 匿名訪客上傳的內容若有問題，一般訪客無法自行檢舉 | 已記錄於 [[25-Companion-Mode-Reuse-Audit]]，需要你確認是否要設計匿名檢舉方案（例如比照 guest 語音送出，用 `ipHash`/`guestSessionHash` 識別） |
| 陪伴模式真實音訊播放未經測試 | 既有種子資料的 demo 音檔與 Phase 3A 測試用的合成假位元組皆無法在此自動化瀏覽器環境中真正解碼播放 | 無法確認真實使用者在正常網路環境下的實際播放體驗；已確認的是「播放失敗時的自動跳過與提示」路徑本身正確運作 | 需要人工在真實瀏覽器、真實音檔上補測一次，見 [[24-Manual-QA]] |
| Recording/Countdown/Uploading 狀態下的切換保護未經自動化測試 | 需要真實麥克風才能進入這些狀態，此環境的麥克風存取被封鎖 | 無法用自動化方式確認「正在錄音時滑動會被正確擋下」等保護邏輯在真實裝置上是否如預期運作（程式邏輯已審查，邏輯本身直觀） | 需要人工在真機測試，見 [[24-Manual-QA]] |
