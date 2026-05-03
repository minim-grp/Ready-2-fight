import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  useCreateCompetition,
  useUpdateCompetition,
  type Competition,
} from "../../hooks/queries/useCompetitions";
import {
  EMPTY_COMPETITION_FORM,
  competitionFormToInput,
  hydrateCompetitionForm,
  validateCompetitionForm,
  type CompetitionFormState,
} from "./competitionForm.logic";

type Props = {
  initial: Competition | null;
  onClose: () => void;
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper-elev)",
  border: "1px solid var(--line)",
  color: "var(--color-ink)",
};

export function CompetitionFormModal({ initial, onClose }: Props) {
  const create = useCreateCompetition();
  const update = useUpdateCompetition();
  const [form, setForm] = useState<CompetitionFormState>(() =>
    initial ? hydrateCompetitionForm(initial) : EMPTY_COMPETITION_FORM,
  );
  const [error, setError] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement | null>(null);

  const isEdit = initial !== null;
  const pending = create.isPending || update.isPending;

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !pending) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  function update_<K extends keyof CompetitionFormState>(
    key: K,
    val: CompetitionFormState[K],
  ) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateCompetitionForm(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    const input = competitionFormToInput(form);
    try {
      if (isEdit && initial) {
        await update.mutateAsync({ id: initial.id, patch: input });
        toast.success("Wettkampf aktualisiert.");
      } else {
        await create.mutateAsync(input);
        toast.success("Wettkampf angelegt.");
      }
      onClose();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      setError(`Speichern fehlgeschlagen: ${msg}`);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="competition-form-title"
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
          {isEdit ? "Wettkampf bearbeiten" : "Neuer Wettkampf"}
        </p>
        <h2
          id="competition-form-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {isEdit ? form.title || "Wettkampf" : "Wettkampf anlegen"}
        </h2>

        <form
          onSubmit={(e) => void handleSubmit(e)}
          noValidate
          className="mt-5 space-y-4"
        >
          <div>
            <label
              htmlFor="comp-title"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Titel <span style={{ color: "var(--color-accent)" }}>*</span>
            </label>
            <input
              id="comp-title"
              ref={titleRef}
              type="text"
              value={form.title}
              maxLength={120}
              onChange={(e) => update_("title", e.target.value)}
              placeholder="z.B. Bayerische Meisterschaft"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label
              htmlFor="comp-date"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Datum <span style={{ color: "var(--color-accent)" }}>*</span>
            </label>
            <input
              id="comp-date"
              type="date"
              value={form.competition_date}
              onChange={(e) => update_("competition_date", e.target.value)}
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label
                htmlFor="comp-discipline"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Disziplin
              </label>
              <input
                id="comp-discipline"
                type="text"
                value={form.discipline}
                maxLength={200}
                onChange={(e) => update_("discipline", e.target.value)}
                placeholder="Boxen, Kickboxen …"
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label
                htmlFor="comp-weight"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Gewichtsklasse
              </label>
              <input
                id="comp-weight"
                type="text"
                value={form.weight_class}
                maxLength={200}
                onChange={(e) => update_("weight_class", e.target.value)}
                placeholder="-72 kg"
                className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="comp-location"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Ort
            </label>
            <input
              id="comp-location"
              type="text"
              value={form.location}
              maxLength={200}
              onChange={(e) => update_("location", e.target.value)}
              placeholder="Muenchen"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label
              htmlFor="comp-result"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Ergebnis
            </label>
            <input
              id="comp-result"
              type="text"
              value={form.result}
              maxLength={200}
              onChange={(e) => update_("result", e.target.value)}
              placeholder="Sieg KO Runde 2 …"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
          </div>

          <div>
            <label
              htmlFor="comp-notes"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
            >
              Notizen
            </label>
            <textarea
              id="comp-notes"
              value={form.notes}
              maxLength={2000}
              rows={3}
              onChange={(e) => update_("notes", e.target.value)}
              placeholder="Vorbereitung, Eindruecke …"
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={INPUT_STYLE}
            />
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
              disabled={pending}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "var(--color-on-night)",
              }}
            >
              {pending ? "Speichere …" : isEdit ? "Aktualisieren" : "Anlegen"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
