"use client";

import Image from "next/image";
import { normalizeAdminOtpCode } from "@/lib/admin-otp-input";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [twoFactor, setTwoFactor] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let active = true;

    const checkSession = async () => {
      try {
        const response = await fetch("/api/admin/session", { cache: "no-store" });
        if (!active) return;
        if (response.ok) {
          router.replace("/admin/dashboard");
        }
      } catch (err) {
        // noop
      }
    };

    checkSession();
    return () => {
      active = false;
    };
  }, [router]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    try {
      setSubmitting(true);
      setError("");

      const response = await fetch("/api/admin/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: username.trim(),
          password,
          otp: twoFactor.trim(),
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.message || "登入失敗，請確認帳號密碼與 OTP");
      }

      router.replace("/admin/dashboard");
    } catch (err) {
      setError(err.message || "登入失敗，請稍後再試");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="admin-auth admin-auth--simple">
      <section className="admin-auth__panel">
        <div className="admin-auth__brand">
          <Image src="/img/logo.png" alt="Start Pray" width={56} height={56} className="admin-auth__logo" />
          <div>
            <p className="admin-auth__eyebrow">START PRAY ADMIN</p>
            <h1 className="admin-auth__title">後台登入</h1>
            <p className="admin-auth__subtitle">請輸入帳號密碼與 2FA OTP 以繼續。</p>
          </div>
        </div>

        <form className="admin-auth__form" onSubmit={handleSubmit}>
          <div className="admin-auth__form-group">
            <label htmlFor="username">帳號</label>
            <input
              id="username"
              type="text"
              placeholder="管理員帳號"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              disabled={submitting}
              required
            />
          </div>

          <div className="admin-auth__form-group">
            <label htmlFor="password">密碼</label>
            <input
              id="password"
              type="password"
              placeholder="管理員密碼"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              disabled={submitting}
              required
            />
          </div>

          <div className="admin-auth__form-group">
            <label htmlFor="twoFactor">
              2FA OTP
              <span className="admin-auth__hint">Authenticator App 6 碼</span>
            </label>
            <input
              id="twoFactor"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              pattern="[0-9]{6}"
              placeholder="6 碼 OTP"
              value={twoFactor}
              onChange={(event) => setTwoFactor(normalizeAdminOtpCode(event.target.value))}
              disabled={submitting}
              required
            />
          </div>

          {error ? <p className="admin-auth__error">{error}</p> : null}

          <button type="submit" className="admin-auth__submit" disabled={submitting}>
            {submitting ? "登入中..." : "登入後台"}
          </button>
        </form>
      </section>
    </main>
  );
}
