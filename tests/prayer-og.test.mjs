import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import { renderPrayerOg } from "../src/lib/prayer-og.mjs";

test("share images render Chinese, long titles, and markup as a real PNG", async () => {
  for (const title of [
    "為家人的健康與平安禱告",
    "願正在面對艱難處境的家人得到安慰與盼望".repeat(10),
    '<希望> & "陪伴"',
  ]) {
    const png = await renderPrayerOg(title);
    const image = sharp(png);
    const meta = await image.metadata();
    assert.equal(meta.format, "png");
    assert.equal(meta.width, 1200);
    assert.equal(meta.height, 630);
    // Text must survive the square centre crop used by compact previews.
    const stats = await image.extract({ left: 285, top: 120, width: 630, height: 390 }).stats();
    assert.ok(stats.channels[0].max > 220);
    assert.ok(png.length < 500_000);
  }
});
