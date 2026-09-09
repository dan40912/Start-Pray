export const DEFAULT_THUMBNAIL_ROUTE = "/api/card-thumbnail";

export function buildDefaultThumbnailUrl(title) {
  const normalizedTitle = typeof title === "string" && title.trim() ? title.trim() : "代禱";
  return `${DEFAULT_THUMBNAIL_ROUTE}?title=${encodeURIComponent(normalizedTitle)}`;
}

export function isDefaultThumbnailUrl(value) {
  return typeof value === "string" && value.startsWith(DEFAULT_THUMBNAIL_ROUTE);
}
