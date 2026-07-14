// One-time migration for the 2026-07-01 moderation policy change:
// responses are now auto-approved on upload, and only go back to PENDING when
// reported (see src/app/api/responses/route.js and
// src/app/api/prayer-response/report/route.js). This script does the
// requested clean slate: every existing PrayerResponse row is set to
// voiceModerationStatus = APPROVED, regardless of current status or past
// report count, so past text/voice replies stop being stuck invisible.
//
// Note: this does NOT touch isBlocked. A response that an admin has
// explicitly blocked stays hidden (isBlocked is a separate, stronger gate
// than voiceModerationStatus) — only the moderation-status field is reset.
// If you also want previously-blocked responses to reappear, unblock them
// separately from /admin/prayerresponse.
//
// Run against the real database (this cannot be run from a sandbox without
// DB access):
//   node scripts/approve-existing-responses.js
//
// Add --dry-run to preview the count without writing anything:
//   node scripts/approve-existing-responses.js --dry-run

const { PrismaClient } = require("@prisma/client");

const DRY_RUN = process.argv.includes("--dry-run");

async function main() {
  const prisma = new PrismaClient();

  try {
    const total = await prisma.prayerResponse.count();
    const alreadyApproved = await prisma.prayerResponse.count({
      where: { voiceModerationStatus: "APPROVED" },
    });
    const toApprove = total - alreadyApproved;
    const blockedCount = await prisma.prayerResponse.count({ where: { isBlocked: true } });

    console.log(`Total responses: ${total}`);
    console.log(`Already APPROVED: ${alreadyApproved}`);
    console.log(`Will be updated to APPROVED: ${toApprove}`);
    console.log(
      `Of those, ${blockedCount} are isBlocked and will stay hidden despite being APPROVED (unblock separately if needed).`
    );

    if (DRY_RUN) {
      console.log("Dry run only — no changes written.");
      return;
    }

    if (toApprove === 0) {
      console.log("Nothing to update.");
      return;
    }

    const result = await prisma.prayerResponse.updateMany({
      where: { voiceModerationStatus: { not: "APPROVED" } },
      data: { voiceModerationStatus: "APPROVED" },
    });

    console.log(`Updated ${result.count} responses to APPROVED.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error("Failed to approve existing responses:", error);
  process.exit(1);
});
