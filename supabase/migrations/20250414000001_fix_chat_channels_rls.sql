-- ============================================================
-- READY 2 FIGHT — Fix: Fehlende SELECT Policy auf chat_channels
--
-- chat_channels hat RLS aktiviert (Migration 1), aber keine
-- SELECT Policy. Die chat_messages-Policies (cm_member_read,
-- cm_member_send) joinen auf chat_channels via Subquery —
-- ohne Leseberechtigung liefern diese immer 0 Zeilen.
-- ============================================================

-- Engagement-Mitglieder (Coach oder Athlet) duerfen den Channel sehen
CREATE POLICY cc_member_read ON public.chat_channels FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements e
    WHERE e.id = engagement_id
      AND (e.coach_id = auth.uid() OR e.athlete_id = auth.uid())
  )
);
