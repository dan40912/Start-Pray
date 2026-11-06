import prisma from "./prisma.js";
import { decryptSettingSecret, encryptSettingSecret } from "./secret-encryption.js";

const SITE_SETTINGS_ID = 1;

async function ensureDefaults(record) {
  if (record) return record;
  return prisma.siteSetting.create({
    data: { id: SITE_SETTINGS_ID, maintenanceMode: false },
  });
}

function toPublicSiteSettings(record) {
  return {
    id: record.id,
    maintenanceMode: record.maintenanceMode,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
  };
}

async function readSiteSettingsRecord() {
  const record = await prisma.siteSetting.findUnique({ where: { id: SITE_SETTINGS_ID } });
  return ensureDefaults(record);
}

export async function readSiteSettings() {
  return toPublicSiteSettings(await readSiteSettingsRecord());
}

export async function setMaintenanceMode({ maintenanceMode, updatedBy = null }) {
  if (typeof maintenanceMode !== "boolean") {
    throw new TypeError("maintenanceMode must be a boolean value");
  }

  const updated = await prisma.siteSetting.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: { maintenanceMode, updatedBy },
    create: { id: SITE_SETTINGS_ID, maintenanceMode, updatedBy },
  });
  return toPublicSiteSettings(updated);
}

export async function readThreadsAdminSettings() {
  const settings = await readSiteSettingsRecord();
  return {
    enabled: settings.threadsEnabled,
    userId: settings.threadsUserId || "",
    graphApiVersion: settings.threadsGraphApiVersion || "v1.0",
    accessTokenConfigured: Boolean(settings.threadsAccessTokenSecret),
    updatedAt: settings.updatedAt,
    updatedBy: settings.updatedBy,
  };
}

export async function getThreadsPublishSettings() {
  const settings = await readSiteSettingsRecord();
  const accessToken = decryptSettingSecret(settings.threadsAccessTokenSecret);
  if (!settings.threadsEnabled) {
    const error = new Error("Threads 發布功能目前未啟用。");
    error.status = 503;
    throw error;
  }
  if (!settings.threadsUserId || !accessToken) {
    const error = new Error("Threads 設定尚未完成，請確認帳號 ID 與 Access Token。");
    error.status = 503;
    throw error;
  }
  return {
    userId: settings.threadsUserId,
    accessToken,
    graphApiVersion: settings.threadsGraphApiVersion || "v1.0",
  };
}

export async function saveThreadsAdminSettings({
  enabled,
  userId,
  accessToken,
  clearAccessToken = false,
  graphApiVersion,
  updatedBy = null,
}) {
  const current = await readSiteSettingsRecord();
  const normalizedUserId = userId.trim();
  const normalizedVersion = graphApiVersion.trim();
  let tokenSecret = current.threadsAccessTokenSecret;

  if (clearAccessToken) tokenSecret = null;
  else if (accessToken.trim()) tokenSecret = encryptSettingSecret(accessToken.trim());

  if (enabled && (!normalizedUserId || !tokenSecret || !decryptSettingSecret(tokenSecret))) {
    const error = new Error("啟用 Threads 前，請先填入 Threads 帳號 ID 與有效的 Access Token。");
    error.status = 422;
    throw error;
  }

  const updated = await prisma.siteSetting.upsert({
    where: { id: SITE_SETTINGS_ID },
    update: {
      threadsEnabled: enabled,
      threadsUserId: normalizedUserId || null,
      threadsAccessTokenSecret: tokenSecret,
      threadsGraphApiVersion: normalizedVersion,
      updatedBy,
    },
    create: {
      id: SITE_SETTINGS_ID,
      maintenanceMode: false,
      threadsEnabled: enabled,
      threadsUserId: normalizedUserId || null,
      threadsAccessTokenSecret: tokenSecret,
      threadsGraphApiVersion: normalizedVersion,
      updatedBy,
    },
  });

  return {
    enabled: updated.threadsEnabled,
    userId: updated.threadsUserId || "",
    graphApiVersion: updated.threadsGraphApiVersion,
    accessTokenConfigured: Boolean(updated.threadsAccessTokenSecret),
    updatedAt: updated.updatedAt,
    updatedBy: updated.updatedBy,
  };
}
