-- ============================================================
-- READY 2 FIGHT — pgTAP: RPC Function Tests
-- Datei: supabase/tests/00003_rpcs.sql
--
-- Testet alle SECURITY DEFINER RPCs:
--   - generate_engagement_code (Coach)
--   - redeem_engagement_code (Athlet)
--   - request_account_deletion
--   - grant_xp
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(16);

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

SELECT tests.create_user('11111111-1111-1111-1111-111111111111', 'ath_r1@test.r2f',   'athlete', 'RPC Ath1');
SELECT tests.create_user('22222222-2222-2222-2222-222222222222', 'coach_r1@test.r2f',  'coach',   'RPC Coach1');
SELECT tests.create_user('33333333-3333-3333-3333-333333333333', 'ath_r2@test.r2f',    'athlete', 'RPC Ath2');

INSERT INTO public.athlete_profiles (id) VALUES
  ('11111111-1111-1111-1111-111111111111'),
  ('33333333-3333-3333-3333-333333333333');
INSERT INTO public.coach_profiles (id) VALUES ('22222222-2222-2222-2222-222222222222');

-- Vorbereitung: Codes fuer Negativ-Tests
-- Abgelaufener Code
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at)
VALUES ('ff000001-ff00-ff00-ff00-ff0000000001', 'EXPCODE1',
        '22222222-2222-2222-2222-222222222222', 1, now() - interval '1 day');

-- Revoked Code
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at, revoked_at)
VALUES ('ff000002-ff00-ff00-ff00-ff0000000002', 'REVCODE1',
        '22222222-2222-2222-2222-222222222222', 1, now() + interval '7 days', now());

-- Exhausted Code (uses_count = max_uses)
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, uses_count, expires_at)
VALUES ('ff000003-ff00-ff00-ff00-ff0000000003', 'EXHCODE1',
        '22222222-2222-2222-2222-222222222222', 1, 1, now() + interval '7 days');


-- ############################################################
--  1-4: generate_engagement_code
-- ############################################################

-- T1: Coach generiert erfolgreich einen Code
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT * FROM public.generate_engagement_code()$$,
  'generate_engagement_code: Coach generiert Code (+)');

-- Verify: Code existiert in DB
SELECT ok(
  EXISTS(SELECT 1 FROM public.engagement_codes WHERE coach_id = '22222222-2222-2222-2222-222222222222' AND code != 'EXPCODE1' AND code != 'REVCODE1' AND code != 'EXHCODE1'),
  'generate_engagement_code: Code wurde in DB gespeichert');

RESET ROLE;

-- T3: Athlet darf keinen Code generieren
SELECT tests.throws_with_state(
  '11111111-1111-1111-1111-111111111111',
  $$SELECT * FROM public.generate_engagement_code()$$,
  'not_a_coach', 'generate_engagement_code: Athlet wird abgelehnt (-)');

-- T4: valid_days ausserhalb 1-30 → Fehler
SELECT tests.throws_with_state(
  '22222222-2222-2222-2222-222222222222',
  $$SELECT * FROM public.generate_engagement_code(p_valid_days := 31)$$,
  'valid_days_out_of_range', 'generate_engagement_code: valid_days > 30 abgelehnt (-)');


-- ############################################################
--  5-11: redeem_engagement_code
-- ############################################################

-- Setup: Valider Code fuer Redeem-Test
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

-- Coach generiert einen frischen Code
SELECT * FROM public.generate_engagement_code(
  p_internal_label := 'Redeem Test',
  p_max_uses := 2,
  p_valid_days := 7
);

RESET ROLE;

-- Den generierten Code finden (der neueste von coach_r1, nicht die Test-Codes)
CREATE TEMP TABLE _test_code AS
SELECT code FROM public.engagement_codes
WHERE coach_id = '22222222-2222-2222-2222-222222222222'
  AND code NOT IN ('EXPCODE1', 'REVCODE1', 'EXHCODE1')
ORDER BY created_at DESC LIMIT 1;
DO $$ BEGIN EXECUTE 'GRANT ALL ON TABLE _test_code TO authenticated'; END $$;

-- T5: Athlet loest gueltigen Code ein
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT lives_ok(
  format('SELECT public.redeem_engagement_code(%L)', (SELECT code FROM _test_code)),
  'redeem_engagement_code: Athlet loest gueltigen Code ein (+)');

RESET ROLE;

-- Verify: Engagement wurde erstellt (insert-trigger forciert status=pending)
SELECT ok(
  EXISTS(SELECT 1 FROM public.coach_athlete_engagements
    WHERE coach_id = '22222222-2222-2222-2222-222222222222'
      AND athlete_id = '11111111-1111-1111-1111-111111111111'
      AND status = 'pending'),
  'redeem_engagement_code: Engagement wurde erstellt (pending, wartet auf Athlet-Accept)');

-- T7: Coach darf keinen Code einloesen
SELECT tests.throws_with_state(
  '22222222-2222-2222-2222-222222222222',
  format('SELECT public.redeem_engagement_code(%L)', (SELECT code FROM _test_code)),
  'not_an_athlete', 'redeem_engagement_code: Coach wird abgelehnt (-)');

-- T8: Ungueltiger Code → invalid_code
SELECT tests.throws_with_state(
  '33333333-3333-3333-3333-333333333333',
  $$SELECT public.redeem_engagement_code('XXXXXXXX')$$,
  'invalid_code', 'redeem_engagement_code: ungueltiger Code abgelehnt (-)');

-- T9: Abgelaufener Code → code_expired
SELECT tests.throws_with_state(
  '33333333-3333-3333-3333-333333333333',
  $$SELECT public.redeem_engagement_code('EXPCODE1')$$,
  'code_expired', 'redeem_engagement_code: abgelaufener Code abgelehnt (-)');

-- T10: Revoked Code → code_revoked
SELECT tests.throws_with_state(
  '33333333-3333-3333-3333-333333333333',
  $$SELECT public.redeem_engagement_code('REVCODE1')$$,
  'code_revoked', 'redeem_engagement_code: widerrufener Code abgelehnt (-)');

-- T11: Exhausted Code → code_exhausted
SELECT tests.throws_with_state(
  '33333333-3333-3333-3333-333333333333',
  $$SELECT public.redeem_engagement_code('EXHCODE1')$$,
  'code_exhausted', 'redeem_engagement_code: aufgebrauchter Code abgelehnt (-)');


-- ############################################################
--  12: request_account_deletion
-- ############################################################

-- T12: User fordert Account-Loeschung an → status + scheduled_at gesetzt
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.request_account_deletion()$$,
  'request_account_deletion: Anfrage erfolgreich (+)');

RESET ROLE;

SELECT is(
  (SELECT status FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'),
  'pending_deletion'::public.user_status,
  'request_account_deletion: status auf pending_deletion gesetzt');

SELECT isnt(
  (SELECT deletion_scheduled_at FROM public.users WHERE id = '33333333-3333-3333-3333-333333333333'),
  NULL::timestamptz,
  'request_account_deletion: deletion_scheduled_at ist gesetzt');


-- ############################################################
--  15-16: grant_xp
-- ############################################################

-- T15: Gueltige Action vergibt XP
SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT * FROM public.grant_xp('tracking_completed')$$,
  'grant_xp: gueltige Action vergibt XP (+)');

RESET ROLE;

-- Verify: XP wurde hochgezaehlt (tracking_completed = 25 XP)
SELECT is(
  (SELECT xp_total FROM public.users WHERE id = '11111111-1111-1111-1111-111111111111'),
  25,
  'grant_xp: xp_total wurde korrekt erhoeht');


-- ============================================================
SELECT * FROM finish();
ROLLBACK;
