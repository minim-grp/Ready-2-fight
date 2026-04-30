-- ============================================================
-- READY 2 FIGHT — RPC public.clone_plan (Roadmap §1.21)
--
-- Coach kann ein eigenes Template duplizieren ("Als meinen Plan
-- kopieren"). Source darf Template ODER eigener zugewiesener Plan
-- sein, solange owner_id = auth.uid(). Kopie wird:
--   - is_template = true (frische Vorlage, keine Athlet-Bindung)
--   - athlete_id  = NULL
--   - title       = "<Original-Titel> (Kopie)"
--   - archived_at = NULL
-- Sessions + Exercises werden in derselben Transaktion mitkopiert,
-- inkl. position und day_offset (Reihenfolge bleibt 1:1).
--
-- SECURITY DEFINER: Kopie laeuft als Service-Role, aber owner_id
-- wird hart auf v_uid gesetzt. Pre-Check verlangt owner_id = v_uid
-- am Source — verhindert privilege escalation auf fremde Plaene.
-- ============================================================

CREATE OR REPLACE FUNCTION public.clone_plan(p_plan_id UUID)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_source    public.training_plans%ROWTYPE;
  v_new_id    UUID := gen_random_uuid();
  v_session   RECORD;
  v_new_sess  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_source FROM public.training_plans WHERE id = p_plan_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'plan_not_found';
  END IF;

  IF v_source.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- 1) Plan-Kopie als frisches Template
  INSERT INTO public.training_plans (
    id, owner_id, athlete_id, engagement_id, title, description,
    is_template, archived_at, starts_on, ends_on
  ) VALUES (
    v_new_id, v_uid, NULL, NULL,
    left(v_source.title || ' (Kopie)', 200),
    v_source.description, true, NULL,
    v_source.starts_on, v_source.ends_on
  );

  -- 2) Sessions kopieren (mit gemerkter ID-Mapping fuer Exercises)
  FOR v_session IN
    SELECT id, day_offset, title, notes, position
      FROM public.training_sessions
     WHERE plan_id = p_plan_id
     ORDER BY position, day_offset
  LOOP
    v_new_sess := gen_random_uuid();
    INSERT INTO public.training_sessions
      (id, plan_id, day_offset, title, notes, position)
    VALUES
      (v_new_sess, v_new_id, v_session.day_offset, v_session.title,
       v_session.notes, v_session.position);

    INSERT INTO public.training_exercises
      (session_id, name, sets, reps, weight_kg, duration_sec, rest_sec, notes, position)
    SELECT v_new_sess, name, sets, reps, weight_kg, duration_sec, rest_sec, notes, position
      FROM public.training_exercises
     WHERE session_id = v_session.id;
  END LOOP;

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.clone_plan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.clone_plan(UUID) TO authenticated;
