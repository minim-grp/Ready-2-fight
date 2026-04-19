-- ============================================================
-- READY 2 FIGHT — Migration: Streak mit 48h-Karenz (Roadmap §1.8)
-- Datei: supabase/migrations/20260418000002_streak_karenz.sql
--
-- Implementiert PRD §04 "Streak-Mechanik (Gehaertet)":
--   Ein verpasster Tag bricht die Streak nicht sofort. Trackt der
--   Athlet innerhalb von 48 h nach Ende des verpassten Tages nach,
--   laeuft sie nahtlos weiter; ab >48 h faellt sie auf 0.
--
-- Semantik (im Planungs-Report bestaetigt):
--   Karenz-Deadline = Ende des verpassten Tages + 48 h
--                   = last_tracked_date + INTERVAL '4 days' (UTC-Mitternacht)
--
-- Bestandteile:
--   1. Rewrite update_streak_on_tracking()  — Gap- & Karenz-Logik
--   2. Neue Fn reset_expired_streaks()      — Cron-seitiger Reset
--   3. pg_cron Schedule 04:00 UTC taeglich
--
-- Kein Schema-Change, keine neue RLS, keine neuen Indexe noetig.
--
-- ANNAHME (dokumentiert, entschieden fuer Sprint 1.8):
--   Karenz-Zeit-Check liest NEW.created_at (Server-Zeit beim INSERT).
--   Offline-Athleten mit >48 h Sync-Verzoegerung aus Sprint 1.7
--   koennen dadurch die Karenz verlieren. Praezise Loesung
--   (daily_tracking.tracked_at) folgt in separatem PR nach
--   Review von Sprint 1.7.
--
-- Hand-edit (nicht via supabase db diff), weil Funktions-Rewrites +
-- pg_cron-Schedule deklarativ klarer sind.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA extensions;


-- ------------------------------------------------------------
-- 1. update_streak_on_tracking()  — Rewrite mit Karenz
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.update_streak_on_tracking()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user_id    UUID := NEW.athlete_id;
  v_last_date  DATE;
  v_current    INT;
  v_longest    INT;
  v_gap_days   INT;
  v_karenz_end TIMESTAMPTZ;
BEGIN
  SELECT last_tracked_date, current_streak, longest_streak
    INTO v_last_date, v_current, v_longest
    FROM public.streaks
    WHERE user_id = v_user_id;

  IF v_last_date IS NULL THEN
    v_current := 1;

  ELSIF NEW.date <= v_last_date THEN
    -- Nachtrag eines gleichen oder weiter zurueckliegenden Tages.
    -- UNIQUE(athlete_id, date) blockt den exakten Tag ohnehin;
    -- <last_date-Tage bleiben unberuecksichtigt (anti-gaming, PRD §04).
    RETURN NEW;

  ELSE
    v_gap_days := NEW.date - v_last_date;  -- DATE - DATE => INT (Tage)

    IF v_gap_days = 1 THEN
      -- Direkter Folgetag.
      v_current := v_current + 1;

    ELSIF v_gap_days = 2 THEN
      -- Ein verpasster Tag. Karenz = 48 h nach dessen Ende.
      v_karenz_end := (v_last_date + INTERVAL '2 days')::timestamptz
                    + INTERVAL '48 hours';
      IF NEW.created_at <= v_karenz_end THEN
        v_current := v_current + 1;
      ELSE
        v_current := 1;
      END IF;

    ELSE
      -- gap >= 3: Karenz-Fenster kann nicht mehr eingehalten werden.
      v_current := 1;
    END IF;
  END IF;

  IF v_current > v_longest THEN
    v_longest := v_current;
  END IF;

  UPDATE public.streaks
    SET current_streak    = v_current,
        longest_streak    = v_longest,
        last_tracked_date = GREATEST(NEW.date, COALESCE(v_last_date, NEW.date))
    WHERE user_id = v_user_id;

  IF v_current IN (7, 30, 100) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'streak',
      v_current || '-Tage-Streak!',
      'Du hast ' || v_current || ' Tage in Folge getrackt. Weiter so!',
      jsonb_build_object('streak', v_current)
    );
  END IF;

  RETURN NEW;
END
$fn$;


-- ------------------------------------------------------------
-- 2. reset_expired_streaks()  — Cron-Handler
--    Setzt current_streak = 0 fuer jeden User, dessen Karenz-Fenster
--    abgelaufen ist.  longest_streak bleibt erhalten.
--    Rueckgabe: Anzahl der zurueckgesetzten Streaks (nuetzlich fuer
--    Monitoring / spaetere Cron-Telemetrie).
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.reset_expired_streaks()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_count INT;
BEGIN
  WITH expired AS (
    UPDATE public.streaks
       SET current_streak = 0
     WHERE last_tracked_date IS NOT NULL
       AND current_streak > 0
       AND (last_tracked_date::timestamptz + INTERVAL '4 days') < now()
    RETURNING user_id
  )
  SELECT count(*) INTO v_count FROM expired;
  RETURN v_count;
END
$fn$;

REVOKE ALL ON FUNCTION public.reset_expired_streaks()
  FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------
-- 3. pg_cron-Schedule: taeglich 04:00 UTC
--    Idempotent: bestehender Job wird vor Anlage abgemeldet.
-- ------------------------------------------------------------
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'r2f_streak_reset') THEN
    PERFORM cron.unschedule('r2f_streak_reset');
  END IF;

  PERFORM cron.schedule(
    'r2f_streak_reset',
    '0 4 * * *',
    'SELECT public.reset_expired_streaks();'
  );
END $$;
