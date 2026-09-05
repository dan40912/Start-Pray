---
tags: [start-pray, audit, shared-components, commit-c1]
---

# 首頁與 /prayfor/[id] 共用元件盤點與整合（Commit C1）

參見 [[25-Companion-Mode-Reuse-Audit]]、[[26-Anonymous-Reporting-Design]]、[[10-Implementation-Plan]]。本文件記錄：修改前對兩個頁面的完整讀碼盤點、選定的整合策略（「匿名優先、可加性、低風險」——見下方決策說明），以及實際落地後的檔案清單。

## 決策：為什麼選擇「匿名優先、可加性」而非「完全統一」

使用者在本 Commit 執行前，針對「該把 `/prayfor/[id]` 既有的 `Comments.js`（800 行：文字回應、透過 `VoicePrayerOverlay` 的語音回應、自己的檢舉選單、登入流程）與 `GlobalPlayer.js` 內建的全螢幕陪伴模式，替換到什麼程度」被問到三個選項，明確選擇了：

> **「匿名優先、可加性（風險較低）」**：把共用的 `PrayerRecorder` + `CompanionOverlay` 加為一個新的匿名入口，滿足「未登入訪客可以不登入就錄音」與「Mobile 置頂」的要求；`Comments.js` 既有的語音／文字／檢舉流程完全不動，繼續給已登入會員使用。兩條路徑因為受眾不同（匿名 vs 已登入）而刻意分開，不是字面上「所有人共用同一顆 Recorder」，但共用同一套底層邏輯（狀態機、Submit API、Report API、Companion 引擎）。

這代表：**本次沒有修改** `Comments.js`、`VoicePrayerOverlay.js`、`GlobalPlayer.js`。共用的是狀態機／API／播放引擎，而不是逐頁面的 UI 元件本身。

## 盤點表（修改前，讀碼所得）

| 能力 | 首頁（`HomePrayerHero.js`，Commit A/B 既有） | `/prayfor/[id]`（既有） | 是否重複 | 共用方式（本次採用） |
|---|---|---|---|---|
| Prayer 標題／內容 | `<h2>{currentPrayer.title}</h2>` + 純文字化的 `description` | `page.js` 的 `pdv2-hero-card`（含圖片、標題、meta），伺服器端渲染 | 各自渲染，語意相同但版型不同 | 不合併：首頁是精簡卡片、詳情頁是完整 hero，版型差異合理，不視為重複邏輯 |
| Prayer 原始語音 | `<audio>`（`isPlayableVoiceHref` 檢查） | `DetailAudioQueueBootstrap` 把 `card.voiceHref` 當作 `primaryTrack` 餵進 `AudioContext` 佇列（走 GlobalPlayer 底部播放器，非行內 `<audio>`） | 不重複（本來就是兩種不同的既有播放路徑，非本次引入） | 不變更 |
| 「為這件事禱告」入口（匿名錄音） | `openRecorder()` → `<PrayerRecorder>` | **新增**：`DetailPrayerInteractionPanel` 的「為這件事禱告」按鈕 → 同一個 `<PrayerRecorder>` | 修改前：詳情頁沒有匿名等價物（見下方 Recording 列） | **直接重用同一元件** `src/components/prayer-recorder/PrayerRecorder.js`，未複製 |
| Permission explanation / Countdown / Recording / Preview | `PrayerRecorder` 內部狀態機（`usePrayerRecorder`） | 修改前：`Comments.js` 用完全不同的元件 `VoicePrayerOverlay.js`，且僅登入者可觸發（`if (authUser) setShowVoiceOverlay(true) else 顯示登入提示`，`Comments.js:619-627`） | **是**（兩套錄音元件並存，語意相同） | 新增的匿名入口重用 `PrayerRecorder`；`Comments.js`／`VoicePrayerOverlay` 對已登入會員保持原樣，不刪除、不合併 |
| Anonymous submit | `PrayerRecorder.handleSubmit()` → `POST /api/responses`（`isAnonymous: "true"`，`requestId=prayerId`） | 詳情頁新面板：**同一個** `PrayerRecorder.handleSubmit()`，`prayerId={card.id}` | 否（同一元件即同一支程式碼） | 直接重用，零新增送出邏輯 |
| Success / Upload errors | `PrayerRecorder` 內建（`submitState` 狀態機） | 同上 | 否 | 直接重用 |
| Companion entry（聆聽入口） | `hasCompanionEntry`（`playableResponses.length > 0`） | **新增**：`DetailPrayerInteractionPanel` 內的「聆聽大家的禱告」按鈕 | 修改前：詳情頁沒有等價的「進入陪伴模式」按鈕（播放走底部 mini-player，非全螢幕陪伴 UI） | 兩頁都改用新抽出的共用 Hook `usePrayerInteraction(prayerId)`（見下方） |
| 全螢幕陪伴 Overlay | `CompanionOverlay.js`（Commit B 新建，`src/components/home-companion/`） | 修改前：`GlobalPlayer.js` 內建的 `companion-overlay`（524-609 行），只顯示單一 track、無清單 UI，路由白名單為 `/prayfor` | **是**（兩套全螢幕陪伴 UI 概念重疊，但介面完全不同） | 詳情頁的新面板改用 `CompanionOverlay.js`（與首頁同一元件）；`GlobalPlayer.js` 內建的 companion-overlay **維持不動**（它綁定的是 `/prayfor/[id]` 既有的底部 mini-player擴張，非本次新增的入口觸發，兩者可以並存，見下方「已知重疊」） |
| Playlist | `AudioContext.js`（`useAudio()`） | 同一個 `AudioContext.js`（`DetailAudioQueueBootstrap` 與 `CompanionOverlay` 共用同一個 Provider，全站唯一） | 否，本來就是同一個 Context | 未變更，兩頁本來就共用同一個播放引擎狀態 |
| Loop / Stop / Exit | `CompanionOverlay.js` 內建按鈕 | 新面板重用 `CompanionOverlay.js`，故同一套按鈕 | 否 | 直接重用 |
| X（Playlist 本地移除） | `removeTrack()`（`AudioContext.js`），`CompanionOverlay.js` 呼叫 | 同上（同一元件） | 否 | 直接重用，未修改 `removeTrack` 本身 |
| 三點選單／Report | `CompanionOverlay.js`（Commit B 只給登入者看，本 Commit 移除此限制，見 [[26-Anonymous-Reporting-Design]]） | 修改前：`Comments.js` 有自己的三點選單（`openActionMenuId` 狀態）＋`ResponseReportButton.jsx`，同樣走 `POST /api/prayer-response/report`，僅登入者可見 | 是（兩套三點選單 UI 並存，但都打同一支既有 API） | `CompanionOverlay.js` 的選單改為所有訪客可見（含匿名），是共用元件，兩頁自動受益；`Comments.js` 自己的選單維持不動（服務已登入會員在文字/舊語音回應列表上的既有檢舉入口，範圍不同） |
| Report API | `POST /api/prayer-response/report`（修改前僅登入者） | 同一支 API | 否 | **本 Commit 唯一修改的 API**：新增 guest 分支，登入分支邏輯逐行保留，見 [[26-Anonymous-Reporting-Design]] |
| Hidden（moderationStatus / isBlocked） | 既有欄位 | 既有欄位 | 否 | 未新增欄位 |
| Mobile layout | 置中卡片式 hero，錄音 CTA 在首屏 | 修改前：`pdv2-hero-card` → `pdv2-companion-panel`（純文字連結，非真正 Recorder）→ ... → 極下方的 `Comments.js` composer | 新面板**插入於** `pdv2-hero-card` 之後、`pdv2-companion-panel` 之前，使其在 Mobile／Desktop 都落在第一屏，不需大量捲動即可看到，滿足「錄音入口置頂」要求同時不需要用 CSS reorder（因為原本頁面就是單欄由上到下排列） | 見下方「Mobile 置頂實作方式」 |
| Desktop layout | 置中單欄 hero | 單欄 `pdv2-shell`，最大寬度容器 | 新面板沿用同一單欄容器，不需要另外設計雙欄 | 未新增 breakpoint，沿用既有 768px |
| Auth 依賴 | 完全不需要登入 | 修改前：語音回應／音檔上傳欄位僅登入者可見（`Comments.js:675`），文字回應本來就免登入 | 新面板完全不檢查 `authUser`（頁面既有的 `Comments.js` 語音欄位維持原本的登入檢查，不受影響） | — |
| prayerId 傳遞 | `currentPrayer?.id`（state，首頁滑動切換時更新） | **新增**：`card.id`（伺服器端已由 `parseId(params.id)` 驗證為合法整數，並確認 `readHomeCard(id)` 存在才會渲染頁面；新面板拿到的 `prayerId` 全程綁定同一個值，不會因 client 端 hydration 或導覽而錯置） | 否 | `DetailPrayerInteractionPanel` 直接以 prop 傳入，不做任何 client 端的「猜測目前 Prayer」邏輯 |

## 抽出的共用程式碼

- **`src/components/prayer-interaction/usePrayerInteraction.js`**（新建）：管理「目前是否顯示 Recorder／Recorder 狀態／是否開啟陪伴模式／可播放回應清單」這組跨頁共用的 state，並監聽既有的 `PRAYER_RESPONSE_CREATED` 事件（`src/lib/events.js`）在送出成功或檢舉成功後自動重新抓取回應清單。`HomePrayerHero.js`（首頁的 Prayer 切換／swipe 邏輯維持頁面自己管理）與新的 `DetailPrayerInteractionPanel.js` 都呼叫這個 Hook——這是兩頁「同一套狀態與錯誤定義」的實際落地位置。
- **`PrayerRecorder.js`**：新增一行 — 送出成功時 `dispatchEvent(PRAYER_RESPONSE_CREATED)`，讓兩頁的可播放清單與（詳情頁的）底部佇列都能收到「有新回應」通知並重新整理，這是既有 `DetailAudioQueueBootstrap` 早就在監聽、但先前從未有人在送出成功時真正觸發過的既有事件（見 `12-Change-Log.md` 的落地紀錄）。
- **`CompanionOverlay.js`**：檢舉成功時同樣 dispatch 這個事件，確保「陪伴入口的可播放數量」在報告成功、離開陪伴模式後正確歸零／減少（見 [[26-Anonymous-Reporting-Design]] 的 Real Browser tested 紀錄）。
- **i18n**：`home.recorder.entryCta`／`home.recorder.anonymousNote` 從原本只給首頁用的 `home.prayerHero.*` 移到 `home.recorder.*`（首頁與詳情頁本來就都會把 `text.recorder` 整包傳給 `<PrayerRecorder>`，因此兩頁自動共用同一份文案，無需另建 `prayfor.recorder.*`）。

## 新增檔案

- `src/components/prayer-interaction/usePrayerInteraction.js`
- `src/components/prayer-detail/DetailPrayerInteractionPanel.js`（`/prayfor/[id]` 專用的頁面級 orchestrator：組合 `usePrayerInteraction` + `PrayerRecorder` + `CompanionOverlay`，不含首頁的 swipe/切換邏輯）

## 修改檔案

- `src/components/HomePrayerHero.js`：改用 `usePrayerInteraction`，移除重複的 recorder/companion/responses state；swipe/adjacent-prayer 邏輯保留在此頁面自己管理（詳情頁不需要）
- `src/components/prayer-recorder/PrayerRecorder.js`：送出成功時 dispatch `PRAYER_RESPONSE_CREATED`
- `src/components/home-companion/CompanionOverlay.js`：三點選單對所有訪客開放（見 [[26-Anonymous-Reporting-Design]]）；檢舉成功時 dispatch 同一事件
- `src/app/prayfor/[id]/page.js`：插入 `<DetailPrayerInteractionPanel prayerId={card.id} locale={locale} />`
- `src/lib/i18n/locales/{zh-TW,en}.js`：`recorder.entryCta`／`recorder.anonymousNote` 從 `prayerHero.*` 移入 `recorder.*`

## Mobile 置頂實作方式

沒有使用 CSS `order`/`flex-direction: column-reverse` 之類的重排技巧，也沒有為 Mobile／Desktop 各寫一份 markup。做法是：把 `<DetailPrayerInteractionPanel>` 直接插入在 DOM 順序中 `pdv2-hero-card`（標題／圖片）之後、`pdv2-companion-panel`（原本純連結的「下一步」引導卡）之前。由於整個 `pdv2-shell` 本來就是單欄、由上到下排列（無論 Mobile 或 Desktop），這個 DOM 位置在兩種版型下都自然落在第一屏，同時因為前面已經有 `pdv2-hero-card` 顯示完整標題／描述，滿足「不要讓使用者在看不到 Prayer 內容的情況下盲目錄音」的要求，不需要再重複一次標題。Real Browser tested（375×812／390×844／412×915／1280×800）：CTA 按鈕的 `getBoundingClientRect().top` 皆小於（或非常接近）視窗高度，且三個 Mobile 寬度下 `scrollWidth === clientWidth`（無橫向捲動）。

## 已知重疊（誠實記錄，非本次引入的新問題）

`GlobalPlayer.js` 內建的 companion-overlay（`showCompanionOverlay`，524-609 行）在 `/prayfor/[id]` 上原本就存在，且路由白名單設計讓它可能在某些既有互動下自動觸發（例如底部 mini-player 展開後的既有邏輯，本次盤點未逐一追蹤其所有觸發點，因為使用者已明確選擇「不修改 `GlobalPlayer.js`」）。這代表：**目前 `/prayfor/[id]` 技術上有兩個可能出現的全螢幕陪伴 UI**——新的、由「聆聽大家的禱告」按鈕觸發的 `CompanionOverlay.js`，以及舊有、由 `GlobalPlayer.js` 自己邏輯觸發的 companion-overlay。兩者共用同一個 `AudioContext` 播放狀態（不會互相衝突或造成資料不一致），但**視覺上是兩種不同的 UI**。這不是本次引入的新增重複邏輯（`GlobalPlayer.js` 完全未被修改），但完整統一為單一 UI 需要更大範圍的改動（使用者已在本 Commit 前選擇不做），記錄為後續可考慮的技術債，見 [[13-Risk-Register]]。
