import { NavLink, Outlet } from "react-router-dom";
import { useAuthStore } from "../../stores/auth";

const navItems = [
  { to: "/app/dashboard", label: "Heute" },
  { to: "/app/tracking", label: "Tracking" },
  { to: "/app/engagements", label: "Coaches" },
  { to: "/app/settings", label: "Profil" },
];

export function AppLayout() {
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);

  return (
    <div className="flex min-h-screen flex-col bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-800 bg-slate-900/80 px-4 py-3 backdrop-blur">
        <span className="text-sm font-semibold tracking-wide">Ready 2 Fight</span>
        <button
          type="button"
          onClick={() => void signOut()}
          className="text-xs text-slate-400 hover:text-slate-200"
          aria-label={`Abmelden ${user?.email ?? ""}`}
        >
          Abmelden
        </button>
      </header>

      <main className="flex-1 overflow-y-auto px-4 pt-4 pb-24">
        <Outlet />
      </main>

      <nav
        className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-900/95 backdrop-blur"
        aria-label="Hauptnavigation"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {navItems.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                className={({ isActive }) =>
                  `flex flex-col items-center gap-1 py-3 text-xs ${
                    isActive ? "text-white" : "text-slate-400"
                  }`
                }
              >
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
