"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";

import { useAuthSession } from "@/hooks/useAuthSession";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { buildOvercomerSlug } from "@/lib/overcomer";

import { REPORT_REASONS } from "@/constants/reportReasons";

const MAX_AUDIO_BYTES = 12 * 1024 * 1024;
const ACCEPTED_AUDIO_TYPES = "audio/webm,audio/mpeg,audio/mp4,audio/aac,audio/ogg,audio/wav,.webm,.mp3,.m4a,.aac,.ogg,.wav";

// ===== Shared helpers =====
function formatMessage(template, values = {}) {
  return String(template || "").replace(/\{(\w+)\}/g, (_, key) => values[key] ?? "");
}

function getDisplayName(response, text) {
  if (response.isAnonymous) return text.anonymousResponder;
  return response.responder?.name || response.responder?.username || text.unnamed;
}
function getAvatarUrl(response) {
  return response.responder?.avatarUrl || null;
}
function getAvatarFallback(name) {
  const initial = name?.trim()?.charAt(0) || "祈";
  return initial.toUpperCase();
}

function getResponderProfileHref(response) {
  if (!response || response.isAnonymous) return null;
  const responder = response.responder;
  if (!responder || responder.isBlocked || responder.publicProfileEnabled === false) {
    return null;
  }
  const slug = buildOvercomerSlug(responder);
  if (!slug) return null;
  return `/overcomer/${encodeURIComponent(slug)}`;
}

function buildLoginHref(requestId, locale = "zh-TW") {
  return `${localizePath("/login", locale)}?next=${encodeURIComponent(`/prayfor/${String(requestId)}`)}`;
}

async function readResponseError(response, text) {
  const data = await response.json().catch(() => ({}));
  const retryAfterHeader = response.headers.get("Retry-After");
  const retryAfterSeconds = Number(data?.retryAfterSeconds ?? retryAfterHeader ?? 0);

  if (response.status === 401) {
    return {
      message: data?.error || text.loginRequired,
      needsLogin: true,
      retryAfterSeconds: 0,
    };
  }

  if (response.status === 429 && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
    return {
      message: data?.error || formatMessage(text.cooldown, { minutes }),
      needsLogin: false,
      retryAfterSeconds,
    };
  }

  return {
    message: data?.error || data?.message || text.responseFailed,
    needsLogin: false,
    retryAfterSeconds: 0,
  };
}

// ===== Component =====
export default function Comments({ requestId, locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const commentsText = getDictionary(locale).comments;
  const authUser = useAuthSession();

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [text, setText] = useState("");
  const [audioFile, setAudioFile] = useState(null);
  const [audioInputKey, setAudioInputKey] = useState(0);
  const [responseMode, setResponseMode] = useState("prayer");
  const [responses, setResponses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [reportTarget, setReportTarget] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportRemarks, setReportRemarks] = useState("");
  const [reportSubmitting, setReportSubmitting] = useState(false);
  const [reportFeedback, setReportFeedback] = useState("");
  const [reportError, setReportError] = useState("");
  const [actionNotice, setActionNotice] = useState("");
  const [actionNoticeType, setActionNoticeType] = useState("success");
  const [actionNoticeLoginHref, setActionNoticeLoginHref] = useState("");
  const [openActionMenuId, setOpenActionMenuId] = useState(null);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownNow, setCooldownNow] = useState(Date.now());

  const reportTargetName = reportTarget ? getDisplayName(reportTarget, commentsText) : "";
  const reportPreviewMessage = reportTarget?.message
    ? `${reportTarget.message.slice(0, 200)}${reportTarget.message.length > 200 ? '...' : ''}`
    : "";

  const closeReportModal = useCallback(() => {
    if (reportSubmitting) return;
    setReportTarget(null);
    setReportReason("");
    setReportRemarks("");
    setReportError("");
    setReportFeedback("");
  }, [reportSubmitting]);

  const openReportModal = useCallback((response) => {
    if (!authUser) {
      setActionNotice(commentsText.reportLogin);
      setActionNoticeType("error");
      setActionNoticeLoginHref(buildLoginHref(requestId, locale));
      return;
    }
    setReportTarget(response);
    setReportReason("");
    setReportRemarks("");
    setReportError("");
    setReportFeedback("");
  }, [authUser, commentsText.reportLogin, locale, requestId]);

  const toggleActionMenu = useCallback((responseId) => {
    setOpenActionMenuId((prev) => (prev === responseId ? null : responseId));
  }, []);

  const handleShareResponse = useCallback(async (response) => {
    if (typeof window === "undefined") return;
    const baseUrl = window.location.href.split("#")[0];
    const shareUrl = `${baseUrl}#prayer-response-${response.id}`;
    const shareText = response.message ? response.message.slice(0, 120) : commentsText.shareInvite;
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          text: shareText,
          url: shareUrl,
        });
        setActionNotice(commentsText.shareReady);
        setActionNoticeType("success");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setActionNotice(commentsText.linkCopied);
        setActionNoticeType("success");
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = shareUrl;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "absolute";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand("copy");
          setActionNotice(commentsText.linkCopied);
          setActionNoticeType("success");
        } catch (_copyErr) {
          throw new Error(commentsText.shareFailed);
        } finally {
          textarea.remove();
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      setActionNotice(err?.message || commentsText.shareFailed);
      setActionNoticeType("error");
    }
  }, [commentsText]);

  const handleReportSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!reportTarget) {
      setReportError(commentsText.reportMissing);
      return;
    }
    if (!reportReason) {
      setReportError(commentsText.reportReasonRequired);
      return;
    }
    setReportSubmitting(true);
    setReportError("");
    setReportFeedback("");

    try {
      const response = await fetch("/api/prayer-response/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          responseId: reportTarget.id,
          reason: reportReason,
          remarks: reportRemarks,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data?.message || commentsText.reportFailed);
      }

      setResponses((prev) =>
        prev.map((item) =>
          item.id === reportTarget.id
            ? { ...item, reportCount: (item.reportCount || 0) + 1, isBlocked: true, reviewStatus: "pending" }
            : item
        )
      );
      setReportFeedback(commentsText.reportSuccess);
      window.setTimeout(() => {
        closeReportModal();
      }, 1500);
    } catch (err) {
      setReportError(err?.message || commentsText.reportFailed);
    } finally {
      setReportSubmitting(false);
    }
  }, [commentsText, reportTarget, reportReason, reportRemarks, closeReportModal]);

  const [submittingResponse, setSubmittingResponse] = useState(false);

  // Load existing responses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/responses/${requestId}`, { cache: "no-store" });
        if (!res.ok) throw new Error(commentsText.loadFailed);
        const data = await res.json();
        if (!cancelled) {
          setResponses(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || commentsText.loadFailed);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [commentsText.loadFailed, requestId]);

  useEffect(() => {
    const handleKeydown = (event) => {
      if (event.key === "Escape") {
        if (openActionMenuId !== null) {
          setOpenActionMenuId(null);
          return;
        }
        if (reportTarget && !reportSubmitting) {
          closeReportModal();
        }
      }
    };
    document.addEventListener("keydown", handleKeydown);
    return () => document.removeEventListener("keydown", handleKeydown);
  }, [openActionMenuId, reportTarget, reportSubmitting, closeReportModal]);

  useEffect(() => {
    if (openActionMenuId === null) return;
    const handlePointerDown = (event) => {
      if (!(event.target instanceof Element)) return;
      if (event.target.closest(".comment-item__menu-wrap")) return;
      setOpenActionMenuId(null);
    };
    document.addEventListener("mousedown", handlePointerDown);
    document.addEventListener("touchstart", handlePointerDown);
    return () => {
      document.removeEventListener("mousedown", handlePointerDown);
      document.removeEventListener("touchstart", handlePointerDown);
    };
  }, [openActionMenuId]);

  useEffect(() => {
    if (!actionNotice) return;
    const timer = window.setTimeout(() => setActionNotice(""), 2800);
    return () => window.clearTimeout(timer);
  }, [actionNotice]);

  useEffect(() => {
    if (!cooldownUntil || cooldownUntil <= Date.now()) return undefined;
    const timer = window.setInterval(() => setCooldownNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [cooldownUntil]);

  const cooldownRemainingSeconds = Math.max(0, Math.ceil((cooldownUntil - cooldownNow) / 1000));
  const isCoolingDown = cooldownRemainingSeconds > 0;

  const submitResponse = async () => {
    if (submittingResponse) return false;
    if (isCoolingDown) {
      setActionNotice(formatMessage(commentsText.cooldownNotice, { minutes: Math.ceil(cooldownRemainingSeconds / 60) }));
      setActionNoticeType("error");
      setActionNoticeLoginHref("");
      return false;
    }
    if (!text.trim() && !audioFile) return false;
    if (audioFile && Number(audioFile.size) > MAX_AUDIO_BYTES) {
      setActionNotice(commentsText.audioTooLarge);
      setActionNoticeType("error");
      setActionNoticeLoginHref("");
      return false;
    }

    setSubmittingResponse(true);
    setActionNotice("");
    setActionNoticeLoginHref("");

    const formData = new FormData();
    formData.append("requestId", String(requestId));
    formData.append("message", text.trim());
    formData.append("isAnonymous", String(isAnonymous));
    formData.append("responderId", authUser?.id || "");
    if (audioFile) {
      formData.append("audio", audioFile);
    }

    try {
      const res = await fetch("/api/responses", { method: "POST", body: formData });
      if (!res.ok) {
        const details = await readResponseError(res, commentsText);
        if (details.retryAfterSeconds > 0) {
          setCooldownNow(Date.now());
          setCooldownUntil(Date.now() + details.retryAfterSeconds * 1000);
        }
        setActionNotice(details.message);
        setActionNoticeType("error");
        setActionNoticeLoginHref(details.needsLogin ? buildLoginHref(requestId, locale) : "");
        return false;
      }

      const saved = await res.json();
      setResponses((prev) => [saved, ...prev]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED, { detail: saved }));
      }
      setText("");
      setAudioFile(null);
      setAudioInputKey((prev) => prev + 1);
      setResponseMode("prayer");
      setIsAnonymous(false);
      setCooldownNow(Date.now());
      setCooldownUntil(Date.now() + 120 * 1000);
      setActionNotice(audioFile ? commentsText.voiceSuccess : commentsText.textSuccess);
      setActionNoticeType("success");
      setActionNoticeLoginHref("");
      return true;
    } catch (err) {
      setActionNotice(err?.message || commentsText.submitFailed);
      setActionNoticeType("error");
      setActionNoticeLoginHref("");
      return false;
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitResponse();
  };

  const visibleResponses = responses.filter(
    (response) => !response.isBlocked && Number(response.reportCount ?? 0) === 0
  );
  const pendingReviewCount = responses.filter(
    (response) => response.isBlocked || Number(response.reportCount ?? 0) > 0
  ).length;
  const responseModes = [
    { key: "prayer", label: commentsText.modes.prayer[0], placeholder: commentsText.modes.prayer[1] },
    { key: "encouragement", label: commentsText.modes.encouragement[0], placeholder: commentsText.modes.encouragement[1] },
    { key: "testimony", label: commentsText.modes.testimony[0], placeholder: commentsText.modes.testimony[1] },
  ];
  const activeMode = responseModes.find((mode) => mode.key === responseMode) || responseModes[0];

  return (
    <section className="comments card">
      {!authUser && (
        <div className="alert alert-warning">
          {commentsText.loginRequired} <Link href={buildLoginHref(requestId, locale)}>{commentsText.loginAction}</Link>
        </div>
      )}

      <div className="comments__header">
        {pendingReviewCount ? (
          <span className="comments__review-status">{formatMessage(commentsText.reviewCount, { count: pendingReviewCount })}</span>
        ) : null}
        <h3>{commentsText.title}</h3>
        <p className="comments__subtitle">{commentsText.subtitle}</p>
      </div>

      {actionNotice ? (
        <p
          className={`cp-alert ${
            actionNoticeType === "error" ? "cp-alert--error" : "cp-alert--success"
          } comments__notice`}
          role="status"
        >
          {actionNoticeLoginHref ? (
            <>
              {actionNotice} <Link href={actionNoticeLoginHref}>{commentsText.loginAction}</Link>
            </>
          ) : (
            actionNotice
          )}
        </p>
      ) : null}

      <div className="comments__list" aria-live="polite">
          {loading ? (
            <p>{commentsText.loading}</p>
          ) : error ? (
            <p className="cp-alert cp-alert--error">{error}</p>
          ) : visibleResponses.length === 0 ? (
            <p className="cp-helper">{commentsText.empty}</p>
          ) : (
            visibleResponses.map((response) => {
                const name = getDisplayName(response, commentsText);
                const avatarUrl = getAvatarUrl(response);
                const avatarFallback = getAvatarFallback(name);
                const profileHref = getResponderProfileHref(response);
                const isActionMenuOpen = openActionMenuId === response.id;
                return (
                  <article
                    key={response.id}
                    id={`prayer-response-${response.id}`}
                    className={`comment-item${response.reportCount > 0 ? " has-reports" : ""}`}
                  >
                    <div className="comment-item__header">
                        <div className="comment-item__identity">
                          {profileHref ? (
                            <Link href={profileHref} prefetch={false} className="comment-item__avatar-link">
                                <div className="comment-item__avatar" aria-hidden>
                                  {avatarUrl ? (
                                    <img src={avatarUrl} alt={name} loading="lazy" />
                                  ) : (
                                    <span>{avatarFallback}</span>
                                  )}
                                </div>
                            </Link>
                          ) : (
                            <div className="comment-item__avatar" aria-hidden>
                                {avatarUrl ? (
                                  <img src={avatarUrl} alt={name} loading="lazy" />
                                ) : (
                                  <span>{avatarFallback}</span>
                                )}
                            </div>
                          )}
                          {profileHref ? (
                            <Link href={profileHref} prefetch={false} className="comment-item__name">
                                {name}
                            </Link>
                          ) : (
                            <strong>{name}</strong>
                          )}
                        </div>
                        <div className="comment-item__meta-actions">
                          {response.reportCount > 0 ? (
                            <span
                              className="comment-item__report-badge"
                              title={formatMessage(commentsText.reportBadge, { count: response.reportCount })}
                            >
                              {formatMessage(commentsText.reportBadgeShort, { count: response.reportCount })}
                            </span>
                          ) : null}
                          <div className="comment-item__actions">
                            <button
                              type="button"
                              className="comment-item__action-btn comment-item__action-btn--share"
                              onClick={() => handleShareResponse(response)}
                            >
                              {commentsText.share}
                            </button>
                            <div className={`comment-item__menu-wrap${isActionMenuOpen ? " is-open" : ""}`}>
                              <button
                                type="button"
                                className="comment-item__menu-trigger"
                                aria-label={commentsText.moreActions}
                                aria-haspopup="menu"
                                aria-expanded={isActionMenuOpen}
                                aria-controls={`comment-action-menu-${response.id}`}
                                onClick={() => toggleActionMenu(response.id)}
                              >
                                ...
                              </button>
                              {isActionMenuOpen ? (
                                <div
                                  id={`comment-action-menu-${response.id}`}
                                  className="comment-item__action-menu"
                                  role="menu"
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    className="comment-item__action-menu-item comment-item__action-menu-item--danger"
                                    onClick={() => {
                                      setOpenActionMenuId(null);
                                      openReportModal(response);
                                    }}
                                  >
                                    {commentsText.reportThis}
                                  </button>
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                    </div>
                    {response.message ? <p>{response.message}</p> : null}
                    {response.voiceUrl ? (
                        <div className="comment-item__audio">
                          <audio src={response.voiceUrl} controls preload="metadata" />
                        </div>
                    ) : null}
                  </article>
                );
            })
          )}
        </div>
      {authUser ? (
        <>
          <h3 className="comments__composer-title">{commentsText.composerTitle}</h3>
          <form className="comment-form" id="response-composer" onSubmit={handleSubmit}>
            <div className="prayer-response-modes" aria-label={commentsText.modeLabel}>
              {responseModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={responseMode === mode.key ? "is-active" : ""}
                  onClick={async () => {
                    setResponseMode(mode.key);
                    if (mode.key === "encouragement" && !text.trim()) {
                      setText(commentsText.modes.encouragement[2]);
                    }
                    if (mode.key === "testimony" && !text.trim()) {
                      setText(commentsText.modes.testimony[2]);
                    }
                  }}
                >
                  {mode.label}
                </button>
              ))}
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={isAnonymous}
                onChange={(event) => setIsAnonymous(event.target.checked)}
              />
              {commentsText.anonymousPost}
            </label>

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={audioFile ? commentsText.textPlaceholderWithAudio : activeMode.placeholder}
              rows={4}
            />
            <label className="comment-form__audio">
              <span>{commentsText.audioLabel}</span>
              <input
                key={audioInputKey}
                type="file"
                accept={ACCEPTED_AUDIO_TYPES}
                onChange={(event) => {
                  const file = event.target.files?.[0] || null;
                  setAudioFile(file);
                  if (file && Number(file.size) > MAX_AUDIO_BYTES) {
                    setActionNotice(commentsText.audioTooLargeShort);
                    setActionNoticeType("error");
                    setActionNoticeLoginHref("");
                  }
                }}
              />
              <small>
                {commentsText.audioHelp}
              </small>
              {audioFile ? (
                <button
                  type="button"
                  className="comment-form__clear-audio"
                  onClick={() => {
                    setAudioFile(null);
                    setAudioInputKey((prev) => prev + 1);
                  }}
                >
                  {formatMessage(commentsText.removeAudio, { name: audioFile.name })}
                </button>
              ) : null}
            </label>
            <div className="record-toolbar">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submittingResponse || isCoolingDown || (!text.trim() && !audioFile)}
                style={{ marginTop: "10px" }}
              >
                {submittingResponse ? commentsText.submitting : isCoolingDown ? formatMessage(commentsText.waitSeconds, { seconds: cooldownRemainingSeconds }) : commentsText.submit}
              </button>
            </div>
          </form>
        </>
      ) : null}


        {reportTarget ? (
        <div className="comment-report-modal" role="dialog" aria-modal="true">
          <div className="comment-report-modal__backdrop" onClick={closeReportModal} />
          <div className="comment-report-modal__card">
            <button
              type="button"
              className="comment-report-modal__close"
              onClick={closeReportModal}
              disabled={reportSubmitting}
              aria-label={commentsText.closeReport}
            >
              ×
            </button>
            <h4>{commentsText.reportTitle}</h4>
            <p className="comment-report-modal__hint">
              {commentsText.reportHint}
            </p>
            <div className="comment-report-modal__preview">
              <p className="comment-report-modal__preview-label">{commentsText.reportTarget}</p>
              <strong>{reportTargetName || commentsText.unnamed}</strong>
              {reportPreviewMessage ? (
                <p className="comment-report-modal__preview-message">{reportPreviewMessage}</p>
              ) : (
                <p className="comment-report-modal__preview-message muted">{commentsText.noMessage}</p>
              )}
            </div>
            <form onSubmit={handleReportSubmit} className="comment-report-modal__form">
              <fieldset className="comment-report-modal__fieldset">
                <legend>{commentsText.reportReasonLegend}</legend>
                {REPORT_REASONS.map((reason) => (
                  <label key={reason.value} className="comment-report-modal__reason">
                    <input
                      type="radio"
                      name="reportReason"
                      value={reason.value}
                      checked={reportReason === reason.value}
                      onChange={(event) => setReportReason(event.target.value)}
                      disabled={reportSubmitting}
                    />
                    <span>{commentsText.reportReasons[reason.value] || reason.label}</span>
                  </label>
                ))}
              </fieldset>

              <label className="comment-report-modal__remarks">
                <span>{commentsText.remarksLabel}</span>
                <textarea
                  value={reportRemarks}
                  onChange={(event) => setReportRemarks(event.target.value)}
                  rows={4}
                  placeholder={commentsText.remarksPlaceholder}
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
                  {commentsText.cancel}
                </button>
                <button type="submit" className="cp-button" disabled={reportSubmitting}>
                  {reportSubmitting ? commentsText.reportSubmitting : commentsText.reportSubmit}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

    </section>
  );
}
