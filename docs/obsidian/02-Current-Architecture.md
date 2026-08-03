---
tags: [start-pray, architecture]
---

# 目前技術架構

參見 [[00-Start-Here]]、[[05-Data-Model]]、[[06-Authentication-Dependencies]]。分析日期 2026-08-03，commit `4f06e73a`。

## 前端框架
- Next.js `14.2.35`（App Router，路由在 `src/app`）
- React `18.3.1` / `react-dom 18.3.1`
- 純 JavaScript，無 TypeScript（`jsconfig.json`，非 `tsconfig.json`）
- 富文本編輯器：`@ckeditor/ckeditor5-react ^6.3.0`
- 無 Tailwind（未找到 `tailwind.config.*`），樣式為純 CSS + `@media` 查詢（`src/app/globals.css` 等多個主題 CSS 檔）

> **2026-08-04 更正**：先前版本本文件誤寫成「首頁 three.js hero + 獨立 Cesium 全球禱告室頁面，兩個不同的地球實作」。實際讀碼後發現只有**一個**實際被渲染的地球元件：`GlobalPrayerRoomOptimized`（`src/components/GlobalPrayerRoom.js:819`），內部用 `loadCesium()` 動態載入 Cesium（CDN script，非 npm 套件，因此 `package.json` 找不到 `cesium`），首頁 hero（`HomeGlobeHero.js` 的 `HeroGlobe`→`GlobalPrayerRoomEmbed`）與 `/global-prayer-room` 全頁都呼叫同一個元件（用 `heroMap`/`isHero` 等 prop 切換樣式）。`package.json` 內的 `three ^0.184.0` 依賴，以及檔案內的 `CesiumPrayerGlobe`（475 行）、`LegacyPrayerGlobe`（1695 行，實際 `import("three")`）兩個函式，皆已確認是**未被任何渲染路徑呼叫的孤兒程式碼**，屬於 Phase 5「移除未使用套件／孤立元件」的候選項，而非目前正在運作的第二套地球。

## 後端框架 / Runtime
- Next.js API Routes（Node runtime），無獨立 Express server
- API 路由在 `src/app/api/**/route.js`（約 60 個檔案）
- `src/middleware.js`：Next.js middleware，驗證 admin session、CSRF same-origin 檢查、注入 `x-admin-role`/`x-admin-id` header

## 資料庫
- MySQL（`prisma/schema.prisma`：`provider = "mysql"`）
- 本地開發由 `docker-compose.yml` 提供（`mysql:8.4` image）

## ORM
- Prisma `^6.19.2`（`@prisma/client` 同版本）
- 封裝：`src/lib/prisma.js`
- Schema：`prisma/schema.prisma`；Migrations：`prisma/migrations/` 內 32 個時間戳資料夾（`20250921133228_init` ~ `20260715000100_add_token_reward_safety_fields`），另有 `PROD_MIGRATION_BUNDLE.sql`、`migration_lock.toml`

## 身分驗證方式
- **完全自建**，非 NextAuth / Supabase Auth / Firebase Auth
- 兩套平行 session 系統：
  - Admin：`src/lib/admin-session.js` + `src/lib/admin-route-auth.js`，cookie `start-pray-admin-session`，HMAC 簽章（secret 來自 `src/lib/session-secrets.js`），另有 TOTP 2FA（`otplib`，`src/app/api/admin/auth/login/route.js`）
  - Customer：`src/lib/customer-session.js`，密碼雜湊用 `bcryptjs`
- 已有匿名機制：`src/lib/guest-response.js`（HMAC 簽章 cookie `start_pray_guest`），詳見 [[06-Authentication-Dependencies]]

## 音訊錄製方式
- 瀏覽器原生 `MediaRecorder` API，無第三方錄音套件
- 主要實作：`src/components/VoicePrayerOverlay.js`（約 637 行）：`audio/webm;codecs=opus` → fallback `audio/webm`（`MediaRecorder.isTypeSupported`），`navigator.mediaDevices.getUserMedia({audio:true})`
- 另在 `src/components/v3-wireframe/V3WireframeApp.js`、`src/app/customer-portal/CustomerPortalClient.js` 有相關實作

## 音訊儲存方式
- Pluggable driver，由 `MEDIA_STORAGE_DRIVER` 環境變數切換（`src/lib/storage/index.js`）
  - `local`（預設）：`src/lib/storage/localDriver.js`，寫入 `VOICES_STORAGE_DIR` / `UPLOADS_STORAGE_DIR` 指定的檔案系統路徑，經 `/voices/[...path]`、`/uploads/[...path]` route 對外提供
  - `object`：`src/lib/storage/objectDriver.js` 為**未實作的骨架**，所有方法皆丟出 `MEDIA_STORAGE_NOT_CONFIGURED`（見 `MEDIA_STORAGE_RUNBOOK.md`）。無任何雲端 SDK（AWS/S3/Supabase Storage/Cloudinary）已整合
- ⚠️ `/voices/[...path]`、`/uploads/[...path]` 目前**沒有任何存取驗證**，任何人皆可讀取檔案（見 [[13-Risk-Register]]）

## 語音轉文字服務
- **不存在後端 STT 服務**（無 Whisper/Google STT/Azure Speech 等整合）
- 即時字幕是瀏覽器原生 **Web Speech API**（`SpeechRecognition`），在 `VoicePrayerOverlay.js` 內以 `interimTranscriptRef`/`transcript`/`segments` 處理，屬於前端即時轉寫，非後製字幕檔
- `PrayerResponse` 有 `voiceModerationStatus` 欄位，但審核流程是人工/後台驅動（`src/lib/voiceModeration.js`），非自動語音辨識結果

## Hosting
- Docker，非 Vercel/Netlify（無 `vercel.json`/`netlify.toml`）
- `Dockerfile`：multi-stage（deps → builder 執行 `prisma generate` + `next build` → runner 使用 `node:22-bullseye-slim`，開放 port 3000）
- `docker-compose.yml`：`db`（mysql:8.4）+ `app` 兩個服務，供本地開發
- `ecosystem.config.js`：PM2 設定
- 部署腳本：`scripts/deploy-prod.sh`（`npm run deploy:prod`），文件於 `deploy.md`、`PROD_DB_MIGRATION_RUNBOOK.md`

## CDN
- 未發現（無 CDN 設定檔或第三方 CDN 整合）

## 第三方服務
- Cesium（`NEXT_PUBLIC_CESIUM_TILE_URL`、`NEXT_PUBLIC_CESIUM_ION_TOKEN`，於 `src/components/GlobalPrayerRoom.js`）——僅用於 `/global-prayer-room` 頁的 3D 地球圖磚
- 無其他第三方 API 整合（無金流、無簡訊、無 email 服務商程式碼證據，需標註「待確認」於 [[14-Open-Questions]]）

## Analytics
- 未整合第三方 analytics（無 GA/PostHog/Mixpanel SDK）
- `src/app/admin/analytics/page.js` 是自建的後台分析頁面，非第三方服務

## Error Monitoring
- 未整合 Sentry 或同類服務
- `src/app/global-error.js` 為 Next.js 內建的全域錯誤邊界頁面

## CI/CD
- `.github/workflows/ci.yml`：單一 `quality` job，在 push/PR 到 `main` 時執行 checkout → Node 20 → `npm ci` → `npm run lint`
- **無測試、無 build、無自動部署步驟**

## 環境變數
來自 `.env.example`（僅列 key，不含值）：
`DATABASE_URL`、`NEXT_PUBLIC_APP_URL`、`ADMIN_SESSION_SECRET`、`CUSTOMER_SESSION_SECRET`、`ADMIN_TOTP_SECRET`、`MEDIA_STORAGE_DRIVER`、`VOICES_STORAGE_DIR`、`UPLOADS_STORAGE_DIR`、`ADMIN_LOGIN_OTP`、`GUEST_FINGERPRINT_SECRET`

程式碼中引用但不在 `.env.example` 的變數：`NEXT_PUBLIC_CESIUM_TILE_URL`、`NEXT_PUBLIC_CESIUM_ION_TOKEN`（`src/components/GlobalPrayerRoom.js`）、`NEXT_PUBLIC_SITE_URL`（`src/lib/seo.js`）

## 本地開發方式
`package.json` scripts：
- `npm run dev`（`next dev`）
- `npm run lint` / `lint:fix`
- `postinstall` 自動跑 `prisma generate`
- `db:migrate`（開發）、`db:studio`
- `qa` / `qa:full`（`scripts/qa-flow.mjs`，腳本化 QA，非單元測試）
- 種子腳本：`seed:admins`、`seed:demo`、`seed:prayers`
- 媒體工具：`media:audit`、`media:migrate`

## Production 建置方式
`npm run build`（`next build`）→ `npm run start`（`next start`）；正式環境遷移用 `db:migrate:prod`（`prisma migrate deploy`），部署見 `scripts/deploy-prod.sh`、`deploy.md`。

## 測試現況（本次 Phase 0 基準確認結果）
- 執行 `npm run lint`：✅ 通過，無警告或錯誤
- 專案內（排除 `node_modules`）無任何 `*.test.js`／`__tests__` 目錄
- `package.json` 無 `test` script
- 結論：目前**沒有可執行的自動化測試**，僅有 `scripts/qa-flow.mjs` 腳本化 QA 流程可作為替代驗收手段
