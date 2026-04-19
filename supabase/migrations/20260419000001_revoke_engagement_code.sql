-- ============================================================
-- READY 2 FIGHT — RPC: revoke_engagement_code
-- Roadmap-Schritt 1.11 (Code-Liste mit Revoke-Button).
--
-- Coach widerruft einen eigenen Engagement-Code. Bereits eingeloeste
-- Engagements bleiben unangetastet — der Code kann nur nicht mehr
-- weiter eingeloest werden. Schreibt audit.events (CLAUDE.md §0.7).
-- ============================================================

CREATE OR REPLACE FUNCTION public.revoke_engagement_code(p_code_id UUID)
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_row     public.engagement_codes%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  SELECT * INTO v_row FROM public.engagement_codes
   WHERE id = p_code_id FOR UPDATE;

  IF NOT FOUND OR v_row.coach_id <> auth.uid() THEN
    RAISE EXCEPTION 'code_not_found';
  END IF;

  IF v_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'code_already_revoked';
  END IF;

  UPDATE public.engagement_codes
     SET revoked_at = now()
   WHERE id = p_code_id
   RETURNING revoked_at INTO v_row.revoked_at;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('engagement_code_revoked', auth.uid(), p_code_id,
            jsonb_build_object('code', v_row.code));

  RETURN v_row.revoked_at;
END $$;

REVOKE ALL ON FUNCTION public.revoke_engagement_code(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.revoke_engagement_code(UUID) TO authenticated;
