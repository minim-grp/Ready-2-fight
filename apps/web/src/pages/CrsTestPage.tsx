import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import {
  useAbortCrsTest,
  useCompleteCrsTest,
  useSaveCrsExercise,
  useStartCrsTest,
} from "../hooks/queries/useCrsTest";
import {
  CRS_COOLDOWN_DURATION_S,
  CRS_EXERCISE_DURATION_S,
  CRS_WARMUP_ROUND_DURATION_S,
  getCrsExercise,
  getCrsWarmupHint,
  nextStep,
  type CrsStep,
} from "../lib/crsTest";
import { logger } from "../lib/logger";

export function CrsTestPage() {
  const navigate = useNavigate();
  const start = useStartCrsTest();
  const save = useSaveCrsExercise();
  const complete = useCompleteCrsTest();
  const abort = useAbortCrsTest();

  const [step, setStep] = useState<CrsStep>({ kind: "disclaimer" });
  const [testId, setTestId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);

  function advance() {
    setStep((s) => nextStep(s));
  }

  async function handleStart() {
    try {
      const id = await start.mutateAsync(undefined);
      setTestId(id);
      advance();
    } catch (err) {
      logger.error("crs_start_failed", err);
      toast.error("Test konnte nicht gestartet werden.");
    }
  }

  async function handleAbort() {
    if (!testId) {
      void navigate("/app/dashboard");
      return;
    }
    if (!window.confirm("Test wirklich abbrechen? Deine Werte gehen verloren.")) return;
    try {
      await abort.mutateAsync(testId);
      void navigate("/app/dashboard");
    } catch (err) {
      logger.error("crs_abort_failed", err);
      toast.error("Abbruch fehlgeschlagen.");
    }
  }

  async function handleSubmitExercise(value: number) {
    if (step.kind !== "exercise" || !testId) return;
    const exercise = getCrsExercise(step.index);
    try {
      await save.mutateAsync({ testId, exercise: exercise.key, value });
      advance();
    } catch (err) {
      logger.error("crs_save_failed", err);
      toast.error("Wert konnte nicht gespeichert werden.");
    }
  }

  async function handleCooldownDone() {
    if (!testId) return;
    try {
      await complete.mutateAsync(testId);
      advance();
    } catch (err) {
      logger.error("crs_complete_failed", err);
      toast.error("Test konnte nicht abgeschlossen werden.");
    }
  }

  return (
    <section className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">CRS-Fitnesstest</h1>
          <p className="text-sm text-slate-400">
            Standardisierter Test: 5 Uebungen a 60 Sekunden. PRD §06.
          </p>
        </div>
        {step.kind !== "disclaimer" && step.kind !== "result" && (
          <button
            type="button"
            onClick={() => void handleAbort()}
            className="text-sm text-red-400 underline"
          >
            Abbrechen
          </button>
        )}
      </header>

      {step.kind === "disclaimer" && (
        <DisclaimerStep
          accepted={accepted}
          onAcceptedChange={setAccepted}
          onStart={() => void handleStart()}
          pending={start.isPending}
        />
      )}

      {step.kind === "warmup" && (
        <TimerStep
          key={`warmup-${step.round}`}
          title={`Warm-up ${step.round + 1} / 3`}
          hint={getCrsWarmupHint(step.round)}
          durationSeconds={CRS_WARMUP_ROUND_DURATION_S}
          onDone={advance}
          ctaLabel="Ueberspringen"
        />
      )}

      {step.kind === "exercise" && step.phase === "countdown" && (
        <TimerStep
          key={`exercise-${step.index}`}
          title={`Uebung ${step.index + 1} / 5 – ${getCrsExercise(step.index).label}`}
          hint={`Los! ${getCrsExercise(step.index).unit}. Zaehle fuer dich selbst mit.`}
          durationSeconds={CRS_EXERCISE_DURATION_S}
          onDone={advance}
          ctaLabel="Fertig, Wert eingeben"
        />
      )}

      {step.kind === "exercise" && step.phase === "input" && (
        <ExerciseInputStep
          label={getCrsExercise(step.index).label}
          unit={getCrsExercise(step.index).unit}
          max={getCrsExercise(step.index).maxValue}
          pending={save.isPending}
          onSubmit={(v) => void handleSubmitExercise(v)}
        />
      )}

      {step.kind === "cooldown" && (
        <TimerStep
          key="cooldown"
          title="Cool-down"
          hint="Ruhig ausatmen, locker gehen. 2 Minuten Erholung."
          durationSeconds={CRS_COOLDOWN_DURATION_S}
          onDone={() => void handleCooldownDone()}
          ctaLabel="Test abschliessen"
        />
      )}

      {step.kind === "result" && (
        <ResultStep onBack={() => void navigate("/app/dashboard")} />
      )}
    </section>
  );
}

type DisclaimerProps = {
  accepted: boolean;
  onAcceptedChange: (v: boolean) => void;
  onStart: () => void;
  pending: boolean;
};

function DisclaimerStep({
  accepted,
  onAcceptedChange,
  onStart,
  pending,
}: DisclaimerProps) {
  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Gesundheits-Hinweis</h2>
      <p className="text-sm text-slate-300">
        Der CRS-Test fordert deinen Koerper voll. Brich sofort ab, wenn du Schmerzen,
        Schwindel oder Engegefuehl in der Brust verspuerst. Bei Vorerkrankungen sprich
        vorher mit einer aerztlichen Fachkraft.
      </p>
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => onAcceptedChange(e.target.checked)}
        />
        <span>Ich fuehle mich gesundheitlich fit fuer einen fordernden Fitnesstest.</span>
      </label>
      <button
        type="button"
        disabled={!accepted || pending}
        onClick={onStart}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
      >
        {pending ? "Starte …" : "Test starten"}
      </button>
    </div>
  );
}

type TimerProps = {
  title: string;
  hint: string;
  durationSeconds: number;
  onDone: () => void;
  ctaLabel: string;
};

function TimerStep({ title, hint, durationSeconds, onDone, ctaLabel }: TimerProps) {
  const [remaining, setRemaining] = useState(durationSeconds);
  const doneRef = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => {
      setRemaining((r) => (r > 0 ? r - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (remaining === 0 && !doneRef.current) {
      doneRef.current = true;
      onDone();
    }
  }, [remaining, onDone]);

  const mm = Math.floor(remaining / 60)
    .toString()
    .padStart(2, "0");
  const ss = (remaining % 60).toString().padStart(2, "0");

  return (
    <div className="space-y-4 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="text-sm text-slate-300">{hint}</p>
      <p className="font-mono text-5xl text-amber-400 tabular-nums" aria-live="polite">
        {mm}:{ss}
      </p>
      <button
        type="button"
        onClick={onDone}
        className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
      >
        {ctaLabel}
      </button>
    </div>
  );
}

type ExerciseInputProps = {
  label: string;
  unit: string;
  max: number;
  pending: boolean;
  onSubmit: (value: number) => void;
};

function ExerciseInputStep({ label, unit, max, pending, onSubmit }: ExerciseInputProps) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n) || n < 0) {
      setError("Bitte eine Zahl >= 0 eingeben.");
      return;
    }
    if (n > max) {
      setError(`Wert ueber plausibler Obergrenze (max. ${max}).`);
      return;
    }
    setError(null);
    onSubmit(n);
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">{label} – Wert eintragen</h2>
      <label className="block text-sm text-slate-300">
        {unit}
        <input
          type="number"
          inputMode="numeric"
          value={raw}
          onChange={(e) => setRaw(e.target.value)}
          className="mt-1 block w-32 rounded border border-slate-700 bg-slate-950 px-2 py-1 text-slate-100"
          min={0}
          max={max}
        />
      </label>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        disabled={pending || raw === ""}
        onClick={handleSubmit}
        className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 disabled:opacity-50"
      >
        {pending ? "Speichere …" : "Weiter"}
      </button>
    </div>
  );
}

type ResultProps = { onBack: () => void };

function ResultStep({ onBack }: ResultProps) {
  return (
    <div className="space-y-3 rounded-lg border border-slate-800 bg-slate-900 p-5">
      <h2 className="text-lg font-semibold">Test gespeichert</h2>
      <p className="text-sm text-slate-300">
        Deine fuenf Uebungen sind erfasst. Rang, Radar-Chart und Archetyp folgen im
        naechsten Schritt der Roadmap (Score-Berechnung §1.17, Result-Screen §1.18).
      </p>
      <button
        type="button"
        onClick={onBack}
        className="rounded border border-slate-700 px-3 py-1.5 text-sm text-slate-200"
      >
        Zum Dashboard
      </button>
    </div>
  );
}
