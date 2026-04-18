import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import { useProfile } from "../../hooks/queries/useProfile";

export function ProtectedRoute() {
  const session = useAuthStore((s) => s.session);
  const initialized = useAuthStore((s) => s.initialized);
  const location = useLocation();
  const profile = useProfile();

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
        <p>Lade …</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (profile.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-900 text-slate-400">
        <p>Lade …</p>
      </div>
    );
  }

  const isOnboardingRoute = location.pathname.startsWith("/app/onboarding");

  if (profile.data && !profile.data.onboarding_done && !isOnboardingRoute) {
    return <Navigate to="/app/onboarding" replace />;
  }

  return <Outlet />;
}
