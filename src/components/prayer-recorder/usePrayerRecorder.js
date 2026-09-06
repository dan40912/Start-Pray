"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  MAX_DURATION_SECONDS,
  MIN_DURATION_SECONDS,
  PREFERRED_MIME_TYPES,
  hasRecordingSupport,
  isRecordingTooShort,
  isSilentRecording,
  selectSupportedMimeType,
  SILENCE_RMS_THRESHOLD,
} from "./recorder-utils";

// Recording engine adapted from the proven logic in
// src/components/VoicePrayerOverlay.js (permission handling, MIME fallback,
// stop-with-timeout, cleanup) but stripped of speech-recognition/subtitles,
// auth, and upload — this hook only ever produces a local Blob. Submission
// is wired in a later commit (see docs/obsidian/10-Implementation-Plan.md).
//
// phase: idle | permission-explanation | requesting-permission | permission-denied
//        | unsupported | countdown | recording | preview | error
//
// maxDurationSeconds defaults to the 60s anonymous-response limit so every
// existing caller (PrayerRecorder.js) is unaffected; pass a longer value
// (e.g. the card-voice-message feature's 180s) without touching that default.
// Returns the loudest sample in the recording, or null when the browser cannot
// decode it — a decode failure is not evidence of silence, so we let those
// through rather than blocking a valid recording on a codec quirk.
async function measurePeakAmplitude(blob) {
  const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
  if (!Ctor) return null;
  let ctx = null;
  try {
    ctx = new Ctor();
    const decoded = await ctx.decodeAudioData(await blob.arrayBuffer());
    let peak = 0;
    for (let channel = 0; channel < decoded.numberOfChannels; channel += 1) {
      const samples = decoded.getChannelData(channel);
      for (let i = 0; i < samples.length; i += 1) {
        const value = Math.abs(samples[i]);
        if (value > peak) peak = value;
      }
    }
    return peak;
  } catch {
    return null;
  } finally {
    try { await ctx?.close(); } catch { /* already closed */ }
  }
}

// Bare `{ audio: true }` leaves gain entirely to the device, and the recordings
// it produced measured -29 to -34 dBFS RMS — roughly 10-14 dB under a normal
// speech level, which is why they play back so quietly. autoGainControl asks the
// browser to ride the level up for a quiet microphone instead. It is on by
// default in some browsers and off in others, so state it rather than inherit it.
const MIC_CONSTRAINTS = {
  autoGainControl: true,
  echoCancellation: true,
  noiseSuppression: true,
};

export function usePrayerRecorder({ maxDurationSeconds = MAX_DURATION_SECONDS } = {}) {
  const [phase, setPhase] = useState("idle");
  const [countdownValue, setCountdownValue] = useState(3);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [previewUrl, setPreviewUrl] = useState("");
  const [isPlaying, setIsPlaying] = useState(false);
  const [errorReason, setErrorReason] = useState("");
  const [transientMessage, setTransientMessage] = useState("");
  const [confirmingRerecord, setConfirmingRerecord] = useState(false);
  // Live input level, 0..1, driven off the microphone stream while recording.
  // Someone whose mic is muted or pointed at the wrong device otherwise gets no
  // feedback at all until after they have finished and the silence check fires.
  const [inputLevel, setInputLevel] = useState(0);
  const [heardSound, setHeardSound] = useState(false);

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
  const meterCtxRef = useRef(null);
  const meterRafRef = useRef(0);

  const clearAllTimers = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    timerRef.current = null;
    countdownTimerRef.current = null;
  }, []);

  const stopLevelMeter = useCallback(() => {
    if (meterRafRef.current) cancelAnimationFrame(meterRafRef.current);
    meterRafRef.current = 0;
    const ctx = meterCtxRef.current;
    meterCtxRef.current = null;
    if (ctx) {
      try {
        ctx.close();
      } catch {
        // already closed
      }
    }
    setInputLevel(0);
  }, []);

  // Reads the stream the recorder is already using, so the meter reflects the
  // exact signal being encoded rather than a second capture of the microphone.
  const startLevelMeter = useCallback((stream) => {
    const Ctor = typeof window !== "undefined" ? window.AudioContext || window.webkitAudioContext : null;
    if (!Ctor || !stream) return;
    let ctx;
    try {
      ctx = new Ctor();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      source.connect(analyser);
      meterCtxRef.current = ctx;

      const samples = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) sum += samples[i] * samples[i];
        const rms = Math.sqrt(sum / samples.length);
        // Speech RMS sits well under 1, so scale up to fill the bar without
        // letting a loud moment peg it permanently.
        const level = Math.min(1, rms * 6);
        setInputLevel(level);
        if (rms >= SILENCE_RMS_THRESHOLD) setHeardSound(true);
        meterRafRef.current = requestAnimationFrame(tick);
      };
      meterRafRef.current = requestAnimationFrame(tick);
    } catch {
      // A meter is a nicety — never let it break the actual recording.
      try {
        ctx?.close();
      } catch {
        // ignore
      }
      meterCtxRef.current = null;
    }
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
      stopLevelMeter();
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
  }, [clearAllTimers, releaseStream, revokePreviewUrl, stopLevelMeter]);

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
    setHeardSound(false);
    startLevelMeter(mediaStreamRef.current);
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
        if (next >= maxDurationSeconds) {
          clearAllTimers();
          finishRecordingRef.current();
        }
        return next;
      });
    }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clearAllTimers, releaseStream, revokePreviewUrl, maxDurationSeconds]);

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
      mediaStreamRef.current = await navigator.mediaDevices.getUserMedia({ audio: MIC_CONSTRAINTS });
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
    stopLevelMeter();
    try {
      const blob = await stopRecorderAndWait();
      if (!blob || blob.size === 0) throw new Error("EMPTY_RECORDING");

      // Catch a recording that ran fine but captured nothing — muted input,
      // wrong device, an OS-level mic block. Better to say so now than to let
      // someone submit a prayer nobody can hear.
      const peak = await measurePeakAmplitude(blob);
      if (peak !== null && isSilentRecording(peak)) {
        setErrorReason("silent");
        setPhase("error");
        return;
      }

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
  }, [clearAllTimers, elapsedSeconds, releaseStream, revokePreviewUrl, stopLevelMeter, stopRecorderAndWait]);
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
    inputLevel,
    heardSound,
    transientMessage,
    setTransientMessage,
    confirmingRerecord,
    maxDurationSeconds,
    minDurationSeconds: MIN_DURATION_SECONDS,
    showPermissionExplanation: () => setPhase("permission-explanation"),
    getBlob: () => blobRef.current,
    requestPermission,
    finishRecording,
    requestRerecord,
    cancelRerecordConfirm,
    confirmRerecord,
    cancel,
    retryAfterError,
  };
}
