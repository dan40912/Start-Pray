export function redactPrivateCardPreview(card) {
  if (!card?.isPrivate) return card;
  return {
    id: card.id,
    title: "私密代禱（開啟詳情後檢視）",
    isPrivate: true,
    isBlocked: card.isBlocked,
    needsReview: card.needsReview,
    categoryId: card.categoryId,
    reportCount: card.reportCount,
    createdAt: card.createdAt,
    updatedAt: card.updatedAt,
    responseCount: card.responseCount,
    lastRespondedAt: card.lastRespondedAt,
    owner: null,
    image: null,
    voiceHref: null,
    detailsHref: null,
    meta: [],
    tags: [],
    description: "",
    actorKind: card.actorKind,
  };
}

export function redactPrivateResponsePreview(response) {
  if (!response?.homeCard?.isPrivate) return response;
  return {
    id: response.id,
    message: "私密代禱的回應（開啟詳情後檢視）",
    voiceUrl: null,
    isBlocked: response.isBlocked,
    moderationStatus: response.moderationStatus,
    voiceModerationStatus: response.voiceModerationStatus,
    reportCount: response.reportCount,
    createdAt: response.createdAt,
    responder: null,
    homeCard: { id: response.homeCard.id, title: "私密代禱", isPrivate: true },
  };
}
