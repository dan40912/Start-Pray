// Parses a single HTTP `Range: bytes=...` header against a file size.
//
// Media elements depend on this: Safari refuses to play audio from a server
// that never answers 206, and Chrome cannot seek a WebM without it.
//
// Returns:
//   null                          → no usable range; serve the whole file (200)
//   { start, end }                → inclusive byte offsets to serve (206)
//   { unsatisfiable: true }       → answer 416
export function parseByteRange(header, size) {
  if (typeof header !== "string") return null;
  const match = /^\s*bytes\s*=\s*(\d*)\s*-\s*(\d*)\s*$/i.exec(header);
  // Multiple ranges and other units are legal to ignore — a full 200 response
  // is a valid answer to them.
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (rawStart === "" && rawEnd === "") return null;
  if (!Number.isFinite(size) || size <= 0) return { unsatisfiable: true };

  if (rawStart === "") {
    // Suffix form: the last N bytes.
    const suffix = Number(rawEnd);
    if (suffix === 0) return { unsatisfiable: true };
    return { start: Math.max(size - suffix, 0), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Math.min(Number(rawEnd), size - 1);
  if (start >= size || end < start) return { unsatisfiable: true };
  return { start, end };
}
