import { Navigate } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { TrackingForm } from "../components/tracking/TrackingForm";
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
      <p role="status" className="text-sm text-slate-500">
        Lade Profil …
      </p>
    );
  }

  if (profile.error) {
    return (
      <p role="alert" className="text-sm text-red-400">
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
        <h1 className="text-2xl font-semibold">Tagestracking</h1>
        <p className="text-sm text-slate-400">
          Taegliche Werte eintragen und Historie im Blick behalten.
        </p>
      </header>

      <StreakCard />
      <StreakHistoryChart />
      <WeightHistoryChart />
      <TrackingForm />
    </section>
  );
}
