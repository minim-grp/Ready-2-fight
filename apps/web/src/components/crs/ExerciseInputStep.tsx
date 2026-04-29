import { useState } from "react";

type Props = {
  label: string;
  unit: string;
  max: number;
  pending: boolean;
  onSubmit: (value: number) => void;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-2)",
};

export function ExerciseInputStep({ label, unit, max, pending, onSubmit }: Props) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) {
      setError("Bitte eine Zahl >= 0 eingeben.");
      return;
    }
    if (n > max) {
      setError(`Wert ueber plausibler Obergrenze (max. ${max}).`);
      return;
    }
    setError(null);
    onSubmit(n);
  }

  return (
    <div className="space-y-5 rounded-[28px] p-7" style={CARD_STYLE}>
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Werteingabe
        </p>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.75rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {label} – Wert eintragen
        </h2>
      </header>

      <label
        className="block text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {unit}
        <input
          type="number"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          min={0}
          max={max}
          className="mt-2 block w-full rounded-2xl px-4 py-3 text-2xl tabular-nums"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--line)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-display)",
          }}
        />
      </label>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          {error}
        </p>
      )}

      <button
        type="button"
        disabled={pending || raw === ""}
        onClick={handleSubmit}
        className="w-full rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
        }}
      >
        {pending ? "Speichere …" : "Weiter"}
      </button>
    </div>
  );
}
