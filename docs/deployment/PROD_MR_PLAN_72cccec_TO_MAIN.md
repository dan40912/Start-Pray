# Start Pray PROD MR 計畫：`72cccec` → `main`

文件日期：2026-07-15（Asia/Taipei）  
PROD 現行版本：`72cccec`（Revert homepage globe components to b6d027d）  
目前候選版本：`e2d857e`（文件建立前的 `origin/main`）  
最終 Release SHA：`TBD`（完成本文件的 No-Go 項目後鎖定）

> 本文件同時作為程式 Merge Request、DB Migration Request、部署與回滾計畫。  
> **目前狀態：程式端阻擋已排除；在 staging rehearsal、PROD backup 與 DBA/Privacy/Product 簽核完成前仍為 NO-GO。**

## 1. 發布目標

本次發布把 PROD 從 `72cccec` 升級到完成修正後的 `main`，主要交付：

- 匿名／訪客文字禱告回應與 rate limit。
- 回應內容審核、語音審核與管理端操作。
- 匿名回應專用 avatar，公開 API 不再回傳匿名會員本人頭像與身份欄位。
- 使用者 trust score、卡片待審狀態與檢舉流程調整。
- 代幣獎勵的開關、每日上限、單卡上限、最低文字長度與語音核准條件。
- 播放 wellbeing 提醒、語音錄製體驗與部分手機版 UI 調整。
- 媒體 storage driver 抽象；本次 PROD 仍使用 `local`，不啟用未完成的 `object` driver。
- 新增 PRD、架構與部署文件，以及 `/v3-wireframe/*` POC 路由。

版本差異規模：96 個檔案，約 11,482 行新增、388 行刪除。這是一個中高風險發布，必須先在 production-like staging 以 PROD 備份副本完整演練。

## 2. MR 合併／發布前 No-Go 項目

以下項目未完成前不得排 PROD：

### 2.1 補齊遺漏的 `TokenRewardRule` migration（已完成）

`prisma/schema.prisma` 已新增以下欄位，但目前三個新 migration 都沒有建立它們：

```text
rewardsEnabled
dailyRewardCap
perCardRewardCap
minMessageLength
requireVoiceApproved
```

新程式會直接讀寫這些欄位。若 PROD DB 沒有欄位，代幣規則 API、建立會員回應或結算流程可能出現 Prisma unknown-column 錯誤與 HTTP 500。

已新增正式 Prisma migration：

```text
prisma/migrations/20260715000100_add_token_reward_safety_fields/migration.sql
```

建議 SQL：

```sql
ALTER TABLE `token_reward_rule`
  ADD COLUMN `rewardsEnabled` BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN `dailyRewardCap` INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN `perCardRewardCap` INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN `minMessageLength` INTEGER NOT NULL DEFAULT 15,
  ADD COLUMN `requireVoiceApproved` BOOLEAN NOT NULL DEFAULT true;
```

正式部署腳本現在會先執行 `scripts/db/preflight-prod-release.cjs`。若 PROD 已人工加入任何同名欄位、只有部分欄位／索引存在、或 migration history 未完成，預檢會 fail closed，在 `migrate deploy` 前停止。DBA 仍需用第 5 節 SQL 留存人工核對證據。

### 2.2 更新 DB 交付文件與 SQL bundle（已完成）

修正前：

- Repo 有 29 個 migration（補上 2.1 後應為 30 個）。
- `PROD_DB_MIGRATION_RUNBOOK.md` 仍只列 22 個 migration。
- `prisma/migrations/PROD_MIGRATION_BUNDLE.sql` 未包含 2026-04 之後的 migration。

已執行：

```bash
npm run db:bundle
```

`PROD_DB_MIGRATION_RUNBOOK.md` 已更新為 30 筆 migration，最新 bundle 亦包含四筆本次 release migration。正式環境仍優先使用 `npx prisma migrate deploy`；bundle 只供 DBA review 或受控 SQL 流程。

### 2.3 `/v3-wireframe/*` 公開決策（已核准）

候選版本新增可公開存取的 POC 頁面：

```text
/v3-wireframe
/v3-wireframe/pray
/v3-wireframe/playback
/v3-wireframe/share
/v3-wireframe/world
```

Product Owner 已於 2026-07-15 確認：本次 PROD release 允許正式公開上述 POC 路由。

### 2.4 Release hygiene（已完成）

已從 release 移除開發伺服器 runtime logs，並加入 `.gitignore`：

```text
dev-server*.log
```

`UI_AUDIT_PROMPT.md` 與 `UI_AUDIT_REPORT.md` 為 review 文件，保留在 repo，不含 runtime log 或已知憑證。

## 3. 本次 DB 變更

### 3.1 `20260630000100_add_prd005_review_fields`

| Table | 新欄位 | 型別／Default | 用途 |
|---|---|---|---|
| `user` | `trustScore` | INT NOT NULL DEFAULT 50 | 信任分數 |
| `user` | `flaggedCount` | INT NOT NULL DEFAULT 0 | 被標記次數 |
| `home_prayer_card` | `needsReview` | BOOLEAN NOT NULL DEFAULT false | 待審卡片不公開 |

此 migration 為 additive；既有資料會套用 default。

### 3.2 `20260709000100_add_voice_moderation`

在 `prayerresponse` 新增：

- `voiceModerationStatus` ENUM：`PENDING / APPROVED / REJECTED / NOT_APPLICABLE`
- `voiceModeratedAt` DATETIME(3) NULL
- `voiceModeratedBy` VARCHAR(191) NULL
- `voiceAutoFlags` TEXT NULL

Migration 會立即更新所有既有 `prayerresponse`：

- 無 `voiceUrl`：`NOT_APPLICABLE`
- 有 `voiceUrl`：`APPROVED`

這個全表 UPDATE 可能造成鎖定與 I/O；DBA 必須先取得資料筆數、表大小與可接受維護時間。

### 3.3 `20260711000100_add_guest_response_moderation`

在 `prayerresponse` 新增：

- `moderationStatus` ENUM：`PENDING / APPROVED / REJECTED`，default `APPROVED`
- `guestSessionHash` VARCHAR(64) NULL
- `ipHash` VARCHAR(64) NULL
- 複合索引 `(guestSessionHash, createdAt)`
- 複合索引 `(ipHash, createdAt)`

索引建立時間取決於 `prayerresponse` 大小與 MySQL 版本，需在 staging 用 PROD 備份副本量測。

### 3.4 待補 migration：token reward safety fields

見 2.1。這是 release 阻擋項，必須納入 Prisma migration history，不能只在 PROD 手動加欄位。

### 3.5 不在標準部署中執行的資料腳本

以下腳本不由 `prisma migrate deploy` 自動執行：

- `scripts/approve-existing-responses.js`
  - 新 voice migration 已把既有語音設為 `APPROVED`，文字設為 `NOT_APPLICABLE`；公開 API 接受兩者。
  - 本次部署預設**不執行**。只有 Product Owner 明確要求把所有 response 的 `voiceModerationStatus` 重設為 `APPROVED` 時，才先跑 `--dry-run` 並另開資料變更核准。
- `scripts/migrate-prayerrequest-to-homecard.js`
  - 會建立 `HomePrayerCard` 並改掛舊回應，雖為冪等但屬內容資料遷移。
  - 本次部署預設**不執行**。需另開 migration window，確認 fallback category、dry-run 結果與抽樣資料後再執行。

## 4. PROD 環境與主機準備

### 4.1 必要環境變數

在 `/home/startpraynow/prayer-coin/.env` 確認：

```env
DATABASE_URL=mysql://...
NEXT_PUBLIC_APP_URL=https://<production-domain>
ADMIN_SESSION_SECRET=<existing-production-secret>
CUSTOMER_SESSION_SECRET=<existing-production-secret>
ADMIN_TOTP_SECRET=<existing-production-secret>

# 本次新增；使用獨立、隨機、至少 32 bytes 的 secret
GUEST_FINGERPRINT_SECRET=<new-random-secret>

# 本次只能使用 local；object 尚未實作，啟用會令圖片／語音上傳回 503
MEDIA_STORAGE_DRIVER=local
VOICES_STORAGE_DIR=/home/startpraynow/prayer-coin-data/voices
UPLOADS_STORAGE_DIR=/home/startpraynow/prayer-coin-data/uploads
```

`GUEST_FINGERPRINT_SECRET` 未設定時程式會 fallback 到 `CUSTOMER_SESSION_SECRET`，雖不會阻止啟動，但正式環境應使用獨立 secret 以隔離用途。不得把任何 secret 貼進 MR、工單或部署 log。

生成範例：

```bash
openssl rand -base64 48
```

### 4.2 Reverse proxy

訪客 rate limit 會使用 client IP 的每日 HMAC。Nginx 必須正確傳遞：

```nginx
proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
proxy_set_header X-Real-IP $remote_addr;
```

否則所有訪客可能被辨識為 `unknown`，共用同一個 rate-limit bucket。

媒體 alias 需維持：

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

### 4.3 權限、容量與程序

以 `startpraynow` 作為唯一 runtime／deploy user：

```bash
test -w /home/startpraynow/prayer-coin
test -w /home/startpraynow/prayer-coin/logs
test -w /home/startpraynow/prayer-coin-data/voices
test -w /home/startpraynow/prayer-coin-data/uploads
df -h
pm2 status prayer-coin
ss -ltnp '( sport = :3000 )'
```

預期：磁碟空間足夠、只有預期的 PM2/Node 程序使用 port 3000，且沒有 root-owned PM2 搶 port。

## 5. DBA 部署前檢查 SQL（唯讀）

先確認 DB 名稱：

```sql
SELECT DATABASE() AS database_name, VERSION() AS mysql_version, NOW() AS checked_at;
```

### 5.1 Migration baseline

```sql
SELECT migration_name, finished_at, rolled_back_at
FROM _prisma_migrations
ORDER BY started_at;

SELECT COUNT(*) AS failed_or_unfinished
FROM _prisma_migrations
WHERE finished_at IS NULL OR rolled_back_at IS NOT NULL;
```

預期：`failed_or_unfinished = 0`。DB 必須至少已套用 `72cccec` 所帶的 migration；實際名稱需與 repo 核對，不能只看數量。

### 5.2 表大小與維護時間估算

```sql
SELECT COUNT(*) AS response_rows,
       SUM(voiceUrl IS NOT NULL AND voiceUrl <> '') AS voice_rows,
       SUM(isBlocked = 1) AS blocked_rows
FROM prayerresponse;

SELECT table_name, table_rows,
       ROUND((data_length + index_length) / 1024 / 1024, 2) AS total_mb
FROM information_schema.tables
WHERE table_schema = DATABASE()
  AND table_name IN ('user', 'home_prayer_card', 'prayerresponse', 'token_reward_rule');
```

### 5.3 欄位／索引碰撞檢查

```sql
SELECT table_name, column_name, column_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema = DATABASE()
  AND (
    (table_name = 'user' AND column_name IN ('trustScore', 'flaggedCount')) OR
    (table_name = 'home_prayer_card' AND column_name IN ('needsReview')) OR
    (table_name = 'prayerresponse' AND column_name IN (
      'voiceModerationStatus', 'voiceModeratedAt', 'voiceModeratedBy', 'voiceAutoFlags',
      'moderationStatus', 'guestSessionHash', 'ipHash'
    )) OR
    (table_name = 'token_reward_rule' AND column_name IN (
      'rewardsEnabled', 'dailyRewardCap', 'perCardRewardCap',
      'minMessageLength', 'requireVoiceApproved'
    ))
  )
ORDER BY table_name, column_name;

SELECT table_name, index_name, GROUP_CONCAT(column_name ORDER BY seq_in_index) AS columns_in_index
FROM information_schema.statistics
WHERE table_schema = DATABASE()
  AND table_name = 'prayerresponse'
GROUP BY table_name, index_name
ORDER BY index_name;
```

從乾淨的 `72cccec` PROD baseline 升級時，上述新欄位與兩個 guest hash index 應尚不存在。若已存在，視為 schema drift，停止自動 migration 並由 DBA 比對。

### 5.4 既有 reward rule

```sql
SELECT * FROM token_reward_rule WHERE id = 1;
```

保存結果作為發布後比對；新欄位應以 defaults 初始化，不應改動既有 `rewardTokens`、`observationDays`、`allowedReports`。

## 6. 備份與 staging 演練

### 6.1 必備備份

維護模式開啟、停止寫入後，由 DBA 執行一致性備份。範例：

```bash
mysqldump --single-transaction --routines --triggers --events \
  --default-character-set=utf8mb4 \
  -h <host> -u <user> -p <database> \
  | gzip > startpray-pre-<FINAL_SHA>-$(date +%Y%m%d-%H%M%S).sql.gz
```

另備份：

- `/home/startpraynow/prayer-coin/.env`（安全存放，不進 Git）。
- `/home/startpraynow/prayer-coin-data/voices`。
- `/home/startpraynow/prayer-coin-data/uploads`。
- Nginx site config 與 PM2 process list。

備份必須完成 restore test 或至少通過 gzip／SQL 完整性檢查；只有「檔案存在」不算完成。

### 6.2 Staging rehearsal（必做）

1. 用最新 PROD backup 建立隔離 staging DB。
2. Checkout 最終 release SHA，不使用浮動的 `main`。
3. 設 staging `DATABASE_URL` 與獨立 secrets。
4. 執行：

```bash
npm install --include=dev --no-audit --fund=false
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
npm run lint
npm run build
npx prisma migrate status
```

5. 記錄每個 ALTER／UPDATE／INDEX 的實際時間與鎖定狀況。
6. 執行第 8、9 節驗證。
7. 重新跑 `npx prisma migrate deploy`，預期 `No pending migrations`，證明冪等。

## 7. 正式部署順序

### 7.1 Change window 前

- [ ] MR 已通過 code review、privacy review、DBA review。
- [ ] 2.1～2.4 全部關閉。
- [ ] `npm run lint`、`npm run build`、staging migration 全通過。
- [ ] 建立不可變 release tag，例如 `prod-2026-07-15`，記錄完整 SHA。
- [ ] 確認可聯絡的 Deploy Owner、DBA、Product Owner 與 rollback decision owner。
- [ ] 公告維護時間與預估影響。

### 7.2 維護窗口

1. 透過 admin settings 開啟 maintenance mode，確認公開頁停止寫入；管理員與部署人員保留存取。
2. 完成第 6.1 節 backup。
3. 在 server 取得指定 release：

```bash
cd /home/startpraynow/prayer-coin
git status --short
git fetch origin --tags
git switch main
git pull --ff-only origin main
git rev-parse HEAD
```

4. `git rev-parse HEAD` 必須等於核准的完整 Release SHA；不同就停止。
5. 安裝、migration、build：

```bash
npm install --include=dev --no-audit --fund=false
npx prisma migrate status
npx prisma migrate deploy
npx prisma generate
rm -rf .next
npm run build
```

6. 重新啟動：

```bash
pm2 restart prayer-coin --update-env
pm2 save
pm2 status prayer-coin
pm2 logs prayer-coin --lines 100 --nostream
```

7. 完成第 8、9 節後才關閉 maintenance mode。

> `npm run deploy:prod` 可執行相同步驟，但它會 pull 當下的 `main`。本次發布建議先鎖定 release tag／SHA 並人工核對，避免 change window 期間部署到未核准的新 commit。

## 8. 部署後 DB 驗證

### 8.1 Migration 狀態

```bash
npx prisma migrate status
```

必須顯示 schema 與 migration history 同步，且沒有 failed／pending migration。

```sql
SELECT migration_name, finished_at
FROM _prisma_migrations
WHERE migration_name IN (
  '20260630000100_add_prd005_review_fields',
  '20260709000100_add_voice_moderation',
  '20260711000100_add_guest_response_moderation',
  '20260715000100_add_token_reward_safety_fields'
)
ORDER BY migration_name;
```

四筆都必須存在且 `finished_at` 非 NULL；最後一個名稱以 MR 實際 migration 名稱為準。

### 8.2 欄位資料與 defaults

```sql
SELECT trustScore, flaggedCount, COUNT(*) AS users
FROM `user`
GROUP BY trustScore, flaggedCount
ORDER BY users DESC;

SELECT needsReview, COUNT(*) AS cards
FROM home_prayer_card
GROUP BY needsReview;

SELECT moderationStatus, COUNT(*) AS responses
FROM prayerresponse
GROUP BY moderationStatus;

SELECT voiceModerationStatus, COUNT(*) AS responses
FROM prayerresponse
GROUP BY voiceModerationStatus;

SELECT id, rewardTokens, observationDays, allowedReports,
       rewardsEnabled, dailyRewardCap, perCardRewardCap,
       minMessageLength, requireVoiceApproved
FROM token_reward_rule
WHERE id = 1;
```

預期：

- 既有 user 預設 `trustScore=50`、`flaggedCount=0`。
- 既有 cards 預設 `needsReview=0`。
- 既有 responses 的 `moderationStatus=APPROVED`。
- 有語音的既有 response 為 `APPROVED`；無語音為 `NOT_APPLICABLE`。
- reward rule 舊值不變，新欄位為核准 defaults。

### 8.3 新 guest response 抽查

送出一筆測試訪客文字回應後，僅由 DBA 抽查：

```sql
SELECT id, responderId, isAnonymous, moderationStatus,
       CHAR_LENGTH(guestSessionHash) AS guest_hash_length,
       CHAR_LENGTH(ipHash) AS ip_hash_length,
       createdAt
FROM prayerresponse
ORDER BY createdAt DESC
LIMIT 5;
```

預期：訪客 `responderId IS NULL`、`isAnonymous=1`，hash 長度為 64；DB 不保存原始 guest cookie 或原始 IP。

## 9. 應用 Smoke Test

### P0：關閉維護模式前必須通過

- [ ] `/`、`/prayfor`、任一 `/prayfor/{id}` 回 HTTP 200。
- [ ] 私密卡片不洩漏 title、description、image、owner、detailsHref。
- [ ] 未登入訪客可送文字禱告；短時間重複送出會正確 rate limit。
- [ ] 登入會員可送公開與匿名回應。
- [ ] 匿名回應顯示站徽（`/img/logo.png`）作為頭像，不顯示本人頭像，且不能點到本人 profile。
- [ ] `GET /api/responses/{homeCardId}` 的匿名項目沒有 `responderId`，`responder` 為 null，只有站內 `anonymousAvatarUrl`。
- [ ] `/api/anonymous-prayer-avatar`（已淘汰的舊網址）回 308 導向 `/img/logo.png`，不再自行產生 SVG。
- [ ] 新圖片上傳成功，實體檔在 `UPLOADS_STORAGE_DIR` 且前台可讀。
- [ ] 新語音回應成功，實體檔在 `VOICES_STORAGE_DIR` 且可播放。
- [ ] Admin 登入、回應審核、語音審核與 token rule 頁面可讀寫。
- [ ] PM2 online、port 3000 只有一個 listener、log 無 Prisma／EADDRINUSE／EACCES 錯誤。

### P1：發布後 30 分鐘內完成

- [ ] 手機寬度檢查首頁、禱告牆、建立頁、詳情回應與全球禱告室。
- [ ] 中英文登入、註冊、忘記密碼頁正常。
- [ ] 公開卡片建立、編輯與分類空資料 fallback 正常。
- [ ] 檢舉 response 後進入 `PENDING`，admin 可核准／拒絕。
- [ ] token reward cap 與語音核准條件符合設定。
- [ ] 抽查 2～3 筆既有圖片與語音 URL 沒有 404。

## 10. 監控與 Go/No-Go

部署後至少觀察 60 分鐘：

- PM2 restart count、memory、CPU。
- Nginx 4xx/5xx，特別是 `/api/responses`、`/api/home-cards`、`/api/upload-image`。
- Prisma unknown column、enum、migration 或 connection error。
- `/uploads/*`、`/voices/*` 404。
- guest response 429 是否異常集中（可能是 proxy IP header 錯誤）。
- 匿名 response payload 是否包含任何本人資料。

立即 rollback 條件：

- Prisma unknown-column 或 migration failed。
- 公開頁洩漏私密卡片或匿名回應者身份。
- 登入／建立卡片／回應等核心流程無法使用。
- 圖片或語音大量 404／503。
- 5xx 明顯高於部署前基線且 15 分鐘內不能定位。

## 11. 回滾計畫

### 11.1 優先：只回滾應用程式

本次 DB migration 應全部為 additive；舊版 `72cccec` 不會讀新欄位，因此通常可以保留新 schema，先把應用退回舊版：

```bash
cd /home/startpraynow/prayer-coin
git fetch origin --tags
git switch --detach 72cccec
npm install --include=dev --no-audit --fund=false
npx prisma generate
rm -rf .next
npm run build
pm2 restart prayer-coin --update-env
pm2 save
```

驗證首頁、登入、禱告牆、建立卡片、圖片／語音與 admin。不要在事故中直接 DROP 新欄位或索引。

### 11.2 DB migration 失敗或資料異常

1. 保持 maintenance mode／停止寫入。
2. 保存 migration error、PM2/Nginx logs 與 `_prisma_migrations` 狀態。
3. DBA 依備份還原整個 DB；不要臨時手寫一組未演練的 down migration。
4. 還原後核對 migration history 與資料筆數，再啟動 `72cccec`。
5. 在 staging 重現與修正後另排 change window。

注意：若新版本已接受新的訪客回應，整庫還原會遺失 change window 後的新資料，因此 maintenance mode 與短窗口很重要。

## 12. MR 說明範本

```markdown
## Summary
Upgrade Start Pray PROD from `72cccec` to `<FINAL_SHA>`.

## User-visible changes
- Guest and anonymous prayer responses
- Anonymous generated responder avatars without identity leakage
- Response/voice moderation and admin controls
- Mobile and playback wellbeing improvements

## DB changes
- 4 additive Prisma migrations
- Full-table backfill of prayerresponse.voiceModerationStatus
- 2 new prayerresponse indexes
- No destructive table/column removal

## Environment changes
- Add GUEST_FINGERPRINT_SECRET
- Pin MEDIA_STORAGE_DRIVER=local
- Verify persistent media directories and forwarded IP headers

## Validation evidence
- npm run lint: PASS
- npm run build: PASS
- staging migrate deploy/status: <link/output>
- staging smoke test: <link>
- backup/restore evidence: <link>

## Deployment
See docs/deployment/PROD_MR_PLAN_72cccec_TO_MAIN.md

## Rollback
Application rollback to 72cccec; preserve additive DB columns.
Full DB restore only for failed migration/data corruption.

## Approvals
- [ ] Engineering
- [ ] DBA
- [ ] Privacy/Security
- [ ] Product Owner
- [ ] Deploy Owner
```

## 13. 最終簽核表

| 項目 | Owner | 證據／連結 | 狀態 |
|---|---|---|---|
| 遺漏 token migration 已補 | Engineering | `20260715000100_add_token_reward_safety_fields` | ☑ |
| Runbook 與 SQL bundle 已更新 | Engineering/DBA | 30 migrations | ☑ Engineering／☐ DBA |
| `/v3-wireframe/*` 上線決策 | Product Owner | 核准公開（2026-07-15） | ☑ |
| Release log 檔處理決策 | Engineering | logs 已移除並 ignore | ☑ |
| PROD schema drift 檢查 | DBA |  | ☐ |
| PROD backup 可還原 | DBA |  | ☐ |
| Staging migration rehearsal | Engineering/DBA |  | ☐ |
| Privacy regression test | Privacy/QA |  | ☐ |
| 最終 Release SHA／tag 鎖定 | Deploy Owner |  | ☐ |
| 維護公告與 rollback owner | Product/Operations |  | ☐ |

只有所有阻擋項為完成，且簽核人明確批准後，狀態才能從 NO-GO 改為 GO。
