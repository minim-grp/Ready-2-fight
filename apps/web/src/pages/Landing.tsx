import { Link, Navigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export function LandingPage() {
  const session = useAuthStore((s) => s.session);
  if (session) return <Navigate to="/app/dashboard" replace />;

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-slate-900 px-6 text-center text-white">
      <div>
        <h1 className="text-4xl font-bold">Ready 2 Fight</h1>
        <p className="mt-2 text-slate-400">Combat Readiness Score Platform</p>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row">
        <Link
          to="/login"
          className="rounded-md bg-white px-6 py-2 font-medium text-slate-900"
        >
          Einloggen
        </Link>
        <Link
          to="/register"
          className="rounded-md border border-slate-700 px-6 py-2 font-medium"
        >
          Konto erstellen
        </Link>
      </div>
    </div>
  );
}
