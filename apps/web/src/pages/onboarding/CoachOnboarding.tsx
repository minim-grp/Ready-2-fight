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
    <div className="mx-auto w-full max-w-md space-y-6">
      <header>
        <p className="text-xs font-medium tracking-wider text-slate-500 uppercase">
          Schritt {step + 1} von 2
        </p>
        <h1 className="mt-1 text-2xl font-semibold">
          {step === 0 ? "Dein Gym / Studio" : "Deine Spezialisierungen"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {step === 0
            ? "Wo trainierst du deine Athleten?"
            : prefillApplied
              ? "Aus deinem Athleten-Profil uebernommen. Du kannst die Liste anpassen."
              : "Waehle mindestens eine Spezialisierung."}
        </p>
      </header>

      {step === 0 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="gymName" className="mb-1 block text-sm font-medium">
              Gym / Studio Name
            </label>
            <input
              id="gymName"
              type="text"
              value={gymName}
              onChange={(e) => setGymName(e.target.value)}
              placeholder="z.B. Fight Academy Berlin"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label htmlFor="city" className="mb-1 block text-sm font-medium">
              Stadt
            </label>
            <input
              id="city"
              type="text"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="z.B. Berlin"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>

          <div>
            <label htmlFor="certification" className="mb-1 block text-sm font-medium">
              Zertifizierung / Lizenz (optional)
            </label>
            <input
              id="certification"
              type="text"
              value={certification}
              onChange={(e) => setCertification(e.target.value)}
              placeholder="z.B. A-Lizenz DOSB"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          {sports.isLoading && (
            <p className="text-sm text-slate-500">Lade Sportarten …</p>
          )}
          {sports.error && (
            <p className="text-sm text-red-400">
              Sportarten konnten nicht geladen werden.
            </p>
          )}
          {sports.data && (
            <div className="grid grid-cols-2 gap-2">
              {sports.data.map((sport) => {
                const active = selectedSpecialties.includes(sport.slug);
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => toggleSpecialty(sport.slug)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm font-medium transition ${
                      active
                        ? "border-slate-400 bg-slate-800"
                        : "border-slate-700 bg-slate-900 hover:border-slate-600"
                    }`}
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
        <p className="text-sm text-red-400" role="alert">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep(step - 1)}
            className="rounded-md border border-slate-700 px-4 py-2.5 text-sm font-medium hover:border-slate-500"
          >
            Zurueck
          </button>
        )}

        {step < 1 ? (
          <button
            type="button"
            disabled={!canAdvance()}
            onClick={() => setStep(step + 1)}
            className="flex-1 rounded-md bg-white py-2.5 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            Weiter
          </button>
        ) : (
          <button
            type="button"
            disabled={isSubmitting || !canAdvance()}
            onClick={() => void handleSubmit()}
            className="flex-1 rounded-md bg-white py-2.5 text-sm font-medium text-slate-900 disabled:opacity-50"
          >
            {isSubmitting ? "Speichere …" : "Profil fertigstellen"}
          </button>
        )}
      </div>
    </div>
  );
}
