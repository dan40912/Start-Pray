"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { saveAuthSession } from "@/lib/auth-storage";
import { resolveSafeNextPath } from "@/lib/redirect-target";

const initialForm = {
  email: "",
  password: "",
};

export default function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [form, setForm] = useState(initialForm);
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [capsLockOn, setCapsLockOn] = useState(false);

  const updateField = (field) => (event) => {
    setForm((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ state: "loading", message: "" });
    const nextPath = resolveSafeNextPath(searchParams?.get("next"), "/customer-portal");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "登入失敗，請稍後再試。");
      }

      saveAuthSession(data.user);

      setStatus({
        state: "success",
        message: nextPath === "/customer-portal" ? "登入成功，正在帶您進入會員中心。" : "登入成功，正在返回原本頁面。",
      });
      setTimeout(() => {
        router.replace(nextPath);
      }, 1200);
    } catch (error) {
      setStatus({ state: "error", message: error.message });
    }
  };

  return (
    <form className="auth-form" onSubmit={handleSubmit}>
      <div className="form-group">
        <label className="form-label" htmlFor="login-email">
          電子信箱 <span className="required-badge">必填</span>
        </label>
        <input
          className="form-control"
          type="email"
          id="login-email"
          placeholder="you@example.com"
          value={form.email}
          onChange={updateField("email")}
          required
        />
      </div>
      <div className="form-group">
        <label className="form-label" htmlFor="login-password">
          密碼 <span className="required-badge">必填</span>
        </label>
        <input
          className="form-control"
          type={showPassword ? "text" : "password"}
          id="login-password"
          placeholder="至少 8 碼"
          value={form.password}
          onChange={updateField("password")}
          onKeyUp={(event) => setCapsLockOn(Boolean(event.getModifierState?.("CapsLock")))}
          onBlur={() => setCapsLockOn(false)}
          required
        />
        <button
          type="button"
          className="auth-inline-button"
          onClick={() => setShowPassword((prev) => !prev)}
          aria-pressed={showPassword}
        >
          {showPassword ? "隱藏密碼" : "顯示密碼"}
        </button>
        <span className="form-helper">
          忘記密碼？{" "}
          <Link href="/forgot-password" prefetch={false}>
            前往重設密碼
          </Link>
        </span>
        {capsLockOn ? <span className="form-helper form-helper--warning">Caps Lock 已開啟。</span> : null}
      </div>
      <div className="auth-status-slot" aria-live="polite">
        {status.message ? (
          <div
            role="alert"
            className={`auth-status auth-status--${status.state === "success" ? "success" : "error"}`}
          >
            {status.message}
          </div>
        ) : null}
      </div>
      <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={status.state === "loading"}>
        {status.state === "loading" ? "驗證中" : "登入會員中心"}
      </button>
    </form>
  );
}
