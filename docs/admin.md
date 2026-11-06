# Admin and Moderation

The admin area exists because a prayer platform needs care, not just publishing.

People may share sensitive things. Reports, moderation, and account controls help keep the space usable.

## Admin Screens

Admin pages live under:

```text
src/app/admin
```

Current areas include:

- dashboard
- prayer card management
- response management
- user management
- category management
- moderation
- site settings
- admin accounts
- logs

## Admin API Routes

Admin API routes live under:

```text
src/app/api/admin
```

They should always use admin access checks before reading or changing data.

Important helpers:

```text
src/lib/admin-session.js
src/lib/admin-route-auth.js
```

## Moderation Objects

Reports are stored separately for different target types:

```text
HomePrayerCardReport
PrayerResponseReport
OvercomerUserReport
```

This keeps moderation history explicit and easier to inspect.

## Blocking Behavior

Several public queries filter blocked content.

For prayer cards, public listings should generally require:

```text
isBlocked = false
isPrivate = false
```

Private cards are handled separately for anonymous map display.

## Operation Logs

Admin actions can be recorded through `AdminLog`.

This is useful when multiple people help manage the site, because moderation decisions should not become invisible.

## Threads Sharing

People can opt in when creating a public prayer card. This does not delay or prevent the card from being submitted. The consent is stored separately from the public card. In prayer card management, admins can review and edit the post template (card title and public URL, without the description), publish it to the configured official Threads account, or skip sharing. Private, blocked, and still-moderated cards are rejected by the publish API. Success and failure are recorded with the returned post ID or error.

In Admin → Settings, an admin can enable or disable publishing and enter the Threads User ID, Access Token, and Graph API version. The token is encrypted in the database and is never returned to the browser; `SITE_SETTINGS_ENCRYPTION_KEY` must be set to a stable secret on every application instance. The Meta app must have `threads_basic` and `threads_content_publish` for the account that owns the official Threads profile. A disabled or incomplete integration does not affect prayer card submission. Failed publishing is recorded and can be retried by an admin.

## Maintenance Mode

`SiteSetting` stores site-level operational flags.

The current system includes a maintenance mode field that can be used to protect the site during upgrades or incidents.

## 流量與參與分析

在後台選「流量與參與」，切換台北時間最近 7 或 30 天。資料依造訪開始日歸屬，今天是部分資料。來源和入口以首次收到的觀測頁面為準，支援固定的來源分類。分享連結可使用 `utm_source=threads`、`line` 或 `church` 等分類，沒有來源線索時歸入「直接／來源不明」。後台依首次觀測頁面收到的登入狀態區分訪客與會員。

參與包含送出公開代禱、替別人送出文字或語音回應，以及首次按下「我已禱告」。各項轉化以同次造訪為單位，同類行動只計一次。送出成功可能仍在審核中。24 小時回應覆蓋率則使用現有資料庫內容，以目前可見、已滿 24 小時的公開代禱卡為分母，計算建立後 24 小時內收到目前可見回應的比例。這個指標會隨審核狀態變動。

啟用前先套用 migration。網站使用規範已說明這項統計的用途。設定 `ANALYTICS_ENABLED=true` 後才收集瀏覽與轉化，歷史流量無法回填。停用時仍可查已收集的彙總，以及可從現有內容算出的回應覆蓋率。公開收集端點可在入口代理針對 `POST /api/analytics` 設流量限制。

分析表每次造訪只存一筆。以獨立隨機瀏覽器代碼做跨日去重，Cookie 效期 90 天，造訪 Cookie 在觀測頁面續期 30 分鐘。支援 GPC 與 DNT 訊號。分析表沒有帳號識別碼、IP、完整網址、搜尋詞、代禱文字或錄音。分析 API 只對已授權的管理員回傳彙總。維運時至少每月執行以下清理，保留最近 90 天的造訪資料。

```sql
DELETE FROM analytics_visit WHERE createdAt < UTC_TIMESTAMP() - INTERVAL 90 DAY;
```
