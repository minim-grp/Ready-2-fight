-- ============================================================
-- READY 2 FIGHT — Migration: daily_tracking.tracked_at + Karenz-Praezisierung
-- (Followup aus Sprint 1.8 streak_karenz, vorgesehen "nach Sprint 1.7-Review")
--
-- Issue: update_streak_on_tracking() liest aktuell NEW.created_at
-- (Server-Zeit beim INSERT) als Karenz-Anker. Bei Offline-Sync kann
-- die Server-Zeit weit nach dem realen Eingabezeitpunkt liegen, was
-- die Karenz unverdient kappt.
--
-- Fix: neue Spalte daily_tracking.tracked_at TIMESTAMPTZ — der vom
-- Client gesetzte tatsaechliche Eingabezeitpunkt. Default = now()
-- fuer Online-Inserts, Frontend setzt bei Offline-Queue-Replay den
-- echten Eingabezeitpunkt. CHECK verbietet Future-Dates (anti-gaming).
--
-- Backfill: existierende Rows uebernehmen created_at als tracked_at,
-- damit historische Streaks unveraendert bleiben.
--
-- Trigger update_streak_on_tracking() liest jetzt NEW.tracked_at.
-- ============================================================

-- 1. Spalte hinzufuegen (idempotent), Backfill, NOT NULL nachziehen.
ALTER TABLE public.daily_tracking
  ADD COLUMN IF NOT EXISTS tracked_at TIMESTAMPTZ;

UPDATE public.daily_tracking
   SET tracked_at = created_at
 WHERE tracked_at IS NULL;

ALTER TABLE public.daily_tracking
  ALTER COLUMN tracked_at SET NOT NULL,
  ALTER COLUMN tracked_at SET DEFAULT now();

-- 2. CHECK: kein Future-Date (anti-gaming).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'daily_tracking_tracked_at_not_future'
  ) THEN
    ALTER TABLE public.daily_tracking
      ADD CONSTRAINT daily_tracking_tracked_at_not_future
      CHECK (tracked_at <= now() + INTERVAL '5 minutes');
  END IF;
END $$;


-- 3. update_streak_on_tracking() — Karenz-Anker auf tracked_at umstellen.
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
    RETURN NEW;

  ELSE
    v_gap_days := NEW.date - v_last_date;

    IF v_gap_days = 1 THEN
      v_current := v_current + 1;

    ELSIF v_gap_days = 2 THEN
      v_karenz_end := (v_last_date + INTERVAL '2 days')::timestamptz
                    + INTERVAL '48 hours';
      -- Karenz-Anker = realer Eingabezeitpunkt (NEW.tracked_at),
      -- nicht NEW.created_at — robust gegen Offline-Sync-Verzoegerung.
      IF NEW.tracked_at <= v_karenz_end THEN
        v_current := v_current + 1;
      ELSE
        v_current := 1;
      END IF;

    ELSE
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
