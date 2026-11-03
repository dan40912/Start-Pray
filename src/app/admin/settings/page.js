"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";

const ROLE_OPTIONS = [
  { value: "SUPER", label: "超級管理員" },
  { value: "ADMIN", label: "一般管理員" },
];

export default function SettingsPage() {
  const { feedbackNode, confirmAction, notifyError, notifySuccess, notifyInfo } = useAdminFeedback();
  const [accounts, setAccounts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({ username: "", password: "", role: "ADMIN" });
  const [formError, setFormError] = useState("");
  const [formSubmitting, setFormSubmitting] = useState(false);
  const [sessionRole, setSessionRole] = useState(null);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [siteSettings, setSiteSettings] = useState(null);
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [settingsError, setSettingsError] = useState("");
  const [settingsSubmitting, setSettingsSubmitting] = useState(false);
  const [totpStatus, setTotpStatus] = useState(null);
  const [totpSetup, setTotpSetup] = useState(null);
  const [totpForm, setTotpForm] = useState({ code: "", password: "" });
  const [totpError, setTotpError] = useState("");
  const [totpSubmitting, setTotpSubmitting] = useState(false);

  useEffect(() => {
    let active = true;
    const loadSessionRole = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!active) return;
        if (!response.ok) {
          setSessionRole(null);
          return;
        }

        const data = await response.json();
        setSessionRole(data?.user?.role ?? null);
      } catch (error) {
        console.error("載入管理員角色失敗:", error);
        setSessionRole(null);
      } finally {
        if (active) {
          setSessionChecked(true);
        }
      }
    };

    loadSessionRole();
    return () => {
      active = false;
    };
  }, []);

  const loadSiteSettings = useCallback(async () => {
    if (!sessionRole) {
      setSettingsLoading(false);
      return;
    }

    if (sessionRole !== "SUPER" && sessionRole !== "ADMIN") {
      setSettingsError("僅限管理員存取系統設定");
      setSettingsLoading(false);
      setSiteSettings(null);
      return;
    }

    try {
      setSettingsLoading(true);
      setSettingsError("");

      const response = await fetch("/api/admin/site-settings", {
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "無法載入系統設定");
      }

      const data = await response.json();
      setSiteSettings(data);
    } catch (err) {
      console.error("載入系統設定時發生錯誤:", err);
      setSettingsError(err.message || "無法載入系統設定");
      setSiteSettings(null);
    } finally {
      setSettingsLoading(false);
    }
  }, [sessionRole]);

  const loadAccounts = useCallback(async () => {
    if (sessionRole !== "SUPER") {
      setLoading(false);
      if (sessionRole !== null) {
        setError("只有超級管理員可以管理後台帳號");
      }
      return;
    }

    try {
      setLoading(true);
      setError("");

      const response = await fetch("/api/admin/accounts", {
        cache: "no-store",
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "無法載入管理員列表");
      }

      const data = await response.json();
      setAccounts(data ?? []);
    } catch (err) {
      console.error("載入管理員帳號失敗:", err);
      setError(err.message || "無法載入管理員列表");
      setAccounts([]);
    } finally {
      setLoading(false);
    }
  }, [sessionRole]);

  useEffect(() => {
    if (!sessionChecked) return;
    loadSiteSettings();
    loadAccounts();
  }, [sessionChecked, loadSiteSettings, loadAccounts]);

  const handleToggleMaintenance = async () => {
    if (!siteSettings || settingsSubmitting) {
      return;
    }

    if (sessionRole !== "SUPER" && sessionRole !== "ADMIN") {
      setSettingsError("沒有權限更新系統設定");
      return;
    }

    try {
      setSettingsSubmitting(true);
      setSettingsError("");

      const response = await fetch("/api/admin/site-settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          maintenanceMode: !siteSettings.maintenanceMode,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "更新維護模式失敗");
      }

      const data = await response.json();
      setSiteSettings(data);
      notifySuccess(data.maintenanceMode ? "已啟用維護模式" : "已關閉維護模式");
    } catch (err) {
      console.error("切換維護模式錯誤:", err);
      setSettingsError(err.message || "更新維護模式失敗");
    } finally {
      setSettingsSubmitting(false);
    }
  };

  const handleFormChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateAccount = async (event) => {
    event.preventDefault();

    if (sessionRole !== "SUPER") {
      setFormError("沒有權限執行此操作");
      return;
    }

    if (!form.username.trim() || !form.password.trim()) {
      setFormError("請輸入帳號與密碼");
      return;
    }

    try {
      setFormSubmitting(true);
      setFormError("");

      const response = await fetch("/api/admin/accounts", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "新增管理員失敗");
      }

      setForm({ username: "", password: "", role: form.role });
      await loadAccounts();
      notifySuccess("管理員帳號已建立");
    } catch (err) {
      setFormError(err.message);
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleActive = async (account) => {
    if (sessionRole !== "SUPER") {
      notifyError("沒有權限執行此操作");
      return;
    }

    const shouldContinue = await confirmAction({
      title: account.isActive ? "確認停用管理員" : "確認啟用管理員",
      message: account.isActive
        ? `停用 ${account.username} 後將無法登入後台。`
        : `啟用 ${account.username} 後將可登入後台。`,
      confirmText: account.isActive ? "確認停用" : "確認啟用",
      tone: "warning",
    });
    if (!shouldContinue) return;

    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ isActive: !account.isActive }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "更新失敗");
      }

      await loadAccounts();
      notifySuccess(account.isActive ? "管理員已停用" : "管理員已啟用");
    } catch (err) {
      notifyError(err.message || "更新失敗");
    }
  };

  const handleChangeRole = async (account, role) => {
    if (sessionRole !== "SUPER") {
      notifyError("沒有權限執行此操作");
      return;
    }

    if (role === account.role) {
      notifyInfo("角色未變更");
      return;
    }

    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ role }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "更新角色失敗");
      }

      await loadAccounts();
      notifySuccess(`已更新 ${account.username} 角色為 ${role}`);
    } catch (err) {
      notifyError(err.message || "更新角色失敗");
    }
  };

  const loadTotpStatus = useCallback(async () => {
    if (sessionRole !== "SUPER" && sessionRole !== "ADMIN") return;
    try {
      const response = await fetch("/api/admin/2fa", { cache: "no-store" });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "無法取得 2FA 狀態");
      }
      setTotpStatus(await response.json());
    } catch (err) {
      console.error("載入 2FA 狀態失敗:", err);
      setTotpError(err.message || "無法取得 2FA 狀態");
    }
  }, [sessionRole]);

  useEffect(() => {
    if (!sessionChecked) return;
    loadTotpStatus();
  }, [sessionChecked, loadTotpStatus]);

  const handleStartTotpSetup = async () => {
    try {
      setTotpSubmitting(true);
      setTotpError("");
      const response = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "setup" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "無法產生 2FA 設定");
      }
      setTotpSetup(data);
      setTotpForm({ code: "", password: "" });
    } catch (err) {
      setTotpError(err.message || "無法產生 2FA 設定");
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleConfirmTotp = async (event) => {
    event.preventDefault();
    if (!totpSetup) return;

    try {
      setTotpSubmitting(true);
      setTotpError("");
      const response = await fetch("/api/admin/2fa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "confirm",
          setupToken: totpSetup.setupToken,
          code: totpForm.code.trim(),
          password: totpForm.password,
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.message || "2FA 設定失敗");
      }
      setTotpSetup(null);
      setTotpForm({ code: "", password: "" });
      setTotpStatus(data);
      if (sessionRole === "SUPER") {
        await loadAccounts();
      }
      notifySuccess("個人 2FA 已啟用，下次登入請使用新的驗證碼");
    } catch (err) {
      setTotpError(err.message || "2FA 設定失敗");
    } finally {
      setTotpSubmitting(false);
    }
  };

  const handleResetTotp = async (account) => {
    if (sessionRole !== "SUPER") {
      notifyError("沒有權限執行此操作");
      return;
    }

    const shouldContinue = await confirmAction({
      title: "確認重設個人 2FA",
      message: `重設後 ${account.username} 會改用共用的 2FA 驗證碼登入，需要重新設定個人 2FA。若伺服器已移除共用密鑰，該帳號將暫時無法登入。`,
      confirmText: "確認重設",
      tone: "warning",
    });
    if (!shouldContinue) return;

    try {
      const response = await fetch(`/api/admin/accounts/${account.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ resetTotp: true }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "重設 2FA 失敗");
      }

      await loadAccounts();
      await loadTotpStatus();
      notifySuccess(`已重設 ${account.username} 的個人 2FA`);
    } catch (err) {
      notifyError(err.message || "重設 2FA 失敗");
    }
  };

  const accountsSummary = useMemo(() => {
    const total = accounts.length;
    const superAdmins = accounts.filter((account) => account.role === "SUPER" && account.isActive).length;
    return { total, superAdmins };
  }, [accounts]);

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">權限與後台帳號</p>
          <h1>權限管理</h1>
          <p>管理可以登入系統後台的管理員帳號與權限角色。</p>
        </div>
      </header>
      <AdminHintPanel
        title="權限安全提示"
        tone="warning"
        description="停用管理員、調整角色與維護模式都屬於高風險設定。"
        items={["變更角色前，先確認至少保留一位可用 SUPER。", "建議在低峰時段切換維護模式。"]}
      />

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>Maintenance Mode</h2>
            <p>Toggle to display a maintenance 500 page for public visitors.</p>
          </div>
        </header>

        {settingsLoading ? (
          <p>Loading settings...</p>
        ) : settingsError ? (
          <p className="error">{settingsError}</p>
        ) : siteSettings ? (
          <div className="admin-maintenance">
            <div className="admin-maintenance__status">
              <p>
                Current status:{" "}
                <strong>{siteSettings.maintenanceMode ? "Maintenance" : "Online"}</strong>
              </p>
              {siteSettings.updatedAt ? (
                <p className="admin-maintenance__meta">
                  Last updated: {new Date(siteSettings.updatedAt).toLocaleString()}
                </p>
              ) : null}
            </div>
            <div className="admin-maintenance__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={handleToggleMaintenance}
                disabled={settingsSubmitting}
              >
                {settingsSubmitting
                  ? "Applying..."
                  : siteSettings.maintenanceMode
                    ? "Disable maintenance"
                    : "Enable maintenance"}
              </button>
            </div>
          </div>
        ) : (
          <p className="error">Unable to load settings.</p>
        )}
      </section>

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>我的兩步驟驗證（2FA）</h2>
            <p>為自己的帳號綁定專屬的驗證器 App，不再與其他管理員共用同一組驗證碼。</p>
          </div>
        </header>

        {totpStatus ? (
          <p>
            目前狀態：
            {totpStatus.enabled ? (
              <span className="status-badge status-badge--active">已啟用個人 2FA</span>
            ) : (
              <span className="status-badge status-badge--blocked">尚未設定（使用共用驗證碼）</span>
            )}
          </p>
        ) : null}

        {totpSetup ? (
          <form className="admin-form" onSubmit={handleConfirmTotp}>
            <p>
              1. 用 Google Authenticator、1Password 等 App 掃描 QR Code。
              {totpStatus?.enabled ? "完成後舊的個人驗證器會失效。" : ""}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={totpSetup.qrDataUrl} alt="2FA QR Code" width={220} height={220} />
            <p>
              無法掃描時可手動輸入金鑰：<code>{totpSetup.secret}</code>
            </p>
            <p>2. 輸入 App 顯示的 6 位數驗證碼與你目前的後台密碼。</p>
            <div className="admin-form__row admin-form__row--equal">
              <label className="admin-form__field">
                <span>驗證碼</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  pattern="\d{6}"
                  maxLength={6}
                  value={totpForm.code}
                  onChange={(event) => setTotpForm((prev) => ({ ...prev, code: event.target.value }))}
                  disabled={totpSubmitting}
                  required
                />
              </label>
              <label className="admin-form__field">
                <span>目前密碼</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={totpForm.password}
                  onChange={(event) => setTotpForm((prev) => ({ ...prev, password: event.target.value }))}
                  disabled={totpSubmitting}
                  required
                />
              </label>
            </div>
            {totpError ? <p className="error">{totpError}</p> : null}
            <div className="admin-form__actions">
              <button type="submit" className="button button--primary" disabled={totpSubmitting}>
                {totpSubmitting ? "驗證中…" : "確認啟用"}
              </button>
              <button
                type="button"
                className="link-button"
                onClick={() => {
                  setTotpSetup(null);
                  setTotpError("");
                }}
                disabled={totpSubmitting}
              >
                取消
              </button>
            </div>
          </form>
        ) : (
          <>
            {totpError ? <p className="error">{totpError}</p> : null}
            <div className="admin-form__actions">
              <button
                type="button"
                className="button button--primary"
                onClick={handleStartTotpSetup}
                disabled={totpSubmitting || !totpStatus}
              >
                {totpStatus?.enabled ? "重新綁定驗證器" : "設定個人 2FA"}
              </button>
            </div>
          </>
        )}
      </section>

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>管理員列表</h2>
            <p>目前共有 {accountsSummary.total} 位管理員，其中 {accountsSummary.superAdmins} 位為啟用中的超級管理員。</p>
          </div>
        </header>

        {loading ? (
          <p>載入中…</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <table className="admin-table">
            <thead>
              <tr>
                <th>帳號</th>
                <th>角色</th>
                <th>狀態</th>
                <th>個人 2FA</th>
                <th>最後登入</th>
                <th>建立時間</th>
                <th>操作</th>
              </tr>
            </thead>
            <tbody>
              {accounts.length === 0 ? (
                <tr>
                  <td colSpan={7}>目前尚未建立管理員帳號</td>
                </tr>
              ) : (
                accounts.map((account) => (
                  <tr key={account.id}>
                    <td>{account.username}</td>
                    <td>
                      <select
                        value={account.role}
                        onChange={(event) => handleChangeRole(account, event.target.value)}
                        disabled={sessionRole !== "SUPER"}
                      >
                        {ROLE_OPTIONS.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td>
                      {account.isActive ? (
                        <span className="status-badge status-badge--active">啟用</span>
                      ) : (
                        <span className="status-badge status-badge--blocked">停用</span>
                      )}
                    </td>
                    <td>{account.totpEnabledAt ? "已設定" : "未設定"}</td>
                    <td>{account.lastLoginAt ? new Date(account.lastLoginAt).toLocaleString() : "—"}</td>
                    <td>{new Date(account.createdAt).toLocaleString()}</td>
                    <td>
                      <div className="admin-wallet__actions">
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => handleToggleActive(account)}
                        >
                          {account.isActive ? "停用" : "啟用"}
                        </button>
                        {account.totpEnabledAt ? (
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => handleResetTotp(account)}
                          >
                            重設 2FA
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </section>

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>新增管理員</h2>
            <p>建立新的管理員帳號，並指定可存取的權限範圍。</p>
          </div>
        </header>

        <form className="admin-form" onSubmit={handleCreateAccount}>
          <div className="admin-form__row admin-form__row--equal">
            <label className="admin-form__field">
              <span>帳號</span>
              <input
                type="text"
                value={form.username}
                onChange={(event) => handleFormChange("username", event.target.value)}
                placeholder="小寫英文字母或數字"
                disabled={formSubmitting}
                required
              />
            </label>
            <label className="admin-form__field">
              <span>密碼</span>
              <input
                type="password"
                value={form.password}
                onChange={(event) => handleFormChange("password", event.target.value)}
                placeholder="至少 8 個字元"
                minLength={8}
                disabled={formSubmitting}
                required
              />
            </label>
            <label className="admin-form__field">
              <span>角色</span>
              <select
                value={form.role}
                onChange={(event) => handleFormChange("role", event.target.value)}
                disabled={formSubmitting}
              >
                {ROLE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
          </div>

          {formError ? <p className="error">{formError}</p> : null}

          <div className="admin-form__actions">
            <button type="submit" className="button button--primary" disabled={formSubmitting}>
              {formSubmitting ? "建立中…" : "建立管理員"}
            </button>
          </div>
        </form>
      </section>
      {feedbackNode}
    </div>
  );
}
