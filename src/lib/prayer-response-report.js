// Pure helpers for POST /api/prayer-response/report's guest-reporting path.
// Kept separate from the route so they're unit-testable without a DB — see
// docs/obsidian/26-Anonymous-Reporting-Design.md for why guest reports don't
// write a PrayerResponseReport row (reporterId there is a required User FK).
export const GUEST_REPORT_WINDOW_MINUTES = 10;
export const GUEST_REPORT_MAX_PER_GUEST = 5;
export const GUEST_REPORT_MAX_PER_IP = 10;

export function buildGuestReportActorId(guestSessionHash) {
  return `guest:${guestSessionHash}`;
}

// A response counts as "already hidden" once it's off the APPROVED happy path —
// either isBlocked, or moderationStatus flipped away from APPROVED by a prior
// report. This is what makes guest re-reports idempotent without needing a
// per-reporter row: the response's own state is the source of truth.
export function isResponseAlreadyHidden(response) {
  if (!response) return false;
  return Boolean(response.isBlocked) || response.moderationStatus !== "APPROVED";
}

export function isGuestRateLimited({ guestCount, ipCount }) {
  return guestCount >= GUEST_REPORT_MAX_PER_GUEST || ipCount >= GUEST_REPORT_MAX_PER_IP;
}
