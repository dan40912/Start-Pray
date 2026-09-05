---
tags: [start-pray, open-questions]
---

# 待確認事項彙整

彙整自 [[03-Current-Feature-Inventory]]、[[06-Authentication-Dependencies]]、[[07-Target-MVP]] 等文件中標註「待確認」的項目，需要人工確認程式碼實際行為或向使用者確認產品意圖。

## 程式行為待確認（需進一步讀碼驗證）
1. `/customer-portal/create` 建立禱告卡片，UI 層是否額外強制要求登入（`POST /api/home-cards` 本身的 session 檢查是 optional）
2. `VoicePrayerOverlay.js` 是否有「暫停」（非僅停止）功能
3. 錄音的即時字幕文字是否隨 `PrayerResponse` 一併儲存，或僅是前端顯示後即丟棄
4. 「我為你禱告」目前是否有獨立於「送出文字回應」的一鍵按鈕，或兩者是同一個行為
5. 送出禱告後是否有明確的「投稿完成」畫面，或僅是關閉 overlay
6. 麥克風授權失敗、網路中斷時的錯誤處理與重試機制完整度
7. 禱告牆/會員中心的空狀態設計
8. `/v3-wireframe/*` 系列頁面的實際完成度與定位——是否為已規劃但未上線的新方向雛形
9. `/en` 系列雙語頁面是否要在 MVP 階段繼續維護
10. 分享功能（`/v3-wireframe/share` 等）的實際實作機制
11. **（2026-08-04 新發現，與本次導覽/地球隱藏改動無關的既有問題）** `src/components/HomeGlobeHero.js` 內的 `TEXT` 物件（headline、subheadline、CTA 文案等）是寫死的繁體中文字串，並未走 `src/lib/i18n` 字典。實測 `/en` 頁面時，導覽列本身翻譯正確，但 hero 區塊的「分享代禱需要」等文字仍顯示中文。是否要在之後的首頁重構中一併補上英文版，或本來就只預期首頁 hero 只做中文，需要確認

## 產品決策待確認（需使用者裁示，對應 [[11-Decision-Log]]）
1. DEC-007 中管理 token 的有效期與遺失後的救濟方案
2. DEC-004 中 rate limit 的具體門檻（每裝置每小時可送出幾則？）
3. `/global-prayer-room` 停用後，既有分享連結要導向首頁還是顯示提示頁
4. 是否需要停用/輪替 Cesium ion token 以節省費用
5. 既有會員（`User` 表既有資料）在匿名化後的角色如何轉型说明（是否需要公告）
6. 匿名檢舉機制的具體設計（僅記錄 ipHash？是否需要驗證碼防灌爆？）

以上事項在對應決策確認前，[[10-Implementation-Plan]] 中的 Phase 3、Phase 5 不應開始執行。
