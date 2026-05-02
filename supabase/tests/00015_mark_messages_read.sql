-- ============================================================
-- READY 2 FIGHT — pgTAP: public.mark_messages_read (Roadmap §1.30)
--
-- Pruefungen:
-- 1) Funktion existiert mit Signatur (UUID) RETURNS BIGINT
-- 2) Caller markiert nur fremde Messages — eigene bleiben
--    unread.
-- 3) read_at wird gesetzt (NICHT NULL).
-- 4) Wiederholter Aufruf: zaehlt 0 (nichts mehr offen).
-- 5) Fehlerfaelle:
--    - not_authenticated   (kein JWT)
--    - channel_not_member  (Caller weder Coach noch Athlet)
-- 6) Andere Channels werden nicht beruehrt (Isolation).
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
    ELSE
      EXECUTE 'SET LOCAL "request.jwt.claims" = ''{}''';
    END IF;
    EXECUTE p_sql;
  EXCEPTION WHEN OTHERS THEN
    GET STACKED DIAGNOSTICS _state = RETURNED_SQLSTATE, _msg = MESSAGE_TEXT;
    _caught := true;
  END;
  EXECUTE 'RESET ROLE';
  RETURN ok(_caught AND (_state = p_expected_state OR _msg = p_expected_state OR p_expected_state = '*'),
            p_desc);
END $$;


-- ############################################################
-- 1. Setup: 1 Coach, 1 Athlet, 1 Stranger, 1 Engagement, 1 Channel,
--    4 Messages (2 vom Coach, 2 vom Athlet) + 1 fremder Channel
-- ############################################################

SELECT tests.create_user('11111111-aaaa-1111-aaaa-111111111111',
                         'mr_coach@test.r2f', 'coach', 'CoachA');
SELECT tests.create_user('22222222-aaaa-2222-aaaa-222222222222',
                         'mr_ath@test.r2f', 'athlete', 'Ath1');
SELECT tests.create_user('33333333-aaaa-3333-aaaa-333333333333',
                         'mr_stranger@test.r2f', 'athlete', 'Stranger');
-- 2. Coach + 2. Athlet fuer "anderer Channel"
SELECT tests.create_user('11111111-bbbb-1111-bbbb-111111111111',
                         'mr_coach2@test.r2f', 'coach', 'CoachB');
SELECT tests.create_user('22222222-bbbb-2222-bbbb-222222222222',
                         'mr_ath2@test.r2f', 'athlete', 'Ath2');

DO $$
DECLARE
  v_eng     UUID := '00000000-eeee-0000-eeee-000000000001'::UUID;
  v_eng2    UUID := '00000000-eeee-0000-eeee-000000000002'::UUID;
  v_chan    UUID := '00000000-cccc-0000-cccc-000000000001'::UUID;
  v_chan2   UUID := '00000000-cccc-0000-cccc-000000000002'::UUID;
BEGIN
  INSERT INTO public.athlete_profiles (id) VALUES
    ('22222222-aaaa-2222-aaaa-222222222222'::UUID),
    ('33333333-aaaa-3333-aaaa-333333333333'::UUID),
    ('22222222-bbbb-2222-bbbb-222222222222'::UUID)
    ON CONFLICT (id) DO NOTHING;

  -- Engagement #1 + Channel #1
  INSERT INTO public.coach_athlete_engagements (id, coach_id, athlete_id, started_at)
    VALUES (v_eng,
            '11111111-aaaa-1111-aaaa-111111111111'::UUID,
            '22222222-aaaa-2222-aaaa-222222222222'::UUID,
            now());
  UPDATE public.coach_athlete_engagements SET status='active' WHERE id = v_eng;
  INSERT INTO public.chat_channels (id, engagement_id) VALUES (v_chan, v_eng);

  -- Engagement #2 + Channel #2 (Isolation)
  INSERT INTO public.coach_athlete_engagements (id, coach_id, athlete_id, started_at)
    VALUES (v_eng2,
            '11111111-bbbb-1111-bbbb-111111111111'::UUID,
            '22222222-bbbb-2222-bbbb-222222222222'::UUID,
            now());
  UPDATE public.coach_athlete_engagements SET status='active' WHERE id = v_eng2;
  INSERT INTO public.chat_channels (id, engagement_id) VALUES (v_chan2, v_eng2);

  -- Messages: 2 vom Coach + 2 vom Athlet im Channel #1
  INSERT INTO public.chat_messages (channel_id, sender_id, body) VALUES
    (v_chan, '11111111-aaaa-1111-aaaa-111111111111'::UUID, 'Coach 1'),
    (v_chan, '11111111-aaaa-1111-aaaa-111111111111'::UUID, 'Coach 2'),
    (v_chan, '22222222-aaaa-2222-aaaa-222222222222'::UUID, 'Athlet 1'),
    (v_chan, '22222222-aaaa-2222-aaaa-222222222222'::UUID, 'Athlet 2');

  -- 1 Message im Channel #2 (fremd)
  INSERT INTO public.chat_messages (channel_id, sender_id, body) VALUES
    (v_chan2, '11111111-bbbb-1111-bbbb-111111111111'::UUID, 'Fremd');
END $$;


-- ############################################################
-- 2. Schema-Asserts
-- ############################################################

SELECT has_function('public', 'mark_messages_read', ARRAY['uuid'],
  'public.mark_messages_read(uuid) existiert');


-- ############################################################
-- 3. Coach markiert: 2 fremde Messages (vom Athlet) markiert,
--    eigene 2 bleiben unread.
-- ############################################################

DO $$
DECLARE v_count BIGINT;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', '11111111-aaaa-1111-aaaa-111111111111',
                      'role', 'authenticated')::text);
  v_count := public.mark_messages_read('00000000-cccc-0000-cccc-000000000001'::UUID);
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _coach_marked(c BIGINT);
  INSERT INTO _coach_marked VALUES (v_count);
END $$;

SELECT is(
  (SELECT c FROM _coach_marked),
  2::BIGINT,
  'Coach markiert genau 2 Athlet-Messages'
);

-- Athlet-Messages haben jetzt read_at gesetzt
SELECT is(
  (SELECT count(*) FROM public.chat_messages
    WHERE channel_id = '00000000-cccc-0000-cccc-000000000001'::UUID
      AND sender_id  = '22222222-aaaa-2222-aaaa-222222222222'::UUID
      AND read_at IS NOT NULL),
  2::BIGINT,
  'Athlet-Messages haben read_at gesetzt'
);

-- Coach-eigene Messages bleiben unread
SELECT is(
  (SELECT count(*) FROM public.chat_messages
    WHERE channel_id = '00000000-cccc-0000-cccc-000000000001'::UUID
      AND sender_id  = '11111111-aaaa-1111-aaaa-111111111111'::UUID
      AND read_at IS NULL),
  2::BIGINT,
  'Coach-eigene Messages bleiben unread'
);


-- ############################################################
-- 4. Wiederholter Aufruf: 0 frische Updates
-- ############################################################

DO $$
DECLARE v_count BIGINT;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
    json_build_object('sub', '11111111-aaaa-1111-aaaa-111111111111',
                      'role', 'authenticated')::text);
  v_count := public.mark_messages_read('00000000-cccc-0000-cccc-000000000001'::UUID);
  EXECUTE 'RESET ROLE';

  CREATE TEMP TABLE _replay(c BIGINT);
  INSERT INTO _replay VALUES (v_count);
END $$;

SELECT is(
  (SELECT c FROM _replay),
  0::BIGINT,
  'Wiederholter Aufruf zaehlt 0'
);


-- ############################################################
-- 5. Channel #2 wurde nicht beruehrt (Isolation)
-- ############################################################

SELECT is(
  (SELECT count(*) FROM public.chat_messages
    WHERE channel_id = '00000000-cccc-0000-cccc-000000000002'::UUID
      AND read_at IS NOT NULL),
  0::BIGINT,
  'Fremder Channel wurde nicht beruehrt'
);


-- ############################################################
-- 6. Errorfaelle
-- ############################################################

SELECT tests.throws_with_state(
  NULL,
  $cmd$SELECT public.mark_messages_read('00000000-cccc-0000-cccc-000000000001'::UUID)$cmd$,
  'not_authenticated',
  'unauthenticated → not_authenticated'
);

SELECT tests.throws_with_state(
  '33333333-aaaa-3333-aaaa-333333333333'::UUID,  -- Stranger
  $cmd$SELECT public.mark_messages_read('00000000-cccc-0000-cccc-000000000001'::UUID)$cmd$,
  'channel_not_member',
  'Nicht-Mitglied → channel_not_member'
);


SELECT * FROM finish();
ROLLBACK;
