import type { Database } from "../../lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type NavItem = { to: string; label: string };

const ATHLETE_ITEMS: NavItem[] = [
  { to: "/app/dashboard", label: "Heute" },
  { to: "/app/tracking", label: "Tracking" },
  { to: "/app/engagements", label: "Coaches" },
  { to: "/app/settings", label: "Profil" },
];

const COACH_ITEMS: NavItem[] = [
  { to: "/app/dashboard", label: "Dashboard" },
  { to: "/app/engagements", label: "Athleten" },
  { to: "/app/codes", label: "Codes" },
  { to: "/app/settings", label: "Profil" },
];

const BOTH_ITEMS: NavItem[] = [
  { to: "/app/dashboard", label: "Heute" },
  { to: "/app/tracking", label: "Tracking" },
  { to: "/app/engagements", label: "Coaches" },
  { to: "/app/codes", label: "Codes" },
  { to: "/app/settings", label: "Profil" },
];

export function navItemsFor(role: UserRole | undefined): NavItem[] {
  if (role === "coach") return COACH_ITEMS;
  if (role === "both") return BOTH_ITEMS;
  return ATHLETE_ITEMS;
}
