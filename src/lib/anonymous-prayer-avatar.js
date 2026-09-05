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
