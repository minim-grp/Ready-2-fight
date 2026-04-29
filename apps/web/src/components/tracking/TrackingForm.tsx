import { useState } from "react";
import { toast } from "sonner";
import {
  useTodayTracking,
  useUpsertTodayTracking,
  type DailyTracking,
} from "../../hooks/queries/useDailyTracking";
import { useOnlineStatus } from "../../hooks/useOnlineStatus";
import { logger } from "../../lib/logger";
import { Segmented } from "./Segmented";
import { MoodEmojiStrip } from "./MoodEmojiStrip";
import {
  ACTIVITY_OPTIONS,
  QUALITY_OPTIONS,
  hydrateTrackingForm,
  trackingFormToInput,
  validateTrackingForm,
  type TrackingFormState,
} from "./trackingForm.logic";

const FORM_CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

const INPUT_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper-elev)",
  border: "1px solid var(--line)",
  color: "var(--color-ink)",
};

export function TrackingForm() {
  const q = useTodayTracking();
  const isOnline = useOnlineStatus();

  if (q.isLoading)
    return (
      <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Lade heutigen Eintrag …
      </p>
    );
  if (q.error && isOnline)
    return (
      <p className="text-sm" style={{ color: "var(--color-accent-2)" }}>
        Heutiger Eintrag konnte nicht geladen werden.
      </p>
    );

  return <TrackingFormInner initial={q.data ?? null} />;
}

type InnerProps = { initial: DailyTracking | null };

function TrackingFormInner({ initial }: InnerProps) {
  const upsert = useUpsertTodayTracking();
  const [form, setForm] = useState<TrackingFormState>(() => hydrateTrackingForm(initial));
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof TrackingFormState>(key: K, val: TrackingFormState[K]) {
    setForm((s) => ({ ...s, [key]: val }));
  }

  async function handleSubmit() {
    const err = validateTrackingForm(form);
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    try {
      const result = await upsert.mutateAsync(trackingFormToInput(form));
      if (result.queuedOffline) {
        toast.success("Offline gespeichert. Sync bei Reconnect.");
      } else {
        toast.success("Gespeichert.");
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Unbekannter Fehler";
      logger.error("tracking upsert failed", msg);
      setError("Speichern fehlgeschlagen. Bitte erneut versuchen.");
    }
  }

  const isDirty = !initial || upsert.isPending;

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        void handleSubmit();
      }}
      className="space-y-5 rounded-[22px] p-5"
      style={FORM_CARD_STYLE}
      noValidate
    >
      <Segmented
        label="Schlafqualitaet"
        name="sleep_quality"
        options={QUALITY_OPTIONS}
        value={form.sleep_quality}
        onChange={(v) => update("sleep_quality", v)}
        required
      />

      <NumberField
        id="weight_kg"
        label="Koerpergewicht (kg)"
        value={form.weight_kg}
        onChange={(v) => update("weight_kg", v)}
        min={30}
        max={300}
        step={0.1}
        required
      />

      <MoodEmojiStrip
        label="Stimmung"
        value={form.mood}
        onChange={(v) => update("mood", v)}
        required
      />

      <NumberField
        id="water_l"
        label="Wasserkonsum (l)"
        value={form.water_l}
        onChange={(v) => update("water_l", v)}
        min={0}
        max={10}
        step={0.1}
        required
      />

      <Segmented
        label="Koerperlicher Zustand"
        name="physical_condition"
        options={QUALITY_OPTIONS}
        value={form.physical_condition}
        onChange={(v) => update("physical_condition", v)}
        required
      />

      <details className="rounded-2xl" style={{ border: "1px solid var(--line)" }}>
        <summary
          className="cursor-pointer px-3 py-2 text-sm font-medium"
          style={{ color: "var(--color-ink-2)" }}
        >
          Weitere Angaben (optional)
        </summary>
        <div className="space-y-5 p-3" style={{ borderTop: "1px solid var(--line)" }}>
          <NumberField
            id="calories_kcal"
            label="Kalorien (kcal)"
            value={form.calories_kcal}
            onChange={(v) => update("calories_kcal", v)}
            min={0}
            max={10000}
            step={1}
          />

          <Segmented
            label="Aktivitaetslevel"
            name="activity_level"
            options={ACTIVITY_OPTIONS}
            value={form.activity_level}
            onChange={(v) => update("activity_level", v)}
          />

          <Toggle
            label="Training absolviert"
            checked={form.trained}
            onChange={(v) => update("trained", v)}
          />

          {form.trained && (
            <div className="grid grid-cols-2 gap-3">
              <NumberField
                id="rpe"
                label="RPE (1–10)"
                value={form.rpe}
                onChange={(v) => update("rpe", v)}
                min={1}
                max={10}
                step={1}
              />
              <NumberField
                id="duration_min"
                label="Dauer (min)"
                value={form.duration_min}
                onChange={(v) => update("duration_min", v)}
                min={0}
                max={600}
                step={1}
              />
            </div>
          )}

          <Toggle
            label="Muskelkater"
            checked={form.soreness}
            onChange={(v) => update("soreness", v)}
          />

          {form.soreness && (
            <div>
              <label
                htmlFor="soreness_region"
                className="mb-1 block text-sm font-medium"
                style={{ color: "var(--color-ink)" }}
              >
                Koerperregion
              </label>
              <input
                id="soreness_region"
                type="text"
                value={form.soreness_region}
                maxLength={100}
                onChange={(e) => update("soreness_region", e.target.value)}
                placeholder="z.B. Schultern, Beine"
                className="w-full rounded-md px-3 py-2 text-sm outline-none"
                style={INPUT_STYLE}
              />
            </div>
          )}
        </div>
      </details>

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-accent-2)" }}>
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={upsert.isPending}
        className="w-full rounded-2xl py-3 text-sm font-medium disabled:opacity-50"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
        }}
      >
        {upsert.isPending ? "Speichere …" : isDirty ? "Heute speichern" : "Aktualisieren"}
      </button>
    </form>
  );
}

type NumberFieldProps = {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  step: number;
  required?: boolean;
};

function NumberField({
  id,
  label,
  value,
  onChange,
  min,
  max,
  step,
  required,
}: NumberFieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium"
        style={{ color: "var(--color-ink)" }}
      >
        {label}
        {required && (
          <span className="ml-1" style={{ color: "var(--color-accent)" }}>
            *
          </span>
        )}
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
        className="w-full rounded-md px-3 py-2 text-sm outline-none"
        style={INPUT_STYLE}
      />
    </div>
  );
}

type ToggleProps = { label: string; checked: boolean; onChange: (v: boolean) => void };

function Toggle({ label, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center gap-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded"
        style={{
          accentColor: "var(--color-accent)",
          border: "1px solid var(--line)",
        }}
      />
      <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
        {label}
      </span>
    </label>
  );
}
