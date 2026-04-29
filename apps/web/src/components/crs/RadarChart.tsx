export type RadarAxis = {
  label: string;
  shortLabel: string;
  value: number;
  max: number;
};

type Props = {
  axes: ReadonlyArray<RadarAxis>;
};

export function RadarChart({ axes }: Props) {
  const size = 280;
  const center = size / 2;
  const radius = size / 2 - 36;
  const count = axes.length;

  function pointFor(ratio: number, idx: number) {
    const angle = (Math.PI * 2 * idx) / count - Math.PI / 2;
    const r = Math.max(0, Math.min(1, ratio)) * radius;
    return { x: center + r * Math.cos(angle), y: center + r * Math.sin(angle) };
  }

  const ringRatios = [0.25, 0.5, 0.75, 1];
  const polygonPoints = axes
    .map((a, i) => {
      const p = pointFor(a.max > 0 ? a.value / a.max : 0, i);
      return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width="100%"
      height="auto"
      role="img"
      aria-label="CRS Radar-Chart der fuenf Uebungen"
      style={{ maxWidth: 320 }}
    >
      {ringRatios.map((r) => {
        const pts = axes
          .map((_, i) => {
            const p = pointFor(r, i);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          })
          .join(" ");
        return (
          <polygon
            key={r}
            points={pts}
            fill="none"
            stroke="var(--line-2)"
            strokeWidth={r === 1 ? 1.2 : 0.6}
          />
        );
      })}

      {axes.map((_, i) => {
        const p = pointFor(1, i);
        return (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={p.x}
            y2={p.y}
            stroke="var(--line-2)"
            strokeWidth={0.6}
          />
        );
      })}

      <polygon
        points={polygonPoints}
        fill="var(--color-accent)"
        fillOpacity={0.18}
        stroke="var(--color-accent)"
        strokeWidth={1.5}
      />

      {axes.map((a, i) => {
        const p = pointFor(a.max > 0 ? a.value / a.max : 0, i);
        return (
          <circle
            key={`v-${a.label}`}
            cx={p.x}
            cy={p.y}
            r={3.5}
            fill="var(--color-accent-2)"
          >
            <title>
              {a.label} — {a.value} / {a.max}
            </title>
          </circle>
        );
      })}

      {axes.map((a, i) => {
        const p = pointFor(1.18, i);
        return (
          <text
            key={`l-${a.label}`}
            x={p.x}
            y={p.y}
            textAnchor="middle"
            dominantBaseline="middle"
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: 10,
              fill: "var(--color-ink-3)",
              letterSpacing: "0.12em",
              textTransform: "uppercase",
            }}
          >
            {a.shortLabel}
          </text>
        );
      })}
    </svg>
  );
}
