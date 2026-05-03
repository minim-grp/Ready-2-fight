import { useState } from "react";
import { Navigate } from "react-router-dom";
import { toast } from "sonner";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import {
  useCompetitions,
  useDeleteCompetition,
  type Competition,
} from "../hooks/queries/useCompetitions";
import { CompetitionFormModal } from "../components/competitions/CompetitionFormModal";
import { ConfirmDialog } from "../components/common/ConfirmDialog";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function CompetitionsPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isAthleteView = role === "athlete" || (role === "both" && mode === "athlete");

  const competitions = useCompetitions();
  const del = useDeleteCompetition();

  const [editing, setEditing] = useState<Competition | null>(null);
  const [creating, setCreating] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Competition | null>(null);

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

  async function handleDelete() {
    if (!confirmDelete) return;
    try {
      await del.mutateAsync(confirmDelete.id);
      toast.success("Wettkampf geloescht.");
      setConfirmDelete(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Loeschen fehlgeschlagen: ${msg}`);
      setConfirmDelete(null);
    }
  }

  const all = competitions.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = all.filter((c) => c.competition_date >= today);
  const past = all.filter((c) => c.competition_date < today);

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p
            className="text-xs tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            Mein Profil · Wettkaempfe
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
          Neuer Wettkampf
        </button>
      </header>

      {competitions.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Wettkaempfe …
        </p>
      )}

      {competitions.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Wettkaempfe konnten nicht geladen werden.
        </p>
      )}

      {!competitions.isLoading && !competitions.error && all.length === 0 && (
        <div className="rounded-[22px] p-6" style={CARD_STYLE}>
          <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
            Noch kein Wettkampf eingetragen. Trage deinen naechsten Wettkampf ein, um den
            Ueberblick zu behalten — Coaches mit Tracking-Permission sehen ihn auch.
          </p>
        </div>
      )}

      {upcoming.length > 0 && (
        <CompSection
          label="Anstehend"
          rows={upcoming}
          onEdit={setEditing}
          onDelete={setConfirmDelete}
        />
      )}
      {past.length > 0 && (
        <CompSection
          label="Vergangen"
          rows={past}
          onEdit={setEditing}
          onDelete={setConfirmDelete}
        />
      )}

      {(creating || editing) && (
        <CompetitionFormModal
          initial={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        title="Wettkampf loeschen?"
        description={
          confirmDelete
            ? `"${confirmDelete.title}" am ${confirmDelete.competition_date} wird geloescht.`
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

type SectionProps = {
  label: string;
  rows: Competition[];
  onEdit: (c: Competition) => void;
  onDelete: (c: Competition) => void;
};

function CompSection({ label, rows, onEdit, onDelete }: SectionProps) {
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
          <CompCard key={c.id} comp={c} onEdit={onEdit} onDelete={onDelete} />
        ))}
      </ul>
    </div>
  );
}

type CardProps = {
  comp: Competition;
  onEdit: (c: Competition) => void;
  onDelete: (c: Competition) => void;
};

function CompCard({ comp, onEdit, onDelete }: CardProps) {
  const subtitle = [comp.discipline, comp.weight_class].filter(Boolean).join(" · ");
  return (
    <li className="rounded-[22px] p-5" style={CARD_STYLE}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
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
        </div>
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={() => onEdit(comp)}
            aria-label={`Wettkampf ${comp.title} bearbeiten`}
            className="rounded-2xl px-3 py-2 text-xs"
            style={{
              border: "1px solid var(--line-2)",
              color: "var(--color-ink-2)",
              backgroundColor: "transparent",
            }}
          >
            Bearbeiten
          </button>
          <button
            type="button"
            onClick={() => onDelete(comp)}
            aria-label={`Wettkampf ${comp.title} loeschen`}
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
