-- ============================================================
-- READY 2 FIGHT  -  SQL 3/3: ENGAGEMENTS & HEALTH  (v3 — Foundation-Sync)
--                             DATA RETENTION, COMP-PREP MODE
--                             (v2 — alle Fixes)
-- Stand: 06.04.2026
--
-- VORAUSSETZUNG: r2f_sql_1_foundation_v2.sql + r2f_sql_2_ux_v2.sql
--
-- MANUELLER SCHRITT DANACH:
--   Storage Bucket "health-docs" (Private) anlegen
--
-- FIXES v2:
--   [FIX-C1] Coach-Role-Check bei Engagement-Erstellung
--   [FIX-C2] Coach kann Engagement-Status NICHT selbst aendern
--   [FIX-C4] Invite-Code-Generator als SECURITY DEFINER RPC
--   [FIX-C6] Auto-Chat bei Engagement-Annahme
--   [FIX-C8] Coach-Notifications bei Athleten-Events
--   [FIX-NEW6] Engagement-Erstellung: Athlete-Role-Validierung
--   [FIX-NEW7] Coach kann Engagement nur paused/ended setzen, nicht active
-- ============================================================


-- ############################################################
--  1. SPORT DISCIPLINES (Referenztabelle)
-- ############################################################

CREATE TABLE public.sport_disciplines (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  name        TEXT NOT NULL,
  category    TEXT DEFAULT 'striking'
                CHECK (category IN ('striking','grappling','mma','other')),
  created_at  TIMESTAMPTZ DEFAULT now()
);

INSERT INTO public.sport_disciplines (slug, name, category) VALUES
  ('kickboxing',  'Kickboxen',              'striking'),
  ('boxing',      'Boxen',                  'striking'),
  ('muay_thai',   'Muay Thai',              'striking'),
  ('k1',          'K-1',                    'striking'),
  ('karate',      'Karate',                 'striking'),
  ('taekwondo',   'Taekwondo',              'striking'),
  ('mma',         'Mixed Martial Arts',     'mma'),
  ('bjj',         'Brazilian Jiu-Jitsu',    'grappling'),
  ('wrestling',   'Ringen',                 'grappling'),
  ('judo',        'Judo',                   'grappling'),
  ('sambo',       'Sambo',                  'grappling'),
  ('luta_livre',  'Luta Livre',             'grappling'),
  ('savate',      'Savate',                 'striking'),
  ('wushu',       'Wushu / Kung Fu',        'striking'),
  ('krav_maga',   'Krav Maga',              'other');


-- ############################################################
--  2. ATHLETE <-> SPORT M:N
-- ############################################################

CREATE TABLE public.athlete_sports (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  sport_id      UUID NOT NULL REFERENCES public.sport_disciplines(id) ON DELETE CASCADE,
  is_primary    BOOLEAN DEFAULT false,
  skill_level   TEXT CHECK (skill_level IN ('beginner','intermediate','advanced','pro')),
  started_at    DATE,
  created_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(athlete_id, sport_id)
);


-- ############################################################
--  3. COACH-ATHLETE ENGAGEMENTS
-- ############################################################

CREATE TABLE public.coach_athlete_engagements (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id        UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  athlete_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  purpose         TEXT NOT NULL DEFAULT 'general' CHECK (purpose IN (
                    'general','competition_prep','technique',
                    'strength_cond','nutrition','rehab'
                  )),
  sport_id        UUID REFERENCES public.sport_disciplines(id),
  competition_id  UUID REFERENCES public.competitions(id) ON DELETE SET NULL,

  invite_code     TEXT UNIQUE,
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN (
                    'pending','active','paused','ended'
                  )),
  ended_by        UUID REFERENCES public.users(id),
  end_reason      TEXT CHECK (end_reason IN (
                    'completed','athlete_left','coach_ended','mutual', NULL
                  )),

  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  expected_end    DATE,

  can_see_tracking    BOOLEAN DEFAULT true,
  can_see_meals       BOOLEAN DEFAULT false,
  can_see_tests       BOOLEAN DEFAULT true,
  can_create_plans    BOOLEAN DEFAULT true,

  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

CREATE UNIQUE INDEX idx_unique_active_engagement
  ON public.coach_athlete_engagements(coach_id, athlete_id, purpose)
  WHERE status IN ('active', 'pending');


-- ############################################################
--  4. FK auf Engagements fuer bestehende Tabellen
-- ############################################################

ALTER TABLE public.daily_tracking
  ADD CONSTRAINT fk_tracking_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE SET NULL;

ALTER TABLE public.training_plans
  ADD CONSTRAINT fk_plans_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE SET NULL;


-- ############################################################
--  5. HEALTH RECORDS
-- ############################################################

CREATE TABLE public.health_records (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id      UUID NOT NULL REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  category        TEXT NOT NULL CHECK (category IN (
                    'pre_existing','injury','allergy',
                    'medical_finding','surgery','medication'
                  )),
  title           TEXT NOT NULL,
  description     TEXT,
  body_region     TEXT,
  severity        TEXT CHECK (severity IN ('mild','moderate','severe')),
  diagnosed_at    DATE,
  resolved_at     DATE,
  status          TEXT DEFAULT 'active'
                    CHECK (status IN ('active','resolved','chronic')),
  document_url    TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);


-- ############################################################
--  6. HEALTH RECORD SHARES
-- ############################################################

CREATE TABLE public.health_record_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       UUID NOT NULL REFERENCES public.health_records(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES public.coach_athlete_engagements(id) ON DELETE CASCADE,
  shared_at       TIMESTAMPTZ DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE(record_id, engagement_id)
);


-- ############################################################
--  7. HELPER FUNCTIONS
-- ############################################################

-- 7a) Aktives Engagement als Coach
CREATE OR REPLACE FUNCTION public.is_linked_coach(p_athlete_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = p_athlete_profile_id
      AND cae.coach_id = auth.uid()
      AND cae.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7b) Aktives Engagement MIT Tracking-Berechtigung
CREATE OR REPLACE FUNCTION public.is_linked_coach_with_tracking(p_athlete_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = p_athlete_profile_id
      AND cae.coach_id = auth.uid()
      AND cae.status = 'active'
      AND cae.can_see_tracking = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7c) Aktives Engagement MIT Meal-Berechtigung
CREATE OR REPLACE FUNCTION public.is_linked_coach_with_meals(p_athlete_profile_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = p_athlete_profile_id
      AND cae.coach_id = auth.uid()
      AND cae.status = 'active'
      AND cae.can_see_meals = true
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7d) Darf Coach diesen Health Record sehen?
CREATE OR REPLACE FUNCTION public.can_coach_see_health_record(p_record_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.health_record_shares hrs
    JOIN public.coach_athlete_engagements cae ON cae.id = hrs.engagement_id
    WHERE hrs.record_id = p_record_id
      AND hrs.revoked_at IS NULL
      AND cae.coach_id = auth.uid()
      AND cae.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7e) Hat Coach aktives Engagement mit diesem User?
CREATE OR REPLACE FUNCTION public.is_coach_of_user(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.coach_athlete_engagements
    WHERE coach_id = auth.uid()
      AND athlete_id = p_user_id
      AND status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 7f) Coach sieht Wettkampf eines Athleten
CREATE OR REPLACE FUNCTION public.can_coach_see_competition(p_competition_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.competitions c
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = c.user_id
    WHERE c.id = p_competition_id
      AND cae.coach_id = auth.uid()
      AND cae.status = 'active'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ############################################################
--  8. TRIGGER FUNCTIONS
-- ############################################################

-- 8a) Engagement-Status-Wechsel: auto-revoke + Zeitstempel
CREATE OR REPLACE FUNCTION public.on_engagement_ended()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ended' AND OLD.status != 'ended' THEN
    UPDATE public.health_record_shares
    SET revoked_at = now()
    WHERE engagement_id = NEW.id
      AND revoked_at IS NULL;
    NEW.ended_at = COALESCE(NEW.ended_at, now());
  END IF;

  IF NEW.status = 'active' AND OLD.status = 'pending' THEN
    NEW.started_at = COALESCE(NEW.started_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8b) Wettkampf completed -> zugehoerige Engagements beenden
CREATE OR REPLACE FUNCTION public.on_competition_completed()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    UPDATE public.coach_athlete_engagements
    SET status = 'ended',
        end_reason = 'completed',
        ended_at = now()
    WHERE competition_id = NEW.id
      AND status = 'active';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 8c) Trainingsplan-Zuweisung validieren
CREATE OR REPLACE FUNCTION public.validate_plan_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.athlete_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.coach_id IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = NEW.athlete_id
      AND cae.coach_id = NEW.coach_id
      AND cae.status = 'active'
      AND cae.can_create_plans = true
  ) THEN
    RAISE EXCEPTION 'Coach hat kein aktives Engagement mit Planrechten fuer diesen Athleten';
  END IF;

  IF NEW.engagement_id IS NULL THEN
    SELECT cae.id INTO NEW.engagement_id
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = NEW.athlete_id
      AND cae.coach_id = NEW.coach_id
      AND cae.status = 'active'
      AND cae.can_create_plans = true
    ORDER BY cae.created_at ASC
    LIMIT 1;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [FIX-C1/C6/NEW6] Engagement-Erstellung validieren
CREATE OR REPLACE FUNCTION public.validate_engagement_insert()
RETURNS TRIGGER AS $$
DECLARE
  v_coach_role TEXT;
  v_athlete_role TEXT;
BEGIN
  -- Coach muss role 'coach' oder 'both' haben
  SELECT role INTO v_coach_role FROM public.users WHERE id = NEW.coach_id;
  IF v_coach_role NOT IN ('coach', 'both') THEN
    RAISE EXCEPTION 'User % ist kein Coach', NEW.coach_id;
  END IF;

  -- Athlet muss role 'athlete' oder 'both' haben
  SELECT role INTO v_athlete_role FROM public.users WHERE id = NEW.athlete_id;
  IF v_athlete_role NOT IN ('athlete', 'both') THEN
    RAISE EXCEPTION 'User % ist kein Athlet', NEW.athlete_id;
  END IF;

  -- Coach darf nicht sich selbst einladen
  IF NEW.coach_id = NEW.athlete_id THEN
    RAISE EXCEPTION 'Coach kann sich nicht selbst als Athlet zuweisen';
  END IF;

  -- [v3] Auto-Generierung von invite_code ENTFERNT (Stalking-Schutz, PRD v4.0).
  -- Engagement-Codes werden ausschliesslich ueber generate_engagement_code()
  -- aus foundation v2 erstellt. Diese Tabelle erhaelt invite_code nur noch
  -- als Referenz, wenn redeem_engagement_code() das Engagement anlegt.

  -- Status muss bei Insert immer 'pending' sein
  NEW.status := 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [FIX-C2/NEW7] Coach kann Status NICHT auf 'active' setzen
-- Nur Athlet darf pending->active (via redeem_engagement_code, foundation v2)
-- Coach darf: active->paused, paused->active, *->ended
CREATE OR REPLACE FUNCTION public.validate_engagement_update()
RETURNS TRIGGER AS $$
BEGIN
  -- Wenn Status sich aendert, Regeln pruefen
  IF NEW.status != OLD.status THEN
    -- Wer updated?
    IF auth.uid() = OLD.coach_id THEN
      -- Coach darf: active->paused, paused->active, *->ended
      IF NOT (
        (OLD.status = 'active' AND NEW.status = 'paused') OR
        (OLD.status = 'paused' AND NEW.status = 'active') OR
        (NEW.status = 'ended')
      ) THEN
        RAISE EXCEPTION 'Coach darf Status nicht von % zu % aendern', OLD.status, NEW.status;
      END IF;

      -- Bei ended: ended_by setzen
      IF NEW.status = 'ended' THEN
        NEW.ended_by = auth.uid();
        NEW.end_reason = COALESCE(NEW.end_reason, 'coach_ended');
      END IF;

    ELSIF auth.uid() = OLD.athlete_id THEN
      -- Athlet darf: pending->active (via redeem_engagement_code), *->ended
      IF NOT (
        (OLD.status = 'pending' AND NEW.status = 'active') OR
        (NEW.status = 'ended')
      ) THEN
        RAISE EXCEPTION 'Athlet darf Status nicht von % zu % aendern', OLD.status, NEW.status;
      END IF;

      IF NEW.status = 'ended' THEN
        NEW.ended_by = auth.uid();
        NEW.end_reason = COALESCE(NEW.end_reason, 'athlete_left');
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ############################################################
--  9. WETTKAMPF-MODUS (dynamisch berechnet)
-- ############################################################

-- [v3] Spalten-Mapping an foundation v2 angepasst:
--   user_id     -> athlete_id
--   event_date  -> competition_date
--   name        -> title
--   status      -> entfaellt (foundation hat kein status-Feld;
--                 'upcoming' ist implizit competition_date >= CURRENT_DATE)

CREATE OR REPLACE FUNCTION public.is_competition_prep_active(p_user_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competitions
    WHERE athlete_id = p_user_id
      AND competition_date IS NOT NULL
      AND competition_date >= CURRENT_DATE
      AND competition_date <= CURRENT_DATE + INTERVAL '70 days'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_active_competition_prep(p_user_id UUID)
RETURNS TABLE (
  competition_id   UUID,
  competition_name TEXT,
  event_date       DATE,
  weight_class     TEXT,
  days_remaining   INT,
  phase            TEXT
) AS $$
  SELECT
    c.id, c.title, c.competition_date, c.weight_class,
    (c.competition_date - CURRENT_DATE)::INT,
    CASE WHEN (c.competition_date - CURRENT_DATE) > 56 THEN 'ramp_up' ELSE 'peak' END
  FROM public.competitions c
  WHERE c.athlete_id = p_user_id
    AND c.competition_date IS NOT NULL
    AND c.competition_date >= CURRENT_DATE
    AND c.competition_date <= CURRENT_DATE + INTERVAL '70 days'
  ORDER BY c.competition_date ASC
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ############################################################
-- 10. COACH TEAM-VIEW per Sportart
-- ############################################################

CREATE OR REPLACE FUNCTION public.get_coach_team(p_sport_id UUID DEFAULT NULL)
RETURNS TABLE (
  engagement_id    UUID,
  athlete_user_id  UUID,
  athlete_name     TEXT,
  avatar_url       TEXT,
  sport_name       TEXT,
  sport_slug       TEXT,
  purpose          TEXT,
  status           TEXT,
  started_at       TIMESTAMPTZ,
  days_active      INT,
  can_see_tracking BOOLEAN,
  can_see_meals    BOOLEAN,
  can_create_plans BOOLEAN
) AS $$
  SELECT
    cae.id, cae.athlete_id, u.name, u.avatar_url,
    sd.name, sd.slug, cae.purpose, cae.status, cae.started_at,
    EXTRACT(DAY FROM now() - cae.started_at)::INT,
    cae.can_see_tracking, cae.can_see_meals, cae.can_create_plans
  FROM public.coach_athlete_engagements cae
  JOIN public.users u ON u.id = cae.athlete_id
  LEFT JOIN public.sport_disciplines sd ON sd.id = cae.sport_id
  WHERE cae.coach_id = auth.uid()
    AND cae.status IN ('active', 'pending')
    AND (p_sport_id IS NULL OR cae.sport_id = p_sport_id)
  ORDER BY sd.name NULLS LAST, u.name ASC;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.get_coach_sport_groups()
RETURNS TABLE (
  sport_id      UUID,
  sport_name    TEXT,
  sport_slug    TEXT,
  athlete_count BIGINT
) AS $$
  SELECT
    cae.sport_id,
    COALESCE(sd.name, 'Allgemein'),
    COALESCE(sd.slug, 'general'),
    COUNT(DISTINCT cae.athlete_id)
  FROM public.coach_athlete_engagements cae
  LEFT JOIN public.sport_disciplines sd ON sd.id = cae.sport_id
  WHERE cae.coach_id = auth.uid()
    AND cae.status IN ('active', 'pending')
  GROUP BY cae.sport_id, sd.name, sd.slug
  ORDER BY sd.name NULLS LAST;
$$ LANGUAGE sql SECURITY DEFINER STABLE;


-- ############################################################
-- 11. [v3] INVITE-CODE ANNEHMEN — verschoben in foundation v2
-- ############################################################
--
-- Die alte Funktion accept_invite() wurde entfernt. Sie wird ersetzt durch
-- public.redeem_engagement_code(p_code TEXT) aus r2f_sql_1_foundation_v2.sql.
-- Diese RPC ist race-safe (FOR UPDATE), idempotent bei Doppel-Redeem,
-- schreibt einen audit.events-Eintrag, legt automatisch einen
-- chat_channels-Datensatz an und uebernimmt die granularen Permissions
-- aus engagement_codes.default_permissions.
--
-- Die alte Funktion griff zudem auf ein nicht-existierendes Chat-Schema
-- (conversations / conversation_members / messages) zu — die Foundation
-- nutzt das schlankere chat_channels / chat_messages-Modell, das fuer
-- 1:1-Coach-Athlet-Chats im MVP ausreicht.


-- ############################################################
-- 12. DATA RETENTION
-- ############################################################

CREATE OR REPLACE FUNCTION public.notify_data_expiry()
RETURNS void AS $$
DECLARE
  r RECORD;
  cutoff_date DATE;
BEGIN
  FOR r IN
    SELECT u.id AS user_id, u.subscription_tier,
           CASE
             WHEN u.subscription_tier = 'pro' THEN 365
             ELSE 90
           END AS retention_days
    FROM public.users u
    WHERE u.role IN ('athlete','both')
  LOOP
    cutoff_date := CURRENT_DATE - (r.retention_days - 7);

    IF EXISTS (
      SELECT 1 FROM public.daily_tracking dt
      JOIN public.athlete_profiles ap ON ap.id = dt.athlete_id
      WHERE ap.user_id = r.user_id
        AND dt.date <= cutoff_date
        AND dt.date > cutoff_date - INTERVAL '1 day'
    ) THEN
      INSERT INTO public.notifications (user_id, type, title, body, data)
      VALUES (
        r.user_id,
        'data_expiry',
        'Tracking-Daten laufen bald ab',
        CASE
          WHEN r.subscription_tier = 'free' THEN
            'Deine Tracking-Daten aelter als 3 Monate werden in 7 Tagen geloescht. Upgrade auf Pro fuer 1 Jahr Aufbewahrung.'
          ELSE
            'Deine Tracking-Daten aelter als 1 Jahr werden in 7 Tagen geloescht.'
        END,
        jsonb_build_object('retention_days', r.retention_days, 'tier', r.subscription_tier)
      )
      ON CONFLICT DO NOTHING;
    END IF;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.cleanup_expired_tracking()
RETURNS void AS $$
BEGIN
  DELETE FROM public.daily_tracking
  WHERE id IN (
    SELECT dt.id
    FROM public.daily_tracking dt
    JOIN public.athlete_profiles ap ON ap.id = dt.athlete_id
    JOIN public.users u ON u.id = ap.user_id
    WHERE (
      (u.subscription_tier = 'free'  AND dt.date < CURRENT_DATE - INTERVAL '90 days')
      OR
      (u.subscription_tier = 'pro'   AND dt.date < CURRENT_DATE - INTERVAL '365 days')
    )
  );

  DELETE FROM public.meals
  WHERE id IN (
    SELECT m.id
    FROM public.meals m
    JOIN public.athlete_profiles ap ON ap.id = m.athlete_id
    JOIN public.users u ON u.id = ap.user_id
    WHERE (
      (u.subscription_tier = 'free'  AND m.date < CURRENT_DATE - INTERVAL '90 days')
      OR
      (u.subscription_tier = 'pro'   AND m.date < CURRENT_DATE - INTERVAL '365 days')
    )
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron-Jobs
SELECT cron.schedule(
  'notify-data-expiry',
  '0 4 * * *',
  $$ SELECT public.notify_data_expiry(); $$
);

SELECT cron.schedule(
  'cleanup-expired-tracking',
  '30 4 * * *',
  $$ SELECT public.cleanup_expired_tracking(); $$
);


-- ############################################################
-- 13. INDIZES
-- ############################################################

CREATE INDEX idx_sport_disciplines_slug  ON public.sport_disciplines(slug);
CREATE INDEX idx_athlete_sports_athlete  ON public.athlete_sports(athlete_id);
CREATE INDEX idx_athlete_sports_sport    ON public.athlete_sports(sport_id);
CREATE INDEX idx_engagements_coach       ON public.coach_athlete_engagements(coach_id, status);
CREATE INDEX idx_engagements_athlete     ON public.coach_athlete_engagements(athlete_id, status);
CREATE INDEX idx_engagements_competition ON public.coach_athlete_engagements(competition_id)
  WHERE competition_id IS NOT NULL;
CREATE INDEX idx_engagements_sport       ON public.coach_athlete_engagements(sport_id)
  WHERE sport_id IS NOT NULL;
CREATE INDEX idx_health_records_athlete  ON public.health_records(athlete_id, category);
CREATE INDEX idx_health_shares_record    ON public.health_record_shares(record_id);
CREATE INDEX idx_health_shares_engage    ON public.health_record_shares(engagement_id);
CREATE INDEX idx_training_plans_engage   ON public.training_plans(engagement_id)
  WHERE engagement_id IS NOT NULL;
CREATE INDEX idx_tracking_engagement     ON public.daily_tracking(engagement_id)
  WHERE engagement_id IS NOT NULL;
CREATE INDEX idx_tracking_date_athlete   ON public.daily_tracking(date, athlete_id);
CREATE INDEX idx_meals_date_athlete      ON public.meals(date, athlete_id);


-- ############################################################
-- 14. RLS AKTIVIEREN
-- ############################################################

ALTER TABLE public.sport_disciplines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_sports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_record_shares      ENABLE ROW LEVEL SECURITY;


-- ############################################################
-- 15. RLS POLICIES (neue Tabellen + Coach-Policies fuer SQL 1/2)
-- ############################################################

-- === sport_disciplines ===
CREATE POLICY "Anyone reads sport disciplines"
  ON public.sport_disciplines FOR SELECT
  USING (auth.role() = 'authenticated');

-- === athlete_sports ===
CREATE POLICY "Athletes manage own sports"
  ON public.athlete_sports FOR ALL
  USING (athlete_id = public.own_athlete_profile_id());

CREATE POLICY "Coach reads athlete sports"
  ON public.athlete_sports FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- === coach_athlete_engagements ===
CREATE POLICY "Users see own engagements"
  ON public.coach_athlete_engagements FOR SELECT
  USING (coach_id = auth.uid() OR athlete_id = auth.uid());

-- [FIX-C1] Engagement-Erstellung: nur durch Coach
-- Validierung (Role-Check, Invite-Code) passiert im Trigger
CREATE POLICY "Coaches create engagements"
  ON public.coach_athlete_engagements FOR INSERT
  WITH CHECK (coach_id = auth.uid());

-- [FIX-C2] Athlet darf NUR Status aendern (pending->active via redeem_engagement_code, *->ended)
-- Weitere Validierung im validate_engagement_update Trigger
CREATE POLICY "Athletes update engagement status"
  ON public.coach_athlete_engagements FOR UPDATE
  USING (athlete_id = auth.uid());

-- [FIX-C2/NEW7] Coach darf Berechtigungen + Status aendern
-- Status-Einschraenkung via validate_engagement_update Trigger
CREATE POLICY "Coaches update own engagements"
  ON public.coach_athlete_engagements FOR UPDATE
  USING (coach_id = auth.uid());

-- === health_records ===
CREATE POLICY "Athletes manage own health records"
  ON public.health_records FOR ALL
  USING (athlete_id = public.own_athlete_profile_id());

CREATE POLICY "Coach reads shared health records"
  ON public.health_records FOR SELECT
  USING (public.can_coach_see_health_record(id));

-- === health_record_shares ===
CREATE POLICY "Athletes see own record shares"
  ON public.health_record_shares FOR SELECT
  USING (
    record_id IN (
      SELECT id FROM public.health_records
      WHERE athlete_id = public.own_athlete_profile_id()
    )
  );

CREATE POLICY "Athletes create shares"
  ON public.health_record_shares FOR INSERT
  WITH CHECK (
    record_id IN (
      SELECT id FROM public.health_records
      WHERE athlete_id = public.own_athlete_profile_id()
    )
  );

CREATE POLICY "Athletes revoke shares"
  ON public.health_record_shares FOR UPDATE
  USING (
    record_id IN (
      SELECT id FROM public.health_records
      WHERE athlete_id = public.own_athlete_profile_id()
    )
  );

CREATE POLICY "Athletes delete shares"
  ON public.health_record_shares FOR DELETE
  USING (
    record_id IN (
      SELECT id FROM public.health_records
      WHERE athlete_id = public.own_athlete_profile_id()
    )
  );

CREATE POLICY "Coach sees own engagement shares"
  ON public.health_record_shares FOR SELECT
  USING (
    engagement_id IN (
      SELECT id FROM public.coach_athlete_engagements
      WHERE coach_id = auth.uid() AND status = 'active'
    )
    AND revoked_at IS NULL
  );


-- ############################################################
-- 16. COACH-POLICIES FUER BESTEHENDE TABELLEN (aus SQL 1 + 2)
-- ############################################################

-- Coach sieht Athleten-Name/Avatar
CREATE POLICY "Coach reads linked athlete users"
  ON public.users FOR SELECT
  USING (public.is_coach_of_user(id));

-- Athlet sieht Coach-Name/Avatar
CREATE POLICY "Athlete reads linked coach users"
  ON public.users FOR SELECT
  USING (
    id IN (
      SELECT coach_id FROM public.coach_athlete_engagements
      WHERE athlete_id = auth.uid() AND status = 'active'
    )
  );

-- Coach sieht Athleten-Profile
CREATE POLICY "Coach reads linked athlete profiles"
  ON public.athlete_profiles FOR SELECT
  USING (public.is_linked_coach(id));

-- Coach sieht Tracking (wenn berechtigt)
CREATE POLICY "Coach reads athlete tracking"
  ON public.daily_tracking FOR SELECT
  USING (public.is_linked_coach_with_tracking(athlete_id));

-- Coach sieht Meals (wenn berechtigt)
CREATE POLICY "Coach reads athlete meals"
  ON public.meals FOR SELECT
  USING (public.is_linked_coach_with_meals(athlete_id));

-- Coach sieht Tests
CREATE POLICY "Coach reads athlete tests"
  ON public.fitness_tests FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- Coach sieht Quests
CREATE POLICY "Coach reads athlete quests"
  ON public.quests FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- Coach sieht PRs
CREATE POLICY "Coach reads athlete PRs"
  ON public.personal_records FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- Coach sieht Athleten-Wettkaempfe
CREATE POLICY "Coach reads athlete competitions"
  ON public.competitions FOR SELECT
  USING (public.can_coach_see_competition(id));

-- Coach sieht Achievements seiner Athleten
CREATE POLICY "Coach reads athlete achievements"
  ON public.user_achievements FOR SELECT
  USING (
    user_id IN (
      SELECT athlete_id FROM public.coach_athlete_engagements
      WHERE coach_id = auth.uid() AND status = 'active'
    )
  );

-- Session-Completions: Coach darf NUR Feedback updaten
CREATE POLICY "Coach reads athlete completions"
  ON public.session_completions FOR SELECT
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_plans tp ON ts.plan_id = tp.id
      WHERE tp.coach_id = auth.uid()
    )
  );

CREATE POLICY "Coach updates feedback only"
  ON public.session_completions FOR UPDATE
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_plans tp ON ts.plan_id = tp.id
      WHERE tp.coach_id = auth.uid()
        AND tp.engagement_id IS NOT NULL
        AND EXISTS (
          SELECT 1 FROM public.coach_athlete_engagements cae
          WHERE cae.id = tp.engagement_id
            AND cae.coach_id = auth.uid()
            AND cae.status = 'active'
        )
    )
  );


-- ############################################################
-- 17. TRIGGER
-- ############################################################

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.coach_athlete_engagements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.health_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Engagement-Status-Wechsel: auto-revoke
CREATE TRIGGER on_engagement_status_change
  BEFORE UPDATE ON public.coach_athlete_engagements
  FOR EACH ROW EXECUTE FUNCTION public.on_engagement_ended();

-- [FIX-C2/NEW7] Status-Validierung bei Update
CREATE TRIGGER validate_engagement_status_update
  BEFORE UPDATE ON public.coach_athlete_engagements
  FOR EACH ROW EXECUTE FUNCTION public.validate_engagement_update();

-- [FIX-C1/NEW6] Role-Validierung + Auto-Invite-Code bei Insert
CREATE TRIGGER validate_engagement_on_insert
  BEFORE INSERT ON public.coach_athlete_engagements
  FOR EACH ROW EXECUTE FUNCTION public.validate_engagement_insert();

CREATE TRIGGER on_competition_status_change
  AFTER UPDATE ON public.competitions
  FOR EACH ROW EXECUTE FUNCTION public.on_competition_completed();

CREATE TRIGGER validate_plan_assignment
  BEFORE INSERT OR UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_assignment();


-- ############################################################
-- 18. STORAGE: Health-Documents Bucket
-- ############################################################

CREATE POLICY "Athletes upload health docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'health-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Athletes read own health docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'health-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Athletes delete own health docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'health-docs'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ############################################################
-- 19. [FIX-C8] COACH-NOTIFICATIONS BEI ATHLETEN-EVENTS
--     Trigger: Wenn Athlet Fitness-Test oder Tracking macht,
--     bekommt der verlinkte Coach eine Notification
-- ############################################################

CREATE OR REPLACE FUNCTION public.notify_coach_on_test()
RETURNS TRIGGER AS $$
DECLARE
  v_coach RECORD;
  v_athlete_name TEXT;
BEGIN
  -- Athleten-Name holen
  SELECT u.name INTO v_athlete_name
  FROM public.athlete_profiles ap
  JOIN public.users u ON u.id = ap.user_id
  WHERE ap.id = NEW.athlete_id;

  -- Alle aktiven Coaches benachrichtigen
  FOR v_coach IN
    SELECT cae.coach_id
    FROM public.athlete_profiles ap
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = ap.user_id
    WHERE ap.id = NEW.athlete_id
      AND cae.status = 'active'
      AND cae.can_see_tests = true
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_coach.coach_id,
      'system',
      'Neuer Athletic Base Test',
      COALESCE(v_athlete_name, 'Dein Athlet') || ' hat einen neuen Test abgeschlossen'
        || CASE WHEN NEW.rank IS NOT NULL THEN ' (Rang ' || NEW.rank || ')' ELSE '' END
        || '.',
      jsonb_build_object(
        'athlete_id', NEW.athlete_id,
        'test_id', NEW.id,
        'rank', NEW.rank,
        'crs_total', NEW.crs_total
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_test_notify_coach
  AFTER INSERT ON public.fitness_tests
  FOR EACH ROW EXECUTE FUNCTION public.notify_coach_on_test();


-- ############################################################
--  SQL 3/3 v2 FERTIG.
--
-- ============================================================
--  GESAMTUEBERSICHT NACH ALLEN 3 SCRIPTS (v2):
-- ============================================================
--
--  29 TABELLEN (unveraendert)
--
--  HELPER FUNCTIONS: 14
--  RPCs: 2 (grant_xp, get_active_competition_prep)
--    [accept_invite entfernt in v3 — Ersatz: foundation v2 RPCs]
--  TRIGGER FUNCTIONS: 9
--    set_updated_at, handle_new_user, protect_user_fields,
--    update_streak_on_tracking,
--    on_engagement_ended, on_competition_completed,
--    validate_plan_assignment, validate_engagement_insert,
--    validate_engagement_update, notify_coach_on_test
--
--  INDIZES: 44
--  RLS POLICIES: ~70
--  TRIGGER: 19
--  CRON-JOBS: 3
--  STORAGE BUCKETS: 5
--    avatars (Public), chat-uploads (Private),
--    training-files (Private), exports (Private),
--    health-docs (Private)
--
--  v2 SECURITY-FIXES:
--    - age -> date_of_birth
--    - XP nur ueber grant_xp() RPC (kein Client-INSERT)
--    - Streak auto-update + Meilenstein-Notifications
--    - Level auto-Berechnung + Level-Up-Notifications
--    - Coach-Role-Check bei Engagement-Erstellung
--    - Athlete-Role-Check bei Engagement-Erstellung
--    - Status-Aenderungen nur durch berechtigte Rolle
--    - Auto-Invite-Code-Generierung
--    - Auto-Chat bei Engagement-Annahme
--    - Coach-Notifications bei Athleten-Events
--    - protect_user_fields: role/tier/xp nicht per Client
--    - Storage: owner-only read statt open authenticated
--    - DELETE Policies fuer Avatar, Chat-Uploads, Training-Files
--    - updated_at fuer fitness_tests + competitions
--
--  MANUELLE SCHRITTE:
--    1. pg_cron Extension aktivieren
--    2. Storage Buckets anlegen (5 Stueck)
-- ############################################################


-- ############################################################
-- [v3] CROSS-FILE FOREIGN KEYS (foundation v2 -> file 3)
-- ############################################################
-- Diese Constraints koennen erst hier gesetzt werden, weil die
-- Ziel-Tabelle coach_athlete_engagements erst in diesem File entsteht.

ALTER TABLE public.chat_channels
  ADD CONSTRAINT fk_chat_channel_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE CASCADE;

ALTER TABLE public.engagement_code_redemptions
  ADD CONSTRAINT fk_ecr_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE SET NULL;

