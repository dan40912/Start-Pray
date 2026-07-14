"use client";

import Link from "next/link";
import { useState } from "react";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });
  const [debugResetUrl, setDebugResetUrl] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setStatus({ state: "loading", message: "" });
    setDebugResetUrl("");

    try {
      const response = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "寄送重設連結時發生錯誤");
      }

      setStatus({
        state: "success",
        message: data.message || "如果帳號存在，我們已寄出重設密碼連結。",
      });
      if (typeof data.resetUrl === "string" && data.resetUrl) {
        setDebugResetUrl(data.resetUrl);
      }
    } catch (error) {
      setStatus({ state: "error", message: error.message || "發生未知錯誤" });
    }
  };

  return (
    <>
      <SiteHeader activePath="/login" />
      <main className="auth-page auth-page--compact">
        <div className="auth-wrapper">
          <div className="auth-grid">
            <section className="auth-card auth-card--compact">
              <div>
                <h1>忘記密碼</h1>
                <p>輸入註冊信箱，我們會寄送重設密碼連結。</p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="forgot-email">
                    電子信箱 <span className="required-badge">必填</span>
                  </label>
                  <input
                    className="form-control"
                    id="forgot-email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                {status.message && (
                  <div
                    role="alert"
                    style={{
                      marginBottom: "1rem",
                      padding: "0.9rem 1rem",
                      borderRadius: "0.75rem",
                      background: status.state === "success" ? "rgba(34,197,94,0.15)" : "rgba(248,113,113,0.15)",
                      color: status.state === "success" ? "#166534" : "#991b1b",
                    }}
                  >
                    {status.message}
                  </div>
                )}
                {debugResetUrl && (
                  <div className="form-helper" style={{ marginBottom: "1rem" }}>
                    開發模式重設連結：
                    {" "}
                    <a href={debugResetUrl}>{debugResetUrl}</a>
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  disabled={status.state === "loading"}
                >
                  {status.state === "loading" ? "送出中…" : "寄送重設連結"}
                </button>
              </form>

              <div className="auth-footer">
                <span>
                  想起密碼了？<Link href="/login">返回登入</Link>
                </span>
              </div>
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
