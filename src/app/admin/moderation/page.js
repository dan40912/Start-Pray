"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";

const TYPE_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "card", label: "代禱卡" },
  { value: "response", label: "回應" },
  { value: "overcomer", label: "公開見證頁" },
];

const TYPE_LABELS = {
  card: "代禱卡",
  response: "回應",
  overcomer: "公開見證頁",
};

function formatDate(value) {
  if (!value) return "—";
  return new Date(value).toLocaleString();
}

function ownerLabel(owner) {
  if (!owner) return "匿名或已刪除";
  return owner.name || owner.email || owner.id || "匿名";
}

function trimText(value, fallback = "—") {
  const text = typeof value === "string" ? value.trim() : "";
  if (!text) return fallback;
  return text.length > 90 ? `${text.slice(0, 90)}...` : text;
}

export default function ModerationPage() {
  const { feedbackNode, confirmAction, notifyError, notifySuccess } = useAdminFeedback();
  const [items, setItems] = useState([]);
  const [summary, setSummary] = useState({ total: 0, card: 0, response: 0, overcomer: 0 });
  const [type, setType] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionId, setActionId] = useState(null);

  const loadReports = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({ limit: "20" });
      if (type !== "all") params.set("type", type);

      const response = await fetch(`/api/admin/reports?${params.toString()}`, { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "無法載入審核佇列");
      }

      const data = await response.json();
      setItems(data.data ?? []);
      setSummary(data.summary ?? { total: 0, card: 0, response: 0, overcomer: 0 });
    } catch (err) {
      setError(err.message || "無法載入審核佇列");
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [type]);

  useEffect(() => {
    loadReports();
  }, [loadReports]);

  const summaryCards = useMemo(
    () => [
      { id: "all", label: "佇列項目", value: summary.total ?? 0 },
      { id: "card", label: "代禱卡", value: summary.card ?? 0 },
      { id: "response", label: "回應", value: summary.response ?? 0 },
      { id: "overcomer", label: "公開見證頁", value: summary.overcomer ?? 0 },
    ],
    [summary],
  );

  const handleBlock = useCallback(
    async (item) => {
      const shouldContinue = await confirmAction({
        title: "確認封鎖內容",
        message: `將封鎖這筆${TYPE_LABELS[item.type] || "項目"}，公開頁面將不再顯示。是否繼續？`,
        confirmText: "封鎖",
        cancelText: "取消",
        tone: "warning",
      });
      if (!shouldContinue) return;

      try {
        setActionId(item.id);
        let response;
        if (item.type === "card") {
          response = await fetch("/api/admin/prayfor", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id: Number(item.targetId), block: true }),
          });
        } else if (item.type === "response") {
          response = await fetch(`/api/admin/prayerresponse/${item.targetId}/block`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ block: true }),
          });
        } else if (item.type === "overcomer") {
          response = await fetch(`/api/admin/users/${item.targetId}/block`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ block: true }),
          });
        }

        if (!response?.ok) {
          const data = await response?.json().catch(() => ({}));
          throw new Error(data?.message || "封鎖失敗");
        }

        notifySuccess("已封鎖，審核佇列已更新");
        await loadReports();
      } catch (err) {
        notifyError(err.message || "封鎖失敗，請稍後再試");
      } finally {
        setActionId(null);
      }
    },
    [confirmAction, loadReports, notifyError, notifySuccess],
  );

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">信任與安全</p>
          <h1>審核佇列</h1>
          <p>集中查看被檢舉的代禱卡、回應與公開見證頁，先理解脈絡，再採取封鎖動作。</p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={loadReports}
          disabled={loading}
          data-admin-hint="重新載入最新檢舉佇列與統計。"
        >
          重新整理
        </button>
      </header>

      <AdminHintPanel
        title="審核原則"
        description="Start Pray 處理的是人的需要。封鎖前請先看檢舉原因、內容脈絡與是否涉及個資。"
        items={["私密代禱卡只顯示審核必要資訊，不提供前台連結。", "封鎖操作會走既有 admin API 並留下操作紀錄。"]}
      />

      <section className="admin-section__card">
        <div className="admin-dashboard__kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))" }}>
          {summaryCards.map((card) => (
            <article key={card.id} className="dashboard-kpi">
              <p className="dashboard-kpi__label">{card.label}</p>
              <div className="dashboard-kpi__value-row">
                <span className="dashboard-kpi__value">{card.value}</span>
              </div>
              <p className="dashboard-kpi__footnote">&nbsp;</p>
            </article>
          ))}
        </div>
      </section>

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>待處理項目</h2>
            <p>依檢舉量與最新檢舉時間排序。</p>
          </div>
          <div className="admin-section__filters">
            <select
              value={type}
              data-admin-hint="篩選審核佇列要查看的檢舉類型。"
              onChange={(event) => {
                setType(event.target.value);
              }}
            >
              {TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </header>

        {loading ? (
          <p>載入中...</p>
        ) : error ? (
          <div>
            <p className="error">{error}</p>
            <button type="button" className="link-button" onClick={loadReports} data-admin-hint="重新嘗試載入審核佇列。">
              重新載入
            </button>
          </div>
        ) : items.length === 0 ? (
          <p>目前沒有符合條件的檢舉項目。</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>類型</th>
                  <th>內容</th>
                  <th>擁有者</th>
                  <th>檢舉</th>
                  <th>最新檢舉</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{TYPE_LABELS[item.type] || item.type}</td>
                    <td>
                      <strong>{trimText(item.title)}</strong>
                      <div style={{ color: "var(--text-muted)" }}>
                        原因：{item.latestReport?.reason || "—"}
                      </div>
                      {item.latestReport?.remarks ? (
                        <div style={{ color: "var(--text-muted)" }}>
                          補充：{trimText(item.latestReport.remarks)}
                        </div>
                      ) : null}
                    </td>
                    <td>{ownerLabel(item.owner)}</td>
                    <td>{item.reportCount ?? 0}</td>
                    <td>{formatDate(item.latestReportedAt)}</td>
                    <td>
                      {item.isBlocked ? (
                        <span className="status-badge status-badge--blocked">已封鎖</span>
                      ) : item.isPrivate ? (
                        <span className="status-badge">私密</span>
                      ) : (
                        <span className="status-badge status-badge--active">公開</span>
                      )}
                    </td>
                    <td>
                      <div className="admin-wallet__actions">
                        {item.href ? (
                          <Link href={item.href} className="link-button" target="_blank" data-admin-hint="在新分頁開啟公開頁面，確認使用者實際看到的內容。">
                            前台
                          </Link>
                        ) : null}
                        {item.adminHref ? (
                          <Link href={item.adminHref} className="link-button" data-admin-hint="前往對應管理頁查看完整資料與上下文。">
                            詳情
                          </Link>
                        ) : null}
                        {!item.isBlocked ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => handleBlock(item)}
                            disabled={actionId === item.id}
                            data-admin-hint="封鎖後，這個項目會從公開體驗中移除，並保留 admin 操作紀錄。"
                          >
                            {actionId === item.id ? "處理中..." : "封鎖"}
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {feedbackNode}
    </div>
  );
}
