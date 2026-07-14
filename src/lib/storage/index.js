// PRD-009 — 媒體儲存 driver 選擇層。
// 由環境變數 MEDIA_STORAGE_DRIVER 決定使用哪個 driver(預設 local)。
// 預設行為與既有實作完全一致;object driver 為骨架,尚未串接雲端 SDK。

import { LocalStorageDriver } from "./localDriver";
import { ObjectStorageDriver } from "./objectDriver";

let cachedDriver = null;
let cachedName = null;

export function getStorageDriverName() {
  return (process.env.MEDIA_STORAGE_DRIVER || "local").trim().toLowerCase();
}

export function getStorageDriver() {
  const name = getStorageDriverName();
  if (cachedDriver && cachedName === name) return cachedDriver;
  cachedName = name;
  cachedDriver = name === "object" ? new ObjectStorageDriver() : new LocalStorageDriver();
  return cachedDriver;
}

// 在寫入前呼叫:若 driver 尚未可用(例如 object 未設定),丟出可被 route 捕捉的錯誤。
export function assertStorageWritable() {
  return getStorageDriver().assertWritable();
}
