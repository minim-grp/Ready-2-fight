import type { CrsHistoryPoint } from "../../hooks/queries/useCrsHistory";

type Props = {
  points: ReadonlyArray<CrsHistoryPoint>;
};

export function CrsSparkline({ points }: Props) {
  if (points.length < 2) return null;

  const width = 120;
  const height = 28;
  const padX = 2;
  const padY = 4;

  const xFor = (i: number) => padX + (i / (points.length - 1)) * (width - 2 * padX);
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

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={`Score-Verlauf · ${points.length} Tests · Δ ${delta >= 0 ? "+" : ""}${delta}`}
      preserveAspectRatio="none"
    >
      <path
        d={path}
        fill="none"
        stroke="var(--color-on-night-2)"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {points.map((p, i) => (
        <circle
          key={p.test_id}
          cx={xFor(i)}
          cy={yFor(p.score)}
          r={i === points.length - 1 ? 2.2 : 1.4}
          fill={
            i === points.length - 1 ? "var(--color-accent)" : "var(--color-on-night-3)"
          }
        />
      ))}
    </svg>
  );
}
