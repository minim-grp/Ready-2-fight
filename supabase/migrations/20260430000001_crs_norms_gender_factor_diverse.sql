-- ============================================================
-- READY 2 FIGHT — crs_norms.gender_factor: Key 'other' → 'diverse'
--
-- Followup #6 aus PR #32: der Pure Scorer aliast 'diverse' (DB-Enum
-- public.gender) auf 'other' (JSONB-Seed-Key aus Migration vom 2026-04-29).
-- Dieser Wechsel zieht den Alias-Hack raus und richtet die Seed-Keys
-- direkt am Enum aus. 'prefer_not_to_say' bleibt unveraendert.
--
-- Idempotent: nur wenn 'other' im JSONB existiert. Migration-PR muss
-- mit dem Code-Update auf supabase/functions/_shared/crsScore.ts
-- gemeinsam deployt werden — Edge Function Re-Deploy noetig, sonst
-- liefert genderFactor() fuer 'diverse'-User Faktor 1.0 statt 0.89.
-- ============================================================

UPDATE public.crs_norms
   SET gender_factor = (
         (gender_factor - 'other')
         || jsonb_build_object('diverse', gender_factor -> 'other')
       )
 WHERE gender_factor ? 'other';
