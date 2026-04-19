export type HistoryWindow = 7 | 30;

export type HistoryDay = {
  date: string;
  tracked: boolean;
};

export function buildHistoryGrid(
  trackedDates: ReadonlyArray<string>,
  windowDays: HistoryWindow,
  today: Date,
): HistoryDay[] {
  const set = new Set(trackedDates);
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const msPerDay = 24 * 60 * 60 * 1000;

  const days: HistoryDay[] = [];
  for (let i = windowDays - 1; i >= 0; i--) {
    const dayMs = todayUtc - i * msPerDay;
    const d = new Date(dayMs);
    const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
    const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
    const dd = d.getUTCDate().toString().padStart(2, "0");
    const iso = `${yyyy}-${mm}-${dd}`;
    days.push({ date: iso, tracked: set.has(iso) });
  }
  return days;
}

export function startOfWindowIso(today: Date, windowDays: HistoryWindow): string {
  const todayUtc = Date.UTC(
    today.getUTCFullYear(),
    today.getUTCMonth(),
    today.getUTCDate(),
  );
  const startMs = todayUtc - (windowDays - 1) * 24 * 60 * 60 * 1000;
  const d = new Date(startMs);
  const yyyy = d.getUTCFullYear().toString().padStart(4, "0");
  const mm = (d.getUTCMonth() + 1).toString().padStart(2, "0");
  const dd = d.getUTCDate().toString().padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}
