// PRD-006 — 將舊 PrayerRequest 安全遷移到 HomePrayerCard(冪等、支援 --dry-run)。
// 只「複製 + 改掛回應 + 標記」,不刪除任何來源資料、欄位或表。
//
// 用法:
//   node scripts/migrate-prayerrequest-to-homecard.js --dry-run
//   node scripts/migrate-prayerrequest-to-homecard.js
//
// 冪等性:每個 PrayerRequest 對應的 HomePrayerCard 使用固定 slug `legacy-pr-<id>`。
// 重跑時若該 slug 已存在,視為已遷移並跳過,不會建立重複卡片。

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes("--dry-run");
const DEFAULT_IMAGE = "/img/personal.jpg";

function legacySlug(prayerRequestId) {
  return `legacy-pr-${prayerRequestId}`;
}

async function resolveFallbackCategoryId() {
  const active = await prisma.homePrayerCategory.findFirst({
    where: { isActive: true },
    orderBy: { id: "asc" },
    select: { id: true },
  });
  if (active) return active.id;
  const any = await prisma.homePrayerCategory.findFirst({
    orderBy: { id: "asc" },
    select: { id: true },
  });
  return any ? any.id : null;
}

async function main() {
  console.log(`[migrate] mode: ${DRY_RUN ? "DRY-RUN (不寫入)" : "LIVE (會寫入)"}`);

  const requests = await prisma.prayerRequest.findMany({
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      createdAt: true,
      ownerId: true,
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  console.log(`[migrate] 找到 ${requests.length} 筆 PrayerRequest`);

  const fallbackCategoryId = await resolveFallbackCategoryId();
  if (fallbackCategoryId === null) {
    console.error("[migrate] 找不到任何 HomePrayerCategory,無法建立卡片。請先建立分類。");
    process.exitCode = 1;
    return;
  }

  let toCreate = 0;
  let skipped = 0;
  let responsesToRelink = 0;

  for (const req of requests) {
    const slug = legacySlug(req.id);
    const existing = await prisma.homePrayerCard.findUnique({
      where: { slug },
      select: { id: true },
    });

    if (existing) {
      skipped += 1;
      // 即使卡片已存在,仍確認其回應是否都已改掛(冪等補救)
      const pending = await prisma.prayerResponse.count({
        where: { prayerRequestId: req.id, homeCardId: null },
      });
      responsesToRelink += pending;
      if (pending > 0 && !DRY_RUN) {
        await prisma.prayerResponse.updateMany({
          where: { prayerRequestId: req.id, homeCardId: null },
          data: { homeCardId: existing.id },
        });
      }
      continue;
    }

    toCreate += 1;
    responsesToRelink += req._count.responses;

    if (DRY_RUN) continue;

    const card = await prisma.homePrayerCard.create({
      data: {
        slug,
        image: DEFAULT_IMAGE,
        title: req.title || "(未命名代禱)",
        description: req.description || "",
        tags: [],
        meta: [`migrated-from:prayerRequest:${req.id}`],
        detailsHref: "",
        isPrivate: false,
        categoryId: fallbackCategoryId,
        ownerId: req.ownerId ?? null,
        createdAt: req.createdAt ?? new Date(),
      },
      select: { id: true },
    });

    await prisma.homePrayerCard.update({
      where: { id: card.id },
      data: { detailsHref: `/prayfor/${card.id}` },
    });

    // 保留 prayerRequestId,僅補上 homeCardId(回溯用)
    await prisma.prayerResponse.updateMany({
      where: { prayerRequestId: req.id, homeCardId: null },
      data: { homeCardId: card.id },
    });
  }

  console.log("[migrate] 摘要:");
  console.log(`  將建立卡片數          : ${toCreate}`);
  console.log(`  已存在而跳過          : ${skipped}`);
  console.log(`  將改掛 / 已改掛的回應 : ${responsesToRelink}`);
  if (DRY_RUN) {
    console.log("[migrate] DRY-RUN 結束,未寫入任何資料。");
  } else {
    console.log("[migrate] 完成。來源 PrayerRequest 與 prayerRequestId 皆保留未刪除。");
  }
}

main()
  .catch((err) => {
    console.error("[migrate] 失敗:", err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
