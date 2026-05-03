import { toast } from "sonner";
import {
  useAthleteSessionExercises,
  useToggleSessionCompletion,
  type AthletePlanSession,
  type SessionCompletion,
} from "../../hooks/queries/useAthletePlans";

type Props = {
  planId: string;
  session: AthletePlanSession;
  completion: SessionCompletion | undefined;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function AthleteSessionCard({ planId, session, completion }: Props) {
  const exercises = useAthleteSessionExercises(session.id);
  const toggle = useToggleSessionCompletion(planId);
  const done = completion !== undefined;

  async function handleToggle() {
    try {
      await toggle.mutateAsync({
        session_id: session.id,
        completion_id: completion?.id ?? null,
      });
      toast.success(done ? "Session zurueckgesetzt." : "Session abgehakt. +30 XP");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      toast.error(`Aenderung fehlgeschlagen: ${msg}`);
    }
  }

  return (
    <li className="rounded-[22px] p-5" style={{ ...CARD_STYLE, opacity: done ? 0.7 : 1 }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p
            className="text-xs tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            Tag {session.day_offset + 1}
          </p>
          <h3
            className="mt-1 truncate"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.125rem",
              letterSpacing: "-0.01em",
              color: "var(--color-ink)",
            }}
          >
            {session.title}
          </h3>
          {session.notes && (
            <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
              {session.notes}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void handleToggle()}
          disabled={toggle.isPending}
          aria-pressed={done}
          aria-label={
            done
              ? `Session ${session.title} zuruecksetzen`
              : `Session ${session.title} abhaken`
          }
          className="rounded-2xl px-4 py-2 text-xs disabled:opacity-40"
          style={{
            border: done ? "1px solid var(--color-accent)" : "1px solid var(--line-2)",
            color: done ? "var(--color-accent)" : "var(--color-ink-2)",
            backgroundColor: "transparent",
          }}
        >
          {toggle.isPending ? "…" : done ? "Erledigt ✓" : "Abhaken"}
        </button>
      </div>

      {exercises.isLoading && (
        <p role="status" className="mt-3 text-xs" style={{ color: "var(--color-ink-3)" }}>
          Lade Uebungen …
        </p>
      )}
      {exercises.error && (
        <p
          role="alert"
          className="mt-3 text-xs"
          style={{ color: "var(--color-accent-2)" }}
        >
          Uebungen konnten nicht geladen werden.
        </p>
      )}
      {!exercises.isLoading &&
        !exercises.error &&
        (exercises.data ?? []).length === 0 && (
          <p className="mt-3 text-xs" style={{ color: "var(--color-ink-3)" }}>
            Keine Uebungen hinterlegt.
          </p>
        )}
      {(exercises.data ?? []).length > 0 && (
        <ul role="list" className="mt-3 space-y-1">
          {(exercises.data ?? []).map((ex) => (
            <li key={ex.id} className="text-sm" style={{ color: "var(--color-ink-2)" }}>
              <span style={{ color: "var(--color-ink)" }}>{ex.name}</span>
              {formatExerciseDetail(ex.sets, ex.reps, ex.weight_kg, ex.duration_sec)}
              {ex.notes && (
                <span className="ml-2" style={{ color: "var(--color-ink-3)" }}>
                  · {ex.notes}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function formatExerciseDetail(
  sets: number | null,
  reps: number | null,
  weightKg: number | null,
  durationSec: number | null,
): string {
  const parts: string[] = [];
  if (sets != null && reps != null) parts.push(`${sets} × ${reps}`);
  else if (reps != null) parts.push(`${reps} Wdh`);
  else if (sets != null) parts.push(`${sets} Saetze`);
  if (weightKg != null) parts.push(`${weightKg} kg`);
  if (durationSec != null) parts.push(`${durationSec}s`);
  return parts.length > 0 ? ` · ${parts.join(" · ")}` : "";
}
