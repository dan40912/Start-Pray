import path from "node:path";
import sharp from "sharp";

const fontfile = path.join(process.cwd(), "assets/fonts/NotoSansTC.ttf");
const escapeMarkup = (text) =>
  text.replace(
    /[&<>"']/g,
    (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[char]
  );

export async function renderPrayerOg(rawTitle) {
  const chars = Array.from(
    String(rawTitle || "代禱")
      .replace(/\s+/g, " ")
      .trim() || "代禱"
  );
  const title = chars.length > 21 ? `${chars.slice(0, 20).join("")}…` : chars.join("");
  const renderText = (text, size) =>
    sharp({
      text: {
        text: `<span foreground="#ffffff">${escapeMarkup(text)}</span>`,
        font: `Noto Sans TC Bold ${size}`,
        fontfile,
        width: 600,
        align: "center",
        wrap: "char",
        rgba: true,
      },
    })
      .png()
      .toBuffer({ resolveWithObject: true });
  const [heading, brand] = await Promise.all([renderText(title, 80), renderText("Start Pray", 30)]);
  const headingTop = Math.round((630 - heading.info.height - 80) / 2);
  const ground = Buffer.from(
    '<svg width="1200" height="630"><rect width="1200" height="630" fill="#131e36"/><rect x="570" y="85" width="60" height="4" fill="#fbbf24"/></svg>'
  );
  return sharp(ground)
    .composite([
      { input: heading.data, left: Math.round((1200 - heading.info.width) / 2), top: headingTop },
      {
        input: brand.data,
        left: Math.round((1200 - brand.info.width) / 2),
        top: headingTop + heading.info.height + 40,
      },
    ])
    .png()
    .toBuffer();
}
