# Start Pray 專案導覽

更新日期：2026-04-28

這份文件給後續 Agent、協作者與新加入者快速理解 Start Pray 的專案架構、資料流與特殊名詞。若 `README.md`、`HANDOFF.md` 或其他舊文件出現亂碼，請優先參考本文件，再回到原始碼確認細節。

## 產品定位

Start Pray 是一個信仰社群代禱平台，核心目標是讓有需要的人可以安全提出代禱事項，讓願意代禱的人能真實回應，並讓「得勝者」的生命故事與服事被看見。

主要使用者角色：

- 訪客：瀏覽禱告牆、全球禱告室、得勝者公開頁。
- 會員 / 得勝者：建立代禱卡、管理自己的代禱事項、回覆代禱、管理公開個人檔案。
- 管理員：審核內容、管理使用者、分類、錢包、獎勵規則與站台設定。

## 技術架構

- Framework：Next.js 14 App Router。
- UI：React 18，Server Components 與 Client Components 混用。
- Database：MySQL。
- ORM：Prisma。
- Auth：站內 session helper，前台使用 `src/lib/server-session.js` 與 customer session，後台使用 admin session。
- Styling：全域 CSS 與主題 CSS，主要在 `src/app/globals.css`、`src/styles/*.css`，部分頁面使用 `style jsx`。
- Media：圖片與音訊會存到 `public/uploads`、`public/voices`，相關工具在 `src/lib/server-media-storage.js`、`src/app/api/upload-image/route.js`。
- Deployment：專案含 Docker、PM2 與 migration runbook，部署前仍需依最新環境確認。

常用指令：

```bash
npm run dev
npm run lint
npm run build
npx prisma generate
npx prisma migrate deploy
```

## 重要目錄

- `src/app`：Next.js App Router 頁面與 API routes。
- `src/components`：共用 UI component。前台導覽在 `src/components/site-chrome.js`。
- `src/lib`：資料存取、session、SEO、媒體、獎勵、輔助邏輯。
- `src/styles`：前台、後台、詳細頁、會員中心等主題 CSS。
- `prisma/schema.prisma`：資料模型。
- `prisma/migrations`：資料庫 migration。
- `public/img`：內建圖片素材與分類圖。
- `public/uploads`：使用者上傳圖片。
- `public/voices`：使用者上傳或錄製的音訊。
- `scripts`：seed、QA、媒體遷移、進度追蹤與部署輔助腳本。
- `output/spreadsheet`：進度追蹤用試算表。這類檔案常是人工或腳本維護，除非任務要求，不要任意覆蓋。

## 主要頁面

- `/`：首頁。
- `/prayfor`：禱告牆，顯示公開代禱卡列表與搜尋。
- `/prayfor/[id]`：單一代禱詳情頁與回應。
- `/global-prayer-room`：全球禱告室，顯示有城市級位置的代禱光點。
- `/overcomer`：得勝者列表。
- `/overcomer/[slug]`：得勝者公開個人頁。
- `/customer-portal`：會員中心。
- `/customer-portal/create`：建立代禱卡。
- `/customer-portal/edit/[id]`：編輯自己的代禱卡。
- `/admin/*`：管理後台。

## API 與資料流

公開代禱卡：

- `GET /api/home-cards`：禱告牆列表、搜尋、分類篩選。
- `POST /api/home-cards`：得勝者建立代禱卡，需要登入且帳號未封鎖。
- `GET /api/home-cards/[id]`：單一公開卡片。

會員中心：

- `GET /api/customer/cards`：取得目前登入者擁有的代禱卡。
- `GET /api/customer/cards/[id]`：讀取自己的單一卡片。
- `PUT /api/customer/cards/[id]`：更新自己的卡片內容。
- `PATCH /api/customer/cards/[id]`：切換自己的卡片可見性。
- `DELETE /api/customer/cards/[id]`：刪除自己的卡片。
- `GET/PUT /api/customer/profile`：會員個人檔案與公開設定。
- `GET /api/customer/responses`：會員收到或管理的回應資料。

代禱回應：

- `PrayerResponse` 可掛在 `HomePrayerCard` 或舊的 `PrayerRequest`。
- 回應可含文字、語音、匿名狀態、檢舉數、獎勵狀態。

管理後台：

- `src/app/api/admin/*` 負責後台帳號、內容審核、分類、使用者、交易、獎勵規則與站台設定。

## 核心資料模型

主要模型在 `prisma/schema.prisma`：

- `User`：前台會員 / 得勝者帳號。含 email、username、個人檔案、公開頁設定、錢包餘額、區塊鏈地址等。
- `HomePrayerCard`：目前前台「禱告牆」的主要代禱卡模型。包含標題、描述、封面、分類、標籤、meta、擁有者、回應、檢舉與全球禱告室位置欄位。
- `HomePrayerCategory`：禱告分類。
- `PrayerResponse`：代禱回應。可掛到 `HomePrayerCard` 或舊模型 `PrayerRequest`。
- `PrayerRequest`：較早期的代禱請求模型，**已凍結(PRD-006)**，標記為 `@deprecated`，僅供歷史資料相容，不應再建立新資料。遷移腳本：`scripts/migrate-prayerrequest-to-homecard.js`(支援 `--dry-run`)。實際 drop 表/欄位待資料驗證無誤後另開 PRD 處理。新前台主流程一律使用 `HomePrayerCard`。
- `TokenTransaction`：Start Pray 代幣 / 點數交易紀錄。
- `TokenRewardRule`：代禱回應獎勵規則。
- `AdminAccount`：後台管理員帳號。
- `AdminLog`：後台操作與系統紀錄。
- `SiteBanner`、`SiteSetting`：站台內容與維護模式設定。

## 全球禱告室

全球禱告室是 2026-04-28 加入的功能，頁面為 `/global-prayer-room`。

設計原則：

- 只使用城市級的大概位置。
- 不收真實 GPS、地址、街道或手動座標。
- 建立 / 編輯代禱卡時，只能從預設城市清單選擇。
- 未選城市的代禱卡不會出現在全球禱告室。

相關檔案：

- `src/lib/prayerLocations.js`：城市白名單、label builder、payload sanitization。
- `src/components/GlobalPrayerRoom.js`：前台互動地球、光點、彈窗。
- `src/app/global-prayer-room/page.js`：Server Component，查詢有位置的代禱卡。
- `prisma/migrations/20260428_add_prayer_location/migration.sql`：新增位置欄位。

`HomePrayerCard` 新增欄位：

- `locationCity`
- `locationCountry`
- `locationLat`
- `locationLng`

## 特殊名詞表

- Start Pray：本平台品牌名稱。
- Prayer Coin：專案早期名稱，也可能指平台代幣概念。
- 禱告牆：公開代禱卡列表，路徑 `/prayfor`。
- 代禱卡 / 禱告卡：`HomePrayerCard`，目前最主要的代禱內容單位。
- 代禱事項：使用者提出的具體禱告需要，通常存在 `HomePrayerCard.description`。
- 代禱回應：`PrayerResponse`，其他人針對代禱卡送出的文字或語音回應。
- 得勝者：平台中建立代禱卡、分享見證或公開個人檔案的會員角色；技術上多數情境是 `User`。
- 會員中心：`/customer-portal`，得勝者管理個人資料、代禱卡與回應的地方。
- 全球禱告室：`/global-prayer-room`，以地球地圖顯示有城市級位置的代禱光點。
- 城市級大概位置：只代表城市中心附近的公開展示點，不代表使用者真實所在地。
- 光點：全球禱告室地圖上的 marker，點擊後顯示代禱彈窗。
- 分類：`HomePrayerCategory`，用於禱告牆分類篩選。
- Meta：`HomePrayerCard.meta`，JSON 欄位；目前可放補充資訊與 gallery 圖片標記。
- Gallery：代禱卡多張圖片，透過 `gallery::/uploads/...` 字串存在 `meta` 中。
- Voice / voiceHref：語音代禱或音訊來源 URL。
- Token / Start Pray 隨：平台獎勵點數或代幣概念。程式裡以 `TokenTransaction`、`walletBalance`、`TokenRewardRule` 表示。
- RewardStatus：回應獎勵狀態，包含 `PENDING`、`BLOCKED`、`REWARDED`。
- Report：檢舉。代禱卡、回應、得勝者使用者都有對應 report model 或 endpoint。
- Blocked：被封鎖或隱藏。`isBlocked` 可能出現在使用者、代禱卡、回應上。
- Maintenance Mode：站台維護模式，存在 `SiteSetting.maintenanceMode`。

## 開發注意事項

- 這個專案有一些既有文件或中文字串出現亂碼。新增文件與新 UI 文案請使用正常 UTF-8 中文。
- 不要任意回復或重置使用者的未提交修改。動手前先看 `git status --short`。
- 修改 Prisma schema 後要新增 migration，並執行 `npx prisma generate`。
- 前台建立代禱卡的主要入口是 `/customer-portal/create`，不是 admin 後台。
- 公開代禱牆的主要資料是 `HomePrayerCard`，不要誤以為 `PrayerRequest` 是所有新流程的主表。
- 圖片上傳應使用站內 `/api/upload-image` 與 `/uploads/...`，避免接受外部圖片網址作為新建立卡片的封面。
- 全球禱告室位置必須走 `src/lib/prayerLocations.js` 的白名單與 sanitization，不要在表單中加入精準座標或自由地址欄位。
- 新增前台頁面時，通常要同步檢查 `src/components/site-chrome.js` 導覽與 `src/app/sitemap.js`。
- 完成後至少跑 `npm run lint` 與 `npm run build`。

## Agent 接手建議

接手前建議依序做：

1. 看 `git status --short`，確認是否有使用者或其他 Agent 的既有修改。
2. 看本文件了解架構與名詞。
3. 針對任務讀相關頁面、API route、`src/lib` helper 與 Prisma model。
4. 修改前先判斷資料流是否跨前台、會員中心、後台與 migration。
5. 修改後跑 lint/build；若碰 Prisma，補跑 generate/migrate。
6. 回報時明確列出改了哪些檔案、驗證結果與未處理風險。
