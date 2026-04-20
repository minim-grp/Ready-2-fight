-- ============================================================
-- READY 2 FIGHT — pgTAP: CRS-Test RPCs
-- Roadmap-Schritt 1.15.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(18);

CREATE SCHEMA IF NOT EXISTS tests;

-- Reuse-Helper (falls 00007 nicht vor uns lief)
CREATE OR REPLACE FUNCTION tests.create_user(
  p_id UUID, p_email TEXT, p_role TEXT DEFAULT 'athlete', p_display_name TEXT DEFAULT NULL
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
  RETURN ok(_caught AND (_state = p_expected_state OR _msg = p_expected_state), p_desc);
END $$;


-- ############################################################
-- Fixtures: Athlet A, Athlet B, Coach C (Coach darf keinen Test starten)
-- ############################################################

SELECT tests.create_user('a1111111-1111-1111-1111-a11111111111', 'crs_aA@test.r2f',  'athlete', 'CRS AthA');
SELECT tests.create_user('a2222222-2222-2222-2222-a22222222222', 'crs_aB@test.r2f',  'athlete', 'CRS AthB');
SELECT tests.create_user('c3333333-3333-3333-3333-c33333333333', 'crs_cC@test.r2f',  'coach',   'CRS CoachC');

INSERT INTO public.athlete_profiles (id) VALUES
  ('a1111111-1111-1111-1111-a11111111111'),
  ('a2222222-2222-2222-2222-a22222222222')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.coach_profiles (id) VALUES
  ('c3333333-3333-3333-3333-c33333333333')
ON CONFLICT (id) DO NOTHING;


-- ############################################################
-- T1: start_crs_test legt Row mit status=in_progress an
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a1111111-1111-1111-1111-a11111111111","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.start_crs_test(NULL)$$,
  'start_crs_test: Athlet startet Test (+)');

RESET ROLE;

SELECT is(
  (SELECT count(*)::int FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111' AND status = 'in_progress'),
  1,
  'start_crs_test: exakt 1 in_progress-Row');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'crs_test_started'
      AND actor_id = 'a1111111-1111-1111-1111-a11111111111'),
  'start_crs_test: audit-Eintrag geschrieben');


-- ############################################################
-- T2: Coach darf keinen Test starten
-- ############################################################

SELECT tests.throws_with_state(
  'c3333333-3333-3333-3333-c33333333333',
  $$SELECT public.start_crs_test(NULL)$$,
  'only_athletes_can_test',
  'start_crs_test: Coach wird abgelehnt (-)');


-- ############################################################
-- T3: client_uuid-Idempotenz — zweimaliger Start mit gleicher UUID
--     liefert dieselbe Test-ID zurueck
-- ############################################################

DO $$
DECLARE
  v_id1 UUID;
  v_id2 UUID;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'a2222222-2222-2222-2222-a22222222222', 'role', 'authenticated')::text);

  SELECT public.start_crs_test('11111111-2222-3333-4444-555555555555'::uuid) INTO v_id1;
  SELECT public.start_crs_test('11111111-2222-3333-4444-555555555555'::uuid) INTO v_id2;

  PERFORM ok(v_id1 = v_id2, 'start_crs_test: idempotent via client_uuid (+)');
  EXECUTE 'RESET ROLE';
END $$;


-- ############################################################
-- T4..T6: save_crs_exercise — Happy Path + Validierung
-- ############################################################

DO $$
DECLARE
  v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;

  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'a1111111-1111-1111-1111-a11111111111', 'role', 'authenticated')::text);

  PERFORM public.save_crs_exercise(v_id, 'burpees',    20);
  PERFORM public.save_crs_exercise(v_id, 'squats',     45);
  PERFORM public.save_crs_exercise(v_id, 'pushups',    30);
  PERFORM public.save_crs_exercise(v_id, 'plank',      55);
  PERFORM public.save_crs_exercise(v_id, 'high_knees', 85);

  EXECUTE 'RESET ROLE';

  PERFORM ok(
    (SELECT burpees_30s         FROM public.crs_tests WHERE id = v_id) = 20 AND
    (SELECT squats_60s          FROM public.crs_tests WHERE id = v_id) = 45 AND
    (SELECT pushups_60s         FROM public.crs_tests WHERE id = v_id) = 30 AND
    (SELECT plank_sec           FROM public.crs_tests WHERE id = v_id) = 55 AND
    (SELECT high_knees_contacts FROM public.crs_tests WHERE id = v_id) = 85,
    'save_crs_exercise: alle fuenf Uebungen persistiert (+)');
END $$;


-- T5: ungueltige Uebung
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;
  PERFORM tests.throws_with_state(
    'a1111111-1111-1111-1111-a11111111111',
    format($q$SELECT public.save_crs_exercise(%L::uuid, 'deadlift', 10)$q$, v_id),
    'invalid_exercise',
    'save_crs_exercise: unbekannte Uebung abgelehnt (-)');
END $$;

-- T6: Wert ueber Obergrenze
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;
  PERFORM tests.throws_with_state(
    'a1111111-1111-1111-1111-a11111111111',
    format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', 9999)$q$, v_id),
    'value_out_of_range',
    'save_crs_exercise: unplausibel hoher Wert abgelehnt (-)');
END $$;

-- T7: negativer Wert
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;
  PERFORM tests.throws_with_state(
    'a1111111-1111-1111-1111-a11111111111',
    format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', -1)$q$, v_id),
    'invalid_value',
    'save_crs_exercise: negativer Wert abgelehnt (-)');
END $$;

-- T8: fremder Athlet darf nicht speichern
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;
  PERFORM tests.throws_with_state(
    'a2222222-2222-2222-2222-a22222222222',
    format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', 10)$q$, v_id),
    'test_not_found',
    'save_crs_exercise: fremder Athlet abgelehnt (-)');
END $$;


-- ############################################################
-- T9..T11: complete_crs_test
-- ############################################################

DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'in_progress'
    LIMIT 1;

  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'a1111111-1111-1111-1111-a11111111111', 'role', 'authenticated')::text);

  PERFORM public.complete_crs_test(v_id);

  EXECUTE 'RESET ROLE';

  PERFORM ok(
    (SELECT status FROM public.crs_tests WHERE id = v_id) = 'completed',
    'complete_crs_test: status=completed (+)');
  PERFORM ok(
    (SELECT completed_at FROM public.crs_tests WHERE id = v_id) IS NOT NULL,
    'complete_crs_test: completed_at gesetzt (+)');
  PERFORM ok(
    EXISTS(SELECT 1 FROM audit.events WHERE event_type = 'crs_test_completed' AND target_id = v_id),
    'complete_crs_test: audit-Eintrag geschrieben');
END $$;

-- T12: doppeltes Complete -> test_not_in_progress
DO $$
DECLARE v_id UUID;
BEGIN
  SELECT id INTO v_id FROM public.crs_tests
    WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
      AND status = 'completed'
    LIMIT 1;
  PERFORM tests.throws_with_state(
    'a1111111-1111-1111-1111-a11111111111',
    format($q$SELECT public.complete_crs_test(%L::uuid)$q$, v_id),
    'test_not_in_progress',
    'complete_crs_test: abgeschlossener Test kann nicht erneut (-)');
END $$;


-- ############################################################
-- T13..T15: abort_crs_test
-- ############################################################

DO $$
DECLARE v_id UUID;
BEGIN
  -- neuer Test fuer Abort-Szenario
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'a1111111-1111-1111-1111-a11111111111', 'role', 'authenticated')::text);

  SELECT public.start_crs_test(NULL) INTO v_id;
  PERFORM public.abort_crs_test(v_id);

  EXECUTE 'RESET ROLE';

  PERFORM ok(
    (SELECT status FROM public.crs_tests WHERE id = v_id) = 'aborted',
    'abort_crs_test: status=aborted (+)');
  PERFORM ok(
    EXISTS(SELECT 1 FROM audit.events WHERE event_type = 'crs_test_aborted' AND target_id = v_id),
    'abort_crs_test: audit-Eintrag geschrieben');

  -- Doppeltes Abort -> test_not_in_progress
  PERFORM tests.throws_with_state(
    'a1111111-1111-1111-1111-a11111111111',
    format($q$SELECT public.abort_crs_test(%L::uuid)$q$, v_id),
    'test_not_in_progress',
    'abort_crs_test: bereits abgebrochener Test (-)');
END $$;


-- ############################################################
-- T16: Nicht-authentifiziert -> not_authenticated
-- ############################################################

SELECT tests.throws_with_state(
  NULL,
  $$SELECT public.start_crs_test(NULL)$$,
  'not_authenticated',
  'start_crs_test: ohne JWT abgelehnt (-)');


SELECT * FROM finish();
ROLLBACK;
