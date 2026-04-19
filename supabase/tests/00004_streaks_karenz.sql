-- ============================================================
-- READY 2 FIGHT — pgTAP: Streak 48h-Karenz (Roadmap §1.8)
-- Datei: supabase/tests/00004_streaks_karenz.sql
--
-- Testet das Zusammenspiel aus update_streak_on_tracking() und der
-- Karenz-Regel nach PRD §04 "Streak-Mechanik (Gehaertet)":
--   "Wird ein Tag verpasst, gilt die Streak als pausiert. Trackt der
--    Athlet innerhalb von 48 h nach Ende des verpassten Tages nach,
--    laeuft sie nahtlos weiter; erst ab >48 h faellt sie auf 0."
--
-- Semantik-Festlegung (vom PRD-Wortlaut "innerhalb 48 h nach"
-- abgeleitet und im Planungs-Report bestaetigt):
--   Karenz-Deadline = Ende des verpassten Tages + 48 h
--                   = last_tracked_date + INTERVAL '4 days' (UTC-Mitternacht)
--
-- Erwartung gegen aktuellen Trigger (Commit f10ad43):
--   - K01, K04, K05, K06, K07  gruen
--   - K03                      ROT  → beweist: Migration noetig
-- Nach Migration (streak_karenz): alle 6 gruen.
--
-- Hinweis: K02 wurde nach Review entfernt, weil das urspruengliche
-- Szenario (gap=1, verspaetetes created_at) keinen Karenz-Pfad testet.
-- K03 bleibt der eigentliche Karenz-Beweis (gap=2 innerhalb 48h).
-- ============================================================

BEGIN;
CREATE EXTENSION IF NOT EXISTS pgtap;
SELECT plan(6);

CREATE SCHEMA IF NOT EXISTS tests;

-- Konsistent mit supabase/tests/00002_triggers.sql
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

-- Helper: Tracking-Row mit frei waehlbarem created_at einfuegen.
-- Umgeht RLS (SECURITY DEFINER); AFTER-INSERT-Trigger feuert trotzdem.
CREATE OR REPLACE FUNCTION tests.insert_tracking(
  p_athlete UUID,
  p_date    DATE,
  p_created TIMESTAMPTZ
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.daily_tracking (athlete_id, date, mood, physical_condition, trained, created_at)
  VALUES (p_athlete, p_date, 'gut', 'gut', false, p_created);
END $$;

-- Helper: Streak + daily_tracking fuer den Test-User zuruecksetzen.
CREATE OR REPLACE FUNCTION tests.reset_streak_state(p_user UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.daily_tracking WHERE athlete_id = p_user;
  UPDATE public.streaks
    SET current_streak = 0, longest_streak = 0, last_tracked_date = NULL
    WHERE user_id = p_user;
END $$;

-- ------------------------------------------------------------
-- Setup
-- ------------------------------------------------------------
SELECT tests.create_user(
  '22222222-2222-2222-2222-222222222222'::uuid,
  'karenz@test.r2f'
);

-- ============================================================
-- K01  direkter Folgetag → current = 2   (Baseline)
-- ============================================================
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-01',
  '2026-03-01 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-02',
  '2026-03-02 20:00:00+00'::timestamptz);

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  2,
  'K01 direkter Folgetag erhoeht streak (muss mit und ohne Karenz gruen bleiben)');

-- ============================================================
-- K03  "heute nach einem verpassten Tag" innerhalb Karenz
--      last=2026-03-01, Pause 2026-03-02, Insert date=2026-03-03 um
--      12:00 (= 12 h nach Ende verpasster Tag). Soll: +1 nahtlos. ROT aktuell.
-- ============================================================
SELECT tests.reset_streak_state('22222222-2222-2222-2222-222222222222');

SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-01',
  '2026-03-01 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-03',
  '2026-03-03 12:00:00+00'::timestamptz);

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  2,
  'K03 Track am Folgetag nach einem verpassten Tag innerhalb Karenz → +1');

-- ============================================================
-- K04  Nach Ablauf der Karenz → Reset auf 1
--      Karenz endet 2026-03-05 00:00; Insert 2026-03-05 09:00 ist drueber.
-- ============================================================
SELECT tests.reset_streak_state('22222222-2222-2222-2222-222222222222');

SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-01',
  '2026-03-01 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-05',
  '2026-03-05 09:00:00+00'::timestamptz);

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'K04 Insert >48h nach Ende verpasster Tag → Reset auf 1');

-- ============================================================
-- K05  2+ Tage Luecke → Reset, unabhaengig von created_at
-- ============================================================
SELECT tests.reset_streak_state('22222222-2222-2222-2222-222222222222');

SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-01',
  '2026-03-01 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-04',
  '2026-03-04 08:00:00+00'::timestamptz);

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  1,
  'K05 Luecke >=2 Tage resettet Streak, auch innerhalb Karenz-Zeitfenster');

-- ============================================================
-- K06  Nachtrag weit zurueckliegenden Tages → no-op (anti-gaming)
-- ============================================================
SELECT tests.reset_streak_state('22222222-2222-2222-2222-222222222222');

-- current=5, last=2026-03-10 (ohne tatsaechliche Tracks; nur State)
UPDATE public.streaks
  SET current_streak = 5, longest_streak = 5, last_tracked_date = '2026-03-10'
  WHERE user_id = '22222222-2222-2222-2222-222222222222';

SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-04',
  '2026-03-15 08:00:00+00'::timestamptz);

SELECT is(
  (SELECT current_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  5,
  'K06 Nachtrag eines weit zurueckliegenden Tages erhoeht Streak nicht');

-- ============================================================
-- K07  longest_streak bleibt beim Reset erhalten
-- ============================================================
SELECT tests.reset_streak_state('22222222-2222-2222-2222-222222222222');

SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-01',
  '2026-03-01 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-02',
  '2026-03-02 20:00:00+00'::timestamptz);
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-03',
  '2026-03-03 20:00:00+00'::timestamptz);
-- Luecke >48h
SELECT tests.insert_tracking(
  '22222222-2222-2222-2222-222222222222', '2026-03-08',
  '2026-03-08 20:00:00+00'::timestamptz);

SELECT is(
  (SELECT longest_streak FROM public.streaks
    WHERE user_id = '22222222-2222-2222-2222-222222222222'),
  3,
  'K07 longest_streak wird beim Reset nicht zurueckgesetzt');

SELECT * FROM finish();
ROLLBACK;
