# Start Pray：OG 分享、代禱詳情與後台 UI 施工交接

**更新日期：2026-09-27**  
**用途：交給其他 AI 實作；完成後由本對話的 Codex review。**  
**狀態：待施工。本文是工作範圍與驗收依據，不代表任何修改已完成。**

## 先讀與現況

先讀 `AGENTS.md` 及對應領域的 `docs/`。以開始施工當下的 working tree 為準；不要假設舊報告中的 session 狀態、行號或乾淨工作目錄仍有效。目前前台主要資料是 `HomePrayerCard`，私密卡不得從公開頁面或分享 metadata 洩漏標題、內容、封面、作者和詳情連結。

這份交接整合了 `docs/review-2026-09-27-three-plans.md`、`docs/admin-ux-improvement-plan.md` 和本次重新核對的程式碼。前兩份是參考資料，**若與本文或目前程式碼衝突，以目前程式碼與 `AGENTS.md` 為準**。不要把報告中的建議誤當作使用者已授權的部署或資料處置決定。

已核實的起點：

| 領域     | 目前程式碼事實                                                                                                   | 位置                                                               |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| 分享圖   | 預設卡片圖 API 回 SVG；`buildPageMetadata` 對每張圖都宣告 1200×630                                               | `src/app/api/card-thumbnail/route.js`、`src/lib/seo.js`            |
| 實際圖片 | `logo.png` 是 400×400；首頁、禱告牆明確使用 `popular.jpg`，該圖是 640×426；全球禱告室使用 640×419 的 `world.jpg` | `public/img/`、各頁 metadata                                       |
| 詳情頁   | hero 圖設為 lazy；`PrayerRequestActions` 渲染兩次；正文排在 companion panel 之後                                 | `src/app/prayfor/[id]/page.js`                                     |
| 錨點     | hero「立即禱告」指向 `#responses-panel`；其他部分指向 `#response-composer`，表單 id 在 `Comments.js`             | `src/app/prayfor/[id]/page.js`、`src/components/Comments.js`       |
| 回應權限 | `/api/responses` 支援訪客回應；詳情頁底部仍固定顯示「登入回應」                                                  | `src/app/api/responses/route.js`、詳情頁                           |
| 刪除     | Admin API 無使用者／代禱／回應 DELETE；**會員卡片 API 目前會實際刪除卡片**                                       | `src/app/api/admin/**`、`src/app/api/customer/cards/[id]/route.js` |
| C 方案   | `docs/admin-ux-improvement-plan.md` 已存在，但部分前提及 migration 範例需修正                                    | 該文件、`prisma/schema.prisma`                                     |

圖片尺寸宣告錯誤是確定的；「20 個頁面的預覽都壞了」、特定平台一律拒絕 SVG、特定毫秒數的產圖成本及 LCP 改善幅度，**目前沒有本專案實測支持**。施工與回報時要區分程式碼事實、外部平台行為和測量結果。

## 協作規則：先解同目錄覆寫風險

目前 A、B、C 曾共用同一個 `main` checkout。各 AI 開工前先執行 `git status --short`、`git branch --show-current`、`git worktree list`，回報現有未提交變更。不要重置、清理或覆蓋別人的檔案。這份文件及其他未追蹤文件、進度試算表可能是其他工作，原樣保留。

優先讓各 AI 使用獨立 worktree／分支，再以 PR 或逐段整合。若仍共用 checkout，採下表的**單一寫入者**與依序施作；即使修改不同段，同時寫同檔仍可能蓋掉彼此的結果。

| 時段             | 負責 AI            | 可寫檔案                                                                                                                     | 不碰的檔案                                                                               |
| ---------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| A：OG 與圖片     | A                  | `src/app/api/card-thumbnail/route.js`、`src/lib/seo.js`、`src/lib/default-thumbnail.js`、必要的 `public/` 圖字資產與相關測試 | `src/app/prayfor/[id]/page.js`、`src/app/prayfor/page.js`、`src/styles/theme-detail.css` |
| B1：詳情頁       | B                  | `src/app/prayfor/[id]/page.js`、`src/styles/theme-detail.css`、必要的詳情元件與兩種語系字串                                  | A 的 OG route／SEO helper、admin 檔案                                                    |
| C1：後台小範圍   | C                  | `src/app/admin/**`、`src/app/api/admin/**`、`src/components/admin/**`、必要的 `src/styles/admin.css`                         | `src/app/globals.css`、前台與 A／B 檔案、Prisma schema／migration                        |
| B2：首頁／禱告牆 | B，待 B1 review 後 | `src/components/HomeLandingPage.js`、`src/components/HomePrayerExplorer.js`、`src/app/prayfor/page.js`、相關 CSS／語系字串   | A 與 C 正在編輯的檔案                                                                    |

動效施工另依 [`docs/design/apple-fluid-motion-batches-2-6-handoff.md`](design/apple-fluid-motion-batches-2-6-handoff.md) 逐批進行。`HomePrayerHero.js` 指定由動效批次 2 持有；B2 若需要改它，先與批次 2 協調，不在共用 checkout 同時寫。批次 1 和字幕決策 6A 已 review 並整合進本地 `main`；後續工作以新的 `main` 為基底。

若任務確實需要碰界線外的檔案，先在施工回報寫明原因並重新安排寫入者。所有實作都要以獨立 commit 或清楚的 diff 交付，讓 reviewer 可以辨認來源。

## A：修 OG 分享圖與尺寸資料

**目標：** 有預設封面的公開代禱可產生穩定的點陣分享圖；每個頁面宣告的 OG 圖尺寸與實際檔案一致。A 不改代禱頁排版。

1. 將 `/api/card-thumbnail?title=...` 改為 1200×630 PNG，保留原有夜色與暖金視覺、標題清理、跳脫及同標題穩定配色。中文必須能在部署後的 runtime 正確顯示。若 route 以 `fs.readFile` 讀字型，依目前 Dockerfile 將字型收進 runner，例如 `public/fonts/`；若使用建置時打包，須證明實際產物可取得字型。不要在請求期間抓外部字型。
2. 檢查 `buildPageMetadata` 的所有呼叫，不把 1200×630 套在 logo、分類照、頭像與上傳圖片上。可為主要公開頁製作專屬 1200×630 品牌圖，或讓 metadata 帶入實際尺寸；選擇要一致、可維護。特別驗證首頁、禱告牆、全球禱告室、單篇代禱及英文頁。
3. 以 HTTPS 絕對 URL 輸出分享圖；PNG 的 MIME type 可明確提供。`og:image:secure_url` 是可選欄位，沒有證據表明 LINE 依賴它；LINE 官方 FAQ 只列 `og:title`、`og:description`、`og:image`。不要把增加該欄位當驗收門檻。
4. 快取策略必須同時考慮產圖成本與版本更新。可以提出長效快取加版本化 URL，或維持較短 TTL 並量測；不得未經驗證直接改成一年 `immutable`。標題 URL 是查詢參數的一部分，視覺演算法／字型日後也可能改動。
5. 分享平台可能保留舊預覽。驗收要記錄頁面 URL、圖片 URL、實際回應與重新抓取結果。改圖片 URL 的版本參數不能保證平台重新抓取同一個頁面 URL；需依實際平台工具／行為處理。

**A 驗收包：** PNG 回應的 Content-Type、實際尺寸與中文截圖；不同標題與特殊字元範例；首頁／禱告牆／詳情／英文頁輸出的 `og:image`、尺寸與公開性；Docker runner 取得字型的證據；快取設定理由；`npm run lint`、`npm run build` 結果。若不能實測 Facebook／LINE，要標明未驗證，不宣稱已修好平台快取。

## B1：先修代禱詳情頁

**目標：** 使用者先讀到代禱內容，再清楚找到回應入口；分享、檢舉和播放能力保持可用；手機首屏不無故延後載入主要圖片。

1. 重新排詳情頁順序，讓標題、必要脈絡與正文優先於重複的 companion 說明。移除或精簡 companion panel 時，保留 `#responses-panel` 與 `#response-composer` 的有效目的地。`/prayfor/one`、`/en/prayfor/one`、登入後回跳都依賴 composer 錨點。
2. 將兩處 `PrayerRequestActions` 收斂為一個清楚、容易在手機找到的分享／檢舉入口。保留 `cardId`、連結、描述與檢舉資料傳遞；不要因刪重複元件丟掉檢舉能力。
3. 底部固定動作依「訪客也能直接回應」的現況設計。消除兩個都指向同一表單的重複動作，以及誤導人的「登入回應」；是否提供登入入口，需明確標示它是可選的帳號功能。
4. 首屏 hero 圖移除 `loading="lazy"`，評估 eager／高優先級；實際是否為 LCP 元素及改善幅度以手機瀏覽器量測為準。相簿等非首屏圖片繼續按需要延遲載入。
5. 同步維護 zh-TW、en 文字與詳情 CSS。刪語系 key 前先搜全站引用；不要因頁面版面改動連帶更動 OG metadata。

**B1 驗收包：** 390px 與桌面前後截圖；有圖、無圖、長文、長標題、零回應情境；點擊 `/prayfor/one` 與 `/en/prayfor/one` 到表單；訪客與已登入者的回應流程；分享／檢舉操作；手機 LCP 前後紀錄或註明未量測；`npm run lint`、`npm run build` 結果。

**B2（B1 review 後再做）：** 評估首頁重複 CTA、`HomeProofSection`、`HomeFinalCta`、`#trust-links` 和禱告牆搜尋／分類層級。先以手機畫面比對，確認刪除區塊後仍容易找到「看代禱、建立代禱、回應、全球禱告室」。若移除 `bg-legal-links`，清查 `globals.css` 與 `theme-modern.css` 的全部定義；確認 footer 仍提供必要連結。這是獨立改動與 review，不併入 B1。

## C1：後台先做可獨立驗收的修復

`docs/admin-ux-improvement-plan.md` 已產出，不能再說 C 尚無方案；但**不要直接按它的全部 Phase 施工**。該文件的「平台沒有 DELETE」不符合會員卡片 API 現況，且 SQL 範例把 Prisma 映射表名 `prayerresponse`、`home_prayer_category` 寫成其他名稱。它提出的匿名化、歸檔、Undo、批次處理及新資料模型會跨越 UI 與資料政策，需另行按實際 schema、公開查詢、權限與資料保留行為 review。

C1 只做下列可分別交付的小範圍工作：

1. 修正 moderation 清單「詳情」連結：核對 `adminHref` 的 `?search=` 與目標管理頁是否讀取 query；讓管理員能到正確項目並看到脈絡。要涵蓋 ADMIN 與 SUPER 的實際權限，避免連結導向無權限頁。
2. 把 `/admin/prayfor` 的載入失敗與真正空清單分開，保留可見錯誤和重試。`/admin/users`、`/admin/prayerresponse` 若已有錯誤訊息，優先補可操作的重試，避免重造列表。
3. 審視待審／退回／封鎖徽章；若要動共用 `globals.css`，移到獨立時段，或只在 `admin.css` 增補 scoped 規則。
4. 對 `docs/admin-ux-improvement-plan.md` 另附勘誤或提修正版：明確區分 admin 無 DELETE 與會員卡片硬刪；從 `@@map` 核對 migration 表名；將高風險資料處置列為後續設計提案。不得執行該文件的 SQL 範例。

**C1 驗收包：** 三種檢舉目標的「詳情」連結與角色結果；API 失敗／空清單／篩選無結果畫面；後台欄位與狀態一致性；修正後 admin 方案的差異清單；`npm run lint`。若改 API 或 server component，加跑 `npm run build`。

**C 後續邊界：** 不新增人或代禱內容的 admin 硬刪 API。不得從「admin 沒有 DELETE」推定會員也沒有硬刪，更不得擅自改掉既有會員刪除行為。`deletedAt`／`archivedAt`、匿名化、清除個資、回應保留、資料庫 migration、Undo 及正式站套用，都應另有具體的資料流、權限、回滾與隱私驗收，再進入施工。

## Review 交付格式

每位實作者完成一批，請提交以下內容供本對話 review；不需要等三批都做完：

1. 本批改動目的、使用者會看到的差異、涉及的檔案與 commit／diff。
2. 可重現的前後證據：A 提供圖檔與 metadata；B 提供手機畫面與操作路徑；C 提供後台角色、空／錯誤狀態與深連結。
3. 執行的 lint、build、必要測試與結果；若未能執行，說明原因。
4. 仍未驗證的外部平台、實機或資料庫情境；既有 warning 與新增風險分開寫。
5. `git status --short`，證明未覆蓋其他 AI 的變更。

Reviewer 會優先檢查：私密代禱有無外洩、訪客與會員回應是否都可用、分享圖是否真的能部署與讀取、admin API 權限與資料是否可回復、手機上的實際操作，以及同工作目錄是否發生覆寫。review 通過後才整合下一批工作；部署與正式資料庫操作不屬於這份施工交接。
