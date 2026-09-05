---
tags: [start-pray, index]
---

# Start Pray — 專案知識庫索引

## 一句話說明
Start Pray 是一個線上禱告分享平台：使用者可以建立禱告卡片、錄音/文字回應他人的禱告、在 3D 地球上瀏覽全球禱告，並附帶完整會員系統與管理後台。

## 目前狀態（2026-09-02 更新）
- 底層產品仍是功能完整、已上線的系統，包含會員（註冊/登入/個人中心）、管理後台、Cesium 3D 地球（`/global-prayer-room`）、既有語音回應（`VoicePrayerOverlay.js`）、代幣獎勵系統——這些**都還在，一行都沒刪**
- 分支 `poc/minimal-prayer-redesign` 已累積 11 個 Commit，HEAD 為 `c6b5b7d`（`docs: complete final acceptance and release readiness review`）
- 匿名體驗主線已完成：極簡首頁 → 匿名錄音投稿 → 左右滑動瀏覽 → 陪伴模式播放 → 匿名檢舉 → 「我已為你禱告」反應 → CSRF/Origin 加固，皆已 Real API/Browser tested
- **工作目錄有一組尚未提交的產品程式碼**：禱告卡語音留言（`CardVoiceRecorder` + `POST /api/customer/cards/voice`），屬於 customer-portal 的登入者功能，不在匿名首頁主線上，詳見 [[29-Card-Voice-Message]]
- 未解的上版阻礙：ephemeral filesystem 音檔儲存（Production Blocker，見 [[19-Security-Review]]）、真實麥克風與真實行動裝置皆 Not Tested

## 最終目標
收斂成一個「匿名、免登入、三秒理解、一鍵錄禱告」的極簡首頁體驗：陌生人進站即可錄音、送出、播放他人禱告、按下「我為你禱告」，全程不需註冊或登入。詳見 [[01-Product-Vision]]。

## 文件索引
| 文件 | 內容 |
|---|---|
| [[01-Product-Vision]] | 產品願景、核心價值、設計原則 |
| [[02-Current-Architecture]] | 目前技術架構完整盤點 |
| [[03-Current-Feature-Inventory]] | 目前所有功能清單 |
| [[04-Current-User-Flows]] | 目前實際存在的使用者流程（Mermaid） |
| [[05-Data-Model]] | 資料表與欄位、User ID 依賴分析 |
| [[06-Authentication-Dependencies]] | 登入系統依賴地圖 |
| [[07-Target-MVP]] | 極簡 MVP 範圍定義 |
| [[08-Target-User-Flows]] | 目標使用者流程（Mermaid） |
| [[09-Change-Impact-Analysis]] | 改造影響分析 |
| [[10-Implementation-Plan]] | 分階段實作計畫（Phase 0-5） |
| [[11-Decision-Log]] | 決策紀錄 |
| [[12-Change-Log]] | 變更歷程 |
| [[13-Risk-Register]] | 風險登記 |
| [[14-Open-Questions]] | 待確認事項彙整 |
| [[15-Acceptance-Criteria]] | 各 Commit 驗收條件彙整 |
| [[16-Final-Acceptance-Report]] | Phase 1（Commit 1+2）階段性驗收報告 |
| [[20-Anonymous-Submission-Design]] | 匿名投稿架構設計（Commit 4 前置分析） |
| [[21-Recorder-State-Machine]] | 首頁錄音狀態機說明（Commit 3） |
| [[22-API-Changes]] | 匿名投稿 API 設計草案（Commit 4 前置分析） |
| [[23-Database-Migration]] | 資料模型變更與本地 Migration 計畫（Commit 4 前置分析） |
| [[24-Manual-QA]] | 人工 QA 步驟 |
| [[25-Companion-Mode-Reuse-Audit]] | 陪伴模式重用盤點 |
| [[26-Anonymous-Reporting-Design]] | 匿名檢舉設計 |
| [[27-Shared-Prayer-Interaction-Audit]] | 首頁／詳情頁互動共用盤點 |
| [[28-Prayed-Reaction-Design]] | 「我已為你禱告」反應設計 |
| [[29-Card-Voice-Message]] | 禱告卡語音留言（工作目錄，未提交） |

## 本次分析資訊
- 文件最後更新日期：2026-09-02
- Repository branch：`poc/minimal-prayer-redesign`
- 最新 commit：`c6b5b7d`（`docs: complete final acceptance and release readiness review`）
- Base branch/commit：`main` @ `4f06e73aa95724ecb68bc5e0c8e4db8041f50ece`（未變動）
- Working tree：`customer-portal/create`、`customer-portal/edit/[id]`、`usePrayerRecorder.js` 已修改；`CardVoiceRecorder.js`、`api/customer/cards/voice/`、`tests/card-voice-recorder.test.mjs` 為未追蹤新檔；另有 post-commit hook 自動更新的 xlsx（非產品程式碼）

## 下一個建議行動
1. 決定 [[29-Card-Voice-Message]] 的去留：補上缺失的 CSS、處理孤兒音檔與 moderation 缺口後提交，或先擱置
2. 處理 [[19-Security-Review]] 的 ephemeral filesystem Production Blocker——所有語音功能（匿名回應、卡片語音留言）都卡在同一個儲存層
3. 補真實麥克風與真實行動裝置的驗證（[[24-Manual-QA]] 中目前誠實標記為 Not Tested 的欄位）
4. 依 [[16-Final-Acceptance-Report]] 的結論決定是否合併回 `main`
