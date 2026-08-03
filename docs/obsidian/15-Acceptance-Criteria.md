---
tags: [start-pray, acceptance-criteria]
---

# 驗收條件彙整

參見 [[16-Final-Acceptance-Report]]、[[21-Recorder-State-Machine]]、[[24-Manual-QA]]。本文件彙整各 Commit 的驗收條件與目前狀態，供之後每個 Commit 的階段性驗收快速核對。

## Commit 1（`6b8cc84`）— 導覽收斂
- [x] Header/Mobile menu/Footer 隱藏登入、註冊、會員中心、全球禱告室 — Browser tested
- [x] Footer 無空欄位 — Implemented + Browser tested
- [x] i18n zh-TW / en 正確 — Browser tested
- [x] `/login`/`/signup`/`/customer-portal`/`/global-prayer-room` 路由存在 — Route tested（Authenticated flow Not Tested）
- [x] Lint / Build — Lint verified / Build verified

## Commit 2（`04538e7`）— 極簡首頁 Hero
- [x] 首頁無 Cesium / GlobeSkeleton — Browser tested（`window.Cesium` undefined、無 `.home-map-skeleton`）
- [x] 第一屏僅一個主要 CTA — Browser tested（1280×800、1440×900、375×812、390×844）
- [x] 中英文案逐字相符 — Browser tested
- [x] Lint / Build — Lint verified / Build verified

## Commit 3（進行中）— 首頁錄音前端流程
- [x] 麥克風權限說明、請求、拒絕、不支援四種狀態 — Implemented；拒絕與不支援 Browser tested（真實瀏覽器行為，非 Mock）；允許後的完整流程 Real microphone Not Tested
- [x] 3-2-1 倒數 — Implemented，Real microphone Not Tested
- [x] 錄音中狀態、計時、最長 60 秒自動停止 — Implemented，Real microphone Not Tested
- [x] 停止、預覽、播放/暫停 — Implemented，Real microphone Not Tested
- [x] 重新錄製（含確認對話框） — Implemented，Real microphone Not Tested
- [x] 太短錄音提示（不阻斷流程） — Implemented，Real microphone Not Tested
- [x] 錯誤狀態（device/empty/stream-lost） — Implemented，Real microphone Not Tested
- [x] MediaStream/Timer/Object URL 清理 — Implemented（程式碼對應 `VoicePrayerOverlay.js` 既有模式），Not Tested（無法在自動化環境模擬完整錄音再卸載）
- [x] i18n zh-TW / en，無寫死字串 — Browser tested + `npm run i18n:check` Automated tested
- [x] Mobile 按鈕 ≥44px — Browser tested（48px @ 375×812）
- [x] Unit tests（MIME 選擇、時長格式化、支援度偵測） — Automated tested（`npm run test:unit`，7/7 通過）
- [ ] 匿名投稿 API 整合 — **Not Implemented**（本 Commit 明確排除）
- [ ] 字幕 — **Not Implemented**（本 Commit 明確排除）
- [ ] Lint / Build — 待本次修改完成後最終確認

## 尚未開始（不在本次任何已完成 Commit 範圍內）
匿名投稿後端、Prisma Schema/Migration、Storage 安全限制、匿名管理 Token、Rate limit、字幕/轉錄整合、首頁禱告聆聽區塊、「我為你禱告」、首頁下方區塊收斂、完整安全補強、Production readiness。這些項目在對應 Commit 開始前，應先完成 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]] 的依賴分析。
