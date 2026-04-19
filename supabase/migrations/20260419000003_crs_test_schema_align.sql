-- ============================================================
-- READY 2 FIGHT — CRS-Tests: Schema-Angleichung an PRD §06 / Anhang B
-- Roadmap-Vorbereitung fuer §1.15 (CRS Test-State-Machine).
--
-- 1) Umbenennung `run_400m_sec` -> `high_knees_contacts`
--    (PRD §06: fuenfte Uebung sind High Knees, Bodenkontakte in 60 s,
--    nicht 400-m-Lauf). Foundation-Migration hatte hier eine Abweichung.
-- 2) Score-CHECK von 0-1000 auf 0-100 (PRD §06 Ranking-Tabelle +
--    Anhang B: CRS = Mittelwert der fuenf Einzelscores, je 0-100).
-- ============================================================


-- ############################################################
-- 1. Spalte umbenennen (inkl. CHECK-Constraint)
-- ############################################################

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name   = 'crs_tests'
       AND column_name  = 'run_400m_sec'
  ) THEN
    ALTER TABLE public.crs_tests
      RENAME COLUMN run_400m_sec TO high_knees_contacts;
  END IF;
END $$;

-- PostgreSQL benennt CHECK-Constraints beim RENAME COLUMN nicht um;
-- die alte constraint-Bedingung `run_400m_sec >= 0` bleibt auf der
-- neuen Spalte gueltig. Der Name ist kosmetisch — Neudefinition sicher:
ALTER TABLE public.crs_tests
  DROP CONSTRAINT IF EXISTS crs_tests_run_400m_sec_check;
ALTER TABLE public.crs_tests
  DROP CONSTRAINT IF EXISTS crs_tests_high_knees_contacts_check;
ALTER TABLE public.crs_tests
  ADD CONSTRAINT crs_tests_high_knees_contacts_check
  CHECK (high_knees_contacts IS NULL OR high_knees_contacts >= 0);


-- ############################################################
-- 2. Score-CHECK auf 0-100 einschraenken (PRD Anhang B)
-- ############################################################

ALTER TABLE public.crs_tests
  DROP CONSTRAINT IF EXISTS crs_tests_score_check;
ALTER TABLE public.crs_tests
  ADD CONSTRAINT crs_tests_score_check
  CHECK (score IS NULL OR score BETWEEN 0 AND 100);
