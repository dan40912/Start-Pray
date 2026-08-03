---
tags: [start-pray, acceptance, phase-1]
---

# Start Pray Phase 1 Interim Acceptance Report

參見 [[10-Implementation-Plan]]、[[12-Change-Log]]、[[24-Manual-QA]]。

**這不是完整產品驗收報告**，只針對目前 `poc/minimal-prayer-redesign` 分支上已存在的兩個 Commit 進行驗收：
1. `6b8cc84` — `refactor: simplify account and global navigation`
2. `04538e7` — `refactor: replace globe hero with minimal prayer entry`

錄音、倒數、預覽、重錄、匿名投稿、Storage、管理 Token、Rate limit、字幕、播放、「我為你禱告」、完整安全補強、Production readiness 均**未實作**，不在本次驗收範圍，一律標記 `Not Implemented`。

## Scope

| Commit | 目的 |
|---|---|
| `6b8cc84` | 導覽列與頁尾收斂：隱藏登入/註冊/會員中心/全球禱告室入口，i18n key 對應重構，頁尾空欄位防護 |
| `04538e7` | 首頁第一屏改用極簡 `HomePrayerHero`：移除 Cesium/GlobeSkeleton/統計數字/全球禱告室 CTA，中英文案齊備 |

## Git 驗收

| 項目 | 結果 |
|---|---|
| Base Branch | `main` |
| Base Commit | `4f06e73aa95724ecb68bc5e0c8e4db8041f50ece` |
| Current Branch | `poc/minimal-prayer-redesign` |
| Current Commit | `04538e7` |
| Commit 數量（領先 main） | 2 |
| 修改檔案數 | 4（`site-chrome.js`、`HomeLandingPage.js`、`en.js`、`zh-TW.js`） |
| 新增檔案數 | 6（5 份 obsidian 文件 + `HomePrayerHero.js`） |
| 刪除檔案數 | 0 |
| 是否修改 Schema | 否 |
| 是否新增 Migration | 否 |
| 是否修改 Auth 邏輯 | 否（僅 UI 顯示條件，`useAuthSession`/`customer-session`/`admin-session` 程式碼未變動） |
| 是否修改 API | 否 |
| 是否修改 Storage | 否 |
| 是否修改部署設定 | 否 |
| 是否新增依賴 | 否（`package.json`/lockfile 未變動） |
| 是否修改 lock file | 否 |
| `.claude/launch.json` 是否入 Commit | 否（untracked，兩個 Commit 皆未包含） |
| Working tree 未辨識修改 | 僅 `output/spreadsheet/startpray-progress-tracker.xlsx`（既有 post-commit hook 自動更新，非本次改動內容） |
| 是否 Push | 否（`origin` 無此分支） |
| 是否 Merge/PR/部署 | 否 |

## Commit 1 驗收（`6b8cc84`）

| 檢查項 | 結果 | 證據 |
|---|---|---|
| Header 未登入不顯示登入/註冊/會員中心/全球禱告室 | Passed | 1280×800、1440×900 `read_page` 僅見 禱告牆/得勝者/平台介紹/使用方式/切換語言/CTA |
| Mobile menu 與桌面一致 | Passed | 375×812 開啟選單後 `nav-links` 內容與桌面相同，無多餘項目 |
| Mobile menu 可開關 | Passed | 直接呼叫 React handler 確認 `aria-expanded`/`is-open` 正確切換（Browser 自動化的座標點擊事件未能觸發 React delegated listener，屬於測試工具限制，見下方 Known Limitations） |
| Footer 不顯示登入/註冊/會員中心/全球禱告室 | Passed | `footer-column` 三欄內容確認 |
| Footer 無空 Column | Passed | 三欄皆非空（Start Pray 欄 4 項、安心使用 1 項、帳號與幫助 1 項），且已加上 `.filter(col => col.links.length > 0)` 防護 |
| i18n zh-TW | Passed | 導覽/頁尾文字正確 |
| i18n en | Passed | `/en` 導覽顯示 Prayer Wall/Stories/About/How It Works |
| 無 undefined/空 label | Passed | 逐一比對皆為預期文字 |
| Route 回歸 `/login` | Route Passed / Authenticated flow Not Tested | 直接開啟回傳標題「登入 \| Start Pray」 |
| Route 回歸 `/signup` | Route Passed / Authenticated flow Not Tested | 標題「註冊 \| Start Pray」 |
| Route 回歸 `/customer-portal` | Route Passed / Authenticated flow Not Tested | 標題「會員中心 \| Start Pray」；console 顯示既有的「Please sign in」錯誤，屬 `CustomerPortalClient.js` 既有未登入行為，與本次改動無關 |
| Route 回歸 `/global-prayer-room` | Passed | 標題「全球禱告室 \| Start Pray」，且確認 Cesium 腳本正常載入（`window.Cesium` 存在），全球禱告室功能未被破壞 |

## Commit 2 驗收（`04538e7`）

| 檢查項 | 結果 | 證據 |
|---|---|---|
| 首頁無 Cesium | Passed | `document.scripts` 過濾 cesium 為空陣列，`window.Cesium === undefined` |
| 首頁無 GlobeSkeleton | Passed | `document.querySelector('.home-map-skeleton')` 為 null |
| 首頁無地球/世界地圖/雙欄舊 Hero/右側大型占位 | Passed | 視覺與 DOM 結構確認僅剩單欄置中內容 |
| 首頁無統計數字（第一屏） | Passed | Hero 區塊只有 eyebrow/headline/subhead/CTA/anonymous note |
| 首頁無全球禱告室 CTA（第一屏） | Passed | 舊「進入全球禱告室」按鈕已隨 `HomeGlobeHero` 一併不再引用 |
| 首頁無登入/註冊 CTA | Passed | 沿用 Commit 1 的導覽隱藏邏輯 |
| 第一屏只有一個主要 CTA | Passed | `read_page` 於三種桌面尺寸與兩種手機尺寸皆只見一個 button |
| CTA 明確標記為 Prototype，不宣稱錄音已完成 | Passed | 點擊後顯示「（原型階段）完整錄音功能即將推出，敬請期待。」（英文：`(Prototype) Full recording is coming soon.`），透過直接呼叫 React handler 驗證觸發正確 |
| 中文文案 | Passed | 「留下一段禱告，讓陌生人為你禱告」/「不需要登入。用你的聲音記下此刻，會有人聆聽並為你禱告。」/「開始錄下你的禱告」/「匿名送出，你可以在送出前重新錄製。」逐字相符 |
| 英文文案 | Passed | 「Leave a prayer, and let a stranger pray for you」/「No account needed. Record what is on your heart, and someone will listen and pray for you.」/「Record your prayer」/「Submit anonymously. You can listen and record again before sending.」逐字相符，無中文殘留 |
| i18n key 存在、無 fallback 錯誤 | Passed | `home.prayerHero.*` 已寫入 `zh-TW.js`、`en.js`，非寫死字串 |
| Desktop 1280×800 | Passed | 見上 |
| Desktop 1440×900 | Passed | 導覽/CTA 結構一致 |
| Mobile 375×812 | Passed | CTA 高度 49.78px（≥48px）、無橫向捲動（`scrollWidth 375 === innerWidth 375`）、標題未溢出 |
| Mobile 390×844 | Passed | 同上（CTA 高度 49.78px、無橫向捲動） |
| Mobile menu 正常 | Passed | 見 Commit 1 |
| Footer 正常 | Passed | 見 Commit 1 |

## Not Implemented（明確排除於本次驗收，非 Bug）
錄音（含麥克風權限、3-2-1 倒數、錄音狀態、計時、Blob）、預覽、重錄、匿名投稿 API、Prisma Schema 變更、Migration、Storage 調整、匿名管理 Token、Rate limit、字幕/轉錄、禱告聆聽區塊、「我為你禱告」、完整安全補強（CSRF/CORS/檔案驗證等）、自動化測試、Production readiness。

## Results

| 模組 | 結果 |
|---|---|
| Git 安全 | Passed |
| 導覽 | Passed |
| Mobile menu | Passed |
| Footer | Passed |
| Hero | Passed |
| 中文 | Passed |
| 英文 | Passed |
| Desktop | Passed |
| Mobile | Passed |
| Route regression | Passed（會員專屬功能本身標記 Authenticated flow Not Tested，因無測試帳號） |
| Lint | Passed（exit 0） |
| Build | Passed（exit 0，96 個靜態頁面全數產生） |
| Automated tests | Not Available（專案無 `test` script，亦無任何 `*.test.js`） |
| Console/Network（首頁） | Passed（無 Cesium 請求、無 hydration 錯誤；`/api/customer/session` 401 為未登入狀態下的預期回應） |
| Console/Network（`/global-prayer-room`） | Passed（Cesium 正常載入，功能未受影響） |

## Issues
本次兩個 Commit 範圍內**未發現問題**。

唯一需要記錄的觀察（非 Bug，屬測試工具限制）：Browser 自動化工具的座標點擊（`computer` action）在此環境中，其分派的點擊事件未能穩定觸發 React 18 的委派事件監聽器（可能因缺乏 `isTrusted` 或事件序列與真實使用者手勢不同）；改用直接呼叫 React fiber 上的 `onClick` handler 可正確驗證元件邏輯本身無誤。這不影響驗收結論，但代表往後若要用此工具做互動式驗收（例如 Phase 2 的真實錄音流程），需要對此限制有心理準備，必要時改用真實裝置或手動測試。

## Known Limitations（本次驗收範圍內）
- 本機無 Docker/MySQL 常駐服務，`npm run dev` 靠現有 `.env.local` 提供的可用 `DATABASE_URL` 才能連線資料庫；若日後該連線失效，需改用 `docker compose up db` 等方式重建環境
- 未使用真實會員帳密測試「已登入」狀態下的導覽與功能（`Authenticated flow Not Tested`）
- 未執行 Lighthouse 或 axe 等自動化 a11y/效能工具（環境未提供）

## Recommendation
**Phase 1 通過，可進入錄音功能開發。**
