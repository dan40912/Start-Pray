export class AdminBlockError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// Account suspension and content visibility remain separate decisions.
export async function setUserBlocked(db, session, userId, input) {
  const { block, expectedBlocked, operationId } = input || {};
  const reason = typeof input?.reason === "string" ? input.reason.trim() : "";
  if (
    typeof block !== "boolean" ||
    typeof expectedBlocked !== "boolean" ||
    reason.length < 5 ||
    reason.length > 500 ||
    typeof operationId !== "string" ||
    !/^[a-zA-Z0-9-]{16,80}$/.test(operationId)
  ) {
    throw new AdminBlockError(400, "請提供封鎖狀態、原狀態、操作編號與 5–500 字處置理由");
  }
  const operationKey = `${session.adminId}:${operationId}`;
  const replay = async (log, client = db) => {
    const meta = log?.metadata;
    if (
      log?.targetId !== userId ||
      meta?.nextState !== block ||
      meta?.reason !== reason ||
      meta?.previousState !== expectedBlocked
    ) {
      throw new AdminBlockError(409, "操作編號已被其他請求使用，請重新整理");
    }
    const current = await client.user.findUnique({
      where: { id: userId },
      select: { isBlocked: true },
    });
    if (!current) throw new AdminBlockError(404, "找不到使用者");
    return { id: userId, isBlocked: current.isBlocked, replayed: true, operationId };
  };
  try {
    return await db.$transaction(async (tx) => {
      const previous = await tx.adminLog.findUnique({ where: { operationKey } });
      if (previous) return replay(previous, tx);
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true, isBlocked: true, sessionVersion: true },
      });
      if (!user) throw new AdminBlockError(404, "找不到使用者");
      if (user.isBlocked !== expectedBlocked || block === expectedBlocked) {
        throw new AdminBlockError(409, "使用者狀態已變更，請重新整理後再判斷");
      }
      const changed = await tx.user.updateMany({
        where: { id: userId, isBlocked: expectedBlocked, sessionVersion: user.sessionVersion },
        data: { isBlocked: block, sessionVersion: { increment: 1 } },
      });
      if (changed.count !== 1) throw new AdminBlockError(409, "資料已被其他管理員更新，請重新整理");
      await tx.adminLog.create({
        data: {
          category: "ACTION",
          level: "INFO",
          operationKey,
          action: block ? "user.block" : "user.unblock",
          message: block ? "停權使用者並撤銷登入" : "解除使用者停權，需重新登入",
          actorId: session.adminId,
          actorEmail: session.username,
          targetType: "User",
          targetId: userId,
          requestPath: "/api/admin/users/[id]/block",
          metadata: { previousState: expectedBlocked, nextState: block, reason, operationId },
        },
      });
      return { id: userId, isBlocked: block, replayed: false, operationId };
    });
  } catch (error) {
    if (error?.code === "P2002" || error?.code === "P2034" || error?.status === 409) {
      const previous = await db.adminLog.findUnique({ where: { operationKey } });
      if (previous) return replay(previous);
    }
    if (error?.code === "P2034") throw new AdminBlockError(409, "資料已變更，請重新整理後重試");
    throw error;
  }
}
