import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import { createAdminSessionToken, setAdminSessionCookie } from "@/lib/admin-session";
import { resolveAdminOtpMethod, verifyAdminOtp } from "@/lib/admin-totp";
import {
  authLimiters,
  checkAuthLimit,
  recordAuthAttempt,
  resetAuthAttempts,
  tooManyAttemptsMessage,
} from "@/lib/auth-rate-limit";
import { readClientIp } from "@/lib/client-ip";
import { logAdminAction } from "@/lib/logger";
import prisma from "@/lib/prisma";

function sanitizeUsername(input) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

const INVALID_CREDENTIALS_MESSAGE = "帳號、密碼或驗證碼錯誤";

// Compared against when the username does not exist, so a missing account
// takes as long to reject as a wrong password and usernames cannot be probed
// by timing.
let dummyPasswordHash = null;
function getDummyPasswordHash() {
  dummyPasswordHash ??= bcrypt.hashSync("start-pray-dummy-password", 10);
  return dummyPasswordHash;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const username = sanitizeUsername(body.username);
    const password = typeof body.password === "string" ? body.password : "";
    const otp = typeof body.otp === "string" ? body.otp : "";

    if (!username || !password || !otp) {
      return NextResponse.json({ message: "請輸入帳號、密碼與 2FA 驗證碼" }, { status: 400 });
    }

    const limitKeys = {
      account: `account:${username}`,
      ip: `ip:${readClientIp(request)}`,
    };
    const limit = checkAuthLimit(authLimiters.adminLogin, limitKeys);
    if (!limit.allowed) {
      return NextResponse.json(
        { message: tooManyAttemptsMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }

    // Every failure below returns the same message, so a caller cannot tell a
    // wrong username from a wrong password or a wrong 2FA code.
    const rejectInvalid = () => {
      recordAuthAttempt(authLimiters.adminLogin, limitKeys);
      return NextResponse.json({ message: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
    };

    const account = await prisma.adminAccount.findUnique({ where: { username } });
    const isValid = await bcrypt.compare(
      password,
      account?.passwordHash || getDummyPasswordHash()
    );
    if (!account || !account.isActive || !isValid) {
      return rejectInvalid();
    }

    const otpMethod = resolveAdminOtpMethod(account);
    if (!otpMethod) {
      return NextResponse.json({ message: "後台登入尚未完成 2FA 設定，請聯絡管理員" }, { status: 503 });
    }

    const otpResult = verifyAdminOtp(otpMethod, otp);
    if (!otpResult.ok) {
      return rejectInvalid();
    }

    if (otpResult.step !== null) {
      // A TOTP code stays valid for its whole 30-second window; remember the
      // last accepted step so the same code cannot be replayed for a second login.
      const claimed = await prisma.adminAccount.updateMany({
        where: {
          id: account.id,
          OR: [{ totpLastUsedStep: null }, { totpLastUsedStep: { lt: otpResult.step } }],
        },
        data: { totpLastUsedStep: otpResult.step, lastLoginAt: new Date() },
      });
      if (claimed.count !== 1) {
        return rejectInvalid();
      }
    } else {
      await prisma.adminAccount.update({
        where: { id: account.id },
        data: { lastLoginAt: new Date() },
      });
    }

    resetAuthAttempts(authLimiters.adminLogin, { account: limitKeys.account });

    await logAdminAction({
      action: "admin.login",
      message: `管理員 ${account.username} 登入後台`,
      targetType: "AdminAccount",
      targetId: account.id,
      metadata: { username: account.username, role: account.role },
    });

    const response = NextResponse.json({
      username: account.username,
      role: account.role,
    });

    const sessionToken = createAdminSessionToken(account);
    setAdminSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error("POST /api/admin/auth/login error:", error);
    return NextResponse.json({ message: "登入失敗，請稍後再試" }, { status: 500 });
  }
}
