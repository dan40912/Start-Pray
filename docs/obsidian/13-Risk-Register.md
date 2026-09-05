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
| ~~陪伴模式三點選單/檢舉僅登入者可見~~（**已解除**，2026-08-05 Commit C1 已對所有訪客開放匿名檢舉） | Commit B 的 Report API 沿用既有 `requireSessionUser()`，匿名首頁訪客看不到檢舉入口 | — | 已於 Commit C1 實作 guest 分支並 Real API tested，見 [[26-Anonymous-Reporting-Design]] |
| 陪伴模式真實音訊播放未經測試 | 既有種子資料的 demo 音檔與 Phase 3A 測試用的合成假位元組皆無法在此自動化瀏覽器環境中真正解碼播放 | 無法確認真實使用者在正常網路環境下的實際播放體驗；已確認的是「播放失敗時的自動跳過與提示」路徑本身正確運作 | 需要人工在真實瀏覽器、真實音檔上補測一次，見 [[24-Manual-QA]] |
| Recording/Countdown/Uploading 狀態下的切換保護未經自動化測試 | 需要真實麥克風才能進入這些狀態，此環境的麥克風存取被封鎖 | 無法用自動化方式確認「正在錄音時滑動會被正確擋下」等保護邏輯在真實裝置上是否如預期運作（程式邏輯已審查，邏輯本身直觀） | 需要人工在真機測試，見 [[24-Manual-QA]] |
| 匿名檢舉無法逐筆追蹤同一訪客的重複檢舉 | 選擇不寫入 `PrayerResponseReport`（`reporterId` 是必填 User FK，匿名訪客無此欄位），冪等性改以「Response 目前狀態」判斷 | 無法像登入使用者一樣稽核「這個人檢舉了哪些內容」，只有 `AdminLog` 粗粒度嘗試記錄 | 已記錄於 [[26-Anonymous-Reporting-Design]]，屬設計取捨；若未來需要更細緻的匿名稽核，需評估新增 nullable schema 欄位（additive migration） |
| 匿名檢舉的 DB-backed rate limit 查詢無專用索引 | 頻率限制查詢 `AdminLog`（`actorId` 字串比對、`metadata` JSON path 篩選），該表僅有 `[category, createdAt]`/`[createdAt]` 索引 | Production 規模下 `adminLog.count()` 查詢效能可能隨資料量成長而下降 | 見 [[19-Security-Review]]「Production requirement」；本機規模下 Real API tested 無明顯延遲，非本 Commit 阻塞項 |
| `/prayfor/[id]` 同時存在兩套全螢幕陪伴 UI 概念 | Commit C1 新增的「聆聽大家的禱告」→ `CompanionOverlay.js`，與 `GlobalPlayer.js` 既有內建的 companion-overlay 並存（兩者共用同一個 `AudioContext`，資料不會不一致，但視覺上是兩種不同 UI） | 使用者可能在同一頁面看到兩種不同樣式的全螢幕陪伴介面，體驗不一致 | 已記錄於 [[27-Shared-Prayer-Interaction-Audit]]「已知重疊」；使用者已在 Commit C1 執行前明確選擇「不修改 `GlobalPlayer.js`」（見 AskUserQuestion 決策），完整統一為後續技術債 |
| 本機開發 DB 的 migration 歷史在乾淨環境重放未經驗證 | `prisma migrate dev` 在 Commit 1 執行時因既有（非本次新增）migration `20251010_add_token_reward_tables` 於 shadow DB 重放失敗（`Table 'user' already exists`），改用手動 SQL + `prisma db execute` 繞過，未修復根本原因 | 若未來需要在全新環境（Production、CI、其他開發者機器）從零套用完整 migration 歷史，可能會在同一個既有 migration 上失敗，阻擋部署 | 記錄於 [[28-Prayed-Reaction-Design]]；建議未來另一輪專門處理 migration 歷史整潔度，不在本次 Commit 1 範圍內（風險非本次引入，只是本次執行時才被發現） |
| 本機開發 DB 與 `schema.prisma` 存在既有 drift | `prisma db push` 偵測到 `home_prayer_card.visibility`（31 筆非空值）、`token_transaction.direction`（1 筆非空值）、`token_transaction_type` 的 `TRANSFER` enum 值，以及孤兒表 `api_rate_limit_bucket`，皆存在於 DB 但不在目前 `schema.prisma` 中 | 若未來有人對這個開發 DB 執行 `prisma db push`（非本次使用的 `db execute`）會意外刪除這些既有欄位/資料 | 記錄於 [[28-Prayed-Reaction-Design]]；本次已避開 `db push`，改用不做 drift 同步的 `db execute`；建議之後確認這些欄位是否該補回 `schema.prisma`（若仍在使用）或正式棄用（若已廢棄） |
| Prayed reaction 的 rate limit 查詢無專用索引 | `prisma_prayed_reaction` 只有 `[prayerId]`、`[ipHash, createdAt]` 索引，guest 維度的查詢（`actorType`+`actorKeyHash`+`createdAt`）目前無複合索引 | Production 規模下查詢效能可能隨資料量成長下降，性質與既有的匿名檢舉 rate limit 風險相同 | 見 [[19-Security-Review]]；本機規模下 Real API tested 無明顯延遲，非本 Commit 阻塞項 |
| Production Storage 是否為 ephemeral filesystem 無法確認 | `docker-compose.yml` 只有本機開發設定，找不到 Production 部署設定檔（Cloud Run YAML 等）明確說明 `public/voices`/`public/uploads` 是否掛載持久化磁碟；`objectDriver.js` 存在但未串接雲端 SDK | 若 Production 實際跑在 ephemeral filesystem（例如 Cloud Run 預設），每次重新部署會遺失所有已上傳音檔 | **Production Blocker**，見 [[19-Security-Review]]「Storage 與直接 URL」；部署前必須確認並視需要完成 object storage 串接，非本機開發階段可獨立解決 |
| Android Chrome／iOS Safari 完全未經測試 | 開發環境沒有真實行動裝置，本輪 Commit 2 的人工驗證矩陣（[[24-Manual-QA]]）這兩欄全部是 Not Tested | 無法確認錄音/播放/觸控互動在真實行動瀏覽器上的實際行為，尤其 iOS Safari 對 MediaRecorder/Autoplay 政策常有特殊限制 | 需要人工在真實裝置上完整補測一輪，見 [[24-Manual-QA]]「人工驗證矩陣」 |
| PrayerRecorder 的雙擊送出防護／卸載清理僅程式碼審查 | 需要真實麥克風才能進入 preview/uploading 狀態，此環境無法授權裝置 | 無法確認「送出中雙擊」「錄音中卸載元件」等邊界情境在真實裝置上是否真的如程式碼所預期運作 | 程式邏輯已審查確認存在對應防護，需要人工在真機補測，見 [[24-Manual-QA]]「Recorder／Companion 壓力測試結果」 |
| 卡片語音上傳會產生孤兒音檔 | 採兩段式（先上傳取得 URL，再隨表單送出），使用者取消建卡或按「移除」時，伺服器上已寫入的檔案不會被刪除 | Storage 空間逐步累積無主檔案 | 需要清理機制或改為「建卡成功後才落地」；記錄於 [[29-Card-Voice-Message]] DEC-C |
| 卡片語音上傳未經任何 moderation | `POST /api/customer/cards/voice` 只引用 `voiceModeration.js` 的長度/大小常數當上限，未呼叫審核流程；卡片語音不會進入既有 `PrayerResponse` 的 moderation 佇列 | 不當內容可能直接出現在公開卡片上，且後台無對應審核入口 | 需決定卡片語音的審核策略；見 [[29-Card-Voice-Message]]、[[19-Security-Review]] |
| 卡片語音沿用同一個 ephemeral filesystem 儲存層 | 與匿名語音回應相同，`writeFile` 直接寫本機磁碟（`voices/prayer-cards/<userId>/`） | 繼承同一個 Production Blocker：重新部署後檔案消失 | 與上方「Production Storage 是否為 ephemeral filesystem」為同一項，一併解決 |
