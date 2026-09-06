// The admin counterpart to toPublicPrayerResponse() in anonymous-prayer-avatar.js.
//
// Those two functions are the ONLY places anonymity is applied, and they are
// deliberately written as a pair so the boundary is visible in one diff:
//
//   public  -> strips identity          (a promise we make to responders)
//   admin   -> retains identity         (the accountability that makes the
//                                        promise safe to make)
//
// Before this file existed, admin routes re-implemented the public stripping
// inline (`delete safeResponse.ipHash`), which left moderators unable to tell
// twenty abusers apart from one. guestSessionHash and ipHash carry composite
// indexes in schema.prisma for exactly the correlation query that stripping
// made impossible to write.
//
// Old rows predate the columns that carry identity, so every field here is
// treated as optional: a missing hash yields null, never an exception and never
// a dropped record. Callers render null as "舊資料" rather than hiding the row.

// Raw hashes are 64-char hex — unreadable in a table cell and pointlessly
// sensitive to have on screen. Moderators only ever need to answer "is this the
// same actor as that one", which 8 hex chars answers while staying scannable.
export function toFingerprint(hash) {
  if (typeof hash !== "string") return null;
  const trimmed = hash.trim();
  return trimmed.length >= 8 ? trimmed.slice(0, 8) : null;
}

// Where a row's identity actually comes from. Kept as one derived field so the
// list UI does not re-derive the same three-way test in every cell.
//   MEMBER  — a signed-in account, whatever isAnonymous says on the front end
//   GUEST   — anonymous, but fingerprinted and therefore correlatable
//   LEGACY  — anonymous and predating the fingerprint columns; unknowable
export function resolveActorKind(row) {
  if (row?.responderId || row?.ownerId) return "MEMBER";
  if (row?.guestSessionHash || row?.ipHash) return "GUEST";
  return "LEGACY";
}

function withActorFields(row) {
  return {
    ...row,
    actorKind: resolveActorKind(row),
    guestFingerprint: toFingerprint(row?.guestSessionHash),
    ipFingerprint: toFingerprint(row?.ipHash),
  };
}

// Full-fidelity view of a response for admin surfaces. Nothing is deleted here:
// if a field should not reach the browser, do not select it in the query.
export function toAdminPrayerResponse(response) {
  if (!response) return response;
  return {
    ...withActorFields(response),
    // isAnonymous is a front-end display choice, not an admin one. Surfacing it
    // as its own flag stops the list conflating "member with no display name"
    // with "deliberately posted anonymously" — they used to render identically.
    postedAnonymously: Boolean(response.isAnonymous),
    responseSource: response.responderId
      ? response.voiceUrl
        ? "MEMBER_VOICE"
        : "MEMBER_TEXT"
      : "GUEST_TEXT",
  };
}

// Same contract for cards. Anonymous cards created before the fingerprint
// columns land have no identity at all — actorKind LEGACY says so honestly
// instead of printing a bare "未知" that reads like a lookup failure.
export function toAdminPrayerCard(card) {
  if (!card) return card;
  return withActorFields(card);
}
