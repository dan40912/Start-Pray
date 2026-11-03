import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  authLimiters,
  checkAuthLimit,
  recordAuthAttempt,
  resetAuthAttempts,
  tooManyAttemptsMessage,
} from "@/lib/auth-rate-limit";
import { readClientIp } from "@/lib/client-ip";
import prisma from "@/lib/prisma";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
} from "@/lib/customer-session";

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ message: "請輸入電子郵件與密碼" }, { status: 400 });
    }

    const normalizedEmail = String(email).toLowerCase();
    const limitKeys = {
      account: `account:${normalizedEmail}`,
      ip: `ip:${readClientIp(request)}`,
    };
    const limit = checkAuthLimit(authLimiters.customerLogin, limitKeys);
    if (!limit.allowed) {
      return NextResponse.json(
        { message: tooManyAttemptsMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        sessionVersion: true,
        publicProfileEnabled: true,
        passwordHash: true,
        isBlocked: true,
        avatarUrl: true,
        bio: true,
      },
    });

    if (!user || !user.passwordHash) {
      recordAuthAttempt(authLimiters.customerLogin, limitKeys);
      return NextResponse.json({ message: "帳號或密碼不正確" }, { status: 401 });
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);
    if (!isValid) {
      recordAuthAttempt(authLimiters.customerLogin, limitKeys);
      return NextResponse.json({ message: "帳號或密碼不正確" }, { status: 401 });
    }
    if (user.isBlocked) {
      return NextResponse.json({ message: "帳號已被停用" }, { status: 403 });
    }
    resetAuthAttempts(authLimiters.customerLogin, { account: limitKeys.account });

    const response = NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        username: user.username,
        isBlocked: user.isBlocked,
        avatarUrl: user.avatarUrl,
        bio: user.bio,
        publicProfileEnabled: user.publicProfileEnabled,
      },
    });

    const sessionToken = createCustomerSessionToken(user);
    setCustomerSessionCookie(response, sessionToken);

    return response;
  } catch (error) {
    console.error("POST /api/auth/login 發生錯誤", error);
    return NextResponse.json({ message: "登入時發生錯誤" }, { status: 500 });
  }
}
