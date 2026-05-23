"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

const EMPTY_CARD = {
  id: 0,
  slug: "",
  image: "",
  alt: "",
  title: "",
  description: "",
  tags: [],
  meta: [],
  detailsHref: "",
  voiceHref: "",
  sortOrder: 0,
  category: null
};

export default function CustomerPortalEditPage() {
  const [cards, setCards] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});
  const [status, setStatus] = useState(null);
  const [categories, setCategories] = useState([]);

  useEffect(() => {
    let mounted = true;

    const loadData = async () => {
      try {
        const [cardsRes, categoriesRes] = await Promise.all([
          fetch("/api/customer/cards", { cache: "no-store" }),
          fetch("/api/home-categories", { cache: "no-store" })
        ]);

        if (!cardsRes.ok) throw new Error("無法載入卡片資料");
        if (!categoriesRes.ok) throw new Error("無法載入分類資料");

        const [cardsData, categoriesData] = await Promise.all([
          cardsRes.json(),
          categoriesRes.json()
        ]);

        if (mounted) {
          setCards(cardsData);
          setCategories(categoriesData);
        }
      } catch (error) {
        if (mounted) setStatus({ type: "error", message: error.message });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const updateCardField = (id, field, value) => {
    setCards((prev) =>
      prev.map((card) =>
        card.id === id
          ? {
              ...card,
              [field]: value
            }
          : card
      )
    );
  };

  const handleSave = async (card) => {
    setSaving((prev) => ({ ...prev, [card.id]: true }));
    setStatus(null);

    const derivedSlug = card.slug.trim() || `card-${card.id}`;
    const derivedDetails = `/prayfor/${card.id}`;
    const payload = {
      slug: derivedSlug,
      image: card.image.trim(),
      alt: card.alt.trim(),
      title: card.title.trim(),
      description: card.description.trim(),
      tags: card.tags,
      meta: card.meta,
      detailsHref: card.detailsHref.trim() || derivedDetails,
      voiceHref: card.voiceHref.trim() || "",
      categoryId: card.category?.id || null
    };

    try {
      if (!payload.categoryId) {
        throw new Error("請選擇分類");
      }

      const response = await fetch(`/api/customer/cards/${card.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "更新失敗" }));
        throw new Error(error.message || "更新失敗");
      }

      const updated = await response.json();
      setCards((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatus({ type: "success", message: `卡片 ${updated.slug} 已更新` });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "儲存失敗" });
    } finally {
      setSaving((prev) => ({ ...prev, [card.id]: false }));
    }
  };

  if (loading) {
    return (
      <main className="customer-edit">
        <p>載入中...</p>
      </main>
    );
  }

  return (
       <>
      <SiteHeader activePath="/customer-portal" />

    <main className="customer-edit">
      <div className="customer-edit__header">
        <div>
          <p className="customer-edit__eyebrow">Customer Portal</p>
          <h1>首頁卡片管理</h1>
          <p>
            調整首頁祈禱卡片的圖片、文案與分類。所有變更將即時同步至公開首頁，請確認內容完整與連結正確。
          </p>
        </div>
        <div className="customer-edit__header-meta">
          {status ? (
            <span
              className={status.type === "success"
                ? "customer-edit__status customer-edit__status--success"
                : "customer-edit__status customer-edit__status--error"}
            >
              {status.message}
            </span>
          ) : null}
          <Link href="/customer-portal/create" className="button button--ghost" prefetch={false}>
            新增卡片
          </Link>
        </div>
      </div>

      {categories.length === 0 ? (
        <p className="customer-edit__notice">目前尚未建立分類，卡片分類選單將暫時不可用。</p>
      ) : null}

      <section className="customer-edit__grid">
        {cards.length === 0 ? (
          <p>尚未建立卡片資料。</p>
        ) : (
          cards.map((card) => {
            const tagsValue = card.tags.join(", ");
            const metaValue = card.meta.join("\n");
            const isSaving = Boolean(saving[card.id]);

            return (
              <article key={card.id} className="customer-edit__card">
                <div>
                  <h2>{card.title || card.slug || `卡片 ${card.id}`}</h2>
                  <span className="customer-edit__card-id">#{card.id}</span>
                </div>

                <div className="customer-edit__row customer-edit__row--equal">
                  <label>
                    <span>Slug</span>
                    <input
                      type="text"
                      value={card.slug}
                      onChange={(event) => updateCardField(card.id, "slug", event.target.value)} />
                  </label>
                  <div className="customer-edit__field">
                    <span>顯示順序</span>
                    <div className="customer-edit__readonly">{card.sortOrder}</div>
                  </div>
                </div>

                <div className="customer-edit__row customer-edit__row--equal">
                  <label>
                    <span>分類 *</span>
                    <select
                      value={card.category?.id || ""}
                      onChange={(event) => {
                        const selected = categories.find((cat) => cat.id === Number(event.target.value));
                        updateCardField(card.id, "category", selected || null);
                      } }
                    >
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
                    <span>圖片 URL</span>
                    <input
                      type="text"
                      value={card.image}
                      onChange={(event) => updateCardField(card.id, "image", event.target.value)} />
                  </label>
                </div>

                <div className="customer-edit__preview">
                  {card.image ? (
                    <img src={card.image} alt={card.alt} />
                  ) : (
                    <div className="customer-edit__placeholder">預覽圖片</div>
                  )}
                </div>

                <div className="customer-edit__row">
                  <label>
                    <span>圖片替代文字 (alt)</span>
                    <input
                      type="text"
                      value={card.alt}
                      onChange={(event) => updateCardField(card.id, "alt", event.target.value)} />
                  </label>
                </div>

                <div className="customer-edit__row">
                  <label>
                    <span>標題</span>
                    <input
                      type="text"
                      value={card.title}
                      onChange={(event) => updateCardField(card.id, "title", event.target.value)} />
                  </label>
                </div>

                <div className="customer-edit__row">
                  <label>
                    <span>說明</span>
                    <textarea
                      rows={3}
                      value={card.description}
                      onChange={(event) => updateCardField(card.id, "description", event.target.value)} />
                  </label>
                </div>

                <div className="customer-edit__row customer-edit__row--equal">
                  <label>
                    <span>標籤 (逗號分隔)</span>
                    <input
                      type="text"
                      value={tagsValue}
                      onChange={(event) => updateCardField(
                        card.id,
                        "tags",
                        event.target.value
                          .split(",")
                          .map((tag) => tag.trim())
                          .filter(Boolean)
                      )} />
                  </label>
                  <label>
                    <span>Meta 行 (一行一筆)</span>
                    <textarea
                      rows={2}
                      value={metaValue}
                      onChange={(event) => updateCardField(
                        card.id,
                        "meta",
                        event.target.value
                          .split("\n")
                          .map((line) => line.trim())
                          .filter(Boolean)
                      )} />
                  </label>
                </div>

                <div className="customer-edit__row">
                  <label>
                    <span>詳情連結 (選填)</span>
                    <input
                      type="text"
                      value={card.detailsHref}
                      onChange={(event) => updateCardField(card.id, "detailsHref", event.target.value)} />
                  </label>
                </div>

                <div className="customer-edit__actions">
                  <button
                    type="button"
                    className="button button--primary"
                    onClick={() => handleSave(card)}
                    disabled={isSaving}
                  >
                    {isSaving ? "儲存中..." : "儲存卡片"}
                  </button>
                </div>
              </article>
            );
          })
        )}
      </section>
    </main><SiteFooter /></>
  );
}
