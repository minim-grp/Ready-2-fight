-- ============================================================
-- READY 2 FIGHT — RPC public.assign_plan (Roadmap §1.22a)
--
-- Coach weist ein eigenes Template einem Athleten via aktivem
-- Engagement zu. Im Unterschied zu clone_plan entsteht keine
-- frische Vorlage, sondern ein "echter" zugewiesener Plan:
--   - is_template   = false
--   - athlete_id    = p_athlete_id (FK auf athlete_profiles.id)
--   - engagement_id = p_engagement_id
--   - archived_at   = NULL
--   - title         = original title (kein "(Kopie)"-Suffix)
--
-- Sessions + Exercises werden in derselben TX kopiert (Logik
-- analog clone_plan), Reihenfolge bleibt 1:1.
--
-- SECURITY DEFINER: laeuft als Service-Role; owner_id wird hart
-- auf v_uid gesetzt. Pre-Checks decken die Permissions ab:
--   - not_authenticated      auth.uid() IS NULL
--   - template_not_found     unbekannte Template-ID
--   - forbidden_owner        Template gehoert nicht v_uid
--   - engagement_not_active  Engagement nicht aktiv / falscher Athlet / falscher Coach
--   - permission_denied      Engagement.can_create_plans = false
--
-- Audit: 'plan_assigned'-Event vor RETURN (CLAUDE.md §0.7,
-- Permissions/Engagement-relevant).
-- ============================================================

CREATE OR REPLACE FUNCTION public.assign_plan(
  p_template_id   UUID,
  p_athlete_id    UUID,
  p_engagement_id UUID
)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid       UUID := auth.uid();
  v_source    public.training_plans%ROWTYPE;
  v_eng       public.coach_athlete_engagements%ROWTYPE;
  v_new_id    UUID := gen_random_uuid();
  v_session   RECORD;
  v_new_sess  UUID;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_source FROM public.training_plans WHERE id = p_template_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'template_not_found';
  END IF;

  IF v_source.owner_id <> v_uid THEN
    RAISE EXCEPTION 'forbidden_owner';
  END IF;

  SELECT * INTO v_eng FROM public.coach_athlete_engagements
   WHERE id         = p_engagement_id
     AND coach_id   = v_uid
     AND athlete_id = p_athlete_id
     AND status     = 'active';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'engagement_not_active';
  END IF;

  IF v_eng.can_create_plans IS NOT TRUE THEN
    RAISE EXCEPTION 'permission_denied';
  END IF;

  -- 1) Plan-Kopie als zugewiesener Plan
  INSERT INTO public.training_plans (
    id, owner_id, athlete_id, engagement_id, title, description,
    is_template, archived_at, starts_on, ends_on
  ) VALUES (
    v_new_id, v_uid, p_athlete_id, p_engagement_id,
    v_source.title, v_source.description,
    false, NULL,
    v_source.starts_on, v_source.ends_on
  );

  -- 2) Sessions kopieren (mit Mapping fuer Exercises)
  FOR v_session IN
    SELECT id, day_offset, title, notes, position
      FROM public.training_sessions
     WHERE plan_id = p_template_id
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

  -- 3) Audit-Event (vor RETURN, CLAUDE.md §0.7)
  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('plan_assigned', v_uid, v_new_id,
            jsonb_build_object(
              'plan_id',            v_new_id,
              'athlete_id',         p_athlete_id,
              'source_template_id', p_template_id,
              'engagement_id',      p_engagement_id));

  RETURN v_new_id;
END $$;

REVOKE ALL ON FUNCTION public.assign_plan(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.assign_plan(UUID, UUID, UUID) TO authenticated;
