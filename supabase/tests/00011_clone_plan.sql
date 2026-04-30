-- ============================================================
-- READY 2 FIGHT — pgTAP: public.clone_plan (Roadmap §1.21)
--
-- Pruefungen:
-- 1) Funktion existiert mit Signatur (UUID) RETURNS UUID
-- 2) Coach kopiert eigenes Template -> neuer Plan mit korrekten
--    Defaults (is_template=true, athlete_id=NULL, archived_at=NULL,
--    Title-Suffix " (Kopie)") und allen Sessions+Exercises.
-- 3) Coach darf nicht den Plan eines fremden Coaches klonen ('forbidden').
-- 4) Unbekannte Plan-ID -> 'plan_not_found'.
-- 5) Unauth -> 'not_authenticated'.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(11);

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
-- 1. Setup: zwei Coaches, ein Source-Template mit 2 Sessions + 3 Exercises
-- ############################################################

SELECT tests.create_user('cccccccc-1111-1111-1111-cccccccccccc',
                         'clone_a@test.r2f', 'coach', 'CoachA');
SELECT tests.create_user('cccccccc-2222-2222-2222-cccccccccccc',
                         'clone_b@test.r2f', 'coach', 'CoachB');

DO $$
DECLARE
  v_plan UUID := '11111111-aaaa-aaaa-aaaa-111111111111'::UUID;
  v_s1   UUID := '22222222-aaaa-aaaa-aaaa-222222222222'::UUID;
  v_s2   UUID := '33333333-aaaa-aaaa-aaaa-333333333333'::UUID;
BEGIN
  INSERT INTO public.training_plans (id, owner_id, athlete_id, title, description, is_template)
  VALUES (v_plan, 'cccccccc-1111-1111-1111-cccccccccccc'::UUID, NULL,
          'Boxen 4 Wochen', 'Aufbau', true);

  INSERT INTO public.training_sessions (id, plan_id, day_offset, title, notes, position) VALUES
    (v_s1, v_plan, 0, 'Tag 1', 'Warm-up', 0),
    (v_s2, v_plan, 1, 'Tag 2', NULL,      1);

  INSERT INTO public.training_exercises (session_id, name, sets, reps, weight_kg, position) VALUES
    (v_s1, 'Bankdruecken', 4, 8,  80,  0),
    (v_s1, 'Klimmzuege',   4, 10, NULL, 1),
    (v_s2, 'Squats',       5, 5,  100, 0);
END $$;


-- ############################################################
-- 2. Schema-Asserts
-- ############################################################

SELECT has_function('public', 'clone_plan', ARRAY['uuid'],
  'public.clone_plan(uuid) existiert');


-- ############################################################
-- 3. Erfolgsfall: CoachA klont sein Template
-- ############################################################

DO $$
DECLARE v_new UUID;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'cccccccc-1111-1111-1111-cccccccccccc',
                      'role', 'authenticated')::text);
  v_new := public.clone_plan('11111111-aaaa-aaaa-aaaa-111111111111'::UUID);
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _cloned(id UUID);
  INSERT INTO _cloned VALUES (v_new);
END $$;

SELECT isnt(
  (SELECT id FROM _cloned),
  '11111111-aaaa-aaaa-aaaa-111111111111'::UUID,
  'Kopie hat eine andere ID als Original'
);

SELECT is(
  (SELECT title FROM public.training_plans WHERE id = (SELECT id FROM _cloned)),
  'Boxen 4 Wochen (Kopie)',
  'Title bekommt Suffix " (Kopie)"'
);

SELECT is(
  (SELECT is_template FROM public.training_plans WHERE id = (SELECT id FROM _cloned)),
  true,
  'Kopie ist immer ein Template'
);

SELECT is(
  (SELECT athlete_id FROM public.training_plans WHERE id = (SELECT id FROM _cloned)),
  NULL::UUID,
  'Kopie hat keine Athlet-Bindung'
);

SELECT is(
  (SELECT count(*)::int FROM public.training_sessions WHERE plan_id = (SELECT id FROM _cloned)),
  2,
  'Beide Sessions wurden mitkopiert'
);

SELECT is(
  (SELECT count(*)::int FROM public.training_exercises e
     JOIN public.training_sessions s ON s.id = e.session_id
    WHERE s.plan_id = (SELECT id FROM _cloned)),
  3,
  'Alle drei Exercises wurden mitkopiert'
);


-- ############################################################
-- 4. Fehlerfaelle
-- ############################################################

-- CoachB versucht das Plan von CoachA zu klonen
SELECT tests.throws_with_state(
  'cccccccc-2222-2222-2222-cccccccccccc',
  $sql$ SELECT public.clone_plan('11111111-aaaa-aaaa-aaaa-111111111111'::UUID) $sql$,
  'forbidden',
  'CoachB darf das Template von CoachA nicht klonen'
);

-- Unbekannte Plan-ID
SELECT tests.throws_with_state(
  'cccccccc-1111-1111-1111-cccccccccccc',
  $sql$ SELECT public.clone_plan('99999999-9999-9999-9999-999999999999'::UUID) $sql$,
  'plan_not_found',
  'Unbekannte Plan-ID -> plan_not_found'
);

-- Unauthenticated (anon-Rolle bekommt keinen Grant) -> hier per leerem JWT
SELECT tests.throws_with_state(
  NULL,
  $sql$ DO $do$ BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE 'SET LOCAL "request.jwt.claims" = ''{}''';
    PERFORM public.clone_plan('11111111-aaaa-aaaa-aaaa-111111111111'::UUID);
  END $do$; $sql$,
  'not_authenticated',
  'Ohne JWT -> not_authenticated'
);


-- ############################################################
-- 5. Original ist unveraendert
-- ############################################################

SELECT is(
  (SELECT count(*)::int FROM public.training_sessions
    WHERE plan_id = '11111111-aaaa-aaaa-aaaa-111111111111'::UUID),
  2,
  'Original-Plan hat weiterhin 2 Sessions (kein Mutation)'
);


SELECT * FROM finish();
ROLLBACK;
