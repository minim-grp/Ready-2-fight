import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

export type EngagementCodeRow = {
  id: string;
  code: string;
  internal_label: string | null;
  max_uses: number;
  uses_count: number;
  expires_at: string;
  revoked_at: string | null;
  created_at: string;
};

export function useEngagementCodes() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["engagement-codes", userId],
    queryFn: async (): Promise<EngagementCodeRow[]> => {
      const { data, error } = await supabase
        .from("engagement_codes")
        .select(
          "id, code, internal_label, max_uses, uses_count, expires_at, revoked_at, created_at",
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EngagementCodeRow[];
    },
  });
}
