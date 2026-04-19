import { useMemo, useState } from "react";
import { useTrackingHistory } from "../../hooks/queries/useTrackingHistory";
import { buildHistoryGrid, type HistoryWindow } from "../../lib/trackingHistory";

const WINDOWS: ReadonlyArray<HistoryWindow> = [7, 30];

export function StreakHistoryChart() {
  const [windowDays, setWindowDays] = useState<HistoryWindow>(7);
  const today = useMemo(() => new Date(), []);
  const q = useTrackingHistory(windowDays, today);

  return (
    <div className="rounded-md border border-slate-800 p-4">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-medium text-slate-300">Tracking-Historie</h2>
        <div role="group" aria-label="Zeitraum waehlen" className="inline-flex gap-1">
          {WINDOWS.map((w) => {
            const active = w === windowDays;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWindowDays(w)}
                aria-pressed={active}
                className={
                  "rounded-md px-2.5 py-1 text-xs " +
                  (active
                    ? "bg-slate-100 text-slate-900"
                    : "border border-slate-800 text-slate-300 hover:border-slate-600")
                }
              >
                {w} Tage
              </button>
            );
          })}
        </div>
      </div>

      {q.isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Lade Historie …
        </p>
      )}

      {q.error && (
        <p role="alert" className="text-sm text-red-400">
          Historie konnte nicht geladen werden.
        </p>
      )}

      {!q.isLoading && !q.error && (
        <HistoryGrid dates={q.data ?? []} windowDays={windowDays} today={today} />
      )}
    </div>
  );
}

type GridProps = {
  dates: string[];
  windowDays: HistoryWindow;
  today: Date;
};

function HistoryGrid({ dates, windowDays, today }: GridProps) {
  const grid = useMemo(
    () => buildHistoryGrid(dates, windowDays, today),
    [dates, windowDays, today],
  );
  const trackedCount = grid.filter((d) => d.tracked).length;

  const cols = windowDays === 7 ? 7 : 10;
  const rows = Math.ceil(windowDays / cols);
  const cellSize = 12;
  const gap = 4;
  const width = cols * cellSize + (cols - 1) * gap;
  const height = rows * cellSize + (rows - 1) * gap;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${trackedCount} von ${windowDays} Tagen getrackt`}
        preserveAspectRatio="xMinYMid meet"
      >
        {grid.map((day, i) => {
          const col = i % cols;
          const row = Math.floor(i / cols);
          const x = col * (cellSize + gap);
          const y = row * (cellSize + gap);
          return (
            <rect
              key={day.date}
              x={x}
              y={y}
              width={cellSize}
              height={cellSize}
              rx={2}
              ry={2}
              className={day.tracked ? "fill-orange-400" : "fill-slate-800"}
            >
              <title>
                {day.date} — {day.tracked ? "getrackt" : "nicht getrackt"}
              </title>
            </rect>
          );
        })}
      </svg>
      <p className="mt-3 text-xs text-slate-500">
        <span className="tabular-nums">{trackedCount}</span> von{" "}
        <span className="tabular-nums">{windowDays}</span> Tagen getrackt
      </p>
    </div>
  );
}
