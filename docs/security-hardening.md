# 資安強化（2026-10）

這份文件說明 `security-hardening` 分支做了哪些修改、上線前後要做什麼，以及哪些項目刻意沒有在程式裡處理。

## 修改摘要

| 項目 | 檔案 | 說明 |
|---|---|---|
| 語音上傳副檔名白名單 | `src/lib/audio-upload.js`、`api/customer/cards/voice`、`api/customer/story-audio`、`api/responses` | 存檔副檔名只會是 webm／mp3／m4a／mp4／aac／ogg／oga／opus／wav／flac，不再沿用使用者給的檔名副檔名（例如 `evil.html`） |
| 媒體回應安全標頭 | `src/lib/server-media-storage.js`、`app/voices`、`app/uploads` | 加上 `X-Content-Type-Options: nosniff` 與 sandbox CSP；`<img>`／`<audio>` 播放不受影響 |
| 登入／註冊／忘記密碼次數限制 | `src/lib/auth-rate-limit.js` | 見下方「次數限制」 |
| 可信任的 client IP | `src/lib/client-ip.js` | 由 `TRUSTED_PROXY_HOPS` 決定，見下方 |
| 每位管理員各自的 2FA | `src/lib/admin-totp.js`、`api/admin/2fa`、`admin/settings`、migration `20261024000100_add_admin_personal_totp` | 見下方「個人 2FA」 |
| 後台登入錯誤訊息統一 | `api/admin/auth/login` | 帳號、密碼、驗證碼錯誤一律回「帳號、密碼或驗證碼錯誤」，同一組驗證碼不能重複登入 |
| 管理員密碼最少 8 碼 | `api/admin/accounts` | 只影響新建立或修改的密碼，既有帳號不受影響 |
| 提領防重複送出 | `api/customer/withdrawals`、`api/admin/transactions/[id]` | 建立申請時鎖住使用者資料列；核准時用單一 UPDATE 檢查餘額並扣款 |
| 安全標頭 | `next.config.mjs` | `X-Content-Type-Options`、`X-Frame-Options: SAMEORIGIN`、`Referrer-Policy`、`Permissions-Policy`（保留麥克風權限給錄音功能） |
| 忘記密碼寄信 | `src/lib/mailer.js`、`api/auth/request-reset` | 選用；設定 `RESEND_API_KEY`、`MAIL_FROM`、`NEXT_PUBLIC_APP_URL` 後才會寄信 |
| 種子腳本 | `scripts/seed-admins.js`、`scripts/seed-demo.js` | 移除寫死的 `admin/admin`、`dan40912/1234`；正式環境需明確加參數才會執行 |
| QA 帳密 | `.qa/session.json`、`.gitignore` | 移出版本控制 |
| CI | `.github/workflows/ci.yml`、`.github/dependabot.yml` | CI 加跑單元測試；啟用 Dependabot |

## 上線步驟

1. **備份資料庫**（照 `PROD_DB_MIGRATION_RUNBOOK.md`）。
2. **設定 `.env`**：
   ```env
   # 必填：個人 2FA 加密金鑰（設定後不要更換，否則已綁定的個人 2FA 會失效）
   ADMIN_TOTP_ENCRYPTION_KEY=<另一組長隨機字串>

   # 建議：確認 Nginx 設定後再加（見下方說明）
   TRUSTED_PROXY_HOPS=1
   ```
   產生隨機字串：`node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
3. **部署**：照常執行 `npm run deploy:prod`。這次有一個只新增欄位的 migration，`db:preflight:prod` 會顯示 `20261024000100_add_admin_personal_totp: cleanly pending`。
4. **更新 Nginx 媒體設定**（見 `MEDIA_STORAGE_RUNBOOK.md` 第 3 節）。套用前先檢查有沒有不在白名單內的舊檔案，以免舊連結變成 404：
   ```bash
   find /home/startpraynow/prayer-coin-data/voices -type f \
     ! -iregex '.*\.\(webm\|m4a\|mp3\|mp4\|ogg\|oga\|opus\|wav\|aac\|flac\)'
   find /home/startpraynow/prayer-coin-data/uploads -type f \
     ! -iregex '.*\.\(webp\|jpg\|jpeg\|png\|gif\|avif\)'
   ```
   有輸出時，先確認那些檔案是什麼，再決定要刪除還是改名。
5. **每位管理員到「後台 → 權限設定 → 我的兩步驟驗證」綁定個人 2FA**。
6. 所有管理員都綁定後，從 `.env` 移除 `ADMIN_TOTP_SECRET`（和 `ADMIN_LOGIN_OTP`），讓個人 2FA 成為必要條件。

## TRUSTED_PROXY_HOPS（client IP）

`X-Forwarded-For` 的最左邊一個值是使用者自己可以帶的，拿來做頻率限制就能被繞過。設定 `TRUSTED_PROXY_HOPS=N` 後，程式改用「從右邊數來第 N 個」，也就是自家 proxy 寫入的值。

| 架構 | Nginx 設定 | `TRUSTED_PROXY_HOPS` |
|---|---|---|
| 使用者 → Nginx → Next.js | `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;` | `1` |
| 使用者 → Cloudflare → Nginx → Next.js | 同上 | `2` |

**沒設定時維持舊行為**，避免部署後所有訪客被算成同一個 IP、彼此互相擋住。確認方式：在正式機看 Nginx 站點設定裡的 `proxy_set_header X-Forwarded-For`，以及網域是否經過 Cloudflare（DNS 是橘色雲朵）。

## 次數限制

存在 Node 程序記憶體中。正式環境是單一 PM2 程序（`ecosystem.config.js` 的 `instances: 1`），所以不需要資料庫；PM2 重啟後計數歸零。

| 動作 | 依帳號 | 依 IP |
|---|---|---|
| 會員登入失敗 | 15 分鐘 10 次 | 15 分鐘 30 次 |
| 後台登入失敗 | 15 分鐘 5 次 | 15 分鐘 10 次 |
| 註冊（表單驗證通過後） | — | 1 小時 30 次 |
| 忘記密碼 | 1 小時 3 次 | 1 小時 5 次 |

- 登入成功會清除該帳號的失敗次數。
- 無法判斷 IP（`unknown`）時不做 IP 限制，避免所有人共用一個額度。
- 取捨：別人故意對某個帳號連續輸錯，會讓該帳號暫時被鎖 15 分鐘。

## 個人 2FA

- 驗證順序：帳號已綁定個人 2FA → 只接受個人驗證碼；未綁定 → 接受共用 `ADMIN_TOTP_SECRET`；都沒有 → 接受 `ADMIN_LOGIN_OTP`（僅供臨時測試）。
- 綁定時需要輸入目前的後台密碼，避免 session 被盜時被換成攻擊者的驗證器。
- 同一組 6 位數驗證碼只能用一次；登出後 30 秒內要重新登入，請等下一組驗證碼。
- 手機遺失：SUPER 在「管理員列表」按「重設 2FA」，該帳號回到使用共用驗證碼，再重新綁定。如果已經移除共用密鑰，重設後該帳號會暫時無法登入，需要先暫時加回 `ADMIN_TOTP_SECRET`。
- 密鑰以 AES-256-GCM 加密存放，金鑰來自 `ADMIN_TOTP_ENCRYPTION_KEY`。

## 刻意沒有在這次程式修改處理的項目

- **`public/voices/`、`public/uploads/` 仍在 git 裡**：正式機用 `git pull` 部署，如果這次直接從 git 刪除，正式機上這些檔案也會被刪掉。若正式機還從 `public/voices` 讀舊檔，網站上的舊錄音就會壞掉。請依下列順序處理：
  1. 在正式機確認這些檔案已複製到 `VOICES_STORAGE_DIR`／`UPLOADS_STORAGE_DIR`（`npm run media:audit`、`npm run media:migrate`，見 `MEDIA_STORAGE_RUNBOOK.md`）。
  2. 之後再用另一個 commit 執行 `git rm -r --cached public/voices public/uploads`。
  3. 舊的 commit 歷史仍然看得到這些檔案，最確實的做法是把 GitHub repo 改成 Private。
- **CSP（Content-Security-Policy）**：頁面有 inline JSON-LD、YouTube 嵌入影片等，直接啟用容易擋到功能，建議先用 `Content-Security-Policy-Report-Only` 觀察後再啟用。
- **HSTS**：建議在 Nginx 設定（`add_header Strict-Transport-Security "max-age=31536000" always;`），確認所有子網域都走 HTTPS 後再考慮加 `includeSubDomains`。
- **套件升級**：`npm audit` 顯示 `next`（critical）、`sanitize-html`、`sharp`、`prisma` 等套件有已知漏洞。其中 `next` 需要升級大版本，影響範圍大，應該另外開一個 PR 處理並完整測試。Dependabot 啟用後會自動開升級 PR。
