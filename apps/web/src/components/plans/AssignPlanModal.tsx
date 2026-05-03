import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { useAssignPlan } from "../../hooks/queries/usePlans";
import { useEngagements, type EngagementRow } from "../../hooks/queries/useEngagements";

type Props = {
  templateId: string;
  templateTitle: string;
  onClose: () => void;
  onAssigned?: (planId: string) => void;
};

// Mapping der RPC-Fehlernamen aus 20260501000001_assign_plan_rpc.sql
// auf nutzerlesbare Texte. Andere Fehler werden generisch behandelt.
function rpcErrorToMessage(raw: string): string {
  if (raw.includes("not_authenticated")) return "Sitzung abgelaufen. Bitte neu anmelden.";
  if (raw.includes("template_not_found")) return "Template nicht gefunden.";
  if (raw.includes("forbidden_owner"))
    return "Dieses Template gehoert nicht zu deinem Account.";
  if (raw.includes("engagement_not_active"))
    return "Engagement nicht aktiv. Bitte Athlet erneut waehlen.";
  if (raw.includes("permission_denied"))
    return "Keine Berechtigung 'Plaene erstellen' fuer diesen Athleten.";
  return raw;
}

export function AssignPlanModal({
  templateId,
  templateTitle,
  onClose,
  onAssigned,
}: Props) {
  const engagements = useEngagements();
  const assign = useAssignPlan();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const eligible = useMemo<EngagementRow[]>(() => {
    const rows = engagements.data ?? [];
    return rows.filter((r) => r.status === "active" && r.can_create_plans);
  }, [engagements.data]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !assign.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assign.isPending, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedId) {
      setError("Bitte einen Athleten auswaehlen.");
      return;
    }
    const eng = eligible.find((r) => r.id === selectedId);
    if (!eng) {
      setError("Auswahl nicht mehr gueltig. Bitte neu laden.");
      return;
    }
    setError(null);
    try {
      const newId = await assign.mutateAsync({
        template_id: templateId,
        athlete_id: eng.athlete_id,
        engagement_id: eng.id,
      });
      toast.success(`"${templateTitle}" zugewiesen.`);
      onAssigned?.(newId);
      onClose();
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(`Zuweisen fehlgeschlagen: ${rpcErrorToMessage(raw)}`);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="assign-plan-title"
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(21, 20, 15, 0.55)" }}
    >
      <div
        className="w-full max-w-md rounded-[28px] p-6"
        style={{
          backgroundColor: "var(--color-paper)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <p
          className="mb-1 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          Plan zuweisen
        </p>
        <h2
          id="assign-plan-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {templateTitle}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
          Eine Kopie wird dem ausgewaehlten Athleten zugewiesen. Sessions und Uebungen
          werden 1:1 uebernommen.
        </p>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-5 space-y-4"
        >
          {engagements.isLoading && (
            <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
              Lade Athleten …
            </p>
          )}

          {engagements.error && (
            <p
              role="alert"
              className="text-sm"
              style={{ color: "var(--color-accent-2)" }}
            >
              Athleten konnten nicht geladen werden.
            </p>
          )}

          {!engagements.isLoading && !engagements.error && eligible.length === 0 && (
            <div
              className="rounded-2xl p-4"
              style={{
                backgroundColor: "var(--color-paper-elev)",
                border: "1px solid var(--line)",
              }}
            >
              <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
                Kein Athlet mit Berechtigung "Plaene erstellen". Aktiviere die Permission
                im Engagement, um zuweisen zu koennen.
              </p>
            </div>
          )}

          {eligible.length > 0 && (
            <fieldset className="space-y-2">
              <legend className="sr-only">Athlet auswaehlen</legend>
              {eligible.map((eng) => (
                <label
                  key={eng.id}
                  className="flex cursor-pointer items-center gap-3 rounded-2xl px-4 py-3"
                  style={{
                    backgroundColor:
                      selectedId === eng.id
                        ? "var(--color-accent-soft, var(--color-paper-elev))"
                        : "var(--color-paper-elev)",
                    border:
                      selectedId === eng.id
                        ? "1px solid var(--color-accent)"
                        : "1px solid var(--line)",
                  }}
                >
                  <input
                    type="radio"
                    name="assign-athlete"
                    value={eng.id}
                    checked={selectedId === eng.id}
                    onChange={() => setSelectedId(eng.id)}
                    style={{ accentColor: "var(--color-accent)" }}
                  />
                  <span className="text-sm" style={{ color: "var(--color-ink)" }}>
                    {eng.athlete_name ?? "Unbekannter Athlet"}
                  </span>
                </label>
              ))}
            </fieldset>
          )}

          {error && (
            <p
              role="alert"
              className="text-sm"
              style={{ color: "var(--color-accent-2)" }}
            >
              {error}
            </p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={assign.isPending}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={assign.isPending || eligible.length === 0 || selectedId === null}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "var(--color-on-night)",
              }}
            >
              {assign.isPending ? "Weise zu …" : "Zuweisen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
