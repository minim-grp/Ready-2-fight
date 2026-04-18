-- ============================================================
-- READY 2 FIGHT — pgTAP: Trigger-Tests
-- Datei: supabase/tests/00002_triggers.sql
--
-- Testet alle Trigger-Funktionen:
--   - Streak auto-update bei daily_tracking INSERT
--   - Engagement-Validierung (Insert + Update)
--   - Plan-Assignment-Validierung
--   - on_engagement_ended: auto-revoke health shares, ended_at
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(18);

-- ============================================================
-- HELPERS
-- ============================================================

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

-- ============================================================
-- SETUP
-- ============================================================

SELECT tests.create_user('11111111-1111-1111-1111-111111111111', 'ath_t1@test.r2f',   'athlete', 'Trigger Ath1');
SELECT tests.create_user('22222222-2222-2222-2222-222222222222', 'coach_t1@test.r2f',  'coach',   'Trigger Coach1');
SELECT tests.create_user('33333333-3333-3333-3333-333333333333', 'ath_t2@test.r2f',    'athlete', 'Trigger Ath2');
SELECT tests.create_user('66666666-6666-6666-6666-666666666666', 'both_t1@test.r2f',   'both',    'Both User');

-- Profile werden vom handle_new_auth_user-Trigger automatisch angelegt
-- (siehe Migration 20260414000001_profile_autocreate.sql).


-- ############################################################
--  T1-T4: STREAK AUTO-UPDATE (Trigger: on_tracking_update_streak)
-- ############################################################

-- T1: Erster Tracking-Eintrag → Streak = 1
INSERT INTO public.daily_tracking (athlete_id, date, mood, physical_condition, trained)
VALUES ('11111111-1111-1111-1111-111111111111', '2026-03-01', 'gut', 'gut', false);

SELECT is(
  (SELECT current_streak FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'T01 streak: erster Tracking-Eintrag setzt streak=1');

-- T2: Naechster Tag → Streak = 2
INSERT INTO public.daily_tracking (athlete_id, date, mood, physical_condition, trained)
VALUES ('11111111-1111-1111-1111-111111111111', '2026-03-02', 'gut', 'gut', false);

SELECT is(
  (SELECT current_streak FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'T02 streak: konsekutiver Tag erhoeht streak auf 2');

-- T3: Luecke > 1 Tag → Streak reset auf 1
INSERT INTO public.daily_tracking (athlete_id, date, mood, physical_condition, trained)
VALUES ('11111111-1111-1111-1111-111111111111', '2026-03-06', 'gut', 'gut', false);

SELECT is(
  (SELECT current_streak FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  1,
  'T03 streak: Luecke > 1 Tag resettet streak auf 1');

-- T4: longest_streak bleibt erhalten
SELECT is(
  (SELECT longest_streak FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'),
  2,
  'T04 streak: longest_streak wird nicht zurueckgesetzt');


-- ############################################################
--  T5-T7: ENGAGEMENT INSERT-VALIDIERUNG
--         (Trigger: validate_engagement_insert)
-- ############################################################

-- T5: Nicht-Coach als coach_id → Fehler (P0001 = raise_exception)
SELECT tests.throws_with_state(NULL,
  $$INSERT INTO public.coach_athlete_engagements (coach_id, athlete_id, purpose)
    VALUES ('11111111-1111-1111-1111-111111111111',
            '33333333-3333-3333-3333-333333333333', 'general')$$,
  'P0001', 'T05 engagement insert: nicht-Coach als coach_id wird abgelehnt');

-- T6: Self-Assignment → Fehler (both-User noetig, damit Role-Checks passieren)
SELECT tests.throws_with_state(NULL,
  $$INSERT INTO public.coach_athlete_engagements (coach_id, athlete_id, purpose)
    VALUES ('66666666-6666-6666-6666-666666666666',
            '66666666-6666-6666-6666-666666666666', 'general')$$,
  'P0001', 'T06 engagement insert: Self-Assignment wird abgelehnt');

-- T7: Valider Insert erzwingt status = pending
INSERT INTO public.coach_athlete_engagements
  (id, coach_id, athlete_id, purpose)
VALUES
  ('eeee1001-eeee-eeee-eeee-eeeeeeeeeeee',
   '22222222-2222-2222-2222-222222222222',
   '11111111-1111-1111-1111-111111111111', 'general');

SELECT is(
  (SELECT status FROM public.coach_athlete_engagements WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee'),
  'pending',
  'T07 engagement insert: status wird auf pending erzwungen');


-- ############################################################
--  T8-T9: ENGAGEMENT UPDATE-VALIDIERUNG
--         (Trigger: validate_engagement_update)
-- ############################################################

-- T8: Athlet akzeptiert (pending → active)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

UPDATE public.coach_athlete_engagements SET status = 'active'
  WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee';

RESET ROLE;

SELECT is(
  (SELECT status FROM public.coach_athlete_engagements WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee'),
  'active',
  'T08 engagement update: Athlet kann pending → active');

-- T9: Coach kann NICHT pending → active
INSERT INTO public.coach_athlete_engagements
  (id, coach_id, athlete_id, purpose)
VALUES
  ('eeee1002-eeee-eeee-eeee-eeeeeeeeeeee',
   '22222222-2222-2222-2222-222222222222',
   '33333333-3333-3333-3333-333333333333', 'technique');

SELECT tests.throws_with_state(
  '22222222-2222-2222-2222-222222222222',
  $$UPDATE public.coach_athlete_engagements SET status = 'active'
    WHERE id = 'eeee1002-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  'P0001', 'T09 engagement update: Coach kann NICHT pending → active');


-- ############################################################
--  T10-T12: ON_ENGAGEMENT_ENDED
--  Auto-Revoke Health Shares, ended_at, started_at
-- ############################################################

-- Vorbereitung: Health Record + Share fuer das aktive Engagement
INSERT INTO public.health_records (id, athlete_id, category, title)
VALUES ('dc001001-dc00-dc00-dc00-dc0000000000',
        '11111111-1111-1111-1111-111111111111', 'injury', 'Test Verletzung');

INSERT INTO public.health_record_shares (id, record_id, engagement_id)
VALUES ('dd001001-dd00-dd00-dd00-dd0000000000',
        'dc001001-dc00-dc00-dc00-dc0000000000',
        'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee');

-- T10: started_at wurde bei Aktivierung (T8) gesetzt
SELECT isnt(
  (SELECT started_at FROM public.coach_athlete_engagements WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee'),
  NULL::timestamptz,
  'T10 on_engagement_ended: started_at wird bei Aktivierung gesetzt');

-- Engagement beenden (als Athlet)
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

UPDATE public.coach_athlete_engagements SET status = 'ended'
  WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee';

RESET ROLE;

-- T11: Health Share wurde auto-revoked
SELECT isnt(
  (SELECT revoked_at FROM public.health_record_shares WHERE id = 'dd001001-dd00-dd00-dd00-dd0000000000'),
  NULL::timestamptz,
  'T11 on_engagement_ended: health shares werden auto-revoked');

-- T12: ended_at wurde gesetzt
SELECT isnt(
  (SELECT ended_at FROM public.coach_athlete_engagements WHERE id = 'eeee1001-eeee-eeee-eeee-eeeeeeeeeeee'),
  NULL::timestamptz,
  'T12 on_engagement_ended: ended_at wird bei Beendigung gesetzt');


-- ############################################################
--  T13: PLAN-ASSIGNMENT-VALIDIERUNG
--       (Trigger: validate_plan_assignment)
-- ############################################################

-- Coach ohne Engagement versucht Plan fuer Athleten zu erstellen
SELECT tests.create_user('44444444-4444-4444-4444-444444444444', 'coach_t2@test.r2f', 'coach', 'Trigger Coach2');

SELECT tests.throws_with_state(NULL,
  $$INSERT INTO public.training_plans (owner_id, athlete_id, title, is_template)
    VALUES ('44444444-4444-4444-4444-444444444444',
            '11111111-1111-1111-1111-111111111111', 'Bad Plan', false)$$,
  'P0001', 'T13 validate_plan_assignment: Plan ohne Engagement abgelehnt');


-- ############################################################
--  T14: TRIGGER-EXISTENZ (updated_at)
--  Hinweis: now() ist innerhalb einer Transaktion konstant,
--  daher testen wir hier nur die Trigger-Registrierung.
-- ############################################################

SELECT has_trigger(
  'public', 'users', 'trg_users_updated',
  'T14 updated_at Trigger auf users-Tabelle registriert');


-- ############################################################
--  T15-T18: PROFILE AUTO-CREATE (Trigger: handle_new_auth_user)
--  Migration 20260414000001
-- ############################################################

-- T15: role='athlete' → athlete_profile existiert, coach_profile nicht
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_profiles WHERE id = '11111111-1111-1111-1111-111111111111')
  AND NOT EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = '11111111-1111-1111-1111-111111111111'),
  'T15 profile auto-create: role=athlete legt nur athlete_profile an');

-- T16: role='coach' → coach_profile existiert, athlete_profile nicht
SELECT ok(
  EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = '22222222-2222-2222-2222-222222222222')
  AND NOT EXISTS(SELECT 1 FROM public.athlete_profiles WHERE id = '22222222-2222-2222-2222-222222222222'),
  'T16 profile auto-create: role=coach legt nur coach_profile an');

-- T17: role='both' → beide Profile existieren
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_profiles WHERE id = '66666666-6666-6666-6666-666666666666')
  AND EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = '66666666-6666-6666-6666-666666666666'),
  'T17 profile auto-create: role=both legt beide Profile an');

-- T18: birth_date aus raw_user_meta_data wird uebernommen
INSERT INTO auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_user_meta_data, created_at, updated_at
) VALUES (
  '77777777-7777-7777-7777-777777777777',
  '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
  'ath_bd@test.r2f', crypt('TestPassword123!', gen_salt('bf')), now(),
  jsonb_build_object('display_name', 'BirthDate Ath', 'role', 'athlete',
                     'birth_date', '2005-06-15'),
  now(), now()
);

SELECT is(
  (SELECT birth_date FROM public.athlete_profiles WHERE id = '77777777-7777-7777-7777-777777777777'),
  '2005-06-15'::date,
  'T18 profile auto-create: birth_date aus raw_user_meta_data wird in athlete_profiles uebernommen');


-- ============================================================
SELECT * FROM finish();
ROLLBACK;
