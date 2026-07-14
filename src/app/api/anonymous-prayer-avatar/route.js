import { NextResponse } from "next/server";

const PALETTES = [
  ["#6D5E91", "#E8DDF5", "#F7F1FC"],
  ["#3F7567", "#D5ECE4", "#F0FAF6"],
  ["#A4654A", "#F2DED2", "#FFF5EF"],
  ["#526F9D", "#DCE7F6", "#F3F7FD"],
  ["#8A667C", "#ECDDE7", "#FBF3F8"],
];

const SKIN_TONES = ["#F4C9A8", "#E8B58E", "#CF916B", "#A96849", "#754632"];

function hashSeed(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function GET(request) {
  const rawSeed = request.nextUrl.searchParams.get("seed") || "prayer-friend";
  const seed = /^[a-zA-Z0-9_-]{1,80}$/.test(rawSeed) ? rawSeed : "prayer-friend";
  const hash = hashSeed(seed);
  const [accent, clothing, background] = PALETTES[hash % PALETTES.length];
  const skin = SKIN_TONES[(hash >>> 4) % SKIN_TONES.length];
  const haloTilt = (hash >>> 8) % 2 === 0 ? -3 : 3;
  const gradientId = `g${hash.toString(16)}`;

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128" role="img" aria-label="Anonymous prayer friend">
      <defs>
        <linearGradient id="${gradientId}" x1="16" y1="8" x2="112" y2="120" gradientUnits="userSpaceOnUse">
          <stop stop-color="${background}"/>
          <stop offset="1" stop-color="${clothing}"/>
        </linearGradient>
      </defs>
      <rect width="128" height="128" rx="64" fill="url(#${gradientId})"/>
      <circle cx="64" cy="64" r="54" fill="none" stroke="${accent}" stroke-opacity=".16" stroke-width="2"/>
      <ellipse cx="64" cy="29" rx="21" ry="7" fill="none" stroke="${accent}" stroke-width="4" transform="rotate(${haloTilt} 64 29)"/>
      <circle cx="64" cy="52" r="21" fill="${skin}"/>
      <path d="M44 49c2-18 38-24 42 2-8-7-17-10-28-7-5 2-9 5-14 5Z" fill="${accent}"/>
      <circle cx="56" cy="53" r="2" fill="${accent}"/>
      <circle cx="72" cy="53" r="2" fill="${accent}"/>
      <path d="M58 62c4 3 8 3 12 0" fill="none" stroke="${accent}" stroke-linecap="round" stroke-width="2.5"/>
      <path d="M29 112c3-25 16-38 35-38s32 13 35 38" fill="${clothing}" stroke="${accent}" stroke-width="3"/>
      <path d="M55 88c2-7 6-12 9-12s7 5 9 12l-4 24H59l-4-24Z" fill="${skin}" stroke="${accent}" stroke-linejoin="round" stroke-width="2.5"/>
      <path d="M64 80v29" stroke="${accent}" stroke-linecap="round" stroke-width="2.5"/>
      <path d="M54 91c-7 2-12 7-15 15M74 91c7 2 12 7 15 15" fill="none" stroke="${accent}" stroke-linecap="round" stroke-width="3"/>
      <path d="M105 28v10M100 33h10" stroke="${accent}" stroke-linecap="round" stroke-width="3"/>
    </svg>`;

  return new NextResponse(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
