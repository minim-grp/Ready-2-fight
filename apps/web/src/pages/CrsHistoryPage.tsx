import { Link, Navigate } from "react-router-dom";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { CrsHistoryChart } from "../components/dashboard/CrsHistoryChart";

export function CrsHistoryPage() {
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
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          CRS · Verlauf
        </p>
        <h1
          className="mt-1 leading-tight"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Score-Verlauf
        </h1>
      </header>

      <CrsHistoryChart />

      <Link
        to="/app/dashboard"
        className="inline-block rounded-2xl px-5 py-3 text-sm"
        style={{
          border: "1px solid var(--line-2)",
          color: "var(--color-ink-2)",
          backgroundColor: "transparent",
        }}
      >
        Zum Dashboard
      </Link>
    </section>
  );
}
