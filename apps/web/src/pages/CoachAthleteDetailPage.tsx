import { Link, Navigate, useParams } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useEngagements, type EngagementRow } from "../hooks/queries/useEngagements";
import {
  useCoachAthleteCrsHistory,
  useCoachAthletePlans,
  useCoachAthleteTrackingHistory,
  type AthleteAssignedPlan,
  type AthleteCrsScore,
  type AthleteTrackingDay,
} from "../hooks/queries/useCoachAthleteDetail";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function CoachAthleteDetailPage() {
  const { athleteId } = useParams<{ athleteId: string }>();
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isCoachView = role === "coach" || (role === "both" && mode === "coach");

  const engagements = useEngagements();
  const tracking = useCoachAthleteTrackingHistory(athleteId);
  const crs = useCoachAthleteCrsHistory(athleteId);
  const plans = useCoachAthletePlans(athleteId);

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

  const eng = (engagements.data ?? []).find(
    (e) => e.athlete_id === athleteId && e.status === "active",
  );
  const athleteName = eng?.athlete_name ?? "Athlet";

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
          Athlet
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {athleteName}
        </h1>
      </header>

      {!engagements.isLoading && !eng && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Kein aktives Engagement mit diesem Athleten. Bitte zuerst ein Engagement
            anlegen.
          </p>
        </div>
      )}

      {eng && (
        <>
          <PermissionsBadge engagement={eng} />

          {eng.can_see_tracking ? (
            <TrackingSection
              data={tracking.data ?? []}
              loading={tracking.isLoading}
              error={tracking.error}
            />
          ) : (
            <PermissionMissingCard
              section="Tracking-Verlauf"
              permission="can_see_tracking"
            />
          )}

          {eng.can_see_tests ? (
            <CrsSection data={crs.data ?? []} loading={crs.isLoading} error={crs.error} />
          ) : (
            <PermissionMissingCard section="CRS-Verlauf" permission="can_see_tests" />
          )}

          {eng.can_create_plans ? (
            <PlansSection
              data={plans.data ?? []}
              loading={plans.isLoading}
              error={plans.error}
            />
          ) : (
            <PermissionMissingCard
              section="Trainingsplaene"
              permission="can_create_plans"
            />
          )}

          {eng.can_see_tracking && (
            <Link
              to={`/app/athletes/${athleteId}/competitions`}
              className="block rounded-[22px] p-5"
              style={{
                ...CARD_STYLE,
                color: "var(--color-ink)",
                textDecoration: "none",
              }}
            >
              <p
                className="text-xs tracking-[0.18em] uppercase"
                style={{
                  fontFamily: "var(--font-mono)",
                  color: "var(--color-ink-3)",
                }}
              >
                Wettkaempfe
              </p>
              <p
                className="mt-1"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.125rem",
                  color: "var(--color-accent)",
                }}
              >
                Wettkaempfe ansehen →
              </p>
            </Link>
          )}
        </>
      )}
    </section>
  );
}

function PermissionsBadge({ engagement }: { engagement: EngagementRow }) {
  const items: Array<{ key: string; label: string; granted: boolean }> = [
    {
      key: "can_see_tracking",
      label: "Tracking",
      granted: engagement.can_see_tracking,
    },
    { key: "can_see_meals", label: "Mahlzeiten", granted: engagement.can_see_meals },
    { key: "can_see_tests", label: "CRS-Tests", granted: engagement.can_see_tests },
    {
      key: "can_create_plans",
      label: "Plaene",
      granted: engagement.can_create_plans,
    },
  ];
  return (
    <div className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-3 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Deine Rechte
      </p>
      <ul role="list" className="flex flex-wrap gap-2">
        {items.map((it) => (
          <li
            key={it.key}
            className="rounded-full px-3 py-1 text-xs"
            style={{
              border: "1px solid var(--line-2)",
              color: it.granted ? "var(--color-accent)" : "var(--color-ink-3)",
              backgroundColor: it.granted
                ? "var(--color-accent-soft, transparent)"
                : "transparent",
              textDecoration: it.granted ? "none" : "line-through",
            }}
          >
            {it.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

function PermissionMissingCard({
  section,
  permission,
}: {
  section: string;
  permission: string;
}) {
  return (
    <div className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        {section}
      </p>
      <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Permission `{permission}` fehlt — Athlet muss sie im Engagement aktivieren.
      </p>
    </div>
  );
}

function TrackingSection({
  data,
  loading,
  error,
}: {
  data: AthleteTrackingDay[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-3">
      <h2
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Tracking-Verlauf (letzte 30 Tage)
      </h2>
      {loading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Tracking …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Tracking konnte nicht geladen werden.
        </p>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="rounded-[22px] p-5" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Keine Tracking-Eintraege in den letzten 30 Tagen.
          </p>
        </div>
      )}
      {data.length > 0 && (
        <ul role="list" className="space-y-2">
          {data.map((d) => (
            <li
              key={d.date}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
              style={CARD_STYLE}
            >
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
              >
                {d.date}
              </span>
              <span style={{ color: "var(--color-ink)" }}>
                {d.trained ? `Trainiert${d.rpe ? ` · RPE ${d.rpe}` : ""}` : "Ruhetag"}
                {d.weight_kg != null ? ` · ${d.weight_kg} kg` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CrsSection({
  data,
  loading,
  error,
}: {
  data: AthleteCrsScore[];
  loading: boolean;
  error: Error | null;
}) {
  return (
    <div className="space-y-3">
      <h2
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        CRS-Verlauf
      </h2>
      {loading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade CRS-Tests …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          CRS-Tests konnten nicht geladen werden.
        </p>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="rounded-[22px] p-5" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Noch keine abgeschlossenen CRS-Tests.
          </p>
        </div>
      )}
      {data.length > 0 && (
        <ul role="list" className="space-y-2">
          {data.map((c) => (
            <li
              key={c.test_id}
              className="flex items-center justify-between rounded-2xl px-4 py-3 text-sm"
              style={CARD_STYLE}
            >
              <span
                className="tabular-nums"
                style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
              >
                {c.completed_at.slice(0, 10)}
              </span>
              <span style={{ color: "var(--color-ink)" }}>
                Score {c.score}
                {c.rank ? ` · ${c.rank}` : ""}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function PlansSection({
  data,
  loading,
  error,
}: {
  data: AthleteAssignedPlan[];
  loading: boolean;
  error: Error | null;
}) {
  const active = data.filter((p) => p.archived_at === null);
  const archived = data.filter((p) => p.archived_at !== null);
  return (
    <div className="space-y-3">
      <h2
        className="text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Trainingsplaene
      </h2>
      {loading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Plaene …
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Plaene konnten nicht geladen werden.
        </p>
      )}
      {!loading && !error && data.length === 0 && (
        <div className="rounded-[22px] p-5" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Keine Plaene fuer diesen Athleten angelegt.
          </p>
        </div>
      )}
      {active.length > 0 && (
        <ul role="list" className="space-y-2">
          {active.map((p) => (
            <PlanRow key={p.id} plan={p} />
          ))}
        </ul>
      )}
      {archived.length > 0 && (
        <details className="rounded-2xl px-4 py-3 text-sm" style={CARD_STYLE}>
          <summary className="cursor-pointer" style={{ color: "var(--color-ink-2)" }}>
            {archived.length} archivierte Plaene
          </summary>
          <ul role="list" className="mt-2 space-y-2">
            {archived.map((p) => (
              <PlanRow key={p.id} plan={p} archived />
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function PlanRow({ plan, archived }: { plan: AthleteAssignedPlan; archived?: boolean }) {
  return (
    <li
      className="rounded-2xl px-4 py-3"
      style={{ ...CARD_STYLE, opacity: archived ? 0.6 : 1 }}
    >
      <Link to={`/app/plans/${plan.id}`} style={{ textDecoration: "none" }}>
        <p
          className="truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1rem",
            color: "var(--color-ink)",
          }}
        >
          {plan.title}
        </p>
        {(plan.starts_on || plan.ends_on) && (
          <p
            className="text-xs tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            {plan.starts_on ?? "?"} → {plan.ends_on ?? "?"}
          </p>
        )}
      </Link>
    </li>
  );
}
