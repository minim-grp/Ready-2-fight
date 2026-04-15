import { NavLink } from "react-router-dom";
import type { NavItem } from "./navItems";

type BottomNavProps = {
  items: NavItem[];
};

export function BottomNav({ items }: BottomNavProps) {
  const cols = items.length === 5 ? "grid-cols-5" : "grid-cols-4";
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-10 border-t border-slate-800 bg-slate-900/95 backdrop-blur"
      aria-label="Hauptnavigation"
    >
      <ul className={`mx-auto grid max-w-md ${cols}`}>
        {items.map((item) => (
          <li key={item.to}>
            <NavLink
              to={item.to}
              end={item.to === "/app/dashboard"}
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
  );
}
