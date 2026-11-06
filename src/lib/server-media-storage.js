import path from "node:path";
import { mkdir, stat } from "node:fs/promises";

const MEDIA_CONFIG = {
  voices: {
    envName: "VOICES_STORAGE_DIR",
    publicPrefix: "/voices",
    legacySegments: ["public", "voices"],
  },
  uploads: {
    envName: "UPLOADS_STORAGE_DIR",
    publicPrefix: "/uploads",
    legacySegments: ["public", "uploads"],
  },
};

// Grandfather only files that were already on disk before media ownership
// tracking was introduced. Operators can set the actual rollout time.
const DEFAULT_LEGACY_MEDIA_CUTOFF = "2026-11-06T00:00:00.000Z";

// User-uploaded media is served from this origin, so stop the browser from
// sniffing it into HTML and, if a file is ever opened directly (e.g. an SVG),
// render it sandboxed with no script. <img>/<audio> embedding is unaffected.
export const MEDIA_SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'; media-src 'self'; sandbox",
};

export class MediaStorageConfigError extends Error {
  constructor(kind, envName) {
    super(`${envName} is required in production to store ${kind}.`);
    this.name = "MediaStorageConfigError";
    this.code = "MEDIA_STORAGE_NOT_CONFIGURED";
    this.kind = kind;
    this.envName = envName;
  }
}

function getMediaConfig(kind) {
  const config = MEDIA_CONFIG[kind];
  if (!config) {
    throw new Error(`Unsupported media storage kind: ${kind}`);
  }
  return config;
}

function getLegacyMediaRoot(kind) {
  const config = getMediaConfig(kind);
  return path.join(process.cwd(), ...config.legacySegments);
}

function getConfiguredMediaRoot(kind) {
  const config = getMediaConfig(kind);
  const rawValue = process.env[config.envName]?.trim();
  return rawValue ? path.resolve(rawValue) : null;
}

function normalizeSegments(segments = []) {
  if (!Array.isArray(segments)) return null;

  const normalized = [];
  for (const segment of segments) {
    if (typeof segment !== "string") return null;
    const trimmed = segment.trim();
    if (!trimmed) return null;
    normalized.push(trimmed);
  }

  return normalized;
}

export function getMediaReadRoots(kind) {
  const configuredRoot = getConfiguredMediaRoot(kind);
  const legacyRoot = getLegacyMediaRoot(kind);
  return [...new Set([configuredRoot, legacyRoot].filter(Boolean))];
}

export async function isLegacyUnreferencedMedia(kind, segments = []) {
  const cutoffValue = process.env.MEDIA_LEGACY_CUTOFF_AT?.trim() || DEFAULT_LEGACY_MEDIA_CUTOFF;
  const cutoff = Date.parse(cutoffValue);
  if (!Number.isFinite(cutoff)) return false;

  for (const root of getMediaReadRoots(kind)) {
    const filePath = resolveMediaPathFromRoot(root, segments);
    if (!filePath) continue;

    try {
      const fileStat = await stat(filePath);
      if (fileStat.isFile() && fileStat.mtimeMs < cutoff) return true;
    } catch (error) {
      if (error?.code !== "ENOENT" && error?.code !== "ENOTDIR") throw error;
    }
  }

  return false;
}

export function getMediaWriteRoot(kind) {
  const configuredRoot = getConfiguredMediaRoot(kind);
  if (configuredRoot) {
    return configuredRoot;
  }

  const config = getMediaConfig(kind);
  if (process.env.NODE_ENV === "production") {
    throw new MediaStorageConfigError(kind, config.envName);
  }

  return getLegacyMediaRoot(kind);
}

export function resolveMediaPathFromRoot(root, segments = []) {
  const safeSegments = normalizeSegments(segments);
  if (!root || !safeSegments) {
    return null;
  }

  const normalizedRoot = path.resolve(root);
  const resolvedPath = path.resolve(normalizedRoot, ...safeSegments);
  if (
    resolvedPath !== normalizedRoot &&
    !resolvedPath.startsWith(`${normalizedRoot}${path.sep}`)
  ) {
    return null;
  }

  return resolvedPath;
}

export async function ensureMediaWriteDirectory(kind, segments = []) {
  const targetPath = resolveMediaPathFromRoot(getMediaWriteRoot(kind), segments);
  if (!targetPath) {
    throw new Error(`Invalid media directory for ${kind}.`);
  }

  await mkdir(targetPath, { recursive: true });
  return targetPath;
}

export function buildMediaPublicUrl(kind, segments = []) {
  const config = getMediaConfig(kind);
  const safeSegments = normalizeSegments(segments);
  if (!safeSegments) {
    throw new Error(`Invalid media URL segments for ${kind}.`);
  }

  return `${config.publicPrefix}/${safeSegments
    .map((segment) => encodeURIComponent(segment))
    .join("/")}`;
}
