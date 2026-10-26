const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const { spawnSync } = require("child_process");

const { DEMO_PASSWORD, DEMO_USERS, DEMO_CATEGORIES, DEMO_CARDS } = require("./demo-fixtures");
const { getConfiguredRoot, getLegacyRoot } = require("./lib/media-storage.cjs");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const PRISMA_SCHEMA_PATH = path.join(PROJECT_ROOT, "prisma", "schema.prisma");
const TEMP_PRISMA_DIR = path.join(PROJECT_ROOT, "tmp", "demo-prisma-seed");
const TEMP_PRISMA_SCHEMA_PATH = path.join(TEMP_PRISMA_DIR, "schema.prisma");
const TEMP_PRISMA_CLIENT_DIR = path.join(TEMP_PRISMA_DIR, "client");
const VOICES_ROOT = getConfiguredRoot("voices") || getLegacyRoot("voices");
const DEMO_VOICE_DIR = path.join(VOICES_ROOT, "demo");
const DEMO_AUDIO_URL_BASE = "/voices/demo";
const DEMO_IMAGE_FALLBACK = "/img/categories/popular.jpg";
const DEMO_RESPONSE_REWARD_DELAY_DAYS = 3;
const DEMO_AUDIO_EXTENSIONS = new Set([".wav", ".mp3", ".webm", ".m4a"]);
const DB_VARCHAR_LIMIT = 191;
let fallbackAudioSourcesCache = null;

function log(message, details) {
  if (details === undefined) {
    console.log(`[seed:demo] ${message}`);
    return;
  }
  console.log(`[seed:demo] ${message}`, details);
}

function getNpxCommand() {
  return process.platform === "win32" ? "npx.cmd" : "npx";
}

function quoteShellArg(value) {
  const raw = String(value ?? "");
  if (process.platform === "win32") {
    if (/^[A-Za-z0-9_./:=\\\\-]+$/.test(raw)) return raw;
    return `"${raw.replace(/"/g, '""')}"`;
  }
  if (/^[A-Za-z0-9_./:=@%+-]+$/.test(raw)) return raw;
  return `'${raw.replace(/'/g, `'\"'\"'`)}'`;
}

function runNpx(args, options = {}) {
  if (process.platform === "win32") {
    const command = ["npx", ...args].map(quoteShellArg).join(" ");
    return spawnSync("cmd.exe", ["/d", "/s", "/c", command], {
      ...options,
      windowsHide: true,
    });
  }

  return spawnSync(getNpxCommand(), args, options);
}

function sanitizeFileStem(input) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "demo-audio";
}

function stripHtml(value) {
  return String(value ?? "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>\s*<p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function truncateForDb(value, maxLength, label) {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= maxLength) {
    return normalized;
  }

  const truncated = `${normalized.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
  log(`欄位超過長度限制，已自動截斷：${label}`, {
    originalLength: normalized.length,
    maxLength,
  });
  return truncated;
}

function normalizeCardDescription(value, label) {
  const normalized = String(value ?? "").trim();
  if (normalized.length <= DB_VARCHAR_LIMIT) {
    return normalized;
  }

  const plainText = stripHtml(normalized);
  const htmlSafe = `<p>${truncateForDb(plainText, DB_VARCHAR_LIMIT - 7, `${label}:plain-text`)}</p>`;
  if (htmlSafe.length <= DB_VARCHAR_LIMIT) {
    return htmlSafe;
  }

  return truncateForDb(htmlSafe, DB_VARCHAR_LIMIT, label);
}

function replaceClientOutput(schemaSource) {
  return schemaSource.replace(/generator client \{[\s\S]*?\}/m, [
    'generator client {',
    '  provider = "prisma-client-js"',
    '  output   = "./client"',
    '}',
  ].join("\n"));
}

function preparePrismaClient() {
  fs.mkdirSync(TEMP_PRISMA_DIR, { recursive: true });
  fs.rmSync(TEMP_PRISMA_CLIENT_DIR, { recursive: true, force: true });

  const schemaSource = fs.readFileSync(PRISMA_SCHEMA_PATH, "utf8");
  const tempSchema = replaceClientOutput(schemaSource);
  fs.writeFileSync(TEMP_PRISMA_SCHEMA_PATH, tempSchema, "utf8");

  const result = runNpx(["prisma", "generate", "--schema", TEMP_PRISMA_SCHEMA_PATH], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    env: { ...process.env, PRISMA_HIDE_UPDATE_MESSAGE: "1" },
  });
  if (result.status !== 0) {
    throw new Error((result.stderr || result.stdout || Buffer.from("prisma generate failed")).toString("utf8"));
  }

  const generatedIndexPath = require.resolve(path.join(TEMP_PRISMA_CLIENT_DIR, "index.js"));
  delete require.cache[generatedIndexPath];
  return require(TEMP_PRISMA_CLIENT_DIR).PrismaClient;
}

function escapePowerShellLiteral(value) {
  return String(value ?? "").replace(/'/g, "''");
}

function runPowerShell(script) {
  const encoded = Buffer.from(script, "utf16le").toString("base64");
  return spawnSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-ExecutionPolicy", "Bypass", "-EncodedCommand", encoded], {
    cwd: PROJECT_ROOT,
    stdio: "pipe",
    windowsHide: true,
  });
}

function synthesizeWaveFile({ text, outputPath, voiceName, rate = 0 }) {
  const normalizedText = String(text ?? "").replace(/\s+/g, " ").trim();
  if (!normalizedText) {
    return { ok: false, reason: "empty-text" };
  }

  fs.mkdirSync(path.dirname(outputPath), { recursive: true });

  const script = [
    "Add-Type -AssemblyName System.Speech",
    "$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer",
    "try {",
    `  $requestedVoice = '${escapePowerShellLiteral(voiceName)}'`,
    "  $installed = $synth.GetInstalledVoices() | ForEach-Object { $_.VoiceInfo.Name }",
    "  if ($installed -contains $requestedVoice) { $synth.SelectVoice($requestedVoice) }",
    `  $synth.Rate = ${Number(rate) || 0}`,
    `  $synth.SetOutputToWaveFile('${escapePowerShellLiteral(outputPath)}')`,
    `  $synth.Speak('${escapePowerShellLiteral(normalizedText)}')`,
    "}",
    "finally {",
    "  $synth.Dispose()",
    "}",
  ].join("\n");

  const result = runPowerShell(script);
  if (result.status !== 0) {
    return {
      ok: false,
      reason: (result.stderr || result.stdout || Buffer.from("tts-error")).toString("utf8").trim() || "tts-error",
    };
  }

  if (!fs.existsSync(outputPath)) {
    return { ok: false, reason: "tts-output-missing" };
  }

  return { ok: true };
}

function collectFallbackAudioSources() {
  if (Array.isArray(fallbackAudioSourcesCache)) {
    return fallbackAudioSourcesCache;
  }

  const results = [];
  const roots = [...new Set([VOICES_ROOT, getLegacyRoot("voices")].filter(Boolean))];
  const queue = roots.filter((root) => fs.existsSync(root));

  if (queue.length === 0) return [];

  while (queue.length > 0) {
    const current = queue.pop();
    const entries = fs.readdirSync(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (fullPath === DEMO_VOICE_DIR) continue;
        queue.push(fullPath);
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (!DEMO_AUDIO_EXTENSIONS.has(ext)) continue;
      const size = fs.statSync(fullPath).size;
      if (size < 10 * 1024) continue;
      results.push(fullPath);
    }
  }

  fallbackAudioSourcesCache = results.sort();
  return fallbackAudioSourcesCache;
}

function clearExistingAudioFiles(assetKey) {
  fs.mkdirSync(DEMO_VOICE_DIR, { recursive: true });
  for (const name of fs.readdirSync(DEMO_VOICE_DIR)) {
    if (name.startsWith(`${assetKey}.`)) {
      fs.rmSync(path.join(DEMO_VOICE_DIR, name), { force: true });
    }
  }
}

function findExistingAudioUrl(assetKey) {
  if (!fs.existsSync(DEMO_VOICE_DIR)) return null;
  const existing = fs.readdirSync(DEMO_VOICE_DIR).find((name) => name.startsWith(`${assetKey}.`));
  return existing ? `${DEMO_AUDIO_URL_BASE}/${existing}` : null;
}

function ensureAudioAsset({ assetKey, text, voiceName, voiceRate, fallbackIndex, refreshAudio }) {
  const safeKey = sanitizeFileStem(assetKey);

  if (!refreshAudio) {
    const existingUrl = findExistingAudioUrl(safeKey);
    if (existingUrl) {
      return existingUrl;
    }
  }

  clearExistingAudioFiles(safeKey);

  const wavPath = path.join(DEMO_VOICE_DIR, `${safeKey}.wav`);
  const synthResult = synthesizeWaveFile({
    text,
    outputPath: wavPath,
    voiceName,
    rate: voiceRate,
  });

  if (synthResult.ok) {
    return `${DEMO_AUDIO_URL_BASE}/${safeKey}.wav`;
  }

  const fallbacks = collectFallbackAudioSources();
  if (fallbacks.length === 0) {
    throw new Error(`無法生成音檔，也沒有可用的 fallback 音訊：${safeKey}`);
  }

  const sourcePath = fallbacks[Math.abs(Number(fallbackIndex) || 0) % fallbacks.length];
  const ext = path.extname(sourcePath).toLowerCase() || ".webm";
  const targetPath = path.join(DEMO_VOICE_DIR, `${safeKey}${ext}`);
  fs.copyFileSync(sourcePath, targetPath);
  log("語音合成失敗，已改用現有錄音當作 fallback", { assetKey: safeKey, reason: synthResult.reason, sourcePath });
  return `${DEMO_AUDIO_URL_BASE}/${safeKey}${ext}`;
}

function offsetDate(baseDate, { days = 0, hours = 0, minutes = 0 } = {}) {
  const value = new Date(baseDate);
  value.setMinutes(value.getMinutes() + minutes + hours * 60 + days * 24 * 60);
  return value;
}

async function ensureSchemaReady(prisma) {
  await prisma.user.findFirst({
    select: {
      id: true,
      sessionVersion: true,
      publicProfileEnabled: true,
    },
  });
}

async function ensureCategories(prisma) {
  const categoryMap = new Map();

  for (const category of DEMO_CATEGORIES) {
    let record = await prisma.homePrayerCategory.findUnique({ where: { slug: category.slug } });
    if (!record) {
      record = await prisma.homePrayerCategory.create({
        data: {
          slug: category.slug,
          name: category.name,
          description: category.description,
          sortOrder: category.sortOrder,
          isActive: true,
        },
      });
      log(`已建立分類 ${category.slug}`);
    }
    categoryMap.set(category.slug, record);
  }

  return categoryMap;
}

async function ensureUsers(prisma) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const userMap = new Map();

  for (const user of DEMO_USERS) {
    const record = await prisma.user.upsert({
      where: { email: user.email },
      update: {
        name: truncateForDb(user.name, DB_VARCHAR_LIMIT, `user.name:${user.email}`),
        username: truncateForDb(user.username, DB_VARCHAR_LIMIT, `user.username:${user.email}`),
        faithTradition: user.faithTradition,
        country: user.country,
        bio: truncateForDb(user.bio, DB_VARCHAR_LIMIT, `user.bio:${user.email}`),
        avatarUrl: user.avatarUrl,
        passwordHash,
        acceptedTerms: true,
        publicProfileEnabled: true,
        walletBalance: user.walletBalance,
        bscAddress: user.bscAddress,
        isAddressVerified: Boolean(user.isAddressVerified),
        isBlocked: false,
      },
      create: {
        email: user.email,
        name: truncateForDb(user.name, DB_VARCHAR_LIMIT, `user.name:${user.email}`),
        username: truncateForDb(user.username, DB_VARCHAR_LIMIT, `user.username:${user.email}`),
        faithTradition: user.faithTradition,
        country: user.country,
        bio: truncateForDb(user.bio, DB_VARCHAR_LIMIT, `user.bio:${user.email}`),
        avatarUrl: user.avatarUrl,
        passwordHash,
        acceptedTerms: true,
        publicProfileEnabled: true,
        walletBalance: user.walletBalance,
        bscAddress: user.bscAddress,
        isAddressVerified: Boolean(user.isAddressVerified),
        isBlocked: false,
      },
      select: {
        id: true,
        email: true,
        name: true,
        username: true,
      },
    }).catch(async (error) => {
      if (String(error?.code || "") === "P2002") {
        throw new Error(`Demo 使用者 username 或 email 衝突：${user.email} / ${user.username}`);
      }
      throw error;
    });

    userMap.set(user.key, { ...user, id: record.id });
  }

  return userMap;
}

function buildCardCreatePayload(card, owner, category, voiceHref, index) {
  return {
    slug: card.slug,
    title: truncateForDb(card.title, DB_VARCHAR_LIMIT, `card.title:${card.slug}`),
    image: card.image || DEMO_IMAGE_FALLBACK,
    alt: truncateForDb(card.alt || card.title, DB_VARCHAR_LIMIT, `card.alt:${card.slug}`),
    description: normalizeCardDescription(card.descriptionHtml, `card.description:${card.slug}`),
    tags: card.tags || [],
    meta: card.meta || [],
    detailsHref: "/prayfor",
    voiceHref: truncateForDb(voiceHref, DB_VARCHAR_LIMIT, `card.voiceHref:${card.slug}`),
    sortOrder: index + 1,
    categoryId: category.id,
    ownerId: owner.id,
    isBlocked: false,
    reportCount: 0,
    isSettled: false,
    settledAmount: null,
  };
}

async function ensureCards(prisma, userMap, categoryMap, options) {
  const cardMap = new Map();
  const now = new Date();

  for (let index = 0; index < DEMO_CARDS.length; index += 1) {
    const card = DEMO_CARDS[index];
    const owner = userMap.get(card.ownerKey);
    const category = categoryMap.get(card.categorySlug);

    if (!owner) {
      throw new Error(`找不到卡片 owner：${card.ownerKey}`);
    }
    if (!category) {
      throw new Error(`找不到卡片分類：${card.categorySlug}`);
    }

    const voiceHref = ensureAudioAsset({
      assetKey: `${card.slug}-main`,
      text: card.primaryVoiceText,
      voiceName: owner.voiceName,
      voiceRate: owner.voiceRate,
      fallbackIndex: index,
      refreshAudio: options.refreshAudio,
    });

    const payload = buildCardCreatePayload(card, owner, category, voiceHref, index);
    const createdAt = offsetDate(now, { days: -12 + index * 2 });

    let record = await prisma.homePrayerCard.findUnique({ where: { slug: card.slug } });
    if (!record) {
      record = await prisma.homePrayerCard.create({
        data: {
          ...payload,
          createdAt,
        },
      });
      log(`已建立 demo 卡片 ${card.slug}`);
    } else {
      record = await prisma.homePrayerCard.update({
        where: { id: record.id },
        data: payload,
      });
    }

    const detailsHref = `/prayfor/${record.id}`;
    if (record.detailsHref !== detailsHref) {
      record = await prisma.homePrayerCard.update({
        where: { id: record.id },
        data: { detailsHref },
      });
    }

    cardMap.set(card.slug, {
      ...card,
      id: record.id,
      detailsHref,
      voiceHref,
      createdAt,
    });
  }

  return cardMap;
}

async function rebuildResponses(prisma, userMap, cardMap, options) {
  const demoCardIds = Array.from(cardMap.values()).map((card) => card.id);
  const demoUserIds = Array.from(userMap.values()).map((user) => user.id);

  await prisma.prayerResponse.deleteMany({
    where: {
      homeCardId: { in: demoCardIds },
      responderId: { in: demoUserIds },
    },
  });

  const created = [];
  let fallbackIndex = 100;

  for (const [cardIndex, card] of Array.from(cardMap.values()).entries()) {
    for (const [responseIndex, response] of card.responses.entries()) {
      const responder = userMap.get(response.responderKey);
      if (!responder) {
        throw new Error(`找不到回應者：${response.responderKey}`);
      }

      const voiceUrl = response.voiceText
        ? ensureAudioAsset({
            assetKey: `${card.slug}-response-${responseIndex + 1}`,
            text: response.voiceText,
            voiceName: responder.voiceName,
            voiceRate: responder.voiceRate,
            fallbackIndex,
            refreshAudio: options.refreshAudio,
          })
        : null;
      fallbackIndex += 1;

      const createdAt = offsetDate(card.createdAt, {
        hours: (responseIndex + 1) * (card.responseWindowHours || 12),
        minutes: cardIndex * 7,
      });

      const record = await prisma.prayerResponse.create({
        data: {
          message: truncateForDb(response.message, DB_VARCHAR_LIMIT, `response.message:${card.slug}:${responseIndex + 1}`),
          voiceUrl: voiceUrl ? truncateForDb(voiceUrl, DB_VARCHAR_LIMIT, `response.voiceUrl:${card.slug}:${responseIndex + 1}`) : null,
          isAnonymous: Boolean(response.isAnonymous),
          isBlocked: false,
          reportCount: 0,
          rewardStatus: "PENDING",
          rewardEligibleAt: offsetDate(createdAt, { days: DEMO_RESPONSE_REWARD_DELAY_DAYS }),
          createdAt,
          responderId: responder.id,
          homeCardId: card.id,
        },
      });

      created.push(record.id);
    }
  }

  return created.length;
}

async function main() {
  // Demo accounts share a password that is published in this repo, so they
  // must never be created on the production database by accident.
  if (process.env.NODE_ENV === "production" && !process.argv.includes("--allow-production")) {
    console.error("[seed:demo] 會建立密碼公開的示範帳號，正式環境需明確加上 --allow-production");
    process.exitCode = 1;
    return;
  }

  const options = {
    refreshAudio: process.argv.includes("--refresh-audio"),
  };

  log("開始生成臨時 Prisma Client");
  const PrismaClient = preparePrismaClient();
  const prisma = new PrismaClient();

  try {
    log("檢查資料庫 schema 是否已同步");
    await ensureSchemaReady(prisma);

    log("建立或補齊 demo 分類");
    const categoryMap = await ensureCategories(prisma);

    log("建立或更新 demo 使用者");
    const userMap = await ensureUsers(prisma);

    log("建立或更新 demo 禱告卡與主禱告音");
    const cardMap = await ensureCards(prisma, userMap, categoryMap, options);

    log("重建 demo 回應與回應語音");
    const responsesCount = await rebuildResponses(prisma, userMap, cardMap, options);

    const summary = {
      users: userMap.size,
      cards: cardMap.size,
      responses: responsesCount,
      audioDir: DEMO_VOICE_DIR,
      loginEmail: DEMO_USERS[0].email,
      loginPassword: DEMO_PASSWORD,
    };

    log("Demo 資料已完成", summary);
    console.log("\n可直接登入的 demo 帳號：");
    for (const user of DEMO_USERS) {
      console.log(`- ${user.email} / ${DEMO_PASSWORD} (${user.name})`);
    }
  } catch (error) {
    console.error("[seed:demo] 失敗：", error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
