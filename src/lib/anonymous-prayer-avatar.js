// Anonymous responders all share the site logo as their avatar. This used to be
// a per-response generated "angel" figure (see /api/anonymous-prayer-avatar,
// now a redirect to this same file) which read as unsettling rather than warm.
// A single shared brand mark is also cheaper: one immutable asset the browser
// caches once, instead of a distinct SVG per response id.
export const ANONYMOUS_AVATAR_SRC = "/img/logo.png";

export function buildAnonymousPrayerAvatarUrl() {
  return ANONYMOUS_AVATAR_SRC;
}

export function toPublicPrayerResponse(response) {
  if (!response) return response;

  const publicResponse = { ...response };
  delete publicResponse.guestSessionHash;
  delete publicResponse.ipHash;
  delete publicResponse.moderationStatus;

  if (publicResponse.isAnonymous) {
    delete publicResponse.responderId;
    publicResponse.responder = null;
    publicResponse.anonymousAvatarUrl = buildAnonymousPrayerAvatarUrl();
  }

  return publicResponse;
}

// Cards gained guestSessionHash / ipHash so moderators can tell one anonymous
// submitter from many. Those two fields must never reach a browser, and every
// public card read goes through src/lib/homeCards.js, so that module applies
// this on the way out — new public consumers are safe by default rather than
// by remembering. The admin surface queries Prisma directly and is unaffected.
export function toPublicPrayerCard(card) {
  if (!card) return card;

  const publicCard = { ...card };
  delete publicCard.guestSessionHash;
  delete publicCard.ipHash;
  return publicCard;
}
