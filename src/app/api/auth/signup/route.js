import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";

import {
  authLimiters,
  checkAuthLimit,
  recordAuthAttempt,
  tooManyAttemptsMessage,
} from "@/lib/auth-rate-limit";
import { readClientIp } from "@/lib/client-ip";
import prisma from "@/lib/prisma";
import {
  createCustomerSessionToken,
  setCustomerSessionCookie,
} from "@/lib/customer-session";

const REQUIRED_FIELDS = [
  "fullName",
  "username",
  "email",
  "password",
  "confirmPassword",
  "acceptedTerms",
];

const normalizeString = (value) => (typeof value === "string" ? value.trim() : "");

export async function POST(request) {
  try {
    const payload = await request.json();

    for (const field of REQUIRED_FIELDS) {
      if (payload[field] === undefined || payload[field] === null) {
        return NextResponse.json({ message: `缺少必要欄位：${field}` }, { status: 400 });
      }
    }

    const fullName = normalizeString(payload.fullName);
    const username = normalizeString(payload.username).toLowerCase();
    const email = normalizeString(payload.email).toLowerCase();
    const faithTradition = normalizeString(payload.faithTradition);
    const country = normalizeString(payload.country);
    const password = normalizeString(payload.password);
    const confirmPassword = normalizeString(payload.confirmPassword);
    const acceptedTerms = Boolean(payload.acceptedTerms);

    if (!fullName || !username || !email) {
      return NextResponse.json({ message: "請填寫暱稱、Username 與電子信箱。" }, { status: 400 });
    }

    if (!/^[a-z0-9_-]{4,}$/i.test(username)) {
      return NextResponse.json({ message: "Username 至少 4 碼，且只能包含英數、底線與減號。" }, { status: 400 });
    }

    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return NextResponse.json({ message: "請輸入有效的電子信箱。" }, { status: 400 });
    }

    if (password.length < 8) {
      return NextResponse.json({ message: "密碼至少需要 8 碼。" }, { status: 400 });
    }

    if (password !== confirmPassword) {
      return NextResponse.json({ message: "兩次輸入的密碼不一致。" }, { status: 400 });
    }

    if (!acceptedTerms) {
      return NextResponse.json({ message: "請先閱讀並同意條款。" }, { status: 400 });
    }

    // Counted only once the form is valid, so fixing typos never uses up attempts.
    const limitKeys = { ip: `ip:${readClientIp(request)}` };
    const limit = checkAuthLimit(authLimiters.signup, limitKeys);
    if (!limit.allowed) {
      return NextResponse.json(
        { message: tooManyAttemptsMessage(limit.retryAfterSeconds) },
        { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } }
      );
    }
    recordAuthAttempt(authLimiters.signup, limitKeys);

    const existing = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (existing) {
      return NextResponse.json({ message: "Email 或 Username 已存在。" }, { status: 409 });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        email,
        name: fullName,
        username,
        faithTradition: faithTradition || null,
        country: country || null,
        passwordHash,
        acceptedTerms: true,
        publicProfileEnabled: true,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
        faithTradition: true,
        country: true,
        publicProfileEnabled: true,
        sessionVersion: true,
        createdAt: true,
      },
    });

    const response = NextResponse.json(
      {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          username: user.username,
          faithTradition: user.faithTradition,
          country: user.country,
          publicProfileEnabled: user.publicProfileEnabled,
          createdAt: user.createdAt,
        },
      },
      { status: 201 }
    );

    const sessionToken = createCustomerSessionToken(user);
    setCustomerSessionCookie(response, sessionToken);
    return response;
  } catch (error) {
    console.error("POST /api/auth/signup", error);
    return NextResponse.json({ message: "建立帳戶時發生錯誤。" }, { status: 500 });
  }
}
