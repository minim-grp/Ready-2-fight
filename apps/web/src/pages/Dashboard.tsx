import { useAuthStore } from "../stores/auth";
import { useModeStore } from "../stores/mode";
import { useProfile } from "../hooks/queries/useProfile";
import { TrackingForm } from "../components/tracking/TrackingForm";
import { CrsHeroCard } from "../components/dashboard/CrsHeroCard";
import { StreakCard } from "../components/dashboard/StreakCard";
import { StreakHistoryChart } from "../components/dashboard/StreakHistoryChart";
import { WeightHistoryChart } from "../components/dashboard/WeightHistoryChart";

const DAY_NAMES = [
  "Sonntag",
  "Montag",
  "Dienstag",
  "Mittwoch",
  "Donnerstag",
  "Freitag",
  "Samstag",
];

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const mode = useModeStore((s) => s.mode);
  const profile = useProfile();

  const role = profile.data?.role;
  const showAthlete = role === "athlete" || (role === "both" && mode === "athlete");
  const greeting = pickGreeting(new Date());
  const dayLabel = formatDay(new Date());

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
          {dayLabel}
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {greeting},{" "}
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>
            {firstName(profile.data?.display_name, user?.email)}
          </em>
          .
        </h1>
      </header>

      {profile.isLoading && (
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Profil …
        </p>
      )}
      {profile.error && (
        <p className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Profil konnte nicht geladen werden.
        </p>
      )}

      {showAthlete && (
        <>
          <CrsHeroCard />
          <StreakCard />
          <StreakHistoryChart />
          <WeightHistoryChart />
          <TrackingForm />
        </>
      )}

      {!showAthlete && profile.data && (
        <p className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Coach-Dashboard folgt in Sprint 7.
        </p>
      )}
    </section>
  );
}

function firstName(displayName?: string, email?: string | null): string {
  if (displayName && displayName.trim()) {
    return displayName.split(/\s+/)[0] ?? displayName;
  }
  if (email) return email.split("@")[0] ?? "Du";
  return "Du";
}

function pickGreeting(now: Date): string {
  const h = now.getHours();
  if (h < 11) return "Guten Morgen";
  if (h < 17) return "Hallo";
  return "Guten Abend";
}

function formatDay(now: Date): string {
  const day = DAY_NAMES[now.getDay()] ?? "";
  const date = now.toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "short",
  });
  return `${day} · ${date}`;
}
