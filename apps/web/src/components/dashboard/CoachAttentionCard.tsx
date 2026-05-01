import { Link } from "react-router-dom";
import {
  useCoachAttentionItems,
  type AttentionRule,
  type CoachAttentionItem,
} from "../../hooks/queries/useCoachDashboard";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

const RULE_LABEL: Record<AttentionRule, string> = {
  tracking_overdue: "Tracking ueberfaellig",
  upcoming_competition: "Wettkampf naht",
};

export function CoachAttentionCard() {
  const items = useCoachAttentionItems();

  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Brauchen Aufmerksamkeit
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
        Athleten-Hinweise
      </h2>

      {items.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Hinweise …
        </p>
      )}
      {items.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Hinweise konnten nicht geladen werden.
        </p>
      )}
      {!items.isLoading && !items.error && (items.data ?? []).length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Alles ruhig. Kein Athlet braucht aktuell deine Aufmerksamkeit.
        </p>
      )}
      {(items.data ?? []).length > 0 && (
        <ul role="list" className="space-y-2">
          {(items.data ?? []).map((it, i) => (
            <AttentionRow key={`${it.rule}-${it.athlete_id}-${i}`} item={it} />
          ))}
        </ul>
      )}
    </section>
  );
}

function AttentionRow({ item }: { item: CoachAttentionItem }) {
  return (
    <li
      className="flex items-start justify-between gap-3 rounded-2xl px-4 py-3 text-sm"
      style={{
        backgroundColor: "var(--color-paper-elev)",
        border: "1px solid var(--line)",
      }}
    >
      <div className="min-w-0">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          {RULE_LABEL[item.rule]}
        </p>
        <Link
          to={`/app/athletes/${item.athlete_id}`}
          className="mt-1 block truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1rem",
            color: "var(--color-ink)",
            textDecoration: "none",
          }}
        >
          {item.athlete_name}
        </Link>
        <p className="mt-1 text-xs" style={{ color: "var(--color-ink-3)" }}>
          {item.detail}
        </p>
      </div>
    </li>
  );
}
