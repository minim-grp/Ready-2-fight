-- ============================================================
-- READY 2 FIGHT — pgTAP: revoke_engagement_code
-- Roadmap-Schritt 1.11.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(7);

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

-- Coach A, Coach B, ein Athlet (nur, weil tests.create_user ein Profil triggert).
SELECT tests.create_user('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'rev_coachA@test.r2f', 'coach', 'Rev CoachA');
SELECT tests.create_user('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'rev_coachB@test.r2f', 'coach', 'Rev CoachB');

INSERT INTO public.coach_profiles (id) VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb')
ON CONFLICT (id) DO NOTHING;

-- Code von Coach A (aktiv)
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at)
VALUES ('cc000001-cc00-cc00-cc00-cc0000000001', 'REVAA001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, now() + interval '7 days');

-- Code von Coach A (bereits revoked)
INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at, revoked_at)
VALUES ('cc000002-cc00-cc00-cc00-cc0000000002', 'REVAA002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, now() + interval '7 days', now());


-- ############################################################
-- T1: Coach A revoked eigenen Code -> Erfolg
-- ############################################################

SET LOCAL ROLE authenticated;
SET LOCAL "request.jwt.claims" = '{"sub":"aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa","role":"authenticated"}';

SELECT lives_ok(
  $$SELECT public.revoke_engagement_code('cc000001-cc00-cc00-cc00-cc0000000001')$$,
  'revoke_engagement_code: Coach revoked eigenen Code (+)');

RESET ROLE;

-- T2: revoked_at gesetzt
SELECT isnt(
  (SELECT revoked_at FROM public.engagement_codes
    WHERE id = 'cc000001-cc00-cc00-cc00-cc0000000001'),
  NULL::timestamptz,
  'revoke_engagement_code: revoked_at wurde gesetzt');

-- T3: Audit-Eintrag
SELECT ok(
  EXISTS(SELECT 1 FROM audit.events
    WHERE event_type = 'engagement_code_revoked'
      AND actor_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'
      AND target_id = 'cc000001-cc00-cc00-cc00-cc0000000001'),
  'revoke_engagement_code: audit.events Eintrag geschrieben');


-- ############################################################
-- T4: Bereits revoked -> code_already_revoked
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  $$SELECT public.revoke_engagement_code('cc000002-cc00-cc00-cc00-cc0000000002')$$,
  'code_already_revoked',
  'revoke_engagement_code: doppeltes Revoke abgelehnt (-)');


-- ############################################################
-- T5: Fremder Coach -> code_not_found (RLS-konform: existiert nicht fuer ihn)
-- ############################################################

INSERT INTO public.engagement_codes (id, code, coach_id, max_uses, expires_at)
VALUES ('cc000003-cc00-cc00-cc00-cc0000000003', 'REVAA003',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 1, now() + interval '7 days');

SELECT tests.throws_with_state(
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  $$SELECT public.revoke_engagement_code('cc000003-cc00-cc00-cc00-cc0000000003')$$,
  'code_not_found',
  'revoke_engagement_code: fremder Coach abgelehnt (-)');


-- ############################################################
-- T6: Unbekannte ID -> code_not_found
-- ############################################################

SELECT tests.throws_with_state(
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  $$SELECT public.revoke_engagement_code('00000000-0000-0000-0000-000000000000')$$,
  'code_not_found',
  'revoke_engagement_code: unbekannte ID abgelehnt (-)');


-- ############################################################
-- T7: Athlet-Code-Pfad (Code von Coach A, anderer Coach versucht) -> Eintrag bleibt aktiv
-- ############################################################

SELECT is(
  (SELECT revoked_at FROM public.engagement_codes
    WHERE id = 'cc000003-cc00-cc00-cc00-cc0000000003'),
  NULL::timestamptz,
  'revoke_engagement_code: fremder Coach hat Code nicht widerrufen');


SELECT * FROM finish();
ROLLBACK;
