---
project: Ready 2 Fight
type: Roadmap-Erweiterung (Hi-fi Re-Skin + Funktions-Audit)
horizon: Sprint 5c (Theme + Layout) → Q3+ (neue Feature-Saeulen)
related_docs:
  - docs/ROADMAP.md
  - docs/Ready2Fight_PRD.md
  - r2f-design-pkg/project/hifi/Funktions-Audit.md
---

# ROADMAP v2 — Hi-fi Re-Skin & Audit-Backlog

Diese Datei ergaenzt `docs/ROADMAP.md` um zwei Stoesse, die aus dem Hi-fi-Handoff
vom 2026-04-21 (`r2f-design-pkg/`) und dem zugehoerigen `Funktions-Audit.md`
hervorgehen:

1. **Sprint 5c — Hi-fi Re-Skin der bestehenden MVP-Screens** (visuell, kein neuer
   Funktionsumfang). Schritte sind klein, jeder ist ein einzelner PR.
2. **Audit-Backlog — neue Feature-Saeulen** (Streaks/Quests, Foto-Mahlzeit,
   Make-Weight, Mindset-Audio, Wettkampf-Companion, AI-Touchpoints,
   Athlet-Community, Vereins-Layer). Jeder Punkt ist priorisiert und braucht
   User-Freigabe vor Sprint-Aufnahme — `CLAUDE.md §0.8`.

`ROADMAP.md` bleibt Source-of-Truth fuer den Hauptpfad (CRS, Tracking, RLS,
Engagements). Diese Datei laeuft parallel.

---

## Teil 1 · Sprint 5c — Hi-fi Re-Skin

**Ziel.** Die im Hi-fi-Handoff entworfene "Calm-Strength"-Sprache uebertragen
(60% Calm/Medito plus 40% Cal AI, warmes Beige plus Anthrazit plus Akzent-Crimson
`#C73E2A`, Fraunces/Inter/JetBrains) auf die existierenden MVP-Screens — ohne
neuen Scope, ohne neue Datenfelder, ohne neue RLS-Regeln.

**Methode.** Pro Schritt **ein** Roadmap-Step = **ein** PR. Tests werden
mit-migriert, nicht entfernt. Bei Konflikt zwischen Hi-fi-Mockup und PRD-MVP
gewinnt das PRD; abweichende Layout-Entscheidungen werden im PR-Body notiert.

### 5c.1 — Theme-Token-Port ✅ erledigt (PR folgt)

- `apps/web/src/index.css` — Tailwind-v4 `@theme`-Block mit Calm-Strength-Tokens
  (`--color-bg`, `--color-night`, `--color-accent`, `--font-display`, …).
- `apps/web/index.html` — Fraunces / Inter / JetBrains Mono via Google Fonts
  preconnected. `meta theme-color` auf `#F4F1EC`.
- Keine Komponenten-Markup-Aenderungen.

**Done.** Build + Lint + 167 Unit-Tests gruen.

### 5c.2 — Onboarding Hi-fi ✅ erledigt

**2026-04-28.** SplashStep mit dunkler Hero-Card + Wordmark Fraunces, ConsentStep
mit 3 Toggles (`ai_consent` persistiert via `useSetAiConsent`, Coach-Sichtbarkeit
und Marketing als UI-Skelett bis Migration), AthleteOnboarding und
CoachOnboarding auf Calm-Strength-Tokens, neuer CrsTutorialStep nach
Profil-Submit. OnboardingPage Phasen: splash → consent → athlete/coach →
tutorial → done. 8 neue Tests.

- Splash mit Foto-Hero (Kaempfer-Portrait, SW-Sepia gefiltert) + Brand-Wordmark
  Fraunces. Aktuell Platzhalter via radialem CSS-Verlauf, Asset-Lieferung als
  Followup.
- Consent-Gate: getrennte Toggles (Coach-Sichtbarkeit, KI-Verarbeitung,
  Werbung) — DSGVO bleibt dieselbe Logik wie heute, nur neue Hierarchie.
  Persistiert aktuell nur `ai_consent`; `coach_visibility` und `marketing`
  brauchen eigene Migrations-PRs.
- Rollenwahl, Profil, Disziplinen, CRS-Tutorial — Calm/Medito-Whitespace,
  Mono-Metadata-Caps, Crimson nur fuer primaeren CTA.
- BirthDateField bleibt 3-Feld TT/MM/JJJJ.

**Tests.** 8 neue (OnboardingPage flow, ConsentStep ai_consent persist).
Bestehende Onboarding-Tests gab es nicht — Komponenten waren bisher untested.

### 5c.3 — Dashboard + TrackingPage Hi-fi ✅ erledigt (mit Followups)

**2026-04-29.** Dashboard mit personalisiertem Header (Tag · Datum mono caps,
"Guten Morgen, Lena." Fraunces) und neuer CrsHeroCard (dunkle Hero-Card mit
radialem Akzent, Score-Zahl in Fraunces, Rang aus `crs_tests.rank_label`,
CTA "Test starten"). StreakCard, StreakHistoryChart, WeightHistoryChart und
TrackingForm auf Calm-Strength-Tokens (`--color-paper`, Akzent-Crimson statt
orange-400, Mono-Caps fuer Sektion-Header). Mood ist jetzt MoodEmojiStrip
(😞 😐 😊, mapped auf das `sleep_quality`-Enum). TrackingPage bekommt
BreathingCard (statisch, 4-7-8-Anleitung, kein Audio). Neuer Hook
`useLatestCrsScore` mit Empty/Loading/Error-States. 189 Tests gruen ohne
Anpassung — Selektoren waren rollen-basiert.

- **Dashboard.** CRS-Hero (grosse Score-Zahl in Fraunces, Sparkline darunter),
  `WeightHistoryChart` und `StreakHistoryChart` in der neuen Card-Sprache
  (`--color-paper`).
- **TrackingPage.** Mood-Reihe als Emoji-Strip, optionale Box-Breathing-
  Anleitung als statische Card (kein Audio in MVP).

**Followups (eigene PRs, nicht in 5c.3):**

- **Sparkline im CrsHero** — Hi-fi-Mock zeigt Score-Trend ueber 12 Tests.
  Aktuell nur Score-Zahl. Braucht `useCrsScoreHistory` + Mini-Line-SVG.
- **Wochen-Stats-Grid** (Schlaf · Puls · Gewicht · Streak). Schlaf + Streak +
  Gewicht ableitbar aus daily_tracking; **Puls fehlt im Schema** (`resting_hr`
  in `daily_tracking` nicht vorhanden) — eigener Migrations-PR noetig.
- **Mood-Enum erweitern** auf 5 Stufen (🌑 🌒 🌓 🌔 🌕) statt 3, dafuer
  Migration fuer `sleep_quality`-Enum + Backfill.
- **Schlaf-Slider / RPE-Slider** statt Segmented (ROADMAP-v2 erwaehnt es,
  aber 3-stufiges Enum macht Slider sinnlos — koppeln an Mood-Enum-Erweiterung).

### 5c.4 — CRS-Flow Hi-fi ✅ erledigt (mit Followups)

**2026-04-29.** `CrsTestPage` (449 LOC) refactort auf Sub-Komponenten unter
`apps/web/src/components/crs/`: `DisclaimerStep`, `RecoveryPrompt`,
`LiveTimerStep`, `ExerciseInputStep`, `ResultStep`, `RadarChart`. Alle Cards
auf `--color-paper` mit Crimson-Akzent, Live-Test in `--color-night`-Card mit
Hero-Numerale (Fraunces 8rem, mono caps Title). Disclaimer mit prominenter
Stoppe-bei-Liste (5 Signale: Brustdruck, Schwindel, Atemnot, Gelenk-Schmerzen,
Herzrasen) in `--color-bone`-Sub-Card. ResultStep mit Score-Hero (Score `--`
bis §1.17), Radar-Chart (5 Achsen, Roh-Werte normalisiert auf maxValue) und
Pace-Erklaerbarkeit ("Beste Disziplin / Verbesserungs-Potenzial" rein
deterministisch, kein KI-Call). 191 Tests gruen (2 neue 5c.4-Tests).

- **Disclaimer-Gate:** Stoppe-bei-Liste prominent in eigener Sub-Card, breiter
  Akzeptieren-Toggle, Crimson-CTA full-width.
- **Live-Test:** Hero-Numerale Fraunces 8rem, Title mono caps, Hint klein in
  `--color-on-night-2`. Vollbild-Effekt durch dunkle Card mit min-h und
  radialem Akzent-Gradient.
- **Ergebnis:** Score-Hero (analog `CrsHeroCard` im Dashboard), Radar-Chart
  als eigene SVG-Komponente, Pace-Erklaerung als deterministische
  `Beste/Schwaechste`-Ableitung aus den Roh-Werten (kein KI, CLAUDE.md §0.3).

**Followups (eigene PRs, nicht in 5c.4):**

- `window.confirm` fuer Abbrechen → eigenes Re-Auth-Style-Modal in der
  neuen Card-Sprache (UX-Polish, eigener PR).
- ResultStep-Integration mit echter Score-Berechnung — koppelt an §1.17
  (CRS-Score-Edge-Function) sobald `crs_norms` befuellt sind.
- Radar-Achsen normalisieren aktuell auf `maxValue` (theoretische Obergrenze).
  Sobald `crs_norms` da sind, auf prozentuale Norm-Skala umstellen.

### 5c.5 — SettingsPage + EngagementsPage Hi-fi ✅ erledigt (mit Followups)

**2026-04-29.** SettingsPage in 5 Sub-Komponenten zerlegt
(`apps/web/src/components/settings/`): ProfileCard mit Mono-Caps-Labels,
ModeSwitcherCard (Pills `--color-accent`/transparent), AiConsentCard
(`useSetAiConsent`-Toggle), DataRightsCard (3 disabled-Buttons als Skelett
fuer Export/Korrektur/Loeschung mit DSGVO-Art.-Hint), SessionCard. Header
Hi-fi (eyebrow mono caps, h1 Fraunces). `useProfile` um `ai_consent` erweitert.
EngagementsPage: RedeemForm in `--color-paper`-Card mit Mono-Code-Input,
Header Hi-fi. EngagementsList: Cards mit Initialen-Avataren in `--color-bone`,
Status-Pills in `--color-accent-soft`/`--color-bone`/transparent, Permission-
Chips mono caps in `--color-bone` mit Border. ReauthModal auf
`--color-paper` mit Crimson-CTA. 197 Tests gruen (6 neue SettingsPage-Tests).

**Followups (eigene PRs, nicht in 5c.5):**

- `coach_visibility`- und `marketing`-Toggles brauchen eigene Migration
  (siehe ConsentStep aus Sprint 5c.2 — gleicher Stand).
- Daten-Rechte-Buttons funktional verdrahten an GDPR-Export-Edge-Function
  (CLAUDE.md §1, §8). Aktuell nur UI-Skelett.
- Vereins-Sharing-Toggle gehoert zu AUD-11 (Q3+).

### 5c.6 — Coach-Dashboard Empty-State Hi-fi ✅ erledigt

**2026-04-29.** Scope-Korrektur gegenueber dem urspruenglich geplanten Sprint 5c.6
("Plan-Builder + Attention-first Cards"): das war echter neuer Funktionsumfang
(Plan-Builder existiert nicht im Codebase, Coach-Dashboard hatte nur einen
einzeiligen Platzhalter). Sprint 5c-Methode verlangt aber Re-Skin EXISTIERENDER
Screens ohne neuen Scope. Daher in 5c.6 nur der **Coach-Dashboard Empty-State**
re-skinned: Hero-Card in `--color-night` mit Headline "Noch keine Athleten
verbunden.", zwei `--color-paper`-CTA-Cards (Code generieren →
`/app/codes`, Athleten verwalten → `/app/engagements`), Hinweistext "Plan-Builder
folgt in Sprint 7." Ersetzt das einzeilige `Coach-Dashboard folgt in Sprint 7.`
in `Dashboard.tsx`. 198 Tests gruen (1 neuer Component-Test).

**Verschoben nach Sprint 7 (Coach-Tools, eigener Block):**

- Attention-first Uebersicht: Card-Reihe "4 Athleten brauchen heute
  Aufmerksamkeit" + Wochenkalender — braucht neue Hooks (Coach-Aggregation
  ueber Engagement-Athleten, Tracking-Daten via `is_linked_coach_with_*`).
- Plan-Builder: 3-Spalten-Layout (Block-Bibliothek · Timeline ·
  Detail-Editor) mit Auto-Progression-Hinweisen. Braucht neue Tabellen
  (`plan_blocks`, `plan_assignments`), neue RLS-Policies, neue Views.

**Begruendung der Verschiebung:** Beide Punkte beruehren neue Datenfelder /
neuen Funktionsumfang — verletzt Sprint-5c-Methode (Zeile 33-34: "ohne neuen
Scope, ohne neue Datenfelder, ohne neue RLS-Regeln"). Sauberer als eigener
Sprint-Block (Coach-Tools = Sprint 7).

**Done-Kriterium 5c gesamt.** Alle MVP-Screens visuell auf Calm-Strength;
Snapshot-Tests aktualisiert; Lighthouse Accessibility ≥ 90 weiterhin gruen;
keine `@apply`-Hacks, alles ueber `@theme`-Tokens.

---

## Teil 2 · Audit-Backlog — neue Feature-Saeulen

**Wichtig.** Jede Saeule ist eigener Roadmap-Block, nicht Teil von 5c. Vor
Sprint-Aufnahme: User-Priorisierung **und** PRD-Erweiterung pflegen, sonst
kollidiert es mit den Goldenen Regeln (`CLAUDE.md §0.3`, §6).

Quelle und ausfuehrliche Begruendung: `r2f-design-pkg/project/hifi/Funktions-Audit.md`.

### Q2 — Differenziatoren (Wenn 5c steht)

| ID         | Titel                                | Audit-Prio  | Notiz                                                                                                                                    |
| ---------- | ------------------------------------ | ----------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| **AUD-01** | Streaks · Quests · XP-System         | 🔴 KRITISCH | Bindung-Mechanik. Migration: `streak_state`, `quests`, `xp_events`. Achtung: Tabelle `users.xp` existiert bereits — kein Doppel-Layer.   |
| **AUD-02** | Foto-Mahlzeit-Tracking (Cal-AI-Stil) | 🔴 KRITISCH | Setzt Storage-Bucket + Edge Function + LLM-Vision voraus → **Phase 2** (`CLAUDE.md §0.3`). Vorher MVP-Variante: manuelles Makro-Logging. |
| **AUD-03** | Make-Weight-Modus                    | 🟠 HOCH     | Sicherheitsrelevant. Cut-Plan auf Wettkampf-Datum, Stop-Signale bei >1% KG/Tag.                                                          |
| **AUD-04** | Fight-Day-Modus                      | 🟠 HOCH     | Wiege-Erinnerung, Pre-Fight-Routine, Post-Fight Quick-Notes.                                                                             |

### Q3 — Recovery & Mindset

| ID         | Titel                                                             | Audit-Prio |
| ---------- | ----------------------------------------------------------------- | ---------- |
| **AUD-05** | Atem- & Mindset-Audio (5 Sessions)                                | 🟠 HOCH    |
| **AUD-06** | Verletzungs-Tracking + Rehab-Templates                            | 🟠 HOCH    |
| **AUD-07** | Schlaf-Coaching mit Wearable-Sync (Apple Health · Garmin · Whoop) | 🟡 MITTEL  |

### Q3+ — Skalierung

| ID         | Titel                                                                              | Audit-Prio        |
| ---------- | ---------------------------------------------------------------------------------- | ----------------- |
| **AUD-08** | Konkrete AI-Touchpoints (CRS-Erklaerbarkeit, Auto-Replies, Risiko-Warnung)         | 🟠 HOCH (Phase 2) |
| **AUD-09** | Predictive Wettkampf-Bereitschaft (CRS · Schlaf · RPE · Gewicht-Trend)             | 🟡 MITTEL         |
| **AUD-10** | Athlet-zu-Athlet Community (Vereins-Wall, Sparring-Matching)                       | 🟡 MITTEL         |
| **AUD-11** | Gym-Account / Multi-Coach Org-Layer                                                | 🟡 MITTEL         |
| **AUD-12** | Skill-Self-Assessment im Onboarding (Erfahrungsjahre, Wettkaempfe, Distanz/Stil)   | 🟠 HOCH           |
| **AUD-13** | Admin-Rolle + Moderation (Reports-Queue, Auto-Filter, Bann-Tools)                  | 🟠 HOCH           |
| **AUD-14** | Push-Strategie + Quiet Hours (Default 22-7, Kategorien Coach/Engagement/Wettkampf) | 🟠 HOCH           |
| **AUD-15** | Auftragsverarbeitungs-Vertrag (AVV) Self-Serve                                     | 🟠 HOCH           |
| **AUD-16** | Audit-Log fuer Coaches (DSGVO Art. 30)                                             | 🟡 MITTEL         |
| **AUD-17** | Sparring-Notes mit Video + Coach-Frame-Comments                                    | 🟡 MITTEL         |
| **AUD-18** | Bracket / Tournament Sicht                                                         | ⚪ NICE           |
| **AUD-19** | Sprachsteuerung Tracking (freihaendig)                                             | ⚪ NICE           |
| **AUD-20** | Mitglieds-Verwaltung & Abrechnung (Premium-Tier)                                   | ⚪ NICE           |
| **AUD-21** | Supplement & Hydration Tracking                                                    | 🟡 MITTEL         |
| **AUD-22** | Ziel-Setting (3-stufig: Heute / 4-Wochen / Saison)                                 | 🟡 MITTEL         |

---

## Workflow

- **5c-Schritte** laufen wie ROADMAP-Schritte — ein PR pro Step,
  Conventional-Commits in deutsch, Squash-Merge.
- **AUD-Punkte** brauchen vor Implementierung:
  1. User-Bestaetigung der Prioritaet,
  2. PRD-Kapitel (neu oder Erweiterung),
  3. Migrations-PR getrennt vom Feature-PR.
- **Konflikt** mit `ROADMAP.md`: Hauptpfad gewinnt. AUD-Saeulen warten, bis der
  betroffene MVP-Block stabil ist.
