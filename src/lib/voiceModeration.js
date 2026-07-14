// PRD-001 — 語音上傳的規則式自動預審。
// 不呼叫任何外部 AI / 雲端服務,只用可在伺服器端取得的訊號做保守判斷。
// 預留 ASR 轉文字接口(本期不實作)。

// 規則門檻(集中於此,方便日後調整)
export const MAX_VOICE_DURATION_SECONDS = 180; // 超過僅標記 TOO_LONG,不自動退
export const MAX_VOICE_FILE_BYTES = 15 * 1024 * 1024; // 超過自動退
export const MAX_RECENT_VOICE_UPLOADS = 5; // 10 分鐘內同人語音上傳數,超過自動退

export const VOICE_FLAGS = {
  TOO_LONG: "TOO_LONG",
  TOO_LARGE: "TOO_LARGE",
  RATE_LIMIT: "RATE_LIMIT",
};

/**
 * @param {object} input
 * @param {number|null} input.durationSeconds 語音時長(取不到時傳 null,視為不觸發 TOO_LONG)
 * @param {number} input.fileSizeBytes 檔案大小
 * @param {number} input.recentUploadCount 過去 10 分鐘該使用者的語音上傳數(含本次前)
 * @returns {{ flags: string[], autoReject: boolean }}
 */
export function evaluateVoiceUpload({
  durationSeconds = null,
  fileSizeBytes = 0,
  recentUploadCount = 0,
} = {}) {
  const flags = [];
  let autoReject = false;

  if (Number.isFinite(durationSeconds) && durationSeconds > MAX_VOICE_DURATION_SECONDS) {
    flags.push(VOICE_FLAGS.TOO_LONG); // 僅標記,進人工審核
  }

  if (Number.isFinite(fileSizeBytes) && fileSizeBytes > MAX_VOICE_FILE_BYTES) {
    flags.push(VOICE_FLAGS.TOO_LARGE);
    autoReject = true;
  }

  if (Number.isFinite(recentUploadCount) && recentUploadCount >= MAX_RECENT_VOICE_UPLOADS) {
    flags.push(VOICE_FLAGS.RATE_LIMIT);
    autoReject = true;
  }

  return { flags, autoReject };
}

export function serializeVoiceFlags(flags) {
  if (!Array.isArray(flags) || flags.length === 0) return null;
  try {
    return JSON.stringify(flags);
  } catch {
    return null;
  }
}
