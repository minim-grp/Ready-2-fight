import { useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import {
  useClonePlan,
  useCoachPlans,
  useDeletePlan,
  type CoachPlan,
} from "../hooks/queries/usePlans";
import { CreatePlanModal } from "../components/plans/CreatePlanModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function PlansPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isCoachView = role === "coach" || (role === "both" && mode === "coach");

  const plans = useCoachPlans();
  const del = useDeletePlan();
  const clone = useClonePlan();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<CoachPlan | null>(null);
  const [cloningId, setCloningId] = useState<string | null>(null);

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

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Plan geloescht.");
      setConfirmDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Loeschen fehlgeschlagen: ${msg}`);
      setConfirmDelete(null);
    }
  }

  async function handleClone(plan: CoachPlan) {
    setCloningId(plan.id);
    try {
      const newId = await clone.mutateAsync(plan.id);
      toast.success("Kopie angelegt.");
      void navigate(`/app/plans/${newId}`);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Kopieren fehlgeschlagen: ${msg}`);
    } finally {
      setCloningId(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p
            className="text-xs tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            Coach · Trainingsplaene
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
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-2xl px-4 py-2 text-sm font-medium"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-night)",
          }}
        >
          Neuer Plan
        </button>
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

      {!plans.isLoading && !plans.error && (plans.data?.length ?? 0) === 0 && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Noch kein Plan angelegt. Starte mit einem Template, das du spaeter zuweist —
            oder erstelle direkt einen Plan fuer einen Athleten.
          </p>
        </div>
      )}

      {!plans.isLoading && !plans.error && (plans.data?.length ?? 0) > 0 && (
        <ul role="list" className="space-y-3">
          {plans.data!.map((p) => (
            <PlanCard
              key={p.id}
              plan={p}
              cloning={cloningId === p.id}
              onDelete={() => setConfirmDelete(p)}
              onClone={() => void handleClone(p)}
            />
          ))}
        </ul>
      )}

      {creating && <CreatePlanModal onClose={() => setCreating(false)} />}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Plan loeschen?"
        description={
          confirmDelete
            ? `"${confirmDelete.title}" wird mit allen Sessions und Uebungen geloescht.`
            : ""
        }
        confirmLabel="Ja, loeschen"
        cancelLabel="Abbrechen"
        destructive
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </section>
  );
}

type PlanCardProps = {
  plan: CoachPlan;
  cloning: boolean;
  onDelete: () => void;
  onClone: () => void;
};

function PlanCard({ plan, cloning, onDelete, onClone }: PlanCardProps) {
  const subtitle = plan.is_template
    ? "Template"
    : plan.athlete_name
      ? `Athlet: ${plan.athlete_name}`
      : "Zugewiesen (unbekannt)";
  const dateLine =
    plan.starts_on || plan.ends_on
      ? `${plan.starts_on ?? "?"} → ${plan.ends_on ?? "?"}`
      : null;

  return (
    <li className="rounded-[22px] p-5" style={CARD_STYLE}>
      <div className="flex items-start justify-between gap-3">
        <Link
          to={`/app/plans/${plan.id}`}
          className="min-w-0 flex-1"
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
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onClone}
            disabled={cloning}
            aria-label={`Plan ${plan.title} kopieren`}
            className="rounded-2xl px-3 py-2 text-xs disabled:opacity-40"
            style={{
              border: "1px solid var(--line-2)",
              color: "var(--color-ink-2)",
              backgroundColor: "transparent",
            }}
          >
            {cloning ? "Kopiere …" : "Kopie"}
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Plan ${plan.title} loeschen`}
            className="rounded-2xl px-3 py-2 text-xs"
            style={{
              border: "1px solid var(--line-2)",
              color: "var(--color-accent-2)",
              backgroundColor: "transparent",
            }}
          >
            Loeschen
          </button>
        </div>
      </div>
    </li>
  );
}
