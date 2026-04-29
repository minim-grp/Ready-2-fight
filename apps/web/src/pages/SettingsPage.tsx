import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../stores/auth";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { ProfileCard } from "../components/settings/ProfileCard";
import { ModeSwitcherCard } from "../components/settings/ModeSwitcherCard";
import { AiConsentCard } from "../components/settings/AiConsentCard";
import { DataRightsCard } from "../components/settings/DataRightsCard";
import { SessionCard } from "../components/settings/SessionCard";

export function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const profile = useProfile();

  const handleSignOut = async () => {
    await signOut();
    toast.success("Abgemeldet.");
    void navigate("/login", { replace: true });
  };

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Einstellungen
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Profil
        </h1>
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          Stammdaten, Datenschutz und Sitzung — an einer Stelle.
        </p>
      </header>

      {profile.isLoading && (
        <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
          Lade Profil …
        </p>
      )}

      {profile.error && (
        <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
          Profil konnte nicht geladen werden.
        </p>
      )}

      {profile.data && (
        <>
          <ProfileCard profile={profile.data} email={user?.email ?? ""} />

          {profile.data.role === "both" && (
            <ModeSwitcherCard mode={mode} onChange={setMode} />
          )}

          <AiConsentCard consent={profile.data.ai_consent} />

          <DataRightsCard />

          <SessionCard onSignOut={() => void handleSignOut()} />
        </>
      )}
    </section>
  );
}
