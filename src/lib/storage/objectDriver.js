// PRD-009 — 物件儲存(S3 相容)driver 骨架。
// 本期「不」串接任何雲端 SDK,所有方法在被呼叫時拋出明確錯誤,
// 證明 driver 切換已接好,但需後續 PRD 才能真正使用。

const NOT_CONFIGURED = "ObjectStorageDriver not configured — see MEDIA_STORAGE_RUNBOOK.md";

function notConfiguredError() {
  const error = new Error(NOT_CONFIGURED);
  error.code = "MEDIA_STORAGE_NOT_CONFIGURED";
  return error;
}

export class ObjectStorageDriver {
  name = "object";

  // TODO(後續 PRD): integrate S3-compatible SDK using env (endpoint/bucket/keys).
  async put() {
    throw notConfiguredError();
  }

  getPublicUrl() {
    throw notConfiguredError();
  }

  assertWritable() {
    throw notConfiguredError();
  }
}
