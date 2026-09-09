import { NextResponse } from "next/server";

const MAX_TITLE_LENGTH = 40;

/**
 * 沒有自訂封面時的預設卡面。
 *
 * 舊版是 #020617 純黑底 + 白色 Arial 800 粗體標題，而詳情頁的 hero 高
 * clamp(260px, 44vw, 460px) —— 使用者落地看到的第一屏是一塊滿版黑方塊，
 * 第一反應是「圖壞了」。而且下方的 h1 又把同一個標題再印一次。
 *
 * 改成看得出是刻意設計的素色卡：標題決定色相（同一則代禱永遠同一個顏色），
 * 低飽和夜色漸層 + 一圈守望的光暈，標題退到左下角當註記而不是主體。
 */

// 與 tokens.css 的 night 表面同一個家族，配得上暖金 accent。
const COVERS = [
  { from: "#131e36", to: "#1d2c4d" }, // 靛
  { from: "#0f2430", to: "#17323f" }, // 墨青
  { from: "#1e1730", to: "#2a2142" }, // 紫
  { from: "#241b12", to: "#33261a" }, // 赭
  { from: "#101f22", to: "#183034" }, // 松
];

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

// 同一個標題永遠拿到同一張卡面，不然每次重新整理顏色都在跳。
function hashTitle(title) {
  let hash = 0;
  for (let i = 0; i < title.length; i += 1) {
    hash = (hash * 31 + title.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// 標題只是註記，不是主視覺——兩行就夠，卡片與詳情頁下方都另有 h1。
function splitTitle(title) {
  const chars = Array.from(title);
  if (chars.length <= 14) return [title];
  const head = chars.slice(0, 14).join("");
  const tail = chars.slice(14, 28).join("") + (chars.length > 28 ? "…" : "");
  return [head, tail];
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const title = normalizeTitle(searchParams.get("title"));
  const cover = COVERS[hashTitle(title) % COVERS.length];
  const lines = splitTitle(title);
  const baseY = 545 - (lines.length - 1) * 46;

  const tspans = lines
    .map((line, index) => `<tspan x="84" y="${baseY + index * 46}">${escapeXml(line)}</tspan>`)
    .join("");

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeXml(title)}">
  <defs>
    <linearGradient id="ground" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${cover.from}"/>
      <stop offset="100%" stop-color="${cover.to}"/>
    </linearGradient>
    <radialGradient id="halo" cx="0.72" cy="0.3" r="0.55">
      <stop offset="0%" stop-color="#fbbf24" stop-opacity="0.22"/>
      <stop offset="100%" stop-color="#fbbf24" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#ground)"/>
  <rect width="1200" height="630" fill="url(#halo)"/>
  <g fill="none" stroke="#fbbf24" stroke-opacity="0.18" stroke-width="2">
    <circle cx="864" cy="189" r="96"/>
    <circle cx="864" cy="189" r="150"/>
    <circle cx="864" cy="189" r="212"/>
  </g>
  <rect x="84" y="446" width="52" height="3" fill="#fbbf24" fill-opacity="0.85"/>
  <text x="84" y="${baseY}" fill="#ffffff" fill-opacity="0.9" font-family="'Noto Serif TC', 'Songti TC', 'Microsoft JhengHei', serif" font-size="38" font-weight="600">${tspans}</text>
</svg>`;

  return new NextResponse(svg, {
    status: 200,
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
