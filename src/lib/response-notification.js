// 有人為代禱卡留下回應時，寄一封 email 告訴卡片主人。
//
// 發代禱的人如果不知道有人為他禱告，就不會回來看、也不會再分享，所以這是
// 整個網站最重要的回饋。為了不讓信箱被洗版，同一張卡在 NOTIFY_QUIET_HOURS
// 內只在「第一則」新回應時寄信；之後的回應等主人回來看卡片時一起看到。
//
// 只有設定了 RESEND_API_KEY、MAIL_FROM 與 NEXT_PUBLIC_APP_URL 才會寄出
// （見 src/lib/mailer.js），否則什麼都不做。
import { isMailConfigured, sendMail } from "@/lib/mailer";
import prisma from "@/lib/prisma";

const NOTIFY_QUIET_HOURS = 6;

function appOrigin() {
  return process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/+$/, "") || "";
}

export async function notifyCardOwnerOfResponse({ homeCardId, responseId, responderId = null, hasVoice = false }) {
  const origin = appOrigin();
  if (!isMailConfigured() || !origin) return;

  const card = await prisma.homePrayerCard.findUnique({
    where: { id: homeCardId },
    select: {
      id: true,
      title: true,
      owner: { select: { id: true, email: true, name: true, isBlocked: true } },
    },
  });
  const owner = card?.owner;
  if (!owner?.email || owner.isBlocked) return;
  if (responderId && owner.id === responderId) return;

  const quietSince = new Date(Date.now() - NOTIFY_QUIET_HOURS * 60 * 60 * 1000);
  const earlierRecent = await prisma.prayerResponse.count({
    where: {
      homeCardId,
      id: { not: responseId },
      moderationStatus: "APPROVED",
      createdAt: { gte: quietSince },
    },
  });
  if (earlierRecent > 0) return;

  const link = `${origin}/prayfor/${card.id}#prayer-response-${responseId}`;
  const greeting = owner.name ? `${owner.name}，你好：` : "你好：";
  const what = hasVoice ? "錄了一段語音禱告" : "寫下了一段禱告";

  await sendMail({
    to: owner.email,
    subject: `有人為「${card.title}」${what}`,
    text: [
      greeting,
      "",
      `剛剛有人為你的代禱「${card.title}」${what}。`,
      "點下面的連結就能看到（或聽到）：",
      link,
      "",
      "願你在等待中也感受到被記念。",
      "",
      "— Start Pray",
      "",
      `（同一則代禱在 ${NOTIFY_QUIET_HOURS} 小時內只會通知一次。不想再收到通知，直接回覆這封信告訴我們即可。）`,
    ].join("\n"),
  });
}
