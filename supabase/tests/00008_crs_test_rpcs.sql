-- ============================================================
-- READY 2 FIGHT — pgTAP: CRS-Test RPCs
-- Roadmap-Schritt 1.15.
--
-- Hinweis: pgTAP-Assertions muessen per SELECT auf Top-Level laufen.
-- `PERFORM ok(...)` innerhalb eines DO-Blocks verwirft die TAP-Zeile,
-- der interne Zaehler wandert trotzdem weiter — Folge: Plan-Mismatch
-- und "Tests out of sequence"-Parse-Error. Deshalb: Aktionen im DO,
-- Zustands-Assertions danach per SELECT auf dem DB-Zustand.
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
-- T1: start_crs_test legt Row mit status=in_progress an (3 Assertions)
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

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a2222222-2222-2222-2222-a22222222222","role":"authenticated"}';

SELECT ok(
  (SELECT public.start_crs_test('11111111-2222-3333-4444-555555555555'::uuid))
  =
  (SELECT public.start_crs_test('11111111-2222-3333-4444-555555555555'::uuid)),
  'start_crs_test: idempotent via client_uuid (+)');

RESET ROLE;


-- ############################################################
-- Test-ID fuer Athlet A in Temp-Tabelle cachen, damit Folge-Tests
-- sie per Subselect einsetzen koennen.
-- ############################################################

CREATE TEMP TABLE _crs_test_a1 ON COMMIT DROP AS
  SELECT id FROM public.crs_tests
   WHERE athlete_id = 'a1111111-1111-1111-1111-a11111111111'
     AND status = 'in_progress'
   LIMIT 1;


-- ############################################################
-- T4: save_crs_exercise — Happy Path, alle fuenf Uebungen
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a1111111-1111-1111-1111-a11111111111","role":"authenticated"}';

SELECT public.save_crs_exercise((SELECT id FROM _crs_test_a1), 'burpees',    20);
SELECT public.save_crs_exercise((SELECT id FROM _crs_test_a1), 'squats',     45);
SELECT public.save_crs_exercise((SELECT id FROM _crs_test_a1), 'pushups',    30);
SELECT public.save_crs_exercise((SELECT id FROM _crs_test_a1), 'plank',      55);
SELECT public.save_crs_exercise((SELECT id FROM _crs_test_a1), 'high_knees', 85);

RESET ROLE;

SELECT ok(
  (SELECT burpees_30s = 20
      AND squats_60s = 45
      AND pushups_60s = 30
      AND plank_sec = 55
      AND high_knees_contacts = 85
     FROM public.crs_tests WHERE id = (SELECT id FROM _crs_test_a1)),
  'save_crs_exercise: alle fuenf Uebungen persistiert (+)');


-- ############################################################
-- T5: ungueltige Uebung -> invalid_exercise
-- ############################################################

SELECT tests.throws_with_state(
  'a1111111-1111-1111-1111-a11111111111',
  format($q$SELECT public.save_crs_exercise(%L::uuid, 'deadlift', 10)$q$,
         (SELECT id FROM _crs_test_a1)),
  'invalid_exercise',
  'save_crs_exercise: unbekannte Uebung abgelehnt (-)');


-- ############################################################
-- T6: Wert ueber Obergrenze -> value_out_of_range
-- ############################################################

SELECT tests.throws_with_state(
  'a1111111-1111-1111-1111-a11111111111',
  format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', 9999)$q$,
         (SELECT id FROM _crs_test_a1)),
  'value_out_of_range',
  'save_crs_exercise: unplausibel hoher Wert abgelehnt (-)');


-- ############################################################
-- T7: negativer Wert -> invalid_value
-- ############################################################

SELECT tests.throws_with_state(
  'a1111111-1111-1111-1111-a11111111111',
  format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', -1)$q$,
         (SELECT id FROM _crs_test_a1)),
  'invalid_value',
  'save_crs_exercise: negativer Wert abgelehnt (-)');


-- ############################################################
-- T8: fremder Athlet darf nicht speichern -> test_not_found
-- ############################################################

SELECT tests.throws_with_state(
  'a2222222-2222-2222-2222-a22222222222',
  format($q$SELECT public.save_crs_exercise(%L::uuid, 'burpees', 10)$q$,
         (SELECT id FROM _crs_test_a1)),
  'test_not_found',
  'save_crs_exercise: fremder Athlet abgelehnt (-)');


-- ############################################################
-- T9: complete_crs_test — Status + completed_at + Audit (3 Assertions)
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a1111111-1111-1111-1111-a11111111111","role":"authenticated"}';

SELECT public.complete_crs_test((SELECT id FROM _crs_test_a1));

RESET ROLE;

SELECT is(
  (SELECT status FROM public.crs_tests WHERE id = (SELECT id FROM _crs_test_a1)),
  'completed',
  'complete_crs_test: status=completed (+)');

SELECT ok(
  (SELECT completed_at IS NOT NULL FROM public.crs_tests
    WHERE id = (SELECT id FROM _crs_test_a1)),
  'complete_crs_test: completed_at gesetzt (+)');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'crs_test_completed'
      AND target_id = (SELECT id FROM _crs_test_a1)),
  'complete_crs_test: audit-Eintrag geschrieben');


-- ############################################################
-- T12: doppeltes Complete -> test_not_in_progress
-- ############################################################

SELECT tests.throws_with_state(
  'a1111111-1111-1111-1111-a11111111111',
  format($q$SELECT public.complete_crs_test(%L::uuid)$q$, (SELECT id FROM _crs_test_a1)),
  'test_not_in_progress',
  'complete_crs_test: abgeschlossener Test kann nicht erneut (-)');


-- ############################################################
-- T13: abort_crs_test — neuer Test, abort, Status + Audit + Double-Abort
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"a1111111-1111-1111-1111-a11111111111","role":"authenticated"}';

CREATE TEMP TABLE _crs_abort ON COMMIT DROP AS
  SELECT public.start_crs_test(NULL) AS id;

SELECT public.abort_crs_test((SELECT id FROM _crs_abort));

RESET ROLE;

SELECT is(
  (SELECT status FROM public.crs_tests WHERE id = (SELECT id FROM _crs_abort)),
  'aborted',
  'abort_crs_test: status=aborted (+)');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'crs_test_aborted'
      AND target_id = (SELECT id FROM _crs_abort)),
  'abort_crs_test: audit-Eintrag geschrieben');

SELECT tests.throws_with_state(
  'a1111111-1111-1111-1111-a11111111111',
  format($q$SELECT public.abort_crs_test(%L::uuid)$q$, (SELECT id FROM _crs_abort)),
  'test_not_in_progress',
  'abort_crs_test: bereits abgebrochener Test (-)');


-- ############################################################
-- T16: Nicht-authentifiziert -> not_authenticated
--      Claims explizit leeren, da throws_with_state mit NULL-User
--      Rolle/Claims nicht anfasst.
-- ############################################################

SET LOCAL ROLE anon;
SET LOCAL "request.jwt.claims" = '{}';

SELECT tests.throws_with_state(
  NULL,
  $$SELECT public.start_crs_test(NULL)$$,
  'not_authenticated',
  'start_crs_test: ohne JWT abgelehnt (-)');

RESET ROLE;


SELECT * FROM finish();
ROLLBACK;
