-- ============================================================
-- READY 2 FIGHT — Engagement-Lifecycle (pause / resume / end)
-- Roadmap-Schritt 1.13.
--
-- 1) chat_channels.read_only_until (12 Monate Retention nach End).
-- 2) on_engagement_ended erweitert: can_see_* + can_create_plans
--    werden auf false gesetzt, Chat-Channel wird gesperrt und
--    read_only_until auf now() + 12 Monate gesetzt.
-- 3) validate_engagement_update erlaubt jetzt auch dem Athleten
--    active<->paused (bisher nur Coach).
-- 4) RPCs pause_engagement / resume_engagement / end_engagement
--    fuer Athlet und Coach. Re-Auth-Pflicht fuer End wird
--    frontend-seitig erzwungen (CLAUDE.md §3).
-- 5) Audit-Log pro Lifecycle-Event (CLAUDE.md §0.7).
-- ============================================================


-- ############################################################
-- 1. chat_channels.read_only_until
-- ############################################################

ALTER TABLE public.chat_channels
  ADD COLUMN IF NOT EXISTS read_only_until TIMESTAMPTZ;


-- ############################################################
-- 2. Trigger-Funktion on_engagement_ended erweitern
-- ############################################################

CREATE OR REPLACE FUNCTION public.on_engagement_ended()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
    NEW.ended_at         = COALESCE(NEW.ended_at, now());
    NEW.can_see_tracking = false;
    NEW.can_see_meals    = false;
    NEW.can_see_tests    = false;
    NEW.can_create_plans = false;

    UPDATE public.health_record_shares
       SET revoked_at = now()
     WHERE engagement_id = NEW.id
       AND revoked_at IS NULL;

    UPDATE public.chat_channels
       SET is_locked       = true,
           locked_at       = COALESCE(locked_at, now()),
           read_only_until = COALESCE(read_only_until, now() + interval '12 months')
     WHERE engagement_id = NEW.id;
  END IF;

  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ############################################################
-- 3. Trigger-Funktion validate_engagement_update erweitern
--    (Athlet darf active<->paused)
-- ############################################################

CREATE OR REPLACE FUNCTION public.validate_engagement_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF auth.uid() = OLD.coach_id THEN
      IF NOT (
        (OLD.status = 'active' AND NEW.status = 'paused') OR
        (OLD.status = 'paused' AND NEW.status = 'active') OR
        (NEW.status = 'ended')
      ) THEN
        RAISE EXCEPTION 'Coach darf Status nicht von % zu % aendern', OLD.status, NEW.status;
      END IF;

      IF NEW.status = 'ended' THEN
        NEW.ended_by = auth.uid();
        NEW.end_reason = COALESCE(NEW.end_reason, 'coach_ended');
      END IF;

    ELSIF auth.uid() = OLD.athlete_id THEN
      IF NOT (
        (OLD.status = 'pending' AND NEW.status = 'active') OR
        (OLD.status = 'active'  AND NEW.status = 'paused') OR
        (OLD.status = 'paused'  AND NEW.status = 'active') OR
        (NEW.status = 'ended')
      ) THEN
        RAISE EXCEPTION 'Athlet darf Status nicht von % zu % aendern', OLD.status, NEW.status;
      END IF;

      IF NEW.status = 'ended' THEN
        NEW.ended_by = auth.uid();
        NEW.end_reason = COALESCE(NEW.end_reason, 'athlete_left');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ############################################################
-- 4a. RPC: pause_engagement
-- ############################################################

CREATE OR REPLACE FUNCTION public.pause_engagement(p_engagement_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.coach_athlete_engagements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.coach_athlete_engagements
   WHERE id = p_engagement_id FOR UPDATE;

  IF NOT FOUND
     OR (v_row.coach_id <> auth.uid() AND v_row.athlete_id <> auth.uid()) THEN
    RAISE EXCEPTION 'engagement_not_found';
  END IF;

  IF v_row.status <> 'active' THEN
    RAISE EXCEPTION 'engagement_not_active';
  END IF;

  UPDATE public.coach_athlete_engagements
     SET status = 'paused'
   WHERE id = p_engagement_id
   RETURNING updated_at INTO v_row.updated_at;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('engagement_paused', auth.uid(), p_engagement_id,
            jsonb_build_object(
              'coach_id',   v_row.coach_id,
              'athlete_id', v_row.athlete_id));

  RETURN v_row.updated_at;
END $$;

REVOKE ALL ON FUNCTION public.pause_engagement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pause_engagement(UUID) TO authenticated;


-- ############################################################
-- 4b. RPC: resume_engagement
-- ############################################################

CREATE OR REPLACE FUNCTION public.resume_engagement(p_engagement_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row public.coach_athlete_engagements%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.coach_athlete_engagements
   WHERE id = p_engagement_id FOR UPDATE;

  IF NOT FOUND
     OR (v_row.coach_id <> auth.uid() AND v_row.athlete_id <> auth.uid()) THEN
    RAISE EXCEPTION 'engagement_not_found';
  END IF;

  IF v_row.status <> 'paused' THEN
    RAISE EXCEPTION 'engagement_not_paused';
  END IF;

  UPDATE public.coach_athlete_engagements
     SET status = 'active'
   WHERE id = p_engagement_id
   RETURNING updated_at INTO v_row.updated_at;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('engagement_resumed', auth.uid(), p_engagement_id,
            jsonb_build_object(
              'coach_id',   v_row.coach_id,
              'athlete_id', v_row.athlete_id));

  RETURN v_row.updated_at;
END $$;

REVOKE ALL ON FUNCTION public.resume_engagement(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.resume_engagement(UUID) TO authenticated;


-- ############################################################
-- 4c. RPC: end_engagement
-- ############################################################

CREATE OR REPLACE FUNCTION public.end_engagement(
  p_engagement_id UUID,
  p_end_reason    TEXT DEFAULT NULL
)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row         public.coach_athlete_engagements%ROWTYPE;
  v_end_reason  TEXT;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF p_end_reason IS NOT NULL
     AND p_end_reason NOT IN ('completed','athlete_left','coach_ended','mutual') THEN
    RAISE EXCEPTION 'invalid_end_reason';
  END IF;

  SELECT * INTO v_row FROM public.coach_athlete_engagements
   WHERE id = p_engagement_id FOR UPDATE;

  IF NOT FOUND
     OR (v_row.coach_id <> auth.uid() AND v_row.athlete_id <> auth.uid()) THEN
    RAISE EXCEPTION 'engagement_not_found';
  END IF;

  IF v_row.status = 'ended' THEN
    RAISE EXCEPTION 'engagement_already_ended';
  END IF;

  v_end_reason := COALESCE(
    p_end_reason,
    CASE WHEN auth.uid() = v_row.coach_id THEN 'coach_ended' ELSE 'athlete_left' END);

  UPDATE public.coach_athlete_engagements
     SET status     = 'ended',
         end_reason = v_end_reason
   WHERE id = p_engagement_id
   RETURNING ended_at INTO v_row.ended_at;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('engagement_ended', auth.uid(), p_engagement_id,
            jsonb_build_object(
              'coach_id',   v_row.coach_id,
              'athlete_id', v_row.athlete_id,
              'end_reason', v_end_reason));

  RETURN v_row.ended_at;
END $$;

REVOKE ALL ON FUNCTION public.end_engagement(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.end_engagement(UUID, TEXT) TO authenticated;
