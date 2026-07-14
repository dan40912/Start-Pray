import { NextResponse } from "next/server";

import { logAdminAction } from "@/lib/logger";
import { readTokenRewardRule, updateTokenRewardRule } from "@/lib/tokenRewards";
import { requireAdmin, roleSet } from "@/lib/admin-route-auth";

const SUPER_ONLY = roleSet("SUPER");

export async function GET(request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  try {
    const rule = await readTokenRewardRule();
    const normalized = {
      ...rule,
      rewardTokens: Number(rule.rewardTokens ?? 0),
    };
    return NextResponse.json(normalized);
  } catch (error) {
    console.error("GET /api/admin/token-rules error:", error);
    if (error?.code === "P2021" || error?.code === "P2022") {
      return NextResponse.json({
        id: 1,
        rewardTokens: 10,
        observationDays: 3,
        allowedReports: 0,
      });
    }
    return NextResponse.json({ message: "Failed to load token rules" }, { status: 500 });
  }
}

export async function PATCH(request) {
  const { error, session } = requireAdmin(request, SUPER_ONLY);
  if (error) return error;

  try {
    const role = session.role;
    const payload = await request.json().catch(() => null);

    if (!payload || typeof payload !== "object") {
      return NextResponse.json({ message: "Invalid payload" }, { status: 400 });
    }

    const updated = await updateTokenRewardRule({
      rewardTokens: payload.rewardTokens,
      observationDays: payload.observationDays,
      allowedReports: payload.allowedReports,
      // PRD-002 去風險化參數
      rewardsEnabled: payload.rewardsEnabled,
      dailyRewardCap: payload.dailyRewardCap,
      perCardRewardCap: payload.perCardRewardCap,
      minMessageLength: payload.minMessageLength,
      requireVoiceApproved: payload.requireVoiceApproved,
      updatedBy: role,
    });

    const normalized = {
      ...updated,
      rewardTokens: Number(updated.rewardTokens ?? 0),
    };

    await logAdminAction({
      action: "token-rules.update",
      message: "Updated token reward rules",
      actorId: session.adminId,
      actorEmail: session.username,
      metadata: {
        rewardTokens: normalized.rewardTokens,
        observationDays: normalized.observationDays,
        allowedReports: normalized.allowedReports,
        rewardsEnabled: normalized.rewardsEnabled,
        dailyRewardCap: normalized.dailyRewardCap,
        perCardRewardCap: normalized.perCardRewardCap,
        minMessageLength: normalized.minMessageLength,
        requireVoiceApproved: normalized.requireVoiceApproved,
      },
      requestPath: request.url,
    });

    return NextResponse.json(normalized);
  } catch (error) {
    console.error("PATCH /api/admin/token-rules error:", error);
    if (error?.code === "P2021" || error?.code === "P2022") {
      return NextResponse.json({ message: "Reward rule table unavailable. Run prisma migrate to create it." }, { status: 409 });
    }
    return NextResponse.json({ message: "Failed to update token rules" }, { status: 500 });
  }
}
