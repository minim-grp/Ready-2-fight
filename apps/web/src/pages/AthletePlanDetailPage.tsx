import { Link, Navigate, useParams } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useAthletePlan, usePlanCompletions } from "../hooks/queries/useAthletePlans";
import { AthleteSessionCard } from "../components/plans/AthleteSessionCard";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function AthletePlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isAthleteView = role === "athlete" || (role === "both" && mode === "athlete");

  const plan = useAthletePlan(id);
  const sessionIds = (plan.data?.sessions ?? []).map((s) => s.id);
  const completions = usePlanCompletions(id, sessionIds);

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
  if (!isAthleteView) {
    return <Navigate to="/app/dashboard" replace />;
  }
  if (!id) {
    return <Navigate to="/app/plan" replace />;
  }

  if (plan.isLoading) {
    return (
      <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Lade Plan …
      </p>
    );
  }
  if (plan.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
        Plan konnte nicht geladen werden.
      </p>
    );
  }
  if (!plan.data) {
    return (
      <section className="space-y-4">
        <Link to="/app/plan" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          ← Zurueck zur Liste
        </Link>
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Plan nicht gefunden oder nicht mehr verfuegbar.
          </p>
        </div>
      </section>
    );
  }

  const completionBySession = new Map(
    (completions.data ?? []).map((c) => [c.session_id, c]),
  );
  const sessions = plan.data.sessions;
  const doneCount = sessions.filter((s) => completionBySession.has(s.id)).length;
  const dateLine =
    plan.data.starts_on || plan.data.ends_on
      ? `${plan.data.starts_on ?? "?"} → ${plan.data.ends_on ?? "?"}`
      : null;

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <Link to="/app/plan" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          ← Zurueck zur Liste
        </Link>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {plan.data.coach_name ? `Coach: ${plan.data.coach_name}` : "Coach unbekannt"}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {plan.data.title}
        </h1>
        {plan.data.description && (
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            {plan.data.description}
          </p>
        )}
        {dateLine && (
          <p
            className="text-xs tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            {dateLine}
          </p>
        )}
        {sessions.length > 0 && (
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            {doneCount}/{sessions.length} Sessions erledigt
          </p>
        )}
      </header>

      {sessions.length === 0 && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Dieser Plan enthaelt noch keine Sessions.
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <ul role="list" className="space-y-3">
          {sessions.map((s) => (
            <AthleteSessionCard
              key={s.id}
              planId={plan.data!.id}
              session={s}
              completion={completionBySession.get(s.id)}
            />
          ))}
        </ul>
      )}
    </section>
  );
}
