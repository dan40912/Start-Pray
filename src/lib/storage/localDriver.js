// PRD-009 — 本地檔案系統 driver。把既有 server-media-storage 的能力收進統一介面。
import path from "node:path";
import { writeFile } from "node:fs/promises";

import {
  buildMediaPublicUrl,
  ensureMediaWriteDirectory,
} from "@/lib/server-media-storage";

export class LocalStorageDriver {
  name = "local";

  // put({ kind, segments, buffer }) -> { key }
  async put({ kind, segments, buffer }) {
    if (!Array.isArray(segments) || segments.length === 0) {
      throw new Error("segments is required");
    }
    const dirSegments = segments.slice(0, -1);
    const filename = segments[segments.length - 1];
    const dir = await ensureMediaWriteDirectory(kind, dirSegments);
    await writeFile(path.join(dir, filename), buffer);
    return { key: buildMediaPublicUrl(kind, segments) };
  }

  getPublicUrl(kind, segments) {
    return buildMediaPublicUrl(kind, segments);
  }

  // 本地永遠可寫(實際磁碟錯誤仍由既有 server-media-storage 例外處理)
  assertWritable() {}
}
