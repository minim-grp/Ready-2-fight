import { Link } from "react-router-dom";
import { useAuthStore } from "../stores/auth";
import { useModeStore } from "../stores/mode";
import { useProfile } from "../hooks/queries/useProfile";
import { TrackingForm } from "../components/tracking/TrackingForm";
import { StreakCard } from "../components/dashboard/StreakCard";
import { StreakHistoryChart } from "../components/dashboard/StreakHistoryChart";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const mode = useModeStore((s) => s.mode);
  const profile = useProfile();

  const role = profile.data?.role;
  const showTracking = role === "athlete" || (role === "both" && mode === "athlete");

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Heute</h1>
        <p className="text-sm text-slate-400">Angemeldet als {user?.email ?? "–"}</p>
      </header>

      {profile.isLoading && <p className="text-sm text-slate-500">Lade Profil …</p>}
      {profile.error && (
        <p className="text-sm text-red-400">Profil konnte nicht geladen werden.</p>
      )}

      {showTracking && <StreakCard />}
      {showTracking && <StreakHistoryChart />}
      {showTracking && <TrackingForm />}
      {showTracking && (
        <Link
          to="/app/crs/test"
          className="inline-block rounded bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900"
        >
          CRS-Fitnesstest starten
        </Link>
      )}

      {!showTracking && profile.data && (
        <p className="text-sm text-slate-500">Coach-Dashboard folgt in Sprint 7.</p>
      )}
    </section>
  );
}
