// PRD-005 — 帳號信任分數。不收任何身分資料,只用帳齡與檢舉/封鎖紀錄。
// 分數 0–100,基準 50。低於門檻者受更嚴格限制且內容需審核。

export const TRUST_BASELINE = 50;
export const TRUST_MIN = 0;
export const TRUST_MAX = 100;
export const LOW_TRUST_THRESHOLD = 25; // 低於此值 → 內容需審核 + 限制減半
const AGE_BONUS_PER_WEEK = 5; // 每滿一週 +5
const AGE_BONUS_CAP = 30; // 帳齡加分上限
const FLAG_PENALTY = 12; // 每筆有效檢舉扣分
const BLOCKED_PENALTY = 60; // 曾被封鎖大幅扣分

function clamp(value) {
  return Math.max(TRUST_MIN, Math.min(TRUST_MAX, Math.round(value)));
}

/**
 * @param {object} user 需含 createdAt, flaggedCount, isBlocked
 */
export function computeTrustScore(user, now = new Date()) {
  if (!user) return TRUST_BASELINE;

  const createdAt = user.createdAt ? new Date(user.createdAt) : now;
  const ageWeeks = Math.max(0, (now.getTime() - createdAt.getTime()) / (7 * 24 * 60 * 60 * 1000));
  const ageBonus = Math.min(AGE_BONUS_CAP, Math.floor(ageWeeks) * AGE_BONUS_PER_WEEK);

  const flagged = Number(user.flaggedCount) || 0;
  const flagPenalty = flagged * FLAG_PENALTY;
  const blockedPenalty = user.isBlocked ? BLOCKED_PENALTY : 0;

  return clamp(TRUST_BASELINE + ageBonus - flagPenalty - blockedPenalty);
}

export function isLowTrust(user, now = new Date()) {
  return computeTrustScore(user, now) < LOW_TRUST_THRESHOLD;
}
