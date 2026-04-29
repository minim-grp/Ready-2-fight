type Props = {
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
  onStart: () => void;
  pending: boolean;
};

const STOP_SIGNS: readonly string[] = [
  "Stechen oder Druckgefuehl in der Brust",
  "Schwindel, Uebelkeit oder Schwarzsehen",
  "Atemnot, die nicht innerhalb von Sekunden besser wird",
  "Akute Schmerzen in Gelenken, Sehnen oder Muskeln",
  "Herzrasen, das sich nicht beruhigt",
];

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-2)",
};

export function DisclaimerStep({ accepted, onAcceptedChange, onStart, pending }: Props) {
  return (
    <div className="space-y-6 rounded-[28px] p-7" style={CARD_STYLE}>
      <header className="space-y-2">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Bevor du startest
        </p>
        <h2
          className="leading-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.875rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Hoer auf deinen Koerper.
        </h2>
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Der CRS-Test fordert dich voll. Wenn dein Koerper eines der folgenden Signale
          sendet, brich sofort ab und ruhe dich aus. Bei Vorerkrankungen sprich vorher mit
          einer aerztlichen Fachkraft.
        </p>
      </header>

      <section
        className="rounded-2xl p-5"
        style={{
          backgroundColor: "var(--color-bone)",
          border: "1px solid var(--line)",
        }}
      >
        <p
          className="mb-3 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          Stoppe sofort bei
        </p>
        <ul className="space-y-2 text-sm" style={{ color: "var(--color-ink)" }}>
          {STOP_SIGNS.map((sign) => (
            <li key={sign} className="flex gap-3">
              <span
                aria-hidden
                className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full"
                style={{ backgroundColor: "var(--color-accent)" }}
              />
              <span>{sign}</span>
            </li>
          ))}
        </ul>
      </section>

      <label
        className="flex items-start gap-3 text-sm"
        style={{ color: "var(--color-ink)" }}
      >
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0 accent-current"
          style={{ accentColor: "var(--color-accent)" }}
        />
        <span>
          Ich fuehle mich heute fit fuer einen fordernden Fitnesstest und werde bei einem
          der oben genannten Signale sofort abbrechen.
        </span>
      </label>

      <button
        type="button"
        disabled={!accepted || pending}
        onClick={onStart}
        className="w-full rounded-2xl px-5 py-4 text-sm font-medium disabled:opacity-40"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
          fontFamily: "var(--font-sans)",
        }}
      >
        {pending ? "Starte …" : "Test starten"}
      </button>
    </div>
  );
}
