import { Navigate } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { TrackingForm } from "../components/tracking/TrackingForm";
import { BreathingCard } from "../components/tracking/BreathingCard";
import { StreakCard } from "../components/dashboard/StreakCard";
import { StreakHistoryChart } from "../components/dashboard/StreakHistoryChart";
import { WeightHistoryChart } from "../components/dashboard/WeightHistoryChart";

export function TrackingPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const isAthleteView = role === "athlete" || (role === "both" && mode === "athlete");

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

  return (
    <section className="space-y-6">
      <header>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-3)",
          }}
        >
          Tagestracking
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Heute{" "}
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>
            festhalten
          </em>
          .
        </h1>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
          Taegliche Werte eintragen und Historie im Blick behalten.
        </p>
      </header>

      <BreathingCard />
      <TrackingForm />
      <StreakCard />
      <StreakHistoryChart />
      <WeightHistoryChart />
    </section>
  );
}
