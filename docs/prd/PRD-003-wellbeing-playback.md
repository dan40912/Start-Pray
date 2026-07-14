# PRD-003 — 重複播放的心理健康防護 (Repeat-Playback Wellbeing Safeguards)

- 階段：**P0**
- 狀態：未開始
- 依賴：無
- 對應風險：「不斷重複播放禱告陪伴」立意良善,但對重病/危機中的人,長時間反覆播放可能變成情緒反芻(rumination)或依賴。

---

## 1. 目標 (Goal)

在使用者**長時間或高次數重複播放**同一段禱告語音時,給予一個**溫和、可關閉、不評判**的提醒,並提供求助資源入口 —— 但**絕不打斷或限制**使用者繼續播放。設計原則:陪伴,不說教;提醒,不阻擋。

## 2. 背景與現況 (Background)

- 全域播放器:`src/components/GlobalPlayer.js`、`src/components/GlobalPlayerGate.js`。
- 單卡語音播放:`src/components/PrayerAudioPlayer.js`、`src/components/HeroPlayButton.js`。
- 目前播放沒有任何累計次數 / 時長的追蹤或關懷介入。
- 既有 i18n:`src/lib/i18n`(en.js / zh-TW.js)—— 提醒文案要走 i18n,不要寫死中文。

## 3. 範圍 (Scope)

**In scope**
- 前端**僅 client-side**累計「同一段語音」的連續重播次數與累計播放時間(記憶體 + 可選 `sessionStorage`)。
- 達門檻時顯示一張溫和的關懷卡(可「我知道了」關閉、可「不再顯示」)。
- 關懷卡含一個「需要有人陪你嗎?」連結,指向站內既有的求助/聯絡頁(若無,先指向 `mailto:startpraynow@gmail.com` 並留 TODO)。
- 文案走 i18n。

**Out of scope(不要做)**
- ❌ 不限制、不暫停、不鎖定播放。
- ❌ 不收集或上傳任何播放行為到後端 / 資料庫(純前端,保護隱私)。
- ❌ 不做心理狀態判斷或診斷式語言。

## 4. 詳細實作步驟 (Implementation)

**Step 1 — 播放計數 hook(新檔)**
新增 `src/lib/usePlaybackWellbeing.js`(client hook):
- 輸入:`trackId`(用 voiceUrl 或 response id)。
- 狀態:`repeatCount`、`totalSeconds`,以 `trackId` 為 key;切換到不同 `trackId` 時重置 repeatCount。
- 門檻常數(寫在檔頂方便調):`REPEAT_THRESHOLD = 5`(同段連播 5 次)或 `TOTAL_SECONDS_THRESHOLD = 900`(累計 15 分鐘),任一達到即觸發。
- 提供 `shouldPrompt`、`dismiss()`、`dismissForever()`。`dismissForever` 寫入 `sessionStorage`(key 例如 `sp_wellbeing_dismissed`),僅當期 session 有效。

> 注意:本專案 artifacts 規範禁用 localStorage,但這是真實 app 程式碼,可用 `sessionStorage`;仍要做 `typeof window !== 'undefined'` 與 try/catch 保護(SSR 安全)。

**Step 2 — 關懷卡元件(新檔)**
新增 `src/components/WellbeingNudge.js`:
- 樣式溫和(柔色、非紅色警示),沿用專案既有 CSS 變數 / class 命名習慣(看 `src/styles/*`)。
- 文案 key 從 i18n 取,例如 `wellbeing.title`、`wellbeing.body`、`wellbeing.reachOut`、`wellbeing.gotIt`、`wellbeing.dontShowAgain`。
- 三個動作:關閉、不再顯示、求助連結。

**Step 3 — 接進播放器**
- 在 `GlobalPlayer.js` 與 `PrayerAudioPlayer.js`:用 `usePlaybackWellbeing`,在 `ended` / 計時事件更新計數,`shouldPrompt` 為 true 時 render `<WellbeingNudge>`。
- 確保 server component 不直接 import client hook(必要時包一層 `'use client'` 子元件)。

**Step 4 — i18n 文案**
在 `src/lib/i18n/locales/zh-TW.js` 與 `en.js` 補上 `wellbeing.*` 文案。中文範例語氣:
> 「你已經陪這段禱告走了一段時間了。願你被安慰。如果現在心裡很重,也許找個人說說話會有幫助。」
英文同義、溫柔、非臨床。

## 5. 資料模型變更

- **無**。本 PRD 不動 Prisma、不新增 API、不寫後端。

## 6. 驗收標準 (Acceptance Criteria)

1. Playing the **same** voice clip 5 times in a row triggers the `WellbeingNudge` card.
2. Accumulating ~15 minutes of playback on one clip also triggers it (can be verified by temporarily lowering the constant or by a unit-level check).
3. The nudge has three working actions: 關閉 (hides until next trigger), 不再顯示 (suppressed for the rest of the session), 求助連結 (navigates to the configured help target).
4. After 不再顯示, reloading within the same tab session keeps it suppressed; a fresh session shows it again.
5. Playback is **never** paused, blocked, or rate-limited by this feature — verify audio keeps playing through and after the nudge.
6. No network request is made and no data is written to any API/DB as a result of playback counting (check network tab).
7. All nudge text comes from i18n; switching to `/en` shows English copy, default shows zh-TW.
8. No SSR/hydration errors in console; `npm run build` passes.
9. `npm run lint` passes.
10. `git diff --name-only` only includes: `usePlaybackWellbeing.js`, `WellbeingNudge.js`, the two player components, and the two i18n locale files.

## 7. 給 Codex 的防錯提醒 (Guardrails)

- ❌ 絕對不要加入任何會暫停 / 限制播放的邏輯。這會直接違背本功能目的。
- ❌ 不要把播放行為上傳後端或存進資料庫。
- ❌ 不要用 localStorage(SSR + 專案規範);用 sessionStorage 並做 SSR 防護。
- ✅ 文案一律走 i18n,不可寫死。
- ✅ 語氣必須溫柔、非診斷、非評判。避免「你應該」「你必須」這類字眼。
- ⚠️ 若站內找不到求助/聯絡頁,指向 `mailto:startpraynow@gmail.com` 並在程式碼留 `// TODO: replace with dedicated support page`。
