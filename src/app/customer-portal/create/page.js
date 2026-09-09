"use client";

import "@/styles/theme-customer.css";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import CardVoiceRecorder from "@/components/prayer-recorder/CardVoiceRecorder";
import PrayerLocationField from "@/components/PrayerLocationField";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { useAuthSession } from "@/hooks/useAuthSession";
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
const DEFAULT_PRAYER_TAG = "健康";

const INITIAL_FORM = {
  title: "",
  slug: "",
  image: "",
  alt: "",
  description: "",
  tags: DEFAULT_PRAYER_TAG,
  meta: "",
  detailsHref: "",
  voiceHref: "",
  ...TAIPEI_LOCATION,
  isPrivate: false,
  acceptedGuestTerms: false,
  website: "",
};

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;
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
            form,
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
      tags: (form.tags.trim() ? form.tags : DEFAULT_PRAYER_TAG)
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

      await response.json();
      const createdAsPrivate = Boolean(payload.isPrivate);
      setSubmittedPrivate(createdAsPrivate);
      setStatus({
        type: "success",
        message: isGuest
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
        router.push(isGuest ? "/prayfor" : "/customer-portal");
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
      <SiteHeader activePath="/customer-portal" />
      <main className="customer-create">
        <header className="customer-create__header-band">
          <h1>寫下一件需要被守望的事</h1>
          <p>把現在的處境說清楚就好，不需要寫得漂亮。</p>
        </header>

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

            <div className="customer-create__row">
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
            </div>
          </section>

          <section className="customer-create__step customer-create__step--map">
            <div className="customer-create__step-head">
              <span>02</span>
              <div>
                <h2>選擇全球位置</h2>
                <p>你的禱告會出現在世界地圖上，只顯示大概位置。</p>
              </div>
            </div>
            <PrayerLocationField value={form} onChange={updateLocation} disabled={submitting} />
          </section>

          <section className="customer-create__step">
            <div className="customer-create__step-head">
              <span>03</span>
              <div>
                <h2>補充內容並送出</h2>
                <p>保留必要內容，圖片與隱私選項放在進階設定。</p>
              </div>
            </div>

            <div className="customer-create__row customer-create__row--description">
              <label>
                <span>代禱內容 *</span>
                <textarea
                  value={form.description}
                  onChange={updateFormField("description")}
                  placeholder="請直接輸入代禱內容，清楚描述目前情況、需要代禱與盼望。"
                  rows={7}
                  required
                />
                <small className="cp-helper">請直接輸入文字即可，不需要填寫多餘欄位。</small>
              </label>
            </div>

            {authUser?.id ? (
              <div className="customer-create__row">
                <CardVoiceRecorder
                  value={form.voiceHref}
                  onChange={(url) => setForm((prev) => ({ ...prev, voiceHref: url }))}
                  onUploadingChange={setIsUploadingVoice}
                  disabled={submitting}
                />
              </div>
            ) : null}

            {!authUser?.id ? (
              <>
                <input
                  type="text"
                  value={form.website}
                  onChange={updateFormField("website")}
                  tabIndex={-1}
                  autoComplete="off"
                  className="customer-create__honeypot"
                  aria-hidden="true"
                />
                <div className="customer-create__privacy-card">
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
                        請不要填寫真實姓名、電話、住址或其他敏感個資。若內容需要修改，之後需聯絡管理員協助。
                      </small>
                    </span>
                  </label>
                </div>
              </>
            ) : null}

            <details className="customer-create__advanced">
              <summary>進階設定</summary>
              <div className="customer-create__advanced-body">
                <div className="customer-create__privacy-card">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.isPrivate}
                      onChange={updateFormField("isPrivate")}
                    />
                    <span>
                      <strong>不公開內容，地圖上只顯示大概位置</strong>
                      <small>
                        勾選後，全球禱告室只顯示大概位置與統計，不會公開標題、內文、圖片、上傳者與詳情頁。
                      </small>
                    </span>
                  </label>
                </div>

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

                <div className="customer-create__preview-block">
                  <span>封面預覽</span>
                  <div className="customer-create__preview">
                    <img src={previewImage} alt={form.alt || form.title || "代禱預覽"} />
                  </div>
                </div>
              </div>
            </details>
          </section>

          <div className="customer-create__actions">
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
              href={authUser?.id ? "/customer-portal" : "/login?next=/customer-portal/create"}
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
              {authUser?.id
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


        .customer-create__form {
          width: min(980px, 100%);
          margin: 0.75rem auto 0;
          padding: clamp(0.78rem, 2vw, 1.1rem);
          border-radius: 14px;
          border: 1px solid rgba(148, 163, 184, 0.2);
          background: linear-gradient(160deg, rgba(7, 16, 34, 0.92), rgba(10, 21, 41, 0.88));
          box-shadow: 0 20px 42px -34px rgba(2, 6, 23, 0.86);
        }

        .customer-create__step {
          display: grid;
          gap: 0.78rem;
          border: 1px solid rgba(148, 163, 184, 0.16);
          border-radius: 12px;
          padding: clamp(0.78rem, 2vw, 1rem);
          background: rgba(2, 6, 23, 0.18);
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
          color: #67e8f9;
          font-size: 0.78rem;
          font-weight: 900;
          background: rgba(14, 165, 233, 0.12);
        }

        .customer-create__step-head h2,
        .customer-create__step-head p {
          margin: 0;
        }

        .customer-create__step-head h2 {
          color: #f8fafc;
          font-size: 1.05rem;
          line-height: 1.25;
        }

        .customer-create__step-head p {
          margin-top: 0.22rem;
          color: rgba(203, 213, 225, 0.74);
          font-size: 0.84rem;
          line-height: 1.5;
        }

        .customer-create__step--map {
          background: rgba(2, 6, 23, 0.14);
        }

        .customer-create__row label {
          display: grid;
          gap: 0.42rem;
        }

        .customer-create__row label > span {
          color: rgba(226, 232, 240, 0.95);
          font-size: 0.84rem;
          font-weight: 700;
          letter-spacing: 0.01em;
        }

        .customer-create__row input,
        .customer-create__row select,
        .customer-create__row textarea {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.36);
          background: rgba(15, 23, 42, 0.66);
          color: #f8fbff;
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
          border: 1px dashed rgba(125, 211, 252, 0.36);
          border-radius: 12px;
          min-height: 180px;
          display: grid;
          place-items: center;
          background:
            linear-gradient(180deg, rgba(15, 23, 42, 0.58), rgba(2, 6, 23, 0.42));
        }

        .customer-create__preview-block {
          display: grid;
          gap: 0.45rem;
        }

        .customer-create__preview-block > span {
          color: rgba(226, 232, 240, 0.95);
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
          color: #e2f6ff;
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
          color: #ffffff;
        }

        .customer-create__privacy-card small {
          color: rgba(226, 232, 240, 0.76);
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
          color: rgba(226, 232, 240, 0.82);
          font-size: 0.9rem;
        }

        .customer-create__status {
          border-radius: 12px;
          border: 1px solid rgba(148, 163, 184, 0.34);
          background: rgba(15, 23, 42, 0.5);
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
          background: rgba(2, 6, 23, 0.32);
        }

        .customer-create__mode span,
        .customer-create__mode p {
          margin: 0;
        }

        .customer-create__mode span {
          color: #f8fafc;
          font-weight: 900;
        }

        .customer-create__mode p {
          margin-top: 0.25rem;
          color: rgba(226, 232, 240, 0.7);
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
          background: rgba(15, 23, 42, 0.72);
          cursor: pointer;
          font-weight: 900;
        }

        .customer-create__mode-actions button.is-active {
          border-color: rgba(125, 211, 252, 0.62);
          color: #f8fafc;
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
          background: linear-gradient(135deg, #3b82f6, #0ea5e9);
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
          color: #e2e8f0;
          background: rgba(15, 23, 42, 0.4);
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

          .customer-create__actions {
            flex-direction: column;
            position: sticky;
            bottom: 0.65rem;
            z-index: 20;
            border: 1px solid rgba(148, 163, 184, 0.28);
            border-radius: 16px;
            background: rgba(2, 6, 23, 0.86);
            padding: 0.65rem;
            backdrop-filter: blur(14px);
          }

          .customer-create__actions :global(.button) {
            width: 100%;
            justify-content: center;
          }

          .customer-create__row--description textarea {
            min-height: 180px;
          }
        }

        .customer-create__advanced {
          border: 1px solid rgba(148, 163, 184, 0.14);
          border-radius: 12px;
          background: rgba(15, 23, 42, 0.2);
          overflow: hidden;
        }

        .customer-create__advanced summary {
          min-height: 44px;
          display: flex;
          align-items: center;
          padding: 0 0.85rem;
          color: #dbeafe;
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
