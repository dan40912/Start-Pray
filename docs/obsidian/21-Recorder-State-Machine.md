---
tags: [start-pray, recorder, state-machine]
---

# 錄音狀態機（Commit 3 + Phase 3A）

參見 [[03-Current-Feature-Inventory]]、[[10-Implementation-Plan]]、[[15-Acceptance-Criteria]]、[[20-Anonymous-Submission-Design]]。

實作於 `src/components/prayer-recorder/usePrayerRecorder.js` + `PrayerRecorder.js`，重用 `src/components/VoicePrayerOverlay.js` 已驗證的錄音引擎技巧（MIME fallback、停止逾時 fallback、清理邏輯），但移除字幕/語音辨識——這部分刻意不搬過來。**2026-08-04 更新**：Auth/上傳已在 Phase 3A 接上真實 `POST /api/responses`，不再是 Prototype。

## 狀態
| 狀態 | 說明 | 進入方式 | 離開方式 |
|---|---|---|---|
| `idle` | 尚未開始 | 初始值 / `cancel()` | 掛載 `PrayerRecorder` 後立即呼叫 `requestPermission()` |
| `permission-explanation` | （保留給未來使用，目前 `PrayerRecorder` 掛載時直接呼叫 `requestPermission()`，跳過此畫面直接請求） | `showPermissionExplanation()` | `requestPermission()` |
| `requesting-permission` | 呼叫中的 `getUserMedia` | `requestPermission()` | 成功→`countdown`；失敗→`permission-denied`；不支援→`unsupported` |
| `permission-denied` | 使用者拒絕或裝置無麥克風 | `getUserMedia` reject | `retry`→重新 `requestPermission()`；`back`→`onExit` |
| `unsupported` | 瀏覽器缺少 `MediaRecorder`/`getUserMedia` | `hasRecordingSupport()`為 false | `back`→`onExit` |
| `countdown` | 3→2→1 | 權限成功後 | 倒數完→`recording`；`cancel`→`idle` |
| `recording` | 錄音中，每秒 tick | 倒數完 | `finishRecording()`→`preview`；達 60 秒自動→`preview`；`cancel`→`idle` |
| `preview` | 播放/暫停/重錄/下一步 | 錄音完成 | `requestRerecord()`→確認對話框→`confirmRerecord()`→重新走 `requestPermission()` |
| `error` | 裝置錯誤／空白錄音／麥克風連線中斷 | 見下方 | `retryAfterError()`→`idle`；`back`→`onExit` |

## 事件與 Timer
- `countdownTimerRef`：`setInterval` 1000ms，遞減至 0 觸發 `startRecording()`
- `timerRef`：`setInterval` 1000ms，遞增 `elapsedSeconds`，達 `MAX_DURATION_SECONDS`（60）自動呼叫 `finishRecordingRef.current()`
- `recorderDoneRef`：`stopRecorderAndWait()` 的 5 秒逾時 fallback（沿用 `VoicePrayerOverlay.js` 的技巧），逾時仍嘗試用已收集的 chunks 組出 Blob，全空才 reject

## Blob / Object URL 生命週期
- `chunksRef` 累積 `ondataavailable`
- `onstop` 組成最終 Blob，交給 `stopRecorderAndWait` 的 Promise resolve
- `finishRecording()` 成功後才 `URL.createObjectURL`，並在下一次錄音/卸載前 `revokeObjectURL`
- 重錄（`confirmRerecord`）會先 `revokePreviewUrl()` 再重新 `requestPermission()`

## Cleanup（元件卸載）
`usePrayerRecorder` 的 `useEffect` 回傳清理函式：清 timer、停止 `mediaStreamRef` 所有 track、revoke Object URL、嘗試 `mediaRecorder.stop()`。`PrayerRecorder` 的 `handleExit`（back/cancel 按鈕）呼叫 hook 的 `cancel()`，同樣完整釋放資源後才呼叫 `onExit`。

## 錯誤分類（`errorReason`）
| errorReason | 觸發時機 | 顯示文案 key |
|---|---|---|
| `device` | `new MediaRecorder(...)` 建構失敗，或 `recorder.onerror` | `errorDeviceTitle`/`errorDeviceBody` |
| `empty` | `stopRecorderAndWait()` 失敗或 Blob size 為 0 | `errorEmptyTitle`/`errorEmptyBody` |
| `stream-lost` | `audioTrack.onended` 於錄音中觸發 | `errorStreamLostTitle`/`errorStreamLostBody` |

「錄音太短」（少於 `MIN_DURATION_SECONDS`=3 秒）不進 `error` 狀態，而是 `transientMessage = "too-short"`，2.4 秒後自動消失，使用者可繼續錄音，不中斷流程。

## 送出子狀態機（`PrayerRecorder.js` 內部，`submitState`，Phase 3A 新增）
與上方的 `phase` 狀態機分開管理，只在 `phase === "preview"` 時有意義：

| `submitState` | 說明 | 進入方式 | 離開方式 |
|---|---|---|---|
| `idle` | 顯示播放/重錄/送出按鈕 | 初始值 | 點擊「下一步：匿名送出」→ `uploading` |
| `uploading` | 顯示「正在留下你的禱告…」，按鈕隱藏，`handleSubmit` 內建重入防護（`if (submitState === "uploading") return`） | `handleSubmit()` 開始 | 成功→`success`；失敗→`failed` |
| `success` | 顯示成功文案 + 「聆聽一則其他人的禱告」（連到既有 `/prayfor/one`）+「回到首頁」 | `POST /api/responses` 回傳 2xx | 使用者離開（元件卸載） |
| `failed` | 顯示對應錯誤文案 + 「重試」+「返回」 | `POST` 失敗或 network 例外 | 「重試」→重新 `handleSubmit()`；「返回」→ `handleExit` |

`handleSubmit()` 實際流程：`GET /api/home-cards?mode=one` 取得目標卡片 → 組 `FormData`（`requestId`/`isAnonymous=true`/`website=""`/`audio`）→ `POST /api/responses` → 依 HTTP status/`code` 用 `mapSubmitErrorKey()` 對應到 `rateLimited`/`rejected`/`server`/`network` 四種文案。

## 尚未接入
- 字幕/語音辨識（刻意不從 `VoicePrayerOverlay.js` 搬過來）
- Schema、匿名管理 Token（Phase 3B，設計已完成見 [[23-Database-Migration]]，尚未實作）
- 獨立於既有規則之外的 Rate limit（沿用 `/api/responses` 既有的文字回應頻率限制，未新增語音專屬的 DB-backed 限制）

## 驗證狀態
| 項目 | 結果 | 說明 |
|---|---|---|
| Permission denied UI | Browser tested（真實瀏覽器行為，非 Mock） | 自動化環境本身封鎖麥克風存取，觸發了真實的 `getUserMedia` reject 路徑，正確顯示拒絕畫面 |
| Unsupported browser UI | Browser tested | 移除 `window.MediaRecorder` 後正確顯示不支援畫面 |
| Countdown / Recording / Preview / Re-record（真實麥克風全流程） | Mock Verified via code review only — Real microphone Not Tested | 自動化環境無法授權真實麥克風，未能實測完整錄音-預覽-重錄全流程；邏輯已比照 `VoicePrayerOverlay.js` 的既有實作模式撰寫 |
| Cleanup（timer/stream/URL） | Not Tested（無法在自動化環境模擬完整錄音再卸載） | 程式碼審查確認邏輯與 `VoicePrayerOverlay.js` 對應部分一致 |
| Mobile 按鈕尺寸 | Browser tested | 375×812 下按鈕高度 48px |
| i18n（zh-TW / en） | Browser tested | 兩種語系畫面文字皆正確，`npm run i18n:check` 通過（462 keys） |
| Unit tests（`recorder-utils.js`） | Automated tested | `npm run test:unit`（`node --test tests/`）7 項全數通過 |
| 匿名語音送出（`POST /api/responses`） | **Real API tested（非 Mock）** | 在真實瀏覽器對本機開發 DB 直接呼叫，合成音訊 Blob 送出成功（201），`voiceUrl` 檔案可讀回且 bytes 數一致 |
| Guest 崩潰 bug 修正（`recentVoiceCount` 查詢） | **Real API tested** | 同一 guest 對第二張卡片送出語音，成功建立（201），未再拋出 `session.userId` 例外 |
| Rate limit（同卡片 2 分鐘冷卻） | **Real API tested** | 同一 guest 對同張卡片第二次送出語音，正確回傳 429 `RATE_LIMITED`，而非崩潰或誤放行 |
| `PrayerRecorder.js` 的 `handleSubmit` UI 狀態切換（uploading/success/failed 畫面） | Not Tested（僅程式碼審查） | 需先到達 `preview` 階段才能觸發，自動化環境無法取得真實麥克風權限，未能走完整 UI 流程；API 呼叫邏輯本身已用上述真實 API 測試獨立驗證過 |
