#!/usr/bin/env node

const { PrismaClient } = require("@prisma/client");
const { loadEnvConfig } = require("@next/env");

loadEnvConfig(process.cwd(), false);

const REQUIRED_TABLES = ["user", "home_prayer_card", "prayerresponse", "token_reward_rule"];

const RELEASE_MIGRATIONS = [
  {
    name: "20260630000100_add_prd005_review_fields",
    columns: [
      ["user", "trustScore"],
      ["user", "flaggedCount"],
      ["home_prayer_card", "needsReview"],
    ],
    indexes: [],
  },
  {
    name: "20260709000100_add_voice_moderation",
    columns: [
      ["prayerresponse", "voiceModerationStatus"],
      ["prayerresponse", "voiceModeratedAt"],
      ["prayerresponse", "voiceModeratedBy"],
      ["prayerresponse", "voiceAutoFlags"],
    ],
    indexes: [],
  },
  {
    name: "20260711000100_add_guest_response_moderation",
    columns: [
      ["prayerresponse", "moderationStatus"],
      ["prayerresponse", "guestSessionHash"],
      ["prayerresponse", "ipHash"],
    ],
    indexes: [
      ["prayerresponse", "prayerresponse_guestSessionHash_createdAt_idx"],
      ["prayerresponse", "prayerresponse_ipHash_createdAt_idx"],
    ],
  },
  {
    name: "20260715000100_add_token_reward_safety_fields",
    columns: [
      ["token_reward_rule", "rewardsEnabled"],
      ["token_reward_rule", "dailyRewardCap"],
      ["token_reward_rule", "perCardRewardCap"],
      ["token_reward_rule", "minMessageLength"],
      ["token_reward_rule", "requireVoiceApproved"],
    ],
    indexes: [],
  },
];

function objectKey([table, name]) {
  return `${table}.${name}`;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const prisma = new PrismaClient();

  try {
    const databaseRows = await prisma.$queryRawUnsafe("SELECT DATABASE() AS databaseName");
    const databaseName = databaseRows[0]?.databaseName;
    if (!databaseName) throw new Error("DATABASE_URL does not select a database.");

    let migrationRows;
    try {
      migrationRows = await prisma.$queryRawUnsafe(
        "SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations`"
      );
    } catch (error) {
      throw new Error(`Cannot read _prisma_migrations: ${error.message}`);
    }

    const unresolved = migrationRows.filter(
      (row) => row.finished_at === null && row.rolled_back_at === null
    );
    if (unresolved.length > 0) {
      throw new Error(
        `Unresolved failed migrations: ${unresolved.map((row) => row.migration_name).join(", ")}`
      );
    }

    const appliedMigrations = new Set(
      migrationRows
        .filter((row) => row.finished_at !== null && row.rolled_back_at === null)
        .map((row) => row.migration_name)
    );

    const tableRows = await prisma.$queryRawUnsafe(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
    );
    const existingTables = new Set(tableRows.map((row) => row.TABLE_NAME || row.table_name));
    const missingTables = REQUIRED_TABLES.filter((table) => !existingTables.has(table));
    if (missingTables.length > 0) {
      throw new Error(`Required baseline tables are missing: ${missingTables.join(", ")}`);
    }

    const columnRows = await prisma.$queryRawUnsafe(
      "SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = DATABASE()"
    );
    const existingColumns = new Set(
      columnRows.map((row) =>
        `${row.TABLE_NAME || row.table_name}.${row.COLUMN_NAME || row.column_name}`
      )
    );

    const indexRows = await prisma.$queryRawUnsafe(
      "SELECT table_name, index_name FROM information_schema.statistics WHERE table_schema = DATABASE()"
    );
    const existingIndexes = new Set(
      indexRows.map((row) =>
        `${row.TABLE_NAME || row.table_name}.${row.INDEX_NAME || row.index_name}`
      )
    );

    const errors = [];
    const states = [];

    for (const migration of RELEASE_MIGRATIONS) {
      const expectedObjects = [
        ...migration.columns.map((item) => ["column", objectKey(item)]),
        ...migration.indexes.map((item) => ["index", objectKey(item)]),
      ];
      const presentObjects = expectedObjects.filter(([type, key]) =>
        type === "column" ? existingColumns.has(key) : existingIndexes.has(key)
      );
      const isApplied = appliedMigrations.has(migration.name);

      if (isApplied && presentObjects.length !== expectedObjects.length) {
        const missing = expectedObjects
          .filter(([type, key]) =>
            type === "column" ? !existingColumns.has(key) : !existingIndexes.has(key)
          )
          .map(([, key]) => key);
        errors.push(`${migration.name} is recorded as applied but is missing: ${missing.join(", ")}`);
        continue;
      }

      if (!isApplied && presentObjects.length > 0) {
        errors.push(
          `${migration.name} is not recorded as applied but schema objects already exist: ${presentObjects
            .map(([, key]) => key)
            .join(", ")}`
        );
        continue;
      }

      states.push(`${migration.name}: ${isApplied ? "already applied" : "cleanly pending"}`);
    }

    if (errors.length > 0) {
      throw new Error(`Schema drift detected.\n- ${errors.join("\n- ")}`);
    }

    console.log(`[prod-preflight] database selected: ${databaseName}`);
    states.forEach((state) => console.log(`[prod-preflight] ${state}`));
    console.log("[prod-preflight] PASS: migration history and schema are safe for migrate deploy.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(`[prod-preflight] FAIL: ${error.message}`);
  process.exit(1);
});
