-- ============================================================
-- READY 2 FIGHT — pgTAP: crs_norms-Stammdaten + RLS
-- Roadmap-Schritt 1.17 (Vorbereitung Score-Edge-Function).
--
-- Pruefungen:
-- 1) Tabelle existiert + Seed komplett (5 Uebungen, Anhang-B-Werte)
-- 2) RLS aktiv
-- 3) authenticated darf SELECT (5 Zeilen)
-- 4) authenticated darf NICHT INSERT/UPDATE/DELETE (Default-Deny)
-- 5) anon-Rolle hat kein USAGE/SELECT (Default-Deny)
-- 6) burpees_60s-Spalte existiert (Rename geprueft)
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(13);

CREATE SCHEMA IF NOT EXISTS tests;

-- Reuse-Helper aus 00001/00008 (idempotent)
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
  RETURN ok(_caught AND (_state = p_expected_state OR _msg = p_expected_state OR p_expected_state = '*'),
            p_desc);
END $$;


-- ############################################################
-- 1. Schema-Asserts
-- ############################################################

SELECT has_table('public', 'crs_norms', 'crs_norms-Tabelle existiert');

SELECT col_is_pk('public', 'crs_norms', 'exercise',
  'crs_norms.exercise ist Primary Key');

SELECT has_column('public', 'crs_tests', 'burpees_60s',
  'crs_tests.burpees_60s existiert (rename geprueft)');

SELECT hasnt_column('public', 'crs_tests', 'burpees_30s',
  'crs_tests.burpees_30s entfernt (alter Name)');

-- RLS aktiv
SELECT is(
  (SELECT relrowsecurity FROM pg_class
    WHERE oid = 'public.crs_norms'::regclass),
  true,
  'RLS auf crs_norms aktiviert'
);


-- ############################################################
-- 2. Seed-Vollstaendigkeit (Anhang B)
-- ############################################################

SELECT is(
  (SELECT count(*)::int FROM public.crs_norms),
  5,
  'crs_norms enthaelt 5 Seed-Zeilen (Anhang B)'
);

SELECT is(
  (SELECT base_target FROM public.crs_norms WHERE exercise = 'burpees'),
  25::numeric,
  'burpees base_target = 25 (Anhang B)'
);

SELECT is(
  (SELECT base_target FROM public.crs_norms WHERE exercise = 'plank'),
  60::numeric,
  'plank base_target = 60 (Anhang B)'
);


-- ############################################################
-- 3. RLS-Verhalten
-- ############################################################

SELECT tests.create_user('a4444444-4444-4444-4444-a44444444444',
                         'norms_a@test.r2f', 'athlete', 'NormAthlete');

-- authenticated SELECT → 5 Zeilen
DO $$
DECLARE v_count int;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'a4444444-4444-4444-4444-a44444444444',
                      'role', 'authenticated')::text);
  SELECT count(*) INTO v_count FROM public.crs_norms;
  EXECUTE 'RESET ROLE';
  CREATE TEMP TABLE _norms_count(c int);
  INSERT INTO _norms_count VALUES (v_count);
END $$;

SELECT is(
  (SELECT c FROM _norms_count),
  5,
  'authenticated liest 5 crs_norms-Zeilen via Policy'
);

-- authenticated INSERT → blockiert (RLS, kein WITH CHECK + kein INSERT-Grant)
SELECT tests.throws_with_state(
  'a4444444-4444-4444-4444-a44444444444',
  $sql$ INSERT INTO public.crs_norms(exercise, base_target,
          weight_factor_curve, age_factor_curve, gender_factor)
        VALUES ('burpees', 99, '[]'::jsonb, '[]'::jsonb, '{}'::jsonb) $sql$,
  '*',
  'authenticated INSERT auf crs_norms wird verweigert'
);

-- authenticated UPDATE → blockiert
SELECT tests.throws_with_state(
  'a4444444-4444-4444-4444-a44444444444',
  $sql$ UPDATE public.crs_norms SET base_target = 1 WHERE exercise = 'burpees' $sql$,
  '*',
  'authenticated UPDATE auf crs_norms wird verweigert'
);

-- authenticated DELETE → blockiert
SELECT tests.throws_with_state(
  'a4444444-4444-4444-4444-a44444444444',
  $sql$ DELETE FROM public.crs_norms WHERE exercise = 'burpees' $sql$,
  '*',
  'authenticated DELETE auf crs_norms wird verweigert'
);

-- anon hat kein SELECT-Grant (REVOKE ALL ... FROM anon in der Migration)
DO $$
DECLARE _caught boolean := false;
BEGIN
  BEGIN
    SET LOCAL ROLE anon;
    PERFORM count(*) FROM public.crs_norms;
  EXCEPTION WHEN OTHERS THEN _caught := true;
  END;
  RESET ROLE;
  CREATE TEMP TABLE _anon_blocked(b boolean);
  INSERT INTO _anon_blocked VALUES (_caught);
END $$;

SELECT ok(
  (SELECT b FROM _anon_blocked),
  'anon-Rolle blockiert auf crs_norms (kein SELECT-Grant)'
);


SELECT * FROM finish();
ROLLBACK;
