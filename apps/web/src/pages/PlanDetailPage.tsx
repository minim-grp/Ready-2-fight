import { useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import {
  useCreateSession,
  useDeleteSession,
  usePlan,
  useSwapSessions,
  useUpdateSession,
  type PlanSession,
} from "../hooks/queries/usePlans";
import {
  EMPTY_SESSION_FORM,
  nextSessionPosition,
  neighborForSwap,
  sessionFormToInput,
  validateSessionForm,
  type SessionFormState,
} from "../components/plans/sessionForm.logic";
import { ConfirmDialog } from "../components/common/ConfirmDialog";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper-elev)",
  border: "1px solid var(--line)",
  color: "var(--color-ink)",
};

// ASSUMPTION: §1.20 PRD verlangt Drag&Drop fuer Reihenfolge. Up/Down-Buttons
// sind mobile-first und a11y-besser; klassisches Drag&Drop kann in einem
// Polish-PR nachgezogen werden, falls UX es verlangt.
export function PlanDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isCoachView = role === "coach" || (role === "both" && mode === "coach");

  const plan = usePlan(id);
  const create = useCreateSession();
  const update = useUpdateSession();
  const del = useDeleteSession();
  const swap = useSwapSessions();

  const [adding, setAdding] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<PlanSession | null>(null);

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
  if (!id) {
    return <Navigate to="/app/plans" replace />;
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
      <section className="space-y-3">
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Plan nicht gefunden.
        </p>
        <Link
          to="/app/plans"
          className="inline-block rounded-2xl px-4 py-2 text-sm"
          style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
        >
          Zurueck zur Plan-Liste
        </Link>
      </section>
    );
  }

  const planRow = plan.data;
  const sessions = planRow.sessions;

  async function handleCreateSession(state: SessionFormState) {
    const input = sessionFormToInput(state, planRow.id, nextSessionPosition(sessions));
    try {
      await create.mutateAsync(input);
      toast.success("Session angelegt.");
      setAdding(false);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Anlegen fehlgeschlagen: ${msg}`);
    }
  }

  async function handleUpdateTitle(session: PlanSession, title: string) {
    if (title.trim() === session.title) return;
    try {
      await update.mutateAsync({
        id: session.id,
        plan_id: planRow.id,
        title: title.trim(),
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Speichern fehlgeschlagen: ${msg}`);
    }
  }

  async function handleSwap(session: PlanSession, direction: "up" | "down") {
    const neighbor = neighborForSwap(sessions, session, direction);
    if (!neighbor) return;
    try {
      await swap.mutateAsync({ plan_id: planRow.id, a: session, b: neighbor });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Reihenfolge konnte nicht geaendert werden: ${msg}`);
    }
  }

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync({ id: confirmDelete.id, plan_id: planRow.id });
      toast.success("Session geloescht.");
      setConfirmDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Loeschen fehlgeschlagen: ${msg}`);
      setConfirmDelete(null);
    }
  }

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {planRow.is_template
            ? "Template"
            : planRow.athlete_name
              ? `Athlet: ${planRow.athlete_name}`
              : "Plan"}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {planRow.title}
        </h1>
        {planRow.description && (
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            {planRow.description}
          </p>
        )}
      </header>

      <div className="flex items-center justify-between">
        <h2
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Sessions ({sessions.length})
        </h2>
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-2xl px-4 py-2 text-sm font-medium"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            Session hinzufuegen
          </button>
        )}
      </div>

      {adding && (
        <AddSessionForm
          pending={create.isPending}
          onSubmit={(s) => void handleCreateSession(s)}
          onCancel={() => setAdding(false)}
        />
      )}

      {sessions.length === 0 && !adding && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Noch keine Sessions. Lege die erste Session an, dann fuege Uebungen hinzu.
          </p>
        </div>
      )}

      {sessions.length > 0 && (
        <ul role="list" className="space-y-3">
          {sessions.map((s, idx) => (
            <SessionRow
              key={s.id}
              session={s}
              isFirst={idx === 0}
              isLast={idx === sessions.length - 1}
              busy={swap.isPending || update.isPending}
              onUp={() => void handleSwap(s, "up")}
              onDown={() => void handleSwap(s, "down")}
              onSaveTitle={(title) => void handleUpdateTitle(s, title)}
              onDelete={() => setConfirmDelete(s)}
            />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => void navigate("/app/plans")}
        className="rounded-2xl px-4 py-2 text-sm"
        style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
      >
        Zurueck zur Plan-Liste
      </button>

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Session loeschen?"
        description={
          confirmDelete
            ? `"${confirmDelete.title}" und alle dazugehoerigen Uebungen werden geloescht.`
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

type AddSessionFormProps = {
  pending: boolean;
  onSubmit: (s: SessionFormState) => void;
  onCancel: () => void;
};

function AddSessionForm({ pending, onSubmit, onCancel }: AddSessionFormProps) {
  const [form, setForm] = useState<SessionFormState>(EMPTY_SESSION_FORM);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof SessionFormState>(key: K, val: SessionFormState[K]) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = validateSessionForm(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    onSubmit(form);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="space-y-4 rounded-[22px] p-5"
      style={CARD_STYLE}
    >
      <div>
        <label
          htmlFor="session-title"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Titel <span style={{ color: "var(--color-accent)" }}>*</span>
        </label>
        <input
          id="session-title"
          type="text"
          value={form.title}
          maxLength={120}
          onChange={(e) => update("title", e.target.value)}
          placeholder="z.B. Kraft Oberkoerper"
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label
          htmlFor="session-day-offset"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Tag (relativ zum Plan-Start)
        </label>
        <input
          id="session-day-offset"
          type="number"
          inputMode="numeric"
          min={0}
          max={365}
          step={1}
          value={form.day_offset}
          onChange={(e) => update("day_offset", e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={INPUT_STYLE}
        />
      </div>

      <div>
        <label
          htmlFor="session-notes"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Notizen
        </label>
        <textarea
          id="session-notes"
          value={form.notes}
          maxLength={2000}
          rows={2}
          onChange={(e) => update("notes", e.target.value)}
          className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
          style={INPUT_STYLE}
        />
      </div>

      {error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
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
          {pending ? "Lege an …" : "Session anlegen"}
        </button>
      </div>
    </form>
  );
}

type SessionRowProps = {
  session: PlanSession;
  isFirst: boolean;
  isLast: boolean;
  busy: boolean;
  onUp: () => void;
  onDown: () => void;
  onSaveTitle: (title: string) => void;
  onDelete: () => void;
};

function SessionRow({
  session,
  isFirst,
  isLast,
  busy,
  onUp,
  onDown,
  onSaveTitle,
  onDelete,
}: SessionRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(session.title);

  function commit() {
    setEditing(false);
    if (draft.trim() && draft.trim() !== session.title) {
      onSaveTitle(draft);
    } else {
      setDraft(session.title);
    }
  }

  return (
    <li className="rounded-[22px] p-5" style={CARD_STYLE}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs tracking-[0.18em] uppercase tabular-nums"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            Tag {session.day_offset}
          </p>
          {editing ? (
            <input
              type="text"
              autoFocus
              value={draft}
              maxLength={120}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") commit();
                if (e.key === "Escape") {
                  setDraft(session.title);
                  setEditing(false);
                }
              }}
              className="mt-1 w-full rounded-md px-2 py-1 text-base outline-none"
              style={INPUT_STYLE}
              aria-label="Session-Titel bearbeiten"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 truncate text-left"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.125rem",
                letterSpacing: "-0.01em",
                color: "var(--color-ink)",
                background: "transparent",
                border: "none",
                padding: 0,
                cursor: "pointer",
              }}
              aria-label={`Session ${session.title} bearbeiten`}
            >
              {session.title}
            </button>
          )}
          {session.notes && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
              {session.notes}
            </p>
          )}
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={onUp}
            disabled={isFirst || busy}
            aria-label={`Session ${session.title} nach oben`}
            className="rounded-lg px-2 py-1 text-xs disabled:opacity-30"
            style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
          >
            ↑
          </button>
          <button
            type="button"
            onClick={onDown}
            disabled={isLast || busy}
            aria-label={`Session ${session.title} nach unten`}
            className="rounded-lg px-2 py-1 text-xs disabled:opacity-30"
            style={{ border: "1px solid var(--line-2)", color: "var(--color-ink-2)" }}
          >
            ↓
          </button>
          <button
            type="button"
            onClick={onDelete}
            aria-label={`Session ${session.title} loeschen`}
            className="rounded-lg px-2 py-1 text-xs"
            style={{
              border: "1px solid var(--line-2)",
              color: "var(--color-accent-2)",
            }}
          >
            ✕
          </button>
        </div>
      </div>
    </li>
  );
}
