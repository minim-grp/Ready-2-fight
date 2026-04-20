import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "../../hooks/queries/useProfile";
import { AthleteOnboarding } from "./AthleteOnboarding";
import { CoachOnboarding } from "./CoachOnboarding";

type Phase = "athlete" | "coach" | "done";

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const role = profile.data?.role;

  const [phase, setPhase] = useState<Phase | null>(null);
  const [athleteSportIds, setAthleteSportIds] = useState<string[]>([]);

  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
        <p>Lade …</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-red-400">
        <p>Profil konnte nicht geladen werden.</p>
      </div>
    );
  }

  const currentPhase = phase ?? initialPhase(role);

  if (currentPhase === "done") {
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void navigate("/app", { replace: true });
    return null;
  }

  function handleAthleteComplete() {
    if (role === "both") {
      setPhase("coach");
    } else {
      finishOnboarding();
    }
  }

  function handleCoachComplete() {
    finishOnboarding();
  }

  function finishOnboarding() {
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void navigate("/app", { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-10 text-slate-100">
      {currentPhase === "athlete" && (
        <AthleteOnboarding
          onComplete={handleAthleteComplete}
          onSportsChange={setAthleteSportIds}
        />
      )}
      {currentPhase === "coach" && (
        <CoachOnboarding
          onComplete={handleCoachComplete}
          prefillSportIds={role === "both" ? athleteSportIds : undefined}
        />
      )}
    </div>
  );
}

function initialPhase(role: "athlete" | "coach" | "both"): Phase {
  if (role === "athlete") return "athlete";
  if (role === "coach") return "coach";
  return "athlete";
}
