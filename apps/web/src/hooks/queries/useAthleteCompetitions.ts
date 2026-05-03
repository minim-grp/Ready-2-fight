import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export type AthleteCompetition = {
  id: string;
  athlete_id: string;
  title: string;
  competition_date: string;
  discipline: string | null;
  weight_class: string | null;
  location: string | null;
  result: string | null;
  notes: string | null;
};

// Coach-Sicht auf die Wettkaempfe eines Athleten.
// RLS comp_coach_read filtert auf is_linked_coach_with_tracking
// (PR #54 / Roadmap §1.26a). Liefert leeres Array wenn der
// Coach die Permission nicht hat — kein expliziter Error.
export function useAthleteCompetitions(athleteId: string | undefined) {
  return useQuery({
    enabled: !!athleteId,
    queryKey: ["athlete-competitions", athleteId],
    queryFn: async (): Promise<AthleteCompetition[]> => {
      const { data, error } = await supabase
        .from("competitions")
        .select(
          "id, athlete_id, title, competition_date, discipline, weight_class, location, result, notes",
        )
        .eq("athlete_id", athleteId!)
        .order("competition_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as AthleteCompetition[];
    },
  });
}
