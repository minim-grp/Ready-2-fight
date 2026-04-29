const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

type Right = {
  key: "export" | "correction" | "delete";
  label: string;
  hint: string;
};

const RIGHTS: ReadonlyArray<Right> = [
  {
    key: "export",
    label: "Daten exportieren",
    hint: "DSGVO Art. 20 — Datei mit allen Tracking-, Test- und Engagement-Daten.",
  },
  {
    key: "correction",
    label: "Korrektur anfordern",
    hint: "DSGVO Art. 16 — Aenderungen an Profil oder historischen Eintraegen melden.",
  },
  {
    key: "delete",
    label: "Konto loeschen",
    hint: "DSGVO Art. 17 — irreversible Loeschung mit 30-Tage-Karenz.",
  },
];

export function DataRightsCard() {
  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-1 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Deine Daten
      </p>
      <h2
        className="mb-3"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.25rem",
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
        }}
      >
        Daten-Rechte
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Diese Funktionen sind im MVP vorbereitet, aber noch nicht freigeschaltet. Schreib
        uns bis dahin per E-Mail.
      </p>
      <ul className="space-y-3">
        {RIGHTS.map((r) => (
          <li key={r.key}>
            <button
              type="button"
              disabled
              aria-label={r.label}
              className="w-full rounded-2xl px-4 py-3 text-left text-sm"
              style={{
                border: "1px solid var(--line)",
                backgroundColor: "var(--color-bg-2)",
                color: "var(--color-ink-3)",
                cursor: "not-allowed",
              }}
            >
              <span className="block font-medium" style={{ color: "var(--color-ink-2)" }}>
                {r.label}
              </span>
              <span
                className="mt-1 block text-xs"
                style={{ color: "var(--color-ink-3)" }}
              >
                {r.hint}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
