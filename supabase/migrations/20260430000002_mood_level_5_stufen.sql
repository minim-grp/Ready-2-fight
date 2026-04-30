-- ============================================================
-- READY 2 FIGHT — mood_level: 3 → 5 Stufen
--
-- Erweitert das public.mood_level-ENUM um zwei zusaetzliche Stufen
-- ('sehr_schlecht', 'sehr_gut'), passend zur 5-Phasen-Mond-Skala
-- 🌑 → 🌕 im Hi-fi-Mock (vgl. Followup im Sprint-Stand-Memory).
--
-- Postgres erlaubt `ALTER TYPE ... ADD VALUE` nicht innerhalb einer
-- Transaction. Supabase-Migrations laufen in TX. Workaround: Drop &
-- Recreate. Dabei wird die Spalte daily_tracking.mood kurz auf TEXT
-- gecastet und nach dem Recreate wieder auf den neuen Enum gemappt.
-- Bestehende Werte ('gut', 'mittel', 'schlecht') bleiben gueltig
-- — sie sind im neuen Enum unveraendert enthalten.
--
-- ASSUMPTION: PRD §06 listet 3 Stufen (gut/mittel/schlecht). User-
-- Direktive aus Sprint-Memory weitet auf 5 Stufen wegen Hi-fi-Mock.
-- Migration ist additiv (alte Werte bleiben), daher kein Datenverlust.
-- sleep_quality + physical_condition bleiben bewusst 3-stufig (Spec).
-- ============================================================

-- 1. mood-Spalte temporaer auf TEXT casten
ALTER TABLE public.daily_tracking
  ALTER COLUMN mood TYPE TEXT USING mood::TEXT;

-- 2. Alten Enum-Type droppen (CASCADE nicht noetig — Spalte ist bereits TEXT)
DROP TYPE IF EXISTS public.mood_level;

-- 3. Neuen 5-stufigen Enum erstellen (Reihenfolge schlecht → gut)
CREATE TYPE public.mood_level AS ENUM (
  'sehr_schlecht',
  'schlecht',
  'mittel',
  'gut',
  'sehr_gut'
);

-- 4. Spalte zurueck auf den neuen Enum casten
ALTER TABLE public.daily_tracking
  ALTER COLUMN mood TYPE public.mood_level
  USING mood::public.mood_level;
