-- ============================================================
-- READY 2 FIGHT — Migration: daily_tracking an PRD §06 angleichen
-- Datei: supabase/migrations/20260418000001_tracking_schema_prd.sql
--
-- Bringt public.daily_tracking in Deckung mit PRD §06 Daily Tracking:
--   - Neue Enums: sleep_quality, mood_level, physical_condition, activity_level
--   - sleep_hours (NUMERIC) / mood (INT) / energy (INT) werden ersetzt
--     durch Enum-Spalten gut/mittel/schlecht (PRD-Wortlaut).
--   - Neue Felder: water_l, calories_kcal, activity_level,
--     soreness (bool), soreness_region (text).
--   - Gewichts-Bereich 30–300 (statt 20–300) gemaess PRD.
--
-- Pflicht-Felder bleiben schema-seitig NULLABLE (wie bisher das gesamte
-- Tracking-Schema ausser "trained"). Erzwungen wird die Pflicht durch
-- das Formular im Frontend — das ist konsistent mit dem existierenden
-- Muster und erlaubt Offline-Drafts.
--
-- RLS-Policies (dt_self_all, dt_coach_read) und die sRPE-Generated-Column
-- bleiben unveraendert — sie referenzieren keine der geaenderten Spalten.
--
-- Idempotent (DROP ... IF EXISTS, ADD ... IF NOT EXISTS).
-- Hinweis: DROP COLUMN entfernt Daten aus sleep_hours/mood/energy.
-- Staging enthaelt nur Dev-Daten; Production existiert noch nicht
-- (Roadmap 1.44) — daher akzeptabel.
-- ============================================================

-- ------------------------------------------------------------
-- 1. Enums
-- ------------------------------------------------------------
DO $$ BEGIN
  CREATE TYPE public.sleep_quality AS ENUM ('gut', 'mittel', 'schlecht');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.mood_level AS ENUM ('gut', 'mittel', 'schlecht');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.physical_condition AS ENUM ('gut', 'mittel', 'schlecht');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.activity_level AS ENUM ('keine', 'moderat', 'hoch', 'extrem');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ------------------------------------------------------------
-- 2. Alte numerische Spalten entfernen
-- ------------------------------------------------------------
ALTER TABLE public.daily_tracking DROP COLUMN IF EXISTS sleep_hours;
ALTER TABLE public.daily_tracking DROP COLUMN IF EXISTS mood;
ALTER TABLE public.daily_tracking DROP COLUMN IF EXISTS energy;

-- ------------------------------------------------------------
-- 3. Neue Spalten
-- ------------------------------------------------------------
ALTER TABLE public.daily_tracking
  ADD COLUMN IF NOT EXISTS sleep_quality       public.sleep_quality,
  ADD COLUMN IF NOT EXISTS mood                public.mood_level,
  ADD COLUMN IF NOT EXISTS physical_condition  public.physical_condition,
  ADD COLUMN IF NOT EXISTS water_l             NUMERIC(3,1),
  ADD COLUMN IF NOT EXISTS calories_kcal       INT,
  ADD COLUMN IF NOT EXISTS activity_level      public.activity_level,
  ADD COLUMN IF NOT EXISTS soreness            BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS soreness_region     TEXT;

-- ------------------------------------------------------------
-- 4. Check-Constraints (benannt, damit idempotent re-runnable)
-- ------------------------------------------------------------
ALTER TABLE public.daily_tracking
  DROP CONSTRAINT IF EXISTS daily_tracking_water_l_check;
ALTER TABLE public.daily_tracking
  ADD  CONSTRAINT daily_tracking_water_l_check
       CHECK (water_l IS NULL OR water_l BETWEEN 0 AND 10);

ALTER TABLE public.daily_tracking
  DROP CONSTRAINT IF EXISTS daily_tracking_calories_kcal_check;
ALTER TABLE public.daily_tracking
  ADD  CONSTRAINT daily_tracking_calories_kcal_check
       CHECK (calories_kcal IS NULL OR calories_kcal BETWEEN 0 AND 10000);

ALTER TABLE public.daily_tracking
  DROP CONSTRAINT IF EXISTS daily_tracking_soreness_region_len_check;
ALTER TABLE public.daily_tracking
  ADD  CONSTRAINT daily_tracking_soreness_region_len_check
       CHECK (soreness_region IS NULL OR length(soreness_region) BETWEEN 1 AND 100);

-- Region darf nur gesetzt sein, wenn soreness = true
ALTER TABLE public.daily_tracking
  DROP CONSTRAINT IF EXISTS daily_tracking_soreness_region_consistency;
ALTER TABLE public.daily_tracking
  ADD  CONSTRAINT daily_tracking_soreness_region_consistency
       CHECK (soreness = true OR soreness_region IS NULL);

-- Gewicht: Minimum 30 statt 20 kg (PRD §06)
ALTER TABLE public.daily_tracking
  DROP CONSTRAINT IF EXISTS daily_tracking_weight_kg_check;
ALTER TABLE public.daily_tracking
  ADD  CONSTRAINT daily_tracking_weight_kg_check
       CHECK (weight_kg IS NULL OR weight_kg BETWEEN 30 AND 300);
