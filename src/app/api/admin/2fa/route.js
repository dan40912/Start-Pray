import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import QRCode from "qrcode";

import { requireAdmin } from "@/lib/admin-route-auth";
import {
  authLimiters,
  checkAuthLimit,
  recordAuthAttempt,
  tooManyAttemptsMessage,
} from "@/lib/auth-rate-limit";
import {
  buildOtpAuthUri,
  createTotpSetupToken,
  encryptTotpSecret,
  generateTotpSecret,
  readTotpSetupToken,
  verifyTotpCode,
} from "@/lib/admin-totp";
import { logAdminAction } from "@/lib/logger";
import prisma from "@/lib/prisma";

// The signed-in admin's own 2FA enrollment.
//   GET                                   → { enabled, enabledAt }
//   POST { action: "setup" }              → { setupToken, otpauthUri, qrDataUrl, secret }
//   POST { action: "confirm", setupToken, code, password }
//                                         → { enabled: true, enabledAt }
// Resetting another admin's 2FA is a SUPER action on /api/admin/accounts/[id].

async function loadAccount(adminId) {
  return prisma.adminAccount.findUnique({
    where: { id: adminId },
    select: {
      id: true,
      username: true,
      isActive: true,
      passwordHash: true,
      totpEnabledAt: true,
    },
  });
}

export async function GET(request) {
  const { error, session } = requireAdmin(request);
  if (error) return error;

  try {
    const account = await loadAccount(session.adminId);
    if (!account?.isActive) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      enabled: Boolean(account.totpEnabledAt),
      enabledAt: account.totpEnabledAt,
    });
  } catch (err) {
    console.error("GET /api/admin/2fa error:", err);
    return NextResponse.json({ message: "無法取得 2FA 狀態" }, { status: 500 });
  }
}

export async function POST(request) {
  const { error, session } = requireAdmin(request);
  if (error) return error;

  try {
    const body = await request.json().catch(() => ({}));
    const account = await loadAccount(session.adminId);
    if (!account?.isActive) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    if (body?.action === "setup") {
      const secret = generateTotpSecret();
      const otpauthUri = buildOtpAuthUri(account.username, secret);
      const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });

      return NextResponse.json({
        setupToken: createTotpSetupToken(account.id, secret),
        otpauthUri,
        qrDataUrl,
        secret,
      });
    }

    if (body?.action === "confirm") {
      const password = typeof body.password === "string" ? body.password : "";
      const code = typeof body.code === "string" ? body.code : "";

      // Re-check the password so a stolen session alone cannot swap in an
      // attacker-controlled authenticator. Shares the admin-login limiter so
      // this cannot be used to guess the password either.
      const limitKeys = { account: `account:${account.username}` };
      const limit = checkAuthLimit(authLimiters.adminLogin, limitKeys);
      if (!limit.allowed) {
        return NextResponse.json(
          { message: tooManyAttemptsMessage(limit.retryAfterSeconds) },
          { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
        );
      }

      const passwordOk = password ? await bcrypt.compare(password, account.passwordHash) : false;
      if (!passwordOk) {
        recordAuthAttempt(authLimiters.adminLogin, limitKeys);
        return NextResponse.json({ message: "目前密碼不正確" }, { status: 401 });
      }

      const secret = readTotpSetupToken(body.setupToken, account.id);
      if (!secret) {
        return NextResponse.json({ message: "設定已逾時，請重新產生 QR Code" }, { status: 400 });
      }

      const step = verifyTotpCode(code, secret);
      if (step === null) {
        return NextResponse.json({ message: "驗證碼錯誤，請確認手機時間正確後再試" }, { status: 400 });
      }

      const enabledAt = new Date();
      await prisma.adminAccount.update({
        where: { id: account.id },
        data: {
          totpSecret: encryptTotpSecret(secret),
          totpEnabledAt: enabledAt,
          totpLastUsedStep: step,
        },
      });

      await logAdminAction({
        action: "admin.2fa.enroll",
        message: `管理員 ${account.username} 設定了個人 2FA`,
        actorId: session.adminId,
        actorEmail: session.username,
        targetType: "AdminAccount",
        targetId: account.id,
        requestPath: request.url,
      });

      return NextResponse.json({ enabled: true, enabledAt });
    }

    return NextResponse.json({ message: "不支援的操作" }, { status: 400 });
  } catch (err) {
    console.error("POST /api/admin/2fa error:", err);
    return NextResponse.json({ message: "2FA 設定失敗，請稍後再試" }, { status: 500 });
  }
}
