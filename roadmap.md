# Start Pray Roadmap

更新日期：2026-06-20
維護者：Jay Wu

這份 roadmap 是**給 AI coding agent(Codex)逐項執行用的**。它本身只是索引與優先序;
每一項的「具體怎麼做」與「驗收標準」都寫在 `docs/prd/` 底下對應的 PRD 文件。

> ⚠️ **給 Codex 的最高原則(每次接任務前先讀)**
> 1. **一次只做一個 PRD。** 不要把多個 PRD 的修改混在同一次 commit。
> 2. **動手前先 `git status --short`**,確認沒有未提交的他人修改。
> 3. **嚴格按照 PRD 的「實作步驟」與「檔案清單」**,不要新增 PRD 沒列出的檔案、欄位或套件。
> 4. **不要重構 PRD 範圍外的程式碼**,即使你覺得它寫得不好。
> 5. 改完後**必跑** `npm run lint` 和 `npm run build`;動到 Prisma 就加跑 `npx prisma generate`。
> 6. 完成時**逐條對照 PRD 的「驗收標準」**自我檢查,並回報每一條的 PASS/FAIL。
> 7. 任何「PRD 沒寫清楚」的地方**停下來問,不要自己猜**。

---

## 為什麼是這個優先序

排序原則:**先堵住會傷到使用者或社群信任的風險,再補成長與規模化。**
這直接呼應專案理念「先照顧人,再追求漂亮技術」。

| 階段 | 主題 | 為什麼 |
| --- | --- | --- |
| **P0** | 風險與信任 | 語音審核、代幣動機、心理健康 —— 這三項沒做好,平台越成功傷害越大 |
| **P1** | 核心體驗的承諾 | 確保「留下的禱告真的被回應」、匿名下仍可信、清掉雙模型技術債 |
| **P2** | 成長與規模化 | 手機版、多語系、媒體儲存,讓「全球」名實相符 |

---

## P0 — 風險與信任(先做)

| # | PRD | 一句話 | 主要動到 |
| --- | --- | --- | --- |
| 001 | [語音回應審核管線](docs/prd/PRD-001-voice-moderation.md) | 上傳語音先進審核佇列,通過才公開;高風險自動攔 | `PrayerResponse`, `/api/PrayerResponse`, admin moderation |
| 002 | [代幣獎勵去風險化](docs/prd/PRD-002-token-incentive-derisk.md) | 拆開「回應」與「賺幣」的直接綁定,加防灌水機制 | `tokenRewards.js`, `TokenRewardRule`, `PrayerResponse` |
| 003 | [重複播放的心理健康防護](docs/prd/PRD-003-wellbeing-playback.md) | 長時間重播時給予溫和提醒與求助資源,不強迫 | `GlobalPlayer.js`, `PrayerAudioPlayer.js` |

## P1 — 核心體驗的承諾

| # | PRD | 一句話 | 主要動到 |
| --- | --- | --- | --- |
| 004 | [冷啟動與代禱媒合](docs/prd/PRD-004-cold-start-matching.md) | 「最需要被禱告」佇列,確保每張卡都被看見、被回應 | `homeCards.js`, `/prayfor`, 新 API |
| 005 | [匿名下的真實性與防濫用](docs/prd/PRD-005-anonymity-authenticity.md) | rate limit、信任分數、檢舉前置化,降低假卡刷幣 | `customer-access.js`, report models, 建立流程 |
| 006 | [雙資料模型整併](docs/prd/PRD-006-data-model-consolidation.md) | 把舊 `PrayerRequest` 流程收斂到 `HomePrayerCard` | `schema.prisma`, migration, `PrayerResponse` 關聯 |

## P2 — 成長與規模化

| # | PRD | 一句話 | 主要動到 |
| --- | --- | --- | --- |
| 007 | [手機版使用流程](docs/prd/PRD-007-mobile-ux.md) | 建立卡片、錄音、瀏覽牆在手機上順手 | `site-chrome.js`, 各前台頁 CSS, 錄音 UI |
| 008 | [多語系完成度](docs/prd/PRD-008-i18n.md) | 補完 `en`、建立可擴充 locale 機制、CI 檢查不漏字 | `src/lib/i18n`, `src/app/en/*`, `check-i18n.cjs` |
| 009 | [媒體儲存可擴展性](docs/prd/PRD-009-media-storage.md) | 從本地 `public/` 遷到物件儲存,控制成本與備援 | `server-media-storage.js`, `media-url.js`, upload routes |

## 待規劃 — 你自己想做的功能

請用 [PRD 範本](docs/prd/PRD-TEMPLATE.md) 為每個新功能複製一份,填好後加進上面的表格並指定階段。
範本已內建 Codex 需要的所有欄位(背景、實作步驟、資料模型、驗收標準、防錯提醒)。

---

## 如何把單一 PRD 丟給 Codex(建議貼法)

```
請閱讀並只執行 docs/prd/PRD-00X-xxx.md。
遵守 roadmap.md 開頭的「給 Codex 的最高原則」。
完成後,逐條回報 PRD「驗收標準」的 PASS/FAIL,並貼出 git diff 的檔案清單。
不要動到 PRD 範圍以外的檔案。
```

## 進度追蹤

每完成一個 PRD,在這裡打勾並寫下 commit / PR 連結。

- [ ] PRD-001 語音審核
- [ ] PRD-002 代幣去風險化
- [ ] PRD-003 播放心理防護
- [ ] PRD-004 冷啟動媒合
- [ ] PRD-005 匿名真實性
- [ ] PRD-006 資料模型整併
- [ ] PRD-007 手機版
- [ ] PRD-008 多語系
- [ ] PRD-009 媒體儲存
