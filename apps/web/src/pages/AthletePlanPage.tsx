import { Link, Navigate } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useAthletePlans, type AthletePlan } from "../hooks/queries/useAthletePlans";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function AthletePlanPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isAthleteView = role === "athlete" || (role === "both" && mode === "athlete");

  const plans = useAthletePlans();

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

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Mein Training
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Plaene
        </h1>
      </header>

      {plans.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Plaene …
        </p>
      )}

      {plans.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Plaene konnten nicht geladen werden.
        </p>
      )}

      {!plans.isLoading && !plans.error && (plans.data ?? []).length === 0 && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Du hast noch keinen zugewiesenen Plan. Sobald dein Coach dir einen Plan
            zuweist, taucht er hier auf.
          </p>
        </div>
      )}

      {(plans.data ?? []).length > 0 && (
        <ul role="list" className="space-y-3">
          {(plans.data ?? []).map((p) => (
            <PlanCard key={p.id} plan={p} />
          ))}
        </ul>
      )}
    </section>
  );
}

function PlanCard({ plan }: { plan: AthletePlan }) {
  const subtitle = plan.coach_name ? `Coach: ${plan.coach_name}` : "Coach unbekannt";
  const dateLine =
    plan.starts_on || plan.ends_on
      ? `${plan.starts_on ?? "?"} → ${plan.ends_on ?? "?"}`
      : null;
  return (
    <li className="rounded-[22px] p-5" style={CARD_STYLE}>
      <Link
        to={`/app/plan/${plan.id}`}
        className="block min-w-0"
        style={{ textDecoration: "none" }}
      >
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {subtitle}
        </p>
        <h2
          className="mt-1 truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.25rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {plan.title}
        </h2>
        {plan.description && (
          <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
            {plan.description}
          </p>
        )}
        {dateLine && (
          <p
            className="mt-2 text-xs tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            {dateLine}
          </p>
        )}
      </Link>
    </li>
  );
}
