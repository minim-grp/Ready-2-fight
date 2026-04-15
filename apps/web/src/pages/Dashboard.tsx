import { useAuthStore } from "../stores/auth";

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <section className="space-y-4">
      <header>
        <h1 className="text-2xl font-semibold">Heute</h1>
        <p className="text-sm text-slate-400">Angemeldet als {user?.email ?? "–"}</p>
      </header>
      <p className="text-sm text-slate-500">
        Tracking-Form und Streak folgen in Sprint 3.
      </p>
    </section>
  );
}
