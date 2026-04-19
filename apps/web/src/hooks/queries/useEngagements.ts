import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type {
  EngagementEndReason,
  EngagementPurpose,
  EngagementStatus,
} from "../../lib/engagementLifecycle";

export type EngagementRow = {
  id: string;
  coach_id: string;
  athlete_id: string;
  purpose: EngagementPurpose;
  status: EngagementStatus;
  end_reason: EngagementEndReason | null;
  started_at: string | null;
  ended_at: string | null;
  coach_name: string | null;
  athlete_name: string | null;
};

type RawRow = {
  id: string;
  coach_id: string;
  athlete_id: string;
  purpose: EngagementPurpose;
  status: EngagementStatus;
  end_reason: EngagementEndReason | null;
  started_at: string | null;
  ended_at: string | null;
  coach: { display_name: string | null } | null;
  athlete: { display_name: string | null } | null;
};

export function useEngagements() {
  const userId = useAuthStore((s) => s.user?.id);

  return useQuery({
    enabled: !!userId,
    queryKey: ["engagements", userId],
    queryFn: async (): Promise<EngagementRow[]> => {
      const { data, error } = await supabase
        .from("coach_athlete_engagements")
        .select(
          `id, coach_id, athlete_id, purpose, status, end_reason,
           started_at, ended_at,
           coach:users!coach_id(display_name),
           athlete:users!athlete_id(display_name)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RawRow[]).map((r) => ({
        id: r.id,
        coach_id: r.coach_id,
        athlete_id: r.athlete_id,
        purpose: r.purpose,
        status: r.status,
        end_reason: r.end_reason,
        started_at: r.started_at,
        ended_at: r.ended_at,
        coach_name: r.coach?.display_name ?? null,
        athlete_name: r.athlete?.display_name ?? null,
      }));
    },
  });
}
