---
tags: [start-pray, mvp, target]
---

# 目標 MVP 定義

參見 [[01-Product-Vision]]、[[08-Target-User-Flows]]、[[09-Change-Impact-Analysis]]。

## MVP 首頁只聚焦
- 一句主要訊息
- 一個主要錄音按鈕
- 麥克風授權
- 3、2、1 倒數
- 錄音狀態
- 停止錄音
- 播放確認
- 重新錄製
- 送出
- 投稿完成
- 播放其他人的禱告
- 我為你禱告

## 除非有明確必要，不應出現
登入、註冊、地球、複雜導覽列、個人中心、排行榜、追蹤、按讚、社交關係、大量分類、複雜設定

## 現況支援程度對照（2026-08-04 更新，反映 Commit 1-3 後的實際狀態）

| MVP 步驟 | 現況支援程度 | 依據 |
|---|---|---|
| 一句主要訊息 | **已實作** | 首頁改用 `HomePrayerHero.js`，單一標題+說明+CTA，Browser tested |
| 一個主要錄音按鈕 | **已實作** | 首頁第一屏唯一 CTA，點擊後切換成 `PrayerRecorder`，Browser tested |
| 麥克風授權 | **已實作**，Real microphone Not Tested | `usePrayerRecorder.js`；權限拒絕/不支援路徑已 Browser tested（真實瀏覽器行為） |
| 3、2、1 倒數 | **已實作**，Real microphone Not Tested | `usePrayerRecorder.js` 的 `beginCountdown` |
| 錄音狀態 | **已實作**，Real microphone Not Tested | 計時、剩餘秒數、60 秒自動停止 |
| 停止錄音 | **已實作**，Real microphone Not Tested | — |
| 播放確認 | **已實作**，Real microphone Not Tested | Preview 狀態含播放/暫停 |
| 重新錄製 | **已實作**，Real microphone Not Tested | 含「確定要重新錄製嗎？」確認對話框 |
| 送出 | **未實作（Prototype 提示）** | 「下一步：匿名送出」點擊後僅顯示「錄音已準備完成，匿名送出功能將在下一階段接入。」，不呼叫任何 API；文字回應/建立卡片本身仍可透過既有 `/customer-portal/create`、`/prayfor/[id]` 走既有（非首頁整合）路徑匿名送出 |
| 投稿完成（成功畫面） | **未實作** | 需等 Commit 4 匿名投稿 API 接上後才有真正的成功畫面 |
| 播放其他人的禱告 | 部分支援（非首頁） | `/voices/[...path]` 無需登入即可播放，但**首頁本身尚未有聆聽區塊**（Commit 6 範圍） |
| 我為你禱告 | 部分支援／待確認（非首頁） | 同上，首頁尚無此區塊 |
| 上傳失敗與重試 | **未實作** | 尚未接上傳 API，無從測試失敗/重試 |
| 麥克風授權失敗處理 | **已實作** | 「無法使用麥克風」+「再試一次」/「返回」，Browser tested |

## 缺口總結（需要在 [[10-Implementation-Plan]] 中排入）
1. ~~首頁需要重新設計為單一訊息 + 單一行動~~ **已完成**（Commit 2）
2. ~~麥克風權限/倒數/錄音/預覽/重錄~~ **已完成**（Commit 3，前端邏輯；Real microphone Not Tested）
3. 語音送出需移除登入檢查、匿名投稿 API、Schema、Storage、Rate limit、管理 Token — 見 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]]（**尚未核准實作**）
4. 需要「投稿完成」的明確回饋畫面（依賴 Commit 4 匿名投稿 API）
5. 需要獨立的「我為你禱告」一鍵互動與首頁聆聽區塊（Commit 6、7 範圍）
6. 上傳失敗與重試需要真正的上傳 API 才能實作與測試
