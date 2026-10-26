const crypto = require("crypto");
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

const MIN_PASSWORD_LENGTH = 12;
const isProduction = process.env.NODE_ENV === "production";

// 帳密一律從環境變數讀取，不再寫死在程式碼裡（repo 是公開的）。
//   SEED_SUPER_USERNAME / SEED_SUPER_PASSWORD  → SUPER 管理員
//   SEED_ADMIN_USERNAME / SEED_ADMIN_PASSWORD  → 一般 ADMIN（選填）
// 非正式環境若未提供密碼，會自動產生隨機密碼並印在終端機上。
function readSeedAdmins() {
  const entries = [
    {
      username: process.env.SEED_SUPER_USERNAME || (isProduction ? "" : "admin"),
      password: process.env.SEED_SUPER_PASSWORD,
      role: "SUPER",
    },
    {
      username: process.env.SEED_ADMIN_USERNAME,
      password: process.env.SEED_ADMIN_PASSWORD,
      role: "ADMIN",
    },
  ];

  return entries
    .filter((entry) => entry.username && entry.username.trim())
    .map((entry) => {
      if (entry.password) {
        return { ...entry, generated: false };
      }
      if (isProduction) {
        throw new Error(`正式環境必須以環境變數提供 ${entry.username} 的密碼`);
      }
      return { ...entry, password: crypto.randomBytes(12).toString("base64url"), generated: true };
    });
}

async function main() {
  if (isProduction && !process.argv.includes("--confirm-production")) {
    throw new Error("正式環境建立管理員需加上 --confirm-production 參數");
  }

  const admins = readSeedAdmins();
  if (admins.length === 0) {
    console.log("沒有要建立的管理員（請設定 SEED_SUPER_USERNAME / SEED_SUPER_PASSWORD）");
    return;
  }

  for (const admin of admins) {
    if (admin.password.length < MIN_PASSWORD_LENGTH) {
      throw new Error(`${admin.username} 的密碼至少需要 ${MIN_PASSWORD_LENGTH} 碼`);
    }
  }

  for (const admin of admins) {
    const username = admin.username.trim().toLowerCase();
    const existing = await prisma.adminAccount.findUnique({ where: { username } });
    if (existing) {
      console.log(`- 管理員 ${username} 已存在，略過`);
      continue;
    }

    const passwordHash = await bcrypt.hash(admin.password, 12);

    await prisma.adminAccount.create({
      data: {
        username,
        passwordHash,
        role: admin.role,
      },
    });

    console.log(`✓ 建立管理員 ${username} (${admin.role})`);
    if (admin.generated) {
      console.log(`  自動產生的密碼：${admin.password}（僅顯示這一次，請妥善保存）`);
    }
  }
}

main()
  .catch((error) => {
    console.error("建立預設管理員失敗:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
