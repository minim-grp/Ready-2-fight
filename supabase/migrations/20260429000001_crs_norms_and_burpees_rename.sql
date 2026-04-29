-- ============================================================
-- READY 2 FIGHT — CRS Norms + Burpees-Rename (Roadmap §1.17 Vorbereitung)
--
-- 1) public.crs_norms anlegen (PRD §07: neu) + Seed mit den fuenf
--    Basis-Zielwerten aus Anhang B + Faktor-Kurven (PRD: Heuristiken,
--    in DB anpassbar ohne Code-Deploy). Default-Deny RLS, SELECT
--    fuer authenticated (Norm-Werte sind oeffentlich, Hilfe → CRS-
--    Methodik verlinkt sie).
-- 2) Spalten-Rename `crs_tests.burpees_30s` → `burpees_60s` (PRD §06:
--    Burpees-Messung in 60 s; Followup #6 aus Sprint-Stand-Memory).
-- 3) save_crs_exercise an neue Spalte angleichen.
--
-- ASSUMPTION: Die konkreten Stuetzstellen der Faktor-Kurven sind im
-- PRD nicht numerisch fixiert ("Heuristiken, kalibriert fuer 25 J /
-- 75 kg / maennlich = 1.00"). Werte unten orientieren sich an gaengigen
-- ACSM-aehnlichen Normen — Anpassung ueber UPDATE auf crs_norms moeglich,
-- ohne Migration. Faktor < 1 bedeutet niedrigerer Zielwert (Score
-- bleibt erreichbar fuer schwerere/aeltere/weibliche Athleten).
-- ============================================================


-- ############################################################
-- 1. crs_norms-Tabelle
-- ############################################################

CREATE TABLE IF NOT EXISTS public.crs_norms (
  exercise              TEXT PRIMARY KEY
                          CHECK (exercise IN ('burpees','squats','pushups','plank','high_knees')),
  base_target           NUMERIC NOT NULL CHECK (base_target > 0),
  -- Stuetzstellen [{kg|age: NUM, factor: NUM}], Server interpoliert linear
  weight_factor_curve   JSONB NOT NULL,
  age_factor_curve      JSONB NOT NULL,
  -- Map gender → factor
  gender_factor         JSONB NOT NULL,
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.crs_norms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS crs_norms_read ON public.crs_norms;
CREATE POLICY crs_norms_read ON public.crs_norms
  FOR SELECT TO authenticated USING (true);

REVOKE ALL ON public.crs_norms FROM PUBLIC;
GRANT SELECT ON public.crs_norms TO authenticated;


-- ############################################################
-- 2. Seed (PRD Anhang B + ACSM-aehnliche Faktor-Heuristiken)
-- ############################################################

INSERT INTO public.crs_norms (exercise, base_target, weight_factor_curve, age_factor_curve, gender_factor) VALUES
  ('burpees', 25,
   '[{"kg":50,"factor":1.05},{"kg":65,"factor":1.02},{"kg":75,"factor":1.00},{"kg":90,"factor":0.96},{"kg":110,"factor":0.92}]'::jsonb,
   '[{"age":16,"factor":1.00},{"age":25,"factor":1.00},{"age":35,"factor":0.96},{"age":45,"factor":0.90},{"age":55,"factor":0.84},{"age":65,"factor":0.78}]'::jsonb,
   '{"male":1.00,"female":0.78,"other":0.89,"prefer_not_to_say":0.89}'::jsonb),
  ('squats', 50,
   '[{"kg":50,"factor":1.04},{"kg":65,"factor":1.02},{"kg":75,"factor":1.00},{"kg":90,"factor":0.97},{"kg":110,"factor":0.94}]'::jsonb,
   '[{"age":16,"factor":1.00},{"age":25,"factor":1.00},{"age":35,"factor":0.96},{"age":45,"factor":0.92},{"age":55,"factor":0.86},{"age":65,"factor":0.80}]'::jsonb,
   '{"male":1.00,"female":0.86,"other":0.93,"prefer_not_to_say":0.93}'::jsonb),
  ('pushups', 35,
   '[{"kg":50,"factor":1.06},{"kg":65,"factor":1.03},{"kg":75,"factor":1.00},{"kg":90,"factor":0.95},{"kg":110,"factor":0.90}]'::jsonb,
   '[{"age":16,"factor":1.00},{"age":25,"factor":1.00},{"age":35,"factor":0.95},{"age":45,"factor":0.88},{"age":55,"factor":0.80},{"age":65,"factor":0.72}]'::jsonb,
   '{"male":1.00,"female":0.65,"other":0.82,"prefer_not_to_say":0.82}'::jsonb),
  ('plank', 60,
   '[{"kg":50,"factor":1.02},{"kg":65,"factor":1.01},{"kg":75,"factor":1.00},{"kg":90,"factor":0.98},{"kg":110,"factor":0.96}]'::jsonb,
   '[{"age":16,"factor":1.00},{"age":25,"factor":1.00},{"age":35,"factor":0.98},{"age":45,"factor":0.94},{"age":55,"factor":0.90},{"age":65,"factor":0.86}]'::jsonb,
   '{"male":1.00,"female":0.92,"other":0.96,"prefer_not_to_say":0.96}'::jsonb),
  ('high_knees', 100,
   '[{"kg":50,"factor":1.05},{"kg":65,"factor":1.02},{"kg":75,"factor":1.00},{"kg":90,"factor":0.96},{"kg":110,"factor":0.92}]'::jsonb,
   '[{"age":16,"factor":1.00},{"age":25,"factor":1.00},{"age":35,"factor":0.96},{"age":45,"factor":0.90},{"age":55,"factor":0.84},{"age":65,"factor":0.78}]'::jsonb,
   '{"male":1.00,"female":0.88,"other":0.94,"prefer_not_to_say":0.94}'::jsonb)
ON CONFLICT (exercise) DO NOTHING;


-- ############################################################
-- 3. Spalten-Rename burpees_30s → burpees_60s
-- ############################################################

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'crs_tests'
       AND column_name  = 'burpees_30s'
  ) THEN
    ALTER TABLE public.crs_tests RENAME COLUMN burpees_30s TO burpees_60s;
  END IF;
END $$;

ALTER TABLE public.crs_tests
  DROP CONSTRAINT IF EXISTS crs_tests_burpees_30s_check;
ALTER TABLE public.crs_tests
  DROP CONSTRAINT IF EXISTS crs_tests_burpees_60s_check;
ALTER TABLE public.crs_tests
  ADD CONSTRAINT crs_tests_burpees_60s_check
  CHECK (burpees_60s IS NULL OR burpees_60s >= 0);


-- ############################################################
-- 4. save_crs_exercise auf neue Spalte umbiegen
-- ############################################################

CREATE OR REPLACE FUNCTION public.save_crs_exercise(
  p_test_id  UUID,
  p_exercise TEXT,
  p_value    INT
)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_row    public.crs_tests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_value IS NULL OR p_value < 0 THEN
    RAISE EXCEPTION 'invalid_value';
  END IF;

  IF p_exercise NOT IN ('burpees', 'squats', 'pushups', 'plank', 'high_knees') THEN
    RAISE EXCEPTION 'invalid_exercise';
  END IF;

  IF (p_exercise = 'burpees'    AND p_value > 100) OR
     (p_exercise = 'squats'     AND p_value > 200) OR
     (p_exercise = 'pushups'    AND p_value > 200) OR
     (p_exercise = 'plank'      AND p_value > 600) OR
     (p_exercise = 'high_knees' AND p_value > 400)
  THEN
    RAISE EXCEPTION 'value_out_of_range';
  END IF;

  SELECT * INTO v_row FROM public.crs_tests
   WHERE id = p_test_id FOR UPDATE;

  IF NOT FOUND OR v_row.athlete_id <> v_uid THEN
    RAISE EXCEPTION 'test_not_found';
  END IF;

  IF v_row.status <> 'in_progress' THEN
    RAISE EXCEPTION 'test_not_in_progress';
  END IF;

  UPDATE public.crs_tests
     SET burpees_60s         = CASE WHEN p_exercise = 'burpees'    THEN p_value ELSE burpees_60s         END,
         squats_60s          = CASE WHEN p_exercise = 'squats'     THEN p_value ELSE squats_60s          END,
         pushups_60s         = CASE WHEN p_exercise = 'pushups'    THEN p_value ELSE pushups_60s         END,
         plank_sec           = CASE WHEN p_exercise = 'plank'      THEN p_value ELSE plank_sec           END,
         high_knees_contacts = CASE WHEN p_exercise = 'high_knees' THEN p_value ELSE high_knees_contacts END
   WHERE id = p_test_id;
END $$;

REVOKE ALL ON FUNCTION public.save_crs_exercise(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_crs_exercise(UUID, TEXT, INT) TO authenticated;
