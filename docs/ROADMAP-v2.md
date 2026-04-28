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

### 5c.2 — Onboarding Hi-fi

- Splash mit Foto-Hero (Kaempfer-Portrait, SW-Sepia gefiltert) + Brand-Wordmark
  Fraunces.
- Consent-Gate: getrennte Toggles (Coach-Sichtbarkeit, KI-Verarbeitung,
  Werbung) — DSGVO bleibt dieselbe Logik wie heute, nur neue Hierarchie.
- Rollenwahl, Profil, Disziplinen, CRS-Tutorial — Calm/Medito-Whitespace,
  Mono-Metadata-Caps, Crimson nur fuer primaeren CTA.
- BirthDateField bleibt 3-Feld TT/MM/JJJJ.

**Tests.** Bestehende Onboarding-Tests anpassen (Selektoren auf Roles/Labels,
nicht Klassen).

### 5c.3 — Dashboard + TrackingPage Hi-fi

- **Dashboard.** CRS-Hero (grosse Score-Zahl in Fraunces, Sparkline darunter),
  Wochen-Stats-Grid (Schlaf · Puls · Gewicht · Streak), `WeightHistoryChart` und
  `StreakHistoryChart` in der neuen Card-Sprache (`--color-paper`).
- **TrackingPage.** Mood-Reihe als Emoji-Strip (🌑 → 🌕), Schlaf-Slider,
  RPE-Slider, optionale Box-Breathing-Anleitung als statische Card (kein Audio
  in MVP, nur visueller Anker fuer 5c-Future).

### 5c.4 — CRS-Flow Hi-fi

- Disclaimer-Gate: Stoppe-bei-Liste prominent, Akzeptieren-Toggle.
- Live-Test: **eine Zahl, ein Timer** — Hi-fi reduziert die UI auf Hero-Numerale,
  alles andere ist `--color-night`-Hintergrund.
- Ergebnis: Radar-Chart + Score-Hero, Pace-Erklaerbarkeit ("Warum diese Zahl?"
  bleibt textlich, kein KI-Call — `CLAUDE.md §0.3`).

### 5c.5 — SettingsPage + EngagementsPage Hi-fi

- DSGVO-Toggles in der neuen Card-Sprache: Gesundheitsdaten, Coach-Zugriff,
  Verein-Sharing, Werbung. Toggles-Default unveraendert.
- Daten-Rechte (Export, Korrektur, Loeschung) als 3 Akzent-Buttons.
- Re-Auth-Modal-Trigger und `ai_consent`-Toggle (Followup #7) hier integriert.
- EngagementsPage: Coach-Avatare in `--color-bone`, Permission-Chips als `.chip`-
  Klassen.

### 5c.6 — Coach-Dashboard + Plan-Builder Hi-fi (Desktop)

- Attention-first Uebersicht: 4 Athleten brauchen heute Aufmerksamkeit (Card-
  Reihe) + Wochenkalender darunter.
- Plan-Builder: 3-Spalten-Layout (Block-Bibliothek · Timeline · Detail-Editor)
  mit Auto-Progression-Hinweisen. Daten-Modell unveraendert.

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
