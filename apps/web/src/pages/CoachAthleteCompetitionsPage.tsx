import { Link, Navigate, useParams } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useEngagements } from "../hooks/queries/useEngagements";
import {
  useAthleteCompetitions,
  type AthleteCompetition,
} from "../hooks/queries/useAthleteCompetitions";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function CoachAthleteCompetitionsPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isCoachView = role === "coach" || (role === "both" && mode === "coach");

  const engagements = useEngagements();
  const competitions = useAthleteCompetitions(athleteId);

  if (profile.isLoading) {
    return (
      <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Lade Profil …
      </p>
    );
  }
  if (profile.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
        Profil konnte nicht geladen werden.
      </p>
    );
  }
  if (!isCoachView) {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (!athleteId) {
    return <Navigate to="/app/engagements" replace />;
  }

  // Gate: Coach hat aktives Engagement mit can_see_tracking auf diesen Athleten?
  // Ohne den Gate wuerde RLS einfach 0 Wettkaempfe liefern, aber wir wollen eine
  // klare UX-Meldung statt einem leeren Empty-State.
  const eng = (engagements.data ?? []).find(
    (e) => e.athlete_id === athleteId && e.status === "active",
  );
  const athleteName = eng?.athlete_name ?? "Athlet";
  const hasPermission = eng?.can_see_tracking ?? false;

  const all = competitions.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((c) => c.competition_date >= today);
  const past = all.filter((c) => c.competition_date < today);

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link
          to="/app/engagements"
          className="text-sm"
          style={{ color: "var(--color-ink-3)" }}
        >
          ← Zurueck zu Athleten
        </Link>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Athlet: {athleteName}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Wettkaempfe
        </h1>
      </header>

      {!engagements.isLoading && !eng && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Kein aktives Engagement mit diesem Athleten. Wettkaempfe sind nicht sichtbar.
          </p>
        </div>
      )}

      {!engagements.isLoading && eng && !hasPermission && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Permission "Tracking sehen" fehlt. Bitte den Athleten, dir die Permission zu
            geben — Wettkaempfe sind an `can_see_tracking` gekoppelt.
          </p>
        </div>
      )}

      {hasPermission && competitions.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Wettkaempfe …
        </p>
      )}

      {hasPermission && competitions.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Wettkaempfe konnten nicht geladen werden.
        </p>
      )}

      {hasPermission &&
        !competitions.isLoading &&
        !competitions.error &&
        all.length === 0 && (
          <div className="rounded-[22px] p-6" style={CARD_STYLE}>
            <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
              Dieser Athlet hat noch keine Wettkaempfe eingetragen.
            </p>
          </div>
        )}

      {hasPermission && upcoming.length > 0 && (
        <CompSection label="Anstehend" rows={upcoming} />
      )}
      {hasPermission && past.length > 0 && <CompSection label="Vergangen" rows={past} />}
    </section>
  );
}

function CompSection({ label, rows }: { label: string; rows: AthleteCompetition[] }) {
  return (
    <div className="space-y-3">
      <h2
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {label}
      </h2>
      <ul role="list" className="space-y-3">
        {rows.map((c) => (
          <CompCard key={c.id} comp={c} />
        ))}
      </ul>
    </div>
  );
}

function CompCard({ comp }: { comp: AthleteCompetition }) {
  const subtitle = [comp.discipline, comp.weight_class].filter(Boolean).join(" · ");
  return (
    <li className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="text-xs tabular-nums"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {comp.competition_date}
        {comp.location ? ` · ${comp.location}` : ""}
      </p>
      <h3
        className="mt-1 truncate"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.25rem",
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
        }}
      >
        {comp.title}
      </h3>
      {subtitle && (
        <p className="mt-1 text-sm" style={{ color: "var(--color-ink-2)" }}>
          {subtitle}
        </p>
      )}
      {comp.result && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink)" }}>
          Ergebnis: {comp.result}
        </p>
      )}
      {comp.notes && (
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
          {comp.notes}
        </p>
      )}
    </li>
  );
}
