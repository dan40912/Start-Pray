# PROD 上版執行計畫 — `d745f05`（匿名代禱體驗 + 首頁改版）

- **釋出分支**：`poc/minimal-prayer-redesign`（已推上 origin）
- **釋出 HEAD**：`d745f05`
- **目前 PROD（`origin/main`）**：`4f06e73`
- **落差**：15 個 commit
- **需要 DB migration**：**是**，1 個（純新增資料表）
- **需要新環境變數**：**是**，1 個（有 fallback，非強制）

---

## 0. 一句話摘要

這一版把整條**匿名代禱體驗**首次帶上 PROD——訪客免登入即可錄音投稿、左右瀏覽、陪伴模式播放、匿名檢舉、按「我已為你禱告」——外加今天做的首頁視覺改版與字型精簡。資料庫只多一張 `prayer_prayed_reaction` 表。

---

## 1. 這次上了什麼

### 產品功能（對 PROD 全新）
| 功能 | 說明 |
|---|---|
| 匿名投稿 | 未登入訪客可送出文字／語音代禱回應，以 `guestSessionHash`／`ipHash` 做去識別化追蹤與 rate limit |
| 極簡首頁 | 首頁改以單一代禱事項為主視覺，可左右滑動／方向鍵／按鈕切換 |
| 陪伴模式 | 連續播放某張卡片的語音回應（`CompanionOverlay`） |
| 匿名檢舉 | 免登入檢舉不當回應 |
| 我已為你禱告 | 輕量計數反應，登入與匿名皆可，**本次唯一需要 migration 的功能** |
| CSRF／Origin 加固 | `origin-guard.js`，所有匿名寫入端點皆驗證來源 |
| 卡片語音留言 | 卡片擁有者可錄 3 分鐘語音留言（登入者功能，非匿名主線） |
| 匿名頭像改站徽 | 移除程式生成的人形 SVG，改用 `/img/logo.png`，舊網址 308 轉址 |
| 首頁視覺改版 | Hero 深色暖調重做、修正對比度 bug、新增「最新代禱」分頁、地球區塊接回 |
| 字型精簡 | 移除 3 個未使用字型家族，Noto Serif TC 由 3 字重降為 1 |

### 不在這次範圍
- 未動 Storage 驅動（仍是 `local`）
- 未動會員／管理後台／代幣系統
- 未動 Cesium 全球禱告室本身的功能

---

## 2. 上版前置條件

### 2.1 必須先合併進 `main`

`scripts/deploy-prod.sh` 的 `BRANCH` 預設為 `main`，伺服器只會 pull `main`。**不會**自動抓 `poc/minimal-prayer-redesign`。

```bash
# 本機或 GitHub UI 開 PR
gh pr create --base main --head poc/minimal-prayer-redesign \
  --title "feat: anonymous prayer experience and homepage rework" \
  --body "見 docs/deployment/PROD_RELEASE_PLAN_d745f05.md"
```

合併後確認 `origin/main` 的 HEAD 為 `d745f05`（或合併 commit）再繼續。

### 2.2 環境變數檢查（在伺服器上，以 `startpraynow` 身分）

```bash
cd /home/startpraynow/prayer-coin
grep -E "VOICES_STORAGE_DIR|UPLOADS_STORAGE_DIR|GUEST_FINGERPRINT_SECRET|CUSTOMER_SESSION_SECRET" .env
```

| 變數 | 狀態 | 說明 |
|---|---|---|
| `VOICES_STORAGE_DIR` | **必須已設定，且路徑在 repo 之外** | 部署流程會 `git pull` 並 `rm -rf .next`。若語音目錄在 repo 內，使用者上傳的音檔會在每次部署時被覆蓋／遺失。範例值：`/home/startpraynow/prayer-coin-data/voices` |
| `UPLOADS_STORAGE_DIR` | 同上 | 圖片上傳同理 |
| `GUEST_FINGERPRINT_SECRET` | **本次新增**，非強制 | 用於匿名訪客 cookie 與每日 IP 的 HMAC 去識別化。程式有 fallback 鏈：`GUEST_FINGERPRINT_SECRET` → `CUSTOMER_SESSION_SECRET` → 硬編碼開發用字串。PROD 已有 `CUSTOMER_SESSION_SECRET`，因此**不設也不會壞**，但建議明確設定一個獨立的長隨機字串以隔離用途 |

> ⚠️ 若日後才補設或更動 `GUEST_FINGERPRINT_SECRET`，既有匿名訪客的雜湊會全部失效——已按過「我已為你禱告」的訪客可以再按一次。影響輕微，但要在改動前知道。

### 2.3 備份

```bash
# DB 備份（migration 雖為純新增，仍建議）
mysqldump -u <user> -p <database> > ~/backup-$(date +%F-%H%M).sql

# 記下目前 PROD commit，供回滾使用
cd /home/startpraynow/prayer-coin && git rev-parse --short HEAD
```

---

## 3. 資料庫 Migration

### 唯一的一個：`20260805000100_add_prayed_reaction`

```sql
CREATE TABLE `prayer_prayed_reaction` (
  `id` INTEGER NOT NULL AUTO_INCREMENT,
  `prayerId` INTEGER NOT NULL,
  `actorType` ENUM('USER', 'GUEST') NOT NULL,
  `actorKeyHash` VARCHAR(64) NOT NULL,
  `userId` VARCHAR(191) NULL,
  `ipHash` VARCHAR(64) NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  INDEX `prayer_prayed_reaction_prayerId_idx`(`prayerId`),
  INDEX `prayer_prayed_reaction_ipHash_createdAt_idx`(`ipHash`, `createdAt`),
  UNIQUE INDEX `prayer_prayed_reaction_prayerId_actorType_actorKeyHash_key`(`prayerId`, `actorType`, `actorKeyHash`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `prayer_prayed_reaction` ADD CONSTRAINT `prayer_prayed_reaction_prayerId_fkey`
  FOREIGN KEY (`prayerId`) REFERENCES `home_prayer_card`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE `prayer_prayed_reaction` ADD CONSTRAINT `prayer_prayed_reaction_userId_fkey`
  FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
```

**風險評估：低**
- 純新增一張新表，**沒有任何 `ALTER` 既有資料表**
- 沒有資料回填、沒有欄位型別變更
- **向後相容**：舊版程式碼完全不認識這張表，也不會因為它存在而出錯 → 程式碼可獨立回滾（見第 6 節）
- 兩個 FK 指向既有的 `home_prayer_card` / `user`，若這兩張表資料量大，建立 FK 會短暫加鎖，但屬毫秒等級

### Preflight 是 fail-closed
`npm run db:preflight:prod`（部署腳本第 4 步，在 migrate 之前）會檢查：
- `DATABASE_URL` 存在且有指定 database
- `_prisma_migrations` 可讀
- baseline 資料表齊全
- **schema drift**——若 PROD 資料庫與 migration 歷史不一致，會 `process.exit(1)` 並中止部署，**不會**帶著漂移狀態硬跑 migration

若 preflight 失敗，**不要**用 `--force` 之類的方式繞過。先讀錯誤訊息確認是哪張表／哪個 migration 對不上。

---

## 4. 執行步驟

### 4.1 主要路徑（正常情況）

以 `startpraynow` 身分（**不要**用 sudo 帳號跑部署）：

```bash
cd /home/startpraynow/prayer-coin
npm run deploy:prod
```

腳本會依序執行：

| # | 動作 | 失敗時 |
|---|---|---|
| 1 | `git fetch origin main` + `git pull --ff-only` | 若伺服器有未提交修改或非 fast-forward，會停止而不覆蓋 |
| 2 | `npm install --include=dev` | 需要 dev 依賴才能 `next build` |
| 3 | `npm run db:preflight:prod` | **fail-closed**，schema drift 時在 migration 前中止 |
| 4 | `npx prisma migrate deploy` | 套用上述唯一的 migration |
| 5 | `npx prisma generate` | |
| 6 | `rm -rf .next` + `npm run build` | |
| 7 | `pm2 restart prayer-coin --update-env` | |

### 4.2 若 port 3000 被卡住或檔案權限壞掉

僅在必要時，以 `startpraynow_gmail_com`（有 sudo）執行，細節見 [`deploy.md`](../../deploy.md)：

```bash
sudo pkill -9 -f "next-server" || true
sudo chown -R startpraynow:startpraynow /home/startpraynow/prayer-coin
sudo ss -ltnp '( sport = :3000 )'   # 應為空
```

處理完再回到 4.1。

---

## 5. 上版後驗證

### 5.1 服務健康
```bash
pm2 status prayer-coin
pm2 logs prayer-coin --lines 50 --nostream
curl -sI https://<domain>/ | head -3
```

### 5.2 資料庫
```sql
SHOW CREATE TABLE prayer_prayed_reaction;
SELECT COUNT(*) FROM prayer_prayed_reaction;   -- 預期 0
SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at DESC LIMIT 3;
```

### 5.3 功能冒煙測試（用**無痕視窗**，確保是未登入狀態）

| # | 步驟 | 預期 |
|---|---|---|
| 1 | 開首頁 | Hero 為深色暖調、標題為襯線字、副標可讀（不是灰字壓黑底） |
| 2 | 點 Hero 左右箭頭 | 代禱卡片切換；無相鄰卡片時按鈕呈 disabled |
| 3 | 捲到禱告牆，點「最新代禱」 | 標題變「最新的代禱需要」，卡片依建立時間由新到舊 |
| 4 | 再往下捲 | 地球區塊出現在禱告牆下方且可互動 |
| 5 | 點「我已為你禱告」 | 數字 +1，按鈕轉為已按狀態；重新整理後狀態保留 |
| 6 | 再按一次（同一訪客） | 不會重複計數（`actorKeyHash` 唯一鍵） |
| 7 | 送出一則文字代禱回應 | 成功；短時間重複送出會被 rate limit 擋下並顯示提示 |
| 8 | 錄一段語音回應並送出 | 成功；音檔可播放 |
| 9 | **重新部署一次後**再播放剛才那則語音 | **仍可播放**（驗證 `VOICES_STORAGE_DIR` 確實在 repo 外） |
| 10 | 開 `/api/anonymous-prayer-avatar?seed=12` | 308 轉址到 `/img/logo.png` |
| 11 | 登入 → customer-portal 建立卡片 → 錄語音留言 | 可附加、可試聽、送出後在 `/prayfor/[id]` 可播放 |
| 12 | 檢查任一頁 DevTools Network | 字型請求只有 Noto Serif TC，且無 Open Sans／Raleway／Poppins |

> 第 9 項是這次最值得花時間做的驗證——它直接檢驗風險登記表上那個「ephemeral filesystem」疑慮在這台機器上到底成不成立。

---

## 6. 回滾

### 6.1 只回滾程式碼（建議，且安全）

因為 migration 是**純新增資料表**，舊版程式碼不認識 `prayer_prayed_reaction`，留著它完全無害。**不需要**回滾資料庫。

```bash
cd /home/startpraynow/prayer-coin
git checkout <上版前記下的 commit>
npm install --include=dev --no-audit --fund=false
npx prisma generate
rm -rf .next && npm run build
pm2 restart prayer-coin --update-env
```

### 6.2 若真的要移除該表（通常不必要）

```sql
DROP TABLE `prayer_prayed_reaction`;
DELETE FROM `_prisma_migrations` WHERE migration_name = '20260805000100_add_prayed_reaction';
```

⚠️ 這會刪掉所有已累積的「我已為你禱告」紀錄，且必須同時清掉 migration 歷史，否則下次 preflight 會判定 drift。除非表結構本身出問題，否則優先用 6.1。

---

## 7. 尚未解決的風險（上版前請確認可接受）

| 風險 | 嚴重度 | 現況 |
|---|---|---|
| **卡片語音留言完全不經審核** | 高 | `POST /api/customer/cards/voice` 只檢查登入、檔案型別與大小，不進入任何 moderation 佇列，後台也沒有對應審核入口。不當內容可直接出現在公開卡片上。**建議**：上版後先不對外宣傳此功能，或先在後台補一個下架入口 |
| 取消建卡會留下孤兒音檔 | 中 | 採兩段式上傳（先上傳取得 URL、再隨表單送出），使用者中途放棄時伺服器上的檔案不會被清除。空間會緩慢累積，可用 `npm run media:audit` 稽核 |
| 真實麥克風／行動裝置皆未測試 | 中 | 開發環境無真實裝置，iOS Safari 對 MediaRecorder 與 autoplay 有特殊限制。**建議**：上版後立刻用真機各測一輪錄音與播放 |
| `GUEST_FINGERPRINT_SECRET` 未明確設定 | 低 | 會 fallback 到 `CUSTOMER_SESSION_SECRET`，功能正常，但兩個用途共用同一把密鑰 |
| 匿名頭像全部相同 | 低 | 這是刻意的取捨（原本的程式生成頭像觀感不佳），非缺陷 |

---

## 8. 建議時程

1. **T-1**：開 PR、Code review、確認 2.2 的環境變數
2. **T-0（離峰時段）**：DB 備份 → 合併 PR → `npm run deploy:prod` → 第 5 節冒煙測試
3. **T+1 天**：再跑一次部署，專門驗證第 5.3 的第 9 項（音檔是否存活）
4. **T+1 週**：`npm run media:audit` 檢查孤兒檔案累積速度

預估部署本身耗時 5–10 分鐘（含 `next build`），冒煙測試 15 分鐘。

---

_本文件對應 `d745f05`。上一版計畫見 [`PROD_MR_PLAN_72cccec_TO_MAIN.md`](PROD_MR_PLAN_72cccec_TO_MAIN.md)。_
