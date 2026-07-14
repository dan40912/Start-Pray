import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

const RULE_ID = 1;

const DEFAULT_RULE = {
  rewardTokens: new Prisma.Decimal(10),
  observationDays: 3,
  allowedReports: 0,
  // PRD-002
  rewardsEnabled: true,
  dailyRewardCap: 3,
  perCardRewardCap: 1,
  minMessageLength: 15,
  requireVoiceApproved: true,
};

function ensureDecimal(value) {
  if (value instanceof Prisma.Decimal) {
    return value;
  }
  if (typeof value === "number" || typeof value === "string") {
    return new Prisma.Decimal(value);
  }
  if (value && typeof value === "object" && typeof value.toString === "function") {
    return new Prisma.Decimal(value.toString());
  }
  return new Prisma.Decimal(0);
}

function getPositiveInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return fallback;
  return Math.floor(numeric);
}

function getNonNegativeInteger(value, fallback) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return fallback;
  return Math.floor(numeric);
}

function getBoolean(value, fallback) {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    if (["true", "1", "on", "yes"].includes(value.toLowerCase())) return true;
    if (["false", "0", "off", "no"].includes(value.toLowerCase())) return false;
  }
  return Boolean(value);
}

function startOfUtcDay(now = new Date()) {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function computeRewardEligibleAt(observationDays, now = new Date()) {
  const days = getPositiveInteger(observationDays, DEFAULT_RULE.observationDays);
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
}

export async function readTokenRewardRule() {
  let record = await prisma.tokenRewardRule.findUnique({ where: { id: RULE_ID } });

  if (!record) {
    record = await prisma.tokenRewardRule.create({
      data: {
        id: RULE_ID,
        rewardTokens: DEFAULT_RULE.rewardTokens,
        observationDays: DEFAULT_RULE.observationDays,
        allowedReports: DEFAULT_RULE.allowedReports,
        rewardsEnabled: DEFAULT_RULE.rewardsEnabled,
        dailyRewardCap: DEFAULT_RULE.dailyRewardCap,
        perCardRewardCap: DEFAULT_RULE.perCardRewardCap,
        minMessageLength: DEFAULT_RULE.minMessageLength,
        requireVoiceApproved: DEFAULT_RULE.requireVoiceApproved,
      },
    });
  }

  return record;
}

export async function updateTokenRewardRule({
  rewardTokens,
  observationDays,
  allowedReports,
  rewardsEnabled,
  dailyRewardCap,
  perCardRewardCap,
  minMessageLength,
  requireVoiceApproved,
  updatedBy,
}) {
  const amount = ensureDecimal(
    rewardTokens !== undefined && rewardTokens !== null ? rewardTokens : DEFAULT_RULE.rewardTokens,
  );
  const days = Number.isFinite(Number(observationDays)) ? Math.max(1, Number(observationDays)) : DEFAULT_RULE.observationDays;
  const reports = Number.isFinite(Number(allowedReports)) ? Math.max(0, Number(allowedReports)) : DEFAULT_RULE.allowedReports;

  const data = {
    rewardTokens: amount,
    observationDays: days,
    allowedReports: reports,
    rewardsEnabled: getBoolean(rewardsEnabled, DEFAULT_RULE.rewardsEnabled),
    dailyRewardCap: getNonNegativeInteger(dailyRewardCap, DEFAULT_RULE.dailyRewardCap),
    perCardRewardCap: getNonNegativeInteger(perCardRewardCap, DEFAULT_RULE.perCardRewardCap),
    minMessageLength: getNonNegativeInteger(minMessageLength, DEFAULT_RULE.minMessageLength),
    requireVoiceApproved: getBoolean(requireVoiceApproved, DEFAULT_RULE.requireVoiceApproved),
    updatedBy: updatedBy ?? null,
  };

  return prisma.tokenRewardRule.upsert({
    where: { id: RULE_ID },
    update: data,
    create: { id: RULE_ID, ...data },
  });
}

export async function processPendingResponseRewardsForUser(userId) {
  if (!userId) {
    return { processed: 0, rewarded: 0, blocked: 0 };
  }

  const rule = await readTokenRewardRule();
  const now = new Date();
  const eligibleResponses = await prisma.prayerResponse.findMany({
    where: {
      responderId: userId,
      rewardStatus: "PENDING",
      rewardEligibleAt: { not: null, lte: now },
    },
    select: {
      id: true,
      reportCount: true,
      isBlocked: true,
      message: true,
      voiceUrl: true,
      voiceModerationStatus: true,
      homeCardId: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!eligibleResponses.length) {
    return { processed: 0, rewarded: 0, blocked: 0 };
  }

  let rewarded = 0;
  let blocked = 0;
  const rewardAmount = ensureDecimal(rule.rewardTokens ?? DEFAULT_RULE.rewardTokens);
  const allowedReports = Number(rule.allowedReports ?? DEFAULT_RULE.allowedReports);

  // PRD-002 規則參數(全部由 TokenRewardRule 讀取,不寫死)
  const rewardsEnabled = getBoolean(rule.rewardsEnabled, DEFAULT_RULE.rewardsEnabled);
  const dailyRewardCap = getNonNegativeInteger(rule.dailyRewardCap, DEFAULT_RULE.dailyRewardCap);
  const perCardRewardCap = getNonNegativeInteger(rule.perCardRewardCap, DEFAULT_RULE.perCardRewardCap);
  const minMessageLength = getNonNegativeInteger(rule.minMessageLength, DEFAULT_RULE.minMessageLength);
  const requireVoiceApproved = getBoolean(rule.requireVoiceApproved, DEFAULT_RULE.requireVoiceApproved);

  // 當日(UTC)已獎勵數,以及各卡已獎勵數 —— 作為 cap 的起算基準,迴圈中持續累加
  let dailyRewardedSoFar = await prisma.prayerResponse.count({
    where: {
      responderId: userId,
      rewardStatus: "REWARDED",
      rewardEvaluatedAt: { gte: startOfUtcDay(now) },
    },
  });
  const perCardRewardedSoFar = new Map();

  for (const response of eligibleResponses) {
    await prisma.$transaction(async (tx) => {
      const trimmedMessage = (response.message || "").trim();
      const cardId = response.homeCardId ?? null;
      if (cardId !== null && !perCardRewardedSoFar.has(cardId)) {
        const existingCardRewards = await tx.prayerResponse.count({
          where: {
            responderId: userId,
            homeCardId: cardId,
            rewardStatus: "REWARDED",
          },
        });
        perCardRewardedSoFar.set(cardId, existingCardRewards);
      }
      const cardRewarded = cardId !== null ? perCardRewardedSoFar.get(cardId) : 0;

      const voiceRejected =
        Boolean(response.voiceUrl) && response.voiceModerationStatus === "REJECTED";
      const voiceAwaitingReview =
        Boolean(response.voiceUrl) && response.voiceModerationStatus === "PENDING";

      // 語音仍在審核中:暫不結算,保持 PENDING,等通過後下一輪再處理
      if (requireVoiceApproved && voiceAwaitingReview) {
        return;
      }

      const failsPolicy =
        !rewardsEnabled ||
        trimmedMessage.length < minMessageLength ||
        (requireVoiceApproved && voiceRejected) ||
        dailyRewardedSoFar >= dailyRewardCap ||
        (cardId !== null && cardRewarded >= perCardRewardCap);

      const blockedByRisk =
        response.isBlocked || response.reportCount > allowedReports || failsPolicy;
      if (blockedByRisk) {
        const blockResult = await tx.prayerResponse.updateMany({
          where: {
            id: response.id,
            rewardStatus: "PENDING",
          },
          data: {
            rewardStatus: "BLOCKED",
            rewardEvaluatedAt: now,
            isSettled: true,
          },
        });
        blocked += blockResult.count;
        return;
      }

      const claim = await tx.prayerResponse.updateMany({
        where: {
          id: response.id,
          rewardStatus: "PENDING",
          rewardEligibleAt: { not: null, lte: now },
          isBlocked: false,
          reportCount: { lte: allowedReports },
        },
        data: {
          rewardStatus: "REWARDED",
          rewardEvaluatedAt: now,
          isSettled: true,
          tokensAwarded: { increment: rewardAmount },
        },
      });

      if (!claim.count) return;

      // 更新 cap 計數,使同一輪後續回應正確受限
      dailyRewardedSoFar += 1;
      if (cardId !== null) {
        perCardRewardedSoFar.set(cardId, (perCardRewardedSoFar.get(cardId) ?? 0) + 1);
      }

      await tx.user.update({
        where: { id: userId },
        data: {
          walletBalance: { increment: rewardAmount },
        },
      });

      await tx.tokenTransaction.create({
        data: {
          userId,
          type: "EARN_RESPONSE",
          status: "COMPLETED",
          amount: rewardAmount,
          relatedResponseId: response.id,
          metadata: {
            ruleVersion: 2,
            ruleObservationDays: rule.observationDays,
            ruleAllowedReports: allowedReports,
          },
        },
      });

      rewarded += 1;
    });
  }

  return {
    processed: rewarded + blocked,
    rewarded,
    blocked,
  };
}
