---
tags: [start-pray, audit, companion-mode]
---

# 陪伴模式可重用性盤點（Commit 1 前置分析）

參見 [[20-Anonymous-Submission-Design]]、[[10-Implementation-Plan]]。**本文件為純讀碼分析，未修改任何程式碼。**

## 盤點表

| 能力 | 現有檔案 | 現有行為 | 是否依賴 Auth | 是否可重用 | 首頁整合方式 |
|---|---|---|---|---|---|
| Playlist / Queue 狀態引擎 | `src/context/AudioContext.js` | 全站共用的播放佇列：`playlist`、`currentIndex`、`playNext`/`playPrev`、`isLoop`、自動下一首（`handleEnded`/`findNextPlayableIndex`） | 否 | **直接重用** | 首頁陪伴模式應該建立在同一個 `AudioContext` 上，不要另起爐灶 |
| 全螢幕 Overlay | `src/components/GlobalPlayer.js`（"companion-overlay"，524-609 行） | 顯示單一 track 的頭像/文字/播放按鈕/關閉，**不顯示清單** | 否 | **透過 Props/擴充後重用**——UI 框架存在，但目前只顯示當前一筆，需要擴充才能顯示清單 | 需要在 overlay 內新增清單區塊，而非重建一個新 overlay |
| 自動播放下一則 | `AudioContext.js` `handleEnded` | 播完自動接下一首，`GlobalPlayer.js` companion 模式額外加 3 秒停頓（`COMPANION_AUTO_ADVANCE_DELAY_MS`） | 否 | **直接重用** | — |
| Loop | `GlobalPlayer.js:463-492`（`isLoop`/`handleLoopToggle`） | 開關循環播放 | 否 | **透過 Props 重用**——邏輯存在，但目前只出現在**收合式 mini-player 的展開佇列面板**，不在全螢幕 overlay 內 | 需要把這顆按鈕搬進/加進全螢幕 overlay |
| Stop | 無獨立「停止」按鈕，只有播放/暫停切換 | — | — | **缺少，需要新增** | 需另外設計「停止但不離開全螢幕」的行為 |
| Exit | `GlobalPlayer.js` 的「關閉」按鈕（companion overlay 內已有） | 關閉 overlay | 否 | **直接重用** | — |
| 每筆 X（僅移除本次播放清單，不動 DB） | `GlobalPlayer.js:776-783`（`queue-track__delete` → `removeTrack(track.id)`） | 確認為**純前端狀態操作**，`removeTrack()`（`AudioContext.js:1152-1183`）只 filter `playlist` 陣列，**沒有呼叫任何 API** | 否 | **透過 Props 重用**——邏輯存在，但只出現在 mini-player 的展開佇列面板，不在全螢幕 overlay 內 | 需要把這個按鈕加進全螢幕 overlay 的清單項目 |
| 三點選單／檢舉 | `Comments.js:535`（`comment-item__menu-trigger`，實際是「...」按鈕非圖示 kebab）+ `ResponseReportButton.jsx` | 點擊呼叫 `POST /api/prayer-response/report`，成功後前端樂觀隱藏（`Comments.js:419-421` 過濾） | 是（`requireSessionUser`，見 [[06-Authentication-Dependencies]]） | **Adapter 後重用**——API 與資料語意可以直接沿用，但**檢舉本身目前要求登入**，若要在匿名首頁陪伴模式內開放檢舉，需要額外設計匿名檢舉方案（見 [[14-Open-Questions]]，本次盤點範圍外，不在 Commit 1-3 內處理，除非你另外確認） | 三點選單 UI 需要移植進全螢幕 overlay 的清單項目；後端維持既有 API 不變 |
| Report API | `src/app/api/prayer-response/report/route.js:78-89` | 遞增 `reportCount`，設 `moderationStatus: PENDING`（一般使用者）或 `isBlocked: true`（卡片擁有者檢舉） | 是 | **直接重用** | — |
| Hidden 邏輯 | `src/app/api/responses/[homeCardId]/route.js:49-57` | 公開 GET 已過濾 `isBlocked: false`、`moderationStatus: "APPROVED"`、`voiceModerationStatus: {in:["APPROVED","NOT_APPLICABLE"]}` | 否（公開查詢本身免登入） | **直接重用** | 首頁的 Prayer/PrayerResponse 查詢應該沿用同一組過濾條件，不要另建一套 |
| Public filter（首頁需要顯示的「可播放清單」） | 同上 | — | — | **直接重用** | — |
| Admin moderation | `/admin/prayerresponse`、`/admin/prayfor` 及對應 API | 後台可下架/封鎖，不受本次影響 | 是（admin） | 不需改動 | — |
| Mobile / Keyboard / Accessibility（既有 overlay） | `GlobalPlayer.js` companion overlay | 未見明確的 focus trap 或鍵盤方向鍵處理（讀碼未發現對應邏輯） | — | **缺少，需要新增**（若要符合 Commit 2 的 accessibility 要求） | — |

## 第一原則檢查結果
> 不建立第二套播放器、第二套 Playlist、第二套 Report API 或第二套 hidden 機制。

- **播放器/Playlist**：`AudioContext.js` + `GlobalPlayer.js` 是唯一的全站播放引擎，`VoiceWallPlayer.js` 是另一個獨立、自帶 state 的小型播放器（用於 `/prayfor/[id]` detail 頁），**不應該**再建第三套；首頁陪伴模式應建立在 `AudioContext.js` 上
- **Report API**：`/api/prayer-response/report` 已存在且行為明確，直接沿用
- **Hidden 機制**：`isBlocked`/`moderationStatus` 已存在且已被公開查詢正確過濾，直接沿用

## 重大缺口：全螢幕 Overlay 目前不是「清單型」介面
`GlobalPlayer.js` 的 companion overlay（524-609 行）目前設計成**只顯示當前一筆**（頭像+文字+播放/關閉），沒有清單、沒有 X、沒有三點選單。Loop 與 X 移除**已經存在**，但只出現在畫面下方收合式 mini-player 展開後的佇列面板裡，**不在全螢幕模式內**。

這代表 Commit 2 要做的不是「純粹重用」，而是：**把已存在、已驗證正確的 Loop/X/佇列邏輯，從 mini-player 的收合面板「搬進」全螢幕 overlay 的畫面**，並在清單項目上加裝三點選單（沿用 `Comments.js` 的既有 Report 呼叫模式）。這仍然符合「不重建第二套」的原則（邏輯與 API 都不重寫，只是 UI 組裝到新位置），但工作量比字面上的「直接重用」要大。

## 重大缺口：「我已為你禱告」的 prayed reaction 完全不存在
讀遍 `prisma/schema.prisma` 與全專案程式碼，**沒有找到任何**現成的「按讚/已禱告/amen」類型的計數或反應機制（無 `PrayedReaction` model、無 `prayedCount` 欄位、無等價實作）。`GlobalPrayerRoom.js` 裡出現的 "prayerCount" 是「地圖群聚裡有幾筆代禱」的統計，語意完全不同，不能重用。

**這與原指令的假設不符**（原指令說「優先重用既有 prayed count／reaction 功能，若既有功能已存在則直接接首頁，不新建第二套 Model 或 API」）——因為**根本沒有既有功能可以重用**。Commit 3 若要做「我已為你禱告」，**必須新增一個資料模型或欄位**，這是一個新的 Schema 決策點，需要你確認方向（比照 [[23-Database-Migration]] 的模式：新增 nullable/additive 欄位或新表，不動舊資料）。

## 實際實作結果（Commit B，2026-08-04，程式已寫並經 Real API/Browser 測試，見 [[10-Implementation-Plan]]、[[24-Manual-QA]]）

本節記錄上方盤點表的每一項，在 Commit B 實際落地後「照原盤點執行」與「與原盤點有落差」之處：

| 能力 | 盤點時的判斷 | 實際實作 | 落差 |
|---|---|---|---|
| Playlist / Queue 狀態引擎 | 直接重用 `AudioContext.js` | 確認直接重用，`CompanionOverlay.js` 只呼叫 `useAudio()` 取得既有 state/actions（`setQueue`/`playByIndex`/`togglePlay`/`pause`/`setIsLoop`/`removeTrack`），**零新增播放狀態** | 無落差 |
| 全螢幕 Overlay | 需要擴充既有 `GlobalPlayer.js` companion overlay 顯示清單 | **未修改 `GlobalPlayer.js`**，改為新建 `src/components/home-companion/CompanionOverlay.js` 作為獨立的「Homepage Companion Adapter」元件，消費同一個 `AudioContext`，UI 為首頁量身打造（非直接改造既有 overlay） | 與盤點原提案不同：選擇「新建 Adapter 元件、共用底層狀態」而非「改造既有 UI 元件」，理由是既有 `GlobalPlayer.js` 的 companion overlay 綁定 `/prayfor/[id]` 路由語意，直接改造風險較高；新建 Adapter 屬於使用者明確允許的重用策略之一（"建立 Homepage Companion Adapter"），未違反「禁止複製整份 GlobalPlayer / 建立第二套 Queue state」原則 |
| Loop | 需要把 mini-player 佇列面板的按鈕搬進全螢幕 | `CompanionOverlay.js` 新增 Loop 按鈕，直接呼叫既有 `setIsLoop`/讀取既有 `isLoop`，`aria-pressed` 屬性反映狀態 | 無邏輯落差，UI 位置符合原盤點結論 |
| Stop | 缺少，需要新增 | 新增 Stop 按鈕，呼叫既有 `pause()`，不清空 queue、不關閉全螢幕 | 符合盤點的建議設計 |
| Exit | 直接重用既有關閉按鈕邏輯 | `handleExit` 呼叫 `pause()` + `setQueue([])` + `onExit?.()`，回到首頁瀏覽中的同一張 Prayer | 無落差 |
| 每筆 X（本地移除） | 需要把 mini-player 佇列面板的 X 搬進全螢幕清單項目 | `CompanionOverlay.js` 清單項目上加 X 按鈕，直接呼叫既有 `removeTrack(trackId)`，未修改 `AudioContext.js` 的實作 | 無落差，Real Browser tested：點擊後曲目從清單消失，重新整理後又出現（因為只是前端 state） |
| 三點選單／檢舉 | Adapter 後重用，登入限制維持不變 | 三點選單僅在 `authUser` 存在時渲染；確認流程呼叫既有 `POST /api/prayer-response/report`，成功後呼叫 `removeTrack` | 符合盤點：**未新建匿名檢舉方案**（盤點已標記為「本次範圍外，除非另外確認」，使用者最新指令也未要求做匿名檢舉），Not Tested（無測試登入帳號） |
| Hidden 邏輯／Public filter | 直接重用既有公開查詢過濾條件 | 新增的 `/api/home-cards/[id]/adjacent` 與既有 `/api/responses/[id]` 皆沿用既有 `isBlocked`/`moderationStatus` 過濾，未新增第二套過濾邏輯 | 無落差 |
| Accessibility（Focus trap／鍵盤） | 缺少，需要新增 | `CompanionOverlay.js` 新增以 `querySelectorAll(FOCUSABLE_SELECTOR)` 為基礎的 focus trap、`Escape` 鍵呼叫 `handleExit` | Implemented，未經自動化測試（見 [[24-Manual-QA]]），需人工補測 |

## 「我已為你禱告」（Prayed reaction）— 維持不存在，Commit B 明確不處理
上方盤點結論不變：**沒有找到任何現成的「已禱告」計數/反應機制**。使用者在 Commit B 指令中已明確排除本項（"目前先不要實作：「我已為你禱告」／Prayed reaction Schema／Migration／Management Token"），因此 Commit B **未新增**任何 Schema 或欄位。此缺口仍待未來一輪明確的 Schema 決策（比照 [[23-Database-Migration]] 的 additive 模式）。

## 對 Commit 1-3 規劃的實際影響
| 原假設 | 讀碼後的實際情況 | 影響 |
|---|---|---|
| Commit 1 只需要重新綁定首頁到 Prayer/PrayerResponse | 屬實，[[20-Anonymous-Submission-Design]] 已確認的資料語意（Prayer=`HomePrayerCard`，PrayerResponse=既有同名表）不需要修改，Commit 4A 的匿名送出邏輯可以直接沿用，只是首頁需要把 `requestId` 改成綁定「目前顯示的 Prayer」而非隨機取一張 | Commit 1 風險偏低，可以照原計畫執行 |
| Commit 2「重用既有陪伴模式」 | 播放引擎（`AudioContext`）與 X/Loop 邏輯確實存在，但全螢幕 UI 需要組裝，不是純粹掛接 | Commit 2 工作量比預期大，屬於中風險的 UI 整合工作，非零成本重用 |
| Commit 3「優先重用既有 prayed count」 | **不存在**，需要新 Schema | Commit 3 需要一次新的、範圍明確的 migration 決策，建議先確認你要新增獨立的 `PrayedReaction` 表（含 `prayerId`/`anonymousSessionHash` 唯一鍵，比照 [[23-Database-Migration]] 已分析過的 guest 識別模式）還是在 `HomePrayerCard` 上加一個計數快取欄位 |
| Commit 2 的匿名檢舉 | 檢舉 API 目前**要求登入**（`requireSessionUser`） | 若首頁陪伴模式要對匿名訪客開放檢舉功能，這是額外的匿名化工作，不在原本三個 Commit 明確列出的範圍內，需要你確認是否要一併處理，或本輪先跳過（三點選單可以先只保留給已登入使用者，其餘人不顯示該選項） |
