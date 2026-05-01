-- ============================================================
-- READY 2 FIGHT — pgTAP: competitions.comp_coach_read mit
-- can_see_tracking-Permission (Roadmap §1.26)
--
-- Pruefungen:
-- 1) Policy comp_coach_read existiert auf public.competitions
-- 2) Coach mit aktivem Engagement + can_see_tracking=true SIEHT
--    Wettkaempfe seines Athleten.
-- 3) Coach mit aktivem Engagement + can_see_tracking=false SIEHT
--    KEINE Wettkaempfe.
-- 4) Coach ohne Engagement zum Athleten SIEHT KEINE Wettkaempfe.
-- 5) Unauthenticated SIEHT KEINE Wettkaempfe.
-- 6) Athlete-Self-Access via comp_self_all bleibt unbeeinflusst.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(7);

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
-- 1. Setup: 2 Coaches, 2 Athleten, 2 Engagements, 2 Wettkaempfe
-- ############################################################

SELECT tests.create_user('eeee1111-1111-1111-1111-eeeeeeeeeeee',
                         'comp_coach_a@test.r2f', 'coach', 'CoachA');
SELECT tests.create_user('eeee2222-2222-2222-2222-eeeeeeeeeeee',
                         'comp_coach_b@test.r2f', 'coach', 'CoachB');
SELECT tests.create_user('eeee3333-3333-3333-3333-eeeeeeeeeeee',
                         'comp_ath_1@test.r2f', 'athlete', 'Ath1');
SELECT tests.create_user('eeee4444-4444-4444-4444-eeeeeeeeeeee',
                         'comp_ath_2@test.r2f', 'athlete', 'Ath2');

DO $$
DECLARE
  v_coach_a UUID := 'eeee1111-1111-1111-1111-eeeeeeeeeeee'::UUID;
  v_coach_b UUID := 'eeee2222-2222-2222-2222-eeeeeeeeeeee'::UUID;
  v_ath_1   UUID := 'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID;
  v_ath_2   UUID := 'eeee4444-4444-4444-4444-eeeeeeeeeeee'::UUID;
  v_eng_with_tracking    UUID := 'ffff1111-1111-1111-1111-ffffffffffff'::UUID;
  v_eng_without_tracking UUID := 'ffff2222-2222-2222-2222-ffffffffffff'::UUID;
  v_comp_1 UUID := '11111111-1111-1111-1111-111111111111'::UUID;
  v_comp_2 UUID := '22222222-2222-2222-2222-222222222222'::UUID;
BEGIN
  INSERT INTO public.athlete_profiles (id) VALUES (v_ath_1), (v_ath_2)
    ON CONFLICT (id) DO NOTHING;

  -- CoachA <-> Ath1 mit can_see_tracking=true (purpose=general)
  INSERT INTO public.coach_athlete_engagements
    (id, coach_id, athlete_id, can_see_tracking, started_at)
  VALUES (v_eng_with_tracking, v_coach_a, v_ath_1, true, now());
  UPDATE public.coach_athlete_engagements
     SET status = 'active' WHERE id = v_eng_with_tracking;

  -- CoachB <-> Ath1 mit can_see_tracking=false (purpose=technique
  -- damit unique-Constraint auf (coach,athlete,purpose) nicht greift)
  INSERT INTO public.coach_athlete_engagements
    (id, coach_id, athlete_id, purpose, can_see_tracking, started_at)
  VALUES (v_eng_without_tracking, v_coach_b, v_ath_1, 'technique', false, now());
  UPDATE public.coach_athlete_engagements
     SET status = 'active' WHERE id = v_eng_without_tracking;

  -- CoachA hat KEIN Engagement mit Ath2.

  -- Wettkaempfe
  INSERT INTO public.competitions (id, athlete_id, title, competition_date)
  VALUES
    (v_comp_1, v_ath_1, 'Cup 1', '2026-06-01'),
    (v_comp_2, v_ath_2, 'Cup 2', '2026-06-15');
END $$;


-- ############################################################
-- 2. Schema-Asserts
-- ############################################################

SELECT policies_are(
  'public', 'competitions',
  ARRAY['comp_self_all', 'comp_coach_read'],
  'competitions hat genau zwei Policies'
);


-- ############################################################
-- 3. CoachA mit can_see_tracking=true sieht Wettkampf von Ath1
-- ############################################################

CREATE OR REPLACE FUNCTION tests.competitions_visible_to(p_user UUID, p_athlete UUID)
RETURNS BIGINT LANGUAGE plpgsql AS $$
DECLARE
  v_count BIGINT;
BEGIN
  EXECUTE 'SET LOCAL ROLE authenticated';
  IF p_user IS NOT NULL THEN
    EXECUTE format('SET LOCAL "request.jwt.claims" = %L',
      json_build_object('sub', p_user, 'role', 'authenticated')::text);
  ELSE
    EXECUTE 'SET LOCAL "request.jwt.claims" = ''{}''';
  END IF;
  SELECT count(*) INTO v_count
    FROM public.competitions WHERE athlete_id = p_athlete;
  EXECUTE 'RESET ROLE';
  RETURN v_count;
END $$;

SELECT is(
  tests.competitions_visible_to(
    'eeee1111-1111-1111-1111-eeeeeeeeeeee'::UUID,  -- CoachA
    'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID), -- Ath1
  1::BIGINT,
  'CoachA mit can_see_tracking=true sieht Wettkampf von Ath1'
);


-- ############################################################
-- 4. CoachB mit can_see_tracking=false sieht KEINE Wettkaempfe
-- ############################################################

SELECT is(
  tests.competitions_visible_to(
    'eeee2222-2222-2222-2222-eeeeeeeeeeee'::UUID,  -- CoachB
    'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID), -- Ath1
  0::BIGINT,
  'CoachB mit can_see_tracking=false sieht KEINE Wettkaempfe von Ath1'
);


-- ############################################################
-- 5. CoachA ohne Engagement zu Ath2 sieht KEINEN Wettkampf von Ath2
-- ############################################################

SELECT is(
  tests.competitions_visible_to(
    'eeee1111-1111-1111-1111-eeeeeeeeeeee'::UUID,  -- CoachA
    'eeee4444-4444-4444-4444-eeeeeeeeeeee'::UUID), -- Ath2
  0::BIGINT,
  'CoachA ohne Engagement zu Ath2 sieht KEINEN Wettkampf von Ath2'
);


-- ############################################################
-- 6. Unauthenticated sieht KEINE Wettkaempfe
-- ############################################################

SELECT is(
  tests.competitions_visible_to(NULL,
    'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID),
  0::BIGINT,
  'Unauthenticated sieht KEINE Wettkaempfe'
);


-- ############################################################
-- 7. Athlete-Self-Access via comp_self_all bleibt erhalten
-- ############################################################

SELECT is(
  tests.competitions_visible_to(
    'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID,  -- Ath1 selbst
    'eeee3333-3333-3333-3333-eeeeeeeeeeee'::UUID),
  1::BIGINT,
  'Ath1 sieht eigenen Wettkampf via comp_self_all'
);

SELECT is(
  tests.competitions_visible_to(
    'eeee4444-4444-4444-4444-eeeeeeeeeeee'::UUID,  -- Ath2 selbst
    'eeee4444-4444-4444-4444-eeeeeeeeeeee'::UUID),
  1::BIGINT,
  'Ath2 sieht eigenen Wettkampf via comp_self_all'
);


SELECT * FROM finish();
ROLLBACK;
