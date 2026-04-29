import { useMemo, useState } from "react";
import { useWeightHistory, type WeightPoint } from "../../hooks/queries/useWeightHistory";
import type { HistoryWindow } from "../../lib/trackingHistory";

const WINDOWS: ReadonlyArray<HistoryWindow> = [7, 30];

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function WeightHistoryChart() {
  const [windowDays, setWindowDays] = useState<HistoryWindow>(30);
  const today = useMemo(() => new Date(), []);
  const q = useWeightHistory(windowDays, today);

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
          Gewichtsverlauf
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
          Lade Gewichtsverlauf …
        </p>
      )}

      {q.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Gewichtsverlauf konnte nicht geladen werden.
        </p>
      )}

      {!q.isLoading && !q.error && <WeightLine points={q.data ?? []} />}
    </div>
  );
}

function WeightLine({ points }: { points: WeightPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Noch keine Gewichtsdaten. Trage dein Gewicht im Tages-Tracking ein.
      </p>
    );
  }

  const width = 320;
  const height = 120;
  const padX = 8;
  const padY = 12;

  const min = Math.min(...points.map((p) => p.weight_kg));
  const max = Math.max(...points.map((p) => p.weight_kg));
  const span = Math.max(max - min, 0.1);

  const xFor = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - 2 * padX);
  const yFor = (w: number) => padY + (1 - (w - min) / span) * (height - 2 * padY);

  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.weight_kg).toFixed(1)}`,
    )
    .join(" ");

  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const delta = latest.weight_kg - first.weight_kg;
  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta.toFixed(1)} kg`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${points.length} Messungen, zuletzt ${latest.weight_kg.toFixed(1)} kg`}
        preserveAspectRatio="none"
      >
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={p.date}
            cx={xFor(i)}
            cy={yFor(p.weight_kg)}
            r={2.5}
            fill="var(--color-accent-2)"
          >
            <title>
              {p.date} — {p.weight_kg.toFixed(1)} kg
            </title>
          </circle>
        ))}
      </svg>
      <div
        className="mt-3 flex items-baseline justify-between text-xs tracking-[0.12em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-4)",
        }}
      >
        <span>
          Aktuell ·{" "}
          <span className="tabular-nums" style={{ color: "var(--color-ink-2)" }}>
            {latest.weight_kg.toFixed(1)} kg
          </span>
        </span>
        <span>
          Δ ·{" "}
          <span className="tabular-nums" style={{ color: "var(--color-ink-2)" }}>
            {deltaLabel}
          </span>
        </span>
      </div>
    </div>
  );
}
