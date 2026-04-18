import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import { useSportDisciplines } from "../../hooks/queries/useSportDisciplines";
import { logger } from "../../lib/logger";
import type { Database, TablesUpdate } from "../../lib/database.types";

type Gender = Database["public"]["Enums"]["gender"];

const GENDERS: { value: Gender; label: string }[] = [
  { value: "male", label: "Maennlich" },
  { value: "female", label: "Weiblich" },
  { value: "diverse", label: "Divers" },
  { value: "prefer_not_to_say", label: "Keine Angabe" },
];

type Props = { onComplete: () => void };

export function AthleteOnboarding({ onComplete }: Props) {
  const userId = useAuthStore((s) => s.user?.id);
  const sports = useSportDisciplines();

  const [step, setStep] = useState(0);
  const [selectedSports, setSelectedSports] = useState<string[]>([]);
  const [primarySportId, setPrimarySportId] = useState<string | null>(null);
  const [gender, setGender] = useState<Gender | "">("");
  const [heightCm, setHeightCm] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [experienceYears, setExperienceYears] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleSport(sportId: string) {
    setSelectedSports((prev) => {
      const next = prev.includes(sportId)
        ? prev.filter((id) => id !== sportId)
        : [...prev, sportId];
      if (!next.includes(primarySportId ?? "")) {
        setPrimarySportId(next[0] ?? null);
      }
      return next;
    });
  }

  function canAdvance(): boolean {
    if (step === 0) return selectedSports.length > 0;
    if (step === 1) return true;
    return false;
  }

  async function handleSubmit() {
    if (!userId) return;
    setIsSubmitting(true);
    setError(null);

    try {
      const profileUpdate: TablesUpdate<"athlete_profiles"> = {
        onboarding_done: true,
        ...(gender ? { gender } : {}),
        ...(heightCm ? { height_cm: parseFloat(heightCm) } : {}),
        ...(weightKg ? { weight_kg: parseFloat(weightKg) } : {}),
        ...(experienceYears ? { experience_years: parseInt(experienceYears, 10) } : {}),
      };

      const { error: profileError } = await supabase
        .from("athlete_profiles")
        .update(profileUpdate)
        .eq("id", userId);

      if (profileError) throw profileError;

      if (selectedSports.length > 0) {
        const sportRows = selectedSports.map((sportId) => ({
          athlete_id: userId,
          sport_id: sportId,
          is_primary: sportId === (primarySportId ?? selectedSports[0]),
        }));

        const { error: sportsError } = await supabase
          .from("athlete_sports")
          .upsert(sportRows, { onConflict: "athlete_id,sport_id" });

        if (sportsError) throw sportsError;
      }

      toast.success("Profil eingerichtet!");
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unbekannter Fehler";
      logger.error("athlete onboarding failed", msg);
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
          {step === 0 ? "Deine Sportarten" : "Ueber dich"}
        </h1>
        <p className="mt-1 text-sm text-slate-400">
          {step === 0
            ? "Waehle mindestens eine Sportart aus."
            : "Optional — du kannst diese Angaben spaeter ergaenzen."}
        </p>
      </header>

      {step === 0 && (
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
                const active = selectedSports.includes(sport.id);
                const isPrimary = primarySportId === sport.id;
                return (
                  <button
                    key={sport.id}
                    type="button"
                    onClick={() => toggleSport(sport.id)}
                    className={`rounded-lg border px-3 py-2.5 text-left text-sm transition ${
                      active
                        ? "border-slate-400 bg-slate-800"
                        : "border-slate-700 bg-slate-900 hover:border-slate-600"
                    }`}
                  >
                    <span className="font-medium">{sport.name}</span>
                    {active && selectedSports.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPrimarySportId(sport.id);
                        }}
                        className={`mt-1 block text-xs ${
                          isPrimary
                            ? "font-semibold text-white"
                            : "text-slate-500 hover:text-slate-300"
                        }`}
                      >
                        {isPrimary ? "Hauptsportart" : "Als Hauptsportart"}
                      </button>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <label htmlFor="gender" className="mb-1 block text-sm font-medium">
              Geschlecht
            </label>
            <select
              id="gender"
              value={gender}
              onChange={(e) => setGender(e.target.value as Gender | "")}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            >
              <option value="">— Bitte waehlen —</option>
              {GENDERS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="height" className="mb-1 block text-sm font-medium">
                Groesse (cm)
              </label>
              <input
                id="height"
                type="number"
                inputMode="decimal"
                min="100"
                max="250"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                placeholder="z.B. 178"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
            <div>
              <label htmlFor="weight" className="mb-1 block text-sm font-medium">
                Gewicht (kg)
              </label>
              <input
                id="weight"
                type="number"
                inputMode="decimal"
                min="30"
                max="200"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                placeholder="z.B. 75"
                className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="experience" className="mb-1 block text-sm font-medium">
              Erfahrung (Jahre)
            </label>
            <input
              id="experience"
              type="number"
              inputMode="numeric"
              min="0"
              max="50"
              value={experienceYears}
              onChange={(e) => setExperienceYears(e.target.value)}
              placeholder="z.B. 3"
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
          </div>
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
            disabled={isSubmitting}
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
