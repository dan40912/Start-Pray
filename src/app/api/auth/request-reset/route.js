import crypto from "node:crypto";

import { NextResponse } from "next/server";

import {
  authLimiters,
  checkAuthLimit,
  recordAuthAttempt,
  tooManyAttemptsMessage,
} from "@/lib/auth-rate-limit";
import { readClientIp } from "@/lib/client-ip";
import { isMailConfigured, sendMail } from "@/lib/mailer";
import prisma from "@/lib/prisma";

const RESET_TOKEN_EXPIRES_MINUTES = 30;

function isValidEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export async function POST(request) {
  try {
    const { email } = await request.json();
    const normalizedEmail = typeof email === "string" ? email.trim().toLowerCase() : "";

    if (!normalizedEmail || !isValidEmail(normalizedEmail)) {
      return NextResponse.json({ message: "請輸入有效的電子信箱" }, { status: 400 });
    }

    const limitKeys = {
      account: `account:${normalizedEmail}`,
      ip: `ip:${readClientIp(request)}`,
    };
    const limit = checkAuthLimit(authLimiters.passwordReset, limitKeys);
    if (!limit.allowed) {
      return NextResponse.json(
        { message: tooManyAttemptsMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
    recordAuthAttempt(authLimiters.passwordReset, limitKeys);

    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, email: true, passwordHash: true },
    });

    if (user?.passwordHash) {
      const rawToken = crypto.randomBytes(32).toString("hex");
      const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRES_MINUTES * 60 * 1000);

      await prisma.user.update({
        where: { id: user.id },
        data: {
          resetToken: hashedToken,
          resetTokenExpiry: expiresAt,
        },
      });

      const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "");
      const appOrigin = configuredOrigin || request.nextUrl.origin;
      const resetUrl = `${appOrigin}/reset-password?token=${rawToken}`;

      if (process.env.NODE_ENV !== "production") {
        return NextResponse.json({
          message: "已建立重設密碼連結（開發模式可直接使用連結）。",
          resetUrl,
          expiresAt: expiresAt.toISOString(),
        });
      }

      // Only mail a link built from the configured site URL: request.nextUrl
      // follows the Host header, which an attacker could point at their own
      // domain to receive the victim's reset token.
      if (isMailConfigured() && configuredOrigin) {
        // Not awaited, so the response time does not reveal whether the
        // address is registered.
        sendMail({
          to: user.email,
          subject: "Start Pray 重設密碼",
          text: [
            "我們收到重設 Start Pray 帳號密碼的申請。",
            `請在 ${RESET_TOKEN_EXPIRES_MINUTES} 分鐘內開啟以下連結設定新密碼：`,
            resetUrl,
            "",
            "如果這不是你本人申請的，請忽略這封信，你的密碼不會改變。",
          ].join("\n"),
        }).catch((mailError) => {
          console.error("POST /api/auth/request-reset 寄信失敗", mailError);
        });
      } else {
        console.warn(
          "POST /api/auth/request-reset: 未設定 RESEND_API_KEY / MAIL_FROM / NEXT_PUBLIC_APP_URL，重設密碼信未寄出"
        );
      }
    }

    return NextResponse.json({
      message: "如果此信箱已註冊，我們已寄出重設密碼連結。",
    });
  } catch (error) {
    console.error("POST /api/auth/request-reset 發生錯誤", error);
    return NextResponse.json({ message: "寄送重設密碼連結時發生錯誤" }, { status: 500 });
  }
}
