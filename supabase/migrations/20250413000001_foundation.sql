-- ============================================================
-- READY 2 FIGHT  —  SQL 1/3: FOUNDATION & ARCHITECTURE  (v2)
-- Aligned with PRD v4.0  ·  Target: Supabase (Postgres 15+)
-- Stand: 12.04.2026
--
-- ARCHITEKTUR-ÜBERSICHT
-- ---------------------------------------------------------------
--  Stack
--   • Auth ............ Supabase Auth (E-Mail+Passwort, ab Phase 2 TOTP-2FA)
--   • DB .............. Postgres 15 mit RLS auf JEDER Public-Tabelle
--   • Storage ......... Supabase Storage Buckets (siehe §11)
--   • Realtime ........ Postgres Replication für chat_messages, notifications
--   • Edge Functions .. Engagement-Code-Generierung, Account-Löschung,
--                       GDPR-Export, ab Phase 2 LLM-Calls
--   • Client .......... Mobile-first PWA (Athleten), Desktop-first (Coaches)
--
--  Schichten
--   1. auth.*           → von Supabase verwaltet (NICHT modifizieren)
--   2. public.*         → Domain-Daten, RLS-geschützt
--   3. private.*        → Server-only (Service-Role), kein direkter Client-Zugriff
--   4. audit.*          → Append-only Audit-Log, kein UPDATE/DELETE
--
--  Sicherheits-Prinzipien (aus PRD §8)
--   • Default-Deny: jede Tabelle hat RLS enabled, dann selektive Policies
--   • Stalking-Schutz: Engagement-Codes ohne Empfänger-E-Mail (siehe §9)
--   • Granulare Permissions pro Engagement: tracking/meals/tests/plans
--   • Health-Records: separate Freigabe pro Akte (siehe File 3)
--   • Audit-Log für sicherheitsrelevante Events (Login, Engagement, Delete)
--   • ai_consent als Hook für Phase-2-KI-Features (Default false)
--
--  Datenfluss-Kernregel
--   Ein Coach sieht Athletendaten NUR via aktivem Engagement
--   UND nur die Spalten, für die er die jeweilige can_see_*-Permission hat.
--   Alles über die Helper-Function is_linked_coach_with_*() in §10.
-- ============================================================


-- ############################################################
--  0. EXTENSIONS & SCHEMAS
-- ############################################################

CREATE EXTENSION IF NOT EXISTS "pgcrypto";    -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS "citext";       -- case-insensitive E-Mails
CREATE EXTENSION IF NOT EXISTS "pg_trgm";      -- Fuzzy-Search (Athleten-Suche)

CREATE SCHEMA IF NOT EXISTS audit;
CREATE SCHEMA IF NOT EXISTS private;

-- audit & private vom anonymen Client komplett abkoppeln
REVOKE ALL ON SCHEMA audit   FROM anon, authenticated;
REVOKE ALL ON SCHEMA private FROM anon, authenticated;


-- ############################################################
--  1. ENUMS
-- ############################################################

CREATE TYPE public.user_role AS ENUM ('athlete', 'coach', 'both');
CREATE TYPE public.user_status AS ENUM ('active', 'paused', 'pending_deletion', 'deleted');
CREATE TYPE public.gender AS ENUM ('male', 'female', 'diverse', 'prefer_not_to_say');
CREATE TYPE public.language AS ENUM ('de', 'en');


-- ############################################################
--  2. CORE: USERS  (1:1 mit auth.users)
-- ############################################################
-- Wir spiegeln auth.users in public.users, weil:
--  • RLS-Policies auf auth.users sind eingeschränkt
--  • Wir Domain-Felder (rolle, status, ai_consent, locale) brauchen
--  • Cross-Table-Joins via FK nur auf public.* möglich sind

CREATE TABLE public.users (
  id                 UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email              CITEXT UNIQUE NOT NULL,
  role               public.user_role NOT NULL DEFAULT 'athlete',
  status             public.user_status NOT NULL DEFAULT 'active',
  display_name       TEXT NOT NULL,
  avatar_url         TEXT,
  locale             public.language NOT NULL DEFAULT 'de',
  -- XP & Level (benötigt von grant_xp() in Migration 2)
  xp_total           INT NOT NULL DEFAULT 0,
  level              INT NOT NULL DEFAULT 1,
  level_title        TEXT NOT NULL DEFAULT 'Awakening',
  -- Subscription-Tier (benötigt von Data-Retention in Migration 3)
  subscription_tier  TEXT NOT NULL DEFAULT 'free' CHECK (subscription_tier IN ('free','pro')),
  -- KI-Hook (PRD §14, Phase 2): Opt-in zu KI-Features, Default false
  ai_consent         BOOLEAN NOT NULL DEFAULT false,
  ai_consent_at      TIMESTAMPTZ,
  -- Account-Löschung mit 30-Tage Grace-Period (PRD §8 Account-Löschung)
  deletion_requested_at TIMESTAMPTZ,
  deletion_scheduled_at TIMESTAMPTZ,
  last_seen_at       TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_status ON public.users(status) WHERE status <> 'active';
CREATE INDEX idx_users_role   ON public.users(role);

-- Trigger: bei jedem auth.users-INSERT spiegeln
CREATE OR REPLACE FUNCTION public.handle_new_auth_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users (id, email, display_name, role, locale)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE((NEW.raw_user_meta_data->>'role')::public.user_role, 'athlete'),
    COALESCE((NEW.raw_user_meta_data->>'locale')::public.language, 'de')
  );
  RETURN NEW;
END $$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_auth_user();


-- ############################################################
--  3. ROLLEN-PROFILE: ATHLETE & COACH
-- ############################################################
-- Getrennte Profile, weil 'both'-User beide Datensätze brauchen.
-- Profile sind 1:0..1 zu users(id).

CREATE TABLE public.athlete_profiles (
  id                 UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  birth_date         DATE,                           -- für Mindestalter-Check (PRD §8)
  gender             public.gender,
  height_cm          NUMERIC(5,2),
  weight_kg          NUMERIC(5,2),
  primary_sport_id   UUID,                           -- FK in File 3
  experience_years   INT CHECK (experience_years >= 0),
  bio                TEXT,
  onboarding_done    BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.coach_profiles (
  id                 UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  certification      TEXT,
  gym_name           TEXT,
  city               TEXT,
  bio                TEXT,
  specialties        TEXT[],                         -- z.B. ARRAY['boxing','bjj']
  onboarding_done    BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);


-- ############################################################
--  4. DAILY TRACKING  (offline-fähig, sRPE als generated col)
-- ############################################################

CREATE TABLE public.daily_tracking (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  date               DATE NOT NULL,
  sleep_hours        NUMERIC(3,1) CHECK (sleep_hours BETWEEN 0 AND 24),
  weight_kg          NUMERIC(5,2) CHECK (weight_kg  BETWEEN 20 AND 300),
  mood               INT          CHECK (mood       BETWEEN 1 AND 5),
  energy             INT          CHECK (energy     BETWEEN 1 AND 5),
  trained            BOOLEAN NOT NULL DEFAULT false,
  rpe                INT          CHECK (rpe        BETWEEN 1 AND 10),
  duration_min       INT          CHECK (duration_min BETWEEN 0 AND 600),
  notes              TEXT,
  -- sRPE = RPE × Dauer, automatisch (PRD §6 Daily Tracking)
  srpe               INT GENERATED ALWAYS AS (
                       CASE WHEN trained AND rpe IS NOT NULL AND duration_min IS NOT NULL
                            THEN rpe * duration_min ELSE NULL END
                     ) STORED,
  -- Optionale Zuordnung zu Engagement (für Coach-Sichtbarkeit), wird in File 3 als FK nachgezogen
  engagement_id      UUID,
  client_uuid        UUID,                           -- für Offline-Idempotenz
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, date)
);

CREATE INDEX idx_tracking_athlete_date ON public.daily_tracking(athlete_id, date DESC);


-- ############################################################
--  5. CRS / ATHLETIC BASE TEST
-- ############################################################

CREATE TABLE public.crs_tests (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  status             TEXT NOT NULL DEFAULT 'in_progress'
                       CHECK (status IN ('in_progress','completed','aborted','interrupted')),
  started_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at       TIMESTAMPTZ,
  -- Einzeldisziplinen (5 Übungen pro PRD §6 CRS)
  burpees_30s        INT CHECK (burpees_30s     >= 0),
  squats_60s         INT CHECK (squats_60s      >= 0),
  pushups_60s        INT CHECK (pushups_60s     >= 0),
  plank_sec          INT CHECK (plank_sec       >= 0),
  run_400m_sec       INT CHECK (run_400m_sec    >= 0),
  -- Berechnete Werte (per Edge-Function geschrieben, Formel in PRD Anhang B)
  score              INT CHECK (score BETWEEN 0 AND 1000),
  rank_label         TEXT,
  archetype          TEXT CHECK (archetype IN ('Tank','Assassin','Guardian','Berserker','Rookie')),
  client_uuid        UUID,                            -- Interruption-Recovery
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_crs_athlete_completed ON public.crs_tests(athlete_id, completed_at DESC)
  WHERE status = 'completed';


-- ############################################################
--  6. TRAINING PLANS  (Plan → Sessions → Exercises)
-- ############################################################

CREATE TABLE public.training_plans (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  athlete_id         UUID REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  engagement_id      UUID,                            -- FK wird in File 3 gesetzt
  title              TEXT NOT NULL,
  description        TEXT,
  is_template        BOOLEAN NOT NULL DEFAULT false,
  archived_at        TIMESTAMPTZ,
  starts_on          DATE,
  ends_on            DATE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (is_template = true OR athlete_id IS NOT NULL)
);

CREATE TABLE public.training_sessions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id            UUID NOT NULL REFERENCES public.training_plans(id) ON DELETE CASCADE,
  day_offset         INT NOT NULL,                    -- Tag relativ zum Plan-Start
  title              TEXT NOT NULL,
  notes              TEXT,
  position           INT NOT NULL DEFAULT 0
);

CREATE TABLE public.training_exercises (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id         UUID NOT NULL REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  name               TEXT NOT NULL,
  sets               INT,
  reps               INT,
  weight_kg          NUMERIC(6,2),
  duration_sec       INT,
  rest_sec           INT,
  notes              TEXT,
  position           INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_sessions_plan  ON public.training_sessions(plan_id, day_offset);
CREATE INDEX idx_exercises_sess ON public.training_exercises(session_id, position);


-- ############################################################
--  7. COMPETITIONS
-- ############################################################

CREATE TABLE public.competitions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id         UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  discipline         TEXT,
  competition_date   DATE NOT NULL,
  weight_class       TEXT,
  location           TEXT,
  result             TEXT,
  notes              TEXT,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_competitions_athlete_date ON public.competitions(athlete_id, competition_date DESC);


-- ############################################################
--  8. CHAT  (Realtime via Postgres Replication)
-- ############################################################
-- Channels sind immer 1:1 zwischen Coach und Athlet, gebunden an Engagement.
-- Beim Engagement-End: Channel wird read-only (12 Monate), siehe Trigger.

CREATE TABLE public.chat_channels (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  engagement_id      UUID UNIQUE NOT NULL,            -- FK in File 3
  is_locked          BOOLEAN NOT NULL DEFAULT false,  -- true nach engagement_ended
  locked_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.chat_messages (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id         UUID NOT NULL REFERENCES public.chat_channels(id) ON DELETE CASCADE,
  sender_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body               TEXT NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  read_at            TIMESTAMPTZ
);

CREATE INDEX idx_chat_msgs_channel ON public.chat_messages(channel_id, created_at DESC);

-- Realtime aktivieren
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_messages;


-- ############################################################
--  9. ENGAGEMENT-CODES  (Stalking-gehärtet, PRD v4.0 §5)
-- ############################################################
-- KEINE empfänger-E-Mail. Coach generiert Code via SECURITY-DEFINER-RPC,
-- Athlet löst ihn via SECURITY-DEFINER-RPC ein. Sichtbarkeit:
--   • Coach sieht eigene Codes (selbst erstellte)
--   • Athlet sieht NICHTS direkt — nur Redemption via RPC

CREATE TABLE public.engagement_codes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code               TEXT UNIQUE NOT NULL,            -- 8-stellig, alphanumerisch ohne 0/O/1/I
  coach_id           UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  internal_label     TEXT,                            -- nur Coach sichtbar, optional
  purpose            TEXT NOT NULL DEFAULT 'general',
  default_permissions JSONB NOT NULL DEFAULT
    '{"can_see_tracking":true,"can_see_meals":false,"can_see_tests":true,"can_create_plans":true}'::jsonb,
  max_uses           INT NOT NULL DEFAULT 1 CHECK (max_uses BETWEEN 1 AND 50),
  uses_count         INT NOT NULL DEFAULT 0,
  expires_at         TIMESTAMPTZ NOT NULL,            -- Coach-wählbar, max 30 Tage
  revoked_at         TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_eng_codes_coach ON public.engagement_codes(coach_id, created_at DESC);

-- Audit der Einlösungen — wer hat welchen Code wann benutzt
CREATE TABLE public.engagement_code_redemptions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code_id            UUID NOT NULL REFERENCES public.engagement_codes(id) ON DELETE CASCADE,
  athlete_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  engagement_id      UUID,                            -- FK in File 3
  redeemed_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(code_id, athlete_id)
);


-- ############################################################
-- 10. RLS-HELPER FUNCTIONS  (zentrale Sicherheits-Primitive)
-- ############################################################
-- Diese Funktionen sind die EINZIGE Quelle der Wahrheit für
-- "Darf Coach X Daten von Athlet Y sehen?". Jede Policy ruft sie auf.

CREATE OR REPLACE FUNCTION public.is_self(target_user UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() = target_user
$$;

-- Gibt die athlete_profiles.id des eingeloggten Users zurück (= auth.uid() wenn Profil existiert)
CREATE OR REPLACE FUNCTION public.own_athlete_profile_id()
RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT id FROM public.athlete_profiles WHERE id = auth.uid()
$$;

-- HAND-EDIT: LANGUAGE sql → plpgsql, damit die Funktionen erstellt werden können
-- BEVOR coach_athlete_engagements existiert (Tabelle kommt in Migration 3).
-- plpgsql validiert Tabellenreferenzen erst bei Ausführung, nicht bei Erstellung.

CREATE OR REPLACE FUNCTION public.is_linked_coach(athlete UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements e
    WHERE e.coach_id   = auth.uid()
      AND e.athlete_id = athlete
      AND e.status     = 'active'
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_linked_coach_with_tracking(athlete UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements e
    WHERE e.coach_id   = auth.uid()
      AND e.athlete_id = athlete
      AND e.status     = 'active'
      AND e.can_see_tracking = true
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_linked_coach_with_tests(athlete UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements e
    WHERE e.coach_id   = auth.uid()
      AND e.athlete_id = athlete
      AND e.status     = 'active'
      AND e.can_see_tests = true
  );
END $$;

CREATE OR REPLACE FUNCTION public.is_linked_coach_with_plans(athlete UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements e
    WHERE e.coach_id   = auth.uid()
      AND e.athlete_id = athlete
      AND e.status     = 'active'
      AND e.can_create_plans = true
  );
END $$;


-- ############################################################
-- 11. ROW LEVEL SECURITY  (Default-Deny + selektive Policies)
-- ############################################################

ALTER TABLE public.users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_profiles      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_tracking      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.crs_tests           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plans      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_sessions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_exercises  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.competitions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_channels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_codes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.engagement_code_redemptions ENABLE ROW LEVEL SECURITY;

-- USERS: jeder sieht sich selbst; Coach sieht verlinkte Athleten (Basisdaten)
CREATE POLICY users_self_select ON public.users FOR SELECT
  USING (id = auth.uid() OR public.is_linked_coach(id));
CREATE POLICY users_self_update ON public.users FOR UPDATE
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- ATHLETE_PROFILES
CREATE POLICY ap_self_all   ON public.athlete_profiles FOR ALL
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY ap_coach_read ON public.athlete_profiles FOR SELECT
  USING (public.is_linked_coach(id));

-- COACH_PROFILES: öffentlich lesbar (für Athleten, die einen Code einlösen wollen)
CREATE POLICY cp_public_read ON public.coach_profiles FOR SELECT USING (true);
CREATE POLICY cp_self_write  ON public.coach_profiles FOR ALL
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- DAILY_TRACKING
CREATE POLICY dt_self_all   ON public.daily_tracking FOR ALL
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY dt_coach_read ON public.daily_tracking FOR SELECT
  USING (public.is_linked_coach_with_tracking(athlete_id));

-- CRS_TESTS
CREATE POLICY ct_self_all   ON public.crs_tests FOR ALL
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY ct_coach_read ON public.crs_tests FOR SELECT
  USING (public.is_linked_coach_with_tests(athlete_id));

-- TRAINING_PLANS
CREATE POLICY tp_owner_all  ON public.training_plans FOR ALL
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY tp_athlete_read ON public.training_plans FOR SELECT
  USING (athlete_id = auth.uid());
CREATE POLICY tp_coach_write_assigned ON public.training_plans FOR INSERT
  WITH CHECK (athlete_id IS NULL OR public.is_linked_coach_with_plans(athlete_id));

-- Sessions/Exercises folgen dem Plan
CREATE POLICY ts_via_plan ON public.training_sessions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.training_plans p WHERE p.id = plan_id
          AND (p.owner_id = auth.uid() OR p.athlete_id = auth.uid()))
);
CREATE POLICY te_via_session ON public.training_exercises FOR ALL USING (
  EXISTS (SELECT 1 FROM public.training_sessions s
          JOIN public.training_plans p ON p.id = s.plan_id
          WHERE s.id = session_id
          AND (p.owner_id = auth.uid() OR p.athlete_id = auth.uid()))
);

-- COMPETITIONS
CREATE POLICY comp_self_all  ON public.competitions FOR ALL
  USING (athlete_id = auth.uid()) WITH CHECK (athlete_id = auth.uid());
CREATE POLICY comp_coach_read ON public.competitions FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- CHAT: Policies nach Migration 3 verschoben (benötigen coach_athlete_engagements)
-- Siehe 20250413000003_engagements.sql Abschnitt "DEFERRED CHAT POLICIES"

-- ENGAGEMENT_CODES: nur Coach sieht eigene
CREATE POLICY ec_owner_all ON public.engagement_codes FOR ALL
  USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());
-- Redemptions: nur via RPC schreibbar (kein direkter INSERT vom Client)
CREATE POLICY ecr_self_read ON public.engagement_code_redemptions FOR SELECT
  USING (athlete_id = auth.uid()
         OR EXISTS (SELECT 1 FROM public.engagement_codes c
                    WHERE c.id = code_id AND c.coach_id = auth.uid()));


-- ############################################################
-- 12. STORAGE BUCKETS
-- ############################################################
-- Buckets werden im Supabase-Dashboard angelegt; hier dokumentiert + Policies.
--
--   • avatars            (public)   — User-Avatare
--   • health_documents   (private)  — Phase 2, athlete-only + freigegebene Coaches
--   • plan_attachments   (private)  — Plan-PDFs vom Coach
--   • crs_evidence       (private)  — Phase 2, optional Video pro Test
--
-- Beispiel-Policy für avatars (Pfad-Konvention: {user_id}/avatar.jpg)
--   INSERT INTO storage.policies VALUES (...)
-- → siehe Migrations-File 4 (storage_policies.sql)


-- ############################################################
-- 13. AUDIT-LOG  (append-only, Service-Role-only)
-- ############################################################

CREATE TABLE audit.events (
  id           BIGSERIAL PRIMARY KEY,
  event_type   TEXT NOT NULL,                          -- z.B. 'engagement_started'
  actor_id     UUID,
  target_id    UUID,
  payload      JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Kein UPDATE/DELETE — RLS off, aber keine Grants für anon/authenticated
REVOKE ALL ON audit.events FROM anon, authenticated;

CREATE INDEX idx_audit_actor_time  ON audit.events(actor_id, created_at DESC);
CREATE INDEX idx_audit_type_time   ON audit.events(event_type, created_at DESC);


-- ############################################################
-- 14. RPC: ENGAGEMENT-CODE GENERIEREN  (Coach)
-- ############################################################

CREATE OR REPLACE FUNCTION public.generate_engagement_code(
  p_internal_label TEXT DEFAULT NULL,
  p_purpose        TEXT DEFAULT 'general',
  p_max_uses       INT  DEFAULT 1,
  p_valid_days     INT  DEFAULT 7,
  p_permissions    JSONB DEFAULT NULL
)
RETURNS TABLE(code TEXT, expires_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, extensions AS $$
DECLARE
  v_code     TEXT;
  v_expires  TIMESTAMPTZ;
  v_role     public.user_role;
BEGIN
  -- Auth-Check
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role NOT IN ('coach','both') THEN
    RAISE EXCEPTION 'not_a_coach';
  END IF;
  IF p_valid_days < 1 OR p_valid_days > 30 THEN
    RAISE EXCEPTION 'valid_days_out_of_range';
  END IF;

  -- 8-stellig, ohne 0/O/1/I (verwechslungsarm)
  v_code := upper(substr(translate(encode(gen_random_bytes(8),'base64'),'01OI/+=',''), 1, 8));
  v_expires := now() + (p_valid_days || ' days')::interval;

  INSERT INTO public.engagement_codes
    (code, coach_id, internal_label, purpose, max_uses, expires_at, default_permissions)
  VALUES
    (v_code, auth.uid(), p_internal_label, p_purpose, p_max_uses, v_expires,
     COALESCE(p_permissions,
       '{"can_see_tracking":true,"can_see_meals":false,"can_see_tests":true,"can_create_plans":true}'::jsonb));

  INSERT INTO audit.events(event_type, actor_id, payload)
    VALUES ('engagement_code_generated', auth.uid(),
            jsonb_build_object('code', v_code, 'max_uses', p_max_uses, 'valid_days', p_valid_days));

  RETURN QUERY SELECT v_code, v_expires;
END $$;

REVOKE ALL ON FUNCTION public.generate_engagement_code FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.generate_engagement_code TO authenticated;


-- ############################################################
-- 15. RPC: ENGAGEMENT-CODE EINLÖSEN  (Athlet)
-- ############################################################

CREATE OR REPLACE FUNCTION public.redeem_engagement_code(p_code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_code_row public.engagement_codes%ROWTYPE;
  v_engagement_id UUID;
  v_role public.user_role;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  SELECT u.role INTO v_role FROM public.users u WHERE u.id = auth.uid();
  IF v_role NOT IN ('athlete','both') THEN
    RAISE EXCEPTION 'not_an_athlete';
  END IF;

  -- Code-Lookup mit FOR UPDATE (race-safe)
  SELECT * INTO v_code_row FROM public.engagement_codes
   WHERE code = upper(p_code) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_code';
  END IF;
  IF v_code_row.revoked_at IS NOT NULL THEN
    RAISE EXCEPTION 'code_revoked';
  END IF;
  IF v_code_row.expires_at < now() THEN
    RAISE EXCEPTION 'code_expired';
  END IF;
  IF v_code_row.uses_count >= v_code_row.max_uses THEN
    RAISE EXCEPTION 'code_exhausted';
  END IF;
  IF v_code_row.coach_id = auth.uid() THEN
    RAISE EXCEPTION 'cannot_redeem_own_code';
  END IF;

  -- Bestehende aktive Engagement zwischen denselben beiden? → Idempotent
  SELECT id INTO v_engagement_id FROM public.coach_athlete_engagements
    WHERE coach_id = v_code_row.coach_id
      AND athlete_id = auth.uid()
      AND purpose = v_code_row.purpose
      AND status IN ('active','pending');

  IF v_engagement_id IS NULL THEN
    INSERT INTO public.coach_athlete_engagements
      (coach_id, athlete_id, purpose, invite_code, status, started_at,
       can_see_tracking, can_see_meals, can_see_tests, can_create_plans)
    VALUES
      (v_code_row.coach_id, auth.uid(), v_code_row.purpose, v_code_row.code,
       'active', now(),
       (v_code_row.default_permissions->>'can_see_tracking')::bool,
       (v_code_row.default_permissions->>'can_see_meals')::bool,
       (v_code_row.default_permissions->>'can_see_tests')::bool,
       (v_code_row.default_permissions->>'can_create_plans')::bool)
    RETURNING id INTO v_engagement_id;

    -- Chat-Channel automatisch anlegen
    INSERT INTO public.chat_channels(engagement_id) VALUES (v_engagement_id);
  END IF;

  UPDATE public.engagement_codes
     SET uses_count = uses_count + 1
   WHERE id = v_code_row.id;

  INSERT INTO public.engagement_code_redemptions(code_id, athlete_id, engagement_id)
    VALUES (v_code_row.id, auth.uid(), v_engagement_id)
    ON CONFLICT (code_id, athlete_id) DO NOTHING;

  INSERT INTO audit.events(event_type, actor_id, target_id, payload)
    VALUES ('engagement_code_redeemed', auth.uid(), v_code_row.coach_id,
            jsonb_build_object('code', v_code_row.code, 'engagement_id', v_engagement_id));

  RETURN v_engagement_id;
END $$;

REVOKE ALL ON FUNCTION public.redeem_engagement_code FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.redeem_engagement_code TO authenticated;


-- ############################################################
-- 16. RPC: ACCOUNT-LÖSCHUNG ANFORDERN  (30-Tage Grace)
-- ############################################################

CREATE OR REPLACE FUNCTION public.request_account_deletion()
RETURNS TIMESTAMPTZ
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_scheduled TIMESTAMPTZ;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  v_scheduled := now() + interval '30 days';
  UPDATE public.users
     SET status = 'pending_deletion',
         deletion_requested_at = now(),
         deletion_scheduled_at = v_scheduled
   WHERE id = auth.uid();
  INSERT INTO audit.events(event_type, actor_id, payload)
    VALUES ('account_deletion_requested', auth.uid(),
            jsonb_build_object('scheduled_at', v_scheduled));
  RETURN v_scheduled;
END $$;

GRANT EXECUTE ON FUNCTION public.request_account_deletion TO authenticated;


-- ############################################################
-- 17. UPDATED_AT-TRIGGER  (generisch)
-- ############################################################

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'users','athlete_profiles','coach_profiles','daily_tracking',
    'training_plans','competitions'
  ])
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t, t);
  END LOOP;
END $$;


-- ============================================================
-- ENDE FILE 1.  Reihenfolge der Migrations:
--   1. r2f_sql_1_foundation_v2.sql   ← DIESE DATEI
--   2. r2f_sql_2_ux.sql              (XP, Streaks, Achievements, Notifications)
--   3. r2f_sql_3_engagements.sql     (Sport-Disziplinen, coach_athlete_engagements,
--                                     Health-Records, Health-Shares)
--   4. r2f_sql_4_storage_policies.sql  (TODO: Storage-Bucket-Policies)
-- ============================================================
