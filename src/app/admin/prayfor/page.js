"use client";

import { useSearchParams } from "next/navigation";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import AdminLinkedUserEditor from "@/components/admin/AdminLinkedUserEditor";
import AdminHintPanel from "@/components/admin/AdminHintPanel";
import { useAdminFeedback } from "@/components/admin/useAdminFeedback";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

function createEmptyForm() {
  return {
    title: "",
    description: "",
    image: "",
    alt: "",
    detailsHref: "",
    voiceHref: "",
    categoryId: "",
    isBlocked: false,
  };
}

function mapDetailToForm(detail) {
  return {
    title: detail?.title || "",
    description: detail?.description || "",
    image: detail?.image || "",
    alt: detail?.alt || "",
    detailsHref: detail?.detailsHref || "",
    voiceHref: detail?.voiceHref || "",
    categoryId: detail?.categoryId ? String(detail.categoryId) : "",
    isBlocked: Boolean(detail?.isBlocked),
  };
}

function normalizeCategoryList(payload) {
  if (!Array.isArray(payload)) return [];
  return payload
    .map((item) => ({
      id: Number(item.id),
      name: item.name || "未命名分類",
      isActive: item.isActive !== false,
    }))
    .filter((item) => Number.isInteger(item.id) && item.id > 0)
    .sort((a, b) => a.id - b.id);
}

// Anonymous submissions have no owner. Since the fingerprint columns landed
// they do carry a guest hash, so a moderator can at least tell one guest posting
// five cards from five separate guests. Cards created before that migration have
// neither, and「舊資料」says so rather than implying a failed lookup.
function renderAuthor(card, openLinkedUser) {
  if (card.isPrivate) return <span>私密作者（詳情檢視）</span>;
  if (card.owner?.id) {
    return (
      <button type="button" className="link-button" onClick={() => openLinkedUser(card.owner.id, "作者")}>
        {card.owner.name || card.owner.email || `會員 ${card.owner.id.slice(0, 8)}`}
      </button>
    );
  }
  if (card.guestFingerprint) {
    return (
      <span title="匿名訪客的識別指紋，可用來比對是否為同一人">
        訪客 <code>{card.guestFingerprint}</code>
      </span>
    );
  }
  return <span style={{ color: "var(--text-muted)" }}>舊資料（未留識別）</span>;
}

export default function AdminPrayforPage() {
  const { feedbackNode, confirmAction, notifyError, notifySuccess } = useAdminFeedback();

  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const searchParams = useSearchParams();
  const requestSequence = useRef(0);
  const [search, setSearch] = useState(() => searchParams.get("search") || "");
  const [status, setStatus] = useState(() => searchParams.get("status") || "all");
  const [sort, setSort] = useState("createdAt");
  const [order, setOrder] = useState("desc");
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, totalPages: 1 });
  const [actionId, setActionId] = useState(null);

  const [editorOpen, setEditorOpen] = useState(false);
  const [editorId, setEditorId] = useState(null);
  const [editorLoading, setEditorLoading] = useState(false);
  const [editorSaving, setEditorSaving] = useState(false);
  const [editorError, setEditorError] = useState("");
  const [detail, setDetail] = useState(null);
  const [threadsText, setThreadsText] = useState("");
  const [threadsActionLoading, setThreadsActionLoading] = useState(false);
  const [form, setForm] = useState(createEmptyForm());
  const [originalForm, setOriginalForm] = useState(createEmptyForm());
  const [categories, setCategories] = useState([]);
  const [linkedUserEditor, setLinkedUserEditor] = useState({ id: null, role: "作者" });

  useEffect(() => {
    setSearch(searchParams.get("search") || "");
    setStatus(searchParams.get("status") || "all");
    setPage(1);
  }, [searchParams]);

  const debouncedSearch = useDebouncedValue(search, 400);

  const loadCards = useCallback(async () => {
    const requestId = ++requestSequence.current;
    try {
      setLoading(true);
      setLoadError("");
      const query = new URLSearchParams({
        search: debouncedSearch,
        status,
        sort,
        order,
        page: String(page),
        limit: "10",
      });

      const res = await fetch(`/api/admin/prayfor?${query.toString()}`, {
        cache: "no-store",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "無法取得禱告事項列表");
      }
      const result = await res.json();
      if (requestId !== requestSequence.current) return;
      setCards(result.data ?? []);
      setPagination(result.pagination ?? { total: 0, totalPages: 1 });
    } catch (err) {
      if (requestId !== requestSequence.current) return;
      setLoadError(err.message || "無法取得禱告事項列表");
      notifyError(err.message || "無法取得禱告事項列表");
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [debouncedSearch, notifyError, order, page, sort, status]);

  const loadCategories = useCallback(async () => {
    const res = await fetch("/api/admin/home-categories", { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || "無法取得分類清單");
    }

    const list = normalizeCategoryList(await res.json());
    setCategories(list);
    return list;
  }, []);

  const closeEditorWithoutConfirm = useCallback(() => {
    setEditorOpen(false);
    setEditorId(null);
    setEditorLoading(false);
    setEditorSaving(false);
    setEditorError("");
    setDetail(null);
    setThreadsText("");
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

  const openEditor = useCallback(
    async (id) => {
      setEditorOpen(true);
      setEditorId(id);
      setEditorLoading(true);
      setEditorSaving(false);
      setEditorError("");

      try {
        const [detailRes, categoryList] = await Promise.all([
          fetch(`/api/admin/prayfor/${id}`, { cache: "no-store" }),
          categories.length ? Promise.resolve(categories) : loadCategories(),
        ]);

        if (!detailRes.ok) {
          const data = await detailRes.json().catch(() => ({}));
          throw new Error(data.message || "無法取得禱告事項詳情");
        }

        const nextDetail = await detailRes.json();
        const nextForm = mapDetailToForm(nextDetail);

        setDetail(nextDetail);
        setThreadsText(nextDetail?.threadsShare?.postText || nextDetail?.threadsShare?.suggestedPostText || "");
        setForm(nextForm);
        setOriginalForm(nextForm);

        if (!nextForm.categoryId && categoryList.length > 0) {
          setForm((prev) => ({ ...prev, categoryId: String(categoryList[0].id) }));
          setOriginalForm((prev) => ({ ...prev, categoryId: String(categoryList[0].id) }));
        }
      } catch (err) {
        setEditorError(err.message || "無法取得禱告事項詳情");
      } finally {
        setEditorLoading(false);
      }
    },
    [categories, loadCategories],
  );

  const openLinkedUser = useCallback((userId, role = "作者") => {
    if (!userId) {
      notifyError("找不到使用者 ID");
      return;
    }

    setLinkedUserEditor({ id: userId, role });
  }, [notifyError]);

  const closeLinkedUser = useCallback(() => {
    setLinkedUserEditor({ id: null, role: "作者" });
  }, []);

  const handleLinkedUserUpdated = useCallback((updatedUser) => {
    if (!updatedUser?.id) return;

    setCards((prev) =>
      prev.map((item) =>
        item.owner?.id === updatedUser.id
          ? {
              ...item,
              owner: {
                ...item.owner,
                id: updatedUser.id,
                name: updatedUser.name,
                email: updatedUser.email,
                username: updatedUser.username,
              },
            }
          : item,
      ),
    );

    setDetail((prev) =>
      prev?.owner?.id === updatedUser.id
        ? {
            ...prev,
            owner: {
              ...prev.owner,
              id: updatedUser.id,
              name: updatedUser.name,
              email: updatedUser.email,
              username: updatedUser.username,
            },
          }
        : prev,
    );
  }, []);

  const toggleBlock = useCallback(
    async (id, block) => {
      const shouldContinue = await confirmAction({
        title: block ? "確認封鎖禱告事項" : "確認解除封鎖",
        message: block
          ? "封鎖後前台將無法顯示此禱告事項，是否繼續？"
          : "解除封鎖後前台會重新顯示此禱告事項，是否繼續？",
        confirmText: block ? "封鎖" : "解除封鎖",
        tone: "warning",
      });

      if (!shouldContinue) return;

      try {
        setActionId(id);
        const res = await fetch("/api/admin/prayfor", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id, block }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.message || "更新狀態失敗");
        }

        const updated = await res.json();
        setCards((prev) => prev.map((item) => (item.id === updated.id ? { ...item, ...updated } : item)));
        notifySuccess(block ? "已封鎖禱告事項" : "已解除封鎖");

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

  const handleThreadsAction = useCallback(async (action) => {
    if (!detail?.id || threadsActionLoading) return;
    const isPublish = action === "publish";
    const shouldContinue = await confirmAction({
      title: isPublish
        ? "發布到 Start Pray 官方 Threads"
        : action === "recover"
          ? "檢查卡住的 Threads 發布"
          : "略過 Threads 發布",
      message: isPublish
        ? "請確認下方預覽已移除可識別個人或敏感資訊。發布後會公開在 Start Pray 官方 Threads。"
        : action === "recover"
          ? "請先到官方 Threads 確認是否已經出現這篇貼文。解除卡住狀態後，管理員才能手動重試。"
          : "這則代禱不會發布到 Threads，但會保留原有代禱內容。",
      confirmText: isPublish ? "確認發布" : action === "recover" ? "確認檢查" : "略過發布",
      tone: isPublish ? "warning" : "neutral",
    });
    if (!shouldContinue) return;

    try {
      setThreadsActionLoading(true);
      const response = await fetch(`/api/admin/prayfor/${detail.id}/threads`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text: threadsText }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.message || "Threads 操作失敗");

      setDetail((prev) => ({
        ...prev,
        threadsShare: {
          ...prev.threadsShare,
          status: result.status,
          postText: isPublish ? threadsText.trim() : prev.threadsShare?.postText,
          permalink: result.permalink || prev.threadsShare?.permalink,
          threadsPostId: result.postId || prev.threadsShare?.threadsPostId,
          lastError: result.lastError || null,
        },
      }));
      notifySuccess(
        isPublish
          ? "已發布到 Threads"
          : action === "recover"
            ? "已解除逾時狀態，確認 Threads 貼文後可手動重試"
            : "已略過 Threads 發布"
      );
      loadCards();
    } catch (err) {
      notifyError(err.message || "Threads 操作失敗");
      await openEditor(detail.id);
    } finally {
      setThreadsActionLoading(false);
    }
  }, [confirmAction, detail?.id, loadCards, notifyError, notifySuccess, openEditor, threadsActionLoading, threadsText]);

  const handleEditField = useCallback((key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  }, []);

  const handleSaveEditor = useCallback(async () => {
    if (!editorId) return;

    const title = form.title.trim();
    if (!title) {
      notifyError("標題為必填");
      return;
    }

    const categoryId = Number(form.categoryId);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      notifyError("分類為必填");
      return;
    }

    const payload = {
      title,
      description: form.description.trim(),
      image: form.image.trim(),
      alt: form.alt,
      detailsHref: form.detailsHref.trim(),
      voiceHref: form.voiceHref,
      categoryId,
      isBlocked: Boolean(form.isBlocked),
    };

    try {
      setEditorSaving(true);
      const res = await fetch(`/api/admin/prayfor/${editorId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.message || "更新禱告事項失敗");
      }

      const updated = await res.json();
      const nextForm = mapDetailToForm(updated);
      setDetail(updated);
      setForm(nextForm);
      setOriginalForm(nextForm);
      setCards((prev) =>
        prev.map((item) =>
          item.id === updated.id
            ? {
                ...item,
                title: updated.title,
                isBlocked: updated.isBlocked,
                reportCount: updated.reportCount,
                owner: updated.owner || item.owner,
                createdAt: updated.createdAt,
                updatedAt: updated.updatedAt,
              }
            : item,
        ),
      );

      notifySuccess("禱告事項已更新");
    } catch (err) {
      notifyError(err.message || "更新禱告事項失敗");
    } finally {
      setEditorSaving(false);
    }
  }, [editorId, form, notifyError, notifySuccess]);

  useEffect(() => {
    loadCards();
  }, [loadCards]);

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
          <h1>禱告事項</h1>
        </div>
        <div className="admin-section__filters">
          <input
            type="search"
            placeholder="搜尋標題、描述"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
          >
            <option value="all">全部</option>
            <option value="active">啟用中</option>
            <option value="blocked">封鎖中</option>
            <option value="review">待審</option>
            <option value="private">私密</option>
            <option value="threads">待 Threads 審閱</option>
          </select>
          <select value={sort} onChange={(e) => setSort(e.target.value)}>
            <option value="createdAt">建立時間</option>
            <option value="reportCount">檢舉數</option>
          </select>
          <select value={order} onChange={(e) => setOrder(e.target.value)}>
            <option value="desc">新到舊</option>
            <option value="asc">舊到新</option>
          </select>
        </div>
      </header>

      <AdminHintPanel
        title="管理提醒"
        tone="warning"
        description="點擊 ID 可以查看前台呈現與內容細節，也可以直接在彈窗內編輯並儲存。"
        items={[
          "封鎖狀態可以在列表按鈕與彈窗內同步操作。",
          "建議先確認分類、連結與封面後再儲存，避免前台顯示異常。",
        ]}
      />

      {loading ? (
        <p>載入中...</p>
      ) : loadError ? <div role="alert"><p>{loadError}</p><button type="button" onClick={loadCards}>重新載入</button></div> : (
        <>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>標題</th>
                  <th>作者</th>
                  <th>狀態</th>
                  <th>回應</th>
                  <th>檢舉數</th>
                  <th>建立時間</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {cards.length === 0 ? (
                  <tr>
                    <td colSpan={8}>目前沒有資料</td>
                  </tr>
                ) : (
                  cards.map((card) => (
                    <tr key={card.id}>
                      <td>
                        <button type="button" className="link-button" onClick={() => openEditor(card.id)}>
                          {card.id}
                        </button>
                      </td>
                      <td>{card.title}</td>
                      <td>{renderAuthor(card, openLinkedUser)}</td>
                      <td>
                        {card.isBlocked ? (
                          <span className="status-badge status-badge--blocked">封鎖中</span>
                        ) : (
                          <span className="status-badge status-badge--active">啟用中</span>
                        )}
                        {card.needsReview ? <span className="status-badge">待審</span> : null}
                        {card.isPrivate ? <span className="status-badge">私密</span> : null}
                        {card.threadsShare ? (
                          <span className="status-badge">
                            Threads：{{ PENDING: "待審閱", PUBLISHING: "發布中", PUBLISHED: "已發布", FAILED: "發布失敗", SKIPPED: "已略過" }[card.threadsShare.status] || "待處理"}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        {card.responseCount > 0 ? (
                          `${card.responseCount} 人`
                        ) : (
                          <span style={{ color: "var(--text-muted)" }}>還沒有人</span>
                        )}
                      </td>
                      <td>{card.reportCount}</td>
                      <td>{new Date(card.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          type="button"
                          className="link-button"
                          onClick={() => toggleBlock(card.id, !card.isBlocked)}
                          disabled={actionId === card.id}
                        >
                          {actionId === card.id ? "處理中..." : card.isBlocked ? "解除封鎖" : "封鎖"}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="pagination">
            <button onClick={() => setPage((p) => Math.max(p - 1, 1))} disabled={page === 1}>
              上一頁
            </button>
            <span>
              {page} / {pagination.totalPages || 1}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(p + 1, pagination.totalPages || 1))}
              disabled={page === (pagination.totalPages || 1)}
            >
              下一頁
            </button>
          </div>
        </>
      )}

      {editorOpen ? (
        <div className="admin-editor" role="dialog" aria-modal="true" aria-label="禱告事項編輯">
          <div className="admin-editor__backdrop" onClick={requestCloseEditor} />
          <section className="admin-editor__dialog">
            <header className="admin-editor__header">
              <div>
                <p className="admin-editor__eyebrow">禱告事項管理</p>
                <h3>{editorId ? `禱告事項 #${editorId}` : "禱告事項"}</h3>
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
                  <div className="admin-editor__preview-media">
                    {detail?.image ? <img src={detail.image} alt={detail.alt || detail.title || "封面"} /> : <span>無封面圖</span>}
                  </div>
                  <div className="admin-editor__preview-content">
                    <h4>{detail?.title || "未命名禱告事項"}</h4>
                    <p>{detail?.description || "（無描述）"}</p>
                    <div className="admin-editor__preview-meta">
                      <span>
                        作者：{detail?.owner?.name || detail?.owner?.email || "未知"}
                        {detail?.owner?.id ? (
                          <button
                            type="button"
                            className="link-button admin-editor__inline-action"
                            onClick={() => openLinkedUser(detail.owner.id, "作者")}
                          >
                            編輯作者
                          </button>
                        ) : null}
                      </span>
                      <span>分類：{detail?.category?.name || "未分類"}</span>
                      <span>檢舉數：{detail?.reportCount ?? 0}</span>
                      <span>回應數：{detail?._count?.responses ?? 0}</span>
                      <span>建立：{detail?.createdAt ? new Date(detail.createdAt).toLocaleString() : "-"}</span>
                      <span>更新：{detail?.updatedAt ? new Date(detail.updatedAt).toLocaleString() : "-"}</span>
                    </div>
                    {detail?.id ? (
                      <a className="admin-editor__preview-link" href={`/prayfor/${detail.id}`} target="_blank" rel="noreferrer">
                        開啟前台頁面
                      </a>
                    ) : null}
                  </div>
                </section>

                {detail?.threadsShare ? (
                  <section className="admin-editor__form" aria-labelledby="threads-share-title">
                    <h4 id="threads-share-title">Threads 分享審閱</h4>
                    <p>
                      使用者已於 {new Date(detail.threadsShare.consentedAt).toLocaleString()} 同意提交審閱。
                      預覽會帶入代禱標題與公開連結，不會自動帶入內文。請先確認標題沒有可識別或敏感資訊。
                    </p>
                    <label className="admin-editor__field admin-editor__field--full">
                      <span>Threads 貼文預覽（最多 500 字）</span>
                      <textarea
                        rows={5}
                        maxLength={500}
                        value={threadsText}
                        onChange={(event) => setThreadsText(event.target.value)}
                        disabled={!['PENDING', 'FAILED'].includes(detail.threadsShare.status) || threadsActionLoading}
                      />
                    </label>
                    <p role="status">
                      狀態：{{ PENDING: "待管理員審閱", PUBLISHING: "發布中", PUBLISHED: "已發布", FAILED: "發布失敗，可重試", SKIPPED: "已略過" }[detail.threadsShare.status] || detail.threadsShare.status}
                      {detail.threadsShare.attempts ? ` · 嘗試 ${detail.threadsShare.attempts} 次` : ""}
                    </p>
                    {detail.threadsShare.lastError ? <p role="alert">上次錯誤：{detail.threadsShare.lastError}</p> : null}
                    {detail.threadsShare.permalink ? (
                      <p><a href={detail.threadsShare.permalink} target="_blank" rel="noreferrer">查看 Threads 貼文</a></p>
                    ) : null}
                    {detail.threadsShare.status === "PUBLISHED" ? null : detail.threadsShare.status === "SKIPPED" ? null : detail.threadsShare.status === "PUBLISHING" ? (
                      <div className="admin-editor__actions">
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => handleThreadsAction("recover")}
                          disabled={threadsActionLoading}
                        >
                          {threadsActionLoading ? "檢查中..." : "檢查逾時發布"}
                        </button>
                      </div>
                    ) : (
                      <div className="admin-editor__actions">
                        <button
                          type="button"
                          className="button button--ghost"
                          onClick={() => handleThreadsAction("skip")}
                          disabled={threadsActionLoading}
                        >
                          略過發布
                        </button>
                        <button
                          type="button"
                          className="button button--primary"
                          onClick={() => handleThreadsAction("publish")}
                          disabled={
                            threadsActionLoading ||
                            !threadsText.trim() ||
                            detail.isPrivate ||
                            detail.isBlocked ||
                            detail.needsReview
                          }
                        >
                          {threadsActionLoading ? "處理中..." : detail.threadsShare.status === "FAILED" ? "重試發布" : "發布到 Threads"}
                        </button>
                      </div>
                    )}
                    {detail.needsReview ? <p>請先完成這張代禱卡的內容審核，才能發布到 Threads。</p> : null}
                    {detail.isPrivate || detail.isBlocked ? <p>私密或已封鎖的代禱不能發布到 Threads。</p> : null}
                  </section>
                ) : null}

                <section className="admin-editor__form">
                  <div className="admin-editor__grid">
                    <label className="admin-editor__field admin-editor__field--full">
                      <span>標題</span>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(event) => handleEditField("title", event.target.value)}
                        placeholder="請輸入標題"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>描述</span>
                      <textarea
                        rows={4}
                        value={form.description}
                        onChange={(event) => handleEditField("description", event.target.value)}
                        placeholder="請輸入描述"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>封面圖片 URL</span>
                      <input
                        type="url"
                        value={form.image}
                        onChange={(event) => handleEditField("image", event.target.value)}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>圖片替代文字 (alt)</span>
                      <input
                        type="text"
                        value={form.alt}
                        onChange={(event) => handleEditField("alt", event.target.value)}
                        placeholder="封面圖說明"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>前台詳細連結</span>
                      <input
                        type="text"
                        value={form.detailsHref}
                        onChange={(event) => handleEditField("detailsHref", event.target.value)}
                        placeholder="/prayfor/{id}"
                      />
                    </label>

                    <label className="admin-editor__field admin-editor__field--full">
                      <span>語音連結 (voiceHref)</span>
                      <input
                        type="url"
                        value={form.voiceHref}
                        onChange={(event) => handleEditField("voiceHref", event.target.value)}
                        placeholder="https://..."
                      />
                    </label>

                    <label className="admin-editor__field">
                      <span>分類</span>
                      <select
                        value={form.categoryId}
                        onChange={(event) => handleEditField("categoryId", event.target.value)}
                      >
                        <option value="">請選擇分類</option>
                        {categories.map((category) => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                            {category.isActive ? "" : "（停用）"}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="admin-editor__checkbox">
                    <input
                      type="checkbox"
                      checked={form.isBlocked}
                      onChange={(event) => handleEditField("isBlocked", event.target.checked)}
                    />
                    <span>封鎖此禱告事項</span>
                  </label>
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
