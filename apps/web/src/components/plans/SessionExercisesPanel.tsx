import { useState } from "react";
import { toast } from "sonner";
import {
  useCreateExercise,
  useDeleteExercise,
  useSessionExercises,
  useSwapExercises,
  type PlanExercise,
} from "../../hooks/queries/usePlans";
import {
  EMPTY_EXERCISE_FORM,
  exerciseFormToInput,
  neighborForExerciseSwap,
  nextExercisePosition,
  summarizeExercise,
  validateExerciseForm,
  type ExerciseFormState,
} from "./exerciseForm.logic";
import { ConfirmDialog } from "../common/ConfirmDialog";

const PANEL_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper-elev)",
  border: "1px solid var(--line)",
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  color: "var(--color-ink)",
};

type Props = {
  sessionId: string;
};

export function SessionExercisesPanel({ sessionId }: Props) {
  const exercises = useSessionExercises(sessionId);
  const create = useCreateExercise();
  const del = useDeleteExercise();
  const swap = useSwapExercises();

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlanExercise | null>(null);

  const list = exercises.data ?? [];

  async function handleCreate(form: ExerciseFormState) {
    const input = exerciseFormToInput(form, sessionId, nextExercisePosition(list));
    try {
      await create.mutateAsync(input);
      toast.success("Uebung hinzugefuegt.");
      setAdding(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Anlegen fehlgeschlagen: ${msg}`);
    }
  }

  async function handleSwap(ex: PlanExercise, direction: "up" | "down") {
    const neighbor = neighborForExerciseSwap(list, ex, direction);
    if (!neighbor) return;
    try {
      await swap.mutateAsync({ session_id: sessionId, a: ex, b: neighbor });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Reihenfolge konnte nicht geaendert werden: ${msg}`);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync({ id: confirmDelete.id, session_id: sessionId });
      toast.success("Uebung geloescht.");
      setConfirmDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Loeschen fehlgeschlagen: ${msg}`);
      setConfirmDelete(null);
    }
  }

  return (
    <div className="mt-3 space-y-3 rounded-2xl p-3" style={PANEL_STYLE}>
      <div className="flex items-center justify-between">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Uebungen ({list.length})
        </p>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg px-3 py-1 text-xs"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            Hinzufuegen
          </button>
        )}
      </div>

      {exercises.isLoading && (
        <p role="status" className="text-xs" style={{ color: "var(--color-ink-3)" }}>
          Lade Uebungen …
        </p>
      )}
      {exercises.error && (
        <p role="alert" className="text-xs" style={{ color: "var(--color-accent-2)" }}>
          Uebungen konnten nicht geladen werden.
        </p>
      )}

      {adding && (
        <AddExerciseForm
          pending={create.isPending}
          onSubmit={(s) => void handleCreate(s)}
          onCancel={() => setAdding(false)}
        />
      )}

      {!exercises.isLoading && list.length === 0 && !adding && (
        <p className="text-xs" style={{ color: "var(--color-ink-3)" }}>
          Noch keine Uebung. Lege die erste an.
        </p>
      )}

      {list.length > 0 && (
        <ul role="list" className="space-y-2">
          {list.map((ex, idx) => (
            <ExerciseRow
              key={ex.id}
              exercise={ex}
              isFirst={idx === 0}
              isLast={idx === list.length - 1}
              busy={swap.isPending}
              onUp={() => void handleSwap(ex, "up")}
              onDown={() => void handleSwap(ex, "down")}
              onDelete={() => setConfirmDelete(ex)}
            />
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Uebung loeschen?"
        description={
          confirmDelete ? `"${confirmDelete.name}" wird aus der Session entfernt.` : ""
        }
        confirmLabel="Ja, loeschen"
        cancelLabel="Abbrechen"
        destructive
        pending={del.isPending}
        onCancel={() => setConfirmDelete(null)}
        onConfirm={() => void handleDelete()}
      />
    </div>
  );
}

type AddProps = {
  pending: boolean;
  onSubmit: (s: ExerciseFormState) => void;
  onCancel: () => void;
};

function AddExerciseForm({ pending, onSubmit, onCancel }: AddProps) {
  const [form, setForm] = useState<ExerciseFormState>(EMPTY_EXERCISE_FORM);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof ExerciseFormState>(key: K, val: ExerciseFormState[K]) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateExerciseForm(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="space-y-3">
      <div>
        <label
          htmlFor="ex-name"
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Name <span style={{ color: "var(--color-accent)" }}>*</span>
        </label>
        <input
          id="ex-name"
          type="text"
          value={form.name}
          maxLength={120}
          onChange={(e) => update("name", e.target.value)}
          placeholder="z.B. Bankdruecken"
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      </div>

      <div className="grid grid-cols-3 gap-2">
        <FieldNumber
          id="ex-sets"
          label="Saetze"
          value={form.sets}
          onChange={(v) => update("sets", v)}
          min={1}
          max={99}
          step={1}
        />
        <FieldNumber
          id="ex-reps"
          label="Wdh."
          value={form.reps}
          onChange={(v) => update("reps", v)}
          min={1}
          max={999}
          step={1}
        />
        <FieldNumber
          id="ex-weight"
          label="kg"
          value={form.weight_kg}
          onChange={(v) => update("weight_kg", v)}
          min={0}
          max={500}
          step={0.5}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <FieldNumber
          id="ex-duration"
          label="Dauer s"
          value={form.duration_sec}
          onChange={(v) => update("duration_sec", v)}
          min={0}
          max={36000}
          step={1}
        />
        <FieldNumber
          id="ex-rest"
          label="Pause s"
          value={form.rest_sec}
          onChange={(v) => update("rest_sec", v)}
          min={0}
          max={3600}
          step={1}
        />
      </div>

      <div>
        <label
          htmlFor="ex-notes"
          className="mb-1 block text-xs font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Notizen
        </label>
        <textarea
          id="ex-notes"
          value={form.notes}
          maxLength={2000}
          rows={2}
          onChange={(e) => update("notes", e.target.value)}
          className="w-full rounded-lg px-3 py-2 text-sm outline-none"
          style={INPUT_STYLE}
        />
      </div>

      {error && (
        <p role="alert" className="text-xs" style={{ color: "var(--color-accent-2)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={pending}
          className="rounded-lg px-3 py-1 text-xs disabled:opacity-40"
          style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
        >
          Abbrechen
        </button>
        <button
          type="submit"
          disabled={pending}
          className="rounded-lg px-3 py-1 text-xs disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-night)",
          }}
        >
          {pending ? "Lege an …" : "Uebung anlegen"}
        </button>
      </div>
    </form>
  );
}

type FieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
};

function FieldNumber({ id, label, value, onChange, min, max, step }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-xs"
        style={{ color: "var(--color-ink-3)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type="number"
        inputMode={step < 1 ? "decimal" : "numeric"}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-lg px-2 py-1 text-sm outline-none"
        style={INPUT_STYLE}
      />
    </div>
  );
}

type RowProps = {
  exercise: PlanExercise;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onDelete: () => void;
};

function ExerciseRow({
  exercise,
  isFirst,
  isLast,
  busy,
  onUp,
  onDown,
  onDelete,
}: RowProps) {
  const summary = summarizeExercise(exercise);
  return (
    <li
      className="flex items-start justify-between gap-2 rounded-lg p-2"
      style={{ backgroundColor: "var(--color-paper)", border: "1px solid var(--line)" }}
    >
      <div className="min-w-0 flex-1">
        <p
          className="truncate text-sm"
          style={{ color: "var(--color-ink)", fontWeight: 500 }}
        >
          {exercise.name}
        </p>
        {summary && (
          <p
            className="mt-0.5 text-xs tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            {summary}
          </p>
        )}
        {exercise.notes && (
          <p className="mt-1 text-xs" style={{ color: "var(--color-ink-2)" }}>
            {exercise.notes}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-0.5">
        <button
          type="button"
          onClick={onUp}
          disabled={isFirst || busy}
          aria-label={`Uebung ${exercise.name} nach oben`}
          className="rounded px-1.5 py-0.5 text-[10px] disabled:opacity-30"
          style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onDown}
          disabled={isLast || busy}
          aria-label={`Uebung ${exercise.name} nach unten`}
          className="rounded px-1.5 py-0.5 text-[10px] disabled:opacity-30"
          style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onDelete}
          aria-label={`Uebung ${exercise.name} loeschen`}
          className="rounded px-1.5 py-0.5 text-[10px]"
          style={{
            border: "1px solid var(--line-2)",
            color: "var(--color-accent-2)",
          }}
        >
          ✕
        </button>
      </div>
    </li>
  );
}
