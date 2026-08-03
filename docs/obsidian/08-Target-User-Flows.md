---
tags: [start-pray, flows, target]
---

# 目標使用者流程（提案，部分已實作）

參見 [[07-Target-MVP]]、[[09-Change-Impact-Analysis]]、[[21-Recorder-State-Machine]]。以下原為**設計提案**；流程 1-5 已於 Commit 2、3（2026-08-04）在首頁實作為前端狀態機（`src/components/prayer-recorder/`），**尚未接上匿名投稿 API**，流程 6 起仍是提案，未實作。

## 1. 陌生人第一次進站 — ✅ 已實作（Commit 2）
```mermaid
flowchart TD
    A[進入首頁] --> B[看到一句主要訊息 + 一個主要按鈕]
    B --> C[點擊「開始錄下你的禱告」]
```

## 2. 麥克風授權成功 — ✅ 已實作（Commit 3，Real microphone Not Tested，見 [[21-Recorder-State-Machine]]）
```mermaid
flowchart TD
    A[點擊錄音按鈕] --> B[顯示麥克風用途說明]
    B --> C[瀏覽器授權彈窗]
    C --> D[授權成功]
    D --> E[進入 3-2-1 倒數]
```

## 3. 麥克風授權失敗 — ✅ 已實作並經真實瀏覽器驗證（非 Mock，Browser 環境本身封鎖麥克風存取觸發了真實拒絕路徑）
```mermaid
flowchart TD
    A[瀏覽器授權彈窗] --> B[使用者拒絕或裝置無麥克風]
    B --> C[顯示清楚的失敗說明，不責怪使用者]
    C --> D[提供「如何開啟權限」引導或改用文字禱告的替代方案]
```

## 4. 錄音與倒數 — ✅ 已實作（Real microphone Not Tested）
```mermaid
flowchart TD
    A[授權成功] --> B[3-2-1 倒數動畫]
    B --> C[開始錄音，顯示錄音中狀態]
    C --> D[使用者點擊停止]
```

## 5. 播放確認與重錄 — ✅ 已實作，含重錄確認對話框（Real microphone Not Tested）
```mermaid
flowchart TD
    A[錄音停止] --> B[自動播放預覽]
    B --> C{使用者決定}
    C -->|滿意| D[進入送出]
    C -->|不滿意| E[重新錄製] --> A
```

## 6. 匿名送出 — ❌ 尚未實作（本次「下一步：匿名送出」按鈕僅顯示 Prototype 提示文字，見 [[21-Recorder-State-Machine]]）
```mermaid
flowchart TD
    A[點擊送出] --> B[前端呼叫送出 API，不需登入]
    B --> C[後端以既有 guestSessionHash/ipHash 機制標記來源]
    C --> D[寫入資料庫，responderId/ownerId 為 null]
    D --> E[顯示「投稿完成」畫面]
```

## 7. 上傳失敗與重試
```mermaid
flowchart TD
    A[送出音檔] --> B{上傳成功?}
    B -->|否| C[顯示明確錯誤原因，不遺失錄音內容]
    C --> D[提供「重試上傳」按鈕，沿用同一段錄音]
    D --> A
    B -->|是| E[進入投稿完成畫面]
```

## 8. 瀏覽並播放禱告
```mermaid
flowchart TD
    A[首頁或禱告牆] --> B[列表顯示他人的禱告]
    B --> C[點擊播放]
    C --> D[音檔串流播放，無需登入]
```

## 9. 點擊「我為你禱告」
```mermaid
flowchart TD
    A[播放某則禱告] --> B[點擊「我為你禱告」]
    B --> C[輕量互動記錄，不必然要求送出完整回應]
    C --> D[即時回饋，避免重複點擊灌水]
```

## 10. 不登入情況下的內容管理方案
```mermaid
flowchart TD
    A[匿名送出禱告] --> B[產生管理憑證，儲存於裝置端]
    B --> C{使用者稍後想刪除/管理}
    C -->|同裝置且憑證仍在| D[憑證比對通過，允許刪除/管理]
    C -->|憑證遺失| E[無法自助管理，僅能走檢舉/申訴或聯絡管理員]
    F[管理員後台] --> G[永遠可審核/下架任何內容，作為最後防線]
```

方案細節與比較見 [[09-Change-Impact-Analysis]] 及下方匿名架構章節（[[11-Decision-Log]] DEC-007）。
