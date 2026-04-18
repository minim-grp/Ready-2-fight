import { Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";
import { useProfile } from "../../hooks/queries/useProfile";
import { useModeStore, type ActiveMode } from "../../stores/mode";
import { BottomNav } from "./BottomNav";
import { navItemsFor } from "./navItems";
import { OfflineBanner } from "./OfflineBanner";

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const mode = useModeStore((s) => s.mode);
  const setMode = useModeStore((s) => s.setMode);
  const profile = useProfile();
  const role = profile.data?.role;
  const items = navItemsFor(role);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <span className="text-sm font-semibold tracking-wide">Ready 2 Fight</span>
        {role === "both" && <ModeToggle mode={mode} onChange={setMode} />}
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs text-slate-400 hover:text-slate-200"
          aria-label={`Abmelden ${user?.email ?? ""}`}
        >
          Abmelden
        </button>
      </header>

      <OfflineBanner />

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <Outlet />
      </main>

      <BottomNav items={items} />
    </div>
  );
}

type ModeToggleProps = {
  mode: ActiveMode;
  onChange: (mode: ActiveMode) => void;
};

function ModeToggle({ mode, onChange }: ModeToggleProps) {
  return (
    <div
      role="group"
      aria-label="Modus"
      className="flex rounded-full border border-slate-700 bg-slate-800 p-0.5 text-xs"
    >
      <ToggleButton active={mode === "athlete"} onClick={() => onChange("athlete")}>
        Athlet
      </ToggleButton>
      <ToggleButton active={mode === "coach"} onClick={() => onChange("coach")}>
        Coach
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full px-3 py-1 transition ${
        active ? "bg-slate-100 text-slate-900" : "text-slate-300 hover:text-white"
      }`}
    >
      {children}
    </button>
  );
}
