# Start Pray 專案架構、正式站部署與 API 總覽

這份文件給之後維護 Start Pray 的人快速理解：專案怎麼分層、正式站怎麼部署、PM2 怎麼操作，以及 API 大致怎麼分類。

Start Pray 是禱告與陪伴平台。開發和維運時要特別注意公開資料、私密代禱、帳號狀態、圖片來源與管理端權限。

## 1. 專案總覽

Start Pray 是一個 Next.js 14 App Router 專案，前台頁面、會員中心、管理後台和 API routes 都在同一個 codebase 裡。

```text
Browser
  -> Next.js App Router pages
  -> Next.js API routes
  -> Prisma Client
  -> MySQL
```

主要技術：

```text
Next.js 14
React 18
Prisma
MySQL
plain CSS
Sharp
Three.js
PM2
```

重要 npm scripts：

```bash
npm run dev              # 本機開發
npm run build            # 建置 Next.js
npm run start            # production mode 啟動 next start
npm run lint             # ESLint
npm run db:generate      # prisma generate
npm run db:migrate       # 本機 prisma migrate dev
npm run db:migrate:prod  # 正式環境 prisma migrate deploy
npm run deploy:prod      # 正式站部署腳本
```

## 2. 主要目錄

```text
src/app
  Next.js App Router 頁面、layout、API routes。

src/components
  共用 React 元件，例如首頁/禱告牆卡片探索、全球禱告室、網站外框。

src/lib
  domain helper、session、Prisma、server utilities、媒體處理、權限檢查。

src/styles
  全域與主題 CSS。專案目前使用 plain CSS，不使用大型 UI framework。

src/context
  client context，例如音訊播放狀態。

src/hooks
  reusable React hooks。

prisma/schema.prisma
  資料模型。

prisma/migrations
  Prisma migration。

public/img
  靜態圖片。

scripts
  seed、QA、部署、資料庫與媒體維護腳本。

docs
  技術文件與維運文件。
```

## 3. 前台、會員、管理端分區

### 公開頁面

```text
src/app/page.js
src/app/prayfor/page.js
src/app/prayfor/[id]/page.js
src/app/global-prayer-room/page.js
src/app/overcomer/page.js
src/app/overcomer/[slug]/page.js
```

常用元件：

```text
src/components/site-chrome.js
src/components/HomePrayerExplorer.js
src/components/GlobalPrayerRoom.js
src/components/HomeLandingPage.js
src/components/HomeGlobeHero.js
```

公開頁面不能洩漏私密卡片內容。`HomePrayerCard.isPrivate = true` 的卡片不應在公開頁面露出 title、description、image、owner、detailsHref。

### 會員頁面

```text
src/app/customer-portal/page.js
src/app/customer-portal/create/page.js
src/app/customer-portal/edit/[id]/page.js
```

會員功能主要處理：

```text
建立代禱卡
編輯自己的代禱卡
查看自己的回應紀錄
更新個人資料
上傳圖片或音訊
```

會員 API 要檢查：

```text
是否登入
帳號是否存在
帳號是否被封鎖
sessionVersion 是否仍有效
是否擁有該筆資料
```

相關 helper：

```text
src/lib/server-session.js
src/lib/customer-session.js
src/lib/customer-access.js
```

### 管理端

```text
src/app/admin/*
src/app/api/admin/*
```

管理端功能包含：

```text
使用者管理
代禱卡審核與封鎖
回應審核與封鎖
檢舉處理
分類管理
首頁 banner
站台設定
管理員帳號
操作紀錄
```

管理 API 要檢查：

```text
是否有 admin session
role 是否符合要求
unsafe method 是否同源
```

相關 helper：

```text
src/lib/admin-session.js
src/lib/admin-route-auth.js
src/middleware.js
```

## 4. 核心資料模型

目前前台主要內容單位是：

```text
HomePrayerCard
```

不是舊的 `PrayerRequest` flow。

主要關係：

```text
User
  -> HomePrayerCard[]
  -> PrayerResponse[]

HomePrayerCategory
  -> HomePrayerCard[]

HomePrayerCard
  -> User owner
  -> HomePrayerCategory category
  -> PrayerResponse[]
  -> HomePrayerCardReport[]

PrayerResponse
  -> HomePrayerCard 或 legacy PrayerRequest
  -> User responder
  -> PrayerResponseReport[]

AdminAccount
  -> 管理員登入與角色

AdminLog
  -> 後台操作與系統事件紀錄
```

資料庫 provider：

```text
MySQL
```

Prisma datasource 讀取：

```text
DATABASE_URL
```

## 5. 媒體與檔案儲存

圖片與音訊不要直接放進 repo 裡當使用者上傳資料。正式站使用 repo 外部目錄保存媒體：

```text
VOICES_STORAGE_DIR=/home/startpraynow/prayer-coin-data/voices
UPLOADS_STORAGE_DIR=/home/startpraynow/prayer-coin-data/uploads
```

PM2 的 ecosystem 目前也會注入這兩個環境變數。

使用者圖片只允許站內來源進入資料庫：

```text
/uploads/...
/api/card-thumbnail?...
```

相關檔案：

```text
src/app/api/upload-image/route.js
src/app/api/card-thumbnail/route.js
src/app/uploads/[...path]/route.js
src/app/voices/[...path]/route.js
src/lib/server-media-storage.js
src/lib/server-audio.js
src/lib/default-thumbnail.js
```

## 6. 正式站基本資訊

正式站目前是 VM/server 型部署，使用 PM2 管理 Next.js production process。

目前設定值：

```text
正式站 app 目錄: /home/startpraynow/prayer-coin
正式站資料目錄: /home/startpraynow/prayer-coin-data
PM2 app name: prayer-coin
Port: 3000
啟動方式: npm start -- --port 3000
PM2 設定檔: ecosystem.config.js
```

注意：`prayer-coin` 是目前正式站 PM2 app name 和 server path 的歷史名稱，不是對外產品名稱。對外文件與 UI 請使用 `Start Pray`。

PM2 log：

```text
/home/startpraynow/prayer-coin/logs/out.log
/home/startpraynow/prayer-coin/logs/error.log
```

正式站常用使用者：

```text
startpraynow
  正常 deploy、build、PM2 runtime 使用者。

startpraynow_gmail_com
  有 sudo。只用於修主機層問題，例如 port 被佔用、檔案 ownership 錯誤。
```

原則：正式 app runtime 盡量只讓 `startpraynow` 控制。避免 root 或其他使用者啟動另一個 Next.js/PM2 process 佔住 3000。

## 7. PM2 ecosystem 設定

目前 `ecosystem.config.js` 的重點：

```js
module.exports = {
  apps: [
    {
      name: "prayer-coin",
      cwd: "/home/startpraynow/prayer-coin",
      script: "npm",
      args: "start -- --port 3000",
      interpreter: "none",
      env: {
        NODE_ENV: "production",
        VOICES_STORAGE_DIR: "/home/startpraynow/prayer-coin-data/voices",
        UPLOADS_STORAGE_DIR: "/home/startpraynow/prayer-coin-data/uploads",
      },
      watch: false,
      instances: 1,
      exec_mode: "fork",
      max_memory_restart: "500M",
      out_file: "./logs/out.log",
      error_file: "./logs/error.log",
      merge_logs: true,
      log_date_format: "YYYY-MM-DD HH:mm:ss",
    },
  ],
};
```

第一次啟動：

```bash
cd /home/startpraynow/prayer-coin
mkdir -p logs
pm2 start ecosystem.config.js
pm2 save
pm2 status
pm2 logs prayer-coin --lines 30 --nostream
```

一般 restart：

```bash
cd /home/startpraynow/prayer-coin
pm2 restart prayer-coin --update-env
pm2 status prayer-coin
pm2 logs prayer-coin --lines 30 --nostream
```

停止：

```bash
pm2 stop prayer-coin
```

刪除 PM2 process：

```bash
pm2 delete prayer-coin
pm2 save
```

查看 port 3000：

```bash
ss -ltnp '( sport = :3000 )'
```

## 8. 標準部署流程

正式站建議使用一鍵部署：

```bash
cd /home/startpraynow/prayer-coin
npm run deploy:prod
```

`scripts/deploy-prod.sh` 目前會做：

```text
1. cd /home/startpraynow/prayer-coin
2. git fetch origin main
3. git pull --ff-only origin main
4. npm install --include=dev --no-audit --fund=false
5. npx prisma migrate deploy
6. npx prisma generate
7. rm -rf .next
8. npm run build
9. pm2 restart prayer-coin --update-env
   如果 PM2 process 不存在，改用 pm2 start ecosystem.config.js
10. pm2 save
11. 顯示 pm2 status、最新 logs、deployed commit
```

可以用環境變數覆蓋：

```bash
APP_DIR=/home/startpraynow/prayer-coin \
BRANCH=main \
REMOTE=origin \
PM2_APP_NAME=prayer-coin \
npm run deploy:prod
```

部署前建議本機或 staging 先跑：

```bash
npm run lint
npm run build
npx prisma migrate status
```

部署後快速檢查：

```bash
cd /home/startpraynow/prayer-coin
git rev-parse --short HEAD
pm2 status prayer-coin
ss -ltnp '( sport = :3000 )'
pm2 logs prayer-coin --lines 30 --nostream
```

手動部署流程：

```bash
cd /home/startpraynow/prayer-coin

git fetch origin main
git pull --ff-only origin main

mkdir -p logs
npm install --include=dev --no-audit --fund=false
npx prisma migrate deploy
npx prisma generate
rm -rf .next
npm run build

pm2 restart prayer-coin --update-env || pm2 start ecosystem.config.js
pm2 save
pm2 status prayer-coin
```

## 9. 正式站常見問題處理

### Port 3000 被佔用

症狀：

```text
EADDRINUSE: address already in use :::3000
```

檢查：

```bash
sudo ss -ltnp '( sport = :3000 )'
```

處理：

```bash
sudo pkill -9 -f "next-server" || true
sudo pkill -9 -f "next start --port 3000" || true
```

再回到 `startpraynow` 啟動 PM2。

### PM2 log 權限錯誤

症狀：

```text
EACCES: permission denied, open '/home/startpraynow/prayer-coin/logs/out.log'
```

處理：

```bash
sudo chown -R startpraynow:startpraynow /home/startpraynow/prayer-coin
sudo chown -R startpraynow:startpraynow /home/startpraynow/.pm2

sudo mkdir -p /home/startpraynow/prayer-coin/logs
sudo rm -f /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log
sudo -u startpraynow touch /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log
sudo chmod 755 /home/startpraynow/prayer-coin/logs
sudo chmod 644 /home/startpraynow/prayer-coin/logs/out.log /home/startpraynow/prayer-coin/logs/error.log
```

### 瀏覽器還看到舊版前端

可能原因：

```text
新的 .next 已建好，但實際服務中的 process 還是舊的。
或 root/另一個 PM2 process 仍佔用 3000。
```

檢查：

```bash
pm2 status prayer-coin
ss -ltnp '( sport = :3000 )'
pm2 logs prayer-coin --lines 50 --nostream
```

確認 PM2 restart 成功後，瀏覽器再 hard refresh。

## 10. 環境變數

從 `.env.example` 開始：

```text
DATABASE_URL
NEXT_PUBLIC_APP_URL
ADMIN_SESSION_SECRET
CUSTOMER_SESSION_SECRET
ADMIN_TOTP_SECRET
VOICES_STORAGE_DIR
UPLOADS_STORAGE_DIR
```

正式站注意：

```text
ADMIN_SESSION_SECRET 和 CUSTOMER_SESSION_SECRET 必須是不同且足夠長的 secret。
ADMIN_TOTP_SECRET 每個環境應獨立設定。
不要在正式站啟用 ADMIN_LOGIN_OTP，除非是短暫排查。
媒體 storage dir 要放在 repo 外，避免 deploy 清掉使用者上傳資料。
```

## 11. API 架構總覽

API routes 全部在：

```text
src/app/api
```

大致分成：

```text
Public API
Auth API
Customer API
Admin API
Media API
Legacy / compatibility API
```

### Public API

公開讀取或公開互動用。仍然要注意不要回傳私密卡片資料。

```text
GET  /api/home-cards
POST /api/home-cards
GET  /api/home-cards/[id]

GET  /api/home-categories

GET  /api/responses/[homeCardId]
POST /api/responses

POST /api/prayfor/report
POST /api/prayer-response/report
POST /api/overcomer/report

GET  /api/banner
```

說明：

```text
/api/home-cards
  GET 用於首頁與禱告牆列表。
  POST 建立代禱卡，實作上仍要檢查登入、帳號狀態、分類與圖片來源。

/api/home-cards/[id]
  目前 GET/PUT/PATCH/DELETE 是 compatibility stub，主要完整管理 flow 在 customer/admin routes。

/api/responses
  新增代禱回應。

/api/responses/[homeCardId]
  讀取某張 HomePrayerCard 的回應。

/api/*/report
  建立檢舉紀錄，通常會限制同一使用者對同一目標重複檢舉。
```

`/api/home-cards` 常見 query：

```text
sort=recent | responses | updated
limit=12
skip=0
category=health
categoryId=1
search=family
```

`/api/home-cards` 建立/更新常見欄位：

```text
title
description
categoryId
image
tags
meta
voiceHref
locationCity
locationCountry
locationLat
locationLng
isPrivate
```

### Auth API

會員登入、登出、註冊與密碼重設：

```text
POST /api/auth/signup
POST /api/auth/login
POST /api/auth/logout
POST /api/auth/request-reset
POST /api/auth/reset-password
```

會員 session cookie 由 `src/lib/customer-session.js` 管理，server route 常透過 `src/lib/server-session.js` 讀取。

### Customer API

會員中心使用。這一區都應檢查 customer session、帳號狀態與資料 ownership。

```text
GET    /api/customer/session
DELETE /api/customer/session

GET   /api/customer/profile
PATCH /api/customer/profile

GET    /api/customer/cards
GET    /api/customer/cards/[id]
PATCH  /api/customer/cards/[id]
PUT    /api/customer/cards/[id]
DELETE /api/customer/cards/[id]

GET   /api/customer/responses
PATCH /api/customer/responses/[id]

POST /api/customer/story-audio

GET  /api/customer/withdrawals
POST /api/customer/withdrawals
```

常用 helper：

```text
requireSessionUser()
ensureActiveCustomer()
```

`ensureActiveCustomer()` 會檢查：

```text
userId 是否存在
User 是否存在
User.isBlocked 是否為 false
sessionVersion 是否符合
```

### Admin API

管理端 API 全部在：

```text
/api/admin/*
```

middleware 會先擋：

```text
未登入 admin
非同源 unsafe mutation
```

route 內也應使用：

```text
requireAdmin(request)
roleSet(...)
```

管理員登入與 session：

```text
POST   /api/admin/auth/login
GET    /api/admin/session
DELETE /api/admin/session
```

使用者管理：

```text
GET   /api/admin/users
GET   /api/admin/users/[id]
PATCH /api/admin/users/[id]
PATCH /api/admin/users/[id]/block
```

代禱卡管理：

```text
GET   /api/admin/prayfor
PATCH /api/admin/prayfor
GET   /api/admin/prayfor/[id]
PATCH /api/admin/prayfor/[id]
PATCH /api/admin/prayfor/[id]/block
```

回應管理：

```text
GET   /api/admin/prayerresponse
GET   /api/admin/prayerresponse/[id]
PATCH /api/admin/prayerresponse/[id]
PATCH /api/admin/prayerresponse/[id]/[block]
```

分類：

```text
GET  /api/admin/home-categories
POST /api/admin/home-categories
PUT  /api/admin/home-categories/[id]
```

檢舉：

```text
GET /api/admin/reports
```

站台設定與 banner：

```text
GET   /api/admin/site-settings
PATCH /api/admin/site-settings

GET    /api/admin/banners
POST   /api/admin/banners
PATCH  /api/admin/banners
DELETE /api/admin/banners
PATCH  /api/admin/banners/[id]
DELETE /api/admin/banners/[id]
```

管理員帳號：

```text
GET   /api/admin/accounts
POST  /api/admin/accounts
PATCH /api/admin/accounts/[id]
```

操作紀錄：

```text
GET /api/admin/logs
```

其他營運資料：

```text
GET   /api/admin/token-balances
GET   /api/admin/token-rules
PATCH /api/admin/token-rules
GET   /api/admin/transactions
PATCH /api/admin/transactions/[id]
POST  /api/admin/transactions/grant
```

這些 route 是現有後台營運資料的一部分。新增對外功能時，不要把它們包裝成新的產品敘事。

### Media API

```text
POST /api/upload-image
GET  /api/card-thumbnail
GET  /uploads/[...path]
GET  /voices/[...path]
```

`POST /api/upload-image` 應檢查：

```text
登入會員
帳號可用
file type
file size
Sharp 是否能 decode
輸出為站內 /uploads/... URL
```

`GET /api/card-thumbnail` 產生 fallback thumbnail。建立卡片時若沒有上傳圖片，可以使用這條 route。

### Legacy / compatibility API

仍存在一些舊 flow 或 compatibility route：

```text
/api/prayers
/api/prayers/[id]
/api/prayers/[id]/responses
/api/PrayerResponse
/api/users
/api/hello
```

新功能預設不要接到這些舊 flow。除非是在維護舊頁面或做相容性修補，否則前台內容請優先走 `HomePrayerCard` 相關 route。

## 12. Middleware 與權限邊界

`src/middleware.js` 目前負責：

```text
admin 頁面登入保護
admin API session 保護
admin unsafe method 同源檢查
/legacy/* noindex 與 extension rewrite
把 x-start-pray-pathname 放進 request headers
```

重要 cookie：

```text
start-pray-admin-session
```

admin middleware 放行：

```text
/api/admin/auth/login
/api/admin/session
```

其他 `/api/admin/*` 都必須有有效 admin session。

## 13. Prisma 與 migration 操作

本機改 schema：

```bash
npx prisma migrate dev
npx prisma generate
```

正式站套 migration：

```bash
npx prisma migrate deploy
npx prisma generate
```

正式站部署腳本已包含這兩步。

改資料庫時不要只改 `prisma/schema.prisma`，必須建立 migration。

檢查 migration 狀態：

```bash
npx prisma migrate status
```

## 14. 維護時的基本檢查清單

改 UI 後至少看：

```text
首頁
禱告牆
/customer-portal/create
全球禱告室
footer / nav
手機版寬度
```

改 API 或 server component 後至少跑：

```bash
npm run lint
npm run build
```

改 DB 後再跑：

```bash
npx prisma generate
npx prisma migrate status
```

部署後至少確認：

```text
公開頁面可開
登入可用
建立代禱卡可用
圖片上傳可用
全球禱告室可用
admin 頁面仍受保護
PM2 只有一個 process 服務 3000
```

## 15. 延伸文件

```text
docs/architecture.md
docs/api.md
docs/data-and-auth.md
docs/admin.md
docs/deployment.md
docs/media.md
deploy.md
PROD_DB_MIGRATION_RUNBOOK.md
MEDIA_STORAGE_RUNBOOK.md
ADMIN_2FA_RUNBOOK.md
```
