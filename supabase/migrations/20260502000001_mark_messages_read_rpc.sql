-- ============================================================
-- READY 2 FIGHT — RPC public.mark_messages_read (Roadmap §1.30)
--
-- Setzt read_at = now() fuer alle Messages im Channel, deren
-- sender_id NICHT der Caller ist (eigene Messages bleiben
-- unbehandelt) und die noch nicht gelesen wurden.
--
-- SECURITY DEFINER: Es existiert keine UPDATE-Policy auf
-- public.chat_messages. Das ist gewollt — Read-Receipt-Updates
-- sind die einzige erlaubte UPDATE-Operation und laufen
-- ausschliesslich ueber diese RPC. Die Funktion prueft selbst
-- die Channel-Mitgliedschaft (Coach oder Athlet im Engagement)
-- und vermeidet so eine zu breite Policy.
--
-- Errors:
--   - not_authenticated  auth.uid() IS NULL
--   - channel_not_member Caller ist weder coach noch athlete
--                        des dem Channel zugehoerigen Engagements
--
-- Returns: BIGINT — Anzahl frisch markierter Messages.
-- ============================================================

CREATE OR REPLACE FUNCTION public.mark_messages_read(p_channel_id UUID)
RETURNS BIGINT
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid     UUID := auth.uid();
  v_member  BOOLEAN;
  v_count   BIGINT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.chat_channels ch
    JOIN public.coach_athlete_engagements e ON e.id = ch.engagement_id
    WHERE ch.id = p_channel_id
      AND (e.coach_id = v_uid OR e.athlete_id = v_uid)
  ) INTO v_member;

  IF NOT v_member THEN
    RAISE EXCEPTION 'channel_not_member';
  END IF;

  UPDATE public.chat_messages
     SET read_at = now()
   WHERE channel_id = p_channel_id
     AND sender_id <> v_uid
     AND read_at IS NULL;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN v_count;
END $$;

REVOKE ALL ON FUNCTION public.mark_messages_read(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_messages_read(UUID) TO authenticated;
