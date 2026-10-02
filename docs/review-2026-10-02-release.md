# Start Pray 發布前 review 與自測

日期：2026-10-02（台北）

## 範圍與結論

比對 GitHub main `43bea6b` 至本機 main `665acd9` 的七個 commit、未提交文件，以及 PROD 工作目錄的既有修改。主要程式改動為 GlobalPlayer 進度條、詳情頁回應區整併、相關 CSS 與字典。其餘 commit 主要記錄後續施工方案，不代表那些方案已實作。

本輪修正與檢查通過，但尚有英文錄音視窗的文字問題與正式機器修改未納入版本控制的風險。沒有 push、部署、資料庫 migration 或送出公開測試回應。

## 發現與修正

1. 語音上傳失敗會丟失重送入口：原 Comments 在網路回應前卸載 VoicePrayerOverlay。現改為成功才關閉，失敗保留已驗證的錄音與逐字稿，恢復送出按鈕，並在視窗中顯示錯誤。上傳期間禁止關閉或重新錄製。
2. 進度條失去 pointer capture 時未取消手勢，可能留下拖曳狀態。已把 lostpointercapture 接入既有取消流程，不提交舊位置。

修改：`src/components/Comments.js`、`src/components/VoicePrayerOverlay.js`、`src/components/GlobalPlayer.js`。

新增：`tests/voice-submit-retry.test.mjs`、`tests/scrubber-interaction.test.mjs`。這六項測試執行實際 callback/hook 原始碼並注入受控依賴，涵蓋失敗後成功重試、網路例外、拖曳提交與取消。它們不替代 React 完整生命週期或真實麥克風測試；元件搬動 callback 時需同步更新測試擷取邊界。

## 尚未處理

- **P2，英文錄音入口**：原詳情頁的主要錄音元件接收英文 dictionary；整併後唯一入口使用硬編碼中文的 VoicePrayerOverlay。瀏覽器確認 `/en/prayfor/26` 的「Use voice instead」打開中文說明與按鈕。`i18n:check` 僅核對字典鍵，無法抓到這類硬編碼文字。需補 VoicePrayerOverlay 的完整本地化。
- **部署版本完整性**：PROD 的 middleware、admin-origin-guard 與測試、部署/遷移腳本、gitignore 尚未提交。它們與本輪七個 commit 的修改路徑沒有直接重疊，不能因此認定 pull 一定會衝突；但正式環境仍無法由 GitHub main 完整重建，部署或回滾前應保存並 review 納入版本控制。不要 reset 掉這些修改。
- 本機進度表及三份未提交方案文件不影響 runtime；本輪沒有對 xlsx 做儲存格層級比對。

## 自測證據

- `npm run lint`：無 warning/error。
- `npm run test:unit`：79/79 通過。
- `npm run i18n:check`：519 個鍵通過。
- `npm run build`：修正前後均成功，產生 91 個頁面。
- `git diff --check`：無 whitespace error；有 Windows LF/CRLF 提示。
- 本機 production build `next start --port 3100`：首頁、禱告牆、`/me/create`、全球禱告室、中文與英文詳情頁 HTTP 200。這是路由 smoke check，不代表會員新增流程已提交驗證。
- 瀏覽器：中文詳情頁立即禱告錨點、前五則/更多回應控制、錄音視窗開關、陪伴模式音訊播放、暫停後保留畫面、Home/ArrowRight 跳到 5 秒。手機 viewport 390×844 下詳情頁 scrollWidth 375，沒有水平溢出，composer id 只有一個。
- PROD：`node --test tests/admin-origin-guard.test.mjs`，5/5 通過。
- PROD：部署前只讀 preflight 通過，四個 release migration 均已套用；直接執行及明確載入 `.env.production` 的結果皆選用名稱為 `prayercoin_dev` 的資料庫。名稱本身不能判定連錯資料庫，亦未核對運行中 PM2 進程的資料庫連線。

## 檢查限制與既有提示

未實測真實手機/Safari 麥克風、錄音硬體中斷、完整註冊登入/送出回應/審核流程；錄音重試以受控 callback 測試驗證，瀏覽器只驗到麥克風權限前的入口。公開卡片讀取仍使用既有 isPrivate/isBlocked 過濾，本輪沒有更動 API、Prisma schema 或 migrations，但沒有以真實私密卡片另做動態測試。

既有提示為 Browserslist 資料過期，以及 Node MODULE_TYPELESS_PACKAGE_JSON。沒有為消除提示改動全專案模組設定。
