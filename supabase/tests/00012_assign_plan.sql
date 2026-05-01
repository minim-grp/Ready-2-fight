-- ============================================================
-- READY 2 FIGHT — pgTAP: public.assign_plan (Roadmap §1.22a)
--
-- Pruefungen:
-- 1) Funktion existiert mit Signatur (UUID,UUID,UUID) RETURNS UUID
-- 2) Erfolgsfall: Coach weist eigenes Template einem Athleten via
--    aktivem Engagement zu -> neuer Plan mit korrekten Defaults
--    (is_template=false, athlete_id, engagement_id, archived_at=NULL,
--    Title ohne "(Kopie)"), inkl. Sessions+Exercises.
-- 3) Athlet sieht zugewiesenen Plan via tp_athlete_read.
-- 4) Audit-Event 'plan_assigned' geschrieben.
-- 5) Original-Template ist unveraendert.
-- 6) Fehlerfaelle:
--    - not_authenticated (kein JWT)
--    - template_not_found (unbekannte Template-ID)
--    - forbidden_owner    (Template eines fremden Coaches)
--    - engagement_not_active (Engagement paused / falscher Athlet)
--    - permission_denied  (can_create_plans = false)
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(15);

CREATE SCHEMA IF NOT EXISTS tests;

CREATE OR REPLACE FUNCTION tests.create_user(
  p_id UUID, p_email TEXT, p_role TEXT DEFAULT 'coach', p_display_name TEXT DEFAULT NULL
) RETURNS UUID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, auth, extensions AS $$
BEGIN
  INSERT INTO auth.users (
    id, instance_id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_user_meta_data, created_at, updated_at
  ) VALUES (
    p_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    p_email, crypt('TestPassword123!', gen_salt('bf')), now(),
    jsonb_build_object(
      'display_name', COALESCE(p_display_name, split_part(p_email, '@', 1)),
      'role', p_role),
    now(), now()
  );
  RETURN p_id;
END $$;

CREATE OR REPLACE FUNCTION tests.throws_with_state(
  p_user_id UUID, p_sql TEXT, p_expected_state TEXT, p_desc TEXT
) RETURNS TEXT LANGUAGE plpgsql AS $$
DECLARE
  _caught boolean := false;
  _state text;
  _msg text;
BEGIN
  BEGIN
    IF p_user_id IS NOT NULL THEN
      EXECUTE 'SET LOCAL ROLE authenticated';
      EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
        json_build_object('sub', p_user_id, 'role', 'authenticated')::text);
    END IF;
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    _caught := true;
  END;
  IF p_user_id IS NOT NULL THEN
    EXECUTE 'RESET ROLE';
  END IF;
  RETURN ok(_caught AND (_state = p_expected_state OR _msg = p_expected_state OR p_expected_state = '*'),
            p_desc);
END $$;


-- ############################################################
-- 1. Setup: zwei Coaches, ein Athlet, athlete_profile, Engagements
-- ############################################################

-- CoachA, CoachB, Athlet1
SELECT tests.create_user('aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
                         'assign_a@test.r2f', 'coach', 'CoachA');
SELECT tests.create_user('aaaa2222-2222-2222-2222-aaaaaaaaaaaa',
                         'assign_b@test.r2f', 'coach', 'CoachB');
SELECT tests.create_user('aaaa3333-3333-3333-3333-aaaaaaaaaaaa',
                         'assign_ath@test.r2f', 'athlete', 'Ath1');

DO $$
DECLARE
  v_plan       UUID := 'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID;
  v_other_plan UUID := 'bbbb2222-2222-2222-2222-bbbbbbbbbbbb'::UUID;
  v_s1         UUID := 'cccc1111-1111-1111-1111-cccccccccccc'::UUID;
  v_s2         UUID := 'cccc2222-2222-2222-2222-cccccccccccc'::UUID;
  v_eng_ok     UUID := 'dddd1111-1111-1111-1111-dddddddddddd'::UUID;
  v_eng_paused UUID := 'dddd2222-2222-2222-2222-dddddddddddd'::UUID;
  v_eng_noperm UUID := 'dddd3333-3333-3333-3333-dddddddddddd'::UUID;
BEGIN
  -- Athlete-Profile (training_plans.athlete_id -> athlete_profiles.id)
  -- on_auth_user_created-Trigger legt es bei role='athlete' bereits an
  INSERT INTO public.athlete_profiles (id) VALUES
    ('aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID)
  ON CONFLICT (id) DO NOTHING;

  -- CoachA-Template + 2 Sessions + 3 Exercises
  INSERT INTO public.training_plans (id, owner_id, athlete_id, title, description, is_template)
  VALUES (v_plan, 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa'::UUID, NULL,
          'Boxen 4 Wochen', 'Aufbau', true);

  INSERT INTO public.training_sessions (id, plan_id, day_offset, title, notes, position) VALUES
    (v_s1, v_plan, 0, 'Tag 1', 'Warm-up', 0),
    (v_s2, v_plan, 1, 'Tag 2', NULL,      1);

  INSERT INTO public.training_exercises (session_id, name, sets, reps, weight_kg, position) VALUES
    (v_s1, 'Bankdruecken', 4, 8,  80,  0),
    (v_s1, 'Klimmzuege',   4, 10, NULL, 1),
    (v_s2, 'Squats',       5, 5,  100, 0);

  -- CoachB-Template (fremder Owner)
  INSERT INTO public.training_plans (id, owner_id, athlete_id, title, is_template)
  VALUES (v_other_plan, 'aaaa2222-2222-2222-2222-aaaaaaaaaaaa'::UUID, NULL,
          'Krafttraining', true);

  -- Engagements werden vom validate_engagement_insert-Trigger immer
  -- auf 'pending' gesetzt; Status-Wechsel danach via UPDATE (ohne
  -- auth.uid() greift validate_engagement_update nicht).
  INSERT INTO public.coach_athlete_engagements
    (id, coach_id, athlete_id, can_create_plans, started_at)
  VALUES
    (v_eng_ok, 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID, true, now());
  UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = v_eng_ok;

  -- Pausiertes Engagement (anderer purpose, wegen unique-Index)
  INSERT INTO public.coach_athlete_engagements
    (id, coach_id, athlete_id, purpose, can_create_plans, started_at)
  VALUES
    (v_eng_paused, 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID, 'technique', true, now());
  UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = v_eng_paused;
  UPDATE public.coach_athlete_engagements SET status = 'paused' WHERE id = v_eng_paused;

  -- Aktiv aber can_create_plans=false (CoachB <-> Athlet1)
  INSERT INTO public.coach_athlete_engagements
    (id, coach_id, athlete_id, can_create_plans, started_at)
  VALUES
    (v_eng_noperm, 'aaaa2222-2222-2222-2222-aaaaaaaaaaaa'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID, false, now());
  UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = v_eng_noperm;
END $$;


-- ############################################################
-- 2. Schema-Asserts
-- ############################################################

SELECT has_function('public', 'assign_plan', ARRAY['uuid','uuid','uuid'],
  'public.assign_plan(uuid,uuid,uuid) existiert');


-- ############################################################
-- 3. Erfolgsfall: CoachA weist sein Template Athlet1 zu
-- ############################################################

DO $$
DECLARE v_new UUID;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
                      'role', 'authenticated')::text);
  v_new := public.assign_plan(
    'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID,  -- template
    'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,  -- athlete
    'dddd1111-1111-1111-1111-dddddddddddd'::UUID); -- engagement
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _assigned(id UUID);
  INSERT INTO _assigned VALUES (v_new);
END $$;

SELECT isnt(
  (SELECT id FROM _assigned),
  'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID,
  'Zugewiesener Plan hat eine andere ID als das Template'
);

SELECT is(
  (SELECT title FROM public.training_plans WHERE id = (SELECT id FROM _assigned)),
  'Boxen 4 Wochen',
  'Title bleibt unveraendert (kein "(Kopie)"-Suffix)'
);

SELECT is(
  (SELECT is_template FROM public.training_plans WHERE id = (SELECT id FROM _assigned)),
  false,
  'Zugewiesener Plan ist kein Template'
);

SELECT is(
  (SELECT athlete_id FROM public.training_plans WHERE id = (SELECT id FROM _assigned)),
  'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
  'athlete_id ist gesetzt'
);

SELECT is(
  (SELECT engagement_id FROM public.training_plans WHERE id = (SELECT id FROM _assigned)),
  'dddd1111-1111-1111-1111-dddddddddddd'::UUID,
  'engagement_id ist gesetzt'
);

SELECT is(
  (SELECT count(*)::int FROM public.training_sessions WHERE plan_id = (SELECT id FROM _assigned)),
  2,
  'Beide Sessions wurden mitkopiert'
);

SELECT is(
  (SELECT count(*)::int FROM public.training_exercises e
     JOIN public.training_sessions s ON s.id = e.session_id
    WHERE s.plan_id = (SELECT id FROM _assigned)),
  3,
  'Alle drei Exercises wurden mitkopiert'
);


-- ############################################################
-- 4. tp_athlete_read: Athlet sieht den zugewiesenen Plan
-- ############################################################

DO $$
DECLARE
  v_visible    BOOLEAN;
  v_assigned_id UUID;
BEGIN
  SELECT id INTO v_assigned_id FROM _assigned;
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'aaaa3333-3333-3333-3333-aaaaaaaaaaaa',
                      'role', 'authenticated')::text);
  SELECT EXISTS (
    SELECT 1 FROM public.training_plans WHERE id = v_assigned_id
  ) INTO v_visible;
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _athlete_can_read(v BOOLEAN);
  INSERT INTO _athlete_can_read VALUES (v_visible);
END $$;

SELECT is(
  (SELECT v FROM _athlete_can_read),
  true,
  'Athlet sieht zugewiesenen Plan via tp_athlete_read'
);


-- ############################################################
-- 5. Audit-Event 'plan_assigned' wurde geschrieben
-- ############################################################

SELECT is(
  (SELECT count(*)::int FROM audit.events
    WHERE event_type = 'plan_assigned'
      AND actor_id   = 'aaaa1111-1111-1111-1111-aaaaaaaaaaaa'::UUID
      AND target_id  = (SELECT id FROM _assigned)),
  1,
  'Audit-Event plan_assigned mit korrektem actor+target'
);


-- ############################################################
-- 6. Original-Template unveraendert
-- ############################################################

SELECT is(
  (SELECT count(*)::int FROM public.training_sessions
    WHERE plan_id = 'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID),
  2,
  'Original-Template hat weiterhin 2 Sessions (kein Mutation)'
);


-- ############################################################
-- 7. Fehlerfaelle
-- ############################################################

-- forbidden_owner: CoachA versucht CoachB-Template zuzuweisen
SELECT tests.throws_with_state(
  'aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
  $sql$ SELECT public.assign_plan(
    'bbbb2222-2222-2222-2222-bbbbbbbbbbbb'::UUID,
    'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
    'dddd1111-1111-1111-1111-dddddddddddd'::UUID) $sql$,
  'forbidden_owner',
  'Fremdes Template -> forbidden_owner'
);

-- template_not_found
SELECT tests.throws_with_state(
  'aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
  $sql$ SELECT public.assign_plan(
    '99999999-9999-9999-9999-999999999999'::UUID,
    'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
    'dddd1111-1111-1111-1111-dddddddddddd'::UUID) $sql$,
  'template_not_found',
  'Unbekannte Template-ID -> template_not_found'
);

-- engagement_not_active: pausiertes Engagement
SELECT tests.throws_with_state(
  'aaaa1111-1111-1111-1111-aaaaaaaaaaaa',
  $sql$ SELECT public.assign_plan(
    'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID,
    'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
    'dddd2222-2222-2222-2222-dddddddddddd'::UUID) $sql$,
  'engagement_not_active',
  'Pausiertes Engagement -> engagement_not_active'
);

-- permission_denied: aktives Engagement aber can_create_plans=false (CoachB-Sicht)
-- CoachB hat ein eigenes Template (other_plan) und ein aktives Engagement
-- mit Athlet1 ohne can_create_plans
SELECT tests.throws_with_state(
  'aaaa2222-2222-2222-2222-aaaaaaaaaaaa',
  $sql$ SELECT public.assign_plan(
    'bbbb2222-2222-2222-2222-bbbbbbbbbbbb'::UUID,
    'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
    'dddd3333-3333-3333-3333-dddddddddddd'::UUID) $sql$,
  'permission_denied',
  'can_create_plans=false -> permission_denied'
);

-- not_authenticated
SELECT tests.throws_with_state(
  NULL,
  $sql$ DO $do$ BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SET LOCAL "request.jwt.claims" = ''{}''';
    PERFORM public.assign_plan(
      'bbbb1111-1111-1111-1111-bbbbbbbbbbbb'::UUID,
      'aaaa3333-3333-3333-3333-aaaaaaaaaaaa'::UUID,
      'dddd1111-1111-1111-1111-dddddddddddd'::UUID);
  END $do$; $sql$,
  'not_authenticated',
  'Ohne JWT -> not_authenticated'
);


SELECT * FROM finish();
ROLLBACK;
