"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { useAuthSession } from "@/hooks/useAuthSession";
import { PRAYER_RESPONSE_CREATED } from "@/lib/events";
import { buildOvercomerSlug } from "@/lib/overcomer";

import { REPORT_REASONS } from "@/constants/reportReasons";

// ===== Recorder debug helpers =====
const DEBUG = false;
const DEBUG_TAG = "[Recorder]";
function logDebug(...args) {
  if (!DEBUG) return;
  const ts = new Date().toLocaleTimeString("zh-TW", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  });
  // eslint-disable-next-line no-console
  console.log(DEBUG_TAG, `[${ts}]`, ...args);
}

// ===== Recording configuration =====
const MAX_RECORD_SECONDS = 120;
const COUNTDOWN_START = 3;
const DEFAULT_SAMPLE_RATE = 16000;
const DEFAULT_BITRATE = 128000;
const SAME_CARD_RESPONSE_COOLDOWN_SECONDS = 120;

// Prefer WebM/Opus when supported, then fall back through safer recorder formats.
const RECORDING_FORMATS = [
  { mimeType: "audio/webm;codecs=opus", extension: "webm" },
  { mimeType: "audio/webm", extension: "webm" },
  { mimeType: "audio/ogg;codecs=opus", extension: "ogg" },
  { mimeType: "audio/mp4;codecs=mp4a.40.2", extension: "m4a" },
  { mimeType: "audio/mpeg", extension: "mp3" },
  { mimeType: "", extension: "webm" },
];

function resolveRecordingFormat() {
  if (typeof window === "undefined" || typeof MediaRecorder === "undefined") {
    return RECORDING_FORMATS[0];
  }
  for (const format of RECORDING_FORMATS) {
    if (!format.mimeType || MediaRecorder.isTypeSupported(format.mimeType)) {
      return format;
    }
  }
  return { mimeType: "", extension: "webm" };
}

function getExtensionFromMime(mime = "") {
  const value = mime.toLowerCase();
  if (value.includes("mpeg")) return "mp3";
  if (value.includes("mp4")) return "m4a";
  if (value.includes("ogg")) return "ogg";
  if (value.includes("webm")) return "webm";
  const parts = value.split("/");
  return parts[1]?.split(";")[0] || "webm";
}

function createMediaRecorderWithFallback(stream) {
  const format = resolveRecordingFormat();
  const options = format.mimeType
    ? { mimeType: format.mimeType, audioBitsPerSecond: DEFAULT_BITRATE }
    : {};

  let recorder;
  try {
    recorder = new MediaRecorder(stream, options);
  } catch (e) {
    // Retry without forcing mimeType when the preferred option is rejected.
    recorder = new MediaRecorder(stream);
    // Use the recorder's actual mimeType so the extension matches the output.
    format.mimeType = recorder.mimeType;
    format.extension = getExtensionFromMime(recorder.mimeType);
  }

  logDebug("MediaRecorder created with options:", options, "->", format);
  return { recorder, format, options };
}

// ===== Shared helpers =====
function formatSeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
}
function getDisplayName(response) {
  if (response.isAnonymous) return "匿名代禱者";
  return response.responder?.name || response.responder?.email || "未命名";
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

// ===== Component =====
export default function Comments({ requestId, ownerId = null }) {
  const authUser = useAuthSession();

  const ownerIdValue = ownerId ? String(ownerId) : null;

  const [isAnonymous, setIsAnonymous] = useState(false);
  const [text, setText] = useState("");
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
  const [openActionMenuId, setOpenActionMenuId] = useState(null);

  const reportTargetName = reportTarget ? getDisplayName(reportTarget) : "";
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
      setActionNotice("請先登入後再檢舉。");
      setActionNoticeType("error");
      return;
    }
    setReportTarget(response);
    setReportReason("");
    setReportRemarks("");
    setReportError("");
    setReportFeedback("");
  }, [authUser]);

  const toggleActionMenu = useCallback((responseId) => {
    setOpenActionMenuId((prev) => (prev === responseId ? null : responseId));
  }, []);

  const handleShareResponse = useCallback(async (response) => {
    if (typeof window === "undefined") return;
    const baseUrl = window.location.href.split("#")[0];
    const shareUrl = `${baseUrl}#prayer-response-${response.id}`;
    const shareText = response.message ? response.message.slice(0, 120) : "邀請你一起關心這則禱告回應";
    try {
      if (navigator.share) {
        await navigator.share({
          title: document.title,
          text: shareText,
          url: shareUrl,
        });
        setActionNotice("分享連結已準備好。");
        setActionNoticeType("success");
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl);
        setActionNotice("連結已複製。");
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
          setActionNotice("連結已複製。");
          setActionNoticeType("success");
        } catch (_copyErr) {
          throw new Error("目前無法分享，請稍後再試。");
        } finally {
          textarea.remove();
        }
      }
    } catch (err) {
      if (err?.name === "AbortError") return;
      setActionNotice(err?.message || "目前無法分享，請稍後再試。");
      setActionNoticeType("error");
    }
  }, []);

  const handleReportSubmit = useCallback(async (event) => {
    event.preventDefault();
    if (!reportTarget) {
      setReportError("找不到要檢舉的回應。");
      return;
    }
    if (!reportReason) {
      setReportError("請選擇檢舉理由。");
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
        throw new Error(data?.message || "檢舉失敗，請稍後再試。");
      }

      const ownerReporting = ownerIdValue && authUser?.id && String(authUser.id) === ownerIdValue;

      setResponses((prev) =>
        prev.map((item) =>
          item.id === reportTarget.id
            ? { ...item, reportCount: (item.reportCount || 0) + 1, isBlocked: true, reviewStatus: "pending" }
            : item
        )
      );
      setReportFeedback("已送出檢舉，這則語音或回應已先隱藏並進入審核。");
      window.setTimeout(() => {
        closeReportModal();
      }, 1500);
    } catch (err) {
      setReportError(err?.message || "檢舉失敗，請稍後再試。");
    } finally {
      setReportSubmitting(false);
    }
  }, [reportTarget, reportReason, reportRemarks, closeReportModal, ownerIdValue, authUser]);

  // Recorder state
  const [audioUrl, setAudioUrl] = useState(null);
  const audioBlobRef = useRef(null);
  const recordingFormatRef = useRef(resolveRecordingFormat());

  const [isRecorderModalOpen, setIsRecorderModalOpen] = useState(false);
  const [recorderStep, setRecorderStep] = useState("idle"); // idle | countdown | recording | review
  const [countdownValue, setCountdownValue] = useState(null);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);
  const [recordError, setRecordError] = useState("");
  const [submittingResponse, setSubmittingResponse] = useState(false);
  const [responseCooldownUntil, setResponseCooldownUntil] = useState(0);
  const [cooldownSecondsLeft, setCooldownSecondsLeft] = useState(0);

  // Recorder refs
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const audioContextRef = useRef(null);
  const recordChunksRef = useRef([]);
  const recordTimerRef = useRef(null);
  const discardRecordingOnStopRef = useRef(false);

  // Load existing responses
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/responses/${requestId}`, { cache: "no-store" });
        if (!res.ok) throw new Error("無法載入回應。");
        const data = await res.json();
        if (!cancelled) {
          setResponses(data);
          setError("");
        }
      } catch (err) {
        if (!cancelled) setError(err.message || "無法載入回應。");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
      // Release recorder resources and any generated blob URL on unmount.
      cleanupRecording();
      if (recordTimerRef.current) {
        clearInterval(recordTimerRef.current);
        recordTimerRef.current = null;
      }
      if (audioUrl) URL.revokeObjectURL(audioUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId]);

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
    if (!responseCooldownUntil) {
      setCooldownSecondsLeft(0);
      return undefined;
    }

    const updateCooldown = () => {
      const nextSeconds = Math.max(0, Math.ceil((responseCooldownUntil - Date.now()) / 1000));
      setCooldownSecondsLeft(nextSeconds);
      if (nextSeconds === 0) {
        setResponseCooldownUntil(0);
      }
    };

    updateCooldown();
    const timer = window.setInterval(updateCooldown, 1000);
    return () => window.clearInterval(timer);
  }, [responseCooldownUntil]);

  // Auto-stop once the recording reaches the time limit.
  useEffect(() => {
    if (!recording) return;
    if (recordSeconds >= MAX_RECORD_SECONDS) {
      logDebug(`Max ${MAX_RECORD_SECONDS}s reached -> stopRecording`);
      stopRecording();
    }
  }, [recordSeconds, recording]);

  // Countdown timer before recording starts.
  useEffect(() => {
    if (!isRecorderModalOpen || recorderStep !== "countdown") return;
    if (countdownValue === null) return;

    if (countdownValue === 0) {
      setCountdownValue(null);
      window.setTimeout(() => beginRecording(), 500);
      return;
    }

    const timer = window.setTimeout(() => {
      setCountdownValue((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
  }, [countdownValue, isRecorderModalOpen, recorderStep]);

  // Skip recorder.stop() when cleanup already came from the onstop path.
  const cleanupRecording = useCallback((fromStop = false) => {
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }

    if (!fromStop) {
      const recorder = mediaRecorderRef.current;
      if (recorder && recorder.state !== "inactive") {
        try {
          recorder.stop();
        } catch (_) {}
      }
    }

    mediaRecorderRef.current = null;

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((t) => t.stop());
      mediaStreamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => undefined);
      audioContextRef.current = null;
    }

    recordChunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }, []);

  // Ask for microphone permission before opening the recorder modal.
  const openRecorder = async () => {
    setRecordError("");
    setCountdownValue(null);
    discardRecordingOnStopRef.current = false;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: DEFAULT_SAMPLE_RATE,
          noiseSuppression: true,
          echoCancellation: true,
          autoGainControl: false,
        },
      });
      mediaStreamRef.current = stream;

      setRecorderStep("countdown");
      setCountdownValue(COUNTDOWN_START);
      setIsRecorderModalOpen(true);
    } catch (err) {
      console.error("access microphone failed", err);
      setRecordError("需要麥克風權限才能錄音。");
      setIsRecorderModalOpen(false);
      cleanupRecording();
    }
  };

  // Closing the modal mid-flow should discard the current recording session.
  const closeRecorderModal = () => {
    if (recorderStep === "countdown" || recorderStep === "recording") {
      discardRecordingOnStopRef.current = true;
      cleanupRecording();
    }
    setIsRecorderModalOpen(false);
    setRecorderStep("idle");
    setCountdownValue(null);
  };

  // Start recording
  const beginRecording = () => {
    if (!mediaStreamRef.current) {
      setRecorderStep("idle");
      setRecordError("無法取得麥克風串流。");
      return;
    }

    try {
      let audioContext;
      try {
        audioContext = new AudioContext({ sampleRate: DEFAULT_SAMPLE_RATE });
      } catch {
        audioContext = new AudioContext();
      }
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(mediaStreamRef.current);
      const compressor = audioContext.createDynamicsCompressor();
      compressor.threshold.value = -24;
      compressor.knee.value = 15;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;

      const gain = audioContext.createGain();
      gain.gain.value = 1.15;

      const destination = audioContext.createMediaStreamDestination();
      source.connect(compressor);
      compressor.connect(gain);
      gain.connect(destination);

      const { recorder, format, options } = createMediaRecorderWithFallback(destination.stream);
      recordingFormatRef.current = format;
      recordChunksRef.current = [];

      recorder.addEventListener("error", (event) => {
        const err = event?.error;
        setRecordError(`錄音發生錯誤${err?.name ? `：${err.name}` : ""}`);
      });

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data && event.data.size > 0) recordChunksRef.current.push(event.data);
      });

      recorder.addEventListener("stop", () => {
        if (discardRecordingOnStopRef.current) {
          discardRecordingOnStopRef.current = false;
          cleanupRecording(true);
          setRecorderStep("idle");
          setIsRecorderModalOpen(false);
          return;
        }

        const selectedFormat = recordingFormatRef.current || {};
        const mimeType = selectedFormat.mimeType || options?.mimeType || "audio/webm";
        const blob = new Blob(recordChunksRef.current, { type: mimeType });

        audioBlobRef.current = blob;
        setAudioUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });

        cleanupRecording(true);
        setCountdownValue(null);
        setRecordError("");
        setRecorderStep("review");
        setIsRecorderModalOpen(true);
      });

      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
      setRecordSeconds(0);
      recordTimerRef.current = window.setInterval(() => setRecordSeconds((s) => s + 1), 1000);
      setRecorderStep("recording");
    } catch (error) {
      console.error("begin recording failed", error);
      setRecordError("錄音啟動失敗，請檢查權限後再試。");
      cleanupRecording();
      setRecorderStep("idle");
      setCountdownValue(null);
    }
  };

  // Stop through MediaRecorder so buffered chunks still flush via onstop.
  const stopRecording = () => {
    const recorder = mediaRecorderRef.current;
    if (recorder && recorder.state === "recording") {
      discardRecordingOnStopRef.current = false;
      recorder.stop();
    } else {
      closeRecorderModal();
    }
  };

  const resetRecording = () => {
    discardRecordingOnStopRef.current = false;
    setAudioUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return null;
    });
    audioBlobRef.current = null;
    setRecorderStep("idle");
    setRecordSeconds(0);
    setRecording(false);
    setCountdownValue(null);
  };

  // Keep the recorded clip and return to the response composer.
  const useRecordedAudio = () => {
    setIsRecorderModalOpen(false);
    setRecorderStep("idle");
    setRecordError("");
  };

  const rerecordAudio = async () => {
    resetRecording();
    await openRecorder();
  };

  const submitResponse = async () => {
    if (recording || submittingResponse) return false;
    if (!text.trim() && !audioBlobRef.current) return false;
    if (cooldownSecondsLeft > 0) {
      setActionNotice(`你剛剛已經送出回應，請約 ${cooldownSecondsLeft} 秒後再送出下一則。`);
      setActionNoticeType("error");
      return false;
    }

    setSubmittingResponse(true);

    const formData = new FormData();
    formData.append("requestId", String(requestId));
    formData.append("message", text.trim());
    formData.append("isAnonymous", String(isAnonymous));
    formData.append("responderId", authUser?.id || "");

    if (audioBlobRef.current) {
      const format = recordingFormatRef.current || {};
      const type =
        audioBlobRef.current.type ||
        format.mimeType ||
        resolveRecordingFormat().mimeType ||
        "audio/webm";
      const extension = format.extension || getExtensionFromMime(type);
      formData.append(
        "audio",
        new File([audioBlobRef.current], `prayer-recording.${extension}`, { type })
      );
    }

    try {
      const res = await fetch("/api/responses", { method: "POST", body: formData });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        if (res.status === 429) {
          const retryAfterHeader = Number(res.headers.get("Retry-After"));
          const retryAfterSeconds =
            Number(data?.retryAfterSeconds) || retryAfterHeader || SAME_CARD_RESPONSE_COOLDOWN_SECONDS;
          setResponseCooldownUntil(Date.now() + retryAfterSeconds * 1000);
        }
        throw new Error(data?.error || "回應送出失敗，請稍後再試。");
      }

      const saved = await res.json();
      setResponses((prev) => [saved, ...prev]);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(PRAYER_RESPONSE_CREATED, { detail: saved }));
      }
      setText("");
      setResponseMode("prayer");
      setIsAnonymous(false);
      resetRecording();
      setIsRecorderModalOpen(false);
      setRecorderStep("idle");
      setResponseCooldownUntil(Date.now() + SAME_CARD_RESPONSE_COOLDOWN_SECONDS * 1000);
      setActionNotice("");
      setActionNoticeType("success");
      return true;
    } catch (err) {
      setActionNotice(err?.message || "送出回應失敗，請稍後再試。");
      setActionNoticeType("error");
      return false;
    } finally {
      setSubmittingResponse(false);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await submitResponse();
  };

  const submitFromRecorderModal = async () => {
    const success = await submitResponse();
    if (success) {
      setIsRecorderModalOpen(false);
      setRecorderStep("idle");
    }
  };

  // Recorder modal
  const renderRecorderModal = () => {
    if (!isRecorderModalOpen) return null;

    return (
      <div className="record-modal" role="dialog" aria-modal="true" aria-label="錄音視窗">
        <div className="record-modal__backdrop" onClick={closeRecorderModal} />
        <div className="record-modal__card">
          {recordError ? (
            <>
              <h4>錄音錯誤</h4>
              <p className="cp-alert cp-alert--error">{recordError}</p>
              <button type="button" className="cp-button cp-button--ghost" onClick={closeRecorderModal}>
                關閉
              </button>
            </>
          ) : recorderStep === "countdown" ? (
            <>
              <h4>準備錄音</h4>
              <p>倒數結束後將自動開始錄音。</p>
              <div className="record-modal__count">{countdownValue}</div>
              <button type="button" className="cp-button cp-button--ghost" onClick={closeRecorderModal}>
                取消
              </button>
            </>
          ) : recorderStep === "recording" ? (
            <>
              <h4>錄音中</h4>
              <p>最長可錄製 {MAX_RECORD_SECONDS} 秒。</p>
              <div className="record-modal__timer">{formatSeconds(recordSeconds)}</div>
              <div className="record-modal__actions">
                <button type="button" className="cp-button cp-button--danger" onClick={stopRecording}>
                  停止錄音
                </button>
              </div>
            </>
          ) : recorderStep === "review" && audioUrl ? (
            <>
              <h4>檢查錄音</h4>
              <p>送出前請先確認錄音內容。</p>
              <audio src={audioUrl} controls preload="metadata" className="record-modal__audio" />
              <div className="record-modal__actions record-modal__actions--review">
                <button type="button" className="cp-button cp-button--ghost" onClick={rerecordAudio} disabled={submittingResponse}>
                  重新錄音
                </button>
                <button type="button" className="cp-button cp-button--ghost" onClick={useRecordedAudio} disabled={submittingResponse}>
                  保留並關閉
                </button>
                <button type="button" className="cp-button" onClick={submitFromRecorderModal} disabled={isResponseSubmitDisabled}>
                  {submittingResponse ? "送出中..." : cooldownSecondsLeft > 0 ? `請稍等 ${cooldownSecondsLeft} 秒` : "送出回應"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    );
  };

  const hasAudio = Boolean(audioUrl);
  const isResponseSubmitDisabled = recording || submittingResponse || cooldownSecondsLeft > 0;

  const visibleResponses = responses.filter(
    (response) => !response.isBlocked && Number(response.reportCount ?? 0) === 0
  );
  const pendingReviewCount = responses.filter(
    (response) => response.isBlocked || Number(response.reportCount ?? 0) > 0
  ).length;
  const responseModes = [
    { key: "prayer", label: "禱告", placeholder: "寫下一段安靜的禱告，托住這個需要。" },
    { key: "encouragement", label: "鼓勵", placeholder: "留下溫柔、具體的鼓勵。" },
    { key: "testimony", label: "見證", placeholder: "分享你經歷過的幫助、盼望或見證。" },
    { key: "voice", label: "語音", placeholder: "可先錄製語音，再補上一句簡短說明。" },
  ];
  const activeMode = responseModes.find((mode) => mode.key === responseMode) || responseModes[0];

  return (
    <section className="comments card">
      {renderRecorderModal()}

      {recordError && !isRecorderModalOpen ? (
        <p className="cp-alert cp-alert--error">{recordError}</p>
      ) : null}

      {!authUser && (
        <div className="alert alert-warning">
          登入後可以匿名留下文字、錄一段語音，或管理自己曾經回應過的代禱。
          {" "}
          <Link href="/login">前往登入</Link>
        </div>
      )}

      <div className="comments__header">
        {pendingReviewCount ? (
          <span className="comments__review-status">{pendingReviewCount} 則回應審核中</span>
        ) : null}
          <h3>禱告回應</h3>
        <p className="comments__subtitle">只留一句話也可以。你的回應會成為這個人的支持。</p>
      </div>

      {actionNotice ? (
        <p
          className={`cp-alert ${
            actionNoticeType === "error" ? "cp-alert--error" : "cp-alert--success"
          } comments__notice`}
          role="status"
        >
          {actionNoticeType === "error" && actionNotice.includes("登入") ? (
            <>
              {actionNotice} <Link href="/login">前往登入</Link>
            </>
          ) : (
            actionNotice
          )}
        </p>
      ) : null}

      {cooldownSecondsLeft > 0 ? (
        <p className="cp-alert cp-alert--success comments__notice" role="status">
          已送出你的回應。若要再次回應同一則代禱，請稍等約 {cooldownSecondsLeft} 秒。
        </p>
      ) : null}

      <div className="comments__list" aria-live="polite">
          {loading ? (
            <div className="comments__skeleton" role="status" aria-label="載入回應中">
              <span />
              <span />
              <span />
            </div>
          ) : error ? (
            <p className="cp-alert cp-alert--error">{error}</p>
          ) : visibleResponses.length === 0 ? (
            <p className="cp-helper">成為第一位留下回應的人吧。</p>
          ) : (
            visibleResponses.map((response) => {
                const name = getDisplayName(response);
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
                              title={`已被檢舉 ${response.reportCount} 次`}
                            >
                              檢舉 x {response.reportCount}
                            </span>
                          ) : null}
                          <div className="comment-item__actions">
                            <button
                              type="button"
                              className="comment-item__action-btn comment-item__action-btn--share"
                              onClick={() => handleShareResponse(response)}
                            >
                              分享
                            </button>
                            <div className={`comment-item__menu-wrap${isActionMenuOpen ? " is-open" : ""}`}>
                              <button
                                type="button"
                                className="comment-item__menu-trigger"
                                aria-label="更多留言操作"
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
                                    檢舉這則回應
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
          <h3 className="comments__composer-title">立即回應</h3>
          <form id="response-composer" className="comment-form" onSubmit={handleSubmit}>
            <div className="prayer-response-modes" aria-label="選擇禱告回應模式">
              {responseModes.map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  className={responseMode === mode.key ? "is-active" : ""}
                  onClick={async () => {
                    setResponseMode(mode.key);
                    if (mode.key === "encouragement" && !text.trim()) {
                      setText("願主賜下安慰、力量與清楚的帶領。");
                    }
                    if (mode.key === "testimony" && !text.trim()) {
                      setText("見證分享：");
                    }
                    if (mode.key === "voice") {
                      resetRecording();
                      await openRecorder();
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
              匿名發表
            </label>

            <textarea
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="寫下鼓勵的話，或上傳你的語音代禱。"
              rows={4}
            />
            <div className="record-toolbar">
              {!recording && !hasAudio ? (
                <button
                  type="button"
                  className="btn btn-record"
                  onClick={async () => {
                    resetRecording();
                    await openRecorder();
                  }}
                  style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "12px 24px", borderRadius: "50px" }}
                >
                  <i className="fa-solid fa-microphone"></i>
                  錄製語音
                </button>
              ) : null}

              {hasAudio ? (
                <div className="audio-preview glass-panel" style={{ padding: "10px", marginTop: "10px" }}>
                  <p style={{ margin: "0 0 10px 0", fontSize: "0.9rem", color: "var(--text-light)" }}>
                    錄音已完成，可重新錄音或直接送出。
                  </p>
                  <audio src={audioUrl} controls preload="metadata" style={{ width: "100%" }} />
                  <div className="audio-preview__actions" style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                    <button type="button" className="btn btn-glass" onClick={resetRecording}>
                      <i className="fa-solid fa-rotate-right"></i> 重新錄音
                    </button>
                    <button type="submit" className="btn btn-primary" disabled={isResponseSubmitDisabled}>
                      <i className="fa-solid fa-paper-plane"></i>{" "}
                      {submittingResponse ? "送出中..." : cooldownSecondsLeft > 0 ? `請稍等 ${cooldownSecondsLeft} 秒` : "送出回應"}
                    </button>
                  </div>
                </div>
              ) : (
                <button type="submit" className="btn btn-primary" disabled={isResponseSubmitDisabled} style={{ marginTop: "10px" }}>
                  {submittingResponse ? "送出中..." : cooldownSecondsLeft > 0 ? `請稍等 ${cooldownSecondsLeft} 秒` : "送出回應"}
                </button>
              )}
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
              aria-label="關閉檢舉視窗"
            >
              ×
            </button>
            <h4>檢舉這則回應</h4>
            <p className="comment-report-modal__hint">
              請選擇檢舉理由。若願意，可補充讓管理員判斷的原因。
            </p>
            <div className="comment-report-modal__preview">
              <p className="comment-report-modal__preview-label">檢舉對象</p>
              <strong>{reportTargetName || "未命名使用者"}</strong>
              {reportPreviewMessage ? (
                <p className="comment-report-modal__preview-message">{reportPreviewMessage}</p>
              ) : (
                <p className="comment-report-modal__preview-message muted">這則回應沒有文字內容。</p>
              )}
            </div>
            <form onSubmit={handleReportSubmit} className="comment-report-modal__form">
              <fieldset className="comment-report-modal__fieldset">
                <legend>檢舉理由</legend>
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

    </section>
  );
}

