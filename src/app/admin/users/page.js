"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GainAudio from "@/components/GainAudio";

import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { HIDE_LEGACY_FINANCE_UI } from "@/lib/featureFlags";

const PAGE_SIZE = 10;

function createEmptyEditForm() {
  return {
    id: "",
    email: "",
    name: "",
    username: "",
    faithTradition: "",
    country: "",
    avatarUrl: "",
    bio: "",
    storyAudioUrl: "",
    storyYoutubeUrl: "",
    storyUpdatedAt: null,
    solanaAddress: "",
    bscAddress: "",
    isAddressVerified: false,
    isBlocked: false,
    reportCount: 0,
    createdAt: null,
    updatedAt: null,
  };
}

function mapUserToEditForm(user) {
  return {
    id: user.id,
    email: user.email || "",
    name: user.name || "",
    username: user.username || "",
    faithTradition: user.faithTradition || "",
    country: user.country || "",
    avatarUrl: user.avatarUrl || "",
    bio: user.bio || "",
    storyAudioUrl: user.storyAudioUrl || "",
    storyYoutubeUrl: user.storyYoutubeUrl || "",
    storyUpdatedAt: user.storyUpdatedAt || null,
    solanaAddress: user.solanaAddress || "",
    bscAddress: user.bscAddress || "",
    isAddressVerified: Boolean(user.isAddressVerified),
    isBlocked: Boolean(user.isBlocked),
    reportCount: Number(user.reportCount || 0),
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function sanitizeForPayload(form) {
  return {
    email: form.email,
    name: form.name,
    username: form.username,
    faithTradition: form.faithTradition,
    country: form.country,
    avatarUrl: form.avatarUrl,
    bio: form.bio,
    storyAudioUrl: form.storyAudioUrl,
    storyYoutubeUrl: form.storyYoutubeUrl,
    solanaAddress: form.solanaAddress,
    bscAddress: form.bscAddress,
    isAddressVerified: Boolean(form.isAddressVerified),
  };
}

export default function AdminUsersPage() {
  const { feedbackNode, confirmAction, notifyError, notifySuccess } = useAdminFeedback();

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [blockActionUserId, setBlockActionUserId] = useState(null);
  const [loadingEditUserId, setLoadingEditUserId] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [editForm, setEditForm] = useState(createEmptyEditForm());
  const [originalEditForm, setOriginalEditForm] = useState(createEmptyEditForm());
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: PAGE_SIZE,
    totalPages: 1,
  });

  const debouncedSearch = useDebouncedValue(search, 400);

  const loadUsers = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const params = new URLSearchParams({
        page: String(page),
        limit: String(PAGE_SIZE),
        sort: "createdAt",
        order: "desc",
      });

      if (debouncedSearch.trim()) {
        params.set("search", debouncedSearch.trim());
      }

      if (filter !== "all") {
        params.set("status", filter);
      }

      const res = await fetch(`/api/admin/users?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "無法取得使用者列表");
      }

      const data = await res.json();
      const nextPagination = data.pagination ?? {
        total: 0,
        page: 1,
        limit: PAGE_SIZE,
        totalPages: 1,
      };
      const totalPages = Math.max(nextPagination.totalPages || 1, 1);

      if (page > totalPages) {
        setPage(totalPages);
      }

      setUsers(data.data ?? []);
      setPagination(nextPagination);
    } catch (err) {
      setError(err.message || "無法取得使用者列表");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filter, page]);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const closeEditorWithoutConfirm = useCallback(() => {
    setEditorOpen(false);
    setEditorLoading(false);
    setEditorError("");
    setEditForm(createEmptyEditForm());
    setOriginalEditForm(createEmptyEditForm());
  }, []);

  const isDirty = useMemo(
    () => JSON.stringify(sanitizeForPayload(editForm)) !== JSON.stringify(sanitizeForPayload(originalEditForm)),
    [editForm, originalEditForm],
  );

  const requestCloseEditor = useCallback(async () => {
    if (savingEdit) return;

    if (isDirty) {
      const shouldClose = await confirmAction({
        title: "尚未儲存變更",
        message: "你有尚未儲存的內容，確定要關閉編輯視窗嗎？",
        confirmText: "關閉",
        cancelText: "繼續編輯",
        tone: "warning",
      });
      if (!shouldClose) return;
    }

    closeEditorWithoutConfirm();
  }, [closeEditorWithoutConfirm, confirmAction, isDirty, savingEdit]);

  const handleToggleBlock = useCallback(
    async (id, block) => {
      const shouldContinue = await confirmAction({
        title: block ? "確認封鎖使用者" : "確認解除封鎖",
        message: block
          ? "封鎖後該使用者將無法登入與操作，是否繼續？"
          : "解除封鎖後該使用者可恢復操作，是否繼續？",
        confirmText: block ? "封鎖" : "解除封鎖",
        tone: "warning",
      });

      if (!shouldContinue) return;

      try {
        setBlockActionUserId(id);
        const res = await fetch(`/api/admin/users/${id}/block`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ block }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "更新使用者狀態失敗");
        }

        const updated = await res.json();
        setUsers((prev) => prev.map((user) => (user.id === updated.id ? { ...user, ...updated } : user)));

        if (editForm.id === updated.id) {
          setEditForm((prev) => ({ ...prev, isBlocked: Boolean(updated.isBlocked) }));
          setOriginalEditForm((prev) => ({ ...prev, isBlocked: Boolean(updated.isBlocked) }));
        }

        notifySuccess(block ? "已封鎖使用者" : "已解除封鎖");
      } catch (err) {
        notifyError(err.message || "更新使用者狀態失敗");
      } finally {
        setBlockActionUserId(null);
      }
    },
    [confirmAction, editForm.id, notifyError, notifySuccess],
  );

  const openEditor = useCallback(
    async (id) => {
      try {
        setLoadingEditUserId(id);
        setEditorOpen(true);
        setEditorLoading(true);
        setEditorError("");

        const res = await fetch(`/api/admin/users/${id}`, {
          cache: "no-store",
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "無法取得使用者詳情");
        }

        const user = await res.json();
        const mapped = mapUserToEditForm(user);
        setEditForm(mapped);
        setOriginalEditForm(mapped);
      } catch (err) {
        setEditorError(err.message || "無法取得使用者詳情");
        notifyError(err.message || "無法取得使用者詳情");
      } finally {
        setEditorLoading(false);
        setLoadingEditUserId(null);
      }
    },
    [notifyError],
  );

  const handleEditField = useCallback((key, value) => {
    setEditForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSaveEdit = useCallback(async () => {
    const shouldContinue = await confirmAction({
      title: "確認儲存使用者資料",
      message: "儲存後會立即影響使用者檔案資料，是否繼續？",
      confirmText: "儲存",
      tone: "warning",
    });

    if (!shouldContinue) return;

    try {
      setSavingEdit(true);
      const payload = sanitizeForPayload(editForm);

      const res = await fetch(`/api/admin/users/${editForm.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "更新使用者失敗");
      }

      const updated = await res.json();
      const mapped = mapUserToEditForm(updated);
      setEditForm(mapped);
      setOriginalEditForm(mapped);
      setUsers((prev) =>
        prev.map((user) =>
          user.id === updated.id
            ? {
                ...user,
                name: updated.name,
                email: updated.email,
                isBlocked: updated.isBlocked,
                reportCount: updated.reportCount,
                updatedAt: updated.updatedAt,
              }
            : user,
        ),
      );

      notifySuccess("使用者資料已更新");
    } catch (err) {
      notifyError(err.message || "更新使用者失敗");
    } finally {
      setSavingEdit(false);
    }
  }, [confirmAction, editForm, notifyError, notifySuccess]);

  useEffect(() => {
    if (!editorOpen) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        requestCloseEditor();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [editorOpen, requestCloseEditor]);

  const totalPages = Math.max(pagination.totalPages || 1, 1);
  const publicProfileHref = editForm.username ? `/overcomer/${editForm.username}` : "";

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">帳號管理</p>
          <h1>使用者管理</h1>
        </div>
      </header>

      <AdminHintPanel
        title="管理提醒"
        tone="warning"
        description="點擊 ID 可打開預覽與編輯彈窗，快速檢視前台公開資訊與核心欄位。"
        items={[
          "封鎖狀態可在列表與彈窗內同步確認。",
          "若 username 存在，建議儲存前先檢查公開頁連結。",
        ]}
      />

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>使用者列表</h2>
            <p>可依姓名與 Email 搜尋，並透過狀態快速篩選。</p>
          </div>
          <div className="admin-section__filters">
            <input
              type="search"
              placeholder="搜尋姓名、Email"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setPage(1);
              }}
            />
            <select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value);
                setPage(1);
              }}
            >
              <option value="all">全部</option>
              <option value="active">啟用中</option>
              <option value="blocked">封鎖中</option>
            </select>
          </div>
        </header>

        {loading ? (
          <p>載入中...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <>
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>姓名</th>
                    <th>Email</th>
                    <th>信任分數</th>
                    <th>標記數</th>
                    <th>檢舉數</th>
                    <th>狀態</th>
                    <th>更新時間</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.length === 0 ? (
                    <tr>
                      <td colSpan={9}>目前沒有符合條件的使用者</td>
                    </tr>
                  ) : (
                    users.map((user) => (
                      <tr key={user.id}>
                        <td>
                          <button
                            type="button"
                            className="link-button"
                            onClick={() => openEditor(user.id)}
                            disabled={loadingEditUserId === user.id || blockActionUserId === user.id}
                          >
                            {user.id}
                          </button>
                        </td>
                        <td>{user.name || "未設定"}</td>
                        <td>{user.email}</td>
                        <td>
                          {typeof user.trustScore === "number" ? (
                            <span
                              className={`status-badge${user.trustScore < 30 ? " status-badge--blocked" : ""}`}
                              title="PRD-005 信任分數，低於 30 的投稿會自動進待審"
                            >
                              {user.trustScore}
                            </span>
                          ) : (
                            <span style={{ color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                        <td>{user.flaggedCount ?? 0}</td>
                        <td>{user.reportCount ?? 0}</td>
                        <td>
                          {user.isBlocked ? (
                            <span className="status-badge status-badge--blocked">封鎖中</span>
                          ) : (
                            <span className="status-badge status-badge--active">啟用中</span>
                          )}
                        </td>
                        <td>{user.updatedAt ? new Date(user.updatedAt).toLocaleString() : "-"}</td>
                        <td>
                          <div className="admin-entity-actions">
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => openEditor(user.id)}
                              disabled={loadingEditUserId === user.id || blockActionUserId === user.id}
                            >
                              {loadingEditUserId === user.id ? "載入中..." : "編輯"}
                            </button>
                            <button
                              type="button"
                              className="link-button"
                              onClick={() => handleToggleBlock(user.id, !user.isBlocked)}
                              disabled={blockActionUserId === user.id || loadingEditUserId === user.id}
                            >
                              {blockActionUserId === user.id ? "處理中..." : user.isBlocked ? "解除封鎖" : "封鎖"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button disabled={page === 1} onClick={() => setPage((prev) => Math.max(prev - 1, 1))}>
                上一頁
              </button>
              <span>
                {page} / {totalPages}
              </span>
              <button disabled={page >= totalPages} onClick={() => setPage((prev) => Math.min(prev + 1, totalPages))}>
                下一頁
              </button>
            </div>
          </>
        )}
      </section>

      {editorOpen ? (
        <div
          className={`admin-editor${HIDE_LEGACY_FINANCE_UI ? " admin-editor--hide-legacy-finance" : ""}`}
          role="dialog"
          aria-modal="true"
          aria-label="使用者編輯"
        >
          <div className="admin-editor__backdrop" onClick={requestCloseEditor} />
          <section className="admin-editor__dialog">
            <header className="admin-editor__header">
              <div>
                <p className="admin-editor__eyebrow">使用者管理</p>
                <h3>{editForm.id ? `使用者 #${editForm.id}` : "使用者"}</h3>
              </div>
              <button type="button" className="button button--ghost" onClick={requestCloseEditor} disabled={savingEdit}>
                關閉
              </button>
            </header>

            {editorLoading ? (
              <p className="admin-editor__status">載入中...</p>
            ) : editorError ? (
              <div className="admin-editor__status admin-editor__status--error">
                <p>{editorError}</p>
              </div>
            ) : (
              <>
                <section className="admin-editor__preview">
                  <div className="admin-editor__preview-media admin-editor__preview-media--avatar">
                    {editForm.avatarUrl ? <img src={editForm.avatarUrl} alt={editForm.name || "avatar"} /> : <span>無頭像</span>}
                  </div>

                  <div className="admin-editor__preview-content">
                    <h4>{editForm.name || "未設定姓名"}</h4>
                    <p>{editForm.bio || "（無個人簡介）"}</p>
                    <div className="admin-editor__preview-meta">
                      <span>Username：{editForm.username || "-"}</span>
                      <span>Email：{editForm.email || "-"}</span>
                      <span>國家：{editForm.country || "-"}</span>
                      <span>封鎖狀態：{editForm.isBlocked ? "封鎖中" : "啟用中"}</span>
                      <span>檢舉數：{editForm.reportCount ?? 0}</span>
                      <span>建立：{editForm.createdAt ? new Date(editForm.createdAt).toLocaleString() : "-"}</span>
                      <span>更新：{editForm.updatedAt ? new Date(editForm.updatedAt).toLocaleString() : "-"}</span>
                    </div>
                    <div className="admin-editor__preview-meta">
                      <span>故事更新：{editForm.storyUpdatedAt ? new Date(editForm.storyUpdatedAt).toLocaleString() : "-"}</span>
                    </div>
                    {editForm.storyAudioUrl ? (
                      <GainAudio className="admin-editor__audio" controls preload="none" src={editForm.storyAudioUrl} />
                    ) : null}
                    {editForm.storyYoutubeUrl ? (
                      <a className="admin-editor__preview-link" href={editForm.storyYoutubeUrl} target="_blank" rel="noreferrer">
                        開啟 YouTube 故事
                      </a>
                    ) : null}
                    {publicProfileHref ? (
                      <a className="admin-editor__preview-link" href={publicProfileHref} target="_blank" rel="noreferrer">
                        開啟公開頁面
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="admin-editor__form">
                  <div className="admin-editor__grid">
                    <label className="admin-editor__field">
                      <span>Email</span>
                      <input
                        type="email"
                        value={editForm.email}
                        onChange={(event) => handleEditField("email", event.target.value)}
                        placeholder="user@example.com"
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>姓名</span>
                      <input
                        type="text"
                        value={editForm.name}
                        onChange={(event) => handleEditField("name", event.target.value)}
                        placeholder="請輸入使用者姓名"
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>Username</span>
                      <input
                        type="text"
                        value={editForm.username}
                        onChange={(event) => handleEditField("username", event.target.value)}
                        placeholder="username"
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>信仰傳統</span>
                      <input
                        type="text"
                        value={editForm.faithTradition}
                        onChange={(event) => handleEditField("faithTradition", event.target.value)}
                        placeholder="例如：基督教"
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>國家</span>
                      <input
                        type="text"
                        value={editForm.country}
                        onChange={(event) => handleEditField("country", event.target.value)}
                        placeholder="例如：Taiwan"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>頭像 URL</span>
                      <input
                        type="url"
                        value={editForm.avatarUrl}
                        onChange={(event) => handleEditField("avatarUrl", event.target.value)}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>個人簡介</span>
                      <textarea
                        rows={4}
                        value={editForm.bio}
                        onChange={(event) => handleEditField("bio", event.target.value)}
                        placeholder="請輸入公開個人簡介"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>故事音訊 URL</span>
                      <input
                        type="url"
                        value={editForm.storyAudioUrl}
                        onChange={(event) => handleEditField("storyAudioUrl", event.target.value)}
                        placeholder="/voices/profile-stories/..."
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>YouTube 故事連結</span>
                      <input
                        type="url"
                        value={editForm.storyYoutubeUrl}
                        onChange={(event) => handleEditField("storyYoutubeUrl", event.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                      />
                    </label>

                    {!HIDE_LEGACY_FINANCE_UI ? (
                      <>
                        <label className="admin-editor__field">
                          <span>Solana 地址</span>
                          <input
                            type="text"
                            value={editForm.solanaAddress}
                            onChange={(event) => handleEditField("solanaAddress", event.target.value)}
                            placeholder="Primary address"
                          />
                        </label>

                        <label className="admin-editor__field">
                          <span>BSC 地址</span>
                          <input
                            type="text"
                            value={editForm.bscAddress}
                            onChange={(event) => handleEditField("bscAddress", event.target.value)}
                            placeholder="Secondary address"
                          />
                        </label>
                      </>
                    ) : null}
                  </div>

                  {!HIDE_LEGACY_FINANCE_UI ? (
                    <label className="admin-editor__checkbox">
                      <input
                        type="checkbox"
                        checked={editForm.isAddressVerified}
                        onChange={(event) => handleEditField("isAddressVerified", event.target.checked)}
                      />
                      <span>地址已驗證</span>
                    </label>
                  ) : null}
                </section>

                <footer className="admin-editor__actions">
                  <button type="button" className="button button--ghost" onClick={requestCloseEditor} disabled={savingEdit}>
                    取消
                  </button>
                  <button type="button" className="button button--primary" onClick={handleSaveEdit} disabled={savingEdit}>
                    {savingEdit ? "儲存中..." : "儲存變更"}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      ) : null}

      {feedbackNode}
    </div>
  );
}
