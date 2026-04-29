import { useMemo, useState } from "react";
import { useTrackingHistory } from "../../hooks/queries/useTrackingHistory";
import { buildHistoryGrid, type HistoryWindow } from "../../lib/trackingHistory";

const WINDOWS: ReadonlyArray<HistoryWindow> = [7, 30];

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function StreakHistoryChart() {
  const [windowDays, setWindowDays] = useState<HistoryWindow>(7);
  const today = useMemo(() => new Date(), []);
  const q = useTrackingHistory(windowDays, today);

  return (
    <div className="rounded-[22px] p-5" style={CARD_STYLE}>
      <div className="mb-3 flex items-center justify-between">
        <h2
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-3)",
          }}
        >
          Tracking-Historie
        </h2>
        <div role="group" aria-label="Zeitraum waehlen" className="inline-flex gap-1">
          {WINDOWS.map((w) => {
            const active = w === windowDays;
            return (
              <button
                key={w}
                type="button"
                onClick={() => setWindowDays(w)}
                aria-pressed={active}
                className="rounded-md px-2.5 py-1 text-xs"
                style={{
                  backgroundColor: active ? "var(--color-accent)" : "transparent",
                  color: active ? "var(--color-on-night)" : "var(--color-ink-2)",
                  border: active ? "none" : "1px solid var(--line-2)",
                }}
              >
                {w} Tage
              </button>
            );
          })}
        </div>
      </div>

      {q.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Historie …
        </p>
      )}

      {q.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
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
              fill={day.tracked ? "var(--color-accent)" : "var(--color-bg-3)"}
            >
              <title>
                {day.date} — {day.tracked ? "getrackt" : "nicht getrackt"}
              </title>
            </rect>
          );
        })}
      </svg>
      <p
        className="mt-3 text-xs tracking-[0.12em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-4)",
        }}
      >
        <span className="tabular-nums" style={{ color: "var(--color-ink-2)" }}>
          {trackedCount}
        </span>{" "}
        / {windowDays} Tage getrackt
      </p>
    </div>
  );
}
