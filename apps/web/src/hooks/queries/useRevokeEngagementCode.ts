import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export function useRevokeEngagementCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (codeId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("revoke_engagement_code", {
        p_code_id: codeId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["engagement-codes"] });
    },
  });
}
