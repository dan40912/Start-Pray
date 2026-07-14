# Start Pray - PROD DB Migration 完整安裝手冊

此文件可直接提供給雲端/DBA 執行。

## 0) 本次要交付給雲端的檔案
- migration 腳本（Linux）: `scripts/db/prod-migrate.sh`
- migration 腳本（PowerShell）: `scripts/db/prod-migrate.ps1`
- migration bundle 產生器: `scripts/db/export-migration-bundle.cjs`
- schema drift fail-closed 預檢: `scripts/db/preflight-prod-release.cjs`
- 全量 SQL bundle（30 筆 migration）: `prisma/migrations/PROD_MIGRATION_BUNDLE.sql`
- Prisma migration 原始資料夾: `prisma/migrations/*/migration.sql`

## 1) Migration 清單（依時間順序）
1. `20250921133228_init`
2. `20250922153531_add_site_banner`
3. `20250922153729_tweak_site_banner_timestamp`
4. `20250922160107_add_home_prayer_cards`
5. `20250923123803_add_home_prayer_categories`
6. `20250923123901_home_prayer_category_required`
7. `20250925092510_add_is_anonymous_to_prayer_response`
8. `20250925095849_support_dual_requests`
9. `20250925185300_add_is_blocked_to_user`
10. `20250926182456_add_block_report_wallet`
11. `20250927015035_add_owner_and_block_fields`
12. `20250927042232_banner_active`
13. `20250927121557_add_log_admin`
14. `20250927123644_add_wallet_ledge`
15. `20250927130030_add_role_superadmin`
16. `20250929025833_add_prayer_response_reports`
17. `20250929030732_add_home_prayer_card_reports`
18. `20250930161907_add_reset_password`
19. `20251002195101_not_mandatory_for_voicehref`
20. `20251010_add_token_reward_rule`
21. `20251010_add_token_reward_tables`
22. `20260327000100_add_admin_grant_transaction_type`
23. `20260331_add_public_profile_and_overcomer_reports`
24. `20260426_add_user_story_media`
25. `20260428_add_prayer_location`
26. `20260429_add_private_prayer_cards`
27. `20260630000100_add_prd005_review_fields`
28. `20260709000100_add_voice_moderation`
29. `20260711000100_add_guest_response_moderation`
30. `20260715000100_add_token_reward_safety_fields`

## 2) 推薦安裝方式（正式環境）
> 建議使用 Prisma 官方流程：`migrate deploy`。
> 不建議直接手動逐段執行 SQL，除非 DBA 明確要求。

### 2.1 先決條件
- 伺服器已安裝 Node.js（建議 20+）與 npm。
- 已設定 `DATABASE_URL`（指向 PROD DB）。
- DB 帳號有 `CREATE/ALTER/INDEX/REFERENCES` 權限。
- 已完成 DB 備份（必做）。

### 2.2 安裝步驟
```bash
cd /path/to/prayer-coin

git fetch origin
git checkout main
git pull origin main

npm install --include=dev --no-audit --fund=false

# 套用 migration
bash scripts/db/prod-migrate.sh
```

PowerShell:
```powershell
cd C:\path\to\prayer-coin

git fetch origin
git checkout main
git pull origin main

npm install --include=dev --no-audit --fund=false

./scripts/db/prod-migrate.ps1
```

### 2.3 腳本會做的事
1. `npx prisma generate`
2. 執行 `scripts/db/preflight-prod-release.cjs`；若 migration history 與欄位／索引不一致，立即停止
3. `npx prisma migrate deploy`
4. `npx prisma migrate status`
5. 重新產生 SQL bundle（稽核留存）

## 3) 驗證步驟（請務必執行）

### 3.1 Prisma 狀態
```bash
npx prisma migrate status
```
預期：顯示資料庫與 migration 已同步。

### 3.2 DB 實際驗證（MySQL）
```sql
-- migration 總數（本版 repo 共 30 筆；PROD 實際套用後應包含最新）
SELECT migration_name, finished_at
FROM _prisma_migrations
ORDER BY finished_at DESC
LIMIT 30;

-- 最新 migration 是否存在
SELECT migration_name
FROM _prisma_migrations
WHERE migration_name IN (
  '20260630000100_add_prd005_review_fields',
  '20260709000100_add_voice_moderation',
  '20260711000100_add_guest_response_moderation',
  '20260715000100_add_token_reward_safety_fields'
);
```

### 3.3 功能關聯驗證（建議）
- Admin 後台 API 可正常讀寫（users/prayfor/prayerresponse）。
- 回應過濾（`isBlocked=false`、`moderationStatus=APPROVED`，且語音狀態可公開）正常。
- 代幣交易類型含 `ADMIN_GRANT`。
- 匿名回應不回傳本人身份或 avatar，並使用站內匿名 avatar。
- Token reward rule 可讀取五個 safety 欄位。

## 4) 若雲端要求「只給 SQL」

可交付此檔：
- `prisma/migrations/PROD_MIGRATION_BUNDLE.sql`

注意：
- SQL bundle 用於 DBA 審查或受控環境。
- 已套用過 migration 的 DB，重複手動執行可能衝突。
- 若走 SQL 直灌，執行後仍建議跑一次 `npx prisma migrate status` 確認一致。

## 5) 失敗處理與回滾建議

### 5.1 失敗時先做
1. 停止應用寫入（或切維護）。
2. 保留錯誤訊息與執行時間。
3. 查 `_prisma_migrations` 看停在第幾筆。

### 5.2 回滾策略（建議）
- 以「備份還原」為主，不建議手寫反向 SQL 回滾全部 migration。
- 還原後再於 staging 重演 migration，確認後再進 PROD。

## 6) 本專案 npm scripts（給雲端參考）
- `npm run db:migrate:prod` -> `prisma migrate deploy`
- `npm run db:bundle` -> 產生 `PROD_MIGRATION_BUNDLE.sql`

## 7) 一鍵最短命令（Linux）
```bash
export DATABASE_URL='mysql://USER:PASSWORD@HOST:3306/DBNAME'
cd /path/to/prayer-coin
npm install --include=dev --no-audit --fund=false && bash scripts/db/prod-migrate.sh
```

## 8) 一鍵最短命令（PowerShell）
```powershell
$env:DATABASE_URL = 'mysql://USER:PASSWORD@HOST:3306/DBNAME'
cd C:\path\to\prayer-coin
npm install --include=dev --no-audit --fund=false
./scripts/db/prod-migrate.ps1
```
