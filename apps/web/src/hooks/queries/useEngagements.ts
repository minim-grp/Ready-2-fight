import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";
import type {
  EngagementEndReason,
  EngagementPurpose,
  EngagementStatus,
} from "../../lib/engagementLifecycle";

export type EngagementPermissions = {
  can_see_tracking: boolean;
  can_see_meals: boolean;
  can_see_tests: boolean;
  can_create_plans: boolean;
};

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
} & EngagementPermissions;

type RawRow = {
  id: string;
  coach_id: string;
  athlete_id: string;
  purpose: EngagementPurpose;
  status: EngagementStatus;
  end_reason: EngagementEndReason | null;
  started_at: string | null;
  ended_at: string | null;
  can_see_tracking: boolean | null;
  can_see_meals: boolean | null;
  can_see_tests: boolean | null;
  can_create_plans: boolean | null;
  coach: { display_name: string | null } | null;
  athlete: { display_name: string | null } | null;
};

const STATUS_ORDER: Record<EngagementStatus, number> = {
  active: 0,
  paused: 1,
  pending: 2,
  ended: 3,
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
           can_see_tracking, can_see_meals, can_see_tests, can_create_plans,
           coach:users!coach_id(display_name),
           athlete:users!athlete_id(display_name)`,
        )
        .order("created_at", { ascending: false });
      if (error) throw error;
      const rows = ((data ?? []) as unknown as RawRow[]).map<EngagementRow>((r) => ({
        id: r.id,
        coach_id: r.coach_id,
        athlete_id: r.athlete_id,
        purpose: r.purpose,
        status: r.status,
        end_reason: r.end_reason,
        started_at: r.started_at,
        ended_at: r.ended_at,
        can_see_tracking: r.can_see_tracking ?? false,
        can_see_meals: r.can_see_meals ?? false,
        can_see_tests: r.can_see_tests ?? false,
        can_create_plans: r.can_create_plans ?? false,
        coach_name: r.coach?.display_name ?? null,
        athlete_name: r.athlete?.display_name ?? null,
      }));
      rows.sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]);
      return rows;
    },
  });
}
