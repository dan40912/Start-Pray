---
tags: [start-pray, auth]
---

# 登入系統依賴分析

參見 [[05-Data-Model]]、[[03-Current-Feature-Inventory]]。追蹤所有登入依賴，不只是登入頁面本身。

| 登入依賴位置 | 目前用途 | 直接移除的風險 | 建議替代方案 |
|---|---|---|---|
| `src/middleware.js`（`guardAdminRequest`，約第 88-157 行） | 保護 `/admin/*` 頁面與 `/api/admin/*`；CSRF same-origin 檢查；注入 `x-admin-role`/`x-admin-id` | 移除會讓後台完全開放 | 保留不動，屬於管理員系統，非本次匿名化範圍 |
| `src/app/admin/layout.js` | Client-side 二次驗證 admin session；SUPER-only 頁面角色守衛 | 同上 | 保留不動 |
| `src/lib/admin-route-auth.js`（`requireAdmin()`） | 每個 admin API route 的角色驗證 | 移除會讓後台 API 無防護 | 保留不動 |
| `src/lib/admin-session.js` / `src/lib/customer-session.js` | Cookie 簽章/驗證核心邏輯 | 移除 customer-session 會讓會員系統整個失效 | admin 保留；customer 端保留程式碼但**不再是投稿/瀏覽的前置條件**，讓匿名路徑繞過它而非刪除它 |
| `src/hooks/useAuthSession.js` + `src/lib/auth-storage.js` | 前端讀取 customer session 狀態，決定 UI 顯示（如「會員中心」連結） | 移除會讓依賴此 hook 的元件（如 `site-chrome.js`）出錯 | 保留 hook，但改為「有 session 才顯示會員相關 UI，沒有就走匿名流程」，非二選一的硬性 gate |
| `src/app/api/auth/login`、`/signup`、`/request-reset`、`/reset-password`、`/logout` | 會員系統的登入/註冊/找回密碼 API | 移除會讓既有會員資料無法再登入管理自己帳號 | 暫時隱藏 UI 入口，保留 API 與資料本身（向後相容） |
| `POST /api/responses`（`src/app/api/responses/route.js:94-103`） | **語音**回應的登入硬性檢查（`VOICE_LOGIN_REQUIRED`） | 這是匿名化語音投稿的**唯一真正需要修改後端邏輯**的關卡 | 移除此檢查，改用既有 `guestSessionHash`/`ipHash` 機制辨識訪客，並加上 rate limit（見 [[09-Change-Impact-Analysis]]） |
| `POST /api/home-cards`（`src/app/api/home-cards/route.js:300-303`） | 建立禱告卡片時**選擇性**讀取 session（`readSessionUser()` 為 optional） | 低風險，已是 optional | 確認前端 `/customer-portal/create` 是否額外在 UI 層強制登入（見 [[14-Open-Questions]]），若有需一併移除 |
| `DELETE/PATCH/PUT /api/customer/cards/[id]` | 要求登入 + 擁有者比對才能刪除/編輯 | 移除會讓任何人都能刪改他人卡片 | 保留給已登入會員；為匿名投稿者另外設計管理 token 機制（見 [[11-Decision-Log]] DEC-007） |
| `POST /api/prayfor/report`、`/api/prayer-response/report`、`/api/overcomer/report` | 三個檢舉 API 皆要求 `requireSessionUser()` | 移除會讓檢舉失去追蹤性，可能被濫用 | 匿名情境下改用 `guestSessionHash` + rate limit 取代身份驗證，而非完全開放 |
| `src/lib/customer-access.js`（`ensureActiveCustomer`） | 二次確認 User 未被封鎖、session 版本相符 | 僅影響已登入會員路徑 | 保留不動 |
| Analytics user identity | 未發現任何 analytics 綁定 user id（無第三方 analytics） | 無 | 不適用 |
| 個人資料 / 投稿擁有者 | `HomePrayerCard.ownerId`、`PrayerResponse.responderId` 皆 nullable | 極低風險，schema 已支援 | 不需改動 schema |
| 刪除權限 | 目前唯一刪除路徑要求登入+擁有者 | 匿名投稿者完全沒有刪除自己內容的能力 | 需新設計（管理 token 或裝置識別），見 [[11-Decision-Log]] DEC-007、[[09-Change-Impact-Analysis]] |
| 管理員權限 | `AdminAccount` + `requireAdmin(roles)` | 不受本次匿名化影響 | 保留 |

## 摘要
- 真正卡住「匿名投稿」的後端邏輯只有一處明確的硬 gate：`src/app/api/responses/route.js` 的語音登入檢查
- 其餘大多數「登入依賴」屬於**會員系統本身**（登入/註冊/個人中心/會員刪改權限），與「匿名訪客能否錄音送出禱告」這條主線是分開的兩件事，可以分開處理：先讓匿名主線可用，會員系統維持原樣但從導覽隱藏
- 需要新設計、而非單純移除的部分：匿名內容的刪除/管理、匿名檢舉

## 2026-08-04 更新：Phase 1 對這份依賴清單的實際影響

Phase 1（[[10-Implementation-Plan]]）已執行「從導覽/頁尾隱藏登入、註冊、會員中心、全球禱告室入口」，但**刻意保留**了 `useAuthSession` + `src/lib/auth-storage.js` 的既有行為：若瀏覽器仍持有有效的 customer session cookie，`site-chrome.js` 的導覽列會照常顯示「建立代禱／問候語／登出」等會員專屬 UI，且 `/customer-portal`、`/login`、`/signup` 等路由與其 API 完全沒有變動。

**這是一個明確的過渡相容行為，不是最終決定**：
- 它存在的唯一原因是「不要在還沒有匿名管理機制（[[11-Decision-Log]] DEC-007）之前，就切斷既有會員對自己資料的存取能力」
- **不代表** Target MVP（[[07-Target-MVP]]）最終仍要保留會員系統、`useAuthSession`、customer session 或會員中心相關 UI
- 待 DEC-007（匿名管理機制）與 Phase 3（匿名投稿後端）完成後，這個「已登入會員例外」應該重新評估是否還需要保留，或整批併入 Phase 5 的清理範圍
- 目前這個過渡行為本身沒有新增風險：它就是「什麼都不做，維持現狀」，只是導覽入口被隱藏，不影響任何登入依賴的強弱
