"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  PREFERRED_MIME_TYPES,
  hasRecordingSupport,
  isRecordingTooShort,
  selectSupportedMimeType,
} from "./recorder-utils";

// Recording engine adapted from the proven logic in
// src/components/VoicePrayerOverlay.js (permission handling, MIME fallback,
// stop-with-timeout, cleanup) but stripped of speech-recognition/subtitles,
// auth, and upload — this hook only ever produces a local Blob. Submission
// is wired in a later commit (see docs/obsidian/10-Implementation-Plan.md).
//
// phase: idle | permission-explanation | requesting-permission | permission-denied
//        | unsupported | countdown | recording | preview | error
export function usePrayerRecorder() {
  const [phase, setPhase] = useState("idle");
  const [countdownValue, setCountdownValue] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorReason, setErrorReason] = useState("");
  const [transientMessage, setTransientMessage] = useState("");
  const [confirmingRerecord, setConfirmingRerecord] = useState(false);

  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const blobRef = useRef(null);
  const urlRef = useRef("");
  const timerRef = useRef(null);
  const countdownTimerRef = useRef(null);
  const recorderDoneRef = useRef(null);
  const runIdRef = useRef(0);
  // startRecording's max-duration branch needs to call finishRecording, which
  // is declared later (it depends on stopRecorderAndWait). A ref indirection
  // avoids a stale closure over finishRecording inside the useCallback below.
  const finishRecordingRef = useRef(() => {});

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    timerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const releaseStream = useCallback(() => {
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
  }, []);

  const revokePreviewUrl = useCallback(() => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current);
      urlRef.current = "";
    }
  }, []);

  useEffect(() => {
    return () => {
      clearAllTimers();
      releaseStream();
      revokePreviewUrl();
      try {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
          mediaRecorderRef.current.stop();
        }
      } catch {
        // Unmounting anyway; nothing to recover.
      }
    };
  }, [clearAllTimers, releaseStream, revokePreviewUrl]);

  const stopRecorderAndWait = useCallback(() => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      return Promise.resolve(blobRef.current);
    }
    return new Promise((resolve, reject) => {
      const timeoutId = window.setTimeout(() => {
        if (!recorderDoneRef.current) return;
        recorderDoneRef.current = null;
        const fallback = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        if (fallback.size > 0) resolve(fallback);
        else reject(new Error("RECORDER_STOP_TIMEOUT"));
      }, 5000);
      recorderDoneRef.current = {
        resolve: (blob) => {
          window.clearTimeout(timeoutId);
          resolve(blob);
        },
        reject: (err) => {
          window.clearTimeout(timeoutId);
          reject(err);
        },
      };
      try {
        if (recorder.state === "recording") {
          try {
            recorder.requestData();
          } catch {
            // Some browsers reject requestData right before stop(); stop() below still works.
          }
        }
        recorder.stop();
      } catch (err) {
        recorderDoneRef.current = null;
        reject(err);
      }
    });
  }, []);

  const startRecording = useCallback(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    chunksRef.current = [];
    blobRef.current = null;
    revokePreviewUrl();
    setPreviewUrl("");
    setElapsedSeconds(0);

    let recorder;
    try {
      const mimeType = selectSupportedMimeType(PREFERRED_MIME_TYPES, window.MediaRecorder?.isTypeSupported);
      recorder = mimeType
        ? new MediaRecorder(mediaStreamRef.current, { mimeType })
        : new MediaRecorder(mediaStreamRef.current);
    } catch {
      setErrorReason("device");
      setPhase("error");
      releaseStream();
      return;
    }

    mediaRecorderRef.current = recorder;
    recorder.ondataavailable = (event) => {
      if (runId === runIdRef.current && event.data.size) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      if (runId !== runIdRef.current) return;
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
      blobRef.current = blob;
      recorderDoneRef.current?.resolve(blob);
      recorderDoneRef.current = null;
    };
    recorder.onerror = (event) => {
      recorderDoneRef.current?.reject(event.error || new Error("MEDIA_RECORDER_ERROR"));
      recorderDoneRef.current = null;
      setErrorReason("device");
      setPhase("error");
    };

    const audioTrack = mediaStreamRef.current?.getAudioTracks?.()[0];
    if (audioTrack) {
      audioTrack.onended = () => {
        if (recorder.state === "recording") {
          clearAllTimers();
          setErrorReason("stream-lost");
          setPhase("error");
          try {
            recorder.stop();
          } catch {
            // Already stopping via the track ending; nothing more to do.
          }
        }
      };
    }

    setPhase("recording");
    recorder.start(1000);

    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        const next = prev + 1;
        if (next >= MAX_DURATION_SECONDS) {
          clearAllTimers();
          finishRecordingRef.current();
        }
        return next;
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAllTimers, releaseStream, revokePreviewUrl]);

  const beginCountdown = useCallback(() => {
    setPhase("countdown");
    setCountdownValue(3);
    let remaining = 3;
    countdownTimerRef.current = setInterval(() => {
      remaining -= 1;
      if (remaining > 0) {
        setCountdownValue(remaining);
      } else {
        clearInterval(countdownTimerRef.current);
        countdownTimerRef.current = null;
        startRecording();
      }
    }, 1000);
  }, [startRecording]);

  const requestPermission = useCallback(async () => {
    if (!hasRecordingSupport()) {
      setPhase("unsupported");
      return;
    }
    setPhase("requesting-permission");
    try {
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });
      beginCountdown();
    } catch {
      setPhase("permission-denied");
    }
  }, [beginCountdown]);

  const finishRecording = useCallback(async () => {
    if (isRecordingTooShort(elapsedSeconds)) {
      setTransientMessage("too-short");
      return;
    }
    clearAllTimers();
    try {
      const blob = await stopRecorderAndWait();
      if (!blob || blob.size === 0) throw new Error("EMPTY_RECORDING");
      revokePreviewUrl();
      const url = URL.createObjectURL(blob);
      urlRef.current = url;
      blobRef.current = blob;
      setPreviewUrl(url);
      releaseStream();
      setPhase("preview");
    } catch {
      setErrorReason("empty");
      setPhase("error");
    }
  }, [clearAllTimers, elapsedSeconds, releaseStream, revokePreviewUrl, stopRecorderAndWait]);
  finishRecordingRef.current = finishRecording;

  const requestRerecord = useCallback(() => {
    setConfirmingRerecord(true);
  }, []);

  const cancelRerecordConfirm = useCallback(() => {
    setConfirmingRerecord(false);
  }, []);

  const confirmRerecord = useCallback(async () => {
    setConfirmingRerecord(false);
    setTransientMessage("");
    revokePreviewUrl();
    setPreviewUrl("");
    setIsPlaying(false);
    await requestPermission();
  }, [requestPermission, revokePreviewUrl]);

  const cancel = useCallback(() => {
    clearAllTimers();
    releaseStream();
    revokePreviewUrl();
    try {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // Cancelling anyway.
    }
    setPreviewUrl("");
    setIsPlaying(false);
    setTransientMessage("");
    setConfirmingRerecord(false);
    setPhase("idle");
  }, [clearAllTimers, releaseStream, revokePreviewUrl]);

  const retryAfterError = useCallback(() => {
    setErrorReason("");
    setPhase("idle");
  }, []);

  return {
    phase,
    countdownValue,
    elapsedSeconds,
    previewUrl,
    isPlaying,
    setIsPlaying,
    errorReason,
    transientMessage,
    setTransientMessage,
    confirmingRerecord,
    maxDurationSeconds: MAX_DURATION_SECONDS,
    minDurationSeconds: MIN_DURATION_SECONDS,
    showPermissionExplanation: () => setPhase("permission-explanation"),
    requestPermission,
    finishRecording,
    requestRerecord,
    cancelRerecordConfirm,
    confirmRerecord,
    cancel,
    retryAfterError,
  };
}
