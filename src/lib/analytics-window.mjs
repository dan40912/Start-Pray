const DAY = 86400000;
const TAIPEI_OFFSET = 8 * 3600000;

export function analyticsWindow(days, now = new Date()) {
  const today = Math.floor((now.getTime() + TAIPEI_OFFSET) / DAY) * DAY - TAIPEI_OFFSET;
  return {
    start: new Date(today - (days - 1) * DAY),
    end: now,
    today: taipeiDay(now),
  };
}

export function taipeiDay(date) {
  return new Date(date.getTime() + TAIPEI_OFFSET).toISOString().slice(0, 10);
}

export function fillAnalyticsDays(rows, start, days) {
  const byDay = new Map(rows.map((row) => [row.day, row]));
  return Array.from({ length: days }, (_, index) => {
    const day = taipeiDay(new Date(start.getTime() + index * DAY));
    return byDay.get(day) || { day, sessions: 0, browsers: 0, engaged: 0 };
  });
}
