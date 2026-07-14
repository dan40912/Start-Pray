# PRD-011 首頁 Prayer-First V1 修改計畫

- Priority: P0
- Status: In Progress
- Owner: Product / Engineering
- Last updated: 2026-07-09
- 上游文件: PRD-010（Prayer-First Product Redesign）、`/v3-wireframe` 預覽路由、`docs/design/start-pray-v3-wireframe-poc.html`
- 適用對象: Claude Code / Codex 等 AI agent 與工程團隊

---

## 0. 評測結論（2026-07-09 實測 localhost:3000）

以真實瀏覽器對現行首頁進行實測與程式碼審查後的結論：

### 做得好的

1. 私密卡防護正確：`src/lib/globalPrayerPayload.js` 在 server 端就遮罩 title/description/owner/voiceHref，座標模糊到 0.1°。符合 PRD-010 §25。
2. 視覺氛圍成熟：深色地球 + 暖金光點有情感力量，hero 面板玻璃擬態質感好。
3. 「從一份代禱開始」三入口卡設計正確（我想被代禱 / 我想為人禱告 / 我想看見全球祝福）。
4. 行動版 hero 已有精簡邏輯（隱藏 stats 與說明文字）。

### 實測發現的問題（依嚴重度）

| # | 嚴重度 | 問題 | 證據 |
|---|--------|------|------|
| P0-1 | 高 | **滾輪劫持**：hero 佔滿 100svh，Cesium `enableZoom=true` 吃掉桌機滾輪事件，游標在地球上時頁面完全無法往下捲 | 實測滾動 10 tick 頁面不動；`GlobalPrayerRoom.js` heroMap 分支 `controller.enableZoom = true` |
| P0-2 | 高 | **渲染凍結**：Cesium Viewer 未開 `requestRenderMode`，持續全速渲染；無分頁隱藏/滾出視口暫停機制。實測多次 renderer 凍結 30 秒以上、滾動時大面積白屏 | CDP screenshot timeout ×3；滾動截圖白屏 |
| P0-3 | 高 | **首屏行動方向錯誤**：headline「看見世界正在被守望」是觀看導向；主 CTA「分享代禱需要」、次 CTA「進入全球禱告室」——完全沒有「為一人禱告」。與 PRD-010 核心策略（Prayer First、一個主 CTA=我願意禱告）相反 | hero 截圖；`HomeGlobeHero.js` TEXT/actions |
| P1-4 | 中 | **零值統計傷信任**：hero 顯示「0 24 小時內新增」 | hero 截圖 |
| P1-5 | 中 | **多個 primary 樣式互搶**：hero 金色主鈕、entry cards、proof primary、final CTA primary 都是主樣式，違反「每頁一個 primary」 | `HomeLandingPage.js` 各 section |
| P1-6 | 中 | 桌機 hero 資訊密度過高：eyebrow+kicker+H1+副標+4 統計+提示框+2 CTA+縮放鈕同屏 | hero 截圖 |
| P1-7 | 中 | 行動版地球佔滿първ屏（100svh），主行動區被擠到底部，PRD 要求「map preview 不高於主行動區」 | CSS `@media (max-width:860px)` |
| P2-8 | 低 | `force-dynamic` + 每請求撈 100 卡含 responses，首頁 TTFB 無快取 | `HomeLandingPage.js` |
| P2-9 | 低 | Header 導覽 7 項 + 登入/註冊，無直接禱告行動 | header 截圖 |
| P2-10 | 低 | 提示文案「已鎖定最新上傳的禱告光點」軍事/情報語感，與產品溫柔語氣不符 | `HomeGlobeHero.js` hint |

---

## 1. 目標與非目標

### 目標

1. 首頁滾動永遠順暢：滾輪不被地球攔截、地球離屏即停止渲染。
2. 首屏主行動改為「為一人禱告」，符合 PRD-010 的 Prayer-First 策略。
3. 不顯示會傷信任的零值統計。
4. 全部修改可小 PR 交付、可獨立回滾。

### 非目標

1. 不做完整首頁重設計（那是 `/v3-wireframe` 驗證後的事，見 PRD-010 §5.1 Track B）。
2. 不改 Prisma schema、不改 API 行為、不改私密卡遮罩邏輯。
3. 不引入新 UI framework。
4. 不動 `/global-prayer-room` 完整頁的互動模式（僅共用元件的無害優化）。

---

## 2. 工作包

### WP-A（P0-3, P1-4, P2-10）Hero 行動化 — `HomeGlobeHero.js` + `HomeLandingPage.js`

狀態：**本次已實作**

修改內容：

1. CTA 改為三層：
   - Primary（金色實心）：`為一人禱告` → `/prayfor`（新 prop `prayHref`，由 `HomeLandingPage` 傳 `localizePath("/prayfor", locale)`）。V2 接上 `GET /api/home-cards?mode=one` 後改連一鍵單卡流程。
   - Secondary（ghost）：`分享代禱需要` → `/customer-portal/create`（原 `secondaryHref`）。
   - Tertiary（文字連結）：`進入全球禱告室` → `/global-prayer-room`（原 `primaryHref`）。
2. 統計列：值為 0 的項目不渲染（`buildVisibleStats` 過濾）。
3. 提示文案改為溫柔語氣：「點擊地球上的光點，可以看見該地點正在被守望的需要。」

驗收標準：

- [ ] 桌機/行動首屏第一顆按鈕文字為「為一人禱告」，點擊到達 `/prayfor`。
- [ ] 資料庫 24 小時內無新增時，不出現「0 24 小時內新增」。
- [ ] `npm run lint` 通過。

回滾：單一 commit revert，不影響其他區塊。

### WP-B（P0-1, P0-2）地球效能與滾動 — `GlobalPrayerRoom.js`

狀態：**本次已實作（並經瀏覽器實測驗證）**

實作時的重要發現：首頁 hero 實際渲染的是 **three.js 的 `LegacyPrayerGlobe`**（`GlobalPrayerGlobe = LegacyPrayerGlobe`），不是 Cesium viewer。且 `/global-prayer-room` 完整頁也傳 `heroMap`，不能拿 heroMap 當「首頁」訊號。

修改內容：

1. `LegacyPrayerGlobe` 新增 `wheelZoom = true` prop：
   - `controls.enableZoom = wheelZoom !== false`（OrbitControls 在 enableZoom=false 時會在 preventDefault 之前 return，滾輪回歸原生頁面捲動）。
   - `wheelZoom === false` 時把 canvas `touchAction` 覆寫為 `pan-y`（必須在 OrbitControls 建構之後設，它的建構子會寫入 `none`），行動裝置垂直滑動可捲頁、水平拖曳仍可轉地球。
   - 只有 `GlobalPrayerRoomEmbed` 的 isHero 分支傳 `wheelZoom={!heroMap}`（即首頁 hero）；完整頁不受影響，滾輪縮放照舊。
2. `LegacyPrayerGlobe` RAF loop 渲染暫停：`visibilitychange` + `IntersectionObserver`（threshold 0.05），任一不可見即停止 requestAnimationFrame，恢復可見時重啟。cleanup 移除監聽。
3. Cesium embed viewer（heroMap 分支，目前首頁未使用的備援路徑）同步加固：`enableZoom=false`、容器 capture 階段 wheel 攔截、`useDefaultRenderLoop` 暫停。若未來切回 Cesium 引擎，行為一致。

實測結果（2026-07-09 localhost）：首頁 canvas wheel `defaultPrevented=false`（頁面可捲）、touchAction=pan-y；完整頁 wheel `defaultPrevented=true`（縮放照舊）；捲動到 hero 以下不再白屏；console 無錯誤。

驗收標準：

- [ ] 游標在地球上滾動滾輪，頁面正常往下捲。
- [ ] +/- 按鈕仍可縮放地球。
- [ ] 捲到 entry cards 以下後，工作管理員/Performance 面板可見 GPU/CPU 佔用顯著下降。
- [ ] 切到其他分頁再切回，地球恢復自轉。
- [ ] `/global-prayer-room` 完整頁功能不受影響（該頁地球在視口內，行為不變）。

回滾：單一 commit revert。

### WP-C（P0-2 延伸）Cesium 進一步減重 — 交給 codex

未實作，建議順序：

1. `requestRenderMode: true` + `maximumRenderTimeChange`：需配合自轉 tick 呼叫 `scene.requestRender()`，改動面較大，需在 hero 與完整頁分別驗證。
2. `prefers-reduced-motion` 時：不自轉、`staticView` 模式或直接顯示 `GlobeSkeleton` 靜態圖。
3. 行動裝置（<768px）評估改用輕量 2D 光點地圖（SVG/canvas，光點資料同 payload），Cesium 僅留桌機與 `/global-prayer-room`。這是 PRD-010「map 是 proof 不是 primary interaction」的最終形。
4. 首頁 payload 從 100 筆降到 40 筆（`HomeLandingPage.js` 的 `take: 100`），hero 光點用不到 100 筆。
5. 檔案內另外兩個 viewer（L572 的 `CesiumPrayerGlobe`、L1779 的 three.js fallback）套用相同的 visibility/intersection 暫停模式。

驗收標準：Lighthouse mobile performance 較基準提升；reduced-motion 模式無自轉。

### WP-D（P1-5）CTA 階層統一 — `HomeLandingPage.js` + 相關 CSS

未實作，建議：

1. 全頁只有 hero 的「為一人禱告」用金色實心 primary。
2. `HomeProofSection` 與 `HomeFinalCta` 的 primary 降為 outline/ghost，或刪除 final CTA 區塊（與 proof actions 重複）。
3. Entry cards 維持現狀（卡片式入口不算 primary button）。

驗收標準：視覺走查全頁，金色實心按鈕只出現一次。

### WP-E（P1-7）行動版首屏重排 — `HomeGlobeHero.js` CSS

未實作，建議：

1. `max-width:860px` 時 hero `min-height` 從 100svh 降為約 78svh，讓 entry cards 露出一角（捲動暗示）。
2. 或依 PRD-010 §15.1：行動版把主 CTA 面板放頂部、地球縮成中景 proof。
3. 驗證寬度：320 / 375 / 390 / 430px。

### WP-F（P2-8）首頁快取 — `HomeLandingPage.js`

未實作，建議：`export const dynamic = "force-dynamic"` 改為 `export const revalidate = 60`。需先確認 header 沒有依請求的個人化內容（登入狀態若由 client 端讀取則安全）。驗收：首頁 TTFB 下降、內容最多延遲 60 秒。

### WP-G（P2-9）Header 行動化 — `site-chrome.js`

未實作，建議：導覽列加入主行動「為一人禱告」；「得勝者/平台介紹/使用方式」可收進「關於」下拉。此項影響全站，建議單獨 PR + 走查。

### WP-H 隱私回歸測試

未實作，建議：加一個腳本或測試（`scripts/` 或 API 層）驗證：任一 `isPrivate=true` 卡片經 `toGlobalPrayerPayload` 後不含原始 title/description/owner/voiceHref/精確座標；首頁 HTML source 不含私密卡標題。此為 PRD-010 §33 隱私驗收的自動化。

---

## 3. 執行順序與 PR 切法

1. ~~PR-1：WP-A + WP-B（本次完成，最小 P0 修復）~~
2. PR-2：WP-C-4（payload 降量）+ WP-F（revalidate）— 低風險後端減重。
3. PR-3：WP-D + WP-E — 視覺階層與行動版，需設計走查。
4. PR-4：WP-C-1/2/3 — Cesium 深度優化，需效能量測前後對比。
5. PR-5：WP-G — header，全站影響單獨處理。
6. PR-6：WP-H — 隱私回歸測試。

每個 PR 必須：`npm run lint` 與 `npm run build` 通過；行動寬度 320/375/390/430 走查；不動 schema；不動私密卡遮罩。

---

## 4. Guardrails（承 PRD-010 §34）

- 只用 `Start Pray` 名稱，不出現舊專案名或金融敘事。
- 私密卡資料永不進入公開頁 props/payload。
- 健康分類 UI 用 `健康`。
- 文案保持溫柔、人話，避免軍事/情報/SaaS 行銷語感。
- 不因單頁需求引入新 UI framework。
- 首頁大改（IA 級）必須先走 `/v3-wireframe` 預覽路由驗證（PRD-010 Track B）。
