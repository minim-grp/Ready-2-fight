import { useQuery } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";

export function useSportDisciplines() {
  return useQuery({
    queryKey: ["sport_disciplines"],
    staleTime: 1000 * 60 * 60,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sport_disciplines")
        .select("id, name, slug, category")
        .order("name");

      if (error) throw error;
      return data;
    },
  });
}
