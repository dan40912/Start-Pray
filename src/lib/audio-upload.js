// Shared extension policy for every voice/audio upload endpoint.
//
// The stored file's extension decides the Content-Type it is later served
// with (by /voices/[...path] or by Nginx when it aliases the media folder).
// A client-chosen extension such as ".html" or ".svg" would turn an "audio"
// upload into a page that runs script on this origin, so the extension is
// always taken from this allowlist — never copied from the upload as-is.
//
// Kept free of Next.js imports so it stays unit-testable under `node --test`.

const ALLOWED_AUDIO_EXTENSIONS = new Set([
  ".webm",
  ".mp3",
  ".mp4",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".flac",
]);

const AUDIO_EXTENSION_BY_MIME = {
  "audio/webm": ".webm",
  "audio/mpeg": ".mp3",
  "audio/mp3": ".mp3",
  "audio/mp4": ".m4a",
  "audio/m4a": ".m4a",
  "audio/x-m4a": ".m4a",
  "audio/aac": ".aac",
  "audio/ogg": ".ogg",
  "audio/opus": ".opus",
  "audio/wav": ".wav",
  "audio/wave": ".wav",
  "audio/x-wav": ".wav",
  "audio/flac": ".flac",
  "audio/x-flac": ".flac",
};

export const ALLOWED_AUDIO_FORMATS_LABEL = "webm、mp3、m4a、aac、ogg、wav 或 flac";

function splitFileName(name) {
  const raw = typeof name === "string" ? name : "";
  // Drop any directory part a client may have sent.
  const basename = raw.split(/[\\/]/).pop() || "";
  const dotIndex = basename.lastIndexOf(".");
  if (dotIndex <= 0) {
    return { stem: basename, extension: "" };
  }
  return {
    stem: basename.slice(0, dotIndex),
    extension: basename.slice(dotIndex).toLowerCase(),
  };
}

function normalizeMimeType(mimeType) {
  return String(mimeType || "")
    .split(";")[0]
    .trim()
    .toLowerCase();
}

/**
 * Picks a safe extension for an uploaded audio file.
 * An allowlisted extension on the original name is kept (so existing
 * recorder file names are unchanged); otherwise it is derived from the MIME
 * type. Returns null when neither is a known audio format.
 */
export function resolveAudioExtension({ name, type } = {}) {
  const { extension } = splitFileName(name);
  if (ALLOWED_AUDIO_EXTENSIONS.has(extension)) {
    return extension;
  }
  return AUDIO_EXTENSION_BY_MIME[normalizeMimeType(type)] ?? null;
}

/**
 * Builds "<sanitized stem><safe extension>" for an uploaded audio file, or
 * null when the file is not an allowed audio format.
 */
export function buildSafeAudioFileName(file, fallbackStem = "voice") {
  const extension = resolveAudioExtension(file);
  if (!extension) return null;

  const { stem } = splitFileName(file?.name);
  const safeStem = stem.replace(/[^\w.-]+/g, "-").slice(0, 80) || fallbackStem;
  return `${safeStem}${extension}`;
}
