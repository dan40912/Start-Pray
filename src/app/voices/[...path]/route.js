import path from "node:path";
import { readFile, stat } from "node:fs/promises";

import { NextResponse } from "next/server";

import { parseByteRange } from "@/lib/byte-range";
import {
  getMediaReadRoots,
  resolveMediaPathFromRoot,
} from "@/lib/server-media-storage";

const CONTENT_TYPES = {
  ".aac": "audio/aac",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".mp3": "audio/mpeg",
  ".mp4": "audio/mp4",
  ".oga": "audio/ogg",
  ".ogg": "audio/ogg",
  ".opus": "audio/ogg",
  ".wav": "audio/wav",
  ".webm": "audio/webm",
};

function resolveVoicePaths(segments = []) {
  return getMediaReadRoots("voices")
    .map((root) => resolveMediaPathFromRoot(root, segments))
    .filter(Boolean);
}

async function buildVoiceResponse(request, params, includeBody) {
  const candidatePaths = resolveVoicePaths(params?.path);
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
        "Accept-Ranges": "bytes",
        "Cache-Control": "public, max-age=0, must-revalidate",
        "Last-Modified": fileStat.mtime.toUTCString(),
      });

      // Safari will not play audio from a server that never answers 206, and
      // Chrome cannot seek a WebM without it.
      const range = parseByteRange(request?.headers?.get("range"), fileStat.size);
      if (range?.unsatisfiable) {
        headers.set("Content-Range", `bytes */${fileStat.size}`);
        return new NextResponse(null, { status: 416, headers });
      }

      const start = range ? range.start : 0;
      const end = range ? range.end : fileStat.size - 1;
      const status = range ? 206 : 200;
      headers.set("Content-Length", String(Math.max(end - start + 1, 0)));
      if (range) headers.set("Content-Range", `bytes ${start}-${end}/${fileStat.size}`);

      if (!includeBody) {
        return new NextResponse(null, { status, headers });
      }

      // Voice files are capped at 12 MB on upload, so reading whole is fine.
      const fileBuffer = await readFile(filePath);
      const body = range ? fileBuffer.subarray(start, end + 1) : fileBuffer;
      return new NextResponse(body, { status, headers });
    } catch (error) {
      if (error?.code === "ENOENT" || error?.code === "ENOTDIR") {
        continue;
      }

      console.error("serve voice failed:", error);
      return NextResponse.json(
        { message: "Failed to load file." },
        { status: 500 }
      );
    }
  }

  return NextResponse.json({ message: "File not found." }, { status: 404 });
}

export async function GET(request, context) {
  return buildVoiceResponse(request, context?.params, true);
}

export async function HEAD(request, context) {
  return buildVoiceResponse(request, context?.params, false);
}
