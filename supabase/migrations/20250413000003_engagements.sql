-- ============================================================
-- READY 2 FIGHT  -  SQL 3/3: ENGAGEMENTS & HEALTH  (v3 — Foundation-Sync)
--                             DATA RETENTION, COMP-PREP MODE
-- Stand: 13.04.2026
--
-- VORAUSSETZUNG: r2f_sql_1_foundation_v2.sql + r2f_sql_2_ux_v2.sql
--
-- HAND-EDITS (Schema-Alignment mit Foundation v2):
--   • athlete_profiles.user_id → athlete_profiles.id (PK = User-ID)
--   • users.name → users.display_name
--   • training_plans.coach_id → training_plans.owner_id
--   • Referenzen auf nicht-existierende Tabellen entfernt:
--     - public.meals (Phase 2, Sprint 16)
--     - public.fitness_tests → public.crs_tests
--     - public.quests (noch nicht implementiert)
--   • Doppelte Policies entfernt (bereits in Migration 1 definiert)
--   • Chat-Policies aus Migration 1 hierher verschoben
--   • pg_cron-Calls in DO-Block mit Extension-Check gewrappt
--   • on_competition_completed entfernt (competitions hat kein status-Feld)
-- ============================================================


-- ############################################################
--  1. SPORT DISCIPLINES (Referenztabelle)
-- ############################################################

CREATE TABLE IF NOT EXISTS public.sport_disciplines (
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

CREATE TABLE IF NOT EXISTS public.athlete_sports (
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

CREATE TABLE IF NOT EXISTS public.coach_athlete_engagements (
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_unique_active_engagement
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

CREATE TABLE IF NOT EXISTS public.health_records (
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

CREATE TABLE IF NOT EXISTS public.health_record_shares (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  record_id       UUID NOT NULL REFERENCES public.health_records(id) ON DELETE CASCADE,
  engagement_id   UUID NOT NULL REFERENCES public.coach_athlete_engagements(id) ON DELETE CASCADE,
  shared_at       TIMESTAMPTZ DEFAULT now(),
  revoked_at      TIMESTAMPTZ,
  UNIQUE(record_id, engagement_id)
);


-- ############################################################
--  7. HELPER FUNCTIONS (nur NEUE — Migration 1 hat is_linked_coach* bereits)
-- ############################################################

-- 7a) Aktives Engagement MIT Meal-Berechtigung (NEU, nicht in Migration 1)
CREATE OR REPLACE FUNCTION public.is_linked_coach_with_meals(p_athlete_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements cae
    WHERE cae.athlete_id = p_athlete_id
      AND cae.coach_id   = auth.uid()
      AND cae.status      = 'active'
      AND cae.can_see_meals = true
  );
END $$;

-- 7b) Darf Coach diesen Health Record sehen?
CREATE OR REPLACE FUNCTION public.can_coach_see_health_record(p_record_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.health_record_shares hrs
    JOIN public.coach_athlete_engagements cae ON cae.id = hrs.engagement_id
    WHERE hrs.record_id = p_record_id
      AND hrs.revoked_at IS NULL
      AND cae.coach_id  = auth.uid()
      AND cae.status     = 'active'
  );
END $$;

-- 7c) Hat Coach aktives Engagement mit diesem User?
CREATE OR REPLACE FUNCTION public.is_coach_of_user(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.coach_athlete_engagements
    WHERE coach_id   = auth.uid()
      AND athlete_id = p_user_id
      AND status     = 'active'
  );
END $$;

-- 7d) Coach sieht Wettkampf eines Athleten
-- HAND-EDIT: c.user_id → c.athlete_id (Foundation v2 Spaltenname)
CREATE OR REPLACE FUNCTION public.can_coach_see_competition(p_competition_id UUID)
RETURNS BOOLEAN LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.competitions c
    JOIN public.coach_athlete_engagements cae ON cae.athlete_id = c.athlete_id
    WHERE c.id = p_competition_id
      AND cae.coach_id = auth.uid()
      AND cae.status   = 'active'
  );
END $$;


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

-- 8b) Trainingsplan-Zuweisung validieren
-- HAND-EDIT: NEW.coach_id → NEW.owner_id, ap.user_id → ap.id
CREATE OR REPLACE FUNCTION public.validate_plan_assignment()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.athlete_id IS NULL THEN RETURN NEW; END IF;
  IF NEW.owner_id IS NULL THEN RETURN NEW; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.coach_athlete_engagements cae
    WHERE cae.athlete_id = NEW.athlete_id
      AND cae.coach_id   = NEW.owner_id
      AND cae.status      = 'active'
      AND cae.can_create_plans = true
  ) THEN
    RAISE EXCEPTION 'Coach hat kein aktives Engagement mit Planrechten fuer diesen Athleten';
  END IF;

  IF NEW.engagement_id IS NULL THEN
    SELECT cae.id INTO NEW.engagement_id
    FROM public.coach_athlete_engagements cae
    WHERE cae.athlete_id = NEW.athlete_id
      AND cae.coach_id   = NEW.owner_id
      AND cae.status      = 'active'
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

  -- Status muss bei Insert immer 'pending' sein
  NEW.status := 'pending';

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- [FIX-C2/NEW7] Coach kann Status NICHT auf 'active' setzen
CREATE OR REPLACE FUNCTION public.validate_engagement_update()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status != OLD.status THEN
    IF auth.uid() = OLD.coach_id THEN
      IF NOT (
        (OLD.status = 'active' AND NEW.status = 'paused') OR
        (OLD.status = 'paused' AND NEW.status = 'active') OR
        (NEW.status = 'ended')
      ) THEN
        RAISE EXCEPTION 'Coach darf Status nicht von % zu % aendern', OLD.status, NEW.status;
      END IF;

      IF NEW.status = 'ended' THEN
        NEW.ended_by = auth.uid();
        NEW.end_reason = COALESCE(NEW.end_reason, 'coach_ended');
      END IF;

    ELSIF auth.uid() = OLD.athlete_id THEN
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

CREATE OR REPLACE FUNCTION public.is_competition_prep_active(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.competitions
    WHERE athlete_id = p_user_id
      AND competition_date IS NOT NULL
      AND competition_date >= CURRENT_DATE
      AND competition_date <= CURRENT_DATE + INTERVAL '70 days'
  );
$$;

CREATE OR REPLACE FUNCTION public.get_active_competition_prep(p_user_id UUID)
RETURNS TABLE (
  competition_id   UUID,
  competition_name TEXT,
  event_date       DATE,
  weight_class     TEXT,
  days_remaining   INT,
  phase            TEXT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
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
$$;


-- ############################################################
-- 10. COACH TEAM-VIEW per Sportart
-- ############################################################
-- HAND-EDIT: u.name → u.display_name

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
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT
    cae.id, cae.athlete_id, u.display_name, u.avatar_url,
    sd.name, sd.slug, cae.purpose, cae.status, cae.started_at,
    EXTRACT(DAY FROM now() - cae.started_at)::INT,
    cae.can_see_tracking, cae.can_see_meals, cae.can_create_plans
  FROM public.coach_athlete_engagements cae
  JOIN public.users u ON u.id = cae.athlete_id
  LEFT JOIN public.sport_disciplines sd ON sd.id = cae.sport_id
  WHERE cae.coach_id = auth.uid()
    AND cae.status IN ('active', 'pending')
    AND (p_sport_id IS NULL OR cae.sport_id = p_sport_id)
  ORDER BY sd.name NULLS LAST, u.display_name ASC;
$$;

CREATE OR REPLACE FUNCTION public.get_coach_sport_groups()
RETURNS TABLE (
  sport_id      UUID,
  sport_name    TEXT,
  sport_slug    TEXT,
  athlete_count BIGINT
) LANGUAGE sql SECURITY DEFINER STABLE AS $$
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
$$;


-- ############################################################
-- 11. INVITE-CODE ANNEHMEN — in foundation v2 als redeem_engagement_code()
-- ############################################################
-- Siehe r2f_sql_1_foundation_v2.sql §15.


-- ############################################################
-- 12. DATA RETENTION
-- ############################################################
-- HAND-EDIT: ap.user_id → dt.athlete_id (direkt, da athlete_profiles.id = users.id)
-- HAND-EDIT: meals-Referenz entfernt (Tabelle existiert erst in Phase 2)

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
      WHERE dt.athlete_id = r.user_id
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
    JOIN public.users u ON u.id = dt.athlete_id
    WHERE (
      (u.subscription_tier = 'free'  AND dt.date < CURRENT_DATE - INTERVAL '90 days')
      OR
      (u.subscription_tier = 'pro'   AND dt.date < CURRENT_DATE - INTERVAL '365 days')
    )
  );
  -- meals cleanup wird in Phase 2 ergaenzt, wenn die meals-Tabelle existiert
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Cron-Jobs (nur wenn pg_cron verfügbar)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.schedule(
      'notify-data-expiry',
      '0 4 * * *',
      $cron$ SELECT public.notify_data_expiry(); $cron$
    );
    PERFORM cron.schedule(
      'cleanup-expired-tracking',
      '30 4 * * *',
      $cron$ SELECT public.cleanup_expired_tracking(); $cron$
    );
  END IF;
END $$;


-- ############################################################
-- 13. INDIZES
-- ############################################################

CREATE INDEX IF NOT EXISTS idx_sport_disciplines_slug  ON public.sport_disciplines(slug);
CREATE INDEX IF NOT EXISTS idx_athlete_sports_athlete  ON public.athlete_sports(athlete_id);
CREATE INDEX IF NOT EXISTS idx_athlete_sports_sport    ON public.athlete_sports(sport_id);
CREATE INDEX IF NOT EXISTS idx_engagements_coach       ON public.coach_athlete_engagements(coach_id, status);
CREATE INDEX IF NOT EXISTS idx_engagements_athlete     ON public.coach_athlete_engagements(athlete_id, status);
CREATE INDEX IF NOT EXISTS idx_engagements_competition ON public.coach_athlete_engagements(competition_id)
  WHERE competition_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_engagements_sport       ON public.coach_athlete_engagements(sport_id)
  WHERE sport_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_health_records_athlete  ON public.health_records(athlete_id, category);
CREATE INDEX IF NOT EXISTS idx_health_shares_record    ON public.health_record_shares(record_id);
CREATE INDEX IF NOT EXISTS idx_health_shares_engage    ON public.health_record_shares(engagement_id);
CREATE INDEX IF NOT EXISTS idx_training_plans_engage   ON public.training_plans(engagement_id)
  WHERE engagement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_engagement     ON public.daily_tracking(engagement_id)
  WHERE engagement_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_tracking_date_athlete   ON public.daily_tracking(date, athlete_id);
-- idx_meals_date_athlete entfernt: meals-Tabelle existiert erst in Phase 2


-- ############################################################
-- 14. RLS AKTIVIEREN
-- ############################################################

ALTER TABLE public.sport_disciplines         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.athlete_sports            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_athlete_engagements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_records            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.health_record_shares      ENABLE ROW LEVEL SECURITY;


-- ############################################################
-- 15. RLS POLICIES (neue Tabellen)
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

CREATE POLICY "Coaches create engagements"
  ON public.coach_athlete_engagements FOR INSERT
  WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Athletes update engagement status"
  ON public.coach_athlete_engagements FOR UPDATE
  USING (athlete_id = auth.uid());

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
-- 16. ZUSAETZLICHE COACH-POLICIES FUER BESTEHENDE TABELLEN
--     (nur Policies die Migration 1 NICHT schon hat)
-- ############################################################

-- Athlet sieht Coach-Name/Avatar (NEU — Migration 1 hat nur Coach→Athlet)
CREATE POLICY "Athlete reads linked coach users"
  ON public.users FOR SELECT
  USING (
    id IN (
      SELECT coach_id FROM public.coach_athlete_engagements
      WHERE athlete_id = auth.uid() AND status = 'active'
    )
  );

-- Coach sieht Athleten-PRs (NEU — Migration 2 hat nur self-Policy)
CREATE POLICY "Coach reads athlete PRs"
  ON public.personal_records FOR SELECT
  USING (public.is_linked_coach(athlete_id));

-- Coach sieht Achievements seiner Athleten (NEU)
CREATE POLICY "Coach reads athlete achievements"
  ON public.user_achievements FOR SELECT
  USING (
    user_id IN (
      SELECT athlete_id FROM public.coach_athlete_engagements
      WHERE coach_id = auth.uid() AND status = 'active'
    )
  );

-- Session-Completions: Coach liest + gibt Feedback
-- HAND-EDIT: tp.coach_id → tp.owner_id
CREATE POLICY "Coach reads athlete completions"
  ON public.session_completions FOR SELECT
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_plans tp ON ts.plan_id = tp.id
      WHERE tp.owner_id = auth.uid()
    )
  );

CREATE POLICY "Coach updates feedback only"
  ON public.session_completions FOR UPDATE
  USING (
    session_id IN (
      SELECT ts.id FROM public.training_sessions ts
      JOIN public.training_plans tp ON ts.plan_id = tp.id
      WHERE tp.owner_id = auth.uid()
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
-- 16b. DEFERRED CHAT POLICIES (verschoben aus Migration 1)
--      Benoetigen coach_athlete_engagements, die erst hier existiert.
-- ############################################################

CREATE POLICY cm_member_read ON public.chat_messages FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.chat_channels ch
          JOIN public.coach_athlete_engagements e ON e.id = ch.engagement_id
          WHERE ch.id = channel_id
          AND (e.coach_id = auth.uid() OR e.athlete_id = auth.uid()))
);

CREATE POLICY cm_member_send ON public.chat_messages FOR INSERT WITH CHECK (
  sender_id = auth.uid() AND EXISTS (
    SELECT 1 FROM public.chat_channels ch
    JOIN public.coach_athlete_engagements e ON e.id = ch.engagement_id
    WHERE ch.id = channel_id AND ch.is_locked = false
    AND (e.coach_id = auth.uid() OR e.athlete_id = auth.uid())
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

-- [FIX-C1/NEW6] Role-Validierung bei Insert
CREATE TRIGGER validate_engagement_on_insert
  BEFORE INSERT ON public.coach_athlete_engagements
  FOR EACH ROW EXECUTE FUNCTION public.validate_engagement_insert();

-- on_competition_completed ENTFERNT: competitions-Tabelle hat kein status-Feld
-- Wird bei Bedarf in Phase 1 Sprint 7 ergaenzt.

CREATE TRIGGER validate_plan_assignment
  BEFORE INSERT OR UPDATE ON public.training_plans
  FOR EACH ROW EXECUTE FUNCTION public.validate_plan_assignment();


-- ############################################################
-- 18. STORAGE: Health-Documents Bucket
-- ############################################################

CREATE POLICY "Athletes upload health docs"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'health_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Athletes read own health docs"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'health_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Athletes delete own health docs"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'health_documents'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );


-- ############################################################
-- 19. COACH-NOTIFICATIONS BEI ATHLETEN-EVENTS
-- ############################################################
-- HAND-EDIT: fitness_tests → crs_tests, u.name → u.display_name,
-- ap.user_id → ap.id, NEW.rank → NEW.rank_label, NEW.crs_total → NEW.score

CREATE OR REPLACE FUNCTION public.notify_coach_on_test()
RETURNS TRIGGER AS $$
DECLARE
  v_coach RECORD;
  v_athlete_name TEXT;
BEGIN
  -- Athleten-Name holen (athlete_profiles.id = users.id)
  SELECT u.display_name INTO v_athlete_name
  FROM public.users u
  WHERE u.id = NEW.athlete_id;

  -- Alle aktiven Coaches benachrichtigen
  FOR v_coach IN
    SELECT cae.coach_id
    FROM public.coach_athlete_engagements cae
    WHERE cae.athlete_id = NEW.athlete_id
      AND cae.status = 'active'
      AND cae.can_see_tests = true
  LOOP
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_coach.coach_id,
      'system',
      'Neuer Athletic Base Test',
      COALESCE(v_athlete_name, 'Dein Athlet') || ' hat einen neuen Test abgeschlossen'
        || CASE WHEN NEW.rank_label IS NOT NULL THEN ' (Rang ' || NEW.rank_label || ')' ELSE '' END
        || '.',
      jsonb_build_object(
        'athlete_id', NEW.athlete_id,
        'test_id', NEW.id,
        'rank', NEW.rank_label,
        'score', NEW.score
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- HAND-EDIT: Trigger auf crs_tests statt fitness_tests
CREATE TRIGGER on_test_notify_coach
  AFTER INSERT ON public.crs_tests
  FOR EACH ROW EXECUTE FUNCTION public.notify_coach_on_test();


-- ############################################################
-- 20. CROSS-FILE FOREIGN KEYS (foundation v2 → file 3)
-- ############################################################

ALTER TABLE public.chat_channels
  ADD CONSTRAINT fk_chat_channel_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE CASCADE;

ALTER TABLE public.engagement_code_redemptions
  ADD CONSTRAINT fk_ecr_engagement
  FOREIGN KEY (engagement_id)
  REFERENCES public.coach_athlete_engagements(id) ON DELETE SET NULL;


-- ############################################################
--  SQL 3/3 FERTIG.
-- ############################################################
