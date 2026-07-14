const ANONYMOUS_AVATAR_ROUTE = "/api/anonymous-prayer-avatar";

export function buildAnonymousPrayerAvatarUrl(responseId) {
  const seed = String(responseId || "prayer-friend").trim().slice(0, 80);
  return `${ANONYMOUS_AVATAR_ROUTE}?seed=${encodeURIComponent(seed || "prayer-friend")}`;
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
    publicResponse.anonymousAvatarUrl = buildAnonymousPrayerAvatarUrl(publicResponse.id);
  }

  return publicResponse;
}
