-- ============================================================
-- READY 2 FIGHT  -  SQL 2/3: UX & GAMIFICATION  (v3 — Foundation-Sync)
-- XP, Levels, Streaks, Achievements, PRs, Session Completions,
-- Notifications, User Settings
-- Stand: 12.04.2026
--
-- CHANGES v2 → v3:
--   • Streak-Trigger: ap.user_id-Lookup entfernt. In foundation v2
--     ist athlete_profiles.id direkt die users.id (1:1-PK-FK), daher
--     ist daily_tracking.athlete_id bereits die User-ID. Spart einen
--     Index-Lookup pro Tracking-Insert.
--
-- VORAUSSETZUNG: r2f_sql_1_foundation_v2.sql wurde ausgefuehrt
--
-- FIXES v2:
--   [FIX-A4] XP-Auto-Update via Trigger auf xp_log
--   [FIX-A5] Level/Title auto-berechnet bei XP-Aenderung
--   [FIX-A6] Streak auto-Update via Trigger auf daily_tracking
--   [FIX-NEW4] xp_log INSERT nur ueber SECURITY DEFINER RPC
--   [FIX-NEW5] Streak-Reset bei versaeumtem Tag (Cron)
-- ============================================================


-- ############################################################
--  1. XP & LEVEL SYSTEM
-- ############################################################

CREATE TABLE public.xp_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  action      TEXT NOT NULL,
  xp_amount   INT NOT NULL,
  context     JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.xp_rules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action      TEXT UNIQUE NOT NULL,
  xp_amount   INT NOT NULL,
  description TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.level_thresholds (
  level       INT PRIMARY KEY,
  xp_required INT NOT NULL,
  title       TEXT NOT NULL,
  rank_color  TEXT
);

-- Standard XP-Werte
INSERT INTO public.xp_rules (action, xp_amount, description) VALUES
  ('tracking_completed',    25,  'Taegliches Tracking vollstaendig ausgefuellt'),
  ('meal_logged',           10,  'Eine Mahlzeit geloggt'),
  ('test_finished',        100,  'Athletic Base Test abgeschlossen'),
  ('test_rank_up',         150,  'Im Rang aufgestiegen'),
  ('quest_completed',       75,  'Quest abgeschlossen'),
  ('session_completed',     30,  'Trainingseinheit als erledigt markiert'),
  ('streak_7',              50,  '7-Tage-Streak erreicht'),
  ('streak_30',            200,  '30-Tage-Streak erreicht'),
  ('streak_100',           500,  '100-Tage-Streak erreicht'),
  ('first_competition',    100,  'Ersten Wettkampf eingetragen'),
  ('achievement_unlocked',  50,  'Achievement freigeschaltet'),
  ('profile_completed',     50,  'Profil vollstaendig ausgefuellt');

INSERT INTO public.level_thresholds (level, xp_required, title, rank_color) VALUES
  ( 1,      0, 'Awakening',       '#F44336'),
  ( 2,    100, 'Initiate',        '#F44336'),
  ( 3,    250, 'Trainee',         '#F44336'),
  ( 4,    500, 'Recruit',         '#FF9800'),
  ( 5,    800, 'Fighter',         '#FF9800'),
  ( 6,   1200, 'Contender',       '#4CAF50'),
  ( 7,   1700, 'Warrior',         '#4CAF50'),
  ( 8,   2300, 'Veteran',         '#4A90D9'),
  ( 9,   3000, 'Rising Hunter',   '#4A90D9'),
  (10,   4000, 'Hunter',          '#4A90D9'),
  (11,   5200, 'Elite Hunter',    '#8A2BE2'),
  (12,   6500, 'Predator',        '#8A2BE2'),
  (13,   8000, 'Apex',            '#8A2BE2'),
  (14,  10000, 'Monarch',         '#FFD700'),
  (15,  13000, 'Shadow Monarch',  '#FFD700');


-- ############################################################
--  2. STREAKS
-- ############################################################

CREATE TABLE public.streaks (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  current_streak    INT DEFAULT 0,
  longest_streak    INT DEFAULT 0,
  last_tracked_date DATE,
  updated_at        TIMESTAMPTZ DEFAULT now()
);


-- ############################################################
--  3. ACHIEVEMENTS
-- ############################################################

CREATE TABLE public.achievements (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT UNIQUE NOT NULL,
  title       TEXT NOT NULL,
  description TEXT,
  icon        TEXT,
  category    TEXT CHECK (category IN (
                'tracking','training','test','social','streak','nutrition','competition'
              )),
  xp_reward   INT DEFAULT 50,
  condition   JSONB,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE public.user_achievements (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID REFERENCES public.users(id) ON DELETE CASCADE,
  achievement_id UUID REFERENCES public.achievements(id) ON DELETE CASCADE,
  unlocked_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, achievement_id)
);

-- Starter-Achievements
INSERT INTO public.achievements (slug, title, description, icon, category, xp_reward, condition) VALUES
  ('first_blood',        'First Blood',           'Erstes taegliches Tracking abgeschlossen',          '🩸', 'tracking',    25,  '{"type":"tracking_count","count":1}'),
  ('week_warrior',       'Week Warrior',          '7 Tage in Folge getrackt',                          '🔥', 'streak',      50,  '{"type":"streak","days":7}'),
  ('month_machine',      'Month Machine',         '30 Tage in Folge getrackt',                         '⚡', 'streak',     200,  '{"type":"streak","days":30}'),
  ('century_club',       'Century Club',          '100 Tage in Folge getrackt',                        '💀', 'streak',     500,  '{"type":"streak","days":100}'),
  ('first_test',         'Awakened',              'Ersten Athletic Base Test bestanden',                '👁', 'test',       100,  '{"type":"test_count","count":1}'),
  ('rank_b',             'Rising Fighter',        'Rang B im Athletic Base Test erreicht',              '⚔', 'test',       150,  '{"type":"test_rank","rank":"B"}'),
  ('rank_a',             'Hunter Elite',          'Rang A im Athletic Base Test erreicht',              '🏆', 'test',       300,  '{"type":"test_rank","rank":"A"}'),
  ('rank_s',             'Shadow Monarch',        'Rang S im Athletic Base Test erreicht',              '👑', 'test',       500,  '{"type":"test_rank","rank":"S"}'),
  ('meal_starter',       'Fuel Up',               '10 Mahlzeiten geloggt',                             '🍽', 'nutrition',   25,  '{"type":"meals_logged","count":10}'),
  ('meal_pro',           'Nutrition Master',      '100 Mahlzeiten geloggt',                            '🥗', 'nutrition',  150,  '{"type":"meals_logged","count":100}'),
  ('first_plan',         'Game Plan',             'Ersten Trainingsplan erstellt/erhalten',             '📋', 'training',    50,  '{"type":"plan_count","count":1}'),
  ('ten_sessions',       'Grinder',               '10 Trainingseinheiten abgeschlossen',               '💪', 'training',   100,  '{"type":"sessions_completed","count":10}'),
  ('fifty_sessions',     'Iron Will',             '50 Trainingseinheiten abgeschlossen',               '🦾', 'training',   300,  '{"type":"sessions_completed","count":50}'),
  ('first_fight',        'Fight Night',           'Ersten Wettkampf eingetragen',                      '🥊', 'competition', 100, '{"type":"competition_count","count":1}'),
  ('social_butterfly',   'Connected',             'Erste Chat-Nachricht gesendet',                     '💬', 'social',      25,  '{"type":"messages_sent","count":1}'),
  ('quest_hunter',       'Quest Hunter',          '5 Quests abgeschlossen',                            '🗡', 'training',   150,  '{"type":"quests_completed","count":5}');


-- ############################################################
--  4. PERSONAL RECORDS
-- ############################################################

CREATE TABLE public.personal_records (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id    UUID REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  exercise      TEXT NOT NULL,
  record_value  NUMERIC(7,1) NOT NULL,
  unit          TEXT NOT NULL CHECK (unit IN ('reps','seconds','kg','km','min')),
  achieved_at   TIMESTAMPTZ DEFAULT now(),
  source        TEXT CHECK (source IN ('fitness_test','training','manual')),
  source_id     UUID,
  previous_best NUMERIC(7,1),
  created_at    TIMESTAMPTZ DEFAULT now()
);


-- ############################################################
--  5. SESSION COMPLETIONS
-- ############################################################

CREATE TABLE public.session_completions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID REFERENCES public.training_sessions(id) ON DELETE CASCADE,
  athlete_id      UUID REFERENCES public.athlete_profiles(id) ON DELETE CASCADE,
  completed_at    TIMESTAMPTZ DEFAULT now(),
  rpe             INT CHECK (rpe BETWEEN 1 AND 10),
  athlete_note    TEXT,
  coach_feedback  TEXT,
  coach_rating    INT CHECK (coach_rating BETWEEN 1 AND 5),
  feedback_at     TIMESTAMPTZ,
  UNIQUE(session_id, athlete_id)
);


-- ############################################################
--  6. IN-APP NOTIFICATIONS
-- ############################################################

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'achievement','level_up','streak','pr','coach_feedback',
                'plan_assigned','quest_suggested','link_request','system',
                'competition_prep','data_expiry'
              )),
  title       TEXT NOT NULL,
  body        TEXT,
  data        JSONB,
  read        BOOLEAN DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- HAND-EDIT: Immutable Wrapper fuer timestamptz→date (Postgres verlangt IMMUTABLE fuer Index-Expressions)
CREATE OR REPLACE FUNCTION public.utc_date(ts TIMESTAMPTZ)
RETURNS DATE LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$
  SELECT (ts AT TIME ZONE 'UTC')::date
$$;

-- Unique fuer Data-Expiry: max. 1 Warnung pro User/Tier/Tag
CREATE UNIQUE INDEX uniq_notifications_expiry_day
  ON public.notifications (user_id, type, (data->>'tier'), (public.utc_date(created_at)))
  WHERE type = 'data_expiry';


-- ############################################################
--  7. USER SETTINGS
-- ############################################################

CREATE TABLE public.user_settings (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID REFERENCES public.users(id) ON DELETE CASCADE UNIQUE,
  units             TEXT DEFAULT 'metric' CHECK (units IN ('metric','imperial')),
  language          TEXT DEFAULT 'de' CHECK (language IN ('de','en')),
  theme             TEXT DEFAULT 'dark' CHECK (theme IN ('dark','light')),
  reminder_tracking TIME DEFAULT '20:00',
  reminder_meals    TIME DEFAULT '12:00',
  reminder_training TIME,
  profile_visible   BOOLEAN DEFAULT true,
  show_in_rankings  BOOLEAN DEFAULT true,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now()
);


-- ############################################################
--  8. INDIZES
-- ############################################################

CREATE INDEX idx_xp_log_user         ON public.xp_log(user_id, created_at DESC);
CREATE INDEX idx_streaks_user        ON public.streaks(user_id);
CREATE INDEX idx_user_achv           ON public.user_achievements(user_id);
CREATE INDEX idx_personal_records    ON public.personal_records(athlete_id, exercise);
CREATE INDEX idx_session_completions ON public.session_completions(athlete_id);
CREATE INDEX idx_session_compl_sess  ON public.session_completions(session_id);
CREATE INDEX idx_notifications_user  ON public.notifications(user_id, read, created_at DESC);
CREATE INDEX idx_user_settings       ON public.user_settings(user_id);


-- ############################################################
--  9. RLS AKTIVIEREN
-- ############################################################

ALTER TABLE public.xp_log              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.xp_rules            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.level_thresholds    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.streaks             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_achievements   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.personal_records    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_completions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings       ENABLE ROW LEVEL SECURITY;


-- ############################################################
-- 10. RLS POLICIES
-- ############################################################

CREATE POLICY "Users read own xp log"
  ON public.xp_log FOR SELECT
  USING (user_id = auth.uid());

-- [FIX-NEW4] xp_log: kein direktes INSERT durch Client
-- XP wird NUR ueber die grant_xp() SECURITY DEFINER Function vergeben
-- => KEINE INSERT Policy fuer xp_log

CREATE POLICY "Anyone reads xp rules"
  ON public.xp_rules FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Anyone reads level thresholds"
  ON public.level_thresholds FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users manage own streak"
  ON public.streaks FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Anyone reads achievements"
  ON public.achievements FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users read own achievements"
  ON public.user_achievements FOR SELECT
  USING (user_id = auth.uid());

-- user_achievements INSERT nur ueber grant_xp/check_achievements
-- => KEINE direkte INSERT Policy

CREATE POLICY "Athletes manage own PRs"
  ON public.personal_records FOR ALL
  USING (athlete_id = public.own_athlete_profile_id());

CREATE POLICY "Athletes manage own completions"
  ON public.session_completions FOR ALL
  USING (athlete_id = public.own_athlete_profile_id());

CREATE POLICY "Users manage own notifications"
  ON public.notifications FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users manage own settings"
  ON public.user_settings FOR ALL
  USING (user_id = auth.uid());


-- ############################################################
-- 11. TRIGGER
-- ############################################################

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.streaks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- ############################################################
-- 12. [FIX-A4/A5] XP GRANT FUNCTION + AUTO LEVEL-UP
--     Einziger Weg um XP zu vergeben = grant_xp() RPC
--     Verhindert Client-Manipulation
-- ############################################################

CREATE OR REPLACE FUNCTION public.grant_xp(
  p_action TEXT,
  p_context JSONB DEFAULT NULL
)
RETURNS TABLE (new_xp_total INT, new_level INT, new_title TEXT, leveled_up BOOLEAN)
AS $$
DECLARE
  v_xp_amount INT;
  v_user_id UUID := auth.uid();
  v_old_level INT;
  v_new_xp INT;
  v_new_level INT;
  v_new_title TEXT;
BEGIN
  -- XP-Betrag aus Regeltabelle holen
  SELECT xr.xp_amount INTO v_xp_amount
  FROM public.xp_rules xr
  WHERE xr.action = p_action;

  IF v_xp_amount IS NULL THEN
    RAISE EXCEPTION 'Unbekannte XP-Action: %', p_action;
  END IF;

  -- Alten Level merken
  SELECT u.level INTO v_old_level
  FROM public.users u WHERE u.id = v_user_id;

  -- XP-Log schreiben (bypassed RLS weil SECURITY DEFINER)
  INSERT INTO public.xp_log (user_id, action, xp_amount, context)
  VALUES (v_user_id, p_action, v_xp_amount, p_context);

  -- users.xp_total hochzaehlen
  UPDATE public.users
  SET xp_total = xp_total + v_xp_amount
  WHERE id = v_user_id
  RETURNING xp_total INTO v_new_xp;

  -- Neues Level berechnen
  SELECT lt.level, lt.title INTO v_new_level, v_new_title
  FROM public.level_thresholds lt
  WHERE lt.xp_required <= v_new_xp
  ORDER BY lt.level DESC
  LIMIT 1;

  -- Level + Title in users aktualisieren
  UPDATE public.users
  SET level = COALESCE(v_new_level, 1),
      level_title = COALESCE(v_new_title, 'Awakening')
  WHERE id = v_user_id;

  -- Level-Up Notification
  IF v_new_level > v_old_level THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'level_up',
      'Level Up!',
      'Du bist jetzt Level ' || v_new_level || ' — ' || v_new_title || '!',
      jsonb_build_object('old_level', v_old_level, 'new_level', v_new_level, 'title', v_new_title)
    );
  END IF;

  RETURN QUERY SELECT v_new_xp, COALESCE(v_new_level, 1), COALESCE(v_new_title, 'Awakening'), (v_new_level > v_old_level);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ############################################################
-- 13. [FIX-A6] STREAK AUTO-UPDATE via daily_tracking Trigger
-- ############################################################

CREATE OR REPLACE FUNCTION public.update_streak_on_tracking()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id UUID;
  v_last_date DATE;
  v_current INT;
  v_longest INT;
BEGIN
  -- [v3] athlete_profiles.id IS users.id (1:1 in foundation v2),
  -- daher ist daily_tracking.athlete_id bereits die User-ID.
  v_user_id := NEW.athlete_id;

  -- Aktuelle Streak-Daten
  SELECT s.last_tracked_date, s.current_streak, s.longest_streak
  INTO v_last_date, v_current, v_longest
  FROM public.streaks s
  WHERE s.user_id = v_user_id;

  -- Streak berechnen
  IF v_last_date IS NULL OR NEW.date > v_last_date + INTERVAL '1 day' THEN
    -- Streak gebrochen oder erster Eintrag
    v_current := 1;
  ELSIF NEW.date = v_last_date + INTERVAL '1 day' THEN
    -- Streak fortgesetzt
    v_current := v_current + 1;
  ELSIF NEW.date = v_last_date THEN
    -- Gleicher Tag: nichts aendern
    RETURN NEW;
  ELSE
    -- Aelterer Eintrag: ignorieren
    RETURN NEW;
  END IF;

  -- Longest aktualisieren
  IF v_current > v_longest THEN
    v_longest := v_current;
  END IF;

  -- Streak updaten
  UPDATE public.streaks
  SET current_streak = v_current,
      longest_streak = v_longest,
      last_tracked_date = GREATEST(NEW.date, COALESCE(v_last_date, NEW.date))
  WHERE user_id = v_user_id;

  -- Streak-Notifications fuer Meilensteine
  IF v_current IN (7, 30, 100) THEN
    INSERT INTO public.notifications (user_id, type, title, body, data)
    VALUES (
      v_user_id,
      'streak',
      v_current || '-Tage-Streak!',
      'Du hast ' || v_current || ' Tage in Folge getrackt. Weiter so!',
      jsonb_build_object('streak', v_current)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_tracking_update_streak
  AFTER INSERT ON public.daily_tracking
  FOR EACH ROW EXECUTE FUNCTION public.update_streak_on_tracking();


-- ############################################################
-- 14. REALTIME
-- ############################################################

ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;


-- ############################################################
-- 15. AUTO-SETUP: Settings + Streak bei neuem User
--     Override von handle_new_auth_user aus SQL 1
-- ############################################################
-- HAND-EDIT: Funktionsname korrigiert (handle_new_user → handle_new_auth_user),
-- Spalten an Foundation v2 angepasst (name → display_name, role als user_role enum),
-- Settings + Streaks-Erstellung hinzugefügt.

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
  INSERT INTO public.user_settings (user_id) VALUES (NEW.id);
  INSERT INTO public.streaks (user_id) VALUES (NEW.id);
  RETURN NEW;
END $$;


-- ############################################################
--  SQL 2/3 v2 FERTIG.
--
--  +10 Tabellen (Gesamt: 24)
--  +1 Unique Index auf notifications (data_expiry)
--  +16 Starter-Achievements, +12 XP-Regeln, +15 Level-Stufen
--  +12 RLS Policies (Gesamt: 49)
--  +1 RPC: grant_xp() — einziger Weg fuer XP
--  +1 Trigger: Streak auto-update bei Tracking
--
--  Weiter mit: r2f_sql_3_engagements_v2.sql
-- ############################################################
