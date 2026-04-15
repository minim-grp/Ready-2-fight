-- ============================================================
-- READY 2 FIGHT — Migration: Profile-Auto-Create beim Signup
-- Datei: supabase/migrations/20260414000001_profile_autocreate.sql
--
-- Erweitert handle_new_auth_user():
--   - legt athlete_profiles an wenn role IN ('athlete','both')
--     - uebernimmt birth_date aus raw_user_meta_data (nullable)
--   - legt coach_profiles an wenn role IN ('coach','both')
--
-- Hintergrund: Signup-Formular erlaubt Multi-Choice Athlet + Coach.
-- 'both'-User brauchen beide Profile. Bislang mussten Clients das
-- Profil nach dem Signup manuell insertern — das ist ein Race-Risiko
-- und bricht die Onboarding-Flows bei fehlgeschlagenem Zweit-Insert.
--
-- Idempotent (ON CONFLICT DO NOTHING), damit Re-Runs oder
-- bereits-vorhandene Profile die Funktion nicht brechen.
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _role       public.user_role;
  _birth_date DATE;
BEGIN
  _role := COALESCE(
    (NEW.raw_user_meta_data->>'role')::public.user_role,
    'athlete'
  );

  BEGIN
    _birth_date := NULLIF(NEW.raw_user_meta_data->>'birth_date', '')::date;
  EXCEPTION WHEN invalid_datetime_format OR invalid_text_representation THEN
    _birth_date := NULL;
  END;

  INSERT INTO public.users (id, email, display_name, role, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    _role,
    COALESCE((NEW.raw_user_meta_data->>'locale')::public.language, 'de')
  )
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_settings (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  INSERT INTO public.streaks (user_id) VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;

  IF _role IN ('athlete', 'both') THEN
    INSERT INTO public.athlete_profiles (id, birth_date)
    VALUES (NEW.id, _birth_date)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  IF _role IN ('coach', 'both') THEN
    INSERT INTO public.coach_profiles (id)
    VALUES (NEW.id)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END $$;
