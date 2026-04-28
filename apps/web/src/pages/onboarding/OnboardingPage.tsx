import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useProfile } from "../../hooks/queries/useProfile";
import { AthleteOnboarding } from "./AthleteOnboarding";
import { CoachOnboarding } from "./CoachOnboarding";
import { ConsentStep } from "./ConsentStep";
import { CrsTutorialStep } from "./CrsTutorialStep";
import { SplashStep } from "./SplashStep";

type Phase = "splash" | "consent" | "athlete" | "coach" | "tutorial" | "done";
type Role = "athlete" | "coach" | "both";

export function OnboardingPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profile = useProfile();
  const role = profile.data?.role;

  const [phase, setPhase] = useState<Phase>("splash");
  const [athleteSportIds, setAthleteSportIds] = useState<string[]>([]);

  if (profile.isLoading) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-ink-3)",
        }}
      >
        <p>Lade …</p>
      </div>
    );
  }

  if (!role) {
    return (
      <div
        className="flex min-h-screen items-center justify-center"
        style={{
          backgroundColor: "var(--color-bg)",
          color: "var(--color-accent-2)",
        }}
      >
        <p>Profil konnte nicht geladen werden.</p>
      </div>
    );
  }

  if (phase === "done") {
    void queryClient.invalidateQueries({ queryKey: ["profile"] });
    void navigate("/app", { replace: true });
    return null;
  }

  function handleAthleteComplete() {
    if (role === "both") {
      setPhase("coach");
    } else {
      setPhase("tutorial");
    }
  }

  function handleCoachComplete() {
    if (role === "both") {
      setPhase("tutorial");
    } else {
      setPhase("done");
    }
  }

  return (
    <div
      className="min-h-screen"
      style={{
        backgroundColor: "var(--color-bg)",
        color: "var(--color-ink)",
      }}
    >
      {phase === "splash" && <SplashStep onContinue={() => setPhase("consent")} />}
      {phase === "consent" && (
        <ConsentStep onContinue={() => setPhase(initialProfilePhase(role))} />
      )}
      {phase === "athlete" && (
        <AthleteOnboarding
          onComplete={handleAthleteComplete}
          onSportsChange={setAthleteSportIds}
        />
      )}
      {phase === "coach" && (
        <CoachOnboarding
          onComplete={handleCoachComplete}
          prefillSportIds={role === "both" ? athleteSportIds : undefined}
        />
      )}
      {phase === "tutorial" && <CrsTutorialStep onContinue={() => setPhase("done")} />}
    </div>
  );
}

function initialProfilePhase(role: Role): Phase {
  if (role === "coach") return "coach";
  return "athlete";
}
