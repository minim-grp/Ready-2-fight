import type { CrsStep } from "../../lib/crsTest";
import { getCrsExercise } from "../../lib/crsTest";

type Props = {
  step: CrsStep;
  onResume: () => void;
  onDiscard: () => void;
  pending: boolean;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-2)",
};

export function RecoveryPrompt({ step, onResume, onDiscard, pending }: Props) {
  return (
    <div className="space-y-5 rounded-[28px] p-6" style={CARD_STYLE}>
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          Test unterbrochen
        </p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          Laufenden Test fortsetzen?
        </h2>
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Wir haben einen unterbrochenen CRS-Test gefunden. Letzter Schritt:{" "}
          <strong style={{ color: "var(--color-ink)" }}>{describeStep(step)}</strong>.
        </p>
      </header>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={pending}
          onClick={onResume}
          className="rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-night)",
          }}
        >
          {pending ? "Lade …" : "Fortsetzen"}
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={onDiscard}
          className="rounded-2xl px-4 py-3 text-sm disabled:opacity-40"
          style={{
            border: "1px solid var(--line-2)",
            color: "var(--color-ink-2)",
            backgroundColor: "transparent",
          }}
        >
          Neu starten
        </button>
      </div>
    </div>
  );
}

function describeStep(step: CrsStep): string {
  switch (step.kind) {
    case "disclaimer":
      return "Disclaimer";
    case "warmup":
      return `Warm-up ${step.round + 1} / 3`;
    case "exercise":
      return `Uebung ${step.index + 1} / 5 – ${getCrsExercise(step.index).label} (${
        step.phase === "countdown" ? "Countdown" : "Werteingabe"
      })`;
    case "cooldown":
      return "Cool-down";
    case "result":
      return "Ergebnis";
  }
}
