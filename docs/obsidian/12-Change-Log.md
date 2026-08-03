---
tags: [start-pray, changelog]
---

# 變更歷程

參見 [[10-Implementation-Plan]]。

## 2026-08-03 — 第一階段盤點（本次）
- 建立 `docs/obsidian/` 知識庫，15 份文件
- **無任何程式碼、Schema、路由變更**
- Phase 0 基準確認：`npm run lint` 通過；確認無自動化測試套件
- Branch：`main`，Commit：`4f06e73aa95724ecb68bc5e0c8e4db8041f50ece`（盤點期間 working tree 維持 clean，僅新增 `docs/obsidian/*`）

## 2026-08-04 — Phase 1（部分）：導覽收斂 + 首頁地球暫時隱藏
- 修改檔案：`src/components/site-chrome.js`、`src/components/HomeGlobeHero.js`
- 內容：新增可回滾的常數旗標，隱藏登入/註冊/會員中心/全球禱告室的導覽與頁尾入口；首頁不再掛載 Cesium 地球視覺（保留裝飾用 `GlobeSkeleton`）
- 過程中發現並更正文件錯誤：先前 [[02-Current-Architecture]]、[[03-Current-Feature-Inventory]] 誤記為「三.js 首頁地球 + Cesium 全頁地球」兩套實作，實際上是同一個 Cesium 元件 `GlobalPrayerRoomOptimized` 被兩處呼叫；`three.js` 依賴與 `CesiumPrayerGlobe`/`LegacyPrayerGlobe` 是未使用的孤兒程式碼
- 驗證：`npm run lint` ✅、`npm run build` ✅；**未**做瀏覽器實測（本機無 Docker/MySQL 環境）
- 尚未執行：首頁核心區塊重建（等待設計方向確認）、commit（尚未依使用者要求建立 git commit）
- Commit hash：尚未建立（變更仍在工作目錄中，未提交）

## 2026-08-04 — Phase 1 補強：i18n／手機導覽／頁尾空欄位／過渡狀態記錄
- 修改檔案：`src/components/site-chrome.js`（僅新增頁尾空欄位過濾與旗標註解，無行為變更）
- 新增檔案：`.claude/launch.json`（本機預覽用的 dev server 設定，供 `npm run dev` 走瀏覽器驗收，非產品程式碼）
- 補強內容：
  - 逐一核對 `src/lib/i18n/locales/zh-TW.js`、`en.js` 確認 `nav.*` 六個 key 皆存在，且專案僅支援這兩個語系（`SUPPORTED_LOCALES`），無缺字風險
  - 確認 `.nav-links` 桌面/手機共用同一份 markup（CSS media query 切換樣式，非獨立元件），因此可見性規則自動同步套用於兩者
  - `SiteFooter` 的 `footerColumns` 渲染前加上 `.filter((column) => column.links.length > 0)`，防止未來旗標調整導致某欄目變成只剩空標題
  - 常數旁補上更完整的註解，說明這是 Phase 1 暫時性導覽開關、不代表底層功能已移除、匿名化完成後應與相關程式碼一併刪除
- 驗證（本次改用 `npm run dev` + 瀏覽器實測，`.env.local` 提供可用的 DATABASE_URL）：
  - 桌面（1280×800）、手機（375×812，含點擊漢堡選單展開）皆確認導覽列不含登入/註冊/會員中心/全球禱告室
  - 頁尾確認無空欄位，且不含被隱藏的四項
  - `/login`、`/global-prayer-room`、`/customer-portal` 直接訪問皆正常
  - `/en` 英文導覽正確顯示 Prayer Wall/Stories/About/How It Works，無 undefined
  - `npm run lint`、`npm run build` 皆通過
- 已登入會員的導覽（建立代禱/問候語/登出）維持不變，並已在 [[06-Authentication-Dependencies]]、[[09-Change-Impact-Analysis]]、[[10-Implementation-Plan]] 明確記錄：**這是 Phase 1 過渡相容行為，不代表 Target MVP 最終仍保留會員系統**
- 順便發現一個與本次改動無關的既有小問題，已記錄到 [[14-Open-Questions]]：`HomeGlobeHero.js` 的 hero 文案 `TEXT` 是寫死的中文物件，並未走 i18n 字典，`/en` 頁面上「分享代禱需要」等 hero CTA 文字目前仍顯示中文
- 尚未執行：首頁核心區塊重建、Cesium 移除、commit（未依使用者要求建立）

後續每個 Implementation Plan Phase 執行後，應在此新增一筆紀錄（日期、Phase、實際修改檔案、commit hash）。
