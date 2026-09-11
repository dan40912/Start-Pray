import { NextResponse } from "next/server";

import { requireAdmin } from "@/lib/admin-route-auth";
import prisma from "@/lib/prisma";
import { resolveServerAudioUrl } from "@/lib/server-audio";

const MAX_ITEMS = 30;

function parseLimit(value) {
  const parsed = Number.parseInt(value || "", 10);
  if (Number.isNaN(parsed)) return 10;
  return Math.min(Math.max(parsed, 1), MAX_ITEMS);
}

function latestReportMeta(report) {
  if (!report) return { reason: null, remarks: null, reporter: null };
  return {
    reason: report.reason,
    remarks: report.remarks,
    reporter: report.reporter
      ? {
          id: report.reporter.id,
          name: report.reporter.name,
          email: report.reporter.email,
        }
      : null,
  };
}

async function getCardReports(limit) {
  const groups = await prisma.homePrayerCardReport.groupBy({
    by: ["cardId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: [{ _count: { cardId: "desc" } }, { _max: { createdAt: "desc" } }],
    take: limit,
  });

  const ids = groups.map((group) => group.cardId);
  if (ids.length === 0) return [];

  const [cards, latestReports] = await Promise.all([
    prisma.homePrayerCard.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        title: true,
        isBlocked: true,
        isPrivate: true,
        reportCount: true,
        owner: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.homePrayerCardReport.findMany({
      where: { cardId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: {
        cardId: true,
        reason: true,
        remarks: true,
        createdAt: true,
        reporter: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const cardById = new Map(cards.map((card) => [card.id, card]));
  const latestById = new Map();
  latestReports.forEach((report) => {
    if (!latestById.has(report.cardId)) latestById.set(report.cardId, report);
  });

  return groups.map((group) => {
    const card = cardById.get(group.cardId);
    const latest = latestById.get(group.cardId);
    return {
      id: `card-${group.cardId}`,
      type: "card",
      targetId: String(group.cardId),
      // A private card's title used to be replaced with the placeholder
      // "私密代禱" even here, which asked a moderator to rule on a report about
      // content they were not allowed to read. Privacy from other users is the
      // product promise; privacy from the person handling the report just makes
      // moderation guesswork. The card stays flagged as private so the UI can
      // mark it, and opening one is written to the admin log.
      title: card?.title || "已刪除的代禱",
      owner: card?.owner ?? null,
      isBlocked: Boolean(card?.isBlocked),
      isPrivate: Boolean(card?.isPrivate),
      reportCount: card?.reportCount ?? group._count._all,
      latestReportedAt: latest?.createdAt ?? group._max.createdAt,
      latestReport: latestReportMeta(latest),
      // The public URL stays withheld for private cards — that page is the
      // front end and would 404 anyway. Review happens in the admin detail view.
      href: card && !card.isPrivate ? `/prayfor/${card.id}` : null,
      adminHref: `/admin/prayfor?search=${encodeURIComponent(String(group.cardId))}`,
    };
  });
}

async function getResponseReports(limit) {
  const groups = await prisma.prayerResponseReport.groupBy({
    by: ["responseId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: [{ _count: { responseId: "desc" } }, { _max: { createdAt: "desc" } }],
    take: limit,
  });

  const ids = groups.map((group) => group.responseId);
  if (ids.length === 0) return [];

  const [responses, latestReports] = await Promise.all([
    prisma.prayerResponse.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        message: true,
        voiceUrl: true,
        isBlocked: true,
        reportCount: true,
        responder: { select: { id: true, name: true, email: true } },
        homeCard: { select: { id: true, title: true, isPrivate: true } },
      },
    }),
    prisma.prayerResponseReport.findMany({
      where: { responseId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: {
        responseId: true,
        reason: true,
        remarks: true,
        createdAt: true,
        reporter: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const responseById = new Map(responses.map((response) => [response.id, response]));
  const latestById = new Map();
  latestReports.forEach((report) => {
    if (!latestById.has(report.responseId)) latestById.set(report.responseId, report);
  });

  return groups.map((group) => {
    const response = responseById.get(group.responseId);
    const latest = latestById.get(group.responseId);
    return {
      id: `response-${group.responseId}`,
      type: "response",
      targetId: group.responseId,
      title: response?.message || (response?.voiceUrl ? "語音回應" : "已刪除的回應"),
      owner: response?.responder ?? null,
      isBlocked: Boolean(response?.isBlocked),
      isPrivate: Boolean(response?.homeCard?.isPrivate),
      reportCount: response?.reportCount ?? group._count._all,
      latestReportedAt: latest?.createdAt ?? group._max.createdAt,
      latestReport: latestReportMeta(latest),
      voiceUrl: response?.voiceUrl ? resolveServerAudioUrl(response.voiceUrl) : null,
      href: response?.homeCard && !response.homeCard.isPrivate ? `/prayfor/${response.homeCard.id}` : null,
      adminHref: `/admin/prayerresponse?search=${encodeURIComponent(group.responseId)}`,
      homeCard: response?.homeCard ?? null,
    };
  });
}

async function getOvercomerReports(limit) {
  const groups = await prisma.overcomerUserReport.groupBy({
    by: ["targetUserId"],
    _count: { _all: true },
    _max: { createdAt: true },
    orderBy: [{ _count: { targetUserId: "desc" } }, { _max: { createdAt: "desc" } }],
    take: limit,
  });

  const ids = groups.map((group) => group.targetUserId);
  if (ids.length === 0) return [];

  const [users, latestReports] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        isBlocked: true,
        reportCount: true,
        publicProfileEnabled: true,
      },
    }),
    prisma.overcomerUserReport.findMany({
      where: { targetUserId: { in: ids } },
      orderBy: { createdAt: "desc" },
      select: {
        targetUserId: true,
        reason: true,
        remarks: true,
        createdAt: true,
        reporter: { select: { id: true, name: true, email: true } },
      },
    }),
  ]);

  const userById = new Map(users.map((user) => [user.id, user]));
  const latestById = new Map();
  latestReports.forEach((report) => {
    if (!latestById.has(report.targetUserId)) latestById.set(report.targetUserId, report);
  });

  return groups.map((group) => {
    const user = userById.get(group.targetUserId);
    const latest = latestById.get(group.targetUserId);
    return {
      id: `overcomer-${group.targetUserId}`,
      type: "overcomer",
      targetId: group.targetUserId,
      title: user?.name || user?.username || user?.email || "已刪除的公開個人頁",
      owner: user ? { id: user.id, name: user.name, email: user.email } : null,
      isBlocked: Boolean(user?.isBlocked),
      isPrivate: !user?.publicProfileEnabled,
      reportCount: user?.reportCount ?? group._count._all,
      latestReportedAt: latest?.createdAt ?? group._max.createdAt,
      latestReport: latestReportMeta(latest),
      href: user?.username && user.publicProfileEnabled ? `/overcomer/${user.username}` : null,
      adminHref: `/admin/users?search=${encodeURIComponent(user?.email || user?.username || group.targetUserId)}`,
    };
  });
}

export async function GET(request) {
  const { error } = requireAdmin(request);
  if (error) return error;

  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type") || "all";
    const limit = parseLimit(searchParams.get("limit"));

    const [cards, responses, overcomers] = await Promise.all([
      type === "all" || type === "card" ? getCardReports(limit) : [],
      type === "all" || type === "response" ? getResponseReports(limit) : [],
      type === "all" || type === "overcomer" ? getOvercomerReports(limit) : [],
    ]);

    const items = [...cards, ...responses, ...overcomers]
      .sort((a, b) => {
        if ((b.reportCount || 0) !== (a.reportCount || 0)) {
          return (b.reportCount || 0) - (a.reportCount || 0);
        }
        return new Date(b.latestReportedAt || 0).getTime() - new Date(a.latestReportedAt || 0).getTime();
      })
      .slice(0, limit);

    return NextResponse.json({
      data: items,
      summary: {
        card: cards.length,
        response: responses.length,
        overcomer: overcomers.length,
        total: items.length,
      },
    });
  } catch (error) {
    console.error("GET /api/admin/reports error:", error);
    return NextResponse.json({ message: "無法載入審核佇列" }, { status: 500 });
  }
}
