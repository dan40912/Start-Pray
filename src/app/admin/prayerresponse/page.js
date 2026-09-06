"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import GainAudio from "@/components/GainAudio";

import AdminLinkedUserEditor from "@/components/admin/AdminLinkedUserEditor";
import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const MODERATION_STATUS_LABELS = {
  PENDING: "待審核",
  APPROVED: "已核准",
  REJECTED: "已退回",
  NOT_APPLICABLE: "無需審核",
};

function createEmptyForm() {
  return {
    message: "",
    voiceUrl: "",
    isAnonymous: false,
    isBlocked: false,
    moderationStatus: "APPROVED",
    voiceModerationStatus: "APPROVED",
  };
}

function mapDetailToForm(detail) {
  return {
    message: detail?.message || "",
    voiceUrl: detail?.voiceUrl || "",
    isAnonymous: Boolean(detail?.isAnonymous),
    isBlocked: Boolean(detail?.isBlocked),
    moderationStatus: detail?.moderationStatus || "APPROVED",
    voiceModerationStatus: detail?.voiceModerationStatus || "APPROVED",
  };
}

// The old cell printed "匿名" whenever a member had no display name, so a member
// who simply never set a nickname looked identical to someone who deliberately
// posted anonymously. Those are different facts and moderators act on them
// differently, so identity and the anonymous flag are now separate columns:
// this one always says who actually posted.
function renderResponder(resp, openLinkedUser) {
  if (resp.responder?.id) {
    return (
      <button
        type="button"
        className="link-button"
        onClick={() => openLinkedUser(resp.responder.id, "回覆者")}
      >
        {resp.responder.name || resp.responder.email || `會員 ${resp.responder.id.slice(0, 8)}`}
      </button>
    );
  }
  if (resp.guestFingerprint) {
    return (
      <span title="訪客識別指紋，可比對是否為同一人洗版">
        訪客 <code>{resp.guestFingerprint}</code>
      </span>
    );
  }
  return <span style={{ color: "var(--text-muted)" }}>舊資料（未留識別）</span>;
}

export default function AdminPrayerResponsePage() {
  const { feedbackNode, confirmAction, notifyError, notifySuccess } = useAdminFeedback();

  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionId, setActionId] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [detail, setDetail] = useState(null);
  const [form, setForm] = useState(createEmptyForm());
  const [originalForm, setOriginalForm] = useState(createEmptyForm());
  const [linkedUserEditor, setLinkedUserEditor] = useState({ id: null, role: "回覆者" });

  const debouncedSearch = useDebouncedValue(search, 400);

  const loadResponses = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const params = new URLSearchParams({
        search: debouncedSearch,
        status: statusFilter,
        page: String(page),
        limit: "10",
      });

      const res = await fetch(`/api/admin/prayerresponse?${params.toString()}`, {
        cache: "no-store",
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "無法取得回應列表");
      }

      const data = await res.json();
      setResponses(data.data ?? []);
      setPagination(data.pagination ?? { total: 0, totalPages: 1 });
    } catch (err) {
      setError(err.message || "無法取得回應列表");
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, page, statusFilter]);

  const closeEditorWithoutConfirm = useCallback(() => {
    setEditorOpen(false);
    setEditorId(null);
    setEditorLoading(false);
    setEditorSaving(false);
    setEditorError("");
    setDetail(null);
    setForm(createEmptyForm());
    setOriginalForm(createEmptyForm());
  }, []);

  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(originalForm), [form, originalForm]);

  const requestCloseEditor = useCallback(async () => {
    if (editorSaving) return;

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
  }, [closeEditorWithoutConfirm, confirmAction, editorSaving, isDirty]);

  const openEditor = useCallback(async (id) => {
    setEditorOpen(true);
    setEditorId(id);
    setEditorLoading(true);
    setEditorSaving(false);
    setEditorError("");

    try {
      const res = await fetch(`/api/admin/prayerresponse/${id}`, { cache: "no-store" });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "無法取得回應詳情");
      }

      const nextDetail = await res.json();
      const nextForm = mapDetailToForm(nextDetail);
      setDetail(nextDetail);
      setForm(nextForm);
      setOriginalForm(nextForm);
    } catch (err) {
      setEditorError(err.message || "無法取得回應詳情");
    } finally {
      setEditorLoading(false);
    }
  }, []);

  const openLinkedUser = useCallback((userId, role = "回覆者") => {
    if (!userId) {
      notifyError("找不到使用者 ID");
      return;
    }
    setLinkedUserEditor({ id: userId, role });
  }, [notifyError]);

  const closeLinkedUser = useCallback(() => {
    setLinkedUserEditor({ id: null, role: "回覆者" });
  }, []);

  const handleLinkedUserUpdated = useCallback((updatedUser) => {
    if (!updatedUser?.id) return;

    setResponses((prev) =>
      prev.map((item) =>
        item.responder?.id === updatedUser.id
          ? {
              ...item,
              responder: {
                ...item.responder,
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                username: updatedUser.username,
                avatarUrl: updatedUser.avatarUrl,
              },
            }
          : item,
      ),
    );

    setDetail((prev) =>
      prev?.responder?.id === updatedUser.id
        ? {
            ...prev,
            responder: {
              ...prev.responder,
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              username: updatedUser.username,
              avatarUrl: updatedUser.avatarUrl,
            },
          }
        : prev,
    );
  }, []);

  const handleToggleBlock = useCallback(
    async (id, block) => {
      const shouldContinue = await confirmAction({
        title: block ? "確認封鎖回應" : "確認解除封鎖",
        message: block ? "封鎖後前台不會顯示此回應，是否繼續？" : "解除封鎖後前台會重新顯示此回應，是否繼續？",
        confirmText: block ? "封鎖" : "解除封鎖",
        tone: "warning",
      });

      if (!shouldContinue) return;

      try {
        setActionId(id);
        const res = await fetch(`/api/admin/prayerresponse/${id}/block`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ block }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "更新狀態失敗");
        }

        const updated = await res.json();
        setResponses((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        notifySuccess(block ? "已封鎖回應" : "已解除封鎖");

        if (detail?.id === updated.id) {
          setDetail((prev) => ({ ...prev, isBlocked: Boolean(updated.isBlocked) }));
          setForm((prev) => ({ ...prev, isBlocked: Boolean(updated.isBlocked) }));
          setOriginalForm((prev) => ({ ...prev, isBlocked: Boolean(updated.isBlocked) }));
        }
      } catch (err) {
        notifyError(err.message || "更新狀態失敗");
      } finally {
        setActionId(null);
      }
    },
    [confirmAction, detail?.id, notifyError, notifySuccess],
  );

  const handleModerationAction = useCallback(
    async (id, nextStatus) => {
      const isApprove = nextStatus === "APPROVED";
      const shouldContinue = await confirmAction({
        title: isApprove ? "確認核准回應" : "確認退回回應",
        message: isApprove
          ? "核准後前台會重新顯示此回應（文字與已審核通過的語音）。"
          : "退回後前台不會顯示此回應，直到再次核准為止。",
        confirmText: isApprove ? "核准" : "退回",
        tone: isApprove ? "default" : "warning",
      });

      if (!shouldContinue) return;

      try {
        setActionId(id);
        const res = await fetch(`/api/admin/prayerresponse/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: responses.find((item) => item.id === id)?.message || "",
            moderationStatus: nextStatus,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "更新審核狀態失敗");
        }

        const updated = await res.json();
        setResponses((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        notifySuccess(isApprove ? "已核准回應" : "已退回回應");

        if (detail?.id === updated.id) {
          setDetail((prev) => ({ ...prev, ...updated }));
          setForm((prev) => ({ ...prev, moderationStatus: updated.moderationStatus }));
          setOriginalForm((prev) => ({ ...prev, moderationStatus: updated.moderationStatus }));
        }
      } catch (err) {
        notifyError(err.message || "更新審核狀態失敗");
      } finally {
        setActionId(null);
      }
    },
    [confirmAction, detail?.id, notifyError, notifySuccess, responses],
  );

  const handleEditField = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSaveEditor = useCallback(async () => {
    if (!editorId) return;

    if (!form.message.trim()) {
      notifyError("回應內容為必填");
      return;
    }

    const payload = {
      message: form.message,
      voiceUrl: form.voiceUrl,
      isAnonymous: Boolean(form.isAnonymous),
      isBlocked: Boolean(form.isBlocked),
      moderationStatus: form.moderationStatus,
      voiceModerationStatus: form.voiceModerationStatus,
    };

    try {
      setEditorSaving(true);
      const res = await fetch(`/api/admin/prayerresponse/${editorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "更新回應失敗");
      }

      const updated = await res.json();
      const nextForm = mapDetailToForm(updated);
      setDetail(updated);
      setForm(nextForm);
      setOriginalForm(nextForm);
      setResponses((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                message: updated.message,
                voiceUrl: updated.voiceUrl,
                isAnonymous: updated.isAnonymous,
                isBlocked: updated.isBlocked,
                reportCount: updated.reportCount,
                voiceModerationStatus: updated.voiceModerationStatus,
                responder: updated.responder || item.responder,
                homeCard: updated.homeCard || item.homeCard,
              }
            : item,
        ),
      );
      notifySuccess("回應已更新");
    } catch (err) {
      notifyError(err.message || "更新回應失敗");
    } finally {
      setEditorSaving(false);
    }
  }, [editorId, form, notifyError, notifySuccess]);

  useEffect(() => {
    loadResponses();
  }, [loadResponses]);

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

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">內容管理</p>
          <h1>留言與錄音</h1>
        </div>
      </header>

      <AdminHintPanel
        title="管理提醒"
        tone="warning"
        description="每筆回應都可透過點擊 ID 開啟預覽與編輯，支援文字、音檔與封鎖狀態同步維護。"
        items={[
          "檢查前台定位連結可快速定位到對應回應。",
          "無音檔時會自動降級顯示，不影響其他資訊編輯。",
        ]}
      />

      <section className="admin-section__card">
        <header className="admin-section__card-header">
          <div>
            <h2>回應列表</h2>
            <p>可依關鍵字與狀態篩選。</p>
          </div>
          <div className="admin-section__filters">
            <input
              type="search"
              placeholder="搜尋回應、回應者"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
            />
            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="all">全部</option>
              <option value="active">啟用中</option>
              <option value="blocked">封鎖中</option>
              <option value="pending">待審核</option>
            </select>
          </div>
        </header>

        {loading ? (
          <p>載入中...</p>
        ) : error ? (
          <p className="error">{error}</p>
        ) : (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>回應者</th>
                  <th>匿名</th>
                  <th>Email</th>
                  <th>內容</th>
                  <th>所屬禱告</th>
                  <th>狀態</th>
                  <th>審核狀態</th>
                  <th>檢舉數</th>
                  <th>建立時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {responses.length === 0 ? (
                  <tr>
                    <td colSpan={11}>目前沒有回應資料</td>
                  </tr>
                ) : (
                  responses.map((resp) => (
                    <tr key={resp.id}>
                      <td>
                        <button type="button" className="link-button" onClick={() => openEditor(resp.id)}>
                          {resp.id}
                        </button>
                      </td>
                      <td>{renderResponder(resp, openLinkedUser)}</td>
                      <td>
                        {resp.postedAnonymously ? (
                          <span className="status-badge" title="送出時勾選了匿名，前台不顯示身分">
                            匿名送出
                          </span>
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>具名</span>
                        )}
                      </td>
                      <td>{resp.responder?.email || "-"}</td>
                      <td>{resp.message}</td>
                      <td>{resp.homeCard?.title || "未綁定禱告"}</td>
                      <td>
                        {resp.isBlocked ? (
                          <span className="status-badge status-badge--blocked">封鎖中</span>
                        ) : (
                          <span className="status-badge status-badge--active">啟用中</span>
                        )}
                      </td>
                      <td>
                        <span
                          className={`status-badge${
                            resp.moderationStatus === "PENDING"
                              ? " status-badge--blocked"
                              : resp.moderationStatus === "REJECTED"
                              ? " status-badge--blocked"
                              : " status-badge--active"
                          }`}
                        >
                          {MODERATION_STATUS_LABELS[resp.moderationStatus] || resp.moderationStatus}
                        </span>
                      </td>
                      <td>{resp.reportCount}</td>
                      <td>{new Date(resp.createdAt).toLocaleString()}</td>
                      <td>
                        <div className="admin-table__action-group">
                          <button
                            className="link-button"
                            onClick={() => handleToggleBlock(resp.id, !resp.isBlocked)}
                            disabled={actionId === resp.id}
                          >
                            {actionId === resp.id ? "處理中..." : resp.isBlocked ? "解除封鎖" : "封鎖"}
                          </button>
                          {resp.moderationStatus === "PENDING" || resp.moderationStatus === "REJECTED" ? (
                            <button
                              className="link-button"
                              onClick={() => handleModerationAction(resp.id, "APPROVED")}
                              disabled={actionId === resp.id}
                            >
                              核准
                            </button>
                          ) : null}
                          {resp.moderationStatus === "APPROVED" ? (
                            <button
                              className="link-button"
                              onClick={() => handleModerationAction(resp.id, "REJECTED")}
                              disabled={actionId === resp.id}
                            >
                              退回
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
            上一頁
          </button>
          <span>
            {page} / {pagination.totalPages || 1}
          </span>
          <button
            disabled={page >= (pagination.totalPages || 1)}
            onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))}
          >
            下一頁
          </button>
        </div>
      </section>

      {editorOpen ? (
        <div className="admin-editor" role="dialog" aria-modal="true" aria-label="回應編輯">
          <div className="admin-editor__backdrop" onClick={requestCloseEditor} />
          <section className="admin-editor__dialog">
            <header className="admin-editor__header">
              <div>
                <p className="admin-editor__eyebrow">回應管理</p>
                <h3>{editorId ? `回應 #${editorId}` : "回應"}</h3>
              </div>
              <button type="button" className="button button--ghost" onClick={requestCloseEditor} disabled={editorSaving}>
                關閉
              </button>
            </header>

            {editorLoading ? (
              <p className="admin-editor__status">載入中...</p>
            ) : editorError ? (
              <div className="admin-editor__status admin-editor__status--error">
                <p>{editorError}</p>
                <button type="button" className="button button--ghost" onClick={() => openEditor(editorId)}>
                  重新載入
                </button>
              </div>
            ) : (
              <>
                <section className="admin-editor__preview">
                  <div className="admin-editor__preview-content admin-editor__preview-content--full">
                    <h4>回應預覽</h4>
                    <p>{detail?.message || "（無文字內容）"}</p>

                    {detail?.voiceUrl ? (
                      <GainAudio controls preload="none" src={detail.voiceUrl} className="admin-editor__audio" />
                    ) : (
                      <p className="admin-editor__muted">此回應沒有音檔。</p>
                    )}

                    <div className="admin-editor__preview-meta">
                      <span>
                        回應者：{detail?.responder?.name || detail?.responder?.email || "匿名"}
                        {detail?.responder?.id ? (
                          <button
                            type="button"
                            className="link-button admin-editor__inline-action"
                            onClick={() => openLinkedUser(detail.responder.id, "回覆者")}
                          >
                            編輯回覆者
                          </button>
                        ) : null}
                      </span>
                      <span>所屬禱告：{detail?.homeCard?.title || "未綁定"}</span>
                      <span>
                        審核狀態：
                        {MODERATION_STATUS_LABELS[detail?.voiceModerationStatus] || detail?.voiceModerationStatus || "-"}
                      </span>
                      <span>檢舉數：{detail?.reportCount ?? 0}</span>
                      <span>建立：{detail?.createdAt ? new Date(detail.createdAt).toLocaleString() : "-"}</span>
                    </div>

                    {detail?.homeCard?.id ? (
                      <a
                        className="admin-editor__preview-link"
                        href={`/prayfor/${detail.homeCard.id}#prayer-response-${detail.id}`}
                        target="_blank"
                        rel="noreferrer"
                      >
                        開啟前台定位連結
                      </a>
                    ) : null}
                  </div>
                </section>

                <section className="admin-editor__form">
                  <div className="admin-editor__grid">
                    <label className="admin-editor__field admin-editor__field--full">
                      <span>回應文字</span>
                      <textarea
                        rows={4}
                        value={form.message}
                        onChange={(event) => handleEditField("message", event.target.value)}
                        placeholder="請輸入回應內容"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>音檔 URL</span>
                      <input
                        type="url"
                        value={form.voiceUrl}
                        onChange={(event) => handleEditField("voiceUrl", event.target.value)}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>審核狀態</span>
                      <select
                        value={form.moderationStatus}
                        onChange={(event) => handleEditField("moderationStatus", event.target.value)}
                      >
                        <option value="PENDING">待審核</option>
                        <option value="APPROVED">已核准</option>
                        <option value="REJECTED">已退回</option>
                      </select>
                    </label>
                  </div>

                  <div className="admin-editor__checkbox-group">
                    <label className="admin-editor__checkbox">
                      <input
                        type="checkbox"
                        checked={form.isAnonymous}
                        onChange={(event) => handleEditField("isAnonymous", event.target.checked)}
                      />
                      <span>匿名回應</span>
                    </label>

                    <label className="admin-editor__checkbox">
                      <input
                        type="checkbox"
                        checked={form.isBlocked}
                        onChange={(event) => handleEditField("isBlocked", event.target.checked)}
                      />
                      <span>封鎖此回應</span>
                    </label>
                  </div>
                </section>

                <footer className="admin-editor__actions">
                  <button type="button" className="button button--ghost" onClick={requestCloseEditor} disabled={editorSaving}>
                    取消
                  </button>
                  <button type="button" className="button button--primary" onClick={handleSaveEditor} disabled={editorSaving}>
                    {editorSaving ? "儲存中..." : "儲存變更"}
                  </button>
                </footer>
              </>
            )}
          </section>
        </div>
      ) : null}

      <AdminLinkedUserEditor
        open={Boolean(linkedUserEditor.id)}
        userId={linkedUserEditor.id}
        roleLabel={linkedUserEditor.role}
        confirmAction={confirmAction}
        notifyError={notifyError}
        notifySuccess={notifySuccess}
        onClose={closeLinkedUser}
        onUpdated={handleLinkedUserUpdated}
      />

      {feedbackNode}
    </div>
  );
}
