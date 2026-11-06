// A shared file must satisfy every reference, so attaching it to a public card
// cannot make another private or moderated reference public.
export function mayReadMedia(references, userId = null) {
  return (
    references.length > 0 &&
    references.every(
      (reference) => reference.public || (userId && reference.ownerIds?.includes(userId))
    )
  );
}

export function cardMediaReference(card) {
  return {
    public:
      !card.isPrivate && !card.isBlocked && !card.needsReview && card.category?.isActive !== false,
    ownerIds: [card.ownerId].filter(Boolean),
  };
}

export function responseMediaReference(response) {
  const card = response.homeCard;
  return {
    public: Boolean(
      card &&
      cardMediaReference(card).public &&
      !response.isBlocked &&
      response.moderationStatus === "APPROVED" &&
      ["APPROVED", "NOT_APPLICABLE"].includes(response.voiceModerationStatus)
    ),
    ownerIds: [response.responderId, card?.ownerId].filter(Boolean),
  };
}
