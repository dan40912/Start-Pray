import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import {
  getMediaReadRoots,
  resolveMediaPathFromRoot,
  MEDIA_SECURITY_HEADERS,
} from "@/lib/server-media-storage";

const CONTENT_TYPES = {
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".svg": "image/svg+xml",
};

function resolveUploadPaths(segments = []) {
  return getMediaReadRoots("uploads")
    .map((root) => resolveMediaPathFromRoot(root, segments))
    .filter(Boolean);
}

async function buildUploadResponse(params, includeBody) {
  const candidatePaths = resolveUploadPaths(params?.path);
  if (candidatePaths.length === 0) {
    return NextResponse.json({ message: "File not found." }, { status: 404 });
  }

  for (const filePath of candidatePaths) {
    try {
      const fileStat = await stat(filePath);
      if (!fileStat.isFile()) {
        continue;
      }

      const extension = path.extname(filePath).toLowerCase();
      const headers = new Headers({
        "Content-Type": CONTENT_TYPES[extension] || "application/octet-stream",
        "Content-Length": String(fileStat.size),
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Last-Modified": fileStat.mtime.toUTCString(),
        ...MEDIA_SECURITY_HEADERS,
      });

      if (!includeBody) {
        return new NextResponse(null, { status: 200, headers });
      }

      const fileBuffer = await readFile(filePath);
      return new NextResponse(fileBuffer, { status: 200, headers });
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        continue;
      }

      console.error("serve upload failed:", error);
      return NextResponse.json(
        { message: "Failed to load file." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "File not found." }, { status: 404 });
}

export async function GET(request, context) {
  return buildUploadResponse(context?.params, true);
}

export async function HEAD(request, context) {
  return buildUploadResponse(context?.params, false);
}
