---
tags: [start-pray, flows, target]
---

# 目標使用者流程（提案，部分已實作）

參見 [[07-Target-MVP]]、[[09-Change-Impact-Analysis]]、[[21-Recorder-State-Machine]]、[[25-Companion-Mode-Reuse-Audit]]、[[26-Anonymous-Reporting-Design]]、[[27-Shared-Prayer-Interaction-Audit]]、[[28-Prayed-Reaction-Design]]。以下原為**設計提案**；流程 1-5 已於 Commit 2、3（2026-08-04）在首頁實作為前端狀態機（`src/components/prayer-recorder/`）；流程 6（匿名送出）已於 Phase 3A（2026-08-04）接上真實 API；流程 6b、8（瀏覽並播放禱告）已於 Commit A/B（2026-08-04）實作；流程 8b（匿名檢舉）、8c（`/prayfor/[id]` 匿名錄音）已於 Commit C1（2026-08-05）實作；流程 9（我已為你禱告）已於 Commit 1（2026-08-05）實作；流程 10 仍是提案，未實作。

## 1. 陌生人第一次進站 — ✅ 已實作（Commit 2）
```mermaid
flowchart TD
    A[進入首頁] --> B[看到一句主要訊息 + 一個主要按鈕]
    B --> C[點擊「開始錄下你的禱告」]
```

## 2. 麥克風授權成功 — ✅ 已實作（Commit 3，Real microphone Not Tested，見 [[21-Recorder-State-Machine]]）
```mermaid
flowchart TD
    A[點擊錄音按鈕] --> B[顯示麥克風用途說明]
    B --> C[瀏覽器授權彈窗]
    C --> D[授權成功]
    D --> E[進入 3-2-1 倒數]
```

## 3. 麥克風授權失敗 — ✅ 已實作並經真實瀏覽器驗證（非 Mock，Browser 環境本身封鎖麥克風存取觸發了真實拒絕路徑）
```mermaid
flowchart TD
    A[瀏覽器授權彈窗] --> B[使用者拒絕或裝置無麥克風]
    B --> C[顯示清楚的失敗說明，不責怪使用者]
    C --> D[提供「如何開啟權限」引導或改用文字禱告的替代方案]
```

## 4. 錄音與倒數 — ✅ 已實作（Real microphone Not Tested）
```mermaid
flowchart TD
    A[授權成功] --> B[3-2-1 倒數動畫]
    B --> C[開始錄音，顯示錄音中狀態]
    C --> D[使用者點擊停止]
```

## 5. 播放確認與重錄 — ✅ 已實作，含重錄確認對話框（Real microphone Not Tested）
```mermaid
flowchart TD
    A[錄音停止] --> B[自動播放預覽]
    B --> C{使用者決定}
    C -->|滿意| D[進入送出]
    C -->|不滿意| E[重新錄製] --> A
```

## 6. 匿名送出 — ✅ 已實作（Phase 3A，2026-08-04，Real API tested，見 [[15-Acceptance-Criteria]]）
```mermaid
flowchart TD
    A[點擊送出] --> B[前端呼叫送出 API，不需登入]
    B --> C[後端以既有 guestSessionHash/ipHash 機制標記來源]
    C --> D[寫入資料庫，responderId/ownerId 為 null]
    D --> E[顯示「投稿完成」畫面]
```
送出後建立的是 `PrayerResponse`（回應目前顯示的既有 Prayer），而非新建 `HomePrayerCard`，語意見 [[20-Anonymous-Submission-Design]]。

## 7. 上傳失敗與重試
```mermaid
flowchart TD
    A[送出音檔] --> B{上傳成功?}
    B -->|否| C[顯示明確錯誤原因，不遺失錄音內容]
    C --> D[提供「重試上傳」按鈕，沿用同一段錄音]
    D --> A
    B -->|是| E[進入投稿完成畫面]
```

## 6b. 首頁左右瀏覽 Prayer — ✅ 已實作（Commit B，2026-08-04，Real Browser tested，見 [[15-Acceptance-Criteria]]）
```mermaid
flowchart TD
    A[首頁顯示一則 Prayer] --> B{手勢或按鍵}
    B -->|左右滑動/方向鍵| C[呼叫 /api/home-cards/id/adjacent 取得前後張]
    C --> D[切換顯示下一/上一則 Prayer]
    A -->|錄音中/倒數中/送出中| E[切換被擋下，顯示提示]
    A -->|預覽未送出| F[二次確認是否放棄錄音] --> D
```
不允許在切換時建立新 Prayer，僅在既有清單中前後移動；輸入框聚焦或已進入陪伴模式時，鍵盤方向鍵不觸發切換。

## 8. 瀏覽並播放禱告 — ✅ 部分已實作（Commit B，首頁全螢幕陪伴模式；`/prayfor` 禱告牆列表播放維持既有實作，不在本次改動範圍）
```mermaid
flowchart TD
    A[首頁或禱告牆] --> B[列表顯示他人的禱告]
    B --> C[點擊播放]
    C --> D[音檔串流播放，無需登入]
```
首頁陪伴模式的實作方式：點擊「聆聽其他人的禱告」進入全螢幕，重用既有 `AudioContext`/`GlobalPlayer` 播放引擎組裝清單、Loop、Stop、Exit、X（本地移除）；播放清單僅來自目前顯示中 Prayer 的可播放 `PrayerResponse`。詳見 [[25-Companion-Mode-Reuse-Audit]]「實際實作結果」。Real Audio Playback 本身因環境限制 Not Tested，見 [[24-Manual-QA]]。

## 8b. 匿名檢舉不當回應 — ✅ 已實作（Commit C1，2026-08-05，Real API/Browser tested，見 [[26-Anonymous-Reporting-Design]]）
```mermaid
flowchart TD
    A[陪伴模式中播放某則回應] --> B[點擊三點選單]
    B --> C[點擊「檢舉」，二次確認]
    C --> D[Server 以 Guest session 或登入 session 決定身分]
    D --> E[PrayerResponse.moderationStatus 轉為 PENDING]
    E --> F[立即從播放清單移除，公開查詢不再回傳]
    F --> G{重新整理或重新進入陪伴模式}
    G --> H[已檢舉內容不再出現]
```
未登入與已登入訪客走同一支 `POST /api/prayer-response/report`；匿名檢舉不建立可逐筆稽核的 `PrayerResponseReport` 列（該表要求登入身分），改以 Response 自身狀態做冪等判斷 + `AdminLog` 粗粒度稽核 + DB-backed rate limit 防濫用，設計取捨詳見 [[26-Anonymous-Reporting-Design]]。此流程與「8. 瀏覽並播放禱告」共用同一個 `CompanionOverlay.js`，首頁與 `/prayfor/[id]` 皆適用（見 [[27-Shared-Prayer-Interaction-Audit]]）。

## 8c. `/prayfor/[id]` 匿名錄音 — ✅ 已實作（Commit C1，2026-08-05，Real Browser tested：permission-denied 真實路徑，Real microphone Not Tested）
```mermaid
flowchart TD
    A[開啟 /prayfor/id，不登入] --> B[看到「為這件事禱告」入口，位於 Prayer 內容正下方]
    B --> C[點擊後開啟與首頁相同的 PrayerRecorder]
    C --> D[允許→倒數→錄音→預覽→匿名送出]
    D --> E[POST /api/responses，prayerId 綁定 URL 對應的卡片]
```
與首頁共用同一個 `PrayerRecorder` 元件與 Submit API，透過新抽出的 `usePrayerInteraction` Hook 共用狀態；頁面既有的 `Comments.js`（服務登入會員的文字/語音回應與檢舉）維持不動，兩條路徑並存但受眾不同，決策見 [[27-Shared-Prayer-Interaction-Audit]]。

## 9. 點擊「我為你禱告」 — ✅ 已實作（Commit 1，2026-08-05，Real API/Browser tested，見 [[28-Prayed-Reaction-Design]]）
```mermaid
flowchart TD
    A[瀏覽某則 Prayer] --> B[點擊「我已為你禱告」]
    B --> C[Server 以登入 session 或 Guest session 決定身分]
    C --> D[POST /api/home-cards/id/prayed，冪等建立 PrayerPrayedReaction]
    D --> E[即時回饋：Count 更新、按鈕變為已按下狀態、短暫感謝訊息]
    E --> F{重新整理或切換 Prayer 後返回}
    F --> G[GET 同一支 API，正確還原「已按過」狀態，不重複計數]
```
是一個獨立於 `PrayerResponse` 的輕量反應（不建立留言、不上傳音訊），與規劃時的假設完全一致：「不必然要求送出完整回應」。防止重複點擊灌水的機制是 `PrayerPrayedReaction` 的 `@@unique([prayerId, actorType, actorKeyHash])` 資料庫層級唯一約束，而非僅靠前端 `disabled` 屬性（前端 disabled 只是輔助，真正的防線在後端）。首頁與 `/prayfor/[id]` 共用同一個 `PrayedReactionButton`/`usePrayedReaction`，Prayer 左右切換時會正確讀取新 Prayer 自己的狀態，不會把上一則的「已按過」誤帶到下一則（Real Browser tested：swipe 到下一則變回未按過、swipe 回原本那則正確還原為已按過）。

## 10. 不登入情況下的內容管理方案
```mermaid
flowchart TD
    A[匿名送出禱告] --> B[產生管理憑證，儲存於裝置端]
    B --> C{使用者稍後想刪除/管理}
    C -->|同裝置且憑證仍在| D[憑證比對通過，允許刪除/管理]
    C -->|憑證遺失| E[無法自助管理，僅能走檢舉/申訴或聯絡管理員]
    F[管理員後台] --> G[永遠可審核/下架任何內容，作為最後防線]
```

方案細節與比較見 [[09-Change-Impact-Analysis]] 及下方匿名架構章節（[[11-Decision-Log]] DEC-007）。
