import crypto from "node:crypto";
import path from "node:path";
import { writeFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { ensureActiveCustomer } from "@/lib/customer-access";
import {
  buildMediaPublicUrl,
  ensureMediaWriteDirectory,
} from "@/lib/server-media-storage";
import { requireSessionUser } from "@/lib/server-session";
import { MAX_VOICE_FILE_BYTES } from "@/lib/voiceModeration";

// Modeled closely on src/app/api/customer/story-audio/route.js — same auth,
// validation, and storage pattern, just a different folder segment. Only
// the card owner (an authenticated customer) ever calls this; the resulting
// URL is stored as HomePrayerCard.voiceHref via the existing create/update
// endpoints, not written here.
function sanitizeFileName(input) {
  const parsed = path.parse(input ?? "");
  const extension = parsed.ext?.replace(/[^\w.]+/g, "").slice(0, 12) || ".webm";
  const base = (parsed.name || "card-voice").replace(/[^\w.-]+/g, "-").slice(0, 80);
  return `${base || "card-voice"}${extension}`;
}

export async function POST(request) {
  try {
    const session = requireSessionUser();
    await ensureActiveCustomer(session);

    const data = await request.formData();
    const file = data.get("audio");

    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ message: "請上傳語音留言檔案" }, { status: 400 });
    }

    if (!file.type || !file.type.startsWith("audio/")) {
      return NextResponse.json({ message: "語音檔案必須是音訊格式" }, { status: 400 });
    }

    if (Number(file.size) > MAX_VOICE_FILE_BYTES) {
      return NextResponse.json({ message: "語音留言不可超過 15MB" }, { status: 400 });
    }

    const folderSegments = ["prayer-cards", session.userId];
    const folderPath = await ensureMediaWriteDirectory("voices", folderSegments);
    const safeName = sanitizeFileName(file.name);
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}`;
    const filePath = path.join(folderPath, filename);
    const bytes = Buffer.from(await file.arrayBuffer());

    await writeFile(filePath, bytes);

    return NextResponse.json({
      message: "語音留言已上傳",
      url: buildMediaPublicUrl("voices", [...folderSegments, filename]),
    });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json({ message: "請先登入後再上傳語音留言" }, { status: 401 });
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json({ message: "帳號已被封鎖，無法上傳語音留言" }, { status: 403 });
    }
    if (error?.code === "MEDIA_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: `媒體儲存尚未設定，請設定 ${error.envName}` },
        { status: 503 }
      );
    }

    console.error("POST /api/customer/cards/voice error:", error);
    return NextResponse.json({ message: "語音留言上傳失敗" }, { status: 500 });
  }
}
