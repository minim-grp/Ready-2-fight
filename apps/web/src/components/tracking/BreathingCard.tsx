// Statische Box-Breathing-Anleitung (4-7-8). Kein Audio, kein Timer.
// ROADMAP-v2 §5c.3: "kein Audio in MVP, nur visueller Anker fuer 5c-Future".
export function BreathingCard() {
  return (
    <div
      className="rounded-[22px] p-5"
      style={{
        backgroundColor: "var(--color-bone)",
        border: "1px solid var(--line)",
        boxShadow: "var(--shadow-1)",
      }}
    >
      <p
        className="text-xs tracking-[0.18em] uppercase"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-ink-3)",
        }}
      >
        Atem-Anker
      </p>
      <h2
        className="mt-2 text-xl"
        style={{
          fontFamily: "var(--font-display)",
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
        }}
      >
        4 · <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>7</em> · 8
      </h2>
      <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Vor dem Tracking 1 bis 3 Runden, um den Tag bewusst zu schliessen.
      </p>
      <ol className="mt-4 space-y-1.5 text-sm" style={{ color: "var(--color-ink-2)" }}>
        <Step n={4} action="Einatmen durch die Nase" />
        <Step n={7} action="Halten" />
        <Step n={8} action="Ausatmen durch den Mund" />
      </ol>
    </div>
  );
}

function Step({ n, action }: { n: number; action: string }) {
  return (
    <li className="flex items-baseline gap-3">
      <span
        className="tabular-nums"
        style={{
          fontFamily: "var(--font-mono)",
          color: "var(--color-accent-2)",
          minWidth: "1.5ch",
        }}
      >
        {n}s
      </span>
      <span>{action}</span>
    </li>
  );
}
