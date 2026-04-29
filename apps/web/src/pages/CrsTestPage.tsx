import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { DisclaimerStep } from "../components/crs/DisclaimerStep";
import { RecoveryPrompt } from "../components/crs/RecoveryPrompt";
import { LiveTimerStep } from "../components/crs/LiveTimerStep";
import { ExerciseInputStep } from "../components/crs/ExerciseInputStep";
import { ResultStep } from "../components/crs/ResultStep";
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
  type CrsExerciseKey,
  getCrsExercise,
  getCrsWarmupHint,
  nextStep,
  type CrsStep,
} from "../lib/crsTest";
import {
  clearCrsRecovery,
  loadCrsRecovery,
  newCrsClientUuid,
  saveCrsRecovery,
} from "../lib/crsRecovery";
import { logger } from "../lib/logger";

type Mode = "fresh" | "recovery-prompt" | "active";

export function CrsTestPage() {
  const navigate = useNavigate();
  const start = useStartCrsTest();
  const save = useSaveCrsExercise();
  const complete = useCompleteCrsTest();
  const abort = useAbortCrsTest();

  const [step, setStep] = useState<CrsStep>({ kind: "disclaimer" });
  const [testId, setTestId] = useState<string | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [clientUuid, setClientUuid] = useState<string>(() => newCrsClientUuid());
  const [mode, setMode] = useState<Mode>("fresh");
  const [resuming, setResuming] = useState(false);
  const [raws, setRaws] = useState<Partial<Record<CrsExerciseKey, number>>>({});

  useEffect(() => {
    const recovered = loadCrsRecovery();
    if (recovered && recovered.testId !== null && recovered.step.kind !== "disclaimer") {
      setMode("recovery-prompt");
      setClientUuid(recovered.clientUuid);
      setStep(recovered.step);
      setTestId(recovered.testId);
      setAccepted(recovered.accepted);
    }
  }, []);

  useEffect(() => {
    if (mode !== "active" || !testId) return;
    if (step.kind === "result") {
      clearCrsRecovery();
      return;
    }
    saveCrsRecovery({ clientUuid, testId, step, accepted });
  }, [mode, step, testId, accepted, clientUuid]);

  function advance() {
    setStep((s) => nextStep(s));
  }

  async function handleStart() {
    try {
      const id = await start.mutateAsync(clientUuid);
      setTestId(id);
      setMode("active");
      advance();
    } catch (err) {
      logger.error("crs_start_failed", err);
      toast.error("Test konnte nicht gestartet werden.");
    }
  }

  async function handleResume() {
    setResuming(true);
    try {
      const id = await start.mutateAsync(clientUuid);
      setTestId(id);
      setMode("active");
    } catch (err) {
      logger.error("crs_resume_failed", err);
      toast.error("Wiederaufnahme fehlgeschlagen. Bitte neu starten.");
      handleDiscardRecovery();
    } finally {
      setResuming(false);
    }
  }

  function handleDiscardRecovery() {
    clearCrsRecovery();
    setStep({ kind: "disclaimer" });
    setTestId(null);
    setAccepted(false);
    setClientUuid(newCrsClientUuid());
    setRaws({});
    setMode("fresh");
  }

  async function handleAbort() {
    if (!testId) {
      clearCrsRecovery();
      void navigate("/app/dashboard");
      return;
    }
    if (!window.confirm("Test wirklich abbrechen? Deine Werte gehen verloren.")) return;
    try {
      await abort.mutateAsync(testId);
      clearCrsRecovery();
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
      setRaws((r) => ({ ...r, [exercise.key]: value }));
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
        <div className="space-y-1">
          <p
            className="text-xs tracking-[0.18em] uppercase"
            style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
          >
            CRS · 5 Uebungen · 60 s
          </p>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2rem",
              letterSpacing: "-0.02em",
              color: "var(--color-ink)",
            }}
          >
            Fitnesstest
          </h1>
        </div>
        {mode === "active" && step.kind !== "result" && (
          <button
            type="button"
            onClick={() => void handleAbort()}
            className="text-xs tracking-[0.18em] uppercase"
            style={{
              fontFamily: "var(--font-mono)",
              color: "var(--color-accent-2)",
            }}
          >
            Abbrechen
          </button>
        )}
      </header>

      {mode === "recovery-prompt" && (
        <RecoveryPrompt
          step={step}
          onResume={() => void handleResume()}
          onDiscard={handleDiscardRecovery}
          pending={resuming || start.isPending}
        />
      )}

      {mode !== "recovery-prompt" && step.kind === "disclaimer" && (
        <DisclaimerStep
          accepted={accepted}
          onAcceptedChange={setAccepted}
          onStart={() => void handleStart()}
          pending={start.isPending}
        />
      )}

      {mode === "active" && step.kind === "warmup" && (
        <LiveTimerStep
          key={`warmup-${step.round}`}
          title={`Warm-up ${step.round + 1} / 3`}
          hint={getCrsWarmupHint(step.round)}
          durationSeconds={CRS_WARMUP_ROUND_DURATION_S}
          onDone={advance}
          ctaLabel="Ueberspringen"
        />
      )}

      {mode === "active" && step.kind === "exercise" && step.phase === "countdown" && (
        <LiveTimerStep
          key={`exercise-${step.index}`}
          title={`Uebung ${step.index + 1} / 5 – ${getCrsExercise(step.index).label}`}
          hint={`Los! ${getCrsExercise(step.index).unit}. Zaehle fuer dich selbst mit.`}
          durationSeconds={CRS_EXERCISE_DURATION_S}
          onDone={advance}
          ctaLabel="Fertig, Wert eingeben"
        />
      )}

      {mode === "active" && step.kind === "exercise" && step.phase === "input" && (
        <ExerciseInputStep
          label={getCrsExercise(step.index).label}
          unit={getCrsExercise(step.index).unit}
          max={getCrsExercise(step.index).maxValue}
          pending={save.isPending}
          onSubmit={(v) => void handleSubmitExercise(v)}
        />
      )}

      {mode === "active" && step.kind === "cooldown" && (
        <LiveTimerStep
          key="cooldown"
          title="Cool-down"
          hint="Ruhig ausatmen, locker gehen. 2 Minuten Erholung."
          durationSeconds={CRS_COOLDOWN_DURATION_S}
          onDone={() => void handleCooldownDone()}
          ctaLabel="Test abschliessen"
        />
      )}

      {step.kind === "result" && (
        <ResultStep raws={raws} onBack={() => void navigate("/app/dashboard")} />
      )}
    </section>
  );
}
