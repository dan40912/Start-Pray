"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

import { saveAuthSession } from "@/lib/auth-storage";
import { getDictionary, localizePath, normalizeLocale } from "@/lib/i18n";
import { resolveSafeNextPath } from "@/lib/redirect-target";

const initialForm = {
  email: "",
  password: "",
};

export default function LoginForm({ locale: localeProp = "zh-TW" }) {
  const locale = normalizeLocale(localeProp);
  const text = getDictionary(locale).auth.login;
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
        throw new Error(data.message || text.defaultError);
      }

      saveAuthSession(data.user);

      setStatus({
        state: "success",
        message: nextPath === "/customer-portal" ? text.successPortal : text.successNext,
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
            {text.email} <span className="required-badge">{text.required}</span>
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
            {text.password} <span className="required-badge">{text.required}</span>
        </label>
        <input
          className="form-control"
          type={showPassword ? "text" : "password"}
          id="login-password"
          placeholder={text.passwordPlaceholder}
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
          {showPassword ? text.hidePassword : text.showPassword}
        </button>
        <span className="form-helper">
          {text.forgotPrefix}{" "}
          <Link href={localizePath("/forgot-password", locale)} prefetch={false}>
            {text.forgotLink}
          </Link>
        </span>
        {capsLockOn ? <span className="form-helper form-helper--warning">{text.capsLock}</span> : null}
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
        {status.state === "loading" ? text.loading : text.submit}
      </button>
    </form>
  );
}
