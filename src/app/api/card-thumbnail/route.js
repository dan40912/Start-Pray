import { NextResponse } from "next/server";

const MAX_TITLE_LENGTH = 40;

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function normalizeTitle(value) {
  const title = typeof value === "string" && value.trim() ? value.trim() : "代禱";
  return title.replace(/\s+/g, " ").slice(0, MAX_TITLE_LENGTH);
}

function splitTitle(title) {
  const chars = Array.from(title);
  if (chars.length <= 10) return [title];
  if (chars.length <= 20) return [chars.slice(0, 10).join(""), chars.slice(10).join("")];
  return [
    chars.slice(0, 11).join(""),
    chars.slice(11, 22).join(""),
    chars.slice(22, 33).join("") + (chars.length > 33 ? "..." : ""),
  ].filter(Boolean);
}

function resolveFontSize(lines) {
  const longest = Math.max(...lines.map((line) => Array.from(line).length));
  if (lines.length >= 3) return longest > 12 ? 38 : 42;
  if (longest <= 6) return 68;
  if (longest <= 10) return 56;
  return 48;
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = normalizeTitle(searchParams.get("title"));
  const lines = splitTitle(title);
  const fontSize = resolveFontSize(lines);
  const lineHeight = Math.round(fontSize * 1.18);
  const firstY = 315 - ((lines.length - 1) * lineHeight) / 2;

  const tspans = lines
    .map(
      (line, index) =>
        `<tspan x="600" y="${firstY + index * lineHeight}">${escapeXml(line)}</tspan>`
    )
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}">
  <rect width="1200" height="630" fill="#020617"/>
  <rect x="42" y="42" width="1116" height="546" rx="36" fill="none" stroke="#ffffff" stroke-opacity="0.18" stroke-width="2"/>
  <text x="600" y="315" fill="#ffffff" font-family="Arial, 'Noto Sans TC', 'Microsoft JhengHei', sans-serif" font-size="${fontSize}" font-weight="800" text-anchor="middle" dominant-baseline="middle">${tspans}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
