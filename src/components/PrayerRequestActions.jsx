"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { REPORT_REASONS } from "@/constants/reportReasons";
import { useAuthSession } from "@/hooks/useAuthSession";

function truncate(text, length = 200) {
  const value = typeof text === "string" ? text.trim() : "";
  if (value.length <= length) return value;
  return `${value.slice(0, length).trim()}...`;
}

function buildShareUrl(canonicalUrl) {
  if (typeof window === "undefined") return canonicalUrl || "";
  if (!canonicalUrl) return window.location.href.split("#")[0];
  if (/^https?:\/\//i.test(canonicalUrl)) return canonicalUrl;
  return `${window.location.origin}${canonicalUrl}`;
}

export default function PrayerRequestActions({
  cardId,
  canonicalUrl,
  title,
  description,
  reportCount: initialReportCount = 0,
  shareLabel = "分享代禱",
}) {
  const authUser = useAuthSession();
  const menuRef = useRef(null);

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [reportRemarks, setReportRemarks] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportError, setReportError] = useState("");
  const [reportFeedback, setReportFeedback] = useState("");
  const [reportCount, setReportCount] = useState(Number(initialReportCount) || 0);
  const [notice, setNotice] = useState("");
  const [noticeType, setNoticeType] = useState("success");

  const previewDescription = useMemo(() => truncate(description, 200), [description]);

  useEffect(() => {
    if (!isMenuOpen) return undefined;
    const handlePointerDown = (event) => {
      if (!menuRef.current || menuRef.current.contains(event.target)) return;
      setIsMenuOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const closeReportModal = useCallback(() => {
    if (reportSubmitting) return;
    setIsModalOpen(false);
    setReportReason("");
    setReportRemarks("");
    setReportError("");
    setReportFeedback("");
  }, [reportSubmitting]);

  const openReportModal = useCallback(() => {
    setIsMenuOpen(false);
    if (!authUser) {
      setNotice("請先登入後再檢舉。");
      setNoticeType("error");
      return;
    }
    setIsModalOpen(true);
    setReportReason("");
    setReportRemarks("");
    setReportError("");
    setReportFeedback("");
  }, [authUser]);

  const handleShare = useCallback(async () => {
    if (typeof window === "undefined") return;
    setIsMenuOpen(false);

    const shareUrl = buildShareUrl(canonicalUrl);
    const shareText = title || "邀請你一起關心這則代禱";

    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title || title || "Start Pray",
          text: shareText,
          url: shareUrl,
        });
        setNotice("分享連結已準備好，可以邀請小組一起守望。");
        setNoticeType("success");
        return;
      }

      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
        setNotice("連結已複製，可以貼到小組或私訊中。");
        setNoticeType("success");
        return;
      }

      const textarea = document.createElement("textarea");
      textarea.value = shareUrl;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "absolute";
      textarea.style.left = "-9999px";
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand("copy");
        setNotice("連結已複製，可以貼到小組或私訊中。");
        setNoticeType("success");
      } finally {
        textarea.remove();
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      setNotice("目前無法分享，請稍後再試。");
      setNoticeType("error");
    }
  }, [canonicalUrl, title]);

  const handleReportSubmit = useCallback(
    async (event) => {
      event.preventDefault();
      if (!reportReason) {
        setReportError("請選擇檢舉理由。");
        return;
      }

      setReportSubmitting(true);
      setReportError("");
      setReportFeedback("");

      try {
        const response = await fetch("/api/prayfor/report", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            cardId,
            reason: reportReason,
            remarks: reportRemarks,
          }),
        });

        if (!response.ok) {
          const data = await response.json().catch(() => ({}));
          throw new Error(data?.message || "檢舉失敗，請稍後再試。");
        }

        setReportCount((prev) => prev + 1);
        setReportFeedback("已收到檢舉，管理員會盡快審核。");
        window.setTimeout(() => {
          closeReportModal();
        }, 1500);
      } catch (error) {
        setReportError(error?.message || "檢舉失敗，請稍後再試。");
      } finally {
        setReportSubmitting(false);
      }
    },
    [cardId, closeReportModal, reportReason, reportRemarks]
  );

  return (
    <div className="pray-actions">
      {notice ? (
        <p
          className={`cp-alert ${
            noticeType === "error" ? "cp-alert--error" : "cp-alert--success"
          } pray-actions__notice`}
          role="status"
        >
          {noticeType === "error" ? (
            <>
              {notice} <Link href="/login">前往登入</Link>
            </>
          ) : (
            notice
          )}
        </p>
      ) : null}

      <div className="pray-actions__row" ref={menuRef}>
        <button type="button" className="pdv2-share-btn" onClick={handleShare}>
          {shareLabel}
        </button>
        <div className={`pray-actions__menu${isMenuOpen ? " is-open" : ""}`}>
          <button
            type="button"
            className="pdv2-more-btn"
            aria-label="更多代禱操作"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            aria-controls="pray-actions-menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            ...
          </button>
          {isMenuOpen ? (
            <div className="pdv2-action-menu" id="pray-actions-menu" role="menu">
              {reportCount > 0 ? (
                <span className="pdv2-action-menu__meta">已被檢舉 {reportCount} 次</span>
              ) : null}
              <button
                type="button"
                role="menuitem"
                className="pdv2-action-menu__item pdv2-action-menu__item--danger"
                onClick={openReportModal}
              >
                檢舉這則代禱
              </button>
            </div>
          ) : null}
        </div>
      </div>

      {isModalOpen ? (
        <div className="comment-report-modal" role="dialog" aria-modal="true">
          <div className="comment-report-modal__backdrop" onClick={closeReportModal} />
          <div className="comment-report-modal__card">
            <button
              type="button"
              className="comment-report-modal__close"
              onClick={closeReportModal}
              disabled={reportSubmitting}
              aria-label="關閉檢舉視窗"
            >
              ×
            </button>
            <h4>檢舉代禱內容</h4>
            <p className="comment-report-modal__hint">
              請選擇檢舉理由。若願意，可補充讓管理員判斷的原因。
            </p>
            <div className="comment-report-modal__preview">
              <p className="comment-report-modal__preview-label">檢舉對象</p>
              <strong>{title || "未命名代禱"}</strong>
              {previewDescription ? (
                <p className="comment-report-modal__preview-message">{previewDescription}</p>
              ) : (
                <p className="comment-report-modal__preview-message muted">這則代禱沒有額外說明。</p>
              )}
            </div>
            <form onSubmit={handleReportSubmit} className="comment-report-modal__form">
              <fieldset className="comment-report-modal__fieldset">
                <legend>檢舉理由</legend>
                {REPORT_REASONS.map((reason) => (
                  <label key={reason.value} className="comment-report-modal__reason">
                    <input
                      type="radio"
                      name="prayReportReason"
                      value={reason.value}
                      checked={reportReason === reason.value}
                      onChange={(event) => setReportReason(event.target.value)}
                      disabled={reportSubmitting}
                    />
                    <span>{reason.label}</span>
                  </label>
                ))}
              </fieldset>

              <label className="comment-report-modal__remarks">
                <span>補充說明（選填）</span>
                <textarea
                  value={reportRemarks}
                  onChange={(event) => setReportRemarks(event.target.value)}
                  rows={4}
                  placeholder="若願意，可補充讓管理員判斷的原因。"
                  disabled={reportSubmitting}
                />
              </label>

              {reportError ? <p className="cp-alert cp-alert--error">{reportError}</p> : null}
              {reportFeedback ? <p className="cp-alert cp-alert--success">{reportFeedback}</p> : null}

              <div className="comment-report-modal__actions">
                <button
                  type="button"
                  className="cp-button cp-button--ghost"
                  onClick={closeReportModal}
                  disabled={reportSubmitting}
                >
                  取消
                </button>
                <button type="submit" className="cp-button" disabled={reportSubmitting}>
                  {reportSubmitting ? "送出中..." : "送出檢舉"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
