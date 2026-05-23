"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminHintPanel from "@/components/admin/AdminHintPanel";

const CATEGORY_OPTIONS = [
  { value: "all", label: "全部" },
  { value: "system", label: "系統錯誤" },
  { value: "action", label: "操作紀錄" },
];

const LEVEL_OPTIONS = [
  { value: "all", label: "全部等級" },
  { value: "INFO", label: "Info" },
  { value: "WARNING", label: "Warning" },
  { value: "ERROR", label: "Error" },
  { value: "CRITICAL", label: "Critical" },
];

const LEVEL_COLOR = {
  INFO: "#2563eb",
  WARNING: "#d97706",
  ERROR: "#dc2626",
  CRITICAL: "#7f1d1d",
};

const PAGE_SIZE = 20;

function formatDate(value) {
  try {
    return new Date(value).toLocaleString();
  } catch (error) {
    return value;
  }
}

function renderMetadata(metadata) {
  if (!metadata) {
    return "—";
  }

  try {
    return JSON.stringify(metadata, null, 2);
  } catch (error) {
    return String(metadata);
  }
}

export default function AdminLogPage() {
  const [logs, setLogs] = useState([]);
  const [category, setCategory] = useState("all");
  const [level, setLevel] = useState("all");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });
  const [summary, setSummary] = useState({ total: 0 });

  const loadLogs = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: page.toString(),
        limit: PAGE_SIZE.toString(),
      });

      if (category !== "all") {
        params.set("category", category);
      }

      if (level !== "all") {
        params.set("level", level);
      }

      if (search) {
        params.set("search", search);
      }

      const response = await fetch(`/api/admin/logs?${params.toString()}`, {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error("無法載入紀錄");
      }

      const data = await response.json();
      setLogs(data.data ?? []);
      setPagination(
        data.pagination ?? {
          total: 0,
          page: 1,
          limit: PAGE_SIZE,
          totalPages: 1,
        }
      );
      setSummary(data.summary ?? { total: 0 });
    } catch (err) {
      console.error("載入日誌失敗:", err);
      setError(err.message || "無法載入紀錄");
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [category, level, page, search]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleSearchSubmit = useCallback(
    (event) => {
      event.preventDefault();
      setPage(1);
      setSearch(searchInput.trim());
    },
    [searchInput]
  );

  const totalPages = useMemo(() => Math.max(pagination.totalPages || 1, 1), [pagination.totalPages]);

  const summaryCards = useMemo(() => {
    const systemCount = summary.system ?? 0;
    const actionCount = summary.action ?? 0;
    return [
      {
        id: "logs-total",
        label: "紀錄總數",
        value: summary.total ?? pagination.total ?? 0,
      },
      {
        id: "logs-system",
        label: "系統錯誤",
        value: systemCount,
      },
      {
        id: "logs-action",
        label: "操作紀錄",
        value: actionCount,
      },
    ];
  }, [summary, pagination.total]);

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">診斷與追蹤</p>
          <h1>系統紀錄</h1>
          <p>即時查看操作紀錄與系統錯誤，協助快速定位問題來源。</p>
        </div>
        <button
          type="button"
          className="button button--ghost"
          onClick={() => loadLogs()}
          disabled={loading}
          data-admin-hint="重新載入目前篩選條件下的管理紀錄。"
        >
          重新整理
        </button>
      </header>
      <AdminHintPanel
        title="排查提示"
        description="建議先按類型與等級縮小範圍，再使用關鍵字查詢 requestPath 或 action。"
        items={["先看近期 CRITICAL / ERROR。", "定位後再到對應模組頁面處理。"]}
      />

      <section className="admin-section__card">
        <div className="admin-dashboard__kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
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
            <h2>紀錄列表</h2>
            <p>可按類型、等級與關鍵字過濾，掌握近期事件。</p>
          </div>
          <div className="admin-section__filters">
            <select
              value={category}
              data-admin-hint="選擇要查看系統錯誤、操作紀錄或全部紀錄。"
              onChange={(event) => {
                setCategory(event.target.value);
                setPage(1);
              }}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={level}
              data-admin-hint="依紀錄嚴重程度篩選，排查時建議先看 ERROR 與 CRITICAL。"
              onChange={(event) => {
                setLevel(event.target.value);
                setPage(1);
              }}
            >
              {LEVEL_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <form className="admin-section__search" onSubmit={handleSearchSubmit}>
              <input
                type="search"
                placeholder="搜尋訊息、操作、路徑"
                value={searchInput}
                data-admin-hint="搜尋訊息、操作名稱、目標、操作者或 request path。"
                onChange={(event) => setSearchInput(event.target.value)}
              />
            </form>
          </div>
        </header>

        {loading ? (
          <p>載入中…</p>
        ) : error ? (
          <div>
            <p className="error">{error}</p>
            <button type="button" className="link-button" onClick={() => loadLogs()} data-admin-hint="重新嘗試載入管理紀錄。">
              重新載入
            </button>
          </div>
        ) : logs.length === 0 ? (
          <p>目前沒有符合條件的紀錄。</p>
        ) : (
          <div className="admin-log-table">
            <table className="admin-table">
              <thead>
                <tr>
                  <th style={{ width: "180px" }}>發生時間</th>
                  <th style={{ width: "110px" }}>類型</th>
                  <th style={{ width: "110px" }}>等級</th>
                  <th>訊息</th>
                  <th style={{ width: "200px" }}>來源</th>
                  <th style={{ width: "60px" }}>詳細</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((entry) => {
                  const levelColor = LEVEL_COLOR[entry.level] || "#4b5563";
                  return (
                    <tr key={entry.id}>
                      <td>{formatDate(entry.createdAt)}</td>
                      <td>{entry.category === "SYSTEM" ? "系統錯誤" : "操作紀錄"}</td>
                      <td>
                        <span style={{ color: levelColor, fontWeight: 600 }}>{entry.level}</span>
                      </td>
                      <td>
                        <strong>{entry.message}</strong>
                        {entry.action ? <div style={{ color: "var(--text-muted)" }}>操作：{entry.action}</div> : null}
                        {entry.actorEmail || entry.actorId ? (
                          <div style={{ color: "var(--text-muted)" }}>
                            觸發者：{entry.actorEmail || entry.actorId}
                          </div>
                        ) : null}
                        {entry.targetType || entry.targetId ? (
                          <div style={{ color: "var(--text-muted)" }}>
                            目標：{entry.targetType ? `${entry.targetType}` : ""}
                            {entry.targetId ? ` (${entry.targetId})` : ""}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {entry.requestPath ? entry.requestPath : "—"}
                      </td>
                      <td>
                        {entry.metadata ? (
                          <details>
                            <summary>檢視</summary>
                            <pre>{renderMetadata(entry.metadata)}</pre>
                          </details>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            <div className="pagination">
              <button
                type="button"
                disabled={page === 1}
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
                data-admin-hint="前往上一頁紀錄。"
              >
                上一頁
              </button>
              <span>
                第 {page} / {totalPages} 頁（共 {pagination.total} 筆）
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}
                data-admin-hint="前往下一頁紀錄。"
              >
                下一頁
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
