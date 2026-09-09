"use client";

import "@/styles/theme-customer.css";
import GainAudio from "@/components/GainAudio";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import Link from "next/link";



import { SiteHeader, SiteFooter } from "@/components/site-chrome";

import { useAuthSession } from "@/hooks/useAuthSession";

import { saveAuthSession } from "@/lib/auth-storage";
import { buildOvercomerSlug } from "@/lib/overcomer";



const FALLBACK_AVATARS = {

  male: "/img/male.jpg",

  female: "/img/female.jpg",

};

const MAX_BIO_LENGTH = 360;

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_STORY_AUDIO_BYTES = 30 * 1024 * 1024;
const MAX_STORY_RECORD_SECONDS = 300;
const STORY_COUNTDOWN_START = 3;
const STORY_AUDIO_CAPTURE_ENABLED = false;

const REWARD_STATUS_LABELS = {
  PENDING: "審核中",
  BLOCKED: "已封鎖",
  REWARDED: "已發放",
};

function normalizeGender(value) {

  if (value === null || value === undefined) {

    return null;

  }



  const normalized = String(value).trim().toLowerCase();

  if (!normalized) {

    return null;

  }



  if (["male", "man", "m", "boy", "男", "男性"].includes(normalized)) {

    return "male";

  }



  if (["female", "woman", "f", "girl", "女", "女性"].includes(normalized)) {

    return "female";

  }



  return null;

}



function resolveDefaultAvatar(profileLike, authUserLike) {

  const candidates = [

    profileLike?.gender,

    profileLike?.sex,

    profileLike?.profileGender,

    authUserLike?.gender,

    authUserLike?.sex,

  ];



  for (const candidate of candidates) {

    const detected = normalizeGender(candidate);

    if (detected && FALLBACK_AVATARS[detected]) {

      return FALLBACK_AVATARS[detected];

    }

  }



  return FALLBACK_AVATARS.male;

}



function formatTime(dateLike) {

  if (!dateLike) {

    return "尚未更新";

  }



  try {

    return new Intl.DateTimeFormat("zh-TW", {

      year: "numeric",

      month: "2-digit",

      day: "2-digit",

      hour: "2-digit",

      minute: "2-digit",

    }).format(new Date(dateLike));

  } catch {

    return new Date(dateLike).toLocaleString();

  }

}



function buildCardHref(card) {
  if (card?.isPrivate || card?.isBlocked) {
    return "";
  }

  const rawHref = card?.detailsHref?.trim();

  // Keep render-time href deterministic across SSR/CSR.
  if (rawHref && /^https?:\/\//i.test(rawHref)) {
    return rawHref;
  }

  if (rawHref) {
    const path = rawHref.replace(/^\/+/, "");
    return `/${path}`;
  }

  if (card?.id) {
    return `/prayfor/${card.id}`;
  }

  return "/prayfor";
}

function buildShareUrl(card) {
  const href = buildCardHref(card);
  if (!href) return "";

  if (/^https?:\/\//i.test(href)) {
    return href;
  }

  if (typeof window !== "undefined" && window.location?.origin) {
    try {
      return new URL(href, window.location.origin).toString();
    } catch {
      return href;
    }
  }

  return href;
}

function getAudioExtension(mimeType = "") {
  const value = mimeType.toLowerCase();
  if (value.includes("mpeg")) return "mp3";
  if (value.includes("mp4")) return "m4a";
  if (value.includes("ogg")) return "ogg";
  return "webm";
}

function formatStorySeconds(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.max(0, totalSeconds % 60)
    .toString()
    .padStart(2, "0");
  return `${minutes}:${seconds}`;
}



export default function CustomerPortalPage() {

  const authUser = useAuthSession();

  const [profile, setProfile] = useState(null);

  const [profileLoading, setProfileLoading] = useState(true);

  const [profileError, setProfileError] = useState("");

  const [profileStatus, setProfileStatus] = useState(null);

  const [profileSaving, setProfileSaving] = useState(false);

  const [profileForm, setProfileForm] = useState({
    name: "",
    avatarUrl: "",
    bio: "",
    publicProfileEnabled: true,
    storyAudioUrl: "",
    storyYoutubeUrl: "",
  });

  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

  const avatarFileInputRef = useRef(null);
  const storyAudioFileInputRef = useRef(null);
  const storyRecorderRef = useRef(null);
  const storyRecordStreamRef = useRef(null);
  const storyRecordChunksRef = useRef([]);
  const storyRecordTimerRef = useRef(null);
  const storyDiscardRecordingOnStopRef = useRef(false);

  const [selectedAvatarFile, setSelectedAvatarFile] = useState(null);

  const [avatarPreview, setAvatarPreview] = useState("");
  const [selectedStoryAudioFile, setSelectedStoryAudioFile] = useState(null);
  const [storyAudioPreview, setStoryAudioPreview] = useState("");
  const [storyRecorderStep, setStoryRecorderStep] = useState("idle");
  const [storyCountdownValue, setStoryCountdownValue] = useState(null);
  const [storyRecording, setStoryRecording] = useState(false);
  const [storyRecordSeconds, setStoryRecordSeconds] = useState(0);
  const [storyRecordError, setStoryRecordError] = useState("");



  const [cards, setCards] = useState([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [cardsError, setCardsError] = useState("");
  const [cardAction, setCardAction] = useState(null);


  const [responses, setResponses] = useState([]);
  const [responsesLoading, setResponsesLoading] = useState(true);
  const [responsesError, setResponsesError] = useState("");
  const [responseAction, setResponseAction] = useState(null);

  const [toast, setToast] = useState(null);



  const defaultAvatar = useMemo(

    () => resolveDefaultAvatar(profile, authUser),

    [profile, authUser]

  );



  useEffect(() => {

    if (selectedAvatarFile) {

      return;

    }



    const nextPreview = profileForm.avatarUrl?.trim() || defaultAvatar;

    setAvatarPreview((prev) => {

      if (prev === nextPreview) {

        return prev;

      }



      if (prev && prev.startsWith("blob:")) {

        URL.revokeObjectURL(prev);

      }



      return nextPreview;

    });

  }, [selectedAvatarFile, profileForm.avatarUrl, defaultAvatar]);



  useEffect(

    () => () => {

      if (avatarPreview && avatarPreview.startsWith("blob:")) {

        URL.revokeObjectURL(avatarPreview);

      }
      if (storyAudioPreview && storyAudioPreview.startsWith("blob:")) {
        URL.revokeObjectURL(storyAudioPreview);
      }
      stopStoryRecording(true);

    },

    [avatarPreview, storyAudioPreview]

  );



  function resetAvatarFileSelection(nextPreview = "") {

    setSelectedAvatarFile(null);

    setAvatarPreview((prev) => {

      if (prev && prev.startsWith("blob:") && prev !== nextPreview) {

        URL.revokeObjectURL(prev);

      }



      return nextPreview;

    });



    if (avatarFileInputRef.current) {

      avatarFileInputRef.current.value = "";

    }

  }

  function resetStoryAudioSelection(nextUrl = "") {
    setSelectedStoryAudioFile(null);
    setStoryAudioPreview((prev) => {
      if (prev && prev.startsWith("blob:") && prev !== nextUrl) {
        URL.revokeObjectURL(prev);
      }
      return nextUrl;
    });

    if (storyAudioFileInputRef.current) {
      storyAudioFileInputRef.current.value = "";
    }
    setStoryRecorderStep("idle");
    setStoryCountdownValue(null);
    setStoryRecordSeconds(0);
    setStoryRecordError("");
  }

  function stopStoryRecording(discard = false) {
    if (storyRecordTimerRef.current) {
      clearInterval(storyRecordTimerRef.current);
      storyRecordTimerRef.current = null;
    }

    const recorder = storyRecorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      storyDiscardRecordingOnStopRef.current = Boolean(discard);
      recorder.stop();
    } else if (discard) {
      storyDiscardRecordingOnStopRef.current = false;
      storyRecordChunksRef.current = [];
    }

    if (storyRecordStreamRef.current) {
      storyRecordStreamRef.current.getTracks().forEach((track) => track.stop());
      storyRecordStreamRef.current = null;
    }

    storyRecorderRef.current = null;
    setStoryRecording(false);
    if (discard) {
      setStoryRecorderStep("idle");
      setStoryCountdownValue(null);
      setStoryRecordSeconds(0);
    }
  }



  const resolvedAvatar = useMemo(() => {

    const avatar = profile?.avatarUrl?.trim();

    return avatar || defaultAvatar;

  }, [profile?.avatarUrl, defaultAvatar]);



  const loadProfile = useCallback(async () => {
    setProfileLoading(true);
    setProfileError("");

    try {
      const res = await fetch("/api/customer/profile", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "無法載入個人檔案");
      }

      setProfile(data);
    } catch (error) {
      console.error("載入個人檔案發生錯誤:", error);
      setProfileError(error.message || "無法載入個人檔案");
    } finally {
      setProfileLoading(false);
    }
  }, []);

  const loadCards = useCallback(async () => {
    setCardsLoading(true);
    setCardsError("");

    try {
      const res = await fetch("/api/customer/cards", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "無法取得代禱");
      }

      setCards(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error("載入代禱發生錯誤:", error);
      setCardsError(error.message || "無法取得代禱");
    } finally {
      setCardsLoading(false);
    }
  }, []);

  const loadResponses = useCallback(async () => {
    setResponsesLoading(true);
    setResponsesError("");

    try {
      const res = await fetch("/api/customer/responses", { cache: "no-store" });
      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "無法載入個人回應。");
      }

      if (Array.isArray(data)) {
        setResponses(data);
      } else {
        setResponses(Array.isArray(data?.responses) ? data.responses : []);
      }
    } catch (error) {
      console.error("載入個人回應發生錯誤:", error);
      setResponsesError(error.message || "無法載入個人回應。");
    } finally {
      setResponsesLoading(false);
    }
  }, []);

  useEffect(() => {
    loadProfile();
    loadCards();
    loadResponses();
  }, [loadProfile, loadCards, loadResponses]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!storyRecording) return;
    if (storyRecordSeconds >= MAX_STORY_RECORD_SECONDS) {
      stopStoryRecording();
    }
  }, [storyRecordSeconds, storyRecording]);

  useEffect(() => {
    if (!isProfileModalOpen || storyRecorderStep !== "countdown") return;
    if (storyCountdownValue === null) return;

    if (storyCountdownValue === 0) {
      setStoryCountdownValue(null);
      const starter = window.setTimeout(() => beginStoryRecording(), 500);
      return () => window.clearTimeout(starter);
    }

    const timer = window.setTimeout(() => {
      setStoryCountdownValue((value) => (value !== null ? value - 1 : null));
    }, 1000);

    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProfileModalOpen, storyCountdownValue, storyRecorderStep]);

  const resolvedName = profile?.name ?? authUser?.name ?? "未命名使用者";
  const resolvedEmail = profile?.email ?? authUser?.email ?? "尚未提供電子郵件";
  const isPublicProfileEnabled = profile?.publicProfileEnabled ?? authUser?.publicProfileEnabled ?? true;
  const overcomerSlug = buildOvercomerSlug({ username: profile?.username ?? authUser?.username ?? "" });
  const publicProfilePath = overcomerSlug ? `/overcomer/${encodeURIComponent(overcomerSlug)}` : "";

  const handleOpenProfileModal = () => {
    setProfileStatus(null);
    const currentAvatar = profile?.avatarUrl?.trim() || defaultAvatar;
    setProfileForm({
      name: profile?.name ?? authUser?.name ?? "",
      avatarUrl: currentAvatar,
      bio: profile?.bio ?? "",
      publicProfileEnabled: profile?.publicProfileEnabled ?? true,
      storyAudioUrl: profile?.storyAudioUrl ?? "",
      storyYoutubeUrl: profile?.storyYoutubeUrl ?? "",
    });
    resetAvatarFileSelection(currentAvatar);
    resetStoryAudioSelection(profile?.storyAudioUrl ?? "");
    setIsProfileModalOpen(true);
  };

  const handleCloseProfileModal = () => {
    if (profileSaving) return;
    setIsProfileModalOpen(false);
    const latestAvatar = profile?.avatarUrl?.trim() || defaultAvatar;
    resetAvatarFileSelection(latestAvatar);
    resetStoryAudioSelection(profile?.storyAudioUrl ?? "");
    stopStoryRecording(true);
  };

  const updateProfileField = (field) => (event) => {
    const value = event.target.value;
    if (field === "avatarUrl") {
      resetAvatarFileSelection(value.trim() || defaultAvatar);
    }
    setProfileForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleAvatarFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetAvatarFileSelection(profileForm.avatarUrl?.trim() || defaultAvatar);
      return;
    }

    if (!file.type?.startsWith("image/")) {
      setProfileStatus({
        type: "error",
        message: "請選擇圖片檔案",
      });
      resetAvatarFileSelection(profileForm.avatarUrl?.trim() || defaultAvatar);
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      const sizeInMb = file.size / (1024 * 1024);
      setProfileStatus({
        type: "error",
        message: `圖片大小需小於 5MB，當前約 ${sizeInMb.toFixed(2)} MB`,
      });
      resetAvatarFileSelection(profileForm.avatarUrl?.trim() || defaultAvatar);
      return;
    }

    setProfileStatus(null);
    setSelectedAvatarFile(file);
    setAvatarPreview((prev) => {
      if (prev && prev.startsWith("blob:")) {
        URL.revokeObjectURL(prev);
      }
      return URL.createObjectURL(file);
    });
  };

  const handleUseDefaultAvatar = () => {
    setProfileStatus(null);
    resetAvatarFileSelection(defaultAvatar);
    setProfileForm((prev) => ({ ...prev, avatarUrl: defaultAvatar }));
  };

  const handleStoryAudioFileChange = (event) => {
    const file = event.target.files?.[0];

    if (!file) {
      resetStoryAudioSelection(profileForm.storyAudioUrl || "");
      return;
    }

    if (!file.type?.startsWith("audio/")) {
      setProfileStatus({ type: "error", message: "請選擇音訊檔案" });
      resetStoryAudioSelection(profileForm.storyAudioUrl || "");
      return;
    }

    if (file.size > MAX_STORY_AUDIO_BYTES) {
      setProfileStatus({ type: "error", message: "故事音訊不可超過 30MB" });
      resetStoryAudioSelection(profileForm.storyAudioUrl || "");
      return;
    }

    stopStoryRecording(true);
    setProfileStatus(null);
    setSelectedStoryAudioFile(file);
    setStoryAudioPreview((prev) => {
      if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });
  };

  const handleRemoveStoryAudio = () => {
    stopStoryRecording(true);
    resetStoryAudioSelection("");
    setProfileForm((prev) => ({ ...prev, storyAudioUrl: "" }));
  };

  const handleStartStoryRecording = async () => {
    if (storyRecording || storyRecorderStep === "countdown") return;

    try {
      setProfileStatus(null);
      setStoryRecordError("");
      storyDiscardRecordingOnStopRef.current = false;
      resetStoryAudioSelection("");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          noiseSuppression: true,
          echoCancellation: true,
        },
      });
      storyRecordStreamRef.current = stream;
      storyRecordChunksRef.current = [];
      setStoryRecorderStep("countdown");
      setStoryCountdownValue(STORY_COUNTDOWN_START);
    } catch (error) {
      console.error("story recording failed:", error);
      setStoryRecordError("需要麥克風權限才能錄製故事。");
      setProfileStatus({ type: "error", message: "無法啟用麥克風錄製故事" });
      stopStoryRecording(true);
    }
  };

  function beginStoryRecording() {
    if (!storyRecordStreamRef.current) {
      setStoryRecorderStep("idle");
      setStoryRecordError("無法取得麥克風串流，請重新開始錄音。");
      return;
    }

    try {
      storyRecordChunksRef.current = [];

      const options = MediaRecorder.isTypeSupported?.("audio/webm;codecs=opus")
        ? { mimeType: "audio/webm;codecs=opus" }
        : {};
      const recorder = new MediaRecorder(storyRecordStreamRef.current, options);
      storyRecorderRef.current = recorder;

      recorder.addEventListener("dataavailable", (event) => {
        if (event.data?.size > 0) {
          storyRecordChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener("stop", () => {
        if (storyDiscardRecordingOnStopRef.current) {
          storyDiscardRecordingOnStopRef.current = false;
          storyRecordChunksRef.current = [];
          setStoryRecorderStep("idle");
          return;
        }

        const chunks = storyRecordChunksRef.current;
        storyRecordChunksRef.current = [];
        if (!chunks.length) {
          setStoryRecorderStep("idle");
          return;
        }

        const mimeType = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunks, { type: mimeType });
        const extension = getAudioExtension(mimeType);
        const file = new File([blob], `overcomer-story.${extension}`, { type: mimeType });
        setSelectedStoryAudioFile(file);
        setStoryAudioPreview((prev) => {
          if (prev && prev.startsWith("blob:")) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setStoryRecordError("");
        setStoryRecorderStep("review");
      });

      recorder.start();
      setStoryRecording(true);
      setStoryRecorderStep("recording");
      setStoryRecordSeconds(0);
      storyRecordTimerRef.current = window.setInterval(() => {
        setStoryRecordSeconds((seconds) => seconds + 1);
      }, 1000);
    } catch (error) {
      console.error("story recording failed:", error);
      setStoryRecordError("錄音啟動失敗，請檢查權限後再試。");
      setProfileStatus({ type: "error", message: "錄音啟動失敗，請檢查權限後再試。" });
      stopStoryRecording(true);
    }
  }

  const handleRerecordStoryAudio = async () => {
    stopStoryRecording(true);
    resetStoryAudioSelection("");
    await handleStartStoryRecording();
  };

  const handleSaveProfile = async () => {
    const trimmedAvatar = (profileForm.avatarUrl || "").trim();
    const trimmedName = (profileForm.name || "").trim();
    const trimmedBio = profileForm.bio.trim();
    const trimmedStoryYoutubeUrl = (profileForm.storyYoutubeUrl || "").trim();
    let nextStoryAudioUrl = (profileForm.storyAudioUrl || "").trim();
    const defaultAvatarUrl = defaultAvatar;

    if (trimmedBio.length > MAX_BIO_LENGTH) {
      setProfileStatus({
        type: "error",
        message: `個人簡介不可超過 ${MAX_BIO_LENGTH} 個字，目前為 ${trimmedBio.length} 個字`,
      });
      return;
    }

    if (selectedAvatarFile && selectedAvatarFile.size > MAX_AVATAR_BYTES) {
      const sizeInMb = selectedAvatarFile.size / (1024 * 1024);
      setProfileStatus({
        type: "error",
        message: `圖片大小需小於 5MB，當前約 ${sizeInMb.toFixed(2)} MB`,
      });
      return;
    }

    if (selectedStoryAudioFile && selectedStoryAudioFile.size > MAX_STORY_AUDIO_BYTES) {
      setProfileStatus({ type: "error", message: "故事音訊不可超過 30MB" });
      return;
    }

    setProfileSaving(true);
    setProfileStatus(null);

    let nextAvatarUrl = trimmedAvatar;

    try {
      if (selectedAvatarFile) {
        setProfileStatus({ type: "info", message: "圖片上傳中，請稍候..." });
        const formData = new FormData();
        formData.append("file", selectedAvatarFile);

        const uploadRes = await fetch("/api/upload-image", {
          method: "POST",
          body: formData,
        });

        const uploadPayload = await uploadRes.json().catch(() => null);

        if (!uploadRes.ok || !uploadPayload?.url) {
          throw new Error(uploadPayload?.message || "圖片上傳失敗");
        }

        nextAvatarUrl = uploadPayload.url;
        setProfileStatus(null);
      } else if (!nextAvatarUrl) {
        nextAvatarUrl = defaultAvatarUrl;
      }

      if (selectedStoryAudioFile) {
        setProfileStatus({ type: "info", message: "故事音訊上傳中，請稍候..." });
        const audioFormData = new FormData();
        audioFormData.append("audio", selectedStoryAudioFile);

        const audioUploadRes = await fetch("/api/customer/story-audio", {
          method: "POST",
          body: audioFormData,
        });
        const audioUploadPayload = await audioUploadRes.json().catch(() => null);

        if (!audioUploadRes.ok || !audioUploadPayload?.url) {
          throw new Error(audioUploadPayload?.message || "故事音訊上傳失敗");
        }

        nextStoryAudioUrl = audioUploadPayload.url;
        setProfileStatus(null);
      }

      const payload = {
        name: trimmedName || null,
        avatarUrl: nextAvatarUrl || null,
        bio: trimmedBio || null,
        publicProfileEnabled: Boolean(profileForm.publicProfileEnabled),
        storyAudioUrl: nextStoryAudioUrl || null,
        storyYoutubeUrl: trimmedStoryYoutubeUrl || null,
      };

      const res = await fetch("/api/customer/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "更新個人檔案失敗");
      }

      const savedAvatar = data?.avatarUrl?.trim() || nextAvatarUrl || defaultAvatarUrl;

      setProfile(data);
      setProfileForm({
        name: data.name ?? "",
        avatarUrl: savedAvatar,
        bio: data.bio ?? "",
        publicProfileEnabled: Boolean(data.publicProfileEnabled),
        storyAudioUrl: data.storyAudioUrl ?? "",
        storyYoutubeUrl: data.storyYoutubeUrl ?? "",
      });
      resetAvatarFileSelection(savedAvatar);
      resetStoryAudioSelection(data.storyAudioUrl ?? "");
      setToast({ type: "success", message: "個人檔案已更新" });
      setIsProfileModalOpen(false);

      if (typeof window !== "undefined") {
        saveAuthSession({
          ...(authUser ?? {}),
          id: data.id,
          email: data.email,
          name: data.name,
          username: data.username,
          isBlocked: data.isBlocked,
          avatarUrl: savedAvatar,
          bio: data.bio,
          publicProfileEnabled: data.publicProfileEnabled,
          storyAudioUrl: data.storyAudioUrl,
          storyYoutubeUrl: data.storyYoutubeUrl,
        });
      }
    } catch (error) {
      console.error("更新個人檔案發生錯誤:", error);
      setProfileStatus({
        type: "error",
        message: error.message || "更新個人檔案發生錯誤",
      });
    } finally {
      setProfileSaving(false);
    }
  };

  const handleShareCard = async (card) => {
    if (card?.isPrivate) {
      setToast({ type: "error", message: "不公開的代禱沒有公開分享連結" });
      return;
    }

    const url = buildShareUrl(card);
    if (!url) {
      setToast({ type: "error", message: "無法建立分享連結" });
      return;
    }

    try {
      if (typeof navigator !== "undefined") {
        if (navigator.share) {
          await navigator.share({ title: card.title || "代禱", url });
          setToast({ type: "success", message: "已成功分享" });
          return;
        }

        if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(url);
          setToast({ type: "success", message: "連結已複製" });
          return;
        }
      }

      setToast({
        type: "error",
        message: "裝置不支援自動分享，請手動複製連結",
      });
    } catch (error) {
      console.error("分享代禱發生錯誤:", error);
      setToast({ type: "error", message: "分享失敗，請稍後再試" });
    }
  };



  const handleDeleteCard = async (card) => {
    if (typeof window !== "undefined") {
      const confirmed = window.confirm(`確定要刪除「${card.title}」嗎？`);
      if (!confirmed) return;
    }

    if (card.isBlocked) {
      setToast({ type: "error", message: "代禱已被封存，無法刪除" });
      return;
    }

    setCardAction({ id: card.id, type: "delete" });

    try {
      const res = await fetch(`/api/customer/cards/${card.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.message || "刪除代禱失敗");
      }

      setCards((prev) => prev.filter((item) => item.id !== card.id));
      setToast({ type: "success", message: "代禱已刪除" });
    } catch (error) {
      console.error("刪除代禱發生錯誤:", error);
      setToast({ type: "error", message: error.message || "刪除失敗" });
    } finally {
      setCardAction(null);
    }
  };



  const handleToggleVisibility = async (card) => {
    if (card.isBlocked) {
      setToast({ type: "error", message: "代禱已被封存，無法變更顯示" });
      return;
    }

    setCardAction({ id: card.id, type: "visibility" });

    try {
      // This toggles the card's own "不公開" (private) flag, not the admin-only
      // "isBlocked" moderation flag guarded above — those two used to be conflated
      // here, which meant hiding your own card set isBlocked=true and permanently
      // disabled this same button (the guard above would then always fire).
      const res = await fetch(`/api/customer/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isPrivate: !card.isPrivate }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "更新顯示狀態失敗");
      }

      setCards((prev) => prev.map((item) => (item.id === data.id ? data : item)));
      setToast({
        type: "success",
        message: data.isPrivate ? "代禱已設為不公開" : "代禱已重新公開",
      });
    } catch (error) {
      console.error("更新顯示狀態發生錯誤:", error);
      setToast({ type: "error", message: error.message || "操作失敗" });
    } finally {
      setCardAction(null);
    }
  };




  const handleToggleResponseVisibility = async (reply) => {
    if (!reply?.id) {
      return;
    }

    setResponseAction({ id: reply.id, type: "visibility" });

    try {
      const res = await fetch(`/api/customer/responses/${reply.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isBlocked: !reply.isBlocked }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "無法更新回應顯示狀態。");
      }

      setResponses((prev) =>
        prev.map((item) => (item.id === data.id ? data : item)),
      );
      setToast({
        type: "success",
        message: data.isBlocked ? "回應已隱藏" : "回應已恢復顯示",
      });
    } catch (error) {
      console.error("更新回應顯示狀態時發生錯誤:", error);
      setToast({
        type: "error",
        message: error.message || "無法更新回應顯示狀態。",
      });
    } finally {
      setResponseAction(null);
    }
  };

  const renderCards = () => {
    if (cardsLoading) {
      return <p className="cp-helper">代禱載入中...</p>;
    }

    if (cardsError) {
      return <p className="cp-alert cp-alert--error">{cardsError}</p>;
    }

    if (!cards.length) {
      return (
        <div className="cp-empty">
          <p>目前尚未建立代禱。</p>
          <Link href="/customer-portal/create" className="cp-link">
            點我立即建立代禱
          </Link>
        </div>
      );
    }

    return (
      <div className="cp-cards">
        {cards.map((card) => {
          const responsesCount = card._count?.responses ?? card.responsesCount ?? 0;
          const reportCount = card.reportCount ?? 0;
          const isDeleting = cardAction?.id === card.id && cardAction?.type === "delete";
          const isToggling =
            cardAction?.id === card.id && cardAction?.type === "visibility";
          const canManage = !card.isBlocked;
          const statusLabel = card.isBlocked ? "已封存" : card.isPrivate ? "不公開" : "已公開";
          const coverAlt = card.alt || `${card.title || "代禱"} 封面`;
          const shareHref = buildCardHref(card);
          const shareDisabled = !shareHref;

          return (
            <article
              key={card.id}
              className={`cp-card${card.isBlocked ? " cp-card--muted" : ""}`}
            >
              <div className="cp-card__layout">
                <div className="cp-card__cover">
                  {shareHref ? (
                    <a
                      href={shareHref}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`\u6AA2\u8996 ${card.title || "\u7948\u79B1\u5361\u7247"}`}
                      style={{ display: "block" }}
                    >
                      {card.image ? (
                        <img src={card.image} alt={coverAlt} loading="lazy" />
                      ) : (
                        <div className="cp-card__placeholder">{"\u5C1A\u7121\u5C01\u9762"}</div>
                      )}
                    </a>
                  ) : card.image ? (
                    <img src={card.image} alt={coverAlt} loading="lazy" />
                  ) : (
                    <div className="cp-card__placeholder">{"\u5C1A\u7121\u5C01\u9762"}</div>
                  )}
                </div>
                <div className="cp-card__content">
                  <div className="cp-card__header">
                    <div className="cp-card__title">
                      <h3>{card.title || "未命名的代禱"}</h3>
                      {card.description ? (
                        <p className="cp-card__description">{card.description}</p>
                      ) : (
                        <p className="cp-helper">尚缺少描述文字</p>
                      )}
                    </div>
                    <span
                      className={`cp-status${card.isBlocked || card.isPrivate ? " cp-status--inactive" : ""}`}
                    >
                      {statusLabel}
                    </span>
                  </div>

                  <div className="cp-card__meta">
                    <span>更新：{formatTime(card.updatedAt)}</span>
                    {card.category?.name ? <span>分類：{card.category.name}</span> : null}
                    <span>回應：{responsesCount}</span>
                    <span>檢舉：{reportCount}</span>
                  </div>

                  <div className="cp-card__actions">
                    {canManage ? (
                      <Link
                        href={`/customer-portal/edit/${card.id}`}
                        className="cp-link"
                        prefetch={false}
                      >
                        編輯
                      </Link>
                    ) : (
                      <span className="cp-link cp-link--disabled" aria-disabled="true">
                        編輯
                      </span>
                    )}

                    <button
                      type="button"
                      className="cp-link cp-link--danger"
                      onClick={() => handleDeleteCard(card)}
                      disabled={!canManage || isDeleting}
                    >
                      {isDeleting ? "刪除中..." : "刪除"}
                    </button>

                    <button
                      type="button"
                      className="cp-link"
                      onClick={() => handleShareCard(card)}
                      disabled={shareDisabled}
                      title={card.isPrivate ? "不公開的代禱沒有公開分享連結" : undefined}
                    >
                      分享
                    </button>

                    <button
                      type="button"
                      className="cp-link cp-link--muted"
                      onClick={() => handleToggleVisibility(card)}
                      disabled={!canManage || isToggling}
                    >
                      {isToggling ? "切換中..." : card.isPrivate ? "公開" : "隱藏"}
                    </button>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };








  const renderResponses = () => {
    if (responsesLoading) {
      return <p className="cp-helper">個人回應載入中...</p>;
    }

    if (responsesError) {
      return <p className="cp-alert cp-alert--error">{responsesError}</p>;
    }

    if (!responses.length) {
      return <p className="cp-helper">尚未發表任何個人回應。</p>;
    }

    return (
      <div className="cp-replies">
        {responses.map((reply) => {
          const cardTitle = reply?.homeCard?.title || "代禱";
          const shareHref = reply?.homeCard?.id ? buildCardHref(reply.homeCard) : "";
          const showShareLink = Boolean(shareHref);
          const isToggling =
            responseAction?.id === reply.id && responseAction?.type === "visibility";
          const reportCount = reply.reportCount ?? 0;
          const publishedAt = formatTime(reply.createdAt);
          const cardImage = reply.homeCard?.image;
          const cardAlt = reply.homeCard?.alt || `${cardTitle} 封面`;

          return (
            <article
              key={reply.id}
              className={`cp-reply${reply.isBlocked ? " cp-reply--muted" : ""}`}
            >
              <div className="cp-reply__header">
                <div className="cp-reply__card">
                  {cardImage ? (
                    <img src={cardImage} alt={cardAlt} className="cp-reply__thumb" loading="lazy" />
                  ) : (
                    <span className="cp-reply__thumb cp-reply__thumb--placeholder" aria-hidden="true">🙏</span>
                  )}
                  <div className="cp-reply__card-info">
                    <h3>{cardTitle}</h3>
                    {showShareLink ? (
                      <Link href={shareHref} prefetch={false} className="cp-link">
                        查看代禱
                      </Link>
                    ) : null}
                  </div>
                </div>
                <span className={`cp-status${reply.isBlocked ? " cp-status--inactive" : ""}`}>
                  {reply.isBlocked ? "已隱藏" : "已顯示"}
                </span>
              </div>

              {reply.message ? (
                <p className="cp-reply__content">{reply.message}</p>
              ) : null}

              {reply.voiceUrl ? (
                <GainAudio
                  className="cp-reply__audio"
                  controls
                  preload="none"
                  src={reply.voiceUrl}
                >
                  您的瀏覽器不支援音訊播放。
                </GainAudio>
              ) : null}

              <div className="cp-reply__footer">
                <div className="cp-reply__meta">
                  <span>發佈時間：{publishedAt}</span>
                  <span>檢舉數：{reportCount}</span>
                  <span>獎勵狀態：{REWARD_STATUS_LABELS[reply.rewardStatus] ?? "審核中"}</span>
                  {reply.rewardStatus === "PENDING" && reply.rewardEligibleAt ? (
                    <span>預計結算：{formatTime(reply.rewardEligibleAt)}</span>
                  ) : null}
                </div>
                <div className="cp-reply__actions">
                  <button
                    type="button"
                    className="cp-link cp-link--muted"
                    onClick={() => handleToggleResponseVisibility(reply)}
                    disabled={isToggling}
                  >
                    {isToggling ? "切換中..." : reply.isBlocked ? "顯示" : "隱藏"}
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    );
  };

  const userStats = useMemo(() => {
    const list = Array.isArray(cards) ? cards : [];
    const totalCards = list.length;

    let totalResponses = 0;
    let totalReports = 0;

    for (const card of list) {
      const cardResponses =
        card?._count?.responses ??
        card?.responsesCount ??
        (Array.isArray(card?.responses) ? card.responses.length : 0);
      const cardReports =
        card?.reportCount ??
        card?._count?.reports ??
        (Array.isArray(card?.reports) ? card.reports.length : 0);

      const numericResponses = Number(cardResponses);
      const numericReports = Number(cardReports);

      totalResponses += Number.isFinite(numericResponses) ? numericResponses : 0;
      totalReports += Number.isFinite(numericReports) ? numericReports : 0;
    }

    return { totalCards, totalResponses, totalReports };
  }, [cards]);

  const renderUserStatValue = (value) => {
    if (cardsError) {
      return "載入失敗";
    }
    if (cardsLoading) {
      return "載入中...";
    }
    return value.toLocaleString("zh-TW");
  };


  return (

    <>

      <SiteHeader activePath="/customer-portal" />

      <main className="cp-main">

        {toast ? (

          <div

            className={`cp-toast cp-toast--${toast.type ?? "info"}`}

            role="status"

            aria-live="polite"

          >

            {toast.message}

          </div>

        ) : null}



        {authUser?.isBlocked ? (

          <div className="cp-alert cp-alert--error">

            <h2>帳號已被暫時停權</h2>

            <p>您的帳號目前無法建立或管理代禱。請聯絡系統管理員。</p>

          </div>

        ) : (

          <>

            <section className="cp-profile">
              <div className="cp-profile__avatar">
                <img
                  src={resolvedAvatar}
                  alt={`${resolvedName} 的大頭貼`}
                  loading="lazy"
                />
                <button
                  type="button"
                  className="cp-profile__edit"
                  onClick={handleOpenProfileModal}
                >
                  更新自我介紹
                </button>
              </div>

              <div className="cp-profile__info">
                <div className="cp-profile__meta">
                  <h1>{resolvedName}</h1>
                  <span>{resolvedEmail}</span>
                </div>

                <div className="cp-profile__bio">
                  {profileLoading ? (
                    <p className="cp-helper">資料載入中...</p>
                  ) : profileError ? (
                    <p className="cp-alert cp-alert--error">{profileError}</p>
                  ) : profile?.bio ? (
                    <p>{profile.bio}</p>
                  ) : (
                    <p className="cp-helper">尚未撰寫個人介紹，快來更新讓大家更了解你。</p>
                  )}
                </div>

                <div className="cp-profile__visibility">
                  <strong>{isPublicProfileEnabled ? "公開個人頁已開啟" : "公開個人頁已關閉"}</strong>
                  <p className="cp-helper">
                    開啟後，其他人可以在得勝者專區看到你的暱稱、大頭貼、個人簡介、公開代禱與未被隱藏的回應。
                  </p>
                  {isPublicProfileEnabled && publicProfilePath ? (
                    <Link className="cp-link" href={publicProfilePath} prefetch={false}>
                      查看我的公開頁
                    </Link>
                  ) : publicProfilePath ? (
                    <p className="cp-helper">開啟公開個人頁後，網址會是：{publicProfilePath}</p>
                  ) : (
                    <p className="cp-helper">請先設定 Username，才能產生公開頁網址。</p>
                  )}
                </div>

                <div className="cp-profile__actions">
                  <button
                    type="button"
                    className="cp-button"
                    onClick={handleOpenProfileModal}
                  >
                    編輯個人檔案
                  </button>
                  <Link
                    className="cp-button cp-button--ghost"
                    href="/customer-portal/create"
                    prefetch={false}
                  >
                    新增代禱
                  </Link>
                </div>
              </div>
            </section>



            <section className="section home-stats" aria-label="我的平台統計數據">
              <div className="home-stats__container">
                {/* <article className="home-stats__item">
                  <span className="home-stats__icon" aria-hidden="true">👤</span>
                  <span className="home-stats__label">登入使用者</span>
                  <strong className="home-stats__value">{resolvedName}</strong>
                  <p className="home-stats__hint">{resolvedEmail}</p>
                </article> */}
                <article className="home-stats__item">
                  <span className="home-stats__icon" aria-hidden="true">🙏</span>
                  <span className="home-stats__label">代禱</span>
                  <strong className="home-stats__value">{renderUserStatValue(userStats.totalCards)}</strong>
                  <p className="home-stats__hint">您曾建立的代禱總數</p>
                </article>
                <article className="home-stats__item">
                  <span className="home-stats__icon" aria-hidden="true">🎧</span>
                  <span className="home-stats__label">語音回應</span>
                  <strong className="home-stats__value">{renderUserStatValue(userStats.totalResponses)}</strong>
                  <p className="home-stats__hint">既有語音回應數</p>
                </article>
                {/* <article className="home-stats__item">
                  <span className="home-stats__icon" aria-hidden="true">⚠️</span>
                  <span className="home-stats__label">被檢舉數</span>
                  <strong className="home-stats__value">{renderUserStatValue(userStats.totalReports)}</strong>
                  <p className="home-stats__hint">累計的檢舉紀錄</p>
                </article> */}
              </div>
            </section>

            <section className="cp-section cp-section--cards">

              <div className="cp-section__head">

                <div>

                  <h2>我的禱告</h2>

                  <p>管理所有代禱，為每一則內容新增 1–3 張相簿圖片，這些照片會出現在詳情頁的「代禱相簿」。</p>

                </div>

                <Link

                  href="/customer-portal/create"

                  className="cp-button"

                  prefetch={false}

                >

                  + 建立禱告

                </Link>

              </div>



              {renderCards()}

            </section>

            <section className="cp-section cp-section--replies">
              <div className="cp-section__head">
                <div>
                  <h2>收到的留言與回應</h2>
                  <p>隨時追蹤大家的代禱聲音，必要時可檢舉、分享或隱藏不合適的內容。</p>
                </div>
              </div>

              {renderResponses()}
            </section>

          </>

        )}

      </main>

      <SiteFooter />



      {isProfileModalOpen ? (

        <div className="cp-modal" role="dialog" aria-modal="true">

          <div className="cp-modal__backdrop" onClick={handleCloseProfileModal} />

          <div className="cp-modal__card">

            <header className="cp-modal__header">

              <h3>編輯個人檔案</h3>

              <p>更新自我介紹與大頭貼，讓大家更了解你。</p>

            </header>



            <label className="cp-modal__field">

              <span>顯示名稱</span>

              <input

                type="text"

                value={profileForm.name}

                onChange={updateProfileField("name")}

                placeholder="例如：小美、代禱夥伴"

                disabled={profileSaving}

              />

              <small className="cp-helper">

                這個名稱會顯示在你的代禱與公開見證頁。

              </small>

            </label>



            <label className="cp-modal__field">

              <span>大頭貼圖片</span>

              <input

                ref={avatarFileInputRef}

                type="file"

                accept="image/*"

                onChange={handleAvatarFileChange}

                disabled={profileSaving}

              />

              <small className="cp-helper">

                檔案需小於 5MB，送出時會自動壓縮為最佳格式。

              </small>

              <button

                type="button"

                className="cp-link cp-link--muted"

                onClick={handleUseDefaultAvatar}

                disabled={profileSaving}

              >

                使用預設圖片

              </button>

            </label>



            <label className="cp-modal__field">

              <span>圖片網址（選填）</span>

              <input

                type="url"

                value={profileForm.avatarUrl}

                onChange={updateProfileField("avatarUrl")}

                placeholder="可貼上自訂圖片網址"

                disabled={profileSaving}

              />

              <small className="cp-helper">

                若未輸入會使用預設頭像，或是選擇檔案上傳。

              </small>

            </label>



            <div className="cp-modal__preview">

              {avatarPreview ? (

                <img src={avatarPreview} alt="大頭貼預覽" />

              ) : (

                <div className="cp-modal__placeholder">預覽</div>

              )}

            </div>



            <label className="cp-modal__field">

              <span>個人簡介</span>

              <textarea

                rows={4}

                value={profileForm.bio}

                onChange={updateProfileField("bio")}

                maxLength={MAX_BIO_LENGTH}

                placeholder="分享你的信仰背景、祈禱焦點或協助方式。"

              />

              <small className="cp-helper">

                {profileForm.bio.trim().length} / {MAX_BIO_LENGTH}

              </small>

            </label>

            {STORY_AUDIO_CAPTURE_ENABLED ? (
            <div className="cp-story-recorder">
              <label className="cp-modal__field">
                <span>故事錄音</span>
                <input
                  ref={storyAudioFileInputRef}
                  type="file"
                  accept="audio/*"
                  onChange={handleStoryAudioFileChange}
                  disabled={profileSaving || storyRecording || storyRecorderStep === "countdown"}
                />
                <small className="cp-helper">
                  可上傳音訊檔，或直接錄製最多 5 分鐘的信仰故事。
                </small>
              </label>

              {storyRecordError ? <p className="cp-alert cp-alert--error">{storyRecordError}</p> : null}

              {storyRecorderStep === "countdown" ? (
                <div className="cp-story-recorder__panel" aria-live="polite">
                  <strong>準備錄音</strong>
                  <span>倒數結束後將自動開始。</span>
                  <div className="cp-story-recorder__count">{storyCountdownValue}</div>
                  <button
                    type="button"
                    className="cp-button cp-button--ghost"
                    onClick={() => stopStoryRecording(true)}
                    disabled={profileSaving}
                  >
                    取消
                  </button>
                </div>
              ) : storyRecorderStep === "recording" ? (
                <div className="cp-story-recorder__panel" aria-live="polite">
                  <strong>錄音中</strong>
                  <span>最長可錄製 5 分鐘。</span>
                  <div className="cp-story-recorder__timer">{formatStorySeconds(storyRecordSeconds)}</div>
                  <button
                    type="button"
                    className="cp-button cp-button--danger"
                    onClick={() => stopStoryRecording()}
                    disabled={profileSaving}
                  >
                    停止錄音
                  </button>
                </div>
              ) : (
                <div className="cp-modal__story-actions">
                  <button
                    type="button"
                    className="cp-button cp-button--ghost"
                    onClick={handleStartStoryRecording}
                    disabled={profileSaving}
                  >
                    開始錄製故事
                  </button>
                  {(storyAudioPreview || profileForm.storyAudioUrl) && !storyRecording ? (
                    <button
                      type="button"
                      className="cp-link cp-link--muted"
                      onClick={handleRemoveStoryAudio}
                      disabled={profileSaving}
                    >
                      移除故事錄音
                    </button>
                  ) : null}
                </div>
              )}

              {storyAudioPreview || profileForm.storyAudioUrl ? (
                <div className="cp-story-recorder__review">
                  <GainAudio
                    className="cp-modal__audio"
                    controls
                    preload="metadata"
                    src={storyAudioPreview || profileForm.storyAudioUrl} />
                  {selectedStoryAudioFile ? (
                    <div className="cp-story-recorder__actions">
                      <button
                        type="button"
                        className="cp-button cp-button--ghost"
                        onClick={handleRerecordStoryAudio}
                        disabled={profileSaving}
                      >
                        重新錄音
                      </button>
                      <button
                        type="button"
                        className="cp-button"
                        onClick={handleSaveProfile}
                        disabled={profileSaving}
                      >
                        {profileSaving ? "上傳中..." : "上傳並儲存"}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </div>
            ) : null}

            <label className="cp-modal__field">
              <span>YouTube 故事連結</span>
              <input
                type="url"
                value={profileForm.storyYoutubeUrl}
                onChange={updateProfileField("storyYoutubeUrl")}
                placeholder="https://www.youtube.com/watch?v=..."
                disabled={profileSaving}
              />
              <small className="cp-helper">
                支援 youtube.com/watch、youtube.com/embed 與 youtu.be 連結。
              </small>
            </label>

            <label className="cp-modal__toggle">

              <input

                type="checkbox"

                checked={Boolean(profileForm.publicProfileEnabled)}

                onChange={(event) =>

                  setProfileForm((prev) => ({

                    ...prev,

                    publicProfileEnabled: event.target.checked,

                  }))

                }

                disabled={profileSaving}

              />

              <span>開啟我的公開個人頁</span>

            </label>

            <p className="cp-helper">

              關閉後，得勝者專區將不再顯示你的個人頁與公開入口；已被檢舉或隱藏的內容本來就不會展示。

            </p>

            {profileForm.publicProfileEnabled && publicProfilePath ? (

              <Link href={publicProfilePath} prefetch={false} className="cp-link">

                預覽公開個人頁

              </Link>

            ) : null}

            {profileStatus ? (

              <div

                className={`cp-alert cp-alert--${profileStatus.type ?? "info"}`}

                role="status"

              >

                {profileStatus.message}

              </div>

            ) : null}



            <div className="cp-modal__actions">

              <button

                type="button"

                className="cp-button cp-button--ghost"

                onClick={handleCloseProfileModal}

                disabled={profileSaving}

              >

                取消

              </button>

              <button

                type="button"

                className="cp-button"

                onClick={handleSaveProfile}

                disabled={profileSaving}

              >

                {profileSaving ? "儲存中…" : "儲存變更"}

              </button>

            </div>

          </div>

        </div>

      ) : null}

    </>

  );

}







