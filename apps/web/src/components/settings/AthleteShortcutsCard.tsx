import { Link } from "react-router-dom";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function AthleteShortcutsCard() {
  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Mein Sport
      </p>
      <ul role="list" className="space-y-2 text-sm">
        <li>
          <Link
            to="/app/competitions"
            className="flex items-center justify-between rounded-2xl px-3 py-2"
            style={{
              backgroundColor: "var(--color-paper-elev)",
              border: "1px solid var(--line)",
              color: "var(--color-ink)",
            }}
          >
            <span>Wettkaempfe</span>
            <span style={{ color: "var(--color-ink-3)" }}>→</span>
          </Link>
        </li>
      </ul>
    </section>
  );
}
