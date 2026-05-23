import { getDictionary, normalizeLocale } from "@/lib/i18n";

function toClientDate(value) {
  return value?.toISOString?.() ?? null;
}

function toCoordinate(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function toApproximateCoordinate(value) {
  const numeric = toCoordinate(value);
  if (numeric === null) return null;
  return Number(numeric.toFixed(1));
}

export function toGlobalPrayerPayload(card, locale = "zh-TW") {
  const text = getDictionary(normalizeLocale(locale)).globalRoom;
  const isPrivate = Boolean(card?.isPrivate);

  return {
    id: isPrivate ? `private-${card.id}` : card.id,
    isPrivate,
    title: isPrivate ? text.privateTitle : card.title,
    description: isPrivate ? text.privateDescription : card.description,
    createdAt: toClientDate(card.createdAt),
    voiceHref: isPrivate ? null : card.voiceHref,
    locationCity: isPrivate ? text.approximateLocation : card.locationCity,
    locationCountry: isPrivate ? null : card.locationCountry,
    locationLat: isPrivate ? toApproximateCoordinate(card.locationLat) : toCoordinate(card.locationLat),
    locationLng: isPrivate ? toApproximateCoordinate(card.locationLng) : toCoordinate(card.locationLng),
    category: isPrivate ? null : card.category,
    owner: isPrivate ? null : card.owner,
    responseCount: isPrivate ? 0 : card._count?.responses ?? 0,
    audioCount: isPrivate
      ? 0
      : (card.responses || []).filter((response) => Boolean(response.voiceUrl)).length,
    prayerCount: 1,
  };
}
