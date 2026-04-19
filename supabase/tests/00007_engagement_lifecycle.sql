-- ============================================================
-- READY 2 FIGHT — pgTAP: engagement-lifecycle RPCs
-- Roadmap-Schritt 1.13.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(18);

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


-- ############################################################
-- Fixtures: Coach A, Athlet X, Athlet Y, Coach B, Engagements
-- Status via Direct-UPDATE (kein JWT-Kontext = Trigger-Rollen-Check wird uebersprungen).
-- ############################################################

SELECT tests.create_user('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa', 'lc_coachA@test.r2f', 'coach',   'LC CoachA');
SELECT tests.create_user('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb', 'lc_coachB@test.r2f', 'coach',   'LC CoachB');
SELECT tests.create_user('cccccccc-3333-3333-3333-cccccccccccc', 'lc_athleteX@test.r2f', 'athlete', 'LC AthleteX');
SELECT tests.create_user('dddddddd-4444-4444-4444-dddddddddddd', 'lc_athleteY@test.r2f', 'athlete', 'LC AthleteY');

INSERT INTO public.coach_profiles (id) VALUES
  ('aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'),
  ('bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.athlete_profiles (id) VALUES
  ('cccccccc-3333-3333-3333-cccccccccccc'),
  ('dddddddd-4444-4444-4444-dddddddddddd')
ON CONFLICT (id) DO NOTHING;

-- e1..e4 als pending anlegen (Insert-Trigger forciert das sowieso),
-- dann per Direct-UPDATE auf Zielstatus setzen.
INSERT INTO public.coach_athlete_engagements
  (id, coach_id, athlete_id, purpose)
VALUES
  ('e1000001-0000-0000-0000-000000000001',
   'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   'cccccccc-3333-3333-3333-cccccccccccc', 'general'),
  ('e2000002-0000-0000-0000-000000000002',
   'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   'dddddddd-4444-4444-4444-dddddddddddd', 'strength_cond'),
  ('e3000003-0000-0000-0000-000000000003',
   'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   'cccccccc-3333-3333-3333-cccccccccccc', 'technique'),
  ('e4000004-0000-0000-0000-000000000004',
   'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
   'cccccccc-3333-3333-3333-cccccccccccc', 'competition_prep');

-- Chat-Channels fuer e1, e2, e3 (e4 ist ended-Fixture, Channel nicht noetig)
INSERT INTO public.chat_channels(engagement_id) VALUES
  ('e1000001-0000-0000-0000-000000000001'),
  ('e2000002-0000-0000-0000-000000000002'),
  ('e3000003-0000-0000-0000-000000000003');

-- Direct-UPDATE (ohne JWT -> validate_engagement_update ueberspringt Rollen-Check)
UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = 'e1000001-0000-0000-0000-000000000001';
UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = 'e2000002-0000-0000-0000-000000000002';
UPDATE public.coach_athlete_engagements SET status = 'paused' WHERE id = 'e2000002-0000-0000-0000-000000000002';
UPDATE public.coach_athlete_engagements SET status = 'active' WHERE id = 'e3000003-0000-0000-0000-000000000003';
UPDATE public.coach_athlete_engagements SET status = 'ended', end_reason = 'completed' WHERE id = 'e4000004-0000-0000-0000-000000000004';


-- ############################################################
-- T1..T3: pause_engagement — Coach pausiert aktives Engagement
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.pause_engagement('e1000001-0000-0000-0000-000000000001')$$,
  'pause_engagement: Coach pausiert aktives Engagement (+)');

RESET ROLE;

SELECT is(
  (SELECT status FROM public.coach_athlete_engagements
    WHERE id = 'e1000001-0000-0000-0000-000000000001'),
  'paused',
  'pause_engagement: status=paused');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'engagement_paused'
      AND actor_id = 'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa'
      AND target_id = 'e1000001-0000-0000-0000-000000000001'),
  'pause_engagement: audit-Eintrag geschrieben');


-- ############################################################
-- T4: pause_engagement doppelt -> engagement_not_active
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  $$SELECT public.pause_engagement('e1000001-0000-0000-0000-000000000001')$$,
  'engagement_not_active',
  'pause_engagement: doppeltes Pausieren abgelehnt (-)');


-- ############################################################
-- T5: pause_engagement fremder Coach -> engagement_not_found
-- ############################################################

SELECT tests.throws_with_state(
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  $$SELECT public.pause_engagement('e3000003-0000-0000-0000-000000000003')$$,
  'engagement_not_found',
  'pause_engagement: fremder Coach abgelehnt (-)');


-- ############################################################
-- T6..T8: resume_engagement — Athlet setzt fort (Trigger-Extension)
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"dddddddd-4444-4444-4444-dddddddddddd","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.resume_engagement('e2000002-0000-0000-0000-000000000002')$$,
  'resume_engagement: Athlet setzt pausiertes Engagement fort (+)');

RESET ROLE;

SELECT is(
  (SELECT status FROM public.coach_athlete_engagements
    WHERE id = 'e2000002-0000-0000-0000-000000000002'),
  'active',
  'resume_engagement: status=active');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'engagement_resumed'
      AND actor_id = 'dddddddd-4444-4444-4444-dddddddddddd'
      AND target_id = 'e2000002-0000-0000-0000-000000000002'),
  'resume_engagement: audit-Eintrag geschrieben');


-- ############################################################
-- T9: resume_engagement auf aktivem Engagement -> engagement_not_paused
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  $$SELECT public.resume_engagement('e3000003-0000-0000-0000-000000000003')$$,
  'engagement_not_paused',
  'resume_engagement: nicht-pausiertes Engagement abgelehnt (-)');


-- ############################################################
-- T10..T15: end_engagement — Athlet beendet, Effekte pruefen
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"cccccccc-3333-3333-3333-cccccccccccc","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.end_engagement('e3000003-0000-0000-0000-000000000003', 'mutual')$$,
  'end_engagement: Athlet beendet mit end_reason=mutual (+)');

RESET ROLE;

SELECT is(
  (SELECT status FROM public.coach_athlete_engagements
    WHERE id = 'e3000003-0000-0000-0000-000000000003'),
  'ended',
  'end_engagement: status=ended');

SELECT is(
  (SELECT end_reason FROM public.coach_athlete_engagements
    WHERE id = 'e3000003-0000-0000-0000-000000000003'),
  'mutual',
  'end_engagement: end_reason=mutual persistiert');

SELECT ok(
  (SELECT NOT can_see_tracking AND NOT can_see_meals
          AND NOT can_see_tests AND NOT can_create_plans
     FROM public.coach_athlete_engagements
    WHERE id = 'e3000003-0000-0000-0000-000000000003'),
  'end_engagement: alle Permissions auf false');

SELECT ok(
  (SELECT is_locked AND read_only_until IS NOT NULL
     FROM public.chat_channels
    WHERE engagement_id = 'e3000003-0000-0000-0000-000000000003'),
  'end_engagement: Chat-Channel gesperrt + read_only_until gesetzt');

SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'engagement_ended'
      AND actor_id = 'cccccccc-3333-3333-3333-cccccccccccc'
      AND target_id = 'e3000003-0000-0000-0000-000000000003'
      AND payload->>'end_reason' = 'mutual'),
  'end_engagement: audit-Eintrag mit end_reason');


-- ############################################################
-- T16: end_engagement auf bereits beendetes -> engagement_already_ended
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  $$SELECT public.end_engagement('e4000004-0000-0000-0000-000000000004')$$,
  'engagement_already_ended',
  'end_engagement: bereits beendetes Engagement abgelehnt (-)');


-- ############################################################
-- T17: end_engagement mit ungueltigem Reason -> invalid_end_reason
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-1111-1111-1111-aaaaaaaaaaaa',
  $$SELECT public.end_engagement('e1000001-0000-0000-0000-000000000001', 'bogus')$$,
  'invalid_end_reason',
  'end_engagement: ungueltiger end_reason abgelehnt (-)');


-- ############################################################
-- T18: end_engagement fremder User -> engagement_not_found
-- ############################################################

SELECT tests.throws_with_state(
  'bbbbbbbb-2222-2222-2222-bbbbbbbbbbbb',
  $$SELECT public.end_engagement('e1000001-0000-0000-0000-000000000001')$$,
  'engagement_not_found',
  'end_engagement: fremder User abgelehnt (-)');


SELECT * FROM finish();
ROLLBACK;
