import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { useAuthStore } from "../stores/auth";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";

const ROLE_LABEL: Record<"athlete" | "coach" | "both", string> = {
  athlete: "Athlet",
  coach: "Coach",
  both: "Athlet und Coach",
};

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
      <header>
        <h1 className="text-2xl font-semibold">Profil</h1>
        <p className="text-sm text-slate-400">
          Stammdaten, Rolle und Sitzung. Weitere Optionen folgen.
        </p>
      </header>

      {profile.isLoading && (
        <p role="status" className="text-sm text-slate-500">
          Lade Profil …
        </p>
      )}

      {profile.error && (
        <p role="alert" className="text-sm text-red-400">
          Profil konnte nicht geladen werden.
        </p>
      )}

      {profile.data && (
        <dl className="grid grid-cols-1 gap-3 rounded-md border border-slate-800 p-4 text-sm">
          <Row label="Anzeigename" value={profile.data.display_name} />
          <Row label="E-Mail" value={user?.email ?? "–"} />
          <Row label="Rolle" value={ROLE_LABEL[profile.data.role]} />
          <Row
            label="Level"
            value={`${profile.data.level} – ${profile.data.level_title} (${profile.data.xp_total} XP)`}
          />
        </dl>
      )}

      {profile.data?.role === "both" && (
        <div className="rounded-md border border-slate-800 p-4">
          <h2 className="text-sm font-medium">Aktiver Modus</h2>
          <p className="mt-1 text-xs text-slate-500">
            Wechsle zwischen Athlet- und Coach-Ansicht.
          </p>
          <div role="group" aria-label="Modus waehlen" className="mt-3 inline-flex gap-2">
            <ModeButton
              active={mode === "athlete"}
              onClick={() => setMode("athlete")}
              label="Athlet"
            />
            <ModeButton
              active={mode === "coach"}
              onClick={() => setMode("coach")}
              label="Coach"
            />
          </div>
        </div>
      )}

      <div className="rounded-md border border-slate-800 p-4">
        <h2 className="text-sm font-medium">Sitzung</h2>
        <p className="mt-1 text-xs text-slate-500">
          Abmelden beendet die lokale Offline-Queue und loescht Session-Cookies.
        </p>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="mt-3 rounded-md border border-red-800 px-3 py-1.5 text-sm text-red-200 hover:border-red-600"
        >
          Abmelden
        </button>
      </div>
    </section>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-100">{value}</dd>
    </div>
  );
}

function ModeButton({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "rounded-md px-3 py-1.5 text-xs " +
        (active
          ? "bg-slate-100 text-slate-900"
          : "border border-slate-800 text-slate-300 hover:border-slate-600")
      }
    >
      {label}
    </button>
  );
}
