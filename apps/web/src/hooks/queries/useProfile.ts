import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export function useProfile() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["profile", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("users")
        .select("id, display_name, role, level, level_title, xp_total")
        .eq("id", userId!)
        .single();

      if (error) throw error;
      return data;
    },
  });
}
