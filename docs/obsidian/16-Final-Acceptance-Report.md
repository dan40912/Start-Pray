---
tags: [start-pray, acceptance, final]
---

# Start Pray 最終驗收報告

參見 [[10-Implementation-Plan]]、[[12-Change-Log]]、[[13-Risk-Register]]、[[15-Acceptance-Criteria]]、[[19-Security-Review]]、[[24-Manual-QA]]、[[27-Shared-Prayer-Interaction-Audit]]、[[28-Prayed-Reaction-Design]]。

> **取代前版**：本文件先前版本（`Phase 1 Interim Acceptance Report`）只驗收 `poc/minimal-prayer-redesign` 分支上最早的兩個 Commit。以下是涵蓋整個分支（`main` 到目前 HEAD，共 11 個 Commit）的完整驗收報告，2026-08-05 重新以 `git log --oneline --decorate main..poc/minimal-prayer-redesign` 實際核對過 Commit 數量與清單，**不採用先前文件中曾經出現過的「8 個 Commit」這個過時、未核實的數字**。

## Executive Summary

- **是否達成產品目標**：核心目標（未登入訪客可瀏覽真實代禱需要、錄音回應、聆聽陪伴、檢舉不當內容、表示已代禱）在程式碼層級**已全部實作**，且絕大多數已用真實 API/瀏覽器互動驗證（非純程式碼審查）。首頁與 `/prayfor/[id]` 共用同一套核心互動元件，未建立第二套錄音/播放/檢舉邏輯。
- **是否可進入人工驗收**：**可以**。所有 Desktop Chrome 可驗證的路徑皆已 Real tested；真人操作才能驗證的項目（真實麥克風錄音、Android/iOS 真機互動、實際聽感）已明確列出，需要人工在真機補測一輪。
- **是否可部署**：**不可以**。至少有一項未解的 Production Blocker（Storage 是否為 ephemeral filesystem 無法從本 repo 確認）與一項未驗證的 migration 歷史重放風險，詳見「Production requirements」。
- **最嚴重三項風險**：
  1. **Storage 持久化未知**（Production Blocker）：若 Production 實際跑在 ephemeral filesystem，每次重新部署會遺失所有已上傳音檔，見 [[19-Security-Review]]
  2. **Migration 歷史在全新環境的可重放性未驗證**：本次為了新增 `PrayerPrayedReaction` 表繞過了 `prisma migrate dev`（因既有、非本次的 migration 在 shadow DB 重放失敗），改用手動 SQL 套用，未驗證這份完整歷史能否在全新環境（Production/CI）順利重放，見 [[28-Prayed-Reaction-Design]]
  3. **完全沒有真實裝置測試**：真實麥克風、Android Chrome、iOS Safari 三項全部 Not Tested，這些是 MVP 的核心互動路徑（錄音），在真機上的實際行為未經任何驗證

## Git

| 項目 | 值 |
|---|---|
| Branch | `poc/minimal-prayer-redesign` |
| Base Commit（`main`） | `4f06e73` |
| Latest Commit | `d0561ce`（`fix: harden prayer interaction flows`） |
| Commit 數量（`main..poc/minimal-prayer-redesign`） | **11**（已用 `git log --oneline main..poc/minimal-prayer-redesign \| wc -l` 實際核對） |
| Commit 清單 | `6b8cc84` `04538e7` `a69ae05` `4eaea7e` `78103e0` `51b2ee4` `ed43015` `d485b04` `4f13d72` `70a6bb5` `d0561ce` |
| 修改/新增檔案數（vs `main`） | 60 個檔案，`5940 insertions(+), 148 deletions(-)`（`git diff main...poc/minimal-prayer-redesign --stat`） |
| Working tree | 乾淨——僅 `output/spreadsheet/startpray-progress-tracker.xlsx`（post-commit hook 自動產生，未進入任何 Commit）、`.claude/`、`docs/obsidian/.obsidian/` 為未追蹤項目 |
| 是否 Push | 否 |
| 是否 Merge/PR | 否 |
| 是否 Deployment/Production migration | 否 |
| 分支內容掃描 | 已用 `git diff main...poc/minimal-prayer-redesign --name-status` 逐一核對，**沒有** `.env`、`.claude/`、xlsx、`.obsidian`、任何音訊檔案（`.wav`/`.webm`/`.mp3`）進入任何 Commit |

## Completion Matrix

完成度指「該模組規格要求的子功能，有多少比例已經在程式碼中實作」；結果欄位是整體測試狀態標籤（Passed/Blocked/Not Tested 等），兩者分開評估，避免「程式已寫」被誤讀為「已驗證完成」。

| 模組 | 完成度 | 結果 |
|---|---|---|
| 首頁（Prayer 顯示/CTA/Empty/Error/Loading） | 100% | Passed（Real Browser tested） |
| Swipe（首頁左右切換/Desktop 方向鍵） | 100% | Passed（Real Browser tested，真實 `TouchEvent`/`KeyboardEvent`） |
| Recorder（權限/倒數/錄音/停止/預覽/重錄/送出，程式碼） | 100% | Blocked（Real microphone Not Tested——僅驗證了 permission-denied 真實路徑，倒數/錄音/預覽/重錄/送出的完整流程需要真實麥克風才能測試） |
| Anonymous submit（`POST /api/responses`） | 100% | Passed（Real API tested，含文字與真實可解碼音訊上傳） |
| `/prayfor/[id]`（匿名錄音入口、Mobile 置頂、Desktop 布局） | 100% | Passed（Real Browser tested，375/390/412/1280/1440 皆確認） |
| Companion（Loop/Stop/Exit/Auto-next/清單） | 100% | Passed（Real Browser tested，含首次用真正可解碼音訊驗證完整播放生命週期） |
| X（Playlist 本地移除） | 100% | Passed（Real Browser tested，Network 面板確認零 API 請求） |
| Report（匿名檢舉） | 100% | Passed（Real API/Browser tested，含 rate limit/冪等/偽造欄位測試） |
| Prayed reaction（我已為你禱告） | 100% | Passed（Real DB/API/Browser tested，含唯一約束/rate limit/stale-response 防護） |
| Accessibility（`aria-pressed`/`aria-live`/44px/focus） | 90% | Passed（Real Browser tested 核心互動元件），部分既有頁面（`Comments.js` 等）未逐一稽核 |
| Security（CSRF/Origin/身分偽造防護） | 85% | Passed（Real tested：三支匿名 API 皆已套用 Origin 檢查），Storage/分散式 rate limit 仍是已知殘留風險 |
| Documentation | 95% | Passed（28 份 Obsidian 文件，涵蓋每個 Commit 的設計決策、真實測試證據、已知限制） |

## 完成度評估（分類，非單一百分比）

| 類型 | 完成度 |
|---|---|
| MVP 功能（程式碼層級） | 約 95%（核心流程全部實作；匿名管理 Token、字幕、「首頁下方區塊收斂」明確排除於本輪範圍，非缺失） |
| Browser 驗證（Desktop Chrome，本自動化環境） | 約 90%（絕大多數互動路徑已 Real tested；少數需要真實麥克風才能觸發的狀態機分支未覆蓋） |
| Real device 驗證（真實麥克風／Android／iOS） | 0%（此開發環境完全無法存取真實裝置，見 [[24-Manual-QA]]「人工驗證矩陣」） |
| Security readiness | 約 65%（身分偽造防護、rate limit、CSRF/Origin 已到位且 Real tested；Storage 存取控制、分散式 rate limit、signed URL 仍未處理） |
| Production readiness | 約 20%（Migration 歷史重放未驗證、Storage 持久化未知、無 Production 部署設定可稽核、無 Monitoring/Logging/Load test 規劃） |
| Documentation | 約 95%（28 份文件，含逐 Commit 的真實測試紀錄與已知限制，唯獨部分文件的交叉連結可能隨後續改動而過時） |

## Test Matrix

| 類別 | 結果 |
|---|---|
| Lint | Passed |
| Build | Passed |
| Unit | Passed（39/39，`tests/*.test.mjs` 涵蓋 recorder-utils/swipe-utils/prayer-response-report/prayed-reaction/origin-guard） |
| API | Passed（Real API tested，對本機開發 DB `prayercoin_dev` 執行，非 Mock：匿名送出、檢舉、Prayed reaction、CSRF/Origin 皆有實際 HTTP 請求驗證紀錄） |
| Browser（Desktop Chrome） | Passed（Real Browser tested，見上方 Completion Matrix 逐項） |
| Desktop（1280×800、1440×900） | Passed |
| Mobile（375×812、390×844、412×915，模擬視窗） | Passed（無橫向捲動，關鍵 CTA 在第一屏內） |
| Android（真機） | Not Tested |
| iOS（真機） | Not Tested |
| Real microphone | Not Tested |
| Real audio（真實可解碼音訊播放） | Passed（Real Browser tested，本輪新增 `scripts/dev/generate-test-audio.mjs` fixture，確認完整播放到 `ended`、UI 提示正確、Loop 循環正確觸發） |
| Authenticated member（登入會員迴歸） | Not Tested（無測試帳密） |
| Accessibility | Passed（核心互動元件：`aria-pressed`/`aria-live`/44px/focus-visible/Escape/焦點還原，Real Browser tested） |
| Security | Passed（CSRF/Origin Real tested；Storage/rate limit 為文件盤點，Not Available 於自動化環境內完整驗證分散式場景） |
| Regression | Passed（`/`、`/en`、`/prayfor/[id]`、`/global-prayer-room`、`/login`、`/signup`、`/customer-portal`、`/admin` 皆 200，Console/Server log 無新增錯誤） |

## Issues

### ACC-001：Migration 歷史在全新環境的可重放性未驗證
- **Severity**：High
- **Evidence**：`npx prisma migrate dev --name add_prayed_reaction` 執行時，shadow database 重放既有（非本次新增）migration `20251010_add_token_reward_tables` 失敗，錯誤 `P3006`/`P3018`：`Table 'user' already exists`
- **Reproduction**：在乾淨（或使用 shadow DB 機制的）環境對此 repo 執行 `prisma migrate dev`，即會在該既有 migration 上失敗
- **Impact**：無法確認未來在 Production 或 CI 環境從零套用完整 migration 歷史是否會成功；本次繞過此問題用 `prisma db execute` + `migrate resolve` 手動套用，僅解決了本機開發環境的燃眉之急
- **Recommendation**：另立一輪專門整理 migration 歷史（可能需要 squash 或修正 `20251010_add_token_reward_tables`），並在乾淨環境完整驗證一次
- **Blocking／Non-blocking**：**Blocking**（對 Production 部署而言）

### ACC-002：Storage 是否為 ephemeral filesystem 無法確認
- **Severity**：High
- **Evidence**：`docker-compose.yml` 僅有本機開發設定（bind mount 整個 repo），找不到 Production 部署設定檔明確說明音檔目錄的持久化策略；`src/lib/storage/objectDriver.js` 存在但註解明確標示「骨架，尚未串接雲端 SDK」
- **Reproduction**：檢視 repo 內所有部署相關設定檔，找不到 Cloud Run/K8s manifest 或等價文件
- **Impact**：若 Production 實際部署在 ephemeral filesystem 上，每次重新部署會遺失所有已上傳的代禱語音
- **Recommendation**：部署前向負責 Production 基礎設施的人確認實際的 filesystem 持久化策略；若不持久化，需要在部署前完成 `objectDriver.js` 的雲端 SDK 串接
- **Blocking／Non-blocking**：**Blocking**（對 Production 部署而言）

### ACC-003：完全沒有真實裝置測試
- **Severity**：Medium
- **Evidence**：[[24-Manual-QA]]「人工驗證矩陣」的 Android Chrome／iOS Safari 兩欄全數 Not Tested；Desktop Chrome 欄的「麥克風允許／倒數／錄音／停止／預覽」等項目也因為此環境無法授權真實麥克風而 Blocked
- **Reproduction**：此開發環境（Browser 自動化 + 無實體裝置）無法授權 `getUserMedia`，也沒有 Android/iOS 裝置可用
- **Impact**：MVP 的核心互動（錄音）在真實使用者裝置上的實際行為完全未經驗證，尤其 iOS Safari 對 `MediaRecorder`／自動播放政策常有平台特有限制
- **Recommendation**：人工在至少一台 Android 裝置與一台 iOS 裝置上，依照 [[24-Manual-QA]] 的步驟完整走一次錄音→送出→陪伴播放流程
- **Blocking／Non-blocking**：**Blocking**（對「可安心開放給真實使用者」而言），但**不阻擋**先進入人工驗收階段（可與人工驗收同步進行）

### ACC-004：匿名檢舉與 Prayed reaction 皆無法逐筆追蹤同一匿名者
- **Severity**：Low
- **Evidence**：見 [[26-Anonymous-Reporting-Design]]、[[28-Prayed-Reaction-Design]]，皆為刻意的設計取捨（避免為此目的新增大型資料模型）
- **Reproduction**：不適用（設計如此，非缺陷）
- **Impact**：Admin 稽核時無法看到「這個匿名訪客做過哪些操作」的完整歷史，只有粗粒度的頻率限制紀錄
- **Recommendation**：若未來需要更細緻的匿名稽核能力，需評估新增 additive schema 欄位，屬於獨立的產品決策，非本輪缺陷
- **Blocking／Non-blocking**：**Non-blocking**

## Production requirements

| 項目 | 狀態 |
|---|---|
| Migration review | **未完成**——見 ACC-001，需要在乾淨環境驗證完整 migration 歷史 |
| DB backup | 未在本輪範圍內確認 Production 備份策略是否存在 |
| Persistent Storage | **未確認**——見 ACC-002 |
| Direct audio access（已隱藏內容的音檔網址） | 已知殘留風險：`/voices`/`/uploads` 無存取驗證，隱藏機制只影響查詢層，不影響已知網址的直接存取，見 [[19-Security-Review]] |
| Distributed rate limit | 目前全數 DB-backed（非 in-memory），可安全支援多 instance，但部分查詢缺少專用索引，Production 規模下需要關注效能，見 [[13-Risk-Register]] |
| CSRF／Origin | 已完成，見 [[19-Security-Review]]；Production 部署時需設定 `ALLOWED_ORIGINS` 環境變數 |
| Monitoring | 本輪未涉及，repo 內未見既有 Monitoring 整合 |
| Logging | 沿用既有 `AdminLog` 機制，本輪新增的匿名操作（檢舉、Prayed reaction）皆有寫入對應紀錄 |
| Moderation | 沿用既有 `moderationStatus`/`isBlocked` 機制，Admin 既有稽核流程未受影響 |
| Privacy | Guest 身分皆以 HMAC 雜湊儲存，未落地明文 IP／guest token；音檔內容本身屬於使用者主動公開分享的代禱語音，非本輪新增的隱私考量 |
| Rollback | 本次 migration 為 additive-only（新增表/欄位，未修改既有資料），理論上可透過 `DROP TABLE prayer_prayed_reaction` 安全回滾，但**未實際演練過** |
| iOS Safari | Not Tested，見 ACC-003 |
| Android Chrome | Not Tested，見 ACC-003 |
| Real microphone | Not Tested，見 ACC-003 |
| Load test | 未執行，本輪範圍未涵蓋 |

## 最終建議

**有條件通過，修正後再驗收。**

條件：
1. 解決 ACC-001（migration 歷史在乾淨環境的可重放性）
2. 解決 ACC-002（確認 Production Storage 持久化策略）
3. 在至少一台真實 Android 與一台真實 iOS 裝置上完整走過一次錄音流程（ACC-003），確認結果後可將此項改為 Passed 並重新評估是否能進入部署階段

在以上三項條件解決前，**不建議執行 Production migration 或 Production deployment**。
