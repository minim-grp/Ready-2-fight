const MS_PER_DAY = 24 * 60 * 60 * 1000;
const KARENZ_DAYS = 4;

export function isInKarenz(
  lastTrackedDate: string | null,
  currentStreak: number | null,
  now: Date,
): boolean {
  if (!lastTrackedDate) return false;
  if (!currentStreak || currentStreak <= 0) return false;

  const lastUtcMs = Date.parse(`${lastTrackedDate}T00:00:00Z`);
  if (Number.isNaN(lastUtcMs)) return false;

  const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  if (lastUtcMs >= todayUtcMs) return false;

  const deadlineMs = lastUtcMs + KARENZ_DAYS * MS_PER_DAY;
  return deadlineMs > now.getTime();
}
