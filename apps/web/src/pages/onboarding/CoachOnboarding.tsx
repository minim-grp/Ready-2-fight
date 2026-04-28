import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import { useSportDisciplines } from "../../hooks/queries/useSportDisciplines";
import { logger } from "../../lib/logger";
import type { TablesUpdate } from "../../lib/database.types";

type Props = {
  onComplete: () => void;
  prefillSportIds?: string[];
};

export function CoachOnboarding({ onComplete, prefillSportIds }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const sports = useSportDisciplines();

  const [step, setStep] = useState(0);
  const [gymName, setGymName] = useState("");
  const [city, setCity] = useState("");
  const [certification, setCertification] = useState("");
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>([]);
  const [prefillApplied, setPrefillApplied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const prefillIdsRef = useRef(prefillSportIds);
  prefillIdsRef.current = prefillSportIds;

  useEffect(() => {
    if (prefillApplied) return;
    const ids = prefillIdsRef.current;
    if (!ids || ids.length === 0) return;
    if (!sports.data) return;
    const slugs = sports.data.filter((s) => ids.includes(s.id)).map((s) => s.slug);
    if (slugs.length === 0) return;
    setSelectedSpecialties(slugs);
    setPrefillApplied(true);
  }, [sports.data, prefillApplied]);

  function toggleSpecialty(slug: string) {
    setSelectedSpecialties((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }

  function canAdvance(): boolean {
    if (step === 0) return gymName.trim().length > 0 && city.trim().length > 0;
    if (step === 1) return selectedSpecialties.length > 0;
    return false;
  }

  async function handleSubmit() {
    if (!userId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const update: TablesUpdate<"coach_profiles"> = {
        onboarding_done: true,
        specialties: selectedSpecialties,
        ...(gymName.trim() ? { gym_name: gymName.trim() } : {}),
        ...(city.trim() ? { city: city.trim() } : {}),
        ...(certification.trim() ? { certification: certification.trim() } : {}),
      };

      const { error: profileError } = await supabase
        .from("coach_profiles")
        .update(update)
        .eq("id", userId);

      if (profileError) throw profileError;

      toast.success("Coach-Profil eingerichtet!");
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      logger.error("coach onboarding failed", msg);
      setError("Speichern fehlgeschlagen. Bitte versuche es erneut.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-6 py-10">
      <header>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-3)",
          }}
        >
          Schritt {step + 1} von 2
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {step === 0 ? (
            <>
              Dein{" "}
              <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>Gym</em>
            </>
          ) : (
            <>
              Deine{" "}
              <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>
                Spezialisierungen
              </em>
            </>
          )}
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--color-ink-2)" }}>
          {step === 0
            ? "Wo trainierst du deine Athleten?"
            : prefillApplied
              ? "Aus deinem Athleten-Profil uebernommen. Du kannst die Liste anpassen."
              : "Waehle mindestens eine Spezialisierung."}
        </p>
      </header>

      {step === 0 && (
        <div
          className="space-y-4 rounded-[22px] p-5"
          style={{
            backgroundColor: "var(--color-paper)",
            boxShadow: "var(--shadow-1)",
            border: "1px solid var(--line)",
          }}
        >
          <CoachField
            id="gymName"
            label="Gym / Studio Name"
            placeholder="z.B. Fight Academy Berlin"
            value={gymName}
            onChange={setGymName}
          />
          <CoachField
            id="city"
            label="Stadt"
            placeholder="z.B. Berlin"
            value={city}
            onChange={setCity}
          />
          <CoachField
            id="certification"
            label="Zertifizierung / Lizenz (optional)"
            placeholder="z.B. A-Lizenz DOSB"
            value={certification}
            onChange={setCertification}
          />
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {sports.isLoading && (
            <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
              Lade Sportarten …
            </p>
          )}
          {sports.error && (
            <p className="text-sm" style={{ color: "var(--color-accent-2)" }}>
              Sportarten konnten nicht geladen werden.
            </p>
          )}
          {sports.data && (
            <div className="grid grid-cols-2 gap-2.5">
              {sports.data.map((sport) => {
                const active = selectedSpecialties.includes(sport.slug);
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => toggleSpecialty(sport.slug)}
                    className="rounded-2xl px-4 py-3 text-left text-sm font-medium transition"
                    style={{
                      backgroundColor: active
                        ? "var(--color-accent-soft)"
                        : "var(--color-paper)",
                      border: active
                        ? "1px solid var(--color-accent)"
                        : "1px solid var(--line)",
                      color: "var(--color-ink)",
                    }}
                  >
                    {sport.name}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-sm" role="alert" style={{ color: "var(--color-accent-2)" }}>
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-2xl px-5 py-3 text-sm font-medium"
            style={{
              backgroundColor: "transparent",
              border: "1px solid var(--line-2)",
              color: "var(--color-ink)",
            }}
          >
            Zurueck
          </button>
        )}

        {step < 1 ? (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-2xl py-3 text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            Weiter
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting || !canAdvance()}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-2xl py-3 text-sm font-medium disabled:opacity-50"
            style={{
              backgroundColor: "var(--color-accent)",
              color: "var(--color-on-night)",
            }}
          >
            {isSubmitting ? "Speichere …" : "Profil fertigstellen"}
          </button>
        )}
      </div>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  placeholder: string;
  value: string;
  onChange: (next: string) => void;
};

function CoachField({ id, label, placeholder, value, onChange }: FieldProps) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1 block text-sm font-medium"
        style={{ color: "var(--color-ink)" }}
      >
        {label}
      </label>
      <input
        id={id}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md px-3 py-2 text-sm outline-none"
        style={{
          backgroundColor: "var(--color-paper-elev)",
          border: "1px solid var(--line)",
          color: "var(--color-ink)",
        }}
      />
    </div>
  );
}
