# Start Pray 訪客重複錄音與上傳驗證

日期：2026-10-02（台北）。使用者描述：電腦、未登入、回應他人的代禱，第一次正常，後續可能讀不到聲音；沒有可穩定重現的操作或錯誤訊息。

## 結論與證據邊界

找到並修正了能造成第二次無聲的串流重用問題，以及關閉錄音視窗時未完整清理音訊資源的問題。已透過真正的瀏覽器 MediaRecorder、解碼、Comments 表單及 POST /api/responses 完成兩次本機訪客上傳。

這是受控重現，使用 440 Hz 合成音源；未讀取實體麥克風，未啟用瀏覽器語音辨識。它證明程式在舊串流變靜音時會失敗，以及修正後可恢復；不能單憑這次測試判定使用者當時的唯一原因。尚需在使用者實際瀏覽器與麥克風復測。

## 原有問題

- VoicePrayerOverlay 的重新錄製只檢查舊 track 的 readyState，若為 live 就直接沿用。live 是生命週期狀態，不保證持續收到聲音；muted/disabled 等狀態可令音訊變成靜音。參考 [MDN MediaStreamTrack](https://developer.mozilla.org/en-US/docs/Web/API/MediaStreamTrack/enabled)。
- 完成後直到上傳前仍保留麥克風串流；卸載只停 track/RAF，沒有完整關閉 input AudioContext 和取消 SpeechRecognition。重新打開視窗可能累積資源或留下前次辨識工作。這是程式碼確認的清理缺口，未以實體裝置量測資源耗盡。
- usePrayerRecorder 在靜音/解碼失敗等錯誤分支可能保留舊串流；再次請求權限會覆蓋 ref，令原串流無法被正常清理。
- 同卡兩分鐘冷卻期間，文字送出按鈕顯示倒數，語音入口仍可使用，使用者可能錄完才得知不能再次送出。這是上傳限制，與檔案無聲不同。

## 修正

- 每次重新錄製都取得新串流；完成並取得最後 chunks 後立即釋放麥克風。
- 完成、取消、卸載或失敗時釋放串流、關閉音量分析 context、取消辨識、撤銷舊預覽 URL。輸入 context 若 suspended，嘗試 resume。
- 麥克風權限請求完成時核對操作代次/是否已離開，避免使用者關閉後又開始錄音；過期結果取得的 tracks 立即停止。
- 過期錄音/辨識事件不得修改新的一段錄音；mute 後恢復輸入時重建音量分析。
- 同卡冷卻期間停用語音入口，顯示剩餘秒數。送出失敗仍保留錄音，可重送。

檔案：Comments.js、VoicePrayerOverlay.js、prayer-recorder/usePrayerRecorder.js、theme-detail.css；新增 recorder-lifecycle.test.mjs，更新 media.md。

## 使用者流程測試

建立兩張有明確 QA slug 的本機測試卡，使用本機 localhost 的 prayercoin_dev。測試頁載入真正 Comments 元件；測試 adapter 只替換麥克風輸入，錄音器/檔案/解碼與上傳 API 使用原本的實作。第一條輸入在第一段完成後被刻意模擬為仍 live 但 muted，後續新輸入皆正常。

修正前：開啟語音 → 第一次錄製 → 預聽 → 重新錄製 → 完成。

| 段落 | 使用串流 | 解碼秒數 | 大小 bytes | peak | 結果 |
|---|---|---:|---:|---:|---|
| 第一段 | 1 | 10.92 | 176133 | 0.15136 | 可預聽 |
| 第二段 | 仍為 1 | 12.24 | 3193 | 約 2×10^-34 | 靜音，被前端阻止送出 |

修正後：第一次錄製 → 重新錄製 → 預聽 → 訪客上傳 → 再留一則 → 再錄 → 同卡冷卻提示 → 保留錄音 → 換卡 → 再錄與上傳。

| 段落 | 使用串流 | 解碼秒數 | 大小 bytes | peak | 結果 |
|---|---|---:|---:|---:|---|
| 第一段 | 1 | 34.20 | 551309 | 0.15167 | 完成後釋放串流 |
| 重新錄製 | 新的 2 | 20.64 | 332785 | 0.15167 | 預聽及訪客上傳成功 |
| 上傳後再錄 | 新的 3 | 10.80 | 174201 | 0.15196 | 同卡冷卻擋住送出，錄音保留 |
| 換卡再錄 | 新的 4 | 28.32 | 456545 | 0.15196 | 第二次訪客上傳成功 |

兩筆寫入皆 isAnonymous=true、responderId=null、voiceModerationStatus=APPROVED。上傳後的站內 /voices 媒體皆 HTTP 200，取得 bytes 與磁碟檔案完全相同；瀏覽器媒體播放器 paused=false、readyState=4、error=null。

同卡冷卻提示最初由前端擋下，沒有為這筆額外呼叫 POST；沒有繞過 rate limit。新增的入口倒數已在瀏覽器確認。

測試完已刪除那兩張生成的卡片、兩筆回應與對應測試錄音，移除暫時測試路由並關閉測試伺服器。識別資料、量測 JSON 和截圖保留在本機忽略目錄 .codex-voice-qa，沒有上傳正式環境。

## 檢查

- 單元測試 85/85 通過，新增 6 個錄音生命週期案例：新串流、context/辨識清理、權限晚回、解碼前釋放、共用引擎先清理舊來源、靜音失敗清理。
- lint 無 warning/error；git diff --check 無 whitespace error，有 Windows LF/CRLF 提示。
- build 成功，產生 91 個頁面；暫時測試路由沒有進入最終 build。未修改 API、Prisma schema 或 migration。
- 既有提示為 Browserslist 資料過期與 Node MODULE_TYPELESS_PACKAGE_JSON，沒有改動依賴或全專案模組設定來消除提示。
- 尚未測試真實麥克風/作業系統裝置切換、瀏覽器語音辨識、Safari/手機。英文錄音視窗中文文字問題仍是上一輪記錄的待辦。

修正只在本機，未 push 或部署。PROD 使用者還不會收到這次修正。
