import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type { Database } from "../../lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

export type Profile = {
  id: string;
  display_name: string;
  role: UserRole;
  level: number;
  level_title: string;
  xp_total: number;
  onboarding_done: boolean;
};

export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["profile", userId],
    queryFn: async (): Promise<Profile> => {
      const { data: user, error: userError } = await supabase
        .from("users")
        .select("id, display_name, role, level, level_title, xp_total")
        .eq("id", userId!)
        .single();

      if (userError) throw userError;

      const onboardingDone = await resolveOnboardingDone(userId!, user.role);

      return { ...user, onboarding_done: onboardingDone };
    },
  });
}

async function resolveOnboardingDone(userId: string, role: UserRole): Promise<boolean> {
  if (role === "athlete" || role === "both") {
    const { data } = await supabase
      .from("athlete_profiles")
      .select("onboarding_done")
      .eq("id", userId)
      .single();
    if (!data?.onboarding_done) return false;
  }

  if (role === "coach" || role === "both") {
    const { data } = await supabase
      .from("coach_profiles")
      .select("onboarding_done")
      .eq("id", userId)
      .single();
    if (!data?.onboarding_done) return false;
  }

  return true;
}
