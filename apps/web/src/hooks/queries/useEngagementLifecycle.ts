import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { EngagementEndReason } from "../../lib/engagementLifecycle";

export function usePauseEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (engagementId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("pause_engagement", {
        p_engagement_id: engagementId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export function useResumeEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (engagementId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("resume_engagement", {
        p_engagement_id: engagementId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}

export type EndEngagementArgs = {
  engagementId: string;
  endReason?: EngagementEndReason;
};

export function useEndEngagement() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      engagementId,
      endReason,
    }: EndEngagementArgs): Promise<string> => {
      const { data, error } = await supabase.rpc("end_engagement", {
        p_engagement_id: engagementId,
        p_end_reason: endReason ?? undefined,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["engagements"] });
    },
  });
}
