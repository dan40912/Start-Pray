"use client";

import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { HIDE_LEGACY_FINANCE_UI } from "@/lib/featureFlags";

const DEFAULT_HINT = {
  title: "後台操作提示",
  tone: "info",
  description: "先用搜尋與篩選縮小範圍，再執行封鎖、調整狀態等高風險操作。",
  items: [
    "高風險操作請先確認對象與狀態，避免誤封鎖或誤更新。",
    "有批次需求時，先導出名單複核，再回來執行。",
  ],
};

const PAGE_HINTS = [
  {
    match: "/admin/dashboard",
    title: "儀表板提示",
    tone: "info",
    description: "這裡適合做快速巡檢，不建議直接大量操作。",
    items: ["先看高風險名單，再進入審核佇列或對應管理頁做精細處理。"],
  },
  {
    match: "/admin/moderation",
    title: "審核佇列提示",
    tone: "warning",
    description: "這裡集中顯示被檢舉的公開內容與公開個人頁，請先看原因與上下文再封鎖。",
    items: ["私密卡片不提供前台連結；若需要更多脈絡，請進入對應管理頁。"],
  },
  {
    match: "/admin/users",
    title: "會員管理提示",
    tone: "warning",
    description: "封鎖會影響使用者可用性，建議先確認檢舉次數與最近活動。",
    items: ["先搜尋 Email/姓名確認對象，再執行封鎖或解封。"],
  },
  {
    match: "/admin/prayfor",
    title: "禱告事項提示",
    tone: "warning",
    description: "建議以檢舉次數排序優先處理高風險內容。",
    items: ["封鎖前可先看作者與建立時間，避免誤封新內容。"],
  },
  {
    match: "/admin/prayerresponse",
    title: "留言與錄音提示",
    tone: "warning",
    description: "留言與錄音建議先看上下文，再決定封鎖狀態。",
    items: ["先用搜尋定位作者，再逐筆確認內容。"],
  },
  {
    match: "/admin/settings",
    title: "權限設定提示",
    tone: "warning",
    description: "停用管理員或降權前，請確認仍保留至少一位可用 SUPER。",
    items: ["Maintenance Mode 建議先在低峰時段切換。"],
  },
  {
    match: "/admin/content",
    title: "Banner 內容提示",
    tone: "info",
    description: "發布前建議確認 CTA 連結與圖片顯示比例。",
    items: ["每次編輯只改一個主題，方便追蹤回滾。"],
  },
  {
    match: "/admin/log",
    title: "系統紀錄提示",
    tone: "info",
    description: "先用 category/level 篩選，再用關鍵字定位事件。",
    items: ["對同類錯誤做聚合排查，避免只處理單點。"],
  },
];

function resolveHint(pathname) {
  if (!pathname || pathname === "/admin") {
    return null;
  }

  return PAGE_HINTS.find((item) => pathname.startsWith(item.match)) || DEFAULT_HINT;
}

export default function AdminRouteHints({ pathname }) {
  if (HIDE_LEGACY_FINANCE_UI && pathname?.startsWith("/admin/wallet")) return null;

  const hint = resolveHint(pathname);
  if (!hint) return null;

  return (
    <AdminHintPanel
      title={hint.title}
      description={hint.description}
      items={hint.items}
      tone={hint.tone}
    />
  );
}
