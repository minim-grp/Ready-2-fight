-- ============================================================
-- READY 2 FIGHT — pgTAP: mood_level-Enum 5 Stufen
--
-- Pruefungen:
-- 1) Type existiert und ist ein Enum
-- 2) Enthaelt alle 5 Werte ('sehr_schlecht' … 'sehr_gut')
-- 3) daily_tracking.mood-Spalte hat den Type
-- 4) Insert mit jedem der 5 Werte funktioniert (Smoke-Test)
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);

CREATE SCHEMA IF NOT EXISTS tests;

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


-- ############################################################
-- 1. Schema-Asserts
-- ############################################################

SELECT has_type('public', 'mood_level', 'mood_level Type existiert');

SELECT is(
  (SELECT count(*)::int
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'mood_level'),
  5,
  'mood_level hat 5 Enum-Werte'
);

SELECT is(
  (SELECT array_agg(e.enumlabel ORDER BY e.enumsortorder)::text[]
     FROM pg_enum e
     JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'mood_level'),
  ARRAY['sehr_schlecht', 'schlecht', 'mittel', 'gut', 'sehr_gut']::text[],
  'mood_level-Werte in Reihenfolge schlecht → gut'
);

SELECT col_type_is('public', 'daily_tracking', 'mood', 'mood_level',
  'daily_tracking.mood nutzt den mood_level-Type');


-- ############################################################
-- 2. Insert-Smoke-Test fuer jeden Wert
-- ############################################################

SELECT tests.create_user('aaaaaaaa-1010-1010-1010-aaaaaaaaaaaa',
                         'mood_test@test.r2f', 'athlete', 'MoodAthlete');

-- Smoke: Athlet kann fuer jede Stufe einen daily_tracking-Eintrag schreiben
DO $$
DECLARE
  v_uid UUID := 'aaaaaaaa-1010-1010-1010-aaaaaaaaaaaa'::UUID;
  v_moods text[] := ARRAY['sehr_schlecht','schlecht','mittel','gut','sehr_gut'];
  v_count int := 0;
  v_mood text;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', v_uid, 'role', 'authenticated')::text);

  FOREACH v_mood IN ARRAY v_moods LOOP
    INSERT INTO public.daily_tracking (athlete_id, date, mood)
    VALUES (v_uid, ('2026-04-01'::date + v_count), v_mood::public.mood_level);
    v_count := v_count + 1;
  END LOOP;
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _mood_inserted(c int);
  INSERT INTO _mood_inserted VALUES (v_count);
END $$;

SELECT is(
  (SELECT c FROM _mood_inserted),
  5,
  'Insert fuer alle 5 mood_level-Werte erfolgreich'
);

SELECT is(
  (SELECT count(*)::int FROM public.daily_tracking
    WHERE athlete_id = 'aaaaaaaa-1010-1010-1010-aaaaaaaaaaaa'
      AND mood = 'sehr_gut'),
  1,
  'sehr_gut wurde persistiert'
);

SELECT is(
  (SELECT count(*)::int FROM public.daily_tracking
    WHERE athlete_id = 'aaaaaaaa-1010-1010-1010-aaaaaaaaaaaa'
      AND mood = 'sehr_schlecht'),
  1,
  'sehr_schlecht wurde persistiert'
);

SELECT is(
  (SELECT count(*)::int FROM public.daily_tracking
    WHERE athlete_id = 'aaaaaaaa-1010-1010-1010-aaaaaaaaaaaa'
      AND mood IN ('gut','mittel','schlecht')),
  3,
  'Bisherige 3 Werte (gut/mittel/schlecht) weiterhin gueltig'
);


SELECT * FROM finish();
ROLLBACK;
