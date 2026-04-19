-- ============================================================
-- READY 2 FIGHT — pgTAP: reset_expired_streaks() (Roadmap §1.8)
-- Datei: supabase/tests/00005_streak_cron.sql
--
-- Testet den Cron-Handler aus Migration 20260418000002_streak_karenz.sql:
--   R1  Abgelaufenes Karenz-Fenster  → current_streak = 0,
--                                      longest_streak unveraendert
--   R2  Innerhalb Karenz              → unveraendert
--   R3  current_streak bereits 0       → UPDATE skipped (Effizienz)
--
-- Laeuft NUR gegen die migrierte DB; vor der Migration schlaegt der
-- erste SELECT auf public.reset_expired_streaks fehl — gewollt.
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(4);

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

SELECT tests.create_user(
  '33333333-3333-3333-3333-333333333333'::uuid,
  'cron@test.r2f'
);

-- ============================================================
-- R1  last_tracked_date 5 Tage alt → ueber Karenz (4 Tage) hinaus → Reset
-- ============================================================
UPDATE public.streaks
   SET current_streak    = 4,
       longest_streak    = 10,
       last_tracked_date = (CURRENT_DATE - INTERVAL '5 days')::date
 WHERE user_id = '33333333-3333-3333-3333-333333333333';

SELECT public.reset_expired_streaks();

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '33333333-3333-3333-3333-333333333333'),
  0,
  'R1 reset_expired_streaks setzt current_streak=0 bei abgelaufener Karenz');

SELECT is(
  (SELECT longest_streak FROM public.streaks
    WHERE user_id = '33333333-3333-3333-3333-333333333333'),
  10,
  'R1 reset_expired_streaks laesst longest_streak unveraendert');

-- ============================================================
-- R2  last_tracked_date 2 Tage alt → innerhalb Karenz → unveraendert
-- ============================================================
UPDATE public.streaks
   SET current_streak    = 4,
       longest_streak    = 10,
       last_tracked_date = (CURRENT_DATE - INTERVAL '2 days')::date
 WHERE user_id = '33333333-3333-3333-3333-333333333333';

SELECT public.reset_expired_streaks();

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '33333333-3333-3333-3333-333333333333'),
  4,
  'R2 reset_expired_streaks laesst Streak innerhalb Karenz unveraendert');

-- ============================================================
-- R3  current_streak bereits 0 → Funktion zaehlt nur aktive Streaks
-- ============================================================
UPDATE public.streaks
   SET current_streak    = 0,
       longest_streak    = 10,
       last_tracked_date = (CURRENT_DATE - INTERVAL '30 days')::date
 WHERE user_id = '33333333-3333-3333-3333-333333333333';

SELECT is(
  (SELECT public.reset_expired_streaks()),
  0,
  'R3 reset_expired_streaks gibt 0 zurueck, wenn keine aktive Streak abzulaufen hat');

SELECT * FROM finish();
ROLLBACK;
