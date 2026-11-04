"use client";

import "@/styles/theme-customer.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import CardVoiceRecorder from "@/components/prayer-recorder/CardVoiceRecorder";
import PrayerLocationField from "@/components/PrayerLocationField";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useAuthSession } from "@/hooks/useAuthSession";
import { MAX_CARD_DESCRIPTION_LENGTH } from "@/lib/card-limits";
import { buildCardMetaArray } from "@/lib/card-meta";
import { buildDefaultThumbnailUrl } from "@/lib/default-thumbnail";

const APPROXIMATE_LOCATION_LABEL = "\u5927\u81f4\u4f4d\u7f6e";
const TAIPEI_LOCATION = {
  locationKey: "",
  locationCity: APPROXIMATE_LOCATION_LABEL,
  locationCountry: "",
  locationLat: "25.033000",
  locationLng: "121.565400",
};

const INITIAL_FORM = {
  title: "",
  slug: "",
  image: "",
  alt: "",
  description: "",
  tags: "",
  meta: "",
  detailsHref: "",
  voiceHref: "",
  ...TAIPEI_LOCATION,
  isPrivate: false,
  shareToThreads: false,
  acceptedGuestTerms: false,
  website: "",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;
// 路由改成 /me 之後這個 key 刻意不動：換掉等於把所有人正在寫的草稿
// 從 localStorage 裡弄丟。
const DRAFT_STORAGE_KEY = "customer-portal-create-draft-v1";
const AUTO_SAVE_DELAY_MS = 700;
const UPLOADS_PREFIX = "/uploads/";

function isInternalUploadUrl(value) {
  return typeof value === "string" && value.startsWith(UPLOADS_PREFIX);
}

function normalizeUploadedImage(item) {
  if (!item || typeof item !== "object") return null;
  const url = typeof item.url === "string" ? item.url.trim() : "";
  if (!isInternalUploadUrl(url)) return null;
  const name =
    typeof item.name === "string" && item.name.trim() ? item.name.trim() : "uploaded-image";
  return { url, name };
}

export default function CustomerPortalCreatePage() {
  const authUser = useAuthSession();
  const router = useRouter();

  const [form, setForm] = useState(INITIAL_FORM);
  const [status, setStatus] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [submittedPrivate, setSubmittedPrivate] = useState(false);
  const [submittedDetailHref, setSubmittedDetailHref] = useState("");
  const [redirectTimer, setRedirectTimer] = useState(null);
  const [categories, setCategories] = useState([]);
  const [categoryId, setCategoryId] = useState(null);
  const [categoriesLoading, setCategoriesLoading] = useState(true);
  const [uploadedImages, setUploadedImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVoice, setIsUploadingVoice] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState(null);

  const uploadLockRef = useRef(false);
  const guestTermsRef = useRef(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
      if (!raw) return;
      const draft = JSON.parse(raw);
      if (!draft || typeof draft !== "object") return;

      const hasDraftContent = Boolean(
        draft?.form?.title?.trim?.() ||
        draft?.form?.description?.trim?.() ||
        draft?.form?.image?.trim?.() ||
        (Array.isArray(draft?.uploadedImages) && draft.uploadedImages.length)
      );
      if (!hasDraftContent) return;

      const safeUploadedImages = Array.isArray(draft.uploadedImages)
        ? draft.uploadedImages
            .map(normalizeUploadedImage)
            .filter(Boolean)
            .slice(0, MAX_GALLERY_IMAGES)
        : [];
      const draftCover = typeof draft?.form?.image === "string" ? draft.form.image.trim() : "";
      const safeCoverImage = isInternalUploadUrl(draftCover)
        ? draftCover
        : safeUploadedImages[0]?.url || "";

      setForm((prev) => ({
        ...prev,
        ...draft.form,
        shareToThreads: false,
        image: safeCoverImage,
        locationKey: "",
        locationCity: APPROXIMATE_LOCATION_LABEL,
        locationCountry: "",
        locationLat: draft.form?.locationLat || TAIPEI_LOCATION.locationLat,
        locationLng: draft.form?.locationLng || TAIPEI_LOCATION.locationLng,
      }));
      setUploadedImages(safeUploadedImages);
      if (Number.isFinite(draft.categoryId)) {
        setCategoryId((prev) => prev ?? draft.categoryId);
      }
      if (draft.savedAt) {
        setLastAutoSavedAt(draft.savedAt);
      }
      setStatus({ type: "info", message: "已還原上次未送出的草稿" });
    } catch (error) {
      console.warn("restore draft failed", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasContent = Boolean(
      form.title.trim() || form.description.trim() || form.image.trim() || uploadedImages.length
    );
    if (!hasContent) {
      window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      setLastAutoSavedAt(null);
      return;
    }

    const timer = window.setTimeout(() => {
      try {
        const savedAt = new Date().toISOString();
        window.localStorage.setItem(
          DRAFT_STORAGE_KEY,
          JSON.stringify({
            form: { ...form, shareToThreads: false },
            categoryId,
            uploadedImages,
            savedAt,
          })
        );
        setLastAutoSavedAt(savedAt);
      } catch (error) {
        console.warn("save draft failed", error);
      }
    }, AUTO_SAVE_DELAY_MS);

    return () => window.clearTimeout(timer);
  }, [form, categoryId, uploadedImages]);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/home-categories", { cache: "no-store" });
        if (!response.ok) throw new Error("無法載入分類");
        const data = await response.json();
        if (mounted) {
          setCategories(data);
          setCategoryId((prev) => prev ?? data[0]?.id ?? null);
        }
      } catch (error) {
        if (mounted) {
          setStatus({ type: "error", message: error.message });
        }
      } finally {
        if (mounted) {
          setCategoriesLoading(false);
        }
      }
    };

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (redirectTimer) {
        clearTimeout(redirectTimer);
      }
    },
    [redirectTimer]
  );

  const updateFormField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
    if (field === "image") {
      setStatus(null);
    }
  };

  const updateLocation = (nextLocation) => {
    setForm((prev) => ({ ...prev, ...nextLocation }));
  };

  const handleFileChange = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (!files.length) return;
    if (!authUser?.id) {
      setStatus({ type: "error", message: "訪客可以先送出文字代禱；圖片上傳需登入會員。" });
      return;
    }
    if (uploadLockRef.current) return;

    const currentImages = uploadedImages.slice(0, MAX_GALLERY_IMAGES);
    const availableSlots = MAX_GALLERY_IMAGES - currentImages.length;
    if (availableSlots <= 0) {
      setStatus({ type: "error", message: `最多只能上傳 ${MAX_GALLERY_IMAGES} 張圖片` });
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (!imageFiles.length) {
      setStatus({ type: "error", message: "請選擇圖片檔案" });
      return;
    }

    const selected = imageFiles.slice(0, availableSlots);
    const uploadedBatch = [];
    let successCount = 0;
    let lastError = "";

    uploadLockRef.current = true;
    setIsUploadingImage(true);
    setStatus({ type: "info", message: "圖片上傳中..." });

    try {
      for (const file of selected) {
        if (file.size > MAX_UPLOAD_BYTES) {
          lastError = `${file.name} 超過 10MB 限制`;
          continue;
        }

        const formData = new FormData();
        formData.append("file", file);

        try {
          const response = await fetch("/api/upload-image", {
            method: "POST",
            body: formData,
          });

          if (!response.ok) {
            const error = await response.json().catch(() => ({ message: "圖片上傳失敗" }));
            throw new Error(error.message || "圖片上傳失敗");
          }

          const result = await response.json();
          const image = normalizeUploadedImage({ url: result.url, name: file.name });
          if (!image) {
            throw new Error("上傳圖片來源不合法，請重新上傳");
          }
          if (!uploadedBatch.some((item) => item.url === image.url)) {
            uploadedBatch.push(image);
            successCount += 1;
          }
        } catch (error) {
          console.error("圖片上傳失敗:", error);
          lastError = error.message || "圖片上傳失敗";
        }
      }
    } finally {
      uploadLockRef.current = false;
      setIsUploadingImage(false);
    }

    const mergedImages = [...currentImages];
    for (const image of uploadedBatch) {
      if (mergedImages.some((item) => item.url === image.url)) continue;
      mergedImages.push(image);
      if (mergedImages.length >= MAX_GALLERY_IMAGES) break;
    }

    setUploadedImages(mergedImages);

    if (successCount > 0) {
      setStatus({ type: "success", message: `已上傳 ${successCount} 張圖片` });
    } else if (lastError) {
      setStatus({ type: "error", message: lastError });
    } else if (!mergedImages.length) {
      setStatus(null);
    }

    if (!form.image.trim() && mergedImages.length) {
      setForm((prev) => ({ ...prev, image: mergedImages[mergedImages.length - 1].url }));
    }
  };

  const selectUploadedImage = (url) => {
    setForm((prev) => ({ ...prev, image: url }));
    setStatus(null);
  };

  const removeUploadedImage = (url) => {
    const next = uploadedImages.filter((item) => item.url !== url);
    setUploadedImages(next);
    if (form.image === url) {
      setForm((prev) => ({ ...prev, image: next[0]?.url ?? "" }));
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!categoryId) {
      setStatus({ type: "error", message: "請選擇分類" });
      return;
    }

    const isGuest = !authUser?.id;
    const uploadedCoverImage = form.image.trim();
    if (uploadedCoverImage && !isInternalUploadUrl(uploadedCoverImage)) {
      setStatus({ type: "error", message: "封面圖片需使用站內上傳檔案，不能使用外部網址" });
      return;
    }

    if (isGuest && uploadedCoverImage) {
      setStatus({ type: "error", message: "訪客代禱會使用系統預設圖片；登入後可上傳圖片。" });
      return;
    }

    if (isGuest && !form.acceptedGuestTerms) {
      setStatus({ type: "error", message: "請先確認訪客送出提醒。" });
      return;
    }

    if (!form.description.trim()) {
      setStatus({ type: "error", message: "請至少填寫一段代禱內容" });
      return;
    }

    setSubmitting(true);
    setStatus(null);

    const infoLines = form.meta
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);
    const galleryUrls = uploadedImages.map((item) => item.url).filter(isInternalUploadUrl);
    const coverImage = uploadedCoverImage || buildDefaultThumbnailUrl(form.title);

    const payload = {
      title: form.title.trim(),
      slug: form.slug.trim(),
      image: coverImage,
      alt: form.alt.trim(),
      description: form.description,
      // 沒填標籤時用所選分類當標籤，不再一律預設成「健康」。
      tags: (form.tags.trim()
        ? form.tags
        : categories.find((category) => category.id === categoryId)?.name || "")
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
      meta: buildCardMetaArray(infoLines, galleryUrls),
      detailsHref: form.detailsHref.trim(),
      voiceHref: form.voiceHref.trim(),
      categoryId,
      locationKey: form.locationKey,
      locationCity: form.locationCity.trim(),
      locationCountry: form.locationCountry.trim(),
      locationLat: form.locationLat.trim(),
      locationLng: form.locationLng.trim(),
      isPrivate: Boolean(form.isPrivate),
      shareToThreads: Boolean(form.shareToThreads && !form.isPrivate),
      acceptedGuestTerms: Boolean(form.acceptedGuestTerms),
      website: form.website,
    };

    try {
      const response = await fetch("/api/home-cards", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "建立失敗" }));
        throw new Error(error.message || "建立失敗");
      }

      const createdCard = await response.json().catch(() => null);
      const createdAsPrivate = Boolean(payload.isPrivate);
      // 公開且不需審核的代禱，送出後直接帶到它的頁面，讓人可以馬上分享出去。
      const createdDetailHref =
        createdCard?.id && !createdAsPrivate && !createdCard.needsReview
          ? `/prayfor/${createdCard.id}?shared=new`
          : "";
      setSubmittedDetailHref(createdDetailHref);
      setSubmittedPrivate(createdAsPrivate);
      setStatus({
        type: "success",
        message: payload.shareToThreads
          ? "你的代禱已送出。你同意分享的內容已交給管理員審閱，通過後才會發布到 Start Pray 官方 Threads。"
          : isGuest
          ? "你的代禱已送出，會以匿名使用者顯示。"
          : createdAsPrivate
            ? "你的禱告已儲存為不公開，地圖上只會顯示大概位置。"
            : "你的禱告已加入世界地圖，你所在的地區會亮起來。",
      });
      setForm(INITIAL_FORM);
      setUploadedImages([]);
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(DRAFT_STORAGE_KEY);
      }
      setLastAutoSavedAt(null);
      setShowModal(true);

      const timer = setTimeout(() => {
        router.push(createdDetailHref || (isGuest ? "/prayfor" : "/me"));
      }, 1000);
      setRedirectTimer(timer);
    } catch (error) {
      setStatus({ type: "error", message: error.message || "建立失敗" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleGuestTermsRequired = () => {
    setStatus({ type: "error", message: "請先勾選「我了解訪客送出後無法自行編輯或刪除」再送出。" });
    guestTermsRef.current?.focus();
  };

  const previewImage = form.image.trim() || buildDefaultThumbnailUrl(form.title || "代禱預覽");
  const isGuestUser = !authUser?.id;
  const needsGuestTerms = isGuestUser && !form.acceptedGuestTerms;

  return (
    <>
      <SiteHeader activePath="/me" />
      <main className="customer-create">
        <div className="customer-create__header-band">
          <h1>寫下一件需要被守望的事</h1>
          <p>把現在的處境說清楚就好，不需要寫得漂亮。</p>
        </div>

        <form className="customer-create__form" onSubmit={handleSubmit}>
          {status ? (
            <div
              className={`customer-create__status customer-create__status--${status.type}`}
              role="alert"
            >
              {status.message}
            </div>
          ) : null}

          <section className="customer-create__step">
            <div className="customer-create__step-head">
              <span>01</span>
              <div>
                <h2>你想為什麼事禱告？</h2>
                <p>先用最少資訊讓人理解這個代禱。</p>
              </div>
            </div>

            {!authUser?.id ? (
              <div className="customer-create__notice" role="note">
                訪客可以送出文字代禱，系統會以匿名使用者顯示，並使用預設圖片。登入後可管理內容與上傳圖片。
              </div>
            ) : null}

            <div className="customer-create__row customer-create__row--equal">
              <label>
                <span>標題 *</span>
                <input
                  type="text"
                  value={form.title}
                  onChange={updateFormField("title")}
                  placeholder="例如：為家人健康與平安代禱"
                  required
                />
              </label>
            </div>

            <div className="customer-create__row customer-create__category-field">
              <label>
                <span>分類 *</span>
                <select
                  value={categoryId ?? ""}
                  onChange={(event) => setCategoryId(Number(event.target.value))}
                  disabled={categoriesLoading || categories.length === 0}
                  required
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="customer-create__category-chips" role="group" aria-label="選擇代禱分類">
                {categoriesLoading ? (
                  <span className="cp-helper">正在載入主題…</span>
                ) : categories.length ? (
                  categories.map((category) => (
                    <button
                      key={category.id}
                      type="button"
                      className={categoryId === category.id ? "is-active" : ""}
                      aria-pressed={categoryId === category.id}
                      onClick={() => setCategoryId(category.id)}
                      disabled={submitting}
                    >
                      {category.name}
                    </button>
                  ))
                ) : (
                  <span className="cp-helper">目前沒有可選主題</span>
                )}
              </div>
            </div>

            <div className="customer-create__row customer-create__row--description">
              <label>
                <span>代禱內容 *</span>
                <textarea
                  value={form.description}
                  onChange={updateFormField("description")}
                  placeholder="請直接輸入代禱內容，清楚描述目前情況、需要代禱與盼望。"
                  rows={5}
                  maxLength={MAX_CARD_DESCRIPTION_LENGTH}
                  required
                />
                <small className="cp-helper">
                  一段真實的近況就可以。（{form.description.length} / {MAX_CARD_DESCRIPTION_LENGTH} 字）
                </small>
              </label>
            </div>
          </section>

          <section className="customer-create__step customer-create__step--privacy">
            <div className="customer-create__step-head">
              <span>02</span>
              <div>
                <h2>選擇誰可以看見</h2>
                <p>先決定這份代禱是否公開，其他設定都可以略過。</p>
              </div>
            </div>
            <div className="customer-create__privacy-options" role="group" aria-label="代禱公開設定">
              <button
                type="button"
                className={`customer-create__privacy-option${!form.isPrivate ? " is-active" : ""}`}
                aria-pressed={!form.isPrivate}
                onClick={() => setForm((prev) => ({ ...prev, isPrivate: false }))}
                disabled={submitting}
              >
                <span className="customer-create__privacy-option-mark" aria-hidden="true" />
                <span>
                  <strong>公開代禱</strong>
                  <small>其他人可以看見標題和內容，也能留下文字或語音回應。</small>
                </span>
              </button>
              <button
                type="button"
                className={`customer-create__privacy-option${form.isPrivate ? " is-active" : ""}`}
                aria-pressed={form.isPrivate}
                onClick={() => setForm((prev) => ({ ...prev, isPrivate: true, shareToThreads: false }))}
                disabled={submitting}
              >
                <span className="customer-create__privacy-option-mark" aria-hidden="true" />
                <span>
                  <strong>不公開內容</strong>
                  <small>標題、內文、圖片與上傳者不會公開；地圖只顯示大概位置與統計。</small>
                </span>
              </button>
            </div>
            {!form.isPrivate ? (
              <>
                <p className="customer-create__privacy-hint">
                  目前設定為公開。請確認內容不含真實姓名、電話、住址或其他不想公開的資訊。
                </p>
                <div className="customer-create__privacy-card customer-create__threads-consent">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.shareToThreads}
                      onChange={updateFormField("shareToThreads")}
                      disabled={submitting}
                    />
                    <span>
                      <strong>同意提交管理員審閱，可能發布到 Start Pray 官方 Threads</strong>
                      <small>選填，不影響代禱送出。貼文會包含代禱標題與公開連結，管理員會先審核並可編輯。請勿在標題放入姓名等敏感資料。</small>
                    </span>
                  </label>
                </div>
              </>
            ) : null}
          </section>

          <section className="customer-create__step">
            <div className="customer-create__step-head">
              <span>03</span>
              <div>
                <h2>其他資訊 <small>選填</small></h2>
                <p>不設定也可以直接建立代禱。</p>
              </div>
            </div>

            {!authUser?.id ? (
              <input
                type="text"
                value={form.website}
                onChange={updateFormField("website")}
                tabIndex={-1}
                autoComplete="off"
                className="customer-create__honeypot"
                aria-hidden="true"
              />
            ) : null}

            <details className="customer-create__advanced customer-create__location-details">
              <summary>
                地圖上的大概位置
                <small>
                  目前：
                  {form.locationCity && form.locationCity !== APPROXIMATE_LOCATION_LABEL
                    ? form.locationCity
                    : form.locationCountry || "台灣台北附近"}
                </small>
              </summary>
              <div className="customer-create__advanced-body">
                <p className="cp-helper">地圖只顯示大概位置，不會顯示你的精確地址。</p>
                <PrayerLocationField value={form} onChange={updateLocation} disabled={submitting} />
              </div>
            </details>

            <details className="customer-create__advanced">
              <summary>新增圖片或語音 <small>{authUser?.id ? "選填" : "登入後可用"}</small></summary>
              <div className="customer-create__advanced-body">
                {authUser?.id ? (
                  <div className="customer-create__row">
                    <CardVoiceRecorder
                      value={form.voiceHref}
                      onChange={(url) => setForm((prev) => ({ ...prev, voiceHref: url }))}
                      onUploadingChange={setIsUploadingVoice}
                      disabled={submitting}
                    />
                  </div>
                ) : (
                  <p className="cp-helper">訪客可以先送出文字代禱；登入後可加入語音和上傳圖片。</p>
                )}

                <div className="customer-create__row">
                  <label className="customer-create__file-label">
                    <span>上傳圖片（最多 3 張）</span>
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleFileChange}
                      disabled={
                        !authUser?.id || isUploadingImage || uploadedImages.length >= MAX_GALLERY_IMAGES
                      }
                    />
                    <small className="cp-helper">
                      {authUser?.id
                        ? `支援 JPG、PNG、WEBP，每張上限 10MB，最多 ${MAX_GALLERY_IMAGES} 張。圖片上傳後會壓縮儲存；不支援外部圖片網址。`
                        : "訪客送出會使用系統預設圖片；登入後可上傳圖片。"}
                    </small>
                  </label>
                  {uploadedImages.length ? (
                    <div className="customer-create__gallery">
                      {uploadedImages.map(({ url, name }) => {
                        const isActive = form.image === url;
                        return (
                          <figure
                            key={url}
                            className={`customer-create__gallery-item${isActive ? " active" : ""}`}
                          >
                            <button type="button" onClick={() => selectUploadedImage(url)}>
                              <img src={url} alt={name} />
                            </button>
                            <figcaption>
                              <span title={name}>{name}</span>
                              <button type="button" onClick={() => removeUploadedImage(url)}>
                                移除
                              </button>
                            </figcaption>
                          </figure>
                        );
                      })}
                    </div>
                  ) : null}
                </div>

              </div>
            </details>
          </section>

          <section className="customer-create__step customer-create__preview-step">
            <div className="customer-create__step-head">
              <span>✓</span>
              <div>
                <h2>送出前看一眼</h2>
                <p>公開時，這是大家會看到的代禱卡內容。</p>
              </div>
            </div>
            {form.isPrivate ? (
              <p className="customer-create__private-preview">
                這份代禱會設為不公開，不會出現在公開頁面；地圖只顯示大概位置與統計。
              </p>
            ) : (
              <article className="customer-create__card-preview">
                <img src={previewImage} alt="" />
                <div>
                  <span>{categories.find((category) => category.id === categoryId)?.name || "代禱"}</span>
                  <strong>{form.title.trim() || "你的代禱標題會顯示在這裡"}</strong>
                  <p>{form.description.trim() || "你的代禱內容會顯示在這裡"}</p>
                </div>
              </article>
            )}
          </section>

          <div className="customer-create__actions">
            {!authUser?.id ? (
              <div className="customer-create__privacy-card customer-create__guest-consent">
                <label>
                  <input
                    ref={guestTermsRef}
                    type="checkbox"
                    checked={form.acceptedGuestTerms}
                    onChange={updateFormField("acceptedGuestTerms")}
                  />
                  <span>
                    <strong>我了解訪客送出後無法自行編輯或刪除</strong>
                    <small>
                      請不要填寫真實姓名、電話、住址或其他敏感個資。需要修改時需聯絡管理員。
                    </small>
                  </span>
                </label>
              </div>
            ) : null}
            <button
              type={needsGuestTerms ? "button" : "submit"}
              className={`button button--primary${needsGuestTerms ? " is-disabled" : ""}`}
              disabled={submitting || isUploadingImage || isUploadingVoice}
              aria-disabled={needsGuestTerms || submitting || isUploadingImage || isUploadingVoice}
              onClick={needsGuestTerms ? handleGuestTermsRequired : undefined}
            >
              {submitting ? "建立中..." : "建立代禱"}
            </button>
            <Link
              href={authUser?.id ? "/me" : "/login?next=/me/create"}
              className="button button--ghost"
              prefetch={false}
            >
              {authUser?.id ? "返回管理頁" : "前往登入"}
            </Link>
          </div>
        </form>
      </main>
      <SiteFooter />

      {showModal ? (
        <div className="customer-create__modal" role="alert" aria-live="assertive">
          <div className="customer-create__modal-card">
            <h3>建立成功</h3>
            <p>
              {submittedDetailHref
                ? "你的代禱已經發布。1 秒後帶你到代禱頁，可以分享給朋友一起禱告。"
                : authUser?.id
                ? submittedPrivate
                  ? "這則代禱已設為不公開，公開頁與搜尋不會顯示；1 秒後會回到管理頁。"
                  : "你的禱告已加入世界地圖，你所在的地區會亮起來。1 秒後回到管理頁。"
                : "你的代禱已送出。1 秒後會前往禱告牆。"}
            </p>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .customer-create {
          background:
            radial-gradient(circle at 8% 12%, rgba(59, 130, 246, 0.12), transparent 42%),
            radial-gradient(circle at 90% 82%, rgba(20, 184, 166, 0.1), transparent 46%);
          padding-bottom: 4rem;
        }


        /* 標題跟表單對齊同一欄，大螢幕上不會一個貼左、一個置中。 */
        .customer-create__header-band {
          width: min(980px, 100%);
          margin: 0 auto;
        }

        .customer-create__form {
          width: min(980px, 100%);
          margin: 0.75rem auto 0;
          padding: clamp(0.78rem, 2vw, 1.1rem);
          border-radius: 14px;
          border: 1px solid var(--line-1);
          background: var(--surface-1);
          box-shadow: var(--elev-2);
        }

        .customer-create__step {
          display: grid;
          gap: 0.78rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          padding: clamp(0.78rem, 2vw, 1rem);
          background: var(--surface-3);
        }

        .customer-create__step + .customer-create__step {
          margin-top: 0.9rem;
        }

        .customer-create__step-head {
          display: flex;
          align-items: flex-start;
          gap: 0.72rem;
        }

        .customer-create__step-head > span {
          display: grid;
          flex: 0 0 auto;
          place-items: center;
          width: 2rem;
          height: 2rem;
          border: 1px solid rgba(125, 211, 252, 0.34);
          border-radius: 999px;
          color: var(--accent-text);
          font-size: 0.78rem;
          font-weight: 900;
          background: var(--accent-soft);
        }

        .customer-create__step-head h2,
        .customer-create__step-head p {
          margin: 0;
        }

        .customer-create__step-head h2 {
          color: var(--text-1);
          font-size: 1.05rem;
          line-height: 1.25;
        }

        .customer-create__step-head p {
          margin-top: 0.22rem;
          color: var(--text-2);
          font-size: 0.84rem;
          line-height: 1.5;
        }

        .customer-create__step--map {
          background: var(--surface-3);
        }

        .customer-create__category-chips { display: none; }

        .customer-create__privacy-options {
          display: grid;
          gap: 0.6rem;
        }

        .customer-create__privacy-option {
          display: grid;
          grid-template-columns: 1.25rem minmax(0, 1fr);
          align-items: start;
          gap: 0.65rem;
          width: 100%;
          min-height: 64px;
          padding: 0.75rem;
          border: 1px solid var(--line-2);
          border-radius: 12px;
          color: var(--text-1);
          background: var(--surface-1);
          text-align: left;
          cursor: pointer;
        }

        .customer-create__privacy-option.is-active {
          border: 2px solid var(--link);
          padding: calc(0.75rem - 1px);
          background: rgba(49, 95, 145, 0.08);
        }

        .customer-create__privacy-option-mark {
          width: 1rem;
          height: 1rem;
          margin-top: 0.1rem;
          border: 1.5px solid var(--text-3);
          border-radius: 50%;
          background: var(--surface-1);
        }

        .customer-create__privacy-option.is-active .customer-create__privacy-option-mark {
          border: 5px solid var(--link);
        }

        .customer-create__privacy-option strong,
        .customer-create__privacy-option small { display: block; }

        .customer-create__privacy-option strong {
          margin-bottom: 0.2rem;
          font-size: 0.92rem;
        }

        .customer-create__privacy-option small,
        .customer-create__privacy-hint,
        .customer-create__step-head h2 small {
          color: var(--text-2);
          font-size: 0.78rem;
          line-height: 1.5;
        }

        .customer-create__privacy-hint {
          margin: 0;
          padding: 0.65rem 0.72rem;
          border-radius: 10px;
          background: var(--surface-2);
        }

        .customer-create__step-head h2 small {
          margin-left: 0.25rem;
          font-weight: 500;
        }

        .customer-create__advanced summary small {
          margin-left: auto;
          color: var(--text-2);
          font-size: 0.75rem;
          font-weight: 600;
        }

        .customer-create__card-preview {
          overflow: hidden;
          border: 1px solid var(--line-1);
          border-radius: 12px;
          background: var(--surface-1);
        }

        .customer-create__card-preview img {
          display: block;
          width: 100%;
          height: 8rem;
          object-fit: cover;
          background: var(--surface-2);
        }

        .customer-create__card-preview > div {
          display: grid;
          gap: 0.25rem;
          padding: 0.75rem;
        }

        .customer-create__card-preview span {
          color: var(--link);
          font-size: 0.75rem;
          font-weight: 800;
        }

        .customer-create__card-preview strong {
          color: var(--text-1);
          font-size: 0.92rem;
          line-height: 1.45;
        }

        .customer-create__card-preview p,
        .customer-create__private-preview {
          margin: 0;
          color: var(--text-2);
          font-size: 0.82rem;
          line-height: 1.55;
        }

        .customer-create__private-preview {
          padding: 0.8rem;
          border-radius: 10px;
          background: var(--surface-2);
        }

        .customer-create__row label {
          display: grid;
          gap: 0.42rem;
        }

        .customer-create__row label > span {
          color: var(--text-1);
          font-size: 0.84rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .customer-create__row input,
        .customer-create__row select,
        .customer-create__row textarea {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.36);
          background: var(--surface-2);
          color: var(--text-1);
          min-height: 44px;
          padding: 0.7rem 0.78rem;
        }

        .customer-create__row input::placeholder,
        .customer-create__row textarea::placeholder {
          color: rgba(148, 163, 184, 0.88);
        }

        .customer-create__row input:focus,
        .customer-create__row select:focus,
        .customer-create__row textarea:focus {
          outline: none;
          border-color: rgba(125, 211, 252, 0.9);
          box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.22);
        }

        .customer-create__preview {
          border: 1px dashed var(--line-2);
          border-radius: 12px;
          min-height: 180px;
          display: grid;
          place-items: center;
          background: var(--surface-2);
        }

        .customer-create__preview-block {
          display: grid;
          gap: 0.45rem;
        }

        .customer-create__preview-block > span {
          color: var(--text-1);
          font-size: 0.84rem;
          font-weight: 800;
        }

        .customer-create__privacy-card {
          border: 1px solid rgba(125, 211, 252, 0.22);
          border-radius: 12px;
          background: rgba(14, 165, 233, 0.07);
          padding: 0.78rem;
        }

        .customer-create__privacy-card label {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
          color: var(--text-1);
        }

        .customer-create__privacy-card input {
          width: 20px;
          height: 20px;
          margin-top: 0.15rem;
          accent-color: #38bdf8;
        }

        .customer-create__privacy-card span {
          display: grid;
          gap: 0.25rem;
        }

        .customer-create__privacy-card strong {
          color: var(--text-1);
        }

        .customer-create__privacy-card small {
          color: var(--text-2);
          line-height: 1.55;
        }

        .customer-create__preview img {
          width: 100%;
          height: 100%;
          max-height: 360px;
          object-fit: cover;
          border-radius: 16px;
        }

        .customer-create__placeholder {
          color: var(--text-2);
          font-size: 0.9rem;
        }

        .customer-create__status {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background: var(--surface-2);
          padding: 0.65rem 0.78rem;
        }

        .customer-create__mode {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1rem;
          border: 1px solid rgba(125, 211, 252, 0.2);
          border-radius: 16px;
          padding: 0.9rem;
          background: var(--surface-3);
        }

        .customer-create__mode span,
        .customer-create__mode p {
          margin: 0;
        }

        .customer-create__mode span {
          color: var(--text-1);
          font-weight: 900;
        }

        .customer-create__mode p {
          margin-top: 0.25rem;
          color: var(--text-2);
          font-size: 0.85rem;
        }

        .customer-create__mode-actions {
          display: flex;
          gap: 0.45rem;
          flex: 0 0 auto;
        }

        .customer-create__mode-actions button {
          min-height: 38px;
          border: 1px solid rgba(148, 163, 184, 0.28);
          border-radius: 999px;
          padding: 0 0.8rem;
          color: #cbd5e1;
          background: var(--surface-2);
          cursor: pointer;
          font-weight: 900;
        }

        .customer-create__mode-actions button.is-active {
          border-color: rgba(125, 211, 252, 0.62);
          color: var(--text-1);
          background: rgba(14, 165, 233, 0.22);
        }

        .customer-create__actions {
          margin-top: 0.2rem;
          display: flex;
          gap: 0.65rem;
        }

        .customer-create__actions :global(.button) {
          min-height: 44px;
          border-radius: 12px;
          font-weight: 700;
        }

        .customer-create__actions :global(.button--primary) {
          background: var(--accent);
          color: var(--text-on-accent);
          border-color: transparent;
        }

        .customer-create__actions :global(.button--primary.is-disabled),
        .customer-create__actions :global(.button--primary:disabled) {
          opacity: 0.56;
          cursor: not-allowed;
          filter: grayscale(0.18);
        }

        .customer-create__actions :global(.button--ghost) {
          border-color: rgba(148, 163, 184, 0.45);
          color: var(--text-1);
          background: var(--surface-3);
        }

        .customer-create__row--description textarea {
          min-height: 220px;
          line-height: 1.7;
          resize: vertical;
        }

        .customer-create__row--description .cp-helper {
          margin: 0;
        }

        @media (max-width: 640px) {
          .customer-create {
            padding-inline: 0.55rem;
            padding-bottom: calc(11.5rem + env(safe-area-inset-bottom));
          }


          .customer-create__form {
            border-radius: 12px;
            padding: 0.62rem;
            width: min(100%, calc(100vw - 1.1rem));
            margin-top: 0.6rem;
          }

          .customer-create__step {
            padding: 0.68rem;
            border-radius: 12px;
          }

          .customer-create__step-head {
            gap: 0.58rem;
          }

          .customer-create__step-head h2 {
            font-size: 0.94rem;
          }

          .customer-create__step-head p {
            font-size: 0.8rem;
            line-height: 1.45;
          }

          .customer-create__mode {
            align-items: stretch;
            flex-direction: column;
          }

          .customer-create__mode-actions button {
            flex: 1;
          }

          .customer-create__category-field > label select { display: none; }

          .customer-create__category-chips {
            display: flex;
            flex-wrap: wrap;
            gap: 0.42rem;
          }

          .customer-create__category-chips button {
            min-height: 40px;
            padding: 0.45rem 0.65rem;
            border: 1px solid var(--line-2);
            border-radius: 999px;
            color: var(--text-1);
            background: var(--surface-1);
            font-size: 0.78rem;
            font-weight: 700;
            cursor: pointer;
          }

          .customer-create__category-chips button.is-active {
            border-color: var(--link);
            color: var(--link);
            background: rgba(49, 95, 145, 0.08);
            box-shadow: inset 0 0 0 1px var(--link);
          }

          .customer-create__privacy-option { min-height: 70px; }

          .customer-create__actions {
            flex-direction: column;
            position: fixed;
            left: 50%;
            bottom: 0;
            z-index: 200;
            width: min(100vw, 640px);
            margin: 0;
            padding: 0.55rem 0.85rem calc(0.7rem + env(safe-area-inset-bottom));
            transform: translateX(-50%);
            border: 0;
            border-top: 1px solid var(--line-1);
            border-radius: 14px 14px 0 0;
            background: rgba(255, 255, 255, 0.97);
            box-shadow: 0 -8px 24px rgba(16, 24, 40, 0.12);
            backdrop-filter: blur(14px);
          }

          .customer-create__guest-consent {
            padding: 0.35rem 0.2rem;
            border: 0;
            background: transparent;
          }

          .customer-create__guest-consent label { gap: 0.55rem; }
          .customer-create__guest-consent small { font-size: 0.7rem; }

          .customer-create__actions :global(.button) {
            width: 100%;
            justify-content: center;
          }

          .customer-create__actions :global(.button--ghost) { display: none; }

          .customer-create__row--description textarea {
            min-height: 180px;
          }
        }

        .customer-create__advanced {
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: var(--surface-3);
          overflow: hidden;
        }

        .customer-create__advanced summary {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 0.85rem;
          color: var(--text-1);
          cursor: pointer;
          font-weight: 900;
        }

        .customer-create__advanced-body {
          display: grid;
          gap: 0.85rem;
          border-top: 1px solid rgba(148, 163, 184, 0.14);
          padding: 0.85rem;
        }

        .customer-create__gallery {
          display: grid;
          gap: 12px;
          margin-top: 12px;
          grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
        }

        @media (max-width: 640px) {
          .customer-create__gallery {
            gap: 10px;
          }
        }

        @media (max-width: 480px) {
          .customer-create__gallery {
            grid-auto-flow: column;
            grid-auto-columns: minmax(160px, 1fr);
            overflow-x: auto;
            padding-bottom: 6px;
            scroll-snap-type: x proximity;
            -webkit-overflow-scrolling: touch;
          }
        }

        .customer-create__gallery-item {
          border: 1px solid #d1d5db;
          border-radius: 12px;
          overflow: hidden;
          background: #fff;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .customer-create__gallery-item.active {
          border-color: #2563eb;
          box-shadow: 0 0 0 2px rgba(37, 99, 235, 0.25);
        }

        .customer-create__gallery-item button {
          all: unset;
          cursor: pointer;
          display: block;
          width: 100%;
          aspect-ratio: 4 / 3;
        }

        .customer-create__gallery-item img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .customer-create__gallery-item figcaption {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 4px 8px 8px;
          font-size: 12px;
        }

        @media (max-width: 480px) {
          .customer-create__gallery-item {
            scroll-snap-align: start;
          }

          .customer-create__gallery-item figcaption {
            font-size: 11px;
          }
        }

        .customer-create__gallery-item figcaption button {
          all: unset;
          cursor: pointer;
          color: #dc2626;
        }

        .customer-create__gallery-item figcaption span {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          max-width: 100%;
        }

        .customer-create__file-label input[type="file"] {
          width: 100%;
        }

        .customer-create__honeypot {
          position: absolute;
          left: -10000px;
          width: 1px;
          height: 1px;
          opacity: 0;
          pointer-events: none;
        }
      `}</style>
    </>
  );
}
