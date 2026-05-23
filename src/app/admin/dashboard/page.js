"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

import AdminHintPanel from "@/components/admin/AdminHintPanel";
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
  const text = value === null || value === undefined ? "" : String(value);
  return `"${text.replace(/"/g, '""')}"`;
}

export default function AdminDashboardPage() {
  const { feedbackNode, notifyError, notifySuccess } = useAdminFeedback();
  const [metrics, setMetrics] = useState(INITIAL_METRICS);
  const [metricsLoading, setMetricsLoading] = useState(true);
  const [metricsError, setMetricsError] = useState("");
  const [lastUpdated, setLastUpdated] = useState(null);

  const [highRiskUsers, setHighRiskUsers] = useState([]);
  const [highRiskUsersLoading, setHighRiskUsersLoading] = useState(true);
  const [highRiskUsersError, setHighRiskUsersError] = useState("");

  const [highRiskPrayers, setHighRiskPrayers] = useState([]);
  const [highRiskPrayersLoading, setHighRiskPrayersLoading] = useState(true);
  const [highRiskPrayersError, setHighRiskPrayersError] = useState("");

  const [userActionId, setUserActionId] = useState(null);
  const [prayerActionId, setPrayerActionId] = useState(null);
  const [highRiskResponses, setHighRiskResponses] = useState([]);
  const [highRiskResponsesLoading, setHighRiskResponsesLoading] = useState(true);
  const [highRiskResponsesError, setHighRiskResponsesError] = useState("");
  const [responseActionId, setResponseActionId] = useState(null);
  const [exporting, setExporting] = useState(false);

  const loadMetrics = useCallback(async () => {
    setMetricsLoading(true);
    setMetricsError("");

    try {
      const baseParams = new URLSearchParams({ limit: "1", includeSummary: "true" });
      const blockedParams = new URLSearchParams({ limit: "1", status: "blocked" });
      const shortParams = new URLSearchParams({ limit: "1" });

      const [overallRes, blockedRes, prayersRes, responsesRes] = await Promise.all([
        fetch(`/api/admin/users?${baseParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/users?${blockedParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/prayfor?${shortParams.toString()}`, { cache: "no-store" }),
        fetch(`/api/admin/prayerresponse?${shortParams.toString()}`, { cache: "no-store" }),
      ]);

      if (!overallRes.ok || !blockedRes.ok || !prayersRes.ok || !responsesRes.ok) {
        throw new Error("無法載入儀表板指標");
      }

      const [overallData, blockedData, prayersData, responsesData] = await Promise.all([
        overallRes.json(),
        blockedRes.json(),
        prayersRes.json(),
        responsesRes.json(),
      ]);

      const totalUsers = overallData.pagination?.total ?? overallData.summary?.totalUsers ?? 0;
      const blockedUsers = blockedData.pagination?.total ?? overallData.summary?.blockedUsers ?? 0;
      const totalPrayers = prayersData.pagination?.total ?? 0;
      const totalResponses = responsesData.pagination?.total ?? 0;
      const averageWalletRaw =
        typeof overallData.summary?.averageWalletBalance === "number"
          ? overallData.summary.averageWalletBalance
          : 0;

      setMetrics({
        totalUsers,
        blockedUsers,
        totalPrayers,
        totalResponses,
        averageWallet: Number.isFinite(averageWalletRaw) ? averageWalletRaw : 0,
      });
      setLastUpdated(new Date());
    } catch (error) {
      setMetricsError(error.message || "無法載入儀表板指標");
    } finally {
      setMetricsLoading(false);
    }
  }, []);

  const loadHighRiskUsers = useCallback(async () => {
    setHighRiskUsersLoading(true);
    setHighRiskUsersError("");

    try {
      const params = new URLSearchParams({
        sort: "reportCount",
        order: "desc",
        limit: "5",
      });

      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: "no-store" });
      if (!res.ok) throw new Error("無法載入高風險使用者");

      const data = await res.json();
      const items = (data.data ?? []).filter((user) => (user.reportCount ?? 0) > 0);
      setHighRiskUsers(items);
    } catch (error) {
      setHighRiskUsersError(error.message || "無法載入高風險使用者");
    } finally {
      setHighRiskUsersLoading(false);
    }
  }, []);

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
      if (!res.ok) throw new Error("無法載入高風險禱告事項");

      const data = await res.json();
      const items = (data.data ?? []).filter((item) => !item.isBlocked);
      setHighRiskPrayers(items);
    } catch (error) {
      setHighRiskPrayersError(error.message || "無法載入高風險禱告事項");
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
      if (!res.ok) throw new Error("無法載入高風險回應");

      const data = await res.json();
      const items = (data.data ?? []).filter((item) => !item.isBlocked && (item.reportCount ?? 0) > 0);
      setHighRiskResponses(items);
    } catch (error) {
      setHighRiskResponsesError(error.message || "無法載入高風險回應");
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

  const handleBlockUser = async (userId, nextState) => {
    try {
      setUserActionId(userId);
      const res = await fetch(`/api/admin/users/${userId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: nextState }),
      });
      if (!res.ok) throw new Error("更新使用者狀態失敗");

      await Promise.all([loadHighRiskUsers(), loadMetrics()]);
      notifySuccess(nextState ? "已封鎖使用者" : "已解除封鎖");
    } catch (error) {
      notifyError(error.message || "更新使用者狀態失敗");
    } finally {
      setUserActionId(null);
    }
  };

  const handleBlockPrayer = async (prayerId) => {
    try {
      setPrayerActionId(prayerId);
      const res = await fetch("/api/admin/prayfor", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: prayerId, block: true }),
      });
      if (!res.ok) throw new Error("更新禱告事項狀態失敗");

      await loadHighRiskPrayers();
      notifySuccess("已封鎖禱告事項");
    } catch (error) {
      notifyError(error.message || "更新禱告事項狀態失敗");
    } finally {
      setPrayerActionId(null);
    }
  };

  const handleBlockResponse = async (responseId) => {
    try {
      setResponseActionId(responseId);
      const res = await fetch(`/api/admin/prayerresponse/${responseId}/block`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ block: true }),
      });
      if (!res.ok) throw new Error("更新回應狀態失敗");

      await loadHighRiskResponses();
      notifySuccess("已封鎖回應");
    } catch (error) {
      notifyError(error.message || "更新回應狀態失敗");
    } finally {
      setResponseActionId(null);
    }
  };

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
      rows.push(["高風險使用者 Top 5"]);
      rows.push(["姓名", "Email", "檢舉次數", "狀態"]);
      if (highRiskUsers.length === 0) {
        rows.push(["無資料", "", "", ""]);
      } else {
        highRiskUsers.forEach((user) => {
          rows.push([
            user.name || "未命名",
            user.email,
            user.reportCount ?? 0,
            user.isBlocked ? "Blocked" : "Active",
          ]);
        });
      }

      rows.push([]);
      rows.push(["高風險禱告事項 Top 5"]);
      rows.push(["標題", "作者", "檢舉次數", "狀態"]);
      if (highRiskPrayers.length === 0) {
        rows.push(["無資料", "", "", ""]);
      } else {
        highRiskPrayers.forEach((item) => {
          rows.push([
            item.title,
            item.owner?.name || item.owner?.email || "匿名",
            item.reportCount ?? 0,
            item.isBlocked ? "Blocked" : "Active",
          ]);
        });
      }

      rows.push([]);
      rows.push(["高風險回應 Top 5"]);
      rows.push(["訊息", "回覆者", "代禱卡", "檢舉次數", "狀態"]);
      if (highRiskResponses.length === 0) {
        rows.push(["無資料", "", "", "", ""]);
      } else {
        highRiskResponses.forEach((item) => {
          rows.push([
            item.message || (item.voiceUrl ? "語音回應" : "無文字"),
            item.responder?.name || item.responder?.email || "匿名",
            item.homeCard?.title || "",
            item.reportCount ?? 0,
            item.isBlocked ? "Blocked" : "Active",
          ]);
        });
      }

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
      <header className="admin-dashboard__header">
        <div>
          <p className="admin-dashboard__eyebrow">START PRAY ADMIN</p>
          <h1>儀表板總覽</h1>
          <p>快速檢視平台指標與高風險名單，作為日常巡檢入口。</p>
        </div>
        <div className="admin-dashboard__header-actions">
          {lastUpdated ? <span className="admin-dashboard__timestamp">最後更新：{lastUpdated.toLocaleString()}</span> : null}
          <button
            type="button"
            className="button button--primary"
            onClick={handleExport}
            disabled={metricsLoading || exporting}
            data-admin-hint="匯出目前儀表板摘要與高風險名單，適合巡檢留存。"
          >
            {exporting ? "匯出中..." : "匯出報表"}
          </button>
        </div>
      </header>

      <AdminHintPanel
        title="巡檢提示"
        description="儀表板適合快速巡檢。若要大量處理，請進入對應管理頁操作。"
        items={["先看高風險名單，再切到審核佇列或對應管理頁做細部處理。", "建議每日固定時間匯出報表留存。"]}
      />

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
            <button type="button" className="link-button" onClick={loadMetrics} data-admin-hint="重新載入使用者、代禱卡與回應統計。">
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
        <article className="dashboard-card">
          <header className="dashboard-card__header">
            <div>
              <h2>高風險使用者</h2>
              <p>依檢舉次數排序，最多顯示 5 筆。</p>
            </div>
          </header>

          {highRiskUsersLoading ? (
            <p>載入中...</p>
          ) : highRiskUsersError ? (
            <p className="error">{highRiskUsersError}</p>
          ) : highRiskUsers.length === 0 ? (
            <p>目前沒有高風險使用者。</p>
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
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleBlockUser(user.id, !user.isBlocked)}
                        disabled={userActionId === user.id}
                        data-admin-hint={user.isBlocked ? "解除封鎖後，該使用者可恢復登入與操作。" : "封鎖後，該使用者將無法登入與操作。"}
                      >
                        {userActionId === user.id ? "處理中..." : user.isBlocked ? "解除封鎖" : "封鎖"}
                      </button>
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
              <h2>高風險禱告事項</h2>
              <p>顯示檢舉量較高且尚未封鎖的內容。</p>
            </div>
          </header>

          {highRiskPrayersLoading ? (
            <p>載入中...</p>
          ) : highRiskPrayersError ? (
            <p className="error">{highRiskPrayersError}</p>
          ) : highRiskPrayers.length === 0 ? (
            <p>目前沒有高風險禱告事項。</p>
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
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleBlockPrayer(item.id)}
                          disabled={prayerActionId === item.id}
                          data-admin-hint="封鎖後，這張代禱卡會從公開頁面與公開 API 移除。"
                        >
                          {prayerActionId === item.id ? "處理中..." : "封鎖"}
                        </button>
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
              <h2>高風險回應</h2>
              <p>顯示被檢舉且尚未封鎖的文字或語音回應。</p>
            </div>
          </header>

          {highRiskResponsesLoading ? (
            <p>載入中...</p>
          ) : highRiskResponsesError ? (
            <p className="error">{highRiskResponsesError}</p>
          ) : highRiskResponses.length === 0 ? (
            <p>目前沒有高風險回應。</p>
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
                      <button
                        type="button"
                        className="link-button"
                        onClick={() => handleBlockResponse(item.id)}
                        disabled={responseActionId === item.id}
                        data-admin-hint="封鎖後，這則文字或語音回應不會再公開顯示或進入播放佇列。"
                      >
                        {responseActionId === item.id ? "處理中..." : "封鎖"}
                      </button>
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
