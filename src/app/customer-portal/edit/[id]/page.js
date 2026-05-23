"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";

import PrayerLocationField from "@/components/PrayerLocationField";
import { SiteFooter, SiteHeader } from "@/components/site-chrome";
import { parseCardMeta } from "@/lib/card-meta";

const APPROXIMATE_LOCATION_LABEL = "\u5927\u81f4\u4f4d\u7f6e";
const TAIPEI_LOCATION = {
  locationKey: "",
  locationCity: APPROXIMATE_LOCATION_LABEL,
  locationCountry: "",
  locationLat: "25.033000",
  locationLng: "121.565400",
};

const EMPTY_FORM = {
  title: "",
  description: "",
  image: "",
  alt: "",
  slug: "",
  tags: "",
  meta: "",
  detailsHref: "",
  voiceHref: "",
  categoryId: "",
  ...TAIPEI_LOCATION,
  isPrivate: false,
};
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_GALLERY_IMAGES = 3;

function mapCardToForm(card) {
  if (!card) return EMPTY_FORM;
  const { info } = parseCardMeta(card.meta);
  return {
    title: card.title ?? "",
    description: card.description ?? "",
    image: card.image ?? "",
    alt: card.alt ?? "",
    slug: card.slug ?? "",
    tags: Array.isArray(card.tags) ? card.tags.join(", ") : "",
    meta: info.join("\n"),
    detailsHref: card.detailsHref ?? "",
    voiceHref: card.voiceHref ?? "",
    categoryId: card.category?.id ? String(card.category.id) : "",
    locationKey: "",
    locationCity: APPROXIMATE_LOCATION_LABEL,
    locationCountry: "",
    locationLat: card.locationLat != null ? String(card.locationLat) : TAIPEI_LOCATION.locationLat,
    locationLng: card.locationLng != null ? String(card.locationLng) : TAIPEI_LOCATION.locationLng,
    isPrivate: Boolean(card.isPrivate),
  };
}

export default function CustomerPortalEditCardPage() {
  const params = useParams();
  const router = useRouter();
  const cardId = params?.id;

  const [form, setForm] = useState(EMPTY_FORM);
  const [card, setCard] = useState(null);
  const [categories, setCategories] = useState([]);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [galleryImages, setGalleryImages] = useState([]);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const tagsPreview = useMemo(
    () =>
      form.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    [form.tags]
  );

  const metaPreview = useMemo(
    () =>
      form.meta
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean),
    [form.meta]
  );
  const galleryUrls = useMemo(
    () => galleryImages.map((item) => item.url).filter(Boolean),
    [galleryImages]
  );

  useEffect(() => {
    let active = true;

    const loadInitial = async () => {
      if (!cardId) {
        setStatus({ type: "error", message: "找不到祈禱卡片編號" });
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [cardRes, categoriesRes] = await Promise.all([
          fetch(`/api/customer/cards/${cardId}`, { cache: "no-store" }),
          fetch("/api/home-categories", { cache: "no-store" }),
        ]);

        if (!cardRes.ok) {
          const payload = await cardRes.json().catch(() => null);
          throw new Error(payload?.message || "無法載入祈禱卡片");
        }
        const cardData = await cardRes.json();

        if (!categoriesRes.ok) {
          const payload = await categoriesRes.json().catch(() => null);
          throw new Error(payload?.message || "無法載入分類清單");
        }
        const categoryData = await categoriesRes.json();

        if (!active) return;

        const parsedMeta = parseCardMeta(cardData.meta);
        const preparedGallery = parsedMeta.gallery.map((url, index) => ({
          url,
          name: url.split("?")[0].split("/").pop() || `image-${index + 1}`,
        }));
        setCard(cardData);
        setCategories(categoryData);
        setForm(mapCardToForm(cardData));
        setGalleryImages(preparedGallery);
      } catch (error) {
        if (active) {
          setStatus({ type: "error", message: error.message || "載入資料時發生錯誤" });
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadInitial();

    return () => {
      active = false;
    };
  }, [cardId]);

  const updateField = (field) => (event) => {
    const value = event.target.type === "checkbox" ? event.target.checked : event.target.value;
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLocation = (nextLocation) => {
    setForm((prev) => ({ ...prev, ...nextLocation }));
  };

  const handleGalleryUpload = async (event) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";
    if (!files.length) return;

    const availableSlots = MAX_GALLERY_IMAGES - galleryImages.length;
    if (availableSlots <= 0) {
      setStatus({ type: "error", message: `最多只能上傳 ${MAX_GALLERY_IMAGES} 張圖片` });
      return;
    }

    const imageFiles = files
      .filter((file) => file.type.startsWith("image/"))
      .slice(0, availableSlots);
    if (!imageFiles.length) {
      setStatus({ type: "error", message: "請選擇圖片檔案" });
      return;
    }

    setIsUploadingImage(true);
    setStatus({ type: "info", message: "圖片上傳中，請稍候..." });
    const nextImages = [...galleryImages];
    let successCount = 0;
    let lastError = "";

    for (const file of imageFiles) {
      if (file.size > MAX_UPLOAD_BYTES) {
        lastError = `圖片 “${file.name}” 大小需小於 5MB`;
        continue;
      }

      const formData = new FormData();
      formData.append("file", file);

      try {
        const response = await fetch("/api/upload-image", { method: "POST", body: formData });
        if (!response.ok) {
          const error = await response.json().catch(() => ({ message: "圖片上傳失敗" }));
          throw new Error(error.message || "圖片上傳失敗");
        }
        const result = await response.json();
        nextImages.push({ url: result.url, name: file.name });
        successCount += 1;
      } catch (error) {
        console.error("圖片上傳失敗:", error);
        lastError = error.message || "圖片上傳失敗";
      }
    }

    setGalleryImages(nextImages);
    setIsUploadingImage(false);

    if (!form.image.trim() && nextImages.length) {
      setForm((prev) => ({ ...prev, image: nextImages[nextImages.length - 1].url }));
    }

    if (successCount > 0) {
      setStatus({ type: "success", message: `已新增 ${successCount} 張圖片` });
    } else if (lastError) {
      setStatus({ type: "error", message: lastError });
    } else {
      setStatus(null);
    }
  };

  const selectGalleryImage = (url) => {
    setForm((prev) => ({ ...prev, image: url }));
    setStatus(null);
  };

  const removeGalleryImage = (url) => {
    setGalleryImages((prev) => {
      const next = prev.filter((item) => item.url !== url);
      setForm((prevForm) => {
        if (prevForm.image !== url) return prevForm;
        return { ...prevForm, image: next[0]?.url ?? "" };
      });
      return next;
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!cardId) return;

    if (!form.categoryId) {
      setStatus({ type: "error", message: "請選擇分類" });
      return;
    }

    setSaving(true);
    setStatus(null);

    const payload = {
      title: form.title.trim(),
      description: form.description,
      image: form.image,
      alt: form.alt,
      slug: form.slug,
      tags: tagsPreview,
      meta: metaPreview,
      detailsHref: form.detailsHref,
      voiceHref: form.voiceHref,
      locationKey: form.locationKey,
      locationCity: form.locationCity.trim(),
      locationCountry: form.locationCountry.trim(),
      locationLat: form.locationLat.trim(),
      locationLng: form.locationLng.trim(),
      isPrivate: Boolean(form.isPrivate),
      categoryId: Number(form.categoryId),
    };

    try {
      const response = await fetch(`/api/customer/cards/${cardId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw new Error(data?.message || "更新祈禱卡片失敗");
      }

      const updated = await response.json();
      setCard(updated);
      setForm(mapCardToForm(updated));
      setStatus({
        type: "success",
        message: "祈禱卡片已更新，大致位置可顯示在全球禱告室。",
      });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "更新失敗" });
    } finally {
      setSaving(false);
    }
  };

  const handleBack = () => {
    router.push("/customer-portal");
  };

  return (
    <>
      <SiteHeader activePath="/customer-portal" />
      <main className="cp-main">
        <section className="cp-section cp-section--form">
          <div className="cp-section__head">
            <div>
              <h2>編輯祈禱卡片</h2>
              <p>更新內容、分享資訊與分類，讓社群更了解這項代禱。</p>
            </div>
            <button type="button" className="cp-button cp-button--ghost" onClick={handleBack}>
              返回我的總覽
            </button>
          </div>

          {loading ? (
            <p>資料載入中…</p>
          ) : card ? (
            <form className="cp-card-form" onSubmit={handleSubmit}>
              {status ? (
                <div className={`cp-alert cp-alert--${status.type}`}>{status.message}</div>
              ) : null}

              <div className="cp-form__grid">
                <label>
                  <span>標題 *</span>
                  <input type="text" value={form.title} onChange={updateField("title")} required />
                </label>
                <label>
                  <span>Slug</span>
                  <input
                    type="text"
                    value={form.slug}
                    onChange={updateField("slug")}
                    placeholder="留空則沿用目前設定"
                  />
                </label>
              </div>

              <label>
                <span>說明</span>
                <textarea rows={4} value={form.description} onChange={updateField("description")} />
              </label>

              <div className="cp-form__grid">
                <label>
                  <span>分類 *</span>
                  <select value={form.categoryId} onChange={updateField("categoryId")} required>
                    <option value="" disabled>
                      請選擇分類
                    </option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>封面圖片 URL</span>
                  <input type="url" value={form.image} onChange={updateField("image")} />
                </label>
              </div>

              <PrayerLocationField value={form} onChange={updateLocation} disabled={saving} />

              <div className="cp-private-toggle">
                <label>
                  <input
                    type="checkbox"
                    checked={form.isPrivate}
                    onChange={updateField("isPrivate")}
                  />
                  <span>
                    <strong>內容不公開，只顯示匿名大致位置光點</strong>
                    <small>
                      勾選後，前台不顯示標題、內文、圖片、上傳者與詳情頁；全球禱告室只保留大致位置光點。
                    </small>
                  </span>
                </label>
              </div>

              <div className="cp-form__grid">
                <label>
                  <span>圖片替代文字</span>
                  <input type="text" value={form.alt} onChange={updateField("alt")} />
                </label>
                <label>
                  <span>分享詳情連結</span>
                  <input
                    type="url"
                    value={form.detailsHref}
                    onChange={updateField("detailsHref")}
                  />
                </label>
              </div>

              <label>
                <span>標籤（以逗號分隔）</span>
                <input type="text" value={form.tags} onChange={updateField("tags")} />
              </label>

              <label>
                <span>Meta 資訊（每行一筆）</span>
                <textarea rows={3} value={form.meta} onChange={updateField("meta")} />
              </label>

              <div className="cp-form__preview">
                <strong>儲存前快速檢查</strong>
                <ul>
                  <li>標題：{form.title || "--"}</li>
                  <li>
                    分類：
                    {categories.find((item) => String(item.id) === form.categoryId)?.name || "--"}
                  </li>
                  <li>標籤：{tagsPreview.length ? tagsPreview.join(", ") : "--"}</li>
                </ul>
              </div>

              <div className="cp-form__actions">
                <button
                  type="button"
                  className="cp-button cp-button--ghost"
                  onClick={handleBack}
                  disabled={saving}
                >
                  取消
                </button>
                <button type="submit" className="cp-button" disabled={saving}>
                  {saving ? "儲存中…" : "儲存變更"}
                </button>
              </div>
            </form>
          ) : (
            <div className="cp-alert cp-alert--error">找不到這張祈禱卡片</div>
          )}
        </section>
      </main>
      <SiteFooter />
      <style jsx>{`
        .cp-private-toggle {
          border: 1px solid rgba(37, 99, 235, 0.22);
          border-radius: 14px;
          background: rgba(37, 99, 235, 0.08);
          padding: 0.9rem;
        }

        .cp-private-toggle label {
          display: flex;
          align-items: flex-start;
          gap: 0.75rem;
        }

        .cp-private-toggle input {
          width: 20px;
          height: 20px;
          margin-top: 0.15rem;
          accent-color: #2563eb;
        }

        .cp-private-toggle span {
          display: grid;
          gap: 0.25rem;
        }

        .cp-private-toggle small {
          color: #475569;
          line-height: 1.55;
        }
      `}</style>
    </>
  );
}
