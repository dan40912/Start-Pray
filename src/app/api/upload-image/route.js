import crypto from "node:crypto";
import path from "node:path";
import { writeFile } from "node:fs/promises";

import { NextResponse } from "next/server";
import sharp from "sharp";

import { ensureActiveCustomer } from "@/lib/customer-access";
import {
  buildMediaPublicUrl,
  ensureMediaWriteDirectory,
} from "@/lib/server-media-storage";
import { requireSessionUser } from "@/lib/server-session";
import { assertStorageWritable } from "@/lib/storage";

const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 78;

function sanitizeFileStem(name = "") {
  const parsed = path.parse(name);
  const source = parsed.name || "image";
  const normalized = source.toLowerCase().replace(/[^a-z0-9._-]+/g, "_");
  return normalized.slice(-80) || "image";
}

export async function POST(request) {
  try {
    const session = requireSessionUser();
    await ensureActiveCustomer(session);

    const data = await request.formData();
    const file = data.get("file");

    if (!file || typeof file === "string" || typeof file.arrayBuffer !== "function") {
      return NextResponse.json(
        { message: "請先選擇要上傳的圖片檔案。" },
        { status: 400 }
      );
    }

    if (!file.type || !file.type.startsWith("image/")) {
      return NextResponse.json({ message: "只接受圖片檔案。" }, { status: 400 });
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { message: "圖片大小不可超過 10MB。" },
        { status: 400 }
      );
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());

    let compressedBuffer;
    try {
      compressedBuffer = await sharp(fileBuffer, { failOnError: true })
        .rotate()
        .resize({
          width: MAX_DIMENSION,
          height: MAX_DIMENSION,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: WEBP_QUALITY, effort: 6 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { message: "圖片格式無法處理，請改用 JPG、PNG 或 WEBP。" },
        { status: 400 }
      );
    }

    // PRD-009:依設定的 storage driver 判斷是否可寫(object driver 未設定時丟出可捕捉錯誤)
    assertStorageWritable();

    const safeName = sanitizeFileStem(file.name);
    const filename = `${Date.now()}-${crypto.randomUUID().slice(0, 8)}-${safeName}.webp`;
    const uploadDir = await ensureMediaWriteDirectory("uploads");
    const filePath = path.join(uploadDir, filename);

    await writeFile(filePath, compressedBuffer);

    return NextResponse.json({
      message: "圖片上傳成功。",
      url: buildMediaPublicUrl("uploads", [filename]),
      compressed: true,
    });
  } catch (error) {
    if (error?.code === "UNAUTHENTICATED") {
      return NextResponse.json(
        { message: "請先登入後再上傳圖片。" },
        { status: 401 }
      );
    }
    if (error?.code === "ACCOUNT_BLOCKED") {
      return NextResponse.json(
        { message: "帳號已被停用，無法上傳圖片。" },
        { status: 403 }
      );
    }
    if (error?.code === "MEDIA_STORAGE_NOT_CONFIGURED") {
      return NextResponse.json(
        { message: `媒體儲存尚未設定，請設定 ${error.envName}。` },
        { status: 503 }
      );
    }

    console.error("upload-image failed:", error);
    return NextResponse.json(
      { message: "圖片上傳失敗，請稍後再試。" },
      { status: 500 }
    );
  }
}
