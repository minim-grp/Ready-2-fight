import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useCreatePlan } from "../../hooks/queries/usePlans";
import {
  EMPTY_PLAN_FORM,
  planFormToInput,
  validatePlanForm,
  type PlanFormState,
} from "./planForm.logic";

type Props = {
  onClose: () => void;
  onCreated?: (planId: string) => void;
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper-elev)",
  border: "1px solid var(--line)",
  color: "var(--color-ink)",
};

export function CreatePlanModal({ onClose, onCreated }: Props) {
  const create = useCreatePlan();
  const [form, setForm] = useState<PlanFormState>(EMPTY_PLAN_FORM);
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !create.isPending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [create.isPending, onClose]);

  function update<K extends keyof PlanFormState>(key: K, val: PlanFormState[K]) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validatePlanForm(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    try {
      const planId = await create.mutateAsync(planFormToInput(form));
      toast.success("Plan angelegt.");
      onCreated?.(planId);
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(`Anlegen fehlgeschlagen: ${msg}`);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-plan-title"
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
          Neuer Plan
        </p>
        <h2
          id="create-plan-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          Plan anlegen
        </h2>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor="plan-title"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Titel <span style={{ color: "var(--color-accent)" }}>*</span>
            </label>
            <input
              id="plan-title"
              ref={titleRef}
              type="text"
              value={form.title}
              maxLength={120}
              onChange={(e) => update("title", e.target.value)}
              placeholder="z.B. Wettkampf-Vorbereitung 6 Wochen"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label
              htmlFor="plan-description"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Beschreibung
            </label>
            <textarea
              id="plan-description"
              value={form.description}
              maxLength={2000}
              rows={3}
              onChange={(e) => update("description", e.target.value)}
              placeholder="Kurze Notiz zur Plan-Idee, Ziel, Constraints …"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={form.is_template}
              onChange={(e) => update("is_template", e.target.checked)}
              className="h-4 w-4"
              style={{ accentColor: "var(--color-accent)" }}
            />
            <span className="text-sm" style={{ color: "var(--color-ink)" }}>
              Als Template speichern (kein Athlet zugewiesen)
            </span>
          </label>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="plan-starts-on"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Start
              </label>
              <input
                id="plan-starts-on"
                type="date"
                value={form.starts_on}
                onChange={(e) => update("starts_on", e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label
                htmlFor="plan-ends-on"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Ende
              </label>
              <input
                id="plan-ends-on"
                type="date"
                value={form.ends_on}
                onChange={(e) => update("ends_on", e.target.value)}
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
          </div>

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
              disabled={create.isPending}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={create.isPending}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "var(--color-on-night)",
              }}
            >
              {create.isPending ? "Lege an …" : "Plan anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
