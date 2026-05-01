-- ============================================================
-- READY 2 FIGHT — Session-Completion-XP-Trigger (Roadmap §1.23-Backend)
--
-- AFTER INSERT auf public.session_completions: vergibt XP an den
-- Athleten ueber die in xp_rules vordefinierte Action 'session_completed'
-- (30 XP). Trigger dupliziert die Inline-XP-Logik aus grant_xp() (Migration 2),
-- weil grant_xp() auf auth.uid() angewiesen ist; der Trigger nimmt direkt
-- NEW.athlete_id — RLS "Athletes manage own completions" garantiert, dass
-- der INSERT nur fuer eigene athlete_id durchgeht, und Service-Role-INSERTs
-- (z.B. zukuenftige Cron-Jobs) funktionieren ebenfalls.
--
-- Idempotenz: der UNIQUE(session_id, athlete_id)-Constraint auf
-- session_completions verhindert doppelte Eintraege und damit Doppel-XP.
--
-- Side Effects: xp_log-Entry, users.xp_total++, users.level/level_title
-- aktualisiert, level_up-Notification beim Schwellenuebertritt.
-- ============================================================

CREATE OR REPLACE FUNCTION public.on_session_completion_grant_xp()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_user_id   UUID := NEW.athlete_id;
  v_xp_amount INT;
  v_old_level INT;
  v_new_xp    INT;
  v_new_level INT;
  v_new_title TEXT;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT xr.xp_amount INTO v_xp_amount
    FROM public.xp_rules xr
   WHERE xr.action = 'session_completed';

  -- Sollte nicht passieren (xp_rules ist seeded), aber fail-soft:
  IF v_xp_amount IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT u.level INTO v_old_level
    FROM public.users u WHERE u.id = v_user_id;

  INSERT INTO public.xp_log (user_id, action, xp_amount, context)
    VALUES (v_user_id, 'session_completed', v_xp_amount,
            jsonb_build_object(
              'session_id',    NEW.session_id,
              'completion_id', NEW.id));

  UPDATE public.users
     SET xp_total = xp_total + v_xp_amount
   WHERE id = v_user_id
   RETURNING xp_total INTO v_new_xp;

  SELECT lt.level, lt.title INTO v_new_level, v_new_title
    FROM public.level_thresholds lt
   WHERE lt.xp_required <= v_new_xp
   ORDER BY lt.level DESC
   LIMIT 1;

  UPDATE public.users
     SET level       = COALESCE(v_new_level, 1),
         level_title = COALESCE(v_new_title, 'Awakening')
   WHERE id = v_user_id;

  IF COALESCE(v_new_level, 1) > COALESCE(v_old_level, 1) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (v_user_id, 'level_up', 'Level Up!',
              'Du bist jetzt Level ' || v_new_level || ' — ' || v_new_title || '!',
              jsonb_build_object(
                'old_level', v_old_level,
                'new_level', v_new_level,
                'title',     v_new_title));
  END IF;

  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS on_session_completion_grant_xp ON public.session_completions;
CREATE TRIGGER on_session_completion_grant_xp
  AFTER INSERT ON public.session_completions
  FOR EACH ROW EXECUTE FUNCTION public.on_session_completion_grant_xp();
