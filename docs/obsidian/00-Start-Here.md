---
tags: [start-pray, index]
---

# Start Pray — 專案知識庫索引

## 一句話說明
Start Pray 是一個線上禱告分享平台：使用者可以建立禱告卡片、錄音/文字回應他人的禱告、在 3D 地球上瀏覽全球禱告，並附帶完整會員系統與管理後台。

## 目前狀態（2026-08-04 更新）
- 底層產品仍是功能完整、已上線的系統，包含會員（註冊/登入/個人中心）、管理後台、Cesium 3D 地球（`/global-prayer-room`）、既有語音回應（`VoicePrayerOverlay.js`）、代幣獎勵系統——這些**都還在，一行都沒刪**
- 在獨立分支 `poc/minimal-prayer-redesign` 上，已完成三個 Commit（**皆為前端/文件改動，未動 Schema/API/Storage**）：
  1. `6b8cc84` 導覽與頁尾收斂（隱藏登入/註冊/會員中心/全球禱告室入口，路由本身保留）
  2. `04538e7` 首頁改用極簡 `HomePrayerHero`（不再顯示地球/GlobeSkeleton/統計數字）
  3. `a69ae05` 首頁整合本地錄音前端流程（`src/components/prayer-recorder/`）——**權限/倒數/錄音/預覽/重錄皆已實作，但尚未接上匿名投稿 API，也尚未用真實麥克風完整測過**
- 已經內建**部分匿名投稿基礎設施**（文字回應免登入、`guestSessionHash`/`ipHash` 追蹤機制），語音送出目前仍被 `VOICE_LOGIN_REQUIRED` 卡關，尚未處理
- 目前正在做 Commit 4（匿名投稿）前的**純讀碼依賴分析**，尚未修改 Schema、API 或 Storage

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

## 本次分析資訊
- 文件最後更新日期：2026-08-04
- Repository branch：`poc/minimal-prayer-redesign`（原始盤點時是 `main`）
- 最新 commit：`a69ae05`（`feat: integrate prayer recording flow into homepage`）
- Base branch/commit：`main` @ `4f06e73aa95724ecb68bc5e0c8e4db8041f50ece`（未變動）
- Working tree：僅剩 post-commit hook 自動更新的 xlsx 追蹤檔（非產品程式碼）
- 環境基準：`npm run lint`、`npm run build` 通過；新增 `npm run test:unit`（`node --test tests/`，7/7 通過）與既有 `npm run i18n:check`（462 keys 一致）

## 下一個建議行動
1. 使用者複核 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]] 的匿名投稿設計草案
2. 針對 [[14-Open-Questions]] 中的待確認事項給出裁示
3. 在 [[11-Decision-Log]] 中確認 DEC-004（匿名投稿）、DEC-007（匿名管理 Token）的最終方案
4. 決策確認後，才開始 Commit 4A（Schema）等實作步驟——目前尚未核准，不得修改 Schema/API/Storage
