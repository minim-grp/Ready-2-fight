import { useCrsHistory, type CrsHistoryPoint } from "../../hooks/queries/useCrsHistory";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function CrsHistoryChart() {
  const q = useCrsHistory();

  return (
    <div className="rounded-[22px] p-5" style={CARD_STYLE}>
      <h2
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-3)",
        }}
      >
        Score-Verlauf
      </h2>

      {q.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Score-Verlauf …
        </p>
      )}

      {q.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Score-Verlauf konnte nicht geladen werden.
        </p>
      )}

      {!q.isLoading && !q.error && <CrsLine points={q.data ?? []} />}
    </div>
  );
}

function CrsLine({ points }: { points: CrsHistoryPoint[] }) {
  if (points.length === 0) {
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Noch keine abgeschlossenen Tests. Mach den ersten CRS-Test, um den Verlauf zu
        sehen.
      </p>
    );
  }

  const width = 320;
  const height = 140;
  const padX = 8;
  const padY = 14;

  const xFor = (i: number) =>
    points.length === 1
      ? width / 2
      : padX + (i / (points.length - 1)) * (width - 2 * padX);
  const yFor = (score: number) => padY + (1 - score / 100) * (height - 2 * padY);

  const path = points
    .map(
      (p, i) =>
        `${i === 0 ? "M" : "L"} ${xFor(i).toFixed(1)} ${yFor(p.score).toFixed(1)}`,
    )
    .join(" ");

  const latest = points[points.length - 1]!;
  const first = points[0]!;
  const delta = latest.score - first.score;
  const deltaLabel = `${delta >= 0 ? "+" : ""}${delta} Pkt`;

  return (
    <div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={`${points.length} Tests, zuletzt Score ${latest.score}`}
        preserveAspectRatio="none"
      >
        {[25, 50, 75].map((mark) => (
          <line
            key={mark}
            x1={padX}
            x2={width - padX}
            y1={yFor(mark)}
            y2={yFor(mark)}
            stroke="var(--line-2)"
            strokeWidth={0.5}
            strokeDasharray="2 3"
          />
        ))}
        <path d={path} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
        {points.map((p, i) => (
          <circle
            key={p.test_id}
            cx={xFor(i)}
            cy={yFor(p.score)}
            r={2.5}
            fill="var(--color-accent-2)"
          >
            <title>
              {p.completed_at.slice(0, 10)} — Score {p.score}
              {p.rank ? ` · Rang ${p.rank}` : ""}
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
            {latest.score}
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
