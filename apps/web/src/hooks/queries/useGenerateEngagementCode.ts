import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type GenerateCodeInput = {
  internalLabel?: string | null;
  maxUses: number;
  validDays: number;
};

export type GeneratedCode = {
  code: string;
  expiresAt: string;
};

export function useGenerateEngagementCode() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: GenerateCodeInput): Promise<GeneratedCode> => {
      const { data, error } = await supabase.rpc("generate_engagement_code", {
        p_internal_label: input.internalLabel?.trim()
          ? input.internalLabel.trim()
          : undefined,
        p_max_uses: input.maxUses,
        p_valid_days: input.validDays,
      });
      if (error) throw error;
      const row = Array.isArray(data) ? data[0] : null;
      if (!row) throw new Error("rpc_empty_result");
      return { code: row.code, expiresAt: row.expires_at };
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["engagement-codes"] });
    },
  });
}
