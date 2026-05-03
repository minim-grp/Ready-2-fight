-- ============================================================
-- READY 2 FIGHT — Migration: competitions.comp_coach_read tighten
-- (Roadmap §1.26)
--
-- Vorher: USING (public.is_linked_coach(athlete_id))
-- Nachher: USING (public.is_linked_coach_with_tracking(athlete_id))
--
-- Begruendung: Roadmap §1.26 verlangt explizit die Permission
-- can_see_tracking fuer Coach-Sicht auf Wettkaempfe — Wettkaempfe
-- sind allgemeine Daten, aber an Tracking-Permission gekoppelt.
-- Vorher konnte JEDER aktiv-verlinkte Coach Wettkaempfe lesen, was
-- nicht den Permission-Granularitaet-Regeln aus CLAUDE.md §0.6
-- entspricht.
--
-- Effekt: Coach ohne can_see_tracking sieht jetzt KEINE
-- Wettkaempfe mehr. Athlete-Self-Access ueber comp_self_all bleibt
-- unveraendert.
-- ============================================================

DROP POLICY IF EXISTS comp_coach_read ON public.competitions;
CREATE POLICY comp_coach_read ON public.competitions FOR SELECT
  USING (public.is_linked_coach_with_tracking(athlete_id));
