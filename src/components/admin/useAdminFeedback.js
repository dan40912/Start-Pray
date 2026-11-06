"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

let nextToastId = 1;

function createToast(type, message, options = {}) {
  return {
    id: nextToastId++,
    type,
    message,
    title: options.title || "",
    duration: Number.isFinite(options.duration) ? options.duration : 3200,
  };
}

export function useAdminFeedback() {
  const [toasts, setToasts] = useState([]);
  const timersRef = useRef(new Map());
  const [confirmState, setConfirmState] = useState(null);
  const confirmPanelRef = useRef(null);
  const isConfirmOpen = Boolean(confirmState);

  const dismissToast = useCallback((id) => {
    const timer = timersRef.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timersRef.current.delete(id);
    }
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (type, message, options = {}) => {
      const toast = createToast(type, message, options);
      setToasts((prev) => [...prev, toast]);

      const timer = setTimeout(() => {
        dismissToast(toast.id);
      }, toast.duration);

      timersRef.current.set(toast.id, timer);
      return toast.id;
    },
    [dismissToast],
  );

  const notifySuccess = useCallback((message, options = {}) => notify("success", message, options), [notify]);
  const notifyError = useCallback((message, options = {}) => notify("error", message, options), [notify]);
  const notifyInfo = useCallback((message, options = {}) => notify("info", message, options), [notify]);
  const notifyWarning = useCallback((message, options = {}) => notify("warning", message, options), [notify]);

  const confirmAction = useCallback((options = {}) => {
    return new Promise((resolve) => {
      setConfirmState((prev) => {
        if (prev?.resolve) {
          prev.resolve(false);
        }

        return {
          title: options.title || "確認操作",
          message: options.message || "這項操作會影響目前資料，請確認對象與影響。",
          confirmText: options.confirmText || "確認",
          cancelText: options.cancelText || "取消",
          tone: options.tone || "warning",
          requireReason: Boolean(options.requireReason),
          reason: "",
          resolve,
        };
      });
    });
  }, []);

  const closeConfirm = useCallback((accepted) => {
    setConfirmState((prev) => {
      if (accepted && prev?.requireReason && prev.reason.trim().length < 5) return prev;
      if (prev?.resolve) {
        prev.resolve(accepted ? (prev.requireReason ? prev.reason.trim() : true) : false);
      }
      return null;
    });
  }, []);

  useEffect(() => {
    if (!isConfirmOpen) return;
    const previousFocus = document.activeElement;
    const panel = confirmPanelRef.current;
    const controls = () => [...panel.querySelectorAll("button:not(:disabled), textarea, input")];
    controls()[0]?.focus();
    const onKey = (event) => {
      if (event.key === "Escape") { event.preventDefault(); closeConfirm(false); }
      if (event.key !== "Tab") return;
      const nodes = controls();
      const first = nodes[0], last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    panel.addEventListener("keydown", onKey);
    return () => { panel.removeEventListener("keydown", onKey); previousFocus?.focus(); };
  }, [isConfirmOpen, closeConfirm]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current.clear();
      setConfirmState((prev) => {
        if (prev?.resolve) {
          prev.resolve(false);
        }
        return null;
      });
    };
  }, []);

  const feedbackNode = useMemo(
    () => (
      <>
        <div className="admin-toast-viewport" role="status" aria-live="polite">
          {toasts.map((toast) => (
            <article key={toast.id} className={`admin-toast admin-toast--${toast.type}`}>
              <div className="admin-toast__content">
                {toast.title ? <strong>{toast.title}</strong> : null}
                <p>{toast.message}</p>
              </div>
              <button
                type="button"
                className="admin-toast__close"
                aria-label="關閉通知"
                onClick={() => dismissToast(toast.id)}
              >
                ×
              </button>
            </article>
          ))}
        </div>

        {confirmState ? (
          <div className="admin-confirm-dialog" role="dialog" aria-modal="true" aria-label={confirmState.title}>
            <div className="admin-confirm-dialog__backdrop" onClick={() => closeConfirm(false)} />
            <div ref={confirmPanelRef} className={`admin-confirm-dialog__panel admin-confirm-dialog__panel--${confirmState.tone}`}>
              <h3>{confirmState.title}</h3>
              <p>{confirmState.message}</p>
              {confirmState.requireReason ? (
                <label className="admin-confirm-dialog__reason">
                  <span>處置理由（5–500 字，僅供內部稽核）</span>
                  <textarea rows={3} maxLength={500} value={confirmState.reason}
                    onChange={(event) => setConfirmState((prev) => prev ? { ...prev, reason: event.target.value } : prev)} />
                </label>
              ) : null}
              <div className="admin-confirm-dialog__actions">
                <button type="button" className="button button--ghost" onClick={() => closeConfirm(false)}>
                  {confirmState.cancelText}
                </button>
                <button type="button" className="button button--primary" disabled={confirmState.requireReason && confirmState.reason.trim().length < 5} onClick={() => closeConfirm(true)}>
                  {confirmState.confirmText}
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    ),
    [closeConfirm, confirmState, dismissToast, toasts],
  );

  return {
    feedbackNode,
    confirmAction,
    notify,
    notifySuccess,
    notifyError,
    notifyInfo,
    notifyWarning,
  };
}

