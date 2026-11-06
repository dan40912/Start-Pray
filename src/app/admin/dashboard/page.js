"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { useAdminFeedback } from "@/components/admin/useAdminFeedback";
import { HIDE_LEGACY_FINANCE_UI } from "@/lib/featureFlags";

const numberFormatter = new Intl.NumberFormat("zh-TW", { maximumFractionDigits: 0 });
const percentFormatter = new Intl.NumberFormat("zh-TW", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const currencyFormatter = new Intl.NumberFormat("zh-TW", {
  style: "currency",
  currency: "TWD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const INITIAL_METRICS = {
  totalUsers: 0,
  blockedUsers: 0,
  totalPrayers: 0,
  totalResponses: 0,
  averageWallet: 0,
};

function formatInteger(value) {
  return numberFormatter.format(Math.max(0, Math.round(Number(value) || 0)));
}

function formatPercent(value) {
  return percentFormatter.format(Math.max(0, Number(value) || 0));
}

function formatCurrency(value) {
  return currencyFormatter.format(Number(value) || 0);
}

function csvEscape(value) {
  const raw = value === null || value === undefined ? "" : String(value);
  const text = /^[=+@\-\t\r]/.test(raw) ? `'${raw}` : raw;
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AdminDashboardPage() {
  const { feedbackNode, notifyError, notifySuccess } = useAdminFeedback();
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);
  const [work, setWork] = useState(null);
  const [canManageUsers, setCanManageUsers] = useState(false);

  const [highRiskUsers, setHighRiskUsers] = useState([]);
  const [highRiskUsersLoading, setHighRiskUsersLoading] = useState(true);
  const [highRiskUsersError, setHighRiskUsersError] = useState("");

  const [highRiskPrayers, setHighRiskPrayers] = useState([]);
  const [highRiskPrayersLoading, setHighRiskPrayersLoading] = useState(true);
  const [highRiskPrayersError, setHighRiskPrayersError] = useState("");

  const [highRiskResponses, setHighRiskResponses] = useState([]);
  const [highRiskResponsesLoading, setHighRiskResponsesLoading] = useState(true);
  const [highRiskResponsesError, setHighRiskResponsesError] = useState("");
  const [exporting, setExporting] = useState(false);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");

    try {
      const response = await fetch("/api/admin/dashboard-summary", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "無法載入待辦摘要");
      setMetrics({ ...INITIAL_METRICS, ...data.metrics });
      setWork(data.work);
      setCanManageUsers(data.canManageUsers);
      setLastUpdated(new Date(data.updatedAt));
    } catch (error) {
      setMetricsError(error.message || "無法載入儀表板指標");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadHighRiskUsers = useCallback(async () => {
    if (!canManageUsers) { setHighRiskUsers([]); setHighRiskUsersLoading(false); return; }
    setHighRiskUsersLoading(true);
    setHighRiskUsersError("");

    try {
      const params = new URLSearchParams({
        sort: "reportCount",
        order: "desc",
        limit: "5",
        status: "active",
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("無法載入需查閱的使用者");

      const data = await res.json();
      const items = (data.data ?? []).filter((user) => (user.reportCount ?? 0) > 0);
      setHighRiskUsers(items);
    } catch (error) {
      setHighRiskUsersError(error.message || "無法載入需查閱的使用者");
    } finally {
      setHighRiskUsersLoading(false);
    }
  }, [canManageUsers]);

  const loadHighRiskPrayers = useCallback(async () => {
    setHighRiskPrayersLoading(true);
    setHighRiskPrayersError("");

    try {
      const params = new URLSearchParams({
        sort: "reportCount",
        order: "desc",
        limit: "5",
        status: "active",
      });

      const res = await fetch(`/api/admin/prayfor?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("無法載入被檢舉的禱告事項");

      const data = await res.json();
      const items = (data.data ?? []).filter((item) => !item.isBlocked && (item.reportCount ?? 0) > 0);
      setHighRiskPrayers(items);
    } catch (error) {
      setHighRiskPrayersError(error.message || "無法載入被檢舉的禱告事項");
    } finally {
      setHighRiskPrayersLoading(false);
    }
  }, []);

  const loadHighRiskResponses = useCallback(async () => {
    setHighRiskResponsesLoading(true);
    setHighRiskResponsesError("");

    try {
      const params = new URLSearchParams({
        sort: "reportCount",
        order: "desc",
        limit: "5",
        status: "active",
      });

      const res = await fetch(`/api/admin/prayerresponse?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("無法載入被檢舉的回應");

      const data = await res.json();
      const items = (data.data ?? []).filter((item) => !item.isBlocked && (item.reportCount ?? 0) > 0);
      setHighRiskResponses(items);
    } catch (error) {
      setHighRiskResponsesError(error.message || "無法載入被檢舉的回應");
    } finally {
      setHighRiskResponsesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMetrics();
    loadHighRiskUsers();
    loadHighRiskPrayers();
    loadHighRiskResponses();
  }, [loadHighRiskPrayers, loadHighRiskResponses, loadHighRiskUsers, loadMetrics]);

  const handleExport = () => {
    if (metricsLoading || exporting) return;

    try {
      setExporting(true);
      const rows = [];
      rows.push(["儀表板概覽", "數值"]);
      rows.push(["總使用者", metrics.totalUsers]);
      rows.push(["封鎖使用者", metrics.blockedUsers]);
      rows.push(["禱告事項數", metrics.totalPrayers]);
      rows.push(["留言數", metrics.totalResponses]);
      if (!HIDE_LEGACY_FINANCE_UI) {
        rows.push(["平均系統數值", metrics.averageWallet.toFixed(2)]);
      }

      rows.push([]);
      const csv = rows.map((row) => row.map(csvEscape).join(",")).join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `dashboard-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      notifySuccess("儀表板報表已匯出");
    } catch (error) {
      notifyError("匯出失敗，請稍後再試");
    } finally {
      setExporting(false);
    }
  };

  const blockedRatio = useMemo(() => {
    if (!metrics.totalUsers) return 0;
    return Math.min(Math.max(metrics.blockedUsers / metrics.totalUsers, 0), 1);
  }, [metrics.blockedUsers, metrics.totalUsers]);

  const metricCards = useMemo(
    () => [
      { id: "total-users", label: "總使用者", value: formatInteger(metrics.totalUsers), footnote: "全站帳號數" },
      { id: "blocked-ratio", label: "封鎖比例", value: formatPercent(blockedRatio), footnote: `${formatInteger(metrics.blockedUsers)} 人` },
      { id: "total-prayers", label: "禱告事項", value: formatInteger(metrics.totalPrayers), footnote: "總卡片數" },
      { id: "total-responses", label: "留言與錄音", value: formatInteger(metrics.totalResponses), footnote: "總回應數" },
      { id: "average-wallet", label: "平均系統數值", value: formatCurrency(metrics.averageWallet), footnote: "內部統計" },
    ],
    [blockedRatio, metrics.averageWallet, metrics.blockedUsers, metrics.totalPrayers, metrics.totalResponses, metrics.totalUsers],
  );

  return (
    <div className="admin-section">
      <section className="admin-work-summary" aria-label="今日待辦摘要">
        <div className="admin-work-summary__head"><h1>先看哪些內容</h1>
          <button type="button" className="button button--ghost" onClick={loadMetrics} disabled={metricsLoading}>更新摘要</button>
        </div>
        <p>以下是內容狀態與檢舉訊號，尚未代表違規判定；各組可能重複。</p>
        {metricsError ? <p role="alert">{metricsError}{lastUpdated ? `（上次成功更新：${lastUpdated.toLocaleString()}）` : ""}</p> : null}
        <div className="admin-work-summary__grid" aria-busy={metricsLoading}>
          {[
            ["待審代禱", "pendingCards", "/admin/prayfor?status=review"],
            ["待審回應", "pendingResponses", "/admin/prayerresponse?status=pending"],
            ["待複核語音", "pendingVoices", "/admin/prayerresponse?status=voice-pending"],
            ["有檢舉且未封鎖的內容", "reported", "/admin/moderation"],
          ].map(([label, key, href]) => <Link key={key} href={href}>
            <span>{label}</span><strong>{work ? formatInteger(key === "reported" ? work.reportedCards + work.reportedResponses : work[key]) : "—"}</strong>
            <span>閱讀與確認 →</span>
          </Link>)}
        </div>
      </section>
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">START PRAY ADMIN</p>
          <h2>平台概況</h2>
          <p>先閱讀待審與被檢舉的內容，再依證據決定是否處置。被檢舉不代表已違規。</p>
        </div>
        <div className="admin-dashboard__header-actions">
          {lastUpdated ? <span className="admin-dashboard__timestamp">最後更新：{lastUpdated.toLocaleString()}</span> : null}
          <button
            type="button"
            className="button button--primary"
            onClick={handleExport}
            disabled={metricsLoading || exporting}
            data-admin-hint="匯出平台彙總統計，不含使用者名單與代禱內容。"
          >
            {exporting ? "匯出中..." : "匯出報表"}
          </button>
        </div>
      </header>


      <section className="admin-dashboard__kpis">
        {metricsLoading ? (
          Array.from({ length: HIDE_LEGACY_FINANCE_UI ? 4 : 5 }).map((_, index) => (
            <article key={index} className="dashboard-kpi admin-dashboard--loading">
              <p className="dashboard-kpi__label">載入中...</p>
              <div className="dashboard-kpi__value-row">
                <span className="dashboard-kpi__value">--</span>
              </div>
              <p className="dashboard-kpi__footnote">&nbsp;</p>
            </article>
          ))
        ) : metricsError ? (
          <article className="dashboard-card dashboard-card--wide">
            <p className="error">{metricsError}</p>
            <button type="button" className="link-button" onClick={loadMetrics} data-admin-hint="重新載入使用者、代禱與回應統計。">
              重新載入
            </button>
          </article>
        ) : (
          metricCards.filter((card) => !HIDE_LEGACY_FINANCE_UI || card.id !== "average-wallet").map((card) => (
            <article key={card.id} className="dashboard-kpi">
              <p className="dashboard-kpi__label">{card.label}</p>
              <div className="dashboard-kpi__value-row">
                <span className="dashboard-kpi__value">{card.value}</span>
              </div>
              <p className="dashboard-kpi__footnote">{card.footnote}</p>
            </article>
          ))
        )}
      </section>

      <section className="admin-dashboard__grid">
        {canManageUsers ? (
        <article className="dashboard-card">
          <header className="dashboard-card__header">
            <div>
              <h2>需查閱的使用者</h2>
              <p>依檢舉次數排序，最多顯示 5 筆。</p>
            </div>
          </header>

          {highRiskUsersLoading ? (
            <p>載入中...</p>
          ) : highRiskUsersError ? (
            <p className="error">{highRiskUsersError}</p>
          ) : highRiskUsers.length === 0 ? (
            <p>目前沒有需查閱的使用者。</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>姓名</th>
                  <th>Email</th>
                  <th>檢舉次數</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {highRiskUsers.map((user) => (
                  <tr key={user.id}>
                    <td>{user.name || "未命名"}</td>
                    <td>{user.email}</td>
                    <td>{user.reportCount ?? 0}</td>
                    <td>
                      {user.isBlocked ? (
                        <span className="status-badge status-badge--blocked">Blocked</span>
                      ) : (
                        <span className="status-badge status-badge--active">Active</span>
                      )}
                    </td>
                    <td>
                      <Link className="link-button" href={`/admin/users?search=${encodeURIComponent(user.id)}`}>閱讀與確認</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
        ) : null}

        <article className="dashboard-card">
          <header className="dashboard-card__header">
            <div>
              <h2>被檢舉的禱告事項</h2>
              <p>顯示檢舉量較高且尚未封鎖的內容。</p>
            </div>
          </header>

          {highRiskPrayersLoading ? (
            <p>載入中...</p>
          ) : highRiskPrayersError ? (
            <p className="error">{highRiskPrayersError}</p>
          ) : highRiskPrayers.length === 0 ? (
            <p>目前沒有被檢舉的禱告事項。</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>標題</th>
                  <th>作者</th>
                  <th>檢舉次數</th>
                  <th>狀態</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {highRiskPrayers.map((item) => (
                  <tr key={item.id}>
                    <td>{item.title}</td>
                    <td>{item.owner?.name || item.owner?.email || "匿名"}</td>
                    <td>{item.reportCount ?? 0}</td>
                    <td>
                      {item.isBlocked ? (
                        <span className="status-badge status-badge--blocked">Blocked</span>
                      ) : (
                        <span className="status-badge status-badge--active">Active</span>
                      )}
                    </td>
                    <td>
                      {item.isBlocked ? (
                        <span>已封鎖</span>
                      ) : (
                        <Link className="link-button" href={`/admin/prayfor?search=${item.id}`}>閱讀與確認</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>

        <article className="dashboard-card">
          <header className="dashboard-card__header">
            <div>
              <h2>被檢舉的回應</h2>
              <p>顯示被檢舉且尚未封鎖的文字或語音回應。</p>
            </div>
          </header>

          {highRiskResponsesLoading ? (
            <p>載入中...</p>
          ) : highRiskResponsesError ? (
            <p className="error">{highRiskResponsesError}</p>
          ) : highRiskResponses.length === 0 ? (
            <p>目前沒有被檢舉的回應。</p>
          ) : (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>回應</th>
                  <th>回覆者</th>
                  <th>檢舉次數</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {highRiskResponses.map((item) => (
                  <tr key={item.id}>
                    <td>{item.message || (item.voiceUrl ? "語音回應" : "無文字")}</td>
                    <td>{item.responder?.name || item.responder?.email || "匿名"}</td>
                    <td>{item.reportCount ?? 0}</td>
                    <td>
                      <Link className="link-button" href={`/admin/prayerresponse?search=${encodeURIComponent(item.id)}`}>閱讀與確認</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </article>
      </section>
      {feedbackNode}
    </div>
  );
}
