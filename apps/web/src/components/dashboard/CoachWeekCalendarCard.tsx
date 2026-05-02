import { Link } from "react-router-dom";
import {
  useCoachWeekEvents,
  type CoachWeekEvent,
} from "../../hooks/queries/useCoachDashboard";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function CoachWeekCalendarCard() {
  const events = useCoachWeekEvents();

  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Wochenkalender
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
        Naechste 7 Tage
      </h2>

      {events.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Kalender …
        </p>
      )}
      {events.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Kalender konnte nicht geladen werden.
        </p>
      )}
      {!events.isLoading && !events.error && (events.data ?? []).length === 0 && (
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Keine Sessions oder Wettkaempfe in den naechsten 7 Tagen.
        </p>
      )}
      {(events.data ?? []).length > 0 && (
        <ul role="list" className="space-y-2">
          {(events.data ?? []).map((e, i) => (
            <CalendarRow key={`${e.type}-${e.athlete_id}-${e.date}-${i}`} event={e} />
          ))}
        </ul>
      )}
    </section>
  );
}

function CalendarRow({ event }: { event: CoachWeekEvent }) {
  const typeLabel = event.type === "competition" ? "Wettkampf" : "Session";
  const typeColor =
    event.type === "competition" ? "var(--color-accent)" : "var(--color-ink-2)";
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
          className="text-xs tabular-nums"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {event.date} · <span style={{ color: typeColor }}>{typeLabel}</span>
        </p>
        <p className="mt-1 truncate" style={{ color: "var(--color-ink)" }}>
          {event.title}
        </p>
        <Link
          to={`/app/athletes/${event.athlete_id}`}
          className="text-xs"
          style={{ color: "var(--color-accent)", textDecoration: "underline" }}
        >
          {event.athlete_name}
        </Link>
      </div>
    </li>
  );
}
