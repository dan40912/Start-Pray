"use client";

import Link from "next/link";
import { useState } from "react";
import { useSearchParams } from "next/navigation";

import { SiteFooter, SiteHeader } from "@/components/site-chrome";

export default function ResetPasswordPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState({ state: "idle", message: "" });

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!token) {
      setStatus({ state: "error", message: "重設連結無效，請重新申請忘記密碼。" });
      return;
    }

    setStatus({ state: "loading", message: "" });
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, confirmPassword }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.message || "重設密碼失敗");
      }

      setStatus({ state: "success", message: data.message || "密碼已更新，請重新登入。" });
      setPassword("");
      setConfirmPassword("");
    } catch (error) {
      setStatus({ state: "error", message: error.message || "重設密碼失敗" });
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
                <h1>重設密碼</h1>
                <p>請輸入新密碼，並確保至少 8 碼。</p>
              </div>

              <form className="auth-form" onSubmit={handleSubmit}>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password">
                    新密碼 <span className="required-badge">必填</span>
                  </label>
                  <input
                    className="form-control"
                    id="reset-password"
                    type="password"
                    placeholder="至少 8 碼"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    minLength={8}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label" htmlFor="reset-password-confirm">
                    確認新密碼 <span className="required-badge">必填</span>
                  </label>
                  <input
                    className="form-control"
                    id="reset-password-confirm"
                    type="password"
                    placeholder="再次輸入新密碼"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    required
                    minLength={8}
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

                <button
                  type="submit"
                  className="btn btn-primary auth-submit"
                  disabled={status.state === "loading"}
                >
                  {status.state === "loading" ? "更新中…" : "更新密碼"}
                </button>
              </form>

              <div className="auth-footer">
                <span>
                  <Link href="/forgot-password">重新申請重設連結</Link> 或 <Link href="/login">返回登入</Link>
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
