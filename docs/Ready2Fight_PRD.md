---
project: Ready 2 Fight
type: Product Requirements Document
scope: MVP (Phase 1)
stack: Supabase (Postgres + Auth + Storage + Realtime + Edge Functions), PWA frontend
language: de
purpose: |
  Verbindliches Scope-Dokument für den Ready-2-Fight-MVP. Diese Datei dient
  als persistenter Kontext für Claude in Visual Studio Code (z.B. via
  Claude Code oder der Claude-VS-Code-Extension). Sie enthält Vision,
  Personas, Kernkonzepte, Architektur, Datenmodell, Sicherheits- und
  DSGVO-Vorgaben, Erfolgsmetriken, KI-Roadmap (Phase 2+) und Glossar.
hinweise_an_claude:
  - KI-Funktionalitäten (Kapitel 14) sind NICHT Teil des MVP. Beim Coden
    keine LLM-Calls oder ai_*-Tabellen einbauen, außer die ai_consent-Spalte
    als Architektur-Hook.
  - Sicherheit ist Default-Deny: jede neue public.*-Tabelle braucht RLS und
    eine Policy. Coach-Zugriff auf Athletendaten IMMER über die Helper-
    Funktionen is_linked_coach() / is_linked_coach_with_*().
  - Engagement-Codes dürfen niemals eine Empfänger-E-Mail enthalten
    (Stalking-Schutz, siehe Kapitel 03).
  - Daten werden in eu-central-1 gehostet. Keine Drittland-Transfers ohne
    explizite Prüfung.
---

# Ready 2 Fight — Product Requirements Document

> **Combat Ready. By Design.**  Konsolidierter MVP-Scope mit Compliance-Layer und KI-Roadmap.

## 01 · Vision & Zielsetzung

### Vision

Ready 2 Fight ist die zentrale digitale Plattform für Kampfsportler und ihre Trainer. Sie ersetzt die heute übliche Werkzeugmischung aus WhatsApp, Excel-Tabellen, Notiz-Apps und Papierplänen durch eine integrierte Lösung, die Tracking, Leistungsmessung, Trainingsplanung, Wettkampfvorbereitung und Kommunikation an einem Ort bündelt.

### Produktziele

1.  Objektivierung der Kampfbereitschaft über einen standardisierten Fitnesstest (Combat Readiness Score, CRS) mit transparent dokumentierter Formel.

2.  Konsequente Datenhoheit beim Athleten — Coaches sehen ausschließlich, was explizit freigegeben wurde.

3.  Reibungslose Coach-Athlet-Zusammenarbeit durch Engagements, Trainingspläne und Echtzeit-Chat.

4.  Motivation durch Gamification (Ränge, Archetypen, Streaks mit Karenz, Quests).

5.  Compliance by Design — DSGVO-konforme Verarbeitung sensibler Gesundheitsdaten ab Tag 1.

6.  KI-Readiness im Datenmodell — alle KI-Features ab Phase 2 sollen ohne strukturelle Migration ergänzbar sein.

### Nicht-Ziele Mvp

- Keine Wearable-, HealthKit- oder Google-Fit-Integration.

- Kein Video-Coaching, keine Videoanalyse, kein Live-Streaming.

- Keine Community- oder Social-Features (Athlet-zu-Athlet-Chat, öffentliche Leaderboards).

- Keine Marketplace-Funktion (Coach-Buchung, Bezahlung).

- Keine native Mobile-App — nur responsive Web (PWA-fähig).

- Keine medizinische Diagnostik oder Therapieempfehlung.

- Keine KI-Funktionalitäten im MVP — siehe Kapitel 14 für Roadmap.

- Keine Coach-private Notizen im MVP — verschoben aufgrund Joint-Controller-Risiko nach Art. 26 DSGVO.

**Definition of Done MVP**

Der MVP gilt als erfolgreich, wenn nach vier Wochen Live-Betrieb folgende Kriterien gleichzeitig erfüllt sind:

- Mindestens 10 aktive Coaches mit jeweils 3 oder mehr verbundenen Athleten.

- Median der Tracking-Streak über alle aktiven Athleten ≥ 7 Tage.

- Null kritische Sicherheits-Findings.

- Null DSGVO-Beschwerden.

- Weniger als 5 priorisierte Bug-Reports pro Woche.

- Verfügbarkeit ≥ 99,5 % im Live-Zeitraum.

## 02 · Personas

Vier exemplarische Nutzerprofile als Referenz für Produkt- und Designentscheidungen.

| **PERSONA**                    | **BESCHREIBUNG**                                                              | **HAUPTBEDÜRFNIS**                             |
|--------------------------------|-------------------------------------------------------------------------------|------------------------------------------------|
| Lena, 22 — Amateur-Kickboxerin | Trainiert 5×/Woche, plant 3 Wettkämpfe/Jahr. Will Fortschritt messbar machen. | Tracking, CRS, Wettkampfvorbereitung           |
| Marcus, 38 — MMA-Coach         | Betreut 12 Athleten parallel, jongliert Pläne in Excel.                       | Übersicht, strukturierte Plan-Erstellung, Chat |
| Tom, 31 — Pro-Boxer & Trainer  | Eigene Karriere plus 4 Schützlinge.                                           | Rolle Beides — beide Sichten in einer App      |
| Mia, 17 — BJJ-Talent           | Knapp über dem Mindestalter.                                                  | Vereinfachtes Onboarding, klare Datenhoheit    |

## 03 · Kernkonzepte

**Rollenmodell**

Drei Rollen mit klar abgegrenzten Funktionsumfängen: Athlet, Coach, Beides. Die Rolle wird in der Datenbank als Enum gespeichert. Navigation, Dashboard und zugängliche Routen werden serverseitig gefiltert — nicht nur clientseitig.

| **ROLLE** | **WER**                   | **KERNFUNKTIONEN**                                                           |
|-----------|---------------------------|------------------------------------------------------------------------------|
| Athlet    | Aktiver Sportler          | Eigenes Tracking, CRS-Test, Wettkampfplanung, Plan-Ansicht, Chat mit Coach   |
| Coach     | Trainer                   | Athleten-Verwaltung, Plan-Erstellung & -Zuweisung, Wettkampfverwaltung, Chat |
| Beides    | Aktiver Kämpfer + Trainer | Vereint beide Funktionsumfänge in einer Ansicht                              |

**Engagement**

Ein Engagement ist der vertragsähnliche Datensatz, der Coach und Athlet verbindet. Lifecycle: pending → active → (paused) → ended.

Engagement-Codes sind so gestaltet, dass sie keinen Stalking-Vektor öffnen. Code und Empfänger sind entkoppelt:

7.  Coach generiert einen Code ohne Empfänger-E-Mail. Er kann optional einen internen Namen vergeben (nicht sichtbar für Dritte), um ihn in seiner Code-Liste wiederzuerkennen.

8.  Coach teilt den Code dem Athleten persönlich oder über einen externen Kanal mit.

9.  Athlet löst den Code in seinen eigenen Settings ein. Erst dadurch entsteht jegliche Datenverbindung.

10. Wir speichern zu keinem Zeitpunkt fremde E-Mail-Adressen. Der Stalking-Vektor entfällt.

### Eigenschaften

- Eindeutiger, einmal verwendbarer Einladungscode (Format R2F-XXXX-XXXX, 8 alphanumerische Zeichen).

- Code-Lebensdauer 14 Tage, danach automatischer Ablauf.

- Zweck (purpose): general, competition_prep, technique, strength_cond, nutrition, rehab.

- Granulare Berechtigungen: can_see_tracking, can_see_meals, can_see_tests, can_create_plans.

- Aktivierung ausschließlich durch den Athleten (Code-Einlösung). Coach kann ein Engagement nie selbst aktivieren — Privilege-Escalation-Schutz auf Datenbank-Ebene.

- Beendigung jederzeit durch beide Seiten. Trigger entzieht alle Health-Record-Shares automatisch.

- Ein Athlet kann mehrere aktive Engagements haben (mehrere Coaches gleichzeitig, z. B. Striking-Coach + BJJ-Coach).

**Daily Tracking**

Tägliches Selbstauskunftsformular des Athleten.

| **FELD**             | **PFLICHT** | **WERTE**                                               |
|----------------------|-------------|---------------------------------------------------------|
| Schlafqualität       | ja          | gut / mittel / schlecht                                 |
| Körpergewicht (kg)   | ja          | 30–300                                                  |
| Stimmung             | ja          | gut / mittel / schlecht                                 |
| Wasserkonsum (l)     | ja          | 0–10                                                    |
| Körperlicher Zustand | ja          | gut / mittel / schlecht                                 |
| Kalorien (kcal)      | nein        | 0–10.000                                                |
| Aktivitätslevel      | nein        | keine / moderat / hoch / extrem                         |
| Training absolviert  | nein        | bool; bei true zusätzlich RPE 1–10 und Dauer in Minuten |
| Muskelkater          | nein        | bool; bei true Körperregion                             |

### Streak-Mechanik (Gehärtet)

Alle Pflichtfelder eines Tages ausgefüllt erhöhen die Streak um 1. Wird ein Tag verpasst, wird die Streak nicht sofort zurückgesetzt, sondern gilt als pausiert. Trackt der Athlet innerhalb von 48 Stunden nach, läuft die Streak nahtlos weiter (Karenz). Erst nach mehr als 48 Stunden ohne Tracking fällt sie auf 0. Nachträgliches Auffüllen weiter zurückliegender Tage erhöht die Streak nicht — anti-gaming.

### Abgeleiteter Wert: Srpe

Wenn Training, Dauer und RPE für einen Tag erfasst sind, berechnet das System automatisch sRPE = RPE × Dauer (in Minuten). sRPE ist die in der Trainingswissenschaft etablierte Maßeinheit für die interne Belastung. Der Wert ist im Datenmodell eine generated column; der Athlet sieht ihn im Verlauf, der Coach in der Athleten-Detailansicht.

**Combat Readiness Score (CRS)**

Standardisierter Fitnesstest zur Messung der körperlichen Grundfitness im Kampfsportkontext. Fünf Übungen, jeweils 60 Sekunden.

| **\#** | **ÜBUNG**  | **MESSGRÖSSE**         | **FÄHIGKEIT**           |
|--------|------------|------------------------|-------------------------|
| 1      | Burpees    | Wiederholungen         | Ganzkörperausdauer      |
| 2      | Air Squats | Wiederholungen         | Beinkraft, Explosivität |
| 3      | Push-ups   | saubere Wiederholungen | Oberkörperkraft         |
| 4      | Plank Hold | Sekunden (max. 60)     | Rumpfstabilität         |
| 5      | High Knees | Bodenkontakte          | Cardio, Schnelligkeit   |

> **TRANSPARENZ-HINWEIS IM PRODUKT**  
> *Der CRS misst kampfsportrelevante Grundfitness, keine disziplinspezifische Kampfbereitschaft. Disziplinspezifische Tests folgen in Phase 2. Die genaue Berechnungsformel ist in Anhang B dieses Dokuments und in der App unter Hilfe → CRS-Methodik öffentlich einsehbar.*

### Ranking-System

| **RANG** | **CRS** | **NAME**       |
|----------|---------|----------------|
| S        | 95–100  | Shadow Monarch |
| A        | 80–94   | Hunter Elite   |
| B        | 65–79   | Rising Fighter |
| C        | 50–64   | Contender      |
| D        | 35–49   | Recruit        |
| E        | \<35    | Awakening      |

Archetypen: Tank, Assassin, Guardian, Berserker, Rookie — abgeleitet aus dem Stärkenprofil der fünf Einzelwerte.

### Test-Workflow

Disclaimer (gesundheitliche Eignung) → Warm-up (3×60 s) → Test (5×60 s) → Cool-down (2 min) → Ergebnis (Rang, Radar-Chart, Archetyp, Quest-Empfehlungen). Validierung serverseitig: jeder Übungswert muss in einem plausiblen Bereich liegen; bei mehr als einer Null-Übung gilt der Test als ungültig. CRS-Verlauf wird im Athletenprofil als Line-Chart über die letzten 12 Tests dargestellt.

**Trainingspläne**

Hierarchie: Plan → Sessions → Übungen. Bei der Zuweisung erstellt das System eine vollständige Kopie des Plans pro Athlet — spätere Änderungen am Originalplan beeinflussen zugewiesene Pläne nicht. Voraussetzungen: aktives Engagement und can_create_plans = true.

Templates sind read-only. Coaches können sie über die Funktion "Als meinen Plan kopieren" als personalisierbaren Coach-eigenen Plan duplizieren und dann frei bearbeiten. Bulk-Updates über mehrere zugewiesene Pläne sind Phase 2.

**Wettkämpfe**

Athletenseitig anlegbar; vom Coach (mit Berechtigung) ebenfalls. Pflichtfelder: Name, Sportart, Verband, Ort, Datum. Optional: Gewichtsklasse, Rundenanzahl/-dauer, Pause, Notizen. Anstehende Events mit Countdown, vergangene ausgegraut.

**Chat**

1:1-Echtzeit-Chat zwischen Coach und Athlet. Voraussetzung: aktives Engagement. Maximale Nachrichtenlänge 2.000 Zeichen. Realtime-Subscription nur aktiv, wenn der Chat-Tab geöffnet ist (Realtime-Skalierungs-Hygiene). Konversationsliste nutzt normales Polling. Kein Gruppen-, Broadcast- oder Athlet-zu-Athlet-Chat im MVP. Historie bleibt nach Engagement-Ende lesbar; neue Nachrichten gesperrt; nach 12 Monaten Anonymisierung.

**Gesundheitsakten — Phase 2**

Athlet dokumentiert Verletzungen, Allergien, Medikamente. Freigabe an Coach pro Akte einzeln, jederzeit widerrufbar. Bei Engagement-Ende automatischer Trigger-basierter Widerruf.

## 04 · Funktionsumfang nach Rolle

**Funktionsmatrix**

| **FUNKTION**                              | **ATHLET** | **COACH** | **BEIDES** |
|-------------------------------------------|------------|-----------|------------|
| Eigenes Athleten-Dashboard                | ✓          | —         | ✓          |
| Coach-Dashboard mit Wochenkalender        | —          | ✓         | ✓          |
| Daily Tracking (offline-fähig)            | ✓          | —         | ✓          |
| CRS-Fitnesstest durchführen               | ✓          | —         | ✓          |
| CRS-Verlaufsdiagramm                      | ✓          | lesend    | ✓          |
| Eigene Wettkämpfe anlegen                 | ✓          | —         | ✓          |
| Wettkämpfe für Athleten anlegen           | —          | ✓         | ✓          |
| Trainingspläne einsehen                   | ✓          | ✓         | ✓          |
| Trainingspläne erstellen & zuweisen       | —          | ✓         | ✓          |
| Templates kopieren & personalisieren      | —          | ✓         | ✓          |
| Athleten einladen / verwalten             | —          | ✓         | ✓          |
| Athleten-Detailansicht (mit Berechtigung) | —          | ✓         | ✓          |
| Mehrere Coaches verwalten                 | ✓          | —         | ✓          |
| Chat mit Coach                            | ✓          | —         | ✓          |
| Chat mit Athleten                         | —          | ✓         | ✓          |
| Coach-Code einlösen                       | ✓          | —         | ✓          |
| Einladungscode generieren                 | —          | ✓         | ✓          |
| Daten-Export (DSGVO Art. 20)              | ✓          | ✓         | ✓          |
| Self-Service-Kontolöschung                | ✓          | ✓         | ✓          |

**Athleten-Dashboard**

CRS-Karte mit Rang und farbigem Glow, nächster Wettkampf mit Countdown, Tracking-Streak, heutiges Tracking inline editierbar, 7-Tage-Übersicht, aktiver Trainingsplan. Empty State für neue Athleten ohne CRS: zentraler Call-to-Action zum ersten Test mit einem Satz Erklärung.

**Coach-Dashboard**

Anzahl aktiver Athleten, nächstes Event über alle Athleten, Quick-Link zur Plan-Verwaltung, Wochenkalender mit Athleten in Zeilen und Tagen in Spalten (Punkte für getrackt, Plan-Session, Wettkampf), Liste auffälliger Athleten der letzten 7 Tage. Empty State: Anleitung zum Generieren des ersten Codes plus Hinweis auf Test-Account-Möglichkeit.

**Athleten-Detailansicht (Coach)**

Letzter CRS mit Rang, Score, Archetyp und fünf Einzelwerten, CRS-Verlaufsdiagramm, Tracking-Streak, 7-Tage-Tracking-Tabelle, sRPE-Verlauf, Direkt-Chat-Button. Sichtbarkeit jeder Sektion abhängig von der jeweiligen Berechtigung.

## 05 · Onboarding

> **MINDESTALTER**  
> *Das Mindestalter für die Nutzung von Ready 2 Fight liegt bei 16 Jahren. Diese Festlegung folgt Art. 8 DSGVO und vermeidet einen verpflichtenden Parental-Consent-Workflow. Die Altersangabe wird beim Onboarding abgefragt; Geburtsdaten unter 16 Jahren werden abgewiesen.*

**Athlet**

11. Registrierung mit E-Mail und Passwort.

12. Aktive Zustimmung zur Datenschutzerklärung und zu den Nutzungsbedingungen via Pflicht-Häkchen (kein Implizit-Consent).

13. Rolle Athlet wählen.

14. E-Mail-Verifizierung (Pflicht).

15. Profil: Geburtsdatum (≥ 16), Geschlecht, Größe, Gewicht.

16. Sportarten: ein primärer, ein sekundärer (aus 15).

17. Aktivitätslevel.

18. Tutorial: 4 Slides (Dashboard, Tracking, CRS, Wettkämpfe).

19. Weiterleitung zum Dashboard.

**Coach**

20. Schritte 1–4 wie Athlet, Rolle Trainer.

21. Profil vereinfacht: Name, Basis-Infos.

22. Tutorial: 3 Slides (Athleten, Pläne, Chat).

23. Weiterleitung zum Trainer-Dashboard.

## 06 · Architektur

**Tech-Stack**

| **SCHICHT**   | **TECHNOLOGIE**                        | **ZWECK**                             |
|---------------|----------------------------------------|---------------------------------------|
| Frontend      | Next.js (React) auf Vercel             | UI, SSR, Edge-Auslieferung, PWA       |
| Backend / API | Supabase (PostgREST)                   | API, Auth, RLS                        |
| Datenbank     | PostgreSQL via Supabase (eu-central-1) | Persistenz, Trigger, RPC              |
| Auth          | Supabase Auth (JWT, bcrypt)            | Anmeldung, Sessions, Re-Auth          |
| Realtime      | Supabase Realtime                      | Chat (lazy subscription)              |
| Storage       | Supabase Storage                       | Gesundheitsdokumente Phase 2          |
| Hosting       | Vercel                                 | CDN, TLS, DDoS-Schutz                 |
| Offline-Cache | IndexedDB via Workbox                  | Daily-Tracking-Queue offline          |
| i18n          | next-intl                              | String-Extraktion, DE only zum Launch |

**Datenfluss**

Browser ⇄ Vercel-Edge ⇄ Supabase-API ⇄ PostgreSQL. Jeder Request: TLS in Transit, AES-256 at Rest, RLS-Filterung vor Datenrückgabe. Keine ungeschützten Pfade. Offline geschriebene Tracking-Einträge werden via IndexedDB-Queue bei Wiederverbindung synchronisiert; serverseitige Upserts gegen den Unique Constraint (athlete_id, date) machen den Sync idempotent.

**Umgebungsvariablen**

| **VARIABLE**                  | **SICHTBARKEIT** | **ZWECK**                         |
|-------------------------------|------------------|-----------------------------------|
| NEXT_PUBLIC_SUPABASE_URL      | öffentlich       | Projekt-URL                       |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | öffentlich       | API-Key, RLS-gefiltert            |
| SUPABASE_SERVICE_ROLE_KEY     | nur Server       | Voll-Rechte für Server-Funktionen |

## 07 · Datenmodell

Vereinfachte Übersicht der Kerntabellen. Alle Tabellen verfügen über created_at und updated_at sowie aktivierte Row-Level Security.

| **TABELLE**          | **SCHLÜSSELFELDER**                                                                                                                                      | **STATUS** |
|----------------------|----------------------------------------------------------------------------------------------------------------------------------------------------------|------------|
| users                | id, email, role, deleted_at, anonymized                                                                                                                  | Kern       |
| athlete_profiles     | user_id, dob, gender, height, weight, primary_sport, secondary_sport, activity_level                                                                     | Kern       |
| coach_profiles       | user_id, name, bio                                                                                                                                       | Kern       |
| engagements          | id, coach_id, athlete_id, status, purpose, invite_code, code_expires_at, internal_label, can_see\_\*, started_at, ended_at                               | gehärtet   |
| daily_tracking       | id, athlete_id, date, sleep, weight, mood, water, condition, calories, activity, trained, rpe, duration_min, srpe (generated), soreness, soreness_region | gehärtet   |
| fitness_tests        | id, athlete_id, date, burpees, squats, pushups, plank_s, high_knees, crs, rank, archetype, valid                                                         | Kern       |
| crs_norms            | exercise, base_target, weight_factor_curve, age_factor_curve, gender_factor                                                                              | neu        |
| training_plans       | id, owner_coach_id, title, description, status, start_date, end_date                                                                                     | Kern       |
| plan_sessions        | id, plan_id, title, type, scheduled_at, duration_min                                                                                                     | Kern       |
| plan_exercises       | id, session_id, name, sets, reps, duration_s, weight_kg, rest_s, notes                                                                                   | Kern       |
| assigned_plans       | id, source_plan_id, athlete_id, assigned_by, assigned_at, archived_at                                                                                    | Kern       |
| competitions         | id, athlete_id, name, sport, federation, location, date, weight_class, rounds, round_duration, rest_duration, notes                                      | Kern       |
| chat_messages        | id, engagement_id, sender_id, content, sent_at, anonymized_at                                                                                            | Kern       |
| audit_log            | id, event_type, actor_id, target_id, metadata, created_at                                                                                                | neu        |
| account_deletions    | user_id, requested_at, scheduled_for, executed_at                                                                                                        | neu        |
| health_records       | id, athlete_id, category, title, severity, status, document_url, created_at                                                                              | Phase 2    |
| health_record_shares | id, record_id, coach_id, granted_at, revoked_at                                                                                                          | Phase 2    |

## 08 · Sicherheit

Technische und organisatorische Maßnahmen nach Art. 32 DSGVO. Die Härtungen aus dem Perspektiven-Review sind in diesem Kapitel integriert.

**Schutzmaßnahmen**

| **KATEGORIE**         | **MASSNAHME**                                                                             |
|-----------------------|-------------------------------------------------------------------------------------------|
| Verschlüsselung       | TLS in Transit, AES-256 at Rest                                                           |
| Authentifizierung     | E-Mail-Verifizierung, bcrypt-Hashing, JWT-Sessions (1h Access, 14d Refresh)               |
| Re-Auth               | Passwort-Eingabe bei sensiblen Aktionen: Konto löschen, E-Mail ändern, Engagement beenden |
| Autorisierung         | Row-Level Security auf allen Tabellen, granulare Engagement-Berechtigungen                |
| RLS-Helper-Funktionen | is_linked_coach(), is_linked_coach_with_tracking(), can_coach_see_health_record()         |
| Server-Funktionen     | Einladungscode-Generierung als SECURITY DEFINER RPC                                       |
| Stalking-Schutz       | Codes ohne empfänger-spezifische E-Mail; Aktivierung nur durch Athlet                     |
| Trigger               | Engagement-End-Trigger entzieht alle Health-Record-Shares automatisch                     |
| Audit-Logging         | Append-only-Tabelle für 8 sicherheitsrelevante Events, 12 Monate Aufbewahrung             |
| Backups               | Tägliche Backups, Point-in-Time Recovery 7 Tage                                           |
| Disaster Recovery     | RTO 4h, RPO 24h, dokumentiertes Restore-Runbook im Repo                                   |

**Audit-Log-Events**

Acht Event-Typen werden geloggt — bewusst minimal, um Pflege und Datenschutz im Gleichgewicht zu halten:

- login_success — erfolgreicher Login mit Zeitstempel und Geo-grobem Marker

- login_failure — fehlgeschlagener Login (für Brute-Force-Erkennung)

- password_change — Passwortänderung

- engagement_created — Coach generiert Code

- engagement_activated — Athlet löst Code ein

- engagement_ended — Beendigung durch eine der Seiten

- permission_changed — Änderung an can_see\_\*-Feldern eines Engagements

- account_deleted — Self-Service-Löschung wurde ausgeführt

**Bedrohungsmodell (OWASP Top 10)**

| **BEDROHUNG**           | **RISIKO** | **GEGENMASSNAHME**                                            |
|-------------------------|------------|---------------------------------------------------------------|
| Unbefugter Datenzugriff | hoch       | Row-Level Security                                            |
| Passwort-Diebstahl      | hoch       | bcrypt + E-Mail-Verifizierung, Re-Auth bei sensiblen Aktionen |
| Session-Hijacking       | mittel     | Kurzlebige JWT-Tokens                                         |
| SQL Injection           | mittel     | Parametrisierte Queries (PostgREST)                           |
| Cross-Site Scripting    | mittel     | React-Auto-Escaping, geplante CSP                             |
| Privilege Escalation    | hoch       | Server-validierte Status-Übergänge, Athlet-only-Aktivierung   |
| Brute Force             | mittel     | Supabase Rate Limiting + Audit-Log-Tracking                   |
| Stalking via Engagement | mittel     | Codes ohne empfänger-E-Mail                                   |
| Man-in-the-Middle       | hoch       | TLS überall                                                   |
| DDoS                    | mittel     | Vercel CDN-Schutz                                             |
| Datenverlust            | mittel     | Backups + Point-in-Time Recovery                              |

**Pre-Launch-Checkliste Sicherheit**

| **MASSNAHME**                                  | **PRIORITÄT** | **STATUS** |
|------------------------------------------------|---------------|------------|
| Server-seitige Input-Validierung (alle Felder) | kritisch      | MVP        |
| Audit-Logging implementiert                    | kritisch      | MVP        |
| Re-Auth bei sensiblen Aktionen                 | kritisch      | MVP        |
| RLS-Test-Suite (≥ 20 Tests) im CI              | kritisch      | MVP        |
| Trigger-Tests im CI                            | kritisch      | MVP        |
| Penetrationstest                               | hoch          | vor Launch |
| Dependency-Scanning (Dependabot)               | mittel        | MVP        |
| Content Security Policy Header                 | mittel        | vor Launch |
| Zwei-Faktor-Authentifizierung (TOTP)           | mittel        | Phase 2    |
| CAPTCHA bei wiederholtem Login-Fehlversuch     | mittel        | Phase 2    |
| Secret-Rotation-Automation                     | niedrig       | Phase 2    |

## 09 · Datenschutz (DSGVO)

**Rechtsgrundlagen**

| **ARTIKEL**                               | **ANWENDUNGSFALL**                                                              |
|-------------------------------------------|---------------------------------------------------------------------------------|
| Art. 6 (1) b — Vertragserfüllung          | Registrierung, Dashboard, Tracking-Speicherung, CRS-Berechnung, Plan-Verwaltung |
| Art. 6 (1) a — Einwilligung               | Optionale Coach-Datenfreigaben                                                  |
| Art. 9 (2) a — Ausdrückliche Einwilligung | Verarbeitung von Gesundheitsdaten                                               |
| Art. 6 (1) f — Berechtigtes Interesse     | Audit-Logging, Betrugserkennung, Fehleranalyse                                  |

**Verzeichnis der Verarbeitungstätigkeiten**

| **TÄTIGKEIT**              | **DATENKATEGORIEN**                                  | **RECHTSGRUNDLAGE** | **AUFBEWAHRUNG**               |
|----------------------------|------------------------------------------------------|---------------------|--------------------------------|
| Registrierung & Auth       | E-Mail, Name, Passwort-Hash, Rolle                   | Art. 6 (1) b        | bis Kontolöschung              |
| Athleten-Profil            | DOB, Geschlecht, Größe, Gewicht, Sportarten          | 6 (1) b, 9 (2) a    | bis Kontolöschung              |
| Daily Tracking             | Schlaf, Gewicht, Stimmung, Wasser, Zustand, Training | 6 (1) b, 9 (2) a    | 24 Monate, dann Anonymisierung |
| Fitness-Test               | Testergebnisse, CRS, Rang, Archetyp                  | 6 (1) b, 9 (2) a    | bis Kontolöschung              |
| Engagements                | IDs, Code, Status, Berechtigungen                    | Art. 6 (1) b        | bis Beendigung + 6 Monate      |
| Trainingspläne             | Plan-Details, Sessions, Übungen                      | Art. 6 (1) b        | bis Löschung durch Ersteller   |
| Chat                       | Inhalt, Zeitstempel, Sender/Empfänger                | Art. 6 (1) b        | 12 Monate nach Engagement-Ende |
| Audit-Log                  | Event, Actor, Target, Metadata                       | Art. 6 (1) f        | 12 Monate                      |
| Gesundheitsakten (Phase 2) | Kategorie, Titel, Schweregrad, Dokument              | Art. 9 (2) a        | bis Widerruf                   |

**Betroffenenrechte — vollständig im MVP**

| **RECHT**                 | **ARTIKEL** | **UMSETZUNG**                                                              |
|---------------------------|-------------|----------------------------------------------------------------------------|
| Auskunft                  | 15          | Datenexport-Endpoint                                                       |
| Berichtigung              | 16          | In-App-Bearbeitung von Profil & Tracking                                   |
| Löschung                  | 17          | Self-Service mit 14-Tage-Grace-Period                                      |
| Einschränkung             | 18          | Auf Anfrage via Support                                                    |
| Datenübertragbarkeit      | 20          | JSON-Export aller eigenen Daten als Download                               |
| Widerspruch               | 21          | Auf Anfrage via Support                                                    |
| Widerruf der Einwilligung | 7 (3)       | Berechtigungen deaktivieren oder Engagement beenden — Trigger wirkt sofort |

**Kontolöschung im Detail**

Self-Service-Löschung mit doppelter Bestätigung (DELETE eintippen) und 14-tägiger Grace-Period. Während der Grace-Period ist das Konto deaktiviert (kein Login möglich), die Daten existieren aber noch. Ein Cron-Job führt die Hard-Deletion nach Ablauf aus.

### Anonymisierungs-Strategie

Vollständiges Hard-Delete würde Foreign-Key-Beziehungen zerstören (Coach hat Chat mit gelöschtem Athleten). Stattdessen: Tracking, Tests, Pläne, Profildaten werden gelöscht. Der users-Datensatz wird zu deleted_user\_\<uuid\> mit email = NULL und name = "Gelöschter Nutzer". Chat-Nachrichten bleiben mit anonymisiertem Sender lesbar. Personenbezug ist entfernt — DSGVO-konform.

**Auftragsverarbeitung**

| **DIENSTLEISTER** | **ZWECK**                          | **STANDORT**                                       | **AVV-STATUS** |
|-------------------|------------------------------------|----------------------------------------------------|----------------|
| Supabase Inc.     | Datenbank, Auth, Realtime, Storage | EU (eu-central-1, Frankfurt) — vertraglich fixiert | vor Launch     |
| Vercel Inc.       | Hosting, CDN                       | EU-Region erzwungen                                | vor Launch     |

Beide Anbieter sind US-Unternehmen. Standardvertragsklauseln (SCCs) und EU-US Data Privacy Framework müssen vor Go-Live vertraglich abgesichert werden.

**DSFA — Risikobewertung**

| **RISIKO**                          | **WAHRSCHEINLICHKEIT** | **SCHWERE** | **MASSNAHME**                                                     |
|-------------------------------------|------------------------|-------------|-------------------------------------------------------------------|
| Unbefugter Zugriff Gesundheitsdaten | niedrig                | hoch        | RLS, AES-256, granulare Berechtigungen                            |
| Datenverlust                        | niedrig                | hoch        | Tägliche Backups, PITR, dokumentiertes Restore-Runbook            |
| Zweckentfremdung durch Coach        | mittel                 | mittel      | Granulare Berechtigungen, Widerruf jederzeit                      |
| Profiling-Risiko (CRS)              | niedrig                | mittel      | Nur Trainingsoptimierung, keine Rechtsfolgen, transparente Formel |
| Stalking via Engagement             | niedrig                | mittel      | Codes ohne empfänger-E-Mail                                       |
| Datenabfluss an Dritte              | niedrig                | hoch        | Keine Drittweitergabe außer Auftragsverarbeitern                  |

**Löschkonzept**

| **EREIGNIS**                                  | **AKTION**                                                       |
|-----------------------------------------------|------------------------------------------------------------------|
| Konto gelöscht                                | Hard-Delete der Daten, Anonymisierung des users-Datensatzes      |
| Engagement endet                              | Coach-Zugriff sofort entzogen via Trigger, Athletendaten bleiben |
| Tracking älter als 24 Monate                  | Automatische Anonymisierung in daily_tracking_archive            |
| Chat älter als 12 Monate nach Engagement-Ende | Anonymisierung der Sender-IDs                                    |
| Audit-Log älter als 12 Monate                 | Hard-Delete via monatlichem Cron                                 |
| Gesundheitsakte widerrufen (Phase 2)          | revoked_at gesetzt, Coach-Zugriff entzogen                       |
| Inaktivität                                   | Nach 24 Monaten Hinweis, nach 36 Monaten Löschung                |

## 10 · Besondere Aspekte

**Coach-Athlet-Datenfluss**

| **DATENTYP**                                   | **BERECHTIGUNG**           |
|------------------------------------------------|----------------------------|
| Daily Tracking (7 Tage rollierend)             | can_see_tracking           |
| Fitness-Test (CRS, Rang, Einzelwerte, Verlauf) | can_see_tests              |
| Ernährung (Phase 2)                            | can_see_meals              |
| Gesundheitsakten (Phase 2)                     | separate Freigabe pro Akte |

Vom Coach zum Athleten: Trainingspläne (mit can_create_plans), Chat-Nachrichten.

**Mehrere Coaches pro Athlet**

Ein Athlet kann beliebig viele aktive Engagements gleichzeitig haben (z. B. Striking-Coach plus BJJ-Coach). Im Athleten-Settings-Screen erscheint eine Liste "Deine Coaches" mit Beenden-Button pro Coach. Jeder Coach sieht ausschließlich Daten gemäß seiner eigenen Engagement-Berechtigungen — andere Coaches sind füreinander unsichtbar.

**Engagement-Ende**

24. Alle Berechtigungen werden auf false gesetzt.

25. Health-Record-Shares erhalten revoked_at.

26. Coach verliert sofort jeglichen Zugriff.

27. Bereits zugewiesene Pläne bleiben beim Athleten erhalten.

28. Chat-Verlauf bleibt 12 Monate lesbar, neue Nachrichten gesperrt.

29. audit_log-Eintrag engagement_ended wird erzeugt.

**Cookies & Tracking**

Nur technisch notwendige Session-Cookies. Kein Werbe-Tracking. Bei späterer Einbindung von Analytics (z. B. Plausible) Cookie-Banner mit Opt-in.

**Offline-Verhalten**

Nur das Daily-Tracking ist offline-fähig. Bei fehlender Verbindung wird der Submit lokal in IndexedDB gequeued (Workbox) und bei Wiederverbindung gesynct. Alle anderen Funktionen zeigen ein Offline-Banner und sind deaktiviert. Reicht für die Realität im Gym.

**Accessibility — MVP-Minimum**

- Alle interaktiven Elemente sind keyboard-erreichbar.

- Kontrastverhältnis ≥ 4.5:1 (durch das monochrome Design erfüllt).

- Alt-Texte auf allen Bildern, Form-Labels korrekt verknüpft.

- Lighthouse-Accessibility-Score ≥ 90 als CI-Pflicht.

- Vollständige WCAG 2.1 AA Konformität ist Phase 2.

**Notifications — drei Trigger**

| **TRIGGER**                                                    | **KANAL**     | **FREQUENZ**                             |
|----------------------------------------------------------------|---------------|------------------------------------------|
| Tracking-Reminder bei fehlendem Eintrag bis 20:00 lokaler Zeit | E-Mail        | max. 1× pro Tag, im Profil deaktivierbar |
| Neue Chat-Nachricht                                            | E-Mail-Digest | max. 1× pro Stunde                       |
| Neuer Trainingsplan zugewiesen                                 | E-Mail        | bei jedem Ereignis                       |

Push-Notifications, In-App-Notification-Center und adaptiver Reminder-Zeitpunkt sind Phase 2.

## 11 · Erfolgsmetriken

**Aktivierung**

- Anteil registrierter Athleten, die Onboarding abschließen — Ziel ≥ 80 %.

- Anteil Athleten, die innerhalb 7 Tagen den ersten CRS absolvieren — Ziel ≥ 50 %.

**Engagement**

- D7- / D30-Retention bei Athleten — Ziel ≥ 40 % bzw. ≥ 25 %.

- Durchschnittliche Tracking-Streak nach 30 Tagen — Ziel ≥ 14 Tage.

- Anteil Athleten mit aktivem Coach-Engagement — Ziel ≥ 35 %.

**Coach-Seite**

- Durchschnittliche Athleten pro aktivem Coach — Ziel ≥ 5.

- Anteil Coaches, die mindestens einen Plan pro Monat zuweisen — Ziel ≥ 70 %.

**Qualität & Trust**

- P95-API-Latenz unter 400 ms.

- Verfügbarkeit ≥ 99,5 % im MVP, ≥ 99,9 % ab Phase 2.

- Kritische Security-Findings: 0.

- DSGVO-Beschwerden: 0.

- Lighthouse Accessibility Score ≥ 90.

## 12 · Go-to-Market

**Strategische Grundausrichtung**

Coach-first. Ein Coach bringt 5–20 Athleten in das Produkt. Akquise ist daher fokussiert auf Trainer, nicht auf Einzelsportler. Athleten kommen als Folge.

**Akquise-Kanäle MVP**

30. Direktansprache von 30 ausgewählten Kampfsport-Coaches im DACH-Raum (Boxen, Kickboxen, MMA, BJJ).

31. Verbands-Partnerschaftsangebote (z. B. WAKO Deutschland, German MMA Federation) — kostenfreie Nutzung gegen Logo-Platzierung.

32. Instagram-Content-Marketing rund um die CRS-Mechanik. Jeder Test ist ein Story-fähiges Format ("Welcher Archetyp bist du?").

33. Empfehlungs-Mechanik: jeder Coach hat einen referral-Link, der den Code-Generierungs-Flow vorausfüllt.

**Pricing MVP**

Komplett kostenlos. Begründung: Wir brauchen Daten, Trust und Use-Case-Validierung, nicht Umsatz. Das Datenmodell enthält im MVP keine subscriptions-Tabelle; Pricing-Logik wird in Phase 2 um die engagements-Tabelle herum gebaut.

**Pricing Phase 2**

| **PLAN**     | **ZIELGRUPPE** | **PREIS**  | **LIMIT**                      |
|--------------|----------------|------------|--------------------------------|
| Athlete      | Einzelnutzer   | kostenlos  | unbegrenzt eigene Daten        |
| Trainer      | Coaches        | 19 €/Monat | unbegrenzte Athleten ab dem 6. |
| Trainer Lite | Hobby-Coaches  | kostenlos  | bis zu 5 Athleten              |

## 13 · Konkurrenz-Mapping

Vergleich von Ready 2 Fight mit den heute am Markt etablierten Werkzeugen.

| **KRITERIUM**                    | **R2F**          | **TRAININGPEAKS** | **TRAINERIZE** | **EXCEL/WHATSAPP** |
|----------------------------------|------------------|-------------------|----------------|--------------------|
| Kampfsport-spezifisch            | ✓                | —                 | —              | —                  |
| CRS / Combat Score               | ✓                | —                 | —              | —                  |
| Daily Tracking integriert        | ✓                | ✓                 | ✓              | mühsam             |
| Coach-Athlet-Chat                | ✓                | eingeschränkt     | ✓              | getrennt           |
| Wettkampfverwaltung              | ✓                | eingeschränkt     | —              | —                  |
| Granulare Berechtigungen         | ✓                | —                 | eingeschränkt  | —                  |
| DSGVO-konformer Hosting-Standort | ✓ (EU)           | US                | US             | n/a                |
| Kostenpunkt                      | kostenlos im MVP | 19–49 USD         | 5–349 USD      | kostenlos          |

Verteidigungsfähigkeit (Moat): Kampfsport-spezifische Domain-Tiefe (CRS, Wettkampf-Modell, Engagement-Mechanik), DSGVO-First-Architektur und mittelfristig die KI-Layer aus Kapitel 14, die auf einer kampfsport-spezifischen Datenbasis trainiert/promptet werden — etwas, das generische Trainings-Plattformen ohne Pivot nicht replizieren können.

## 14 · KI-Funktionalitäten

> **WICHTIG**  
> *KI-Funktionalitäten sind explizit nicht Teil des MVP. Dieses Kapitel verankert sie konzeptionell, damit Datenmodell und Architektur sie ohne strukturelle Migration aufnehmen können. Die erste KI-Funktion ist für Phase 2 vorgesehen.*

**Leitprinzipien**

34. Augmentation, nicht Ersatz. KI unterstützt Coach und Athlet, ersetzt aber keine Trainerentscheidung. Jede KI-Ausgabe ist als Empfehlung gekennzeichnet.

35. Privacy first. Nutzerdaten werden niemals ohne ausdrückliche Opt-in-Einwilligung zum Training externer Modelle verwendet. Alle KI-Calls laufen über Anthropic, OpenAI oder Mistral als Auftragsverarbeiter mit DPA — kein Modell-Training auf unseren Daten.

36. On-demand statt Auto-Pilot. KI-Funktionen werden vom Nutzer aktiv ausgelöst, nie still im Hintergrund. Ausnahme: anonymisierte Aggregat-Analysen (siehe unten).

37. Erklärbarkeit. Jede KI-Empfehlung kommt mit einer kurzen "Warum?"-Begründung in natürlicher Sprache.

38. Cost-aware. LLM-Calls sind teuer. Features mit hohem Volumen (Notifications, Triggers) nutzen kleinere Modelle oder regelbasierte Vorfilter.

39. Halluzinations-resistent. Bei medizinisch oder sicherheitsrelevanten Themen (Verletzungen, Schmerz) eskaliert die KI an einen menschlichen Hinweistext, nie an freie Generierung.

40. Graceful Degradation. Fällt ein LLM-Call aus (Timeout, Rate-Limit, Cost-Cap, Provider-Outage), zeigt die UI einen klaren Hinweis („KI gerade nicht verfügbar“) und lässt den Nutzer manuell fortfahren. Keine KI-Funktion darf ein Kern-Flow blockieren.

41. Modell-agnostisch. Konkrete Modellnamen (Claude Haiku, GPT-4o-mini etc.) sind Implementierungsdetail. Die Abstraktionsschicht muss Modellwechsel ohne Schema-Änderung erlauben.

**Feature-Roadmap KI**

Die folgende Tabelle skizziert die geplanten KI-Funktionen mit Phase und Implementierungs-Strategie. Sie ist nicht erschöpfend, dient aber als Anker für Architektur-Entscheidungen.

| **FEATURE**                        | **PHASE** | **STRATEGIE**                                                                                                                               |
|------------------------------------|-----------|---------------------------------------------------------------------------------------------------------------------------------------------|
| Tracking-Insights                  | 2         | Wöchentliche LLM-generierte Zusammenfassung der Tracking-Daten ("Du hast nach Sparring-Tagen schlechter geschlafen"). On-demand pro Athlet. |
| Coach Co-Pilot                     | 2         | Chat-Assistent im Coach-Dashboard ("Welche Athleten brauchen diese Woche Aufmerksamkeit?"). LLM mit RAG über Coach-eigene Daten.            |
| Plan-Generator                     | 2         | Coach gibt Ziel und Constraints ein, KI generiert Plan-Entwurf, den der Coach editiert und zuweist. Mensch-im-Loop.                         |
| Athleten-Briefing                  | 2         | Wöchentliche automatische Zusammenfassung für Athleten mit Trends und Quest-Vorschlägen.                                                    |
| Verletzungs-Risiko-Indikator       | 3         | Mustererkennung über Schlaf, sRPE, Stimmung. Score 0–100. Vorsichtig kommuniziert ("erhöhter Hinweis"), keine Diagnose.                     |
| Wettkampf-Tapering-Assistent       | 3         | Vor anstehendem Wettkampf schlägt die KI Plan-Anpassungen vor (Belastungsreduktion in den letzten 7 Tagen).                                 |
| Smart Notifications                | 3         | Adaptiver Reminder-Zeitpunkt basierend auf historischem Tracking-Verhalten.                                                                 |
| Natural Language Tracking          | 3         | Athlet diktiert "Heute schlecht geschlafen, 78 Kilo, Beine schwer", LLM mappt auf strukturierte Felder.                                     |
| Form-Validation per Vision         | 4+        | Webcam-basierte Push-up-Erkennung. Erfordert eigenes Modell oder Vision-API. Datenschutz-aufwändig.                                         |
| Disziplinspezifische CRS-Varianten | 2         | Regelbasiert plus LLM-generierte Trainings-Empfehlungen. Brücke zur modularen Sport-Architektur.                                            |

**Architektonische Vorbereitungen im MVP**

Damit Phase-2-KI-Features ohne Datenmodell-Migration ergänzt werden können, hält der MVP folgende strukturelle Hooks vor:

- Tracking-Daten werden mit konsistentem Schema und ISO-Zeitstempeln gespeichert — keine User-spezifischen Custom-Felder im Kern.

- Eine ai_consent-Spalte im users-Datensatz (boolean, default false) für späteren Opt-in zu KI-Features.

- Eine ai_interactions-Tabelle wird in Phase 2 ergänzt; ihre Struktur (user_id, feature, prompt_hash, response_summary, model_version, cost_tokens, created_at) ist im Datenmodell-Anhang vermerkt.

- LLM-Calls laufen ausschließlich serverseitig über eine dedizierte Edge-Function — keine API-Keys im Browser.

- Jede KI-Antwort wird mit Modellname, Version und Token-Kosten geloggt für Cost-Tracking und Reproduzierbarkeit.

**Kostenmodell KI (Schätzung Phase 2)**

| **FEATURE**       | **MODELL**                    | **AUFRUFE PRO NUTZER/MONAT** | **KOSTEN/NUTZER/MONAT (GESCHÄTZT)** |
|-------------------|-------------------------------|------------------------------|-------------------------------------|
| Tracking-Insights | Claude Haiku oder GPT-4o-mini | 4                            | ~ 0,02 €                            |
| Coach Co-Pilot    | Claude Sonnet                 | 20 (nur Coaches)             | ~ 0,80 € pro Coach                  |
| Plan-Generator    | Claude Sonnet                 | 5 (nur Coaches)              | ~ 0,50 € pro Coach                  |
| Athleten-Briefing | Claude Haiku                  | 4                            | ~ 0,03 €                            |

Die geschätzten Kosten rechtfertigen das Phase-2-Pricing-Modell (Coach-Plan 19 €/Monat) mit komfortabler Marge.

## 15 · Roadmap

**Phase 0 — Pre-Launch (Pflicht vor Go-Live)**

- AVV mit Supabase und Vercel

- Drittlandtransfer-Garantien (SCCs / EU-US Data Privacy Framework)

- Datenschutzerklärung & Impressum live

- Penetrationstest

- DSFA dokumentiert

- RLS-Test-Suite und Trigger-Tests im CI grün

- Disaster-Recovery-Runbook im Repo

**Phase 1 — MVP**

- Athleten- und Coach-Onboarding (Mindestalter 16)

- Daily Tracking inkl. Streak mit 48h-Karenz, sRPE, offline-fähig

- CRS-Test inkl. Ranking, Verlaufsdiagramm, transparenter Formel

- Wettkampfverwaltung

- Engagement-System mit Stalking-Schutz, RLS, granularen Berechtigungen

- Mehrere Coaches pro Athlet

- Trainingspläne (Erstellen, Zuweisen, Templates kopierbar)

- Echtzeit-Chat (lazy subscription)

- Athleten-Detailansicht

- Trainer-Dashboard mit Wochenkalender

- Empty States, Error Boundary, Toast-System

- Audit-Logging (8 Events)

- Re-Auth bei sensiblen Aktionen

- Self-Service-Kontolöschung mit 14-Tage-Grace

- Datenexport DSGVO Art. 20

- Drei E-Mail-Notification-Trigger

- i18n-Infrastruktur (DE only zum Launch)

- Lighthouse Accessibility ≥ 90

**Phase 2 — Post-MVP**

- Erste KI-Features: Tracking-Insights, Coach Co-Pilot, Plan-Generator, Athleten-Briefing

- Coach-private Notizen mit Joint-Controller-Klärung

- Gesundheitsakten inkl. Freigabe-UI

- Ernährungs-Tracking inkl. Coach-Sicht

- Zwei-Faktor-Authentifizierung (TOTP)

- CAPTCHA bei Brute-Force

- Content Security Policy

- Push-Notifications, In-App-Notification-Center

- Coach-Dashboard mit Auffälligkeits-Erkennung

- Cascading Plan-Updates mit Diff-Anzeige

- Bulk-Operations für Coaches

- Englische Übersetzung

- Pricing-System (Trainer-Plan 19 €)

- Disziplinspezifische CRS-Varianten

**Phase 3 — Vision**

- Verletzungs-Risiko-Indikator (KI)

- Wettkampf-Tapering-Assistent (KI)

- Smart Notifications (KI)

- Natural Language Tracking (KI)

- Wearable-Integration (Apple Health, Google Fit, Garmin)

- Vereins- und Gym-Ebene mit Multi-Coach-Strukturen

- Volle WCAG 2.1 AA Konformität

- Mehrsprachigkeit (FR, ES, weitere)

**Phase 4+ — Forschung**

- Form-Validation per Vision (Webcam)

- Marketplace (Coach-Buchung, Bezahlung)

- Videoanalyse und Sparring-Notizen

- Whitelabel-Variante für Verbände

## 16 · Offene Fragen

Verbleibende Entscheidungen, die im Verlauf der Implementierung geklärt werden müssen — alle nicht launch-blockierend.

42. Plan-Bearbeitung nach Zuweisung: Soll der Athlet selbst Übungen abhaken oder Notizen hinzufügen können? Empfehlung: ja, im MVP nur "Übung erledigt"-Toggle.

43. Wettkampf-Sichtbarkeit: Soll der Coach standardmäßig die Wettkämpfe seiner Athleten sehen, oder via separater Berechtigung can_see_competitions? Empfehlung: separate Berechtigung, default true.

44. Coach ohne Athlet-Funktionen: Soll ein Coach einen eigenen CRS-Test machen dürfen, ohne die Rolle Beides zu wählen? Empfehlung: nein — wer testet, ist Athlet oder Beides.

45. Brand-Name: Endgültige Schreibweise "Ready 2 Fight" oder "Ready2Fight"? Auswirkung auf Logo, Domain, Markenrecherche.

46. Verbands-Partnerschaft als Erstes: WAKO, German MMA Federation, oder beides parallel?

## 17 · Glossar

| **BEGRIFF**    | **BEDEUTUNG**                                                              |
|----------------|----------------------------------------------------------------------------|
| AES-256        | Verschlüsselungsstandard mit 256-Bit-Schlüssel                             |
| Archetyp       | Stärkenprofil eines Athleten (Tank, Assassin, Guardian, Berserker, Rookie) |
| AVV            | Auftragsverarbeitungsvertrag (Art. 28 DSGVO)                               |
| BJJ            | Brazilian Jiu-Jitsu, Bodenkampfsport                                       |
| CRS            | Combat Readiness Score, App-eigener Fitnesstest 0–100                      |
| Daily Tracking | Tägliche Selbstauskunft des Athleten                                       |
| DSFA           | Datenschutz-Folgenabschätzung (Art. 35 DSGVO)                              |
| DSGVO          | Datenschutz-Grundverordnung der EU                                         |
| Engagement     | Digitale Coach-Athlet-Beziehung in der App                                 |
| Gamification   | Einsatz von Spielelementen zur Motivationssteigerung                       |
| JWT            | JSON Web Token, Session-Format                                             |
| MMA            | Mixed Martial Arts                                                         |
| MVP            | Minimum Viable Product                                                     |
| OWASP          | Open Worldwide Application Security Project                                |
| PITR           | Point-in-Time Recovery                                                     |
| RAG            | Retrieval-Augmented Generation, KI-Methode mit kontextuellem Daten-Lookup  |
| Re-Auth        | Erneute Passwort-Eingabe vor sicherheitskritischen Aktionen                |
| RLS            | Row-Level Security                                                         |
| RPE            | Rate of Perceived Exertion (1–10)                                          |
| RTO/RPO        | Recovery Time / Point Objective im Disaster-Recovery-Plan                  |
| SCC            | Standard Contractual Clauses (DSGVO-Drittlandtransfer)                     |
| Session        | Einzelne Trainingseinheit innerhalb eines Plans                            |
| sRPE           | Session-RPE = RPE × Trainingsdauer in Minuten                              |
| Streak         | Aufeinanderfolgende Tage mit vollständigem Tracking                        |
| Supabase       | Open-Source Backend-as-a-Service                                           |
| TLS / SSL      | Transport-Verschlüsselung                                                  |
| TOM            | Technische und organisatorische Maßnahmen (Art. 32 DSGVO)                  |

## Anhang B — CRS-Berechnungsformel

Vollständige, öffentlich dokumentierte Formel. Wird im Produkt unter Hilfe → CRS-Methodik verlinkt.

**Pro-Übungs-Score**

Für jede der fünf Übungen wird ein Einzelscore berechnet:

score_raw = (eigener_Wert / personalisierter_Zielwert) × 100, gecappt bei 100.

Der personalisierte Zielwert entsteht aus dem Basis-Zielwert multipliziert mit drei Faktoren:

ziel = base_ziel × gewicht_faktor × alter_faktor × geschlecht_faktor

**Basis-Zielwerte**

| **ÜBUNG**  | **BASIS-ZIELWERT** | **EINHEIT**                    |
|------------|--------------------|--------------------------------|
| Burpees    | 25                 | Wiederholungen in 60 s         |
| Air Squats | 50                 | Wiederholungen in 60 s         |
| Push-ups   | 35                 | saubere Wiederholungen in 60 s |
| Plank Hold | 60                 | Sekunden gehalten              |
| High Knees | 100                | Bodenkontakte in 60 s          |

Die Basis-Werte sind Heuristiken, kalibriert für eine 25-jährige, 75 kg schwere, 175 cm große Person mit männlicher Referenz. Sie werden mit wachsender Datenbasis nachjustiert. Alle Basis-Werte und Faktor-Kurven sind in der Tabelle crs_norms gespeichert — Anpassungen erfolgen ohne Code-Deployment.

**CRS-Gesamtscore**

CRS = Mittelwert der fünf Einzelscores, gerundet auf ganze Zahl. Alle fünf Übungen sind gleich gewichtet — keine Übung dominiert.

**Edge Cases**

- Eine Null-Übung erlaubt: CRS = Mittelwert der vier verbleibenden, mit Hinweis "Test mit reduziertem Umfang".

- Mehr als eine Null-Übung: Test gilt als ungültig. Athlet bekommt einen Hinweis und kann den Test wiederholen.

- Wert über plausibler Obergrenze (z. B. \> 100 Burpees in 60 s): Server lehnt den Test mit einer klaren Fehlermeldung ab.

**Archetyp-Bestimmung**

Der Archetyp ergibt sich aus den zwei stärksten Einzelscores:

| **STÄRKSTE 2 ÜBUNGEN**     | **ARCHETYP** |
|----------------------------|--------------|
| Plank + Squats             | Tank         |
| High Knees + Burpees       | Assassin     |
| Plank + Push-ups           | Guardian     |
| Burpees + Squats           | Berserker    |
| alle anderen Kombinationen | Rookie       |

## Anhang C — Test-Strategie

Test-Pflichten im CI vor Pull-Request-Merge.

**RLS-Test-Suite (≥ 20 Tests)**

- Athlet A liest Tracking von Athlet B → 0 Zeilen.

- Athlet A liest CRS von Athlet B → 0 Zeilen.

- Coach ohne Engagement liest Athleten-Tracking → 0 Zeilen.

- Coach mit can_see_tracking=false liest Tracking → 0 Zeilen.

- Coach mit can_see_tests=false liest Fitness-Tests → 0 Zeilen.

- Coach liest Daten eines fremden Athleten (anderer Coach) → 0 Zeilen.

- Athlet liest Chat-Nachrichten eines fremden Engagements → 0 Zeilen.

- Anonymer (nicht authentifizierter) Zugriff auf jede Tabelle → 0 Zeilen.

- Coach kann Engagement von pending auf active setzen → abgelehnt.

- Athlet kann Engagement aktivieren → erfolgreich.

- Plus 10 weitere Variationen für health_records, plan_assignments, audit_log etc.

**Trigger-Tests**

- Engagement-Ende widerruft alle health_record_shares (revoked_at gesetzt).

- Plan-Zuweisung erfordert aktives Engagement und can_create_plans=true.

- Tracking-Submit für ein Datum in der Zukunft → Server-Fehler.

- Mehrfacher Tracking-Submit für denselben Tag → Upsert, kein Duplicate.

- Streak-Berechnung deterministisch und idempotent.

**Weitere CI-Pflichten**

- Lighthouse Accessibility Score ≥ 90 auf allen Hauptseiten.

- ESLint-Regel: keine hardcoded Strings in JSX (i18n-readiness).

- Dependency-Scanning via Dependabot, kritische Findings blocken Merge.

- TypeScript strict mode, kein any.
