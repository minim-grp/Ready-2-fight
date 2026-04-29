// Edge Function: compute-crs-score (Roadmap §1.17)
//
// Berechnet den CRS-Score nach Anhang B aus public.crs_tests + crs_norms +
// athlete_profiles und schreibt score / rank_label / archetype zurueck.
// Idempotent: bereits berechnete Tests liefern den vorhandenen Score
// zurueck, ohne neu zu schreiben.
//
// POST /compute-crs-score  body: { test_id: uuid }
// Auth: Bearer-JWT des Athleten (RLS-konform, kein anonymer Zugriff).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";
import {
  computeCrsScore,
  type CrsNormRow,
  type CrsRawValues,
  type AthleteProfile,
} from "../_shared/crsScore.ts";

type Body = { test_id?: string };

type CrsTestRow = {
  id: string;
  athlete_id: string;
  status: string;
  completed_at: string | null;
  burpees_60s: number | null;
  squats_60s: number | null;
  pushups_60s: number | null;
  plank_sec: number | null;
  high_knees_contacts: number | null;
  score: number | null;
  rank_label: string | null;
  archetype: string | null;
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "not_authenticated" }, 401);
  }
  const jwt = authHeader.slice("Bearer ".length);

  // User-Client (Anon-Key + JWT) zum Auth-Check und um RLS zu respektieren,
  // wenn moeglich. Service-Client schreibt das Update.
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser(jwt);
  if (userErr || !userData?.user) {
    return jsonResponse({ error: "not_authenticated" }, 401);
  }
  const userId = userData.user.id;

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return jsonResponse({ error: "invalid_body" }, 400);
  }
  if (!body.test_id || typeof body.test_id !== "string") {
    return jsonResponse({ error: "test_id_required" }, 400);
  }

  const adminClient = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

  // 1) crs_tests-Zeile holen
  const { data: testRow, error: testErr } = await adminClient
    .from("crs_tests")
    .select(
      "id, athlete_id, status, completed_at, burpees_60s, squats_60s, pushups_60s, plank_sec, high_knees_contacts, score, rank_label, archetype",
    )
    .eq("id", body.test_id)
    .maybeSingle<CrsTestRow>();
  if (testErr) {
    return jsonResponse({ error: "db_error", detail: testErr.message }, 500);
  }
  if (!testRow) {
    return jsonResponse({ error: "test_not_found" }, 404);
  }
  if (testRow.athlete_id !== userId) {
    return jsonResponse({ error: "forbidden" }, 403);
  }
  if (testRow.status !== "completed") {
    return jsonResponse({ error: "test_not_completed" }, 409);
  }

  // Idempotent: schon berechnet → vorhandene Werte zurueckgeben
  if (testRow.score !== null) {
    return jsonResponse(
      {
        score: testRow.score,
        rank_label: testRow.rank_label,
        archetype: testRow.archetype,
        already_computed: true,
      },
      200,
    );
  }

  // 2) Profil + Norms
  const { data: profileRow, error: profileErr } = await adminClient
    .from("athlete_profiles")
    .select("weight_kg, birth_date, gender")
    .eq("id", userId)
    .maybeSingle<AthleteProfile>();
  if (profileErr) {
    return jsonResponse({ error: "db_error", detail: profileErr.message }, 500);
  }
  const profile: AthleteProfile = profileRow ?? {
    weight_kg: null,
    birth_date: null,
    gender: null,
  };

  const { data: normRows, error: normErr } = await adminClient
    .from("crs_norms")
    .select("exercise, base_target, weight_factor_curve, age_factor_curve, gender_factor")
    .returns<CrsNormRow[]>();
  if (normErr || !normRows) {
    return jsonResponse({ error: "norms_unavailable", detail: normErr?.message }, 500);
  }

  // 3) Score berechnen
  const raw: CrsRawValues = {
    burpees_60s: testRow.burpees_60s,
    squats_60s: testRow.squats_60s,
    pushups_60s: testRow.pushups_60s,
    plank_sec: testRow.plank_sec,
    high_knees_contacts: testRow.high_knees_contacts,
  };
  const refDate = testRow.completed_at ? new Date(testRow.completed_at) : new Date();
  const result = computeCrsScore({ raw, norms: normRows, profile, refDate });

  // 4) Persist
  const { error: updateErr } = await adminClient
    .from("crs_tests")
    .update({
      score: result.score,
      rank_label: result.rank?.letter ?? null,
      archetype: result.archetype,
    })
    .eq("id", testRow.id);
  if (updateErr) {
    return jsonResponse({ error: "update_failed", detail: updateErr.message }, 500);
  }

  // Audit-Log: nicht von CLAUDE.md §0.7 gefordert (Score-Berechnung
  // veraendert keine Permissions / Engagements / Accounts) und audit.events
  // ist nicht ueber supabase-js erreichbar (anderes Schema). Bei Bedarf
  // spaeter via SECURITY-DEFINER-RPC nachruesten.

  return jsonResponse({
    score: result.score,
    rank_label: result.rank?.letter ?? null,
    rank_name: result.rank?.name ?? null,
    archetype: result.archetype,
    per_exercise: result.per_exercise,
    invalid_reason: result.invalid_reason,
    reduced_scope: result.reduced_scope,
  });
});
