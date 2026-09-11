// 兩種表面、一套 token（見 src/styles/tokens.css）。
//   night 沉浸情境 — 夜色是內容的一部分：世界此刻在禱告
//   day   閱讀與書寫 — 要讀字、要填表、要建立信任
// 沒有列到的路徑一律 day，因為表單與長文預設就該是淺色。
//
// layout.js（伺服器首次渲染）與 SurfaceSync（站內換頁）共用這一份規則。
const NIGHT_PREFIXES = [
  "/global-prayer-room",
  "/prayfor",
];

export function resolveSurface(pathname) {
  const path = (pathname || "/").replace(/^\/en(?=\/|$)/, "") || "/";
  if (path === "/") return "night";
  return NIGHT_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`))
    ? "night"
    : "day";
}
