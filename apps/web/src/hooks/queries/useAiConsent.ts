import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

// ASSUMPTION: Direkter Update auf eigene users-Row via users_self_update Policy
// (foundation.sql:436). Audit-Log fuer ai_consent-Aenderung ist Followup —
// SECURITY-DEFINER-RPC mit audit.events-Eintrag waere CLAUDE.md §0.7 konform,
// existiert aber noch nicht. Tracker: ROADMAP §1.16 Followups.
export function useSetAiConsent() {
  const userId = useAuthStore((s) => s.user?.id);
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (value: boolean): Promise<void> => {
      if (!userId) throw new Error("not_authenticated");
      const { error } = await supabase
        .from("users")
        .update({
          ai_consent: value,
          ai_consent_at: value ? new Date().toISOString() : null,
        })
        .eq("id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["profile"] });
    },
  });
}
