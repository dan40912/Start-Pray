# Media Storage Runbook

適用情境：`prayer-coin` 正式機使用同一台 VM，Node 由 PM2 啟動，Nginx 在前面反向代理。

## 儲存 driver 切換（PRD-009）

媒體讀寫已抽象為可插拔 driver,由環境變數 `MEDIA_STORAGE_DRIVER` 選擇:

- `local`（預設，未設定時亦為此）：寫入本地檔案系統，行為與過去完全一致。實際路徑仍由 `VOICES_STORAGE_DIR` / `UPLOADS_STORAGE_DIR` 控制。
- `object`：S3 相容物件儲存的**骨架**。本期尚未串接 SDK，任何寫入會丟出
  `ObjectStorageDriver not configured — see MEDIA_STORAGE_RUNBOOK.md`（HTTP 503），用來驗證切換已接好。

相關程式：`src/lib/storage/index.js`（driver 選擇）、`localDriver.js`、`objectDriver.js`。
上傳路徑（`/api/upload-image`、`/api/responses`）在寫入前會呼叫 `assertStorageWritable()`。

未來要真正啟用物件儲存時(另開 PRD)需補：
1. 在 `objectDriver.js` 用 S3 相容 SDK 實作 `put` / `getPublicUrl` / `assertWritable`。
2. 新增 endpoint / bucket / 金鑰等環境變數,並更新 `.env.example`。
3. 用 `npm run media:migrate` 將既有 `public/voices`、`public/uploads` 內容搬到物件儲存。
4. 把讀取路由 `/uploads/[...path]`、`/voices/[...path]` 與 `media-url.js` 改走 `getStorageDriver().getPublicUrl(...)`。

## 目標

- 程式碼可以持續 deploy / 覆寫。
- 使用者上傳的錄音與圖片不再放在 repo 內的 `public/voices`、`public/uploads`。
- 對外網址維持不變：
  - `/voices/...`
  - `/uploads/...`

## 1. 建立持久化資料夾

```bash
mkdir -p /home/startpraynow/prayer-coin-data/voices
mkdir -p /home/startpraynow/prayer-coin-data/uploads
chown -R startpraynow:startpraynow /home/startpraynow/prayer-coin-data
```

## 2. 設定正式機 `.env`

加入：

```env
VOICES_STORAGE_DIR=/home/startpraynow/prayer-coin-data/voices
UPLOADS_STORAGE_DIR=/home/startpraynow/prayer-coin-data/uploads
```

另外請確認正式機已設定：

```env
ADMIN_SESSION_SECRET=...
CUSTOMER_SESSION_SECRET=...
```

## 3. 設定 Nginx

建議在站點設定中加入：

```nginx
location /voices/ {
  alias /home/startpraynow/prayer-coin-data/voices/;
  try_files $uri =404;
}

location /uploads/ {
  alias /home/startpraynow/prayer-coin-data/uploads/;
  try_files $uri =404;
}
```

完成後：

```bash
sudo nginx -t
sudo systemctl reload nginx
```

## 4. 先做 audit

部署前先在正式機檢查 DB 內有哪些媒體紀錄仍缺檔或只存在舊 `public/` 目錄：

```bash
cd /home/startpraynow/prayer-coin
npm run media:audit
```

若要輸出 JSON 報告：

```bash
node scripts/audit-missing-media.js --json tmp/media-audit.json
```

狀態說明：

- `both`: 外部資料夾和舊 `public/` 都有檔案
- `storage_only`: 只在外部資料夾
- `legacy_only`: 只在舊 `public/`，代表還沒搬完
- `missing`: 兩邊都沒有，必須從備份或舊主機找回

## 5. 搬移現有媒體

先 dry-run：

```bash
npm run media:migrate
```

確認無誤後正式執行：

```bash
npm run media:migrate -- --apply
```

這支腳本會把：

- `public/voices/**`
- `public/uploads/**`

複製到外部資料夾，保留相對路徑，不會刪除原始檔。

## 6. 部署程式

```bash
cd /home/startpraynow/prayer-coin
git fetch origin
git checkout main
git pull origin main
npm ci
npx prisma generate
npm run build
pm2 startOrReload ecosystem.config.js --env production
pm2 save
```

## 7. 驗證

### 新錄音

- 送出新錄音回應
- DB `voiceUrl` 應仍為 `/voices/<cardId>/<filename>`
- 實體檔應出現在 `/home/startpraynow/prayer-coin-data/voices/<cardId>/`
- 前台可播放

### 新圖片

- 上傳頭像或卡片圖片
- API 回傳仍應是 `/uploads/<filename>`
- 實體檔應出現在 `/home/startpraynow/prayer-coin-data/uploads/`
- 前台可正常顯示

### 既有檔案

- 任選 2-3 筆舊錄音或圖片
- 搬移後網址不變
- 前台仍可正常讀取

## 備註

- 這個方案能避免 deploy 覆寫程式時把媒體一併洗掉。
- 這不等於備份；若主機磁碟壞掉，媒體仍可能遺失。
- 建議後續再補主機層級備份或定期同步到物件儲存。
