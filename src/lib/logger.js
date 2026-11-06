import prisma from "@/lib/prisma";

function safeRequestPath(value) {
  if (!value) return null;
  try { return new URL(value, "http://localhost").pathname; } catch { return null; }
}

function serializeMetadata(input) {
  if (input === null || input === undefined) {
    return undefined;
  }

  if (input instanceof Error) {
    return {
      message: input.message,
      name: input.name,
      stack: input.stack,
    };
  }

  if (typeof input === "object") {
    return input;
  }

  return { value: String(input) };
}

async function writeLog(data) {
  try {
    await prisma.adminLog.create({ data });
  } catch (error) {
    console.error("Failed to persist admin log entry", error);
  }
}

export async function logAdminAction({
  message,
  action,
  actorId = null,
  actorEmail = null,
  targetType = null,
  targetId = null,
  requestPath = null,
  metadata,
  level = "INFO",
  transaction = null,
  required = false,
} = {}) {
  if (!message && !action) {
    return;
  }

  const payload = {
    category: "ACTION",
    level,
    message: message ?? action,
    action,
    actorId,
    actorEmail,
    targetType,
    targetId,
    requestPath: safeRequestPath(requestPath),
  };

  const metaValue = serializeMetadata(metadata);
  if (metaValue !== undefined) {
    payload.metadata = metaValue;
  }

  if (required) {
    await (transaction || prisma).adminLog.create({ data: payload });
  } else {
    await writeLog(payload);
  }
}

export async function logSystemError({
  message,
  error,
  level = "ERROR",
  requestPath = null,
  metadata,
  context,
} = {}) {
  const finalMessage = message ?? error?.message ?? "Unexpected system error";

  const metadataFragments = [];

  if (error instanceof Error) {
    metadataFragments.push({
      error: {
        message: error.message,
        name: error.name,
        stack: error.stack,
      },
    });
  }

  const serializedMetadata = serializeMetadata(metadata);
  if (serializedMetadata !== undefined) {
    metadataFragments.push({ metadata: serializedMetadata });
  }

  if (context) {
    metadataFragments.push({ context });
  }

  let combinedMetadata;
  if (metadataFragments.length > 0) {
    combinedMetadata = Object.assign({}, ...metadataFragments);
  }

  const payload = {
    category: "SYSTEM",
    level,
    message: finalMessage,
    requestPath: safeRequestPath(requestPath),
  };

  if (combinedMetadata) {
    payload.metadata = combinedMetadata;
  }

  await writeLog(payload);
}
