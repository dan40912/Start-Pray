# Start Pray 動效施工交接：批次 2–6

**用途：** 直接交給實作者。以 [`apple-fluid-motion-plan.md`](./apple-fluid-motion-plan.md) 的設計理由為背景；本文件的施工邊界與驗收條件優先。Codex 負責逐批 review。批次 1 已通過並整合進本地 `main`（`bba832d`＋修正 `756279a`）；新 worktree 應從最新 `main` 開始並明列基底 commit。

## 共通施工規則

1. **一批一個可辨識的 commit／diff，做完就停下來交 review。** 批次未通過前，不接著改下一批；不把批次 2–6 合成一個大 PR。批次 6 分成「決策與資料格式」和「實作」兩次 review。
2. 開工時執行 `git status --short`、`git branch --show-current`、`git worktree list`，確認使用獨立 worktree／`codex/` 分支。不要清理、搬動或提交原目錄未追蹤文件與進度試算表。以開始時的最新已整合程式碼為基底；若前一批尚未合併，明列依賴的 commit。
3. 先對照 [`execution-handoff-2026-09-27.md`](../execution-handoff-2026-09-27.md) 的 A／B1／B2／C1 寫入範圍。獨立 worktree 可以施工，但碰到同檔時須在交付中列出與其他分支的整合點；共用 checkout 則須先取得該檔的單一寫入時段。不得默默覆蓋別人的變更。
4. 保留 Start Pray 的暖金、日／夜色票和既有資訊層級。先驗證互動與內容，再調整動效。減少動態仍須有可辨識的狀態，不做全站 `animation: none !important`。錄音與真人回應優先保護，不能為特效犧牲資料。
5. 每批交付：改動目的、檔案／commit／diff、使用者可見差異、可重現操作證據、`npm run lint` 與相關測試結果。改到 server component、API、Prisma 或建置路徑時跑 `npm run build`。實機、讀屏、瀏覽器與效能若未測，明列「未驗證」，不把模擬事件寫成實機通過。附最後 `git status --short`。

## 批次 2：首頁代禱卡輪播

**開工時點：現在可以在獨立 worktree 開始。** [`execution-handoff-2026-09-27.md`](../execution-handoff-2026-09-27.md) 的 B2 可寫檔案沒有列 `HomePrayerHero.js`；本批指定持有 `src/components/HomePrayerHero.js`。與 B2 共用的 CSS 若需要改，先列出檔案與整合點，避免兩邊同時寫。不要順手重排首頁或禱告牆；若 B2 後續要改 hero，須先協調範圍。

**施工：**

1. 保留現有整副牌預載、鄰卡預覽、循環、垂直捲動判斷與錄音保護；換卡不加 skeleton。
2. 把 `pointerup` 與 `pointercancel` 分開。取消只能回到目前卡片，不能切卡或開連結。修正拖曳後的 click 抑制，避免 `dragRef` 清空後誤點。只接受同一個 pointer；capture 遺失、卸載和頁面隱藏要安全收尾。
3. 回位與切卡從畫面當下位置接續；飛行中再次抓取可立刻反向拖，不跳到尚未抵達的目標。若使用速度判斷，記錄最近約 80–120ms 的位置並將速度交給收尾動畫；初版最多切相鄰一張。若沿用 CSS 無法做到可中斷，再選 spring/helper，並處理 `requestAnimationFrame` 清理。
4. 錄音中不開始切卡；有未送出的預聽時，先走現有取消確認，使用者確認捨棄後才換卡。不得讓動畫或指標事件繞過確認。
5. 減少動態時改用靜態或短淡入，仍清楚顯示目前卡片；鍵盤換卡與焦點位置保持可用。

**驗收證據：** 慢拖回位、快速輕甩、反向抓取、連續操作、`pointercancel`、垂直捲頁、卡片數為 0／1／2、鍵盤換卡、拖曳後不誤開連結；錄音、預聽、上傳與取消確認都正常。提供手機錄影或逐步可重現操作；若報效能改善，附同裝置前後量測。

## 批次 3：選定控制項的按壓回饋與輸入字級

**開工時點：** B1／B2／C1 對應頁面的同檔變更已完成或可明確整合。先列出要改的元件與 CSS，再施工；`globals.css` 不與 C1 共用寫入時段。

**施工：**

1. 只選首頁主要入口、代禱卡動作、詳情主要動作與播放器控制的代表元件。按下立即有可見回饋，滑開可取消；優先用背景、邊框、陰影，縮放僅在不與現有 transform 衝突時用小幅度。不要新增全站 `button:active { transform: scale(...) }`。
2. 對選定控制項檢查至少 44×44 CSS px 的實際點擊區，主要按鈕可朝 52px 靠；保留 hover、disabled 與鍵盤 `:focus-visible`，減少動態時也要有非位移回饋。
3. 列出 `/me/create`、登入、註冊、詳情回應表單、後台登入的實際 input／textarea，讀**計算後**的 `font-size`。只修低於 16px 的欄位與受影響 padding；不要宣稱改 `.form-control` 一處就覆蓋所有表單。輸入欄位和按鈕都要有清楚的焦點輪廓。
4. 若無 iPhone Safari，仍完成可在本機核對的 CSS 與版面檢查，但把「聚焦時不放大整頁」列為待實機驗證，不宣稱通過。

**驗收證據：** 逐元件列出改前／改後的按下、滑開、hover、鍵盤、disabled 狀態；逐表單列計算後字級；檢查首頁、禱告牆、詳情、建立代禱及 nav/footer 在手機寬度沒有跳位或溢出。

## 批次 4：錄音面板狀態與進出場

**開工時點：** B1 的 `theme-detail.css` 與回應區改動已 review；與批次 6 的 `VoicePrayerOverlay.js` 寫入時段分開。

**施工：**

1. 先盤點麥克風權限、倒數、錄音中、處理、預聽、錯誤、取消與完成狀態；改善狀態切換和開關面板的方向一致性。非手勢進出場可用短 transition；不得用動畫延後錄音開始、停止或錯誤訊息。
2. 保留既有關閉按鈕與取消語意。本批**不做整片面板下拉關閉**，也不對 `.vpo-panel` 加 `touch-action: none`。長內容須能捲動；錄音中與未送出預聽不能被滑動誤關。
3. 用現有 day/night token 微調表面和焦點；波形已有 Web Audio／CSS fallback，不重寫辨識或波形架構。減少動態時保留狀態回饋但去掉大幅位移。
4. 檢查 Escape、背景遮罩、焦點返回及資源釋放仍走現有取消流程；拒絕麥克風權限、`AudioContext` 失敗及不支援辨識時仍能理解當前狀態。

**驗收證據：** 開啟、取消、錯誤、錄音、處理、預聽與完成的畫面或操作紀錄；長內容與虛擬鍵盤、日／夜、減少動態、Escape／焦點。未能用真實麥克風測的情境逐項標示。

## 批次 5：浮動材質與中文排版

**開工時點：** B2 已 review；`theme-modern.css` 與批次 1 的最終版本已整合。與批次 3 的 token／全域 CSS 改動分開 review。

**施工：**

1. 只在確實浮於捲動內容上方的頁首或工具列試半透明材質；內容卡維持實色。日／夜、圖片與文字背景都要可讀。`backdrop-filter` 不支援、減少透明度和高對比時改實色與清楚邊界。
2. 若調頁首高度，同步核對 nav 換行、選單、body 預留空間、anchor 的 scroll padding 與安全區；不得只改單一高度 token 就宣稱完成。
3. 中文排版只選首頁標題、代禱正文、詳情標題與表單說明做前後比較。依實際斷行調字距與行高，不對全站 `p, li` 套統一值，不把 POC 的松綠、紙白、底部分頁或圓角搬進現站。

**驗收證據：** 320／390／430／768／1440px、日／夜、繁中與英文長標籤、放大字、減少動態／透明度、高對比與 blur fallback 的前後畫面；頁首不遮內容，最不利背景上的文字仍可讀。未量測對比或效能時不要宣稱改善。

## 批次 6A：同步字幕的決策與資料格式（已完成）

6A 決策已交付於 [`batch6a-caption-decisions.md`](./batch6a-caption-decisions.md)，並已整合進本地 `main`（`0f5c930`＋Codex review 修訂 `07bce9f`）；6B 以修訂版為準，不能只按下方原始提綱施工。

**本階段只交可 review 的決策文件、資料格式與 migration 草案；不改公開 API，不套正式資料庫。** 先以目前程式碼重新確認錄音、回應送出、公開 GET 與所有播放入口。建議以以下預設提出方案，若程式碼事實反對，附證據調整：

1. 手機維持不啟用即時辨識，避免第二次開啟麥克風讓 Android 錄音變成無聲。手機可在確認畫面**選擇性手動補文字**；未補打時純語音照常送出。手動文字若沒有可信的逐句時間，不製造假同步時間。伺服器或第三方 STT 屬獨立提案。
2. 桌面辨識結果可保留逐句資料，但現有 `performance.now()` 是辨識抵達時間，不保證對齊音檔。只有通過合理性檢查的片段才同步 highlight；其餘退回可讀的完整文字。
3. 第一階段只在 `GlobalPlayer` 沉浸畫面做逐句同步；其他語音入口須能看到完整文字，不能因沒有自訂播放器而讓字幕不可取得。完整文字先對讀屏可讀，再評估是否需要當前句播報；不要直接複製 POC 的 `aria-live="polite"`。
4. 統一 segment 格式（建議 `{start, end, text}`，秒為單位），定義空值、手動文字、桌面片段及舊資料的表示法。若要存 `transcriptJson`、`transcriptStatus`、`audioDurationSeconds`，欄位須 nullable、無 NOT NULL、無 backfill；migration 只在本機／測試環境驗證，舊筆數前後一致。交付具體 schema 與 migration 草案供 review。
5. 明列字幕和 `message` 的關係。若字幕文字與 `message` 不同，公開前仍須受到同等的長度、連結／濫用檢查與審核，不能讓另一個文字欄位繞過現有規則。提出伺服器驗證：segment 陣列與欄位型別、段數及總字數上限、有限非負時間、起訖與排序、音檔時長上界、與音訊一起提交的關係；非法資料要拒絕或降級，不能只信前端。
6. **核對真實公開邊界：** `GET /api/responses/[homeCardId]` 同時要求 `moderationStatus: APPROVED`、`voiceModerationStatus` 通過、回應本身 `isBlocked: false`；私密或封鎖的卡片回 404。`responder.isBlocked` 被 select，現行 GET 沒有據此過濾帳號。區分「封鎖的回應」和「封鎖的回應者」，不要把後者寫成現有保障，也不要順手更改公開政策。

**6A 交付／review：** 資料流圖或簡表、格式範例、手機有／無手動文字兩條流程、每個播放入口的完整文字位置、審核矩陣、伺服器驗證規則、schema／migration 草案、舊資料退路與未決事項。這些有可核對的答案後，Codex review；通過才進 6B。

## 批次 6B：同步字幕實作（6A 通過後）

**開工時點：** B1 的 `Comments.js` 已 review；批次 4 的 `VoicePrayerOverlay.js` 已整合。6A 已通過，但不解除這兩個同檔整合條件。以 [`batch6a-caption-decisions.md`](./batch6a-caption-decisions.md) 修訂版為具體資料規格，修改錄音端、`Comments.js`、`/api/responses`、Prisma migration、公開 GET、`GlobalPlayer` 沉浸畫面及必要的完整文字 UI。不得更改私密卡公開規則或在手機重啟即時辨識。

**施工順序：** 先做 nullable schema／migration 與 API 驗證，再傳遞錄音片段／手動文字，最後做公開投影與播放 UI。舊回應與空字幕必須能照常播放。公開 GET 只在原有兩個審核狀態與回應／卡片可見條件都通過時輸出字幕；POST 的建立回應僅是送出者取得的結果，不能用它代替公開 GET 驗收。靜態完整文字要能讀屏取得，逐句高亮不反覆打斷閱讀；手動捲動後停止自動跟隨並提供恢復方式。減少動態時不做字幕位移／縮放。

**驗收證據：** 手機未補字／手動補字、桌面有片段／辨識失敗、舊回應 `NULL`、錯誤時間資料、編輯後文字、音訊上傳失敗都能得到正確退路。以真實請求分別驗證 `moderationStatus` 未核准、`voiceModerationStatus` 未核准、回應封鎖、私密卡、封鎖卡不外洩字幕；不要把帳號封鎖當成既有過濾條件。檢查所有播放入口的完整文字、沉浸畫面的同步與讀屏；跑 `npm run lint`、`npm run build`、相關單元／API 測試和本機 migration 檢查。正式資料庫套用與部署另循發布流程。
