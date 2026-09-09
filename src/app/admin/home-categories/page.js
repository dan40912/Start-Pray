"use client";

import { useEffect, useState } from "react";

const EMPTY_CATEGORY = {
  name: "",
  slug: "",
  description: "",
  sortOrder: 0,
  isActive: true
};

export default function AdminHomeCategoriesPage() {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState(null);
  const [saving, setSaving] = useState({});
  const [newCategory, setNewCategory] = useState(EMPTY_CATEGORY);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadCategories = async () => {
      try {
        const response = await fetch("/api/admin/home-categories", { cache: "no-store" });
        if (!response.ok) throw new Error("無法載入分類資料");
        const data = await response.json();
        if (mounted) setCategories(data);
      } catch (error) {
        if (mounted) setStatus({ type: "error", message: error.message });
      } finally {
        if (mounted) setLoading(false);
      }
    };

    loadCategories();
    return () => {
      mounted = false;
    };
  }, []);

  const updateField = (id, field, value) => {
    setCategories((prev) =>
      prev.map((category) =>
        category.id === id
          ? {
              ...category,
              [field]: field === "sortOrder" ? Number(value) || 0 : value
            }
          : category
      )
    );
  };

  const handleUpdate = async (category) => {
    setSaving((prev) => ({ ...prev, [category.id]: true }));
    setStatus(null);

    try {
      const response = await fetch(`/api/admin/home-categories/${category.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: category.name,
          slug: category.slug,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: category.isActive
        })
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "更新失敗" }));
        throw new Error(error.message || "更新失敗");
      }

      const updated = await response.json();
      setCategories((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      setStatus({ type: "success", message: `分類 ${updated.name} 已更新` });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "儲存失敗" });
    } finally {
      setSaving((prev) => ({ ...prev, [category.id]: false }));
    }
  };

  const handleCreate = async (event) => {
    event.preventDefault();
    if (!newCategory.name.trim()) {
      setStatus({ type: "error", message: "請輸入分類名稱" });
      return;
    }

    setCreating(true);
    setStatus(null);

    try {
      const response = await fetch("/api/admin/home-categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newCategory)
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ message: "建立失敗" }));
        throw new Error(error.message || "建立失敗");
      }

      const created = await response.json();
      setCategories((prev) => [...prev, created].sort((a, b) => a.sortOrder - b.sortOrder));
      setNewCategory(EMPTY_CATEGORY);
      setStatus({ type: "success", message: `分類 ${created.name} 已建立` });
    } catch (error) {
      setStatus({ type: "error", message: error.message || "建立失敗" });
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="admin-section">
      <header className="admin-section__header">
        <div>
          <p className="admin-section__eyebrow">首頁內容</p>
          <h1>首頁卡片分類管理</h1>
        </div>
        {status ? (
          <span
            className={
              status.type === "success"
                ? "customer-edit__status customer-edit__status--success"
                : "customer-edit__status customer-edit__status--error"
            }
          >
            {status.message}
          </span>
        ) : null}
      </header>

      <section className="admin-section__grid">
        <article className="admin-section__card admin-section__card--wide">
          <header className="admin-section__card-header">
            <div>
              <h2>新增分類</h2>
              <p>新增後即可在代禱的建立與編輯頁面中套用。</p>
            </div>
          </header>
          <form className="dashboard-form" onSubmit={handleCreate}>
            <div className="dashboard-form__row dashboard-form__row--equal">
              <label>
                <span>名稱 *</span>
                <input
                  type="text"
                  value={newCategory.name}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, name: event.target.value }))}
                  required
                />
              </label>
              <label>
                <span>自訂 Slug (選填)</span>
                <input
                  type="text"
                  value={newCategory.slug}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, slug: event.target.value }))}
                />
              </label>
            </div>

            <div className="dashboard-form__row">
              <label>
                <span>說明</span>
                <textarea
                  rows={2}
                  value={newCategory.description}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, description: event.target.value }))}
                />
              </label>
            </div>

            <div className="dashboard-form__row dashboard-form__row--equal">
              <label>
                <span>排序</span>
                <input
                  type="number"
                  value={newCategory.sortOrder}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, sortOrder: Number(event.target.value) || 0 }))}
                />
              </label>
              <label className="dashboard-form__switch">
                <span>啟用狀態</span>
                <input
                  type="checkbox"
                  checked={newCategory.isActive}
                  onChange={(event) => setNewCategory((prev) => ({ ...prev, isActive: event.target.checked }))}
                />
                <span>可選用</span>
              </label>
            </div>

            <div className="dashboard-form__actions">
              <button type="submit" className="button button--primary" disabled={creating}>
                {creating ? "建立中..." : "建立分類"}
              </button>
            </div>
          </form>
        </article>

        {categories.map((category) => (
          <article key={category.id} className="admin-section__card">
            <header className="admin-section__card-header">
              <div>
                <h2>{category.name}</h2>
                <p>Slug：{category.slug}</p>
              </div>
            </header>

            <div className="dashboard-form">
              <div className="dashboard-form__row dashboard-form__row--equal">
                <label>
                  <span>名稱</span>
                  <input
                    type="text"
                    value={category.name}
                    onChange={(event) => updateField(category.id, "name", event.target.value)}
                  />
                </label>
                <label>
                  <span>Slug</span>
                  <input
                    type="text"
                    value={category.slug || ""}
                    onChange={(event) => updateField(category.id, "slug", event.target.value)}
                  />
                </label>
              </div>

              <div className="dashboard-form__row">
                <label>
                  <span>說明</span>
                  <textarea
                    rows={2}
                    value={category.description || ""}
                    onChange={(event) => updateField(category.id, "description", event.target.value)}
                  />
                </label>
              </div>

              <div className="dashboard-form__row dashboard-form__row--equal">
                <label>
                  <span>排序</span>
                  <input
                    type="number"
                    value={category.sortOrder}
                    onChange={(event) => updateField(category.id, "sortOrder", Number(event.target.value) || 0)}
                  />
                </label>
                <label className="dashboard-form__switch">
                  <span>啟用</span>
                  <input
                    type="checkbox"
                    checked={category.isActive}
                    onChange={(event) => updateField(category.id, "isActive", event.target.checked)}
                  />
                  <span>{category.isActive ? "可選" : "停用"}</span>
                </label>
              </div>

              <div className="dashboard-form__actions">
                <button
                  type="button"
                  className="button button--primary"
                  onClick={() => handleUpdate(category)}
                  disabled={Boolean(saving[category.id])}
                >
                  {saving[category.id] ? "儲存中..." : "儲存分類"}
                </button>
              </div>
            </div>
          </article>
        ))}
      </section>
    </div>
  );
}