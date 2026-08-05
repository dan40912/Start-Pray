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
- [x] 匿名投稿 API 整合 — 已於 Phase 3A 完成，不在 Commit 3 範圍內（見下方）
- [ ] 字幕 — **Not Implemented**（本 Commit 明確排除，Phase 5 範圍）
- [x] Lint / Build — Lint verified / Build verified

## Phase 3A（`feat: support anonymous prayer submission`，待建立 Commit）— 匿名語音送出核心
- [x] 移除 `VOICE_LOGIN_REQUIRED` 硬性登入檢查 — Implemented + Real API tested
- [x] 修正 guest 語音 rate limit 查詢崩潰 bug — Implemented + Real API tested（真實送出第二筆語音未崩潰）
- [x] 匿名送出成功寫入 `PrayerResponse`（`responderId=null`） — **Real API tested（非 Mock）**：對本機開發 DB 實際送出，回傳 201，`voiceUrl` 檔案可讀回
- [x] 既有 rate limit（同卡片 2 分鐘冷卻）對匿名語音同樣生效 — Real API tested（429 正確觸發）
- [x] 前端 `PrayerRecorder.js` 串接真實 API（uploading/success/failed 三態） — Implemented，UI 層級 Not Tested（自動化環境無法取得麥克風權限，無法走到 `preview` 階段）
- [x] i18n（送出中/成功/失敗文案，zh-TW/en） — Browser tested（畫面文字）+ `npm run i18n:check` Automated tested
- [x] Lint / Build / Unit tests — 全數通過
- [ ] 匿名管理 Token（刪除能力） — **Not Implemented**（Phase 3B，設計已完成，需 Schema migration）
- [ ] DB-backed 語音專屬 rate limit（獨立於既有文字回應限制） — **Not Implemented**，沿用既有規則
- [ ] 伺服器端音訊時長驗證 — **Not Implemented**（現有系統本來就沒有，非本次新缺口）

## Commit A（`ed43015`）— 首頁改用真實 Prayer
- [x] 首頁顯示真實 Prayer（`sort=needsPrayer`） — Browser tested
- [x] 錄音 CTA 綁定該 Prayer 的 id — Real API tested（React fiber 讀出 `prayerId`，送出後 `homeCardId` 一致）
- [x] zh-TW/en 正確 — Browser tested
- [x] Lint / Build / Unit / i18n:check — 全數通過

## Commit B（`feat: add prayer browsing and companion playback`，待建立）— 瀏覽與陪伴模式
- [x] 左右滑動切換 Prayer（觸控） — Real Browser tested（`TouchEvent`，非模擬 click）
- [x] Desktop 鍵盤方向鍵切換 — Real Browser tested（連續切換 6 張真實卡片）
- [x] 輸入框/選單開啟時不觸發鍵盤切換 — Implemented（`document.activeElement` tagName 檢查 + `companionOpen` 檢查），Not Tested（未逐一驗證每種焦點情境）
- [x] 陪伴入口只在有可播放語音回應時顯示 — Real Browser tested（跨 6 張真實卡片驗證正確切換顯示/隱藏）
- [x] 全螢幕陪伴模式重用 `AudioContext`（零新增 Queue state） — Implemented + Real Browser tested（真實載入 9 筆回應）
- [x] Loop — Implemented（`isLoop`/`setIsLoop`，既有邏輯未變更），Not Tested（未實際點擊）
- [x] Stop（`pause()`，不關閉全螢幕） — Implemented，Not Tested
- [x] Exit（清空 queue、關閉全螢幕、回到同一則 Prayer） — Real Browser tested
- [x] Playlist X（本地移除，`removeTrack`，不動 DB） — Implemented（沿用既有已驗證邏輯），Not Tested（未實際點擊，但底層函式未變更）
- [x] 三點選單／檢舉（僅登入者可見，重用既有 Report API） — Implemented，Not Tested（無測試登入帳號）
- [x] 錄音中/倒數中/送出中禁止切換 Prayer — Implemented，**Not Tested**（需要真實麥克風才能進入這些狀態）
- [x] Preview 未送出時切換需二次確認 — Implemented，Not Tested（同上）
- [x] permission-denied/error/success 狀態允許切換 — Real Browser tested（permission-denied 已驗證）
- [x] 切換時清空舊 Playlist/currentIndex、取消舊請求 — Implemented（generation counter stale-response 防護），Not Tested（未壓力測試快速連續切換）
- [x] Real Audio Playback — **Not Tested**（既有種子資料與合成測試檔案皆無法在此環境真正解碼播放，見 [[10-Implementation-Plan]] Commit B 詳述）
- [x] Focus trap / Escape 離開 — Implemented，Not Tested
- [x] `/global-prayer-room`、`/prayfor/[id]` 回歸 — Real Browser tested（Cesium 正常載入、無 console 錯誤）
- [x] Lint / Build / Unit tests（13/13）/ i18n:check（505 keys） — 全數通過

## Commit C1（`refactor: unify anonymous prayer interactions across prayer pages`，待建立）— 匿名檢舉與共用 Prayer 元件
- [x] 未登入訪客可見三點選單（首頁與 `/prayfor/[id]` 皆然） — Real Browser tested
- [x] 未登入訪客可檢舉，Server 端以 Guest session 決定身分 — Real API tested
- [x] Client 傳入的 `reporterId`/`userId`/`hidden`/`admin` 等偽造欄位被忽略 — Real API tested
- [x] 檢舉成功後沿用既有 `moderationStatus`/`isBlocked` 欄位隱藏，未新增 Schema — Implemented + Real API tested（DB 值變化確認）
- [x] 重複檢舉冪等（不重複遞增 `reportCount`） — Real API tested
- [x] Guest／IP 兩維度 DB-backed rate limit（10 分鐘 5 次/10 次） — Real API tested（429 正確觸發）
- [x] Invalid/missing responseId、不存在的 response、不合法 reason 回傳對應錯誤碼 — Real API tested
- [x] 公開查詢（`/api/responses/[id]`）立即排除已檢舉項目 — Real API tested
- [x] 陪伴入口「可播放數量」在檢舉成功、離開陪伴模式後正確歸零/更新 — Real Browser tested（含一次真實 Bug 修正：初版遺漏這個刷新，見 [[26-Anonymous-Reporting-Design]]）
- [x] X（本地移除）與 Report（後端隱藏）行為分離，X 不呼叫任何 API、不動 DB — Real Browser tested（Network 面板確認零請求）
- [x] Admin 查詢不受影響，仍可看見已隱藏項目（未逐一測試每個 Admin 頁面按鈕，僅確認查詢層級未新增排除條件） — Implemented，Not Tested
- [x] `/prayfor/[id]` 新增匿名錄音入口，綁定 URL 對應的 `prayerId` — Real Browser tested（permission-denied 真實路徑，與首頁同一元件）
- [x] `/prayfor/[id]` 匿名陪伴入口（可播放時顯示，重用 `CompanionOverlay`） — Real Browser tested
- [x] Mobile（375/390/412）錄音入口在第一屏、無橫向捲動 — Real Browser tested
- [x] Desktop（1280/1440）錄音入口在首屏內 — Real Browser tested（1280 寬度下貼近視窗底部但仍可見）
- [x] 既有 `Comments.js`/`VoicePrayerOverlay.js`（登入會員語音/文字/檢舉流程）未被修改 — Implemented（使用者決策：匿名優先/可加性策略），Real Browser tested 確認共存不衝突
- [x] `usePrayerInteraction` Hook 由首頁與詳情頁共用 — Implemented，Browser tested（兩頁 Recorder/Companion 行為一致）
- [x] `/global-prayer-room`、`/login`、`/signup`、`/customer-portal`、`/admin` 回歸 — Real Browser tested，Console/Server log 無新增錯誤
- [x] Lint / Build / Unit tests（21/21）/ i18n:check（505 keys） — 全數通過
- [ ] Real microphone 錄音全流程 — **Not Tested**（環境限制，同既有限制）
- [ ] 已登入會員的檢舉/三點選單迴歸測試 — **Not Tested**（無測試登入帳號）

## Commit 1（`feat: add anonymous prayed reactions`，待建立）— 我已為你禱告
- [x] 新增 `PrayerPrayedReaction` additive schema，未修改既有表 — Real DB tested
- [x] `actorType`+`actorKeyHash` 唯一鍵可靠防止匿名重複（MySQL nullable-unique 限制已規避） — Real DB tested（`P2002` 正確擋下）
- [x] `GET`/`POST /api/home-cards/[id]/prayed`，登入與匿名共用同一支 API — Real API tested
- [x] Server 端自行解析身分，不接受 Client 傳入 `userId`/`guestHash`/`actorKey`/`count`/`status`/`admin` — Real API tested（偽造欄位完全無效）
- [x] Hidden（`isBlocked`）／Private Prayer 拒絕 — Real API tested（404）
- [x] 不存在的 Prayer（等同 deleted）拒絕 — Real API tested（404）
- [x] 冪等：重複 POST 不重複計數 — Real API tested
- [x] Rate limit（Guest 10 分鐘 20 個不同 Prayer／IP 10 分鐘 50 次） — Real API tested（第 21 個 Prayer 觸發 429）
- [x] 首頁與 `/prayfor/[id]` 共用 `usePrayedReaction`/`PrayedReactionButton` — Implemented + Real Browser tested（兩頁行為一致）
- [x] Prayer 切換時正確重置/還原狀態，無 stale response — Real Browser tested（左右切換來回驗證）
- [x] Reload 後狀態透過 Guest cookie 正確保留 — Real Browser tested
- [x] `aria-pressed`、44×44px、`aria-live` 成功/錯誤提示 — Implemented + Real Browser tested（電腦樣式量測 44px）
- [x] Lint / Build / Unit tests（34/34）/ i18n:check（509 keys） — 全數通過
- [ ] Admin 查看 Reaction 明細介面 — **Not Implemented**（規格未要求本輪新增）
- [ ] Real microphone／已登入會員迴歸 — **Not Tested**（環境限制）

## 尚未開始（不在本次任何已完成 Commit 範圍內）
匿名管理 Token（Phase 3B）、字幕/轉錄整合、首頁下方區塊收斂、完整安全補強（CSRF/CORS 對匿名 API、分散式 rate limit）、自動化 API/整合測試框架、Production readiness、`GlobalPlayer.js` 內建陪伴 UI 與 `CompanionOverlay.js` 的完整統一、Admin Prayed reaction 明細介面。這些項目的依賴分析已完成於 [[20-Anonymous-Submission-Design]]、[[22-API-Changes]]、[[23-Database-Migration]]、[[25-Companion-Mode-Reuse-Audit]]、[[26-Anonymous-Reporting-Design]]、[[27-Shared-Prayer-Interaction-Audit]]、[[28-Prayed-Reaction-Design]]、[[19-Security-Review]]。
