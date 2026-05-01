-- ============================================================
-- READY 2 FIGHT — pgTAP: on_session_completion_grant_xp (§1.23-Backend)
--
-- Pruefungen:
-- 1) Trigger existiert auf public.session_completions
-- 2) INSERT session_completion -> users.xp_total += 30
-- 3) xp_log-Entry mit action='session_completed' geschrieben
-- 4) UNIQUE(session_id, athlete_id) blockt zweiten INSERT (kein Doppel-XP)
-- 5) Mehrere INSERTs (verschiedene Sessions) addieren XP
-- 6) Bei Schwellenuebertritt (Level 1 -> Level 2 = 100 XP) wird
--    eine 'level_up'-Notification erzeugt
-- 7) Service-Role-INSERT (auth.uid() IS NULL) faellt auf NEW.athlete_id zurueck
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(8);

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


-- ############################################################
-- 1. Setup: Coach + Athlete + Template-Plan + 4 Sessions
-- ############################################################

SELECT tests.create_user('aaaa1111-1111-1111-1111-aaaaaaaa0023',
                         'sxc_coach@test.r2f', 'coach',   'CoachX');
SELECT tests.create_user('aaaa3333-3333-3333-3333-aaaaaaaa0023',
                         'sxc_ath@test.r2f',   'athlete', 'AthX');

DO $$
DECLARE
  v_plan UUID := 'bbbb0023-0023-0023-0023-bbbbbbbbbbbb'::UUID;
  v_s1   UUID := 'cccc0023-0023-0023-0023-cccccccc1111'::UUID;
  v_s2   UUID := 'cccc0023-0023-0023-0023-cccccccc2222'::UUID;
  v_s3   UUID := 'cccc0023-0023-0023-0023-cccccccc3333'::UUID;
  v_s4   UUID := 'cccc0023-0023-0023-0023-cccccccc4444'::UUID;
BEGIN
  INSERT INTO public.training_plans (id, owner_id, athlete_id, title, is_template)
  VALUES (v_plan, 'aaaa1111-1111-1111-1111-aaaaaaaa0023'::UUID, NULL,
          'XP-Trigger Test Template', true);

  INSERT INTO public.training_sessions (id, plan_id, day_offset, title, position) VALUES
    (v_s1, v_plan, 0, 'Tag 1', 0),
    (v_s2, v_plan, 1, 'Tag 2', 1),
    (v_s3, v_plan, 2, 'Tag 3', 2),
    (v_s4, v_plan, 3, 'Tag 4', 3);
END $$;


-- ############################################################
-- 2. Schema-Asserts
-- ############################################################

SELECT has_trigger('public', 'session_completions', 'on_session_completion_grant_xp',
  'Trigger on_session_completion_grant_xp existiert auf session_completions');


-- ############################################################
-- 3. Erste Completion (als Athlet) -> +30 XP
-- ############################################################

DO $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'aaaa3333-3333-3333-3333-aaaaaaaa0023',
                      'role', 'authenticated')::text);
  INSERT INTO public.session_completions (session_id, athlete_id, rpe)
  VALUES ('cccc0023-0023-0023-0023-cccccccc1111'::UUID,
          'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID,
          7);
  EXECUTE 'RESET ROLE';
END $$;

SELECT is(
  (SELECT xp_total FROM public.users WHERE id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
  30,
  'xp_total = 30 nach erster Completion'
);

SELECT is(
  (SELECT count(*)::int FROM public.xp_log
    WHERE user_id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID
      AND action  = 'session_completed'),
  1,
  'xp_log enthaelt session_completed-Entry'
);


-- ############################################################
-- 4. Doppel-Insert blockiert vom UNIQUE-Constraint
-- ############################################################

DO $$
DECLARE _caught BOOLEAN := false;
BEGIN
  BEGIN
    EXECUTE 'SET LOCAL ROLE authenticated';
    EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
      json_build_object('sub', 'aaaa3333-3333-3333-3333-aaaaaaaa0023',
                        'role', 'authenticated')::text);
    INSERT INTO public.session_completions (session_id, athlete_id, rpe)
    VALUES ('cccc0023-0023-0023-0023-cccccccc1111'::UUID,
            'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID, 8);
    EXECUTE 'RESET ROLE';
  EXCEPTION WHEN unique_violation THEN
    _caught := true;
    EXECUTE 'RESET ROLE';
  END;
  CREATE TEMP TABLE _dup_blocked(v BOOLEAN);
  INSERT INTO _dup_blocked VALUES (_caught);
END $$;

SELECT is(
  (SELECT v FROM _dup_blocked),
  true,
  'UNIQUE(session_id, athlete_id) blockt Doppel-Insert'
);

SELECT is(
  (SELECT xp_total FROM public.users WHERE id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
  30,
  'xp_total bleibt 30 nach blockiertem Doppel-Insert'
);


-- ############################################################
-- 5. Drei weitere Completions -> 120 XP -> Level-Up auf 2
-- ############################################################

DO $$
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', 'aaaa3333-3333-3333-3333-aaaaaaaa0023',
                      'role', 'authenticated')::text);
  INSERT INTO public.session_completions (session_id, athlete_id) VALUES
    ('cccc0023-0023-0023-0023-cccccccc2222'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
    ('cccc0023-0023-0023-0023-cccccccc3333'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
    ('cccc0023-0023-0023-0023-cccccccc4444'::UUID,
     'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID);
  EXECUTE 'RESET ROLE';
END $$;

SELECT is(
  (SELECT xp_total FROM public.users WHERE id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
  120,
  'xp_total = 120 nach 4 Completions'
);

SELECT is(
  (SELECT level FROM public.users WHERE id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID),
  2,
  'Level wurde auf 2 hochgesetzt (xp_required=100)'
);

SELECT is(
  (SELECT count(*)::int FROM public.notifications
    WHERE user_id = 'aaaa3333-3333-3333-3333-aaaaaaaa0023'::UUID
      AND type    = 'level_up'),
  1,
  'Genau eine level_up-Notification (kein Spam, nur am Schwellenuebertritt)'
);


-- ############################################################
-- 6. Service-Role-INSERT (auth.uid() = NULL) -> Fallback NEW.athlete_id
-- ############################################################
-- Zweite Athletin anlegen, Direct-INSERT ohne JWT (Trigger-Fallback)

SELECT tests.create_user('aaaa4444-4444-4444-4444-aaaaaaaa0023',
                         'sxc_ath2@test.r2f', 'athlete', 'AthY');

INSERT INTO public.session_completions (session_id, athlete_id)
VALUES ('cccc0023-0023-0023-0023-cccccccc1111'::UUID,
        'aaaa4444-4444-4444-4444-aaaaaaaa0023'::UUID);

SELECT is(
  (SELECT xp_total FROM public.users WHERE id = 'aaaa4444-4444-4444-4444-aaaaaaaa0023'::UUID),
  30,
  'Service-Role-INSERT (kein JWT) faellt auf NEW.athlete_id zurueck'
);


SELECT * FROM finish();
ROLLBACK;
