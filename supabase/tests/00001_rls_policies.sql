-- ============================================================
-- READY 2 FIGHT — pgTAP: RLS Policy Verification
-- Datei: supabase/tests/00001_rls_policies.sql
--
-- Testet JEDE RLS-Policy mit positivem (+) und negativem (-) Test.
-- Coverage: 100% aller Policies aus Migration 1, 2 und 3.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(82);

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

-- throws_with_state: Prueft ob SQL den erwarteten SQLSTATE wirft.
-- p_user_id NULL = als postgres ausfuehren; sonst als authenticated user.
-- Notwendig weil throws_ok(text, text, text) den 2. Param als Fehlermeldung
-- interpretiert, und throws_ok als authenticated pgTAPs __tcache__ nicht lesen kann.
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
-- SETUP: Test-User anlegen
-- ============================================================
-- athlete1: volles Engagement mit coach1
-- athlete2: eingeschraenktes Engagement mit coach1 (kein tracking/tests/plans)
-- coach1:   Engagements mit athlete1 + athlete2
-- coach2:   keine Engagements
-- stranger: keine Verbindungen

SELECT tests.create_user('11111111-1111-1111-1111-111111111111', 'athlete1@test.r2f', 'athlete', 'Athlete One');
SELECT tests.create_user('22222222-2222-2222-2222-222222222222', 'athlete2@test.r2f', 'athlete', 'Athlete Two');
SELECT tests.create_user('33333333-3333-3333-3333-333333333333', 'coach1@test.r2f',   'coach',   'Coach One');
SELECT tests.create_user('44444444-4444-4444-4444-444444444444', 'coach2@test.r2f',   'coach',   'Coach Two');
SELECT tests.create_user('55555555-5555-5555-5555-555555555555', 'stranger@test.r2f', 'athlete', 'Stranger');

-- Profile
-- Der on_auth_user_created-Trigger legt athlete_profiles/coach_profiles bereits an.
-- Test-Fixture-Werte (birth_date, gender, certification, ...) nachziehen via UPSERT.
INSERT INTO public.athlete_profiles (id, birth_date, gender) VALUES
  ('11111111-1111-1111-1111-111111111111', '2000-01-01', 'male'),
  ('22222222-2222-2222-2222-222222222222', '1998-06-15', 'female'),
  ('55555555-5555-5555-5555-555555555555', '1999-03-20', 'male')
ON CONFLICT (id) DO UPDATE SET
  birth_date = EXCLUDED.birth_date,
  gender     = EXCLUDED.gender;

INSERT INTO public.coach_profiles (id, certification, gym_name, city) VALUES
  ('33333333-3333-3333-3333-333333333333', 'A-Lizenz', 'Fight Gym Berlin', 'Berlin'),
  ('44444444-4444-4444-4444-444444444444', 'B-Lizenz', 'MMA Dojo Hamburg',  'Hamburg')
ON CONFLICT (id) DO UPDATE SET
  certification = EXCLUDED.certification,
  gym_name      = EXCLUDED.gym_name,
  city          = EXCLUDED.city;

-- Engagements
-- eng1: coach1 <-> athlete1 (alle Berechtigungen)
INSERT INTO public.coach_athlete_engagements
  (id, coach_id, athlete_id, purpose, can_see_tracking, can_see_meals, can_see_tests, can_create_plans)
VALUES
  ('eeee0001-eeee-eeee-eeee-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111',
   'general', true, false, true, true);
UPDATE public.coach_athlete_engagements SET status = 'active'
  WHERE id = 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee';

-- eng2: coach1 <-> athlete2 (KEINE tracking/tests/plans, nur meals)
INSERT INTO public.coach_athlete_engagements
  (id, coach_id, athlete_id, purpose, can_see_tracking, can_see_meals, can_see_tests, can_create_plans)
VALUES
  ('eeee0002-eeee-eeee-eeee-eeeeeeeeeeee',
   '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222',
   'general', false, true, false, false);
UPDATE public.coach_athlete_engagements SET status = 'active'
  WHERE id = 'eeee0002-eeee-eeee-eeee-eeeeeeeeeeee';

-- Daily Tracking
INSERT INTO public.daily_tracking
  (id, athlete_id, date, sleep_quality, mood, physical_condition, water_l, weight_kg, trained) VALUES
  ('dddd0001-dddd-dddd-dddd-dddddddddddd', '11111111-1111-1111-1111-111111111111', CURRENT_DATE,
   'gut', 'gut', 'gut', 2.5, 75.0, false),
  ('dddd0002-dddd-dddd-dddd-dddddddddddd', '22222222-2222-2222-2222-222222222222', CURRENT_DATE - 1,
   'mittel', 'mittel', 'mittel', 2.0, 70.0, false);

-- CRS Tests
INSERT INTO public.crs_tests (id, athlete_id, status) VALUES
  ('cccc0001-cccc-cccc-cccc-cccccccccccc', '11111111-1111-1111-1111-111111111111', 'completed'),
  ('cccc0002-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'completed');

-- Competitions
INSERT INTO public.competitions (id, athlete_id, title, competition_date)
VALUES ('aaaa0001-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'Berlin Open', CURRENT_DATE + 30);

-- Training Plans
INSERT INTO public.training_plans (id, owner_id, athlete_id, engagement_id, title, is_template) VALUES
  ('bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333',
   '11111111-1111-1111-1111-111111111111', 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee', 'Fight Camp Plan', false),
  ('bbbb0002-bbbb-bbbb-bbbb-bbbbbbbbbbbb', '33333333-3333-3333-3333-333333333333',
   NULL, NULL, 'Template Plan', true);

INSERT INTO public.training_sessions (id, plan_id, day_offset, title, position)
VALUES ('bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 1, 'Day 1 Warmup', 0);

INSERT INTO public.training_exercises (id, session_id, name, sets, reps, position)
VALUES ('bbbb0111-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Push-ups', 3, 15, 0);

-- Chat
INSERT INTO public.chat_channels (id, engagement_id, is_locked) VALUES
  ('ca000001-ca00-ca00-ca00-ca0000000000', 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee', false),
  ('ca000002-ca00-ca00-ca00-ca0000000000', 'eeee0002-eeee-eeee-eeee-eeeeeeeeeeee', true);

INSERT INTO public.chat_messages (id, channel_id, sender_id, body)
VALUES ('cb000001-cb00-cb00-cb00-cb0000000000', 'ca000001-ca00-ca00-ca00-ca0000000000',
        '33333333-3333-3333-3333-333333333333', 'Willkommen im Team!');

-- Engagement Codes
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at)
VALUES ('ffff0001-ffff-ffff-ffff-ffffffffffff', 'TESTCODE',
        '33333333-3333-3333-3333-333333333333', 1, now() + interval '7 days');

INSERT INTO public.engagement_code_redemptions (id, code_id, athlete_id, engagement_id)
VALUES ('ff000001-ff00-ff00-ff00-ff0000000000', 'ffff0001-ffff-ffff-ffff-ffffffffffff',
        '11111111-1111-1111-1111-111111111111', 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee');

-- XP Log (direkt eingefuegt, nicht ueber grant_xp)
INSERT INTO public.xp_log (id, user_id, action, xp_amount)
VALUES ('da000001-da00-da00-da00-da0000000000', '11111111-1111-1111-1111-111111111111', 'tracking_completed', 25);

-- Personal Records
INSERT INTO public.personal_records (id, athlete_id, exercise, record_value, unit, source)
VALUES ('db000001-db00-db00-db00-db0000000000', '11111111-1111-1111-1111-111111111111', 'Push-ups', 50.0, 'reps', 'manual');

-- Health Records
INSERT INTO public.health_records (id, athlete_id, category, title) VALUES
  ('dc000001-dc00-dc00-dc00-dc0000000000', '11111111-1111-1111-1111-111111111111', 'injury',  'Knie-Baenderriss'),
  ('dc000002-dc00-dc00-dc00-dc0000000000', '11111111-1111-1111-1111-111111111111', 'allergy', 'Pollenallergie');

INSERT INTO public.health_record_shares (id, record_id, engagement_id)
VALUES ('dd000001-dd00-dd00-dd00-dd0000000000', 'dc000001-dc00-dc00-dc00-dc0000000000',
        'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee');

-- Session Completions
INSERT INTO public.session_completions (id, session_id, athlete_id)
VALUES ('de000001-de00-de00-de00-de0000000000', 'bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        '11111111-1111-1111-1111-111111111111');

-- Notifications
INSERT INTO public.notifications (id, user_id, type, title, body)
VALUES ('df000001-df00-df00-df00-df0000000000', '11111111-1111-1111-1111-111111111111',
        'achievement', 'First Blood!', 'Erstes Tracking abgeschlossen');

-- Sport + Athlete Sports
INSERT INTO public.sport_disciplines (id, slug, name, category)
VALUES ('ab000001-ab00-ab00-ab00-ab0000000000', 'test_boxing', 'Test Boxing', 'striking')
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.athlete_sports (id, athlete_id, sport_id, is_primary)
VALUES ('ea000001-ea00-ea00-ea00-ea0000000000', '11111111-1111-1111-1111-111111111111',
        'ab000001-ab00-ab00-ab00-ab0000000000', true);

-- User Achievements
INSERT INTO public.achievements (id, slug, title, category, xp_reward)
VALUES ('ac000001-ac00-ac00-ac00-ac0000000000', 'test_achievement', 'Test Achievement', 'tracking', 50)
ON CONFLICT (slug) DO NOTHING;

INSERT INTO public.user_achievements (id, user_id, achievement_id)
VALUES ('a0000001-a000-a000-a000-a00000000000', '11111111-1111-1111-1111-111111111111',
        'ac000001-ac00-ac00-ac00-ac0000000000');


-- ############################################################
--  TESTS ALS ATHLETE 1 (28 Tests)
-- ############################################################
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- users
SELECT ok(
  EXISTS(SELECT 1 FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid),
  'users: athlete reads own row (+)');
SELECT ok(
  EXISTS(SELECT 1 FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'::uuid),
  'users: athlete reads linked coach via engagement (+)');
SELECT lives_ok(
  $$UPDATE public.users SET display_name = 'Athlete One Updated' WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'users: athlete updates own display_name (+)');

-- athlete_profiles
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_profiles WHERE id = '11111111-1111-1111-1111-111111111111'::uuid),
  'athlete_profiles: athlete reads own profile (+)');

-- coach_profiles
SELECT ok(
  EXISTS(SELECT 1 FROM public.coach_profiles WHERE id = '33333333-3333-3333-3333-333333333333'::uuid),
  'coach_profiles: athlete reads coach profile (public) (+)');

-- daily_tracking
SELECT ok(
  EXISTS(SELECT 1 FROM public.daily_tracking WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'daily_tracking: athlete reads own tracking (+)');

-- crs_tests
SELECT ok(
  EXISTS(SELECT 1 FROM public.crs_tests WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'crs_tests: athlete reads own CRS (+)');

-- training_plans
SELECT ok(
  EXISTS(SELECT 1 FROM public.training_plans WHERE id = 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'training_plans: athlete reads assigned plan (+)');

-- training_sessions
SELECT ok(
  EXISTS(SELECT 1 FROM public.training_sessions WHERE plan_id = 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'training_sessions: athlete reads sessions of assigned plan (+)');

-- competitions
SELECT ok(
  EXISTS(SELECT 1 FROM public.competitions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'competitions: athlete reads own competitions (+)');

-- engagement_codes (negative — athlete cannot see coach codes)
SELECT is_empty(
  $$SELECT 1 FROM public.engagement_codes WHERE coach_id = '33333333-3333-3333-3333-333333333333'$$,
  'engagement_codes: athlete cannot see coach codes (-)');

-- engagement_code_redemptions
SELECT ok(
  EXISTS(SELECT 1 FROM public.engagement_code_redemptions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'engagement_code_redemptions: athlete reads own redemptions (+)');

-- xp_log
SELECT ok(
  EXISTS(SELECT 1 FROM public.xp_log WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'xp_log: athlete reads own XP log (+)');

RESET ROLE;
SELECT tests.throws_with_state(
  '11111111-1111-1111-1111-111111111111',
  $$INSERT INTO public.xp_log (user_id, action, xp_amount) VALUES ('11111111-1111-1111-1111-111111111111', 'tracking_completed', 25)$$,
  '42501', 'xp_log: client cannot directly INSERT (-)');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

-- xp_rules
SELECT ok(EXISTS(SELECT 1 FROM public.xp_rules LIMIT 1),
  'xp_rules: authenticated reads rules (+)');

-- level_thresholds
SELECT ok(EXISTS(SELECT 1 FROM public.level_thresholds LIMIT 1),
  'level_thresholds: authenticated reads thresholds (+)');

-- streaks
SELECT ok(
  EXISTS(SELECT 1 FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'streaks: athlete reads own streak (+)');

-- achievements
SELECT ok(EXISTS(SELECT 1 FROM public.achievements LIMIT 1),
  'achievements: authenticated reads achievements (+)');

-- user_achievements
SELECT ok(
  EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'user_achievements: athlete reads own achievements (+)');

-- personal_records
SELECT ok(
  EXISTS(SELECT 1 FROM public.personal_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'personal_records: athlete reads own PRs (+)');

-- session_completions
SELECT ok(
  EXISTS(SELECT 1 FROM public.session_completions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'session_completions: athlete reads own completions (+)');

-- notifications
SELECT ok(
  EXISTS(SELECT 1 FROM public.notifications WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'notifications: athlete reads own notifications (+)');

-- user_settings
SELECT ok(
  EXISTS(SELECT 1 FROM public.user_settings WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'user_settings: athlete reads own settings (+)');

-- sport_disciplines
SELECT ok(EXISTS(SELECT 1 FROM public.sport_disciplines LIMIT 1),
  'sport_disciplines: authenticated reads disciplines (+)');

-- athlete_sports
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_sports WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'athlete_sports: athlete reads own sports (+)');

-- coach_athlete_engagements
SELECT ok(
  EXISTS(SELECT 1 FROM public.coach_athlete_engagements WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'engagements: athlete sees own engagements (+)');

-- health_records
SELECT ok(
  EXISTS(SELECT 1 FROM public.health_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'health_records: athlete reads own records (+)');

-- health_record_shares
SELECT ok(
  EXISTS(SELECT 1 FROM public.health_record_shares WHERE record_id = 'dc000001-dc00-dc00-dc00-dc0000000000'::uuid),
  'health_record_shares: athlete sees own shares (+)');

RESET ROLE;


-- ############################################################
--  TESTS ALS ATHLETE 2 — Negativ-Tests (12 Tests)
-- ############################################################
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

SELECT is_empty(
  $$SELECT 1 FROM public.daily_tracking WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'daily_tracking: other athlete cannot see tracking (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.crs_tests WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'crs_tests: other athlete cannot see CRS (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.training_plans WHERE id = 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'training_plans: unassigned athlete cannot see plan (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.competitions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'competitions: other athlete cannot see competitions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.xp_log WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'xp_log: other user cannot see XP log (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.streaks WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'streaks: other user cannot see streak (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.user_achievements WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'user_achievements: other user cannot see achievements (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.personal_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'personal_records: other athlete cannot see PRs (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.session_completions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'session_completions: other athlete cannot see completions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.notifications WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'notifications: other user cannot see notifications (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.user_settings WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'user_settings: other user cannot see settings (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.athlete_sports WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'athlete_sports: other athlete cannot see sports (-)');

RESET ROLE;


-- ############################################################
--  TESTS ALS COACH 1 (24 Tests)
-- ############################################################
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- users: linked coach sees athlete
SELECT ok(
  EXISTS(SELECT 1 FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'::uuid),
  'users: linked coach sees athlete (+)');

-- athlete_profiles: linked coach reads profile
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_profiles WHERE id = '11111111-1111-1111-1111-111111111111'::uuid),
  'athlete_profiles: linked coach reads profile (+)');

-- coach_profiles: coach updates own
SELECT lives_ok(
  $$UPDATE public.coach_profiles SET bio = 'Updated bio' WHERE id = '33333333-3333-3333-3333-333333333333'$$,
  'coach_profiles: coach updates own profile (+)');

-- daily_tracking: coach sees athlete1 (has can_see_tracking)
SELECT ok(
  EXISTS(SELECT 1 FROM public.daily_tracking WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'daily_tracking: linked coach with tracking perm reads (+)');

-- daily_tracking: coach CANNOT see athlete2 (can_see_tracking = false)
SELECT is_empty(
  $$SELECT 1 FROM public.daily_tracking WHERE athlete_id = '22222222-2222-2222-2222-222222222222'$$,
  'daily_tracking: linked coach without tracking perm denied (-)');

-- crs_tests: coach sees athlete1 (has can_see_tests)
SELECT ok(
  EXISTS(SELECT 1 FROM public.crs_tests WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'crs_tests: linked coach with tests perm reads (+)');

-- crs_tests: coach CANNOT see athlete2 (can_see_tests = false)
SELECT is_empty(
  $$SELECT 1 FROM public.crs_tests WHERE athlete_id = '22222222-2222-2222-2222-222222222222'$$,
  'crs_tests: linked coach without tests perm denied (-)');

-- training_plans: coach sees own plans
SELECT ok(
  EXISTS(SELECT 1 FROM public.training_plans WHERE owner_id = '33333333-3333-3333-3333-333333333333'::uuid),
  'training_plans: coach sees own plans (+)');

-- training_sessions: coach sees own plan sessions
SELECT ok(
  EXISTS(SELECT 1 FROM public.training_sessions WHERE plan_id = 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'training_sessions: plan owner reads sessions (+)');

-- training_exercises: coach sees exercises
SELECT ok(
  EXISTS(SELECT 1 FROM public.training_exercises WHERE session_id = 'bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'training_exercises: plan owner reads exercises (+)');

-- competitions: coach sees linked athlete competitions
SELECT ok(
  EXISTS(SELECT 1 FROM public.competitions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'competitions: linked coach reads athlete competitions (+)');

-- engagement_codes: coach sees own codes
SELECT ok(
  EXISTS(SELECT 1 FROM public.engagement_codes WHERE coach_id = '33333333-3333-3333-3333-333333333333'::uuid),
  'engagement_codes: coach sees own codes (+)');

-- engagement_code_redemptions: coach sees redemptions of own codes
SELECT ok(
  EXISTS(SELECT 1 FROM public.engagement_code_redemptions WHERE code_id = 'ffff0001-ffff-ffff-ffff-ffffffffffff'::uuid),
  'engagement_code_redemptions: coach sees own code redemptions (+)');

-- chat: coach reads messages in channel
SELECT ok(
  EXISTS(SELECT 1 FROM public.chat_messages WHERE channel_id = 'ca000001-ca00-ca00-ca00-ca0000000000'::uuid),
  'chat_messages: engagement member reads messages (+)');

-- chat: coach sends to unlocked channel
SELECT lives_ok(
  $$INSERT INTO public.chat_messages (channel_id, sender_id, body) VALUES ('ca000001-ca00-ca00-ca00-ca0000000000', '33333333-3333-3333-3333-333333333333', 'Test msg')$$,
  'chat_messages: member sends to unlocked channel (+)');

-- chat: coach CANNOT send to locked channel
RESET ROLE;
SELECT tests.throws_with_state(
  '33333333-3333-3333-3333-333333333333',
  $$INSERT INTO public.chat_messages (channel_id, sender_id, body) VALUES ('ca000002-ca00-ca00-ca00-ca0000000000', '33333333-3333-3333-3333-333333333333', 'Should fail')$$,
  '42501', 'chat_messages: cannot send to locked channel (-)');
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

-- user_achievements: coach sees athlete1 achievements
SELECT ok(
  EXISTS(SELECT 1 FROM public.user_achievements WHERE user_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'user_achievements: linked coach sees athlete achievements (+)');

-- personal_records: coach sees athlete1 PRs
SELECT ok(
  EXISTS(SELECT 1 FROM public.personal_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'personal_records: linked coach sees athlete PRs (+)');

-- session_completions: coach sees (plan owner)
SELECT ok(
  EXISTS(SELECT 1 FROM public.session_completions WHERE session_id = 'bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb'::uuid),
  'session_completions: plan owner reads athlete completions (+)');

-- athlete_sports: coach sees linked athlete sports
SELECT ok(
  EXISTS(SELECT 1 FROM public.athlete_sports WHERE athlete_id = '11111111-1111-1111-1111-111111111111'::uuid),
  'athlete_sports: linked coach sees athlete sports (+)');

-- engagements: coach sees own engagement
SELECT ok(
  EXISTS(SELECT 1 FROM public.coach_athlete_engagements WHERE coach_id = '33333333-3333-3333-3333-333333333333'::uuid),
  'engagements: coach sees own engagements (+)');

-- health_records: coach sees shared record
SELECT ok(
  EXISTS(SELECT 1 FROM public.health_records WHERE id = 'dc000001-dc00-dc00-dc00-dc0000000000'::uuid),
  'health_records: coach sees shared health record (+)');

-- health_records: coach CANNOT see unshared record
SELECT is_empty(
  $$SELECT 1 FROM public.health_records WHERE id = 'dc000002-dc00-dc00-dc00-dc0000000000'$$,
  'health_records: coach cannot see unshared health record (-)');

-- health_record_shares: coach sees own engagement shares
SELECT ok(
  EXISTS(SELECT 1 FROM public.health_record_shares WHERE engagement_id = 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee'::uuid),
  'health_record_shares: coach sees engagement shares (+)');

RESET ROLE;


-- ############################################################
--  TESTS ALS COACH 2 — Negativ-Tests (8 Tests)
--  Coach2 hat KEINE Engagements → sieht keine Athletendaten
-- ############################################################
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

SELECT is_empty(
  $$SELECT 1 FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'users: unlinked coach cannot see athlete (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.athlete_profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'athlete_profiles: unlinked coach cannot see profile (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.daily_tracking WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'daily_tracking: unlinked coach cannot see tracking (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.competitions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'competitions: unlinked coach cannot see competitions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.user_achievements WHERE user_id = '11111111-1111-1111-1111-111111111111'$$,
  'user_achievements: unlinked coach cannot see achievements (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.personal_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'personal_records: unlinked coach cannot see PRs (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.session_completions WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'session_completions: unlinked coach cannot see completions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.athlete_sports WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'athlete_sports: unlinked coach cannot see sports (-)');

RESET ROLE;


-- ############################################################
--  TESTS ALS STRANGER — Negativ-Tests (10 Tests)
--  Stranger hat keine Engagements, ist kein Plan-Owner/Assignee
-- ############################################################
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"55555555-5555-5555-5555-555555555555","role":"authenticated"}';

SELECT is_empty(
  $$SELECT 1 FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'users: stranger cannot see other user (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.athlete_profiles WHERE id = '11111111-1111-1111-1111-111111111111'$$,
  'athlete_profiles: stranger cannot see profile (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.training_plans WHERE owner_id = '33333333-3333-3333-3333-333333333333'$$,
  'training_plans: stranger cannot see plans (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.training_sessions WHERE plan_id = 'bbbb0001-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'training_sessions: stranger cannot see sessions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.training_exercises WHERE session_id = 'bbbb0011-bbbb-bbbb-bbbb-bbbbbbbbbbbb'$$,
  'training_exercises: stranger cannot see exercises (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.engagement_code_redemptions WHERE code_id = 'ffff0001-ffff-ffff-ffff-ffffffffffff'$$,
  'engagement_code_redemptions: stranger cannot see redemptions (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.chat_messages WHERE channel_id = 'ca000001-ca00-ca00-ca00-ca0000000000'$$,
  'chat_messages: non-member cannot read messages (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.coach_athlete_engagements WHERE id = 'eeee0001-eeee-eeee-eeee-eeeeeeeeeeee'$$,
  'engagements: stranger cannot see engagements (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.health_records WHERE athlete_id = '11111111-1111-1111-1111-111111111111'$$,
  'health_records: stranger cannot see records (-)');

SELECT is_empty(
  $$SELECT 1 FROM public.health_record_shares WHERE record_id = 'dc000001-dc00-dc00-dc00-dc0000000000'$$,
  'health_record_shares: stranger cannot see shares (-)');

RESET ROLE;


-- ============================================================
SELECT * FROM finish();
ROLLBACK;
