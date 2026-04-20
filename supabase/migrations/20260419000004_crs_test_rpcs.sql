-- ============================================================
-- READY 2 FIGHT — CRS-Test RPCs (Roadmap-Schritt 1.15)
--
-- Vier RPCs fuer die Test-State-Machine. Persistenz in public.crs_tests.
-- Score / Rang / Archetyp-Berechnung ist Schritt 1.17 (Edge Function)
-- und bleibt hier ausgespart.
--
-- 1) start_crs_test(p_client_uuid UUID)     -> UUID
-- 2) save_crs_exercise(p_test_id, ex, val)  -> VOID
-- 3) complete_crs_test(p_test_id)           -> VOID
-- 4) abort_crs_test(p_test_id)              -> VOID
--
-- Alle RPCs: SECURITY DEFINER, auth.uid()-gated, Audit-Log je Event.
--
-- ASSUMPTION: Spalte `burpees_30s` laeuft entgegen PRD §06 auf einem
-- 60-s-Wert. Rename folgt mit §1.17 (Score-Berechnung), wenn die Basis-
-- werte aus crs_norms angebunden werden — siehe Followup in ROADMAP.
-- ============================================================


-- ############################################################
-- 1. start_crs_test
-- ############################################################

CREATE OR REPLACE FUNCTION public.start_crs_test(p_client_uuid UUID DEFAULT NULL)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_role    TEXT;
  v_id      UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT role INTO v_role FROM public.users WHERE id = v_uid;
  IF v_role IS NULL OR v_role NOT IN ('athlete', 'both') THEN
    RAISE EXCEPTION 'only_athletes_can_test';
  END IF;

  IF p_client_uuid IS NOT NULL THEN
    SELECT id INTO v_id
      FROM public.crs_tests
     WHERE athlete_id  = v_uid
       AND client_uuid = p_client_uuid
       AND status      = 'in_progress'
     LIMIT 1;
    IF v_id IS NOT NULL THEN
      RETURN v_id;
    END IF;
  END IF;

  INSERT INTO public.crs_tests(athlete_id, status, client_uuid)
    VALUES (v_uid, 'in_progress', p_client_uuid)
    RETURNING id INTO v_id;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('crs_test_started', v_uid, v_id,
            jsonb_build_object('client_uuid', p_client_uuid));

  RETURN v_id;
END $$;

REVOKE ALL ON FUNCTION public.start_crs_test(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.start_crs_test(UUID) TO authenticated;


-- ############################################################
-- 2. save_crs_exercise
--    Plausibilitaets-Upper-Bounds (PRD Anhang B: Server lehnt Werte
--    ueber plausibler Obergrenze ab).
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
     SET burpees_30s         = CASE WHEN p_exercise = 'burpees'    THEN p_value ELSE burpees_30s         END,
         squats_60s          = CASE WHEN p_exercise = 'squats'     THEN p_value ELSE squats_60s          END,
         pushups_60s         = CASE WHEN p_exercise = 'pushups'    THEN p_value ELSE pushups_60s         END,
         plank_sec           = CASE WHEN p_exercise = 'plank'      THEN p_value ELSE plank_sec           END,
         high_knees_contacts = CASE WHEN p_exercise = 'high_knees' THEN p_value ELSE high_knees_contacts END
   WHERE id = p_test_id;
END $$;

REVOKE ALL ON FUNCTION public.save_crs_exercise(UUID, TEXT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_crs_exercise(UUID, TEXT, INT) TO authenticated;


-- ############################################################
-- 3. complete_crs_test
--    Score/Rank/Archetype-Berechnung ist Schritt 1.17. Hier nur
--    Status-Uebergang + completed_at.
-- ############################################################

CREATE OR REPLACE FUNCTION public.complete_crs_test(p_test_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_row  public.crs_tests%ROWTYPE;
  v_ts   TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
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
     SET status       = 'completed',
         completed_at = now()
   WHERE id = p_test_id
   RETURNING completed_at INTO v_ts;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('crs_test_completed', v_uid, p_test_id, '{}'::jsonb);

  RETURN v_ts;
END $$;

REVOKE ALL ON FUNCTION public.complete_crs_test(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.complete_crs_test(UUID) TO authenticated;


-- ############################################################
-- 4. abort_crs_test
-- ############################################################

CREATE OR REPLACE FUNCTION public.abort_crs_test(p_test_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid  UUID := auth.uid();
  v_row  public.crs_tests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
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
     SET status = 'aborted'
   WHERE id = p_test_id;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('crs_test_aborted', v_uid, p_test_id, '{}'::jsonb);
END $$;

REVOKE ALL ON FUNCTION public.abort_crs_test(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.abort_crs_test(UUID) TO authenticated;
