type Props = {
  onSignOut: () => void;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function SessionCard({ onSignOut }: Props) {
  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-1 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Sitzung
      </p>
      <p className="mb-4 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Abmelden beendet die lokale Offline-Queue und loescht Session-Cookies.
      </p>
      <button
        type="button"
        onClick={onSignOut}
        className="rounded-2xl px-4 py-2 text-sm"
        style={{
          border: "1px solid var(--color-accent-2)",
          color: "var(--color-accent-2)",
          backgroundColor: "transparent",
        }}
      >
        Abmelden
      </button>
    </section>
  );
}
