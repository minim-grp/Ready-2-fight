---
project: Ready 2 Fight
type: Entwicklungsplan (Roadmap)
horizon: Phase 0 (Setup) → Phase 4+ (Vision-Layer)
related_docs:
  - docs/Ready2Fight_PRD.md
  - docs/CLAUDE.md
---

# Entwicklungsplan — Ready 2 Fight

Schritt-für-Schritt-Plan vom leeren Repo bis zur vollständigen App mit KI-Funktionalitäten. Jede Phase hat ein klares **Done-Kriterium** — erst wenn das erfüllt ist, beginnt die nächste. Sprints sind als Orientierung à zwei Wochen gedacht; ein Solo-Entwickler oder kleines Team kann sie kürzen oder verlängern.

**Lesehinweis für Claude**: Wenn der User „lass uns mit Schritt X anfangen" sagt, lies erst die Bullet-Liste dieses Schritts, dann die referenzierten PRD-Kapitel, dann beginne mit Code. Halte dich strikt an den Scope des jeweiligen Schritts — kein Vorgreifen.

---

## Phase 0 · Pre-Launch-Setup (Sprint 0–1)

**Ziel**: Repo, CI, Supabase-Projekt, Foundation-Schema stehen. Ohne Feature-Code.

### 0.1 Repo & Tooling
- Monorepo mit `apps/web` (PWA) und `supabase/` (Migrations + Edge Functions).
- TypeScript strict, ESLint, Prettier, Husky pre-commit, Conventional-Commits-Linter.
- `.env.example` mit allen Variablen, `.env` gitignored.
- VS-Code-Workspace-Settings im Repo: empfohlene Extensions, Format-on-Save, ESLint auf Auto-Fix.

### 0.2 Supabase-Projekt
- Zwei Environments: `dev` (lokal via Supabase CLI) und `staging` (Supabase Cloud, Region `eu-central-1`).
- Production-Projekt **noch nicht** anlegen — kommt in Phase 1 Schritt 1.10.
- Auth-Provider: nur E-Mail+Passwort. Confirm-E-Mail aktiviert.
- Storage-Buckets: `avatars` (public), `health_documents` (private), `plan_attachments` (private), `crs_evidence` (private).

### 0.3 Foundation-Migrationen
- `r2f_sql_1_foundation_v2.sql` einspielen (existiert bereits).
- `r2f_sql_2_ux.sql` (Gamification) einspielen.
- `r2f_sql_3_engagements.sql` einspielen — **vorher** den Stalking-Vektor entfernen, falls noch nicht geschehen (Code-Generierung über die RPC aus File 1, nicht aus File 3).
- Alle Migrations laufen idempotent durch, RLS ist überall an.

### 0.4 CI-Pipeline
- GitHub Actions: lint → typecheck → unit-tests → pgTAP → build → Lighthouse auf Preview-Deploy.
- Branch-Protection auf `main`: PR-Review + grüner CI-Status Pflicht.

### Done-Kriterium Phase 0
> `supabase db reset && supabase test db && pnpm test && pnpm build` läuft lokal komplett grün, CI auf einem Test-PR ist grün, Staging-DB ist mit allen drei Migrations gefüllt.

---

## Phase 1 · MVP-Kern (Sprints 2–9, ca. 16 Wochen)

**Ziel**: Alle Funktionen aus PRD §04 (Funktionsumfang nach Rolle) sind end-to-end nutzbar. Keine KI-Features. Bereit für Closed Beta mit den ersten 30 Coaches.

### Sprint 2 · Auth & Onboarding (PRD §05)

**1.1** Registrierung Athlet — Geburtsdatum-Check (Mindestalter 16), Display-Name, E-Mail-Verifikation.
**1.2** Registrierung Coach — separate Felder (Zertifikat, Gym, Stadt).
**1.3** Login, Logout, Passwort-Reset, Passwort-Ändern, E-Mail-Ändern (mit Re-Auth).
**1.4** Onboarding-Flow Athlet (4 Slides + Profil-Felder) → setzt `athlete_profiles.onboarding_done`.
**1.5** Onboarding-Flow Coach (3 Slides + Profil-Felder).

**Done**: Ein neuer User kann sich registrieren, verifizieren, einloggen, sein Onboarding abschließen, Passwort zurücksetzen. RLS-Tests grün.

### Sprint 3 · Daily Tracking (PRD §06)

**1.6** Tracking-Form mit allen Feldern aus dem PRD. Inline-Edit auf Dashboard.
**1.7** Offline-Queue via IndexedDB + Workbox, Sync bei Reconnect.
**1.8** Streak-Logik mit 48 h Karenz (Trigger aus File 2 verifizieren).
**1.9** 7-Tage-Übersicht und 30-Tage-Verlauf als Chart.

**Done**: Ein Athlet kann sieben Tage in Folge tracken, davon einen offline, und sieht seine Streak korrekt.

### Sprint 4 · Engagement-Flow (PRD §03, kritischster Flow)

**1.10** Coach generiert Code via `generate_engagement_code` RPC. UI: optionales internes Label, Anzahl Uses, Gültigkeit.
**1.11** Code-Liste im Coach-Settings mit Status (aktiv/eingelöst/abgelaufen) und Revoke-Button.
**1.12** Athlet löst Code via `redeem_engagement_code` RPC ein. Fehler-States: invalid, expired, exhausted, eigener Code.
**1.13** Engagement-Lifecycle: pause, resume, end. End-Trigger setzt alle Permissions auf false und sperrt Chat (read-only 12 Monate).
**1.14** Mehrere-Coaches-Liste im Athleten-Settings.

**Done**: Coach erstellt Code, Athlet löst ein, beide sehen sich in der jeweiligen Liste, Engagement kann pausiert und beendet werden, Re-Auth bei „Beenden" greift, Audit-Log enthält alle Events.

### Sprint 5 · CRS-Test (PRD §06)

**1.15** Test-State-Machine: disclaimer → warmup → 5×exercise → cooldown → result. Persistiert in `crs_tests` mit Status `in_progress`.
**1.16** Interruption-Recovery: App-Kill, Anruf, Browser-Reload führen zurück zum letzten Schritt via `client_uuid`.
**1.17** Score-Berechnung als Edge Function (Formel aus PRD Anhang B).
**1.18** Result-Screen mit Rang, Radar-Chart, Archetyp.
**1.19** CRS-Verlaufsdiagramm im Athleten-Profil.

**Done**: Ein Athlet kann einen Test starten, mitten drin die App schließen, beim nächsten Öffnen weitermachen, abschließen, Score sehen, im Verlauf vergleichen.

### Sprint 6 · Trainingspläne (PRD §06)

**1.20** Coach-Plan-Editor: Plan → Sessions → Übungen, Drag&Drop für Reihenfolge.
**1.21** Templates: Coach speichert eigene Templates und kopiert sie in zugewiesene Pläne.
**1.22** Plan-Zuweisung an Athlet (Permission-Check `can_create_plans`).
**1.23** Athlet-Plan-View (read-only) mit Session-Completion-Toggle (XP-Trigger feuert).
**1.24** Plan-Archivierung.

**Done**: Coach erstellt ein Template, kopiert es, weist es zu, Athlet sieht den Plan, hakt Sessions ab, bekommt XP.

### Sprint 7 · Wettkämpfe & Coach-Detailview

**1.25** Athlet erstellt/editiert/löscht Wettkämpfe.
**1.26** Coach sieht Wettkämpfe seiner Athleten (Permission `can_see_tracking` reicht — Wettkämpfe sind allgemeine Daten).
**1.27** Coach-Athleten-Detailansicht: Tracking-Verlauf, CRS-Verlauf, Pläne, Wettkämpfe — gefiltert nach Permissions.
**1.28** Coach-Dashboard mit Wochenkalender und „Athleten brauchen Aufmerksamkeit"-Liste (regelbasiert, nicht KI).

**Done**: Coach hat einen kompletten Überblick über jeden Athleten und sieht ausschließlich, was die jeweiligen Permissions erlauben.

### Sprint 8 · Chat & Notifications

**1.29** Realtime-Chat über `chat_messages` mit lazy subscription (nur bei offenem Chat).
**1.30** Read-Receipts.
**1.31** Drei E-Mail-Notification-Trigger (Tracking-Reminder, Chat-Digest, Plan-zugewiesen) als Edge Function mit Cron.
**1.32** In-App-Notification-Bell (gefüllt aus `notifications`-Tabelle aus File 2).
**1.33** Notification-Preferences im Settings.

**Done**: Coach und Athlet chatten in Echtzeit, E-Mail-Reminder kommen an, Preferences greifen.

### Sprint 9 · Account-Management & DSGVO (PRD §08–09)

**1.34** Profil bearbeiten, Avatar hochladen.
**1.35** Account-Löschung mit 14-Tage-Grace via `request_account_deletion` RPC. Edge Function als Cron, die nach Ablauf wirklich löscht (Hard-Delete mit Anonymisierungs-Strategie für FKs).
**1.36** Datenexport (DSGVO Art. 20) als Edge Function: ZIP mit allen User-Daten als JSON + CSV.
**1.37** Cookie-Hinweis (nur technisch notwendig, kein Banner nötig).
**1.38** Impressum, Datenschutzerklärung, AGB als statische Seiten.

**Done**: Ein Athlet kann seinen Account löschen, seine Daten exportieren, alle drei Rechtsdokumente sind verlinkt.

### Sprint 10 · Härtung & Closed Beta

**1.39** Vollständige RLS-Test-Suite — jede Policy hat positiv und negativ.
**1.40** Penetration-Smoke-Test: SQL-Injection, RLS-Bypass-Versuche, Engagement-Code-Bruteforce.
**1.41** Lighthouse-Accessibility ≥ 90 auf allen Hauptscreens.
**1.42** Empty States, Error Boundaries, Toast-System final.
**1.43** Onboarding-Tutorial polishing.
**1.44** Production-Supabase-Projekt anlegen, Migrations ausspielen, DNS, Backup-Strategie testen (RTO 4h / RPO 24h).
**1.45** Closed-Beta-Launch mit den ersten 30 Coaches.

### Done-Kriterium Phase 1
> Die vier MVP-Erfolgskriterien aus PRD §11 sind nach 4 Wochen Live-Betrieb erfüllt: ≥80% Onboarding-Completion, ≥50% First-CRS innerhalb 7 Tagen, D7-Retention ≥40%, ≥35% aktive Coach-Engagements.

---

## Phase 2 · KI-Integration & Skalierung (Sprints 11–18, ca. 16 Wochen)

**Ziel**: Die ersten vier KI-Features aus PRD §14 live, plus die Phase-2-Features, die der MVP zurückgestellt hat. Voraussetzung: Phase 1 ist live und stabil.

### Sprint 11 · KI-Foundation

**2.1** `ai_interactions`-Tabelle anlegen (Schema in PRD §14): `id, user_id, feature, prompt_hash, response_summary, model_version, cost_tokens, created_at`.
**2.2** Edge Function `llm-call` als zentrale Abstraktionsschicht. Provider-agnostisch (Adapter-Pattern für Anthropic, OpenAI, Mistral). Loggt jede Antwort in `ai_interactions`.
**2.3** Rate-Limiting und Cost-Cap pro User pro Tag.
**2.4** Prompt-Injection-Wrapper für jeden User-Input (siehe CLAUDE.md §7.10).
**2.5** `ai_consent`-Opt-in-UI im Settings, mit Erklärung was die KI sieht und was nicht. Widerruf jederzeit möglich, löst Anonymisierung der historischen `ai_interactions` aus.
**2.6** Graceful-Degradation-Pattern als wiederverwendbare React-Komponente `<AIFeatureBoundary>`.

**Done**: Ein Test-Prompt läuft durch die Edge Function, wird geloggt, respektiert `ai_consent`, fällt bei Provider-Outage sauber zurück.

### Sprint 12 · Tracking-Insights (PRD §14, Phase-2-Feature 1)

**2.7** Wöchentliche Zusammenfassung der letzten 7 Tracking-Tage als LLM-Call. On-demand-Button im Athleten-Dashboard.
**2.8** „Warum?"-Erklärung pro Insight.
**2.9** Telemetrie: Akzeptanzrate (Daumen hoch/runter).

### Sprint 13 · Coach Co-Pilot (PRD §14, Phase-2-Feature 2)

**2.10** Chat-Assistent im Coach-Dashboard.
**2.11** RAG über Coach-eigene Daten — **mit RLS im Retrieval-Layer**: der Vector-Store enthält nur Daten, die der Coach laut `is_linked_coach_with_*()` sehen darf.
**2.12** Antworten enthalten immer Quellenangaben (welcher Athlet, welcher Datenpunkt, welcher Zeitraum).

### Sprint 14 · Plan-Generator (PRD §14, Phase-2-Feature 3)

**2.13** Coach gibt Ziel, Wochen, Constraints ein. LLM generiert Plan-Entwurf als JSON, der direkt in den Plan-Editor geladen wird.
**2.14** Mensch-im-Loop: Coach editiert, dann erst zuweisen.
**2.15** Feedback-Loop: angenommene vs. verworfene Entwürfe werden geloggt für späteres Tuning.

### Sprint 15 · Athleten-Briefing (PRD §14, Phase-2-Feature 4)

**2.16** Wöchentliches automatisches Briefing per E-Mail (Cron Edge Function).
**2.17** Nur an User mit `ai_consent = true`.
**2.18** Inhalt: Trends, ein konkreter Quest-Vorschlag, ein Trainings-Hinweis.

### Sprint 16 · Phase-2-Nicht-KI-Features

**2.19** 2FA (TOTP) für alle User.
**2.20** Push-Notifications (Web Push API + Service Worker).
**2.21** In-App-Notification-Center.
**2.22** Gesundheitsakten (Tabellen aus File 3 sind da) mit separater Freigabe pro Akte.
**2.23** Ernährungs-Tracking (Mahlzeiten, einfaches Makro-Logging).
**2.24** Bulk-Updates über mehrere zugewiesene Pläne für Coaches.
**2.25** Disziplinspezifische CRS-Varianten (Boxen, BJJ, MMA als erste).

### Sprint 17 · Internationalisierung & Skalierung

**2.26** i18n-Infrastruktur aktivieren, Englisch als zweite Sprache.
**2.27** Sprachumschalter im Settings.
**2.28** Performance-Audit: P95-API-Latenz unter 400 ms, Verfügbarkeit ≥ 99,9 %.
**2.29** Load-Testing auf 10× aktuelle Nutzerzahl.

### Sprint 18 · Phase-2-Launch & Erfolgsmessung

**2.30** Vollständige WCAG 2.1 AA Konformität.
**2.31** Pricing-Modell live (Coach 19 €/Monat, Athlet kostenlos).
**2.32** Stripe-Integration für Coach-Subscriptions.
**2.33** Phase-2-Erfolgsmetriken: KI-Adoption ≥30% der Coaches im ersten Monat, Akzeptanzrate Insights ≥60%.

### Done-Kriterium Phase 2
> Die vier KI-Features sind live, `ai_consent`-Opt-in-Rate liegt über 40%, kein KI-Feature blockiert je einen Kern-Flow, die Phase-2-Erfolgsmetriken sind erreicht.

---

## Phase 3 · Intelligente Schicht (ab Monat 9)

**Ziel**: Die anspruchsvolleren KI-Features aus PRD §14 mit höherem Trainings- und Validierungsaufwand.

**3.1** Verletzungs-Risiko-Indikator. **MDR-Disclaimer** prominent: keine Diagnose, kein Medizinprodukt im Sinne der EU-Verordnung. Vor Launch: rechtliche Einschätzung einholen.
**3.2** Wettkampf-Tapering-Assistent. LLM schlägt Plan-Anpassungen 7 Tage vor Wettkampf vor.
**3.3** Smart Notifications. Adaptiver Reminder-Zeitpunkt basierend auf historischem Tracking-Verhalten.
**3.4** Natural Language Tracking. Athlet diktiert, LLM mappt auf strukturierte Felder. Confirmation-UI vor Speichern.

### Done-Kriterium Phase 3
> Alle vier Features sind live, der Verletzungs-Risiko-Indikator hat eine dokumentierte False-Positive-Rate, MDR-Einschätzung liegt schriftlich vor.

---

## Phase 4+ · Vision-Layer (ab Monat 15)

**4.1** Form-Validation per Vision (Webcam-Push-up-Erkennung). Eigenes Modell oder Vision-API. Datenschutz-aufwändig — separates DPIA Pflicht.
**4.2** Wearable-Integrationen (HealthKit, Google Fit, Garmin) als optionale Datenquelle.
**4.3** Coach-Marketplace: verifizierte Coaches, Trial-Engagements, Rating.
**4.4** Vereins-/Team-Funktionen.

Diese Phase ist bewusst offen formuliert. Konkrete Schritte werden festgelegt, wenn Phase 3 stabil ist und die Geschäftszahlen tragen.

---

## Querschnitt: Was in jeder Phase gilt

- **Jeder Sprint endet mit einem Demo-fähigen Stand auf Staging.**
- **Jeder neue Feature-PR enthält Tests** (siehe CLAUDE.md §4).
- **Migrations sind separate PRs** und werden zuerst auf Staging gegen einen Snapshot der Production-DB getestet.
- **Security-Reviews** sind Pflicht vor jedem Phasen-Ende (Phase 1: Pen-Test, Phase 2: AI-Threat-Modeling, Phase 3: MDR-Assessment).
- **DSGVO-Audit** einmal pro Quartal — auch wenn nichts geändert wurde.
- **Alles, was Anhang A im PRD versprochen hat**, ist Pflicht-Lieferung der jeweiligen Phase. Wenn ein Punkt verschoben wird, dokumentieren — nicht vergessen.

---

## Wenn du als Claude diesen Plan benutzt

1. **Frag nach dem aktuellen Schritt.** „In welchem Sprint und welchem Schritt sind wir gerade?" Ohne diese Info: nicht raten.
2. **Lies den Schritt komplett**, bevor du Code schreibst.
3. **Prüfe Vorbedingungen.** Wenn Schritt 1.16 (CRS-Recovery) verlangt wird, aber 1.15 (CRS-State-Machine) noch nicht existiert: stoppen, melden, vorschlagen die Reihenfolge einzuhalten.
4. **Halte den Scope ein.** Schritt 1.6 ist Tracking-Form. Nicht parallel die Streak-Logik mitbauen — das ist Schritt 1.8.
5. **Markiere Done.** Wenn ein Schritt fertig ist, schlage ein Commit + Update der Roadmap vor (Checkbox setzen oder Datum ergänzen).
