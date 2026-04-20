import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { CrsExerciseKey } from "../../lib/crsTest";

export function useStartCrsTest() {
  return useMutation({
    mutationFn: async (clientUuid?: string | null): Promise<string> => {
      const { data, error } = await supabase.rpc("start_crs_test", {
        p_client_uuid: clientUuid ?? undefined,
      });
      if (error) throw error;
      return data;
    },
  });
}

export type SaveCrsExerciseArgs = {
  testId: string;
  exercise: CrsExerciseKey;
  value: number;
};

export function useSaveCrsExercise() {
  return useMutation({
    mutationFn: async ({
      testId,
      exercise,
      value,
    }: SaveCrsExerciseArgs): Promise<void> => {
      const { error } = await supabase.rpc("save_crs_exercise", {
        p_test_id: testId,
        p_exercise: exercise,
        p_value: value,
      });
      if (error) throw error;
    },
  });
}

export function useCompleteCrsTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string): Promise<string> => {
      const { data, error } = await supabase.rpc("complete_crs_test", {
        p_test_id: testId,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crs-tests"] });
    },
  });
}

export function useAbortCrsTest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (testId: string): Promise<void> => {
      const { error } = await supabase.rpc("abort_crs_test", {
        p_test_id: testId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crs-tests"] });
    },
  });
}
