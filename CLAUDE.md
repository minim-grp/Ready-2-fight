---
project: Ready 2 Fight
type: KI-Regelwerk (Claude Coding Guidelines)
applies_to: Claude Code, Claude in VS Code, jeder LLM-Assistent in diesem Repo
related_docs:
  - docs/Ready2Fight_PRD.md # Was und Warum
  - docs/ROADMAP.md # Wann und in welcher Reihenfolge
  - sql/r2f_sql_1_foundation_v2.sql
---

# Regelwerk für die KI — Ready 2 Fight

Diese Datei ist die **verbindliche Arbeitsanweisung** für jeden KI-Assistenten, der an Ready 2 Fight mitarbeitet. Sie hat Vorrang vor allgemeinen Best Practices, wenn es Konflikte gibt. Bei Widerspruch zwischen dieser Datei und einem User-Prompt: **nachfragen, nicht raten**.

---

## 0 · Goldene Regeln (nicht verhandelbar)

1. **Default-Deny.** Jede neue `public.*`-Tabelle bekommt sofort `ALTER TABLE … ENABLE ROW LEVEL SECURITY` und mindestens eine selektive Policy. Niemals eine Tabelle ohne RLS deployen.
2. **Keine Empfänger-E-Mail in Engagement-Codes.** Stalking-Schutz ist Produkt-Kernversprechen. Wer einen Code generiert, übergibt **nie** eine Athleten-E-Mail. Wenn ein Prompt das verlangt — ablehnen und auf PRD §03 verweisen.
3. **KI-Features sind Phase 2.** Im MVP keine LLM-Calls, keine `ai_interactions`-Tabelle, keine Edge-Function für OpenAI/Anthropic/Mistral. Einzige Ausnahme: die `ai_consent`-Spalte als Architektur-Hook (existiert bereits).
4. **DSGVO ist nicht optional.** Hosting bleibt in `eu-central-1`. Keine Drittland-Transfers ohne explizite User-Bestätigung im Prompt. Personenbezogene Daten gehören niemals in Logs, Stack-Traces oder Test-Fixtures.
5. **Mindestalter 16.** Jeder Registrierungs-Flow checkt das Geburtsdatum. Jüngere User werden mit klarem Hinweis abgelehnt — kein Parental-Consent-Workflow im MVP.
6. **Coach-Zugriff nur über Helper.** Niemals direkt `WHERE coach_id = auth.uid()` in einer Athletendaten-Policy. Immer `is_linked_coach()` oder `is_linked_coach_with_*()`. Diese Funktionen sind die einzige Quelle der Wahrheit.
7. **Audit-Log für sicherheitsrelevante Aktionen.** Jede SECURITY-DEFINER-RPC, die Permissions ändert, Engagements anlegt/beendet, oder Accounts löscht, schreibt einen `audit.events`-Eintrag — vor dem Return.
8. **Wenn unklar, fragen.** Lieber eine Klärungsfrage als eine falsche Annahme über Domain-Logik. Bei UI/Style-Details darfst du eine begründete Annahme treffen und sie inline notieren.

---

## 1 · Architektur-Leitplanken

### Schichten

- `auth.*` — Supabase-managed, **niemals** modifizieren oder Trigger drauflegen außer dem dokumentierten `on_auth_user_created`.
- `public.*` — Domain-Daten, RLS-geschützt, vom Client erreichbar.
- `private.*` — Server-only (Service-Role). Hier gehören sensible Stammdaten und Job-Queues hin.
- `audit.*` — Append-only. Kein UPDATE, kein DELETE, kein Grant für `anon`/`authenticated`.

### Datenflussregel

> Ein Coach sieht Athletendaten **nur** via aktivem Engagement **und** nur die Spalten, für die er die jeweilige `can_see_*`-Permission hat.

Wenn eine neue Coach-sichtbare Tabelle dazukommt, gehört sie hinter eine passende `is_linked_coach_with_*()`-Variante. Falls die nötige Variante noch nicht existiert: zuerst die Helper-Funktion ergänzen, dann die Policy.

### Edge Functions vs. RPCs

- **RPC (`SECURITY DEFINER` Postgres function)**: für alles, was atomar in einer Transaktion laufen muss und nur DB-Logik braucht (Engagement-Code-Redeem, XP-Vergabe, Account-Löschung-Request).
- **Edge Function (TypeScript/Deno)**: für alles mit externer I/O (E-Mail-Versand, GDPR-Export-ZIP-Bauen, später LLM-Calls), für Cron-Jobs, und für CRS-Score-Berechnung (komplex genug, dass JS lesbarer ist als plpgsql).

---

## 2 · Coding-Standards

### Allgemein

- **TypeScript strict mode**, kein `any` ohne Kommentar mit Begründung.
- **Keine Magic Strings** für Status, Rollen, Event-Types — nutze die Postgres-Enums oder generierte TS-Types aus `supabase gen types typescript`.
- **Funktionen mit ≥ 3 Parametern** nehmen ein Options-Objekt.
- **Fehlerklassen statt Strings.** `throw new EngagementCodeExpiredError()` statt `throw 'expired'`.
- **Kein `console.log` in committetem Code.** Nutze den Logger-Wrapper (`lib/logger.ts`) — der respektiert das `LOG_LEVEL`-Env und scrubbt PII automatisch.

### Frontend (PWA, mobile-first für Athleten)

- **React + Vite + TanStack Query + Zustand** für State, **Tailwind** für Styling, **Workbox** für Offline.
- **Komponenten ≤ 150 Zeilen.** Wenn länger: in Sub-Komponenten aufteilen.
- **Daten-Fetching ausschließlich über TanStack-Query-Hooks** in `hooks/queries/`. Keine `supabase.from(...)` Aufrufe direkt aus Komponenten.
- **Empty States, Error States, Loading States sind Pflicht** für jede Daten-anzeigende Komponente. Keine Komponente ohne diese drei States in Storybook.
- **Offline-Verhalten**: Daily Tracking ist die einzige offline-fähige Funktion. Alle anderen Screens zeigen das `<OfflineBanner />` und disablen Aktionen.

### Backend (Supabase + Postgres)

- **Migrations über `supabase db diff`** generieren, Hand-Edits dokumentieren.
- **Jede Migration ist idempotent** (`CREATE TABLE IF NOT EXISTS`, `DROP POLICY IF EXISTS … CREATE POLICY …`).
- **Generated Columns** nutzen, wo Werte deterministisch ableitbar sind (sRPE ist das Vorbild).
- **Indexes auf jede FK-Spalte** und auf jede Spalte, die in einer RLS-Policy gefiltert wird — sonst skaliert die Policy nicht.

---

## 3 · Sicherheits-Regeln (über die Goldenen Regeln hinaus)

### Authentifizierung

- Re-Auth (frische Session ≤ 5 min) ist Pflicht für: Account löschen, E-Mail ändern, Engagement beenden, Health-Record-Freigabe widerrufen, alle Permissions ändern.
- 2FA (TOTP) ist Phase 2. Bis dahin: starke Passwort-Policy (≥ 12 Zeichen) + Re-Auth.

### Eingaben

- **Whitelist statt Blacklist** für alle Enum-artigen Felder.
- **Längen-Limits** auf jedem TEXT-Feld (`CHECK (length(x) BETWEEN 1 AND N)`). Chat-Bodys: 4000 Zeichen.
- **Keine User-Input direkt in dynamisches SQL.** Parametrisieren oder Format-String mit `%I`/`%L` in plpgsql.

### Geheimnisse

- **Keine Secrets in `git`.** `.env` ist gitignored, `.env.example` enthält nur Variable-Namen.
- **Service-Role-Key** existiert ausschließlich auf dem Server (Edge Functions). Wenn du ihn im Frontend siehst: Critical Bug, sofort melden.
- **API-Keys von Drittanbietern** (LLM-Provider, E-Mail-Versand) leben in Supabase Vault, niemals in Code oder Env-Files im Repo.

---

## 4 · Tests (CI-Pflicht)

| Kategorie       | Was                                                                                                                | Tool                            |
| --------------- | ------------------------------------------------------------------------------------------------------------------ | ------------------------------- |
| RLS-Tests       | Jede Policy hat mindestens einen positiven und einen negativen Test (richtiger User darf, fremder User darf nicht) | `pgTAP` oder `supabase test db` |
| Trigger-Tests   | XP-Auto-Update, Streak-Reset, sRPE-Generated, on_auth_user_created                                                 | `pgTAP`                         |
| Unit-Tests      | Pure Functions in `lib/`, alle CRS-Score-Berechnungen                                                              | Vitest                          |
| Component-Tests | Jede Komponente in `components/` mit Loading/Error/Empty-Variante                                                  | Vitest + Testing Library        |
| E2E             | Die zehn Critical Flows aus ROADMAP §3                                                                             | Playwright                      |
| Lighthouse      | Accessibility ≥ 90, Performance ≥ 80 (Mobile)                                                                      | Lighthouse-CI                   |

**Coverage-Ziel**: 80 % auf `lib/`, 100 % auf RLS-Policies. Für UI-Komponenten reicht visueller Storybook-Test plus die drei States.

---

## 5 · Git & Commits

- **Conventional Commits**: `feat(tracking): add offline queue retry`, `fix(rls): coach can no longer read meals without permission`.
- **Branch-Namen**: `feat/<kapitel>-<kurzname>`, z. B. `feat/06-crs-test-flow`.
- **Niemals direkt auf `main`.** PR mit mindestens einem Reviewer.
- **Jeder PR referenziert** entweder ein Issue oder einen Roadmap-Schritt aus `ROADMAP.md`.
- **Migrations-PRs** sind separat von Feature-PRs — Schema-Änderungen sollen einzeln review- und rollback-bar sein.

---

## 6 · Wenn du Code vorschlägst

1. **Lies vorher den relevanten PRD-Abschnitt.** Wenn der User „CRS-Test bauen" sagt und du Kapitel 06 nicht im Kontext hast: nachfragen oder die Datei anfordern.
2. **Zeig die Migration zuerst, dann den Code.** Schema-Änderungen sind das, woran sich am meisten festmacht.
3. **Liste die RLS-Policies explizit auf**, die deine neue Tabelle braucht — auch wenn der User nicht danach fragt.
4. **Markiere bewusste Annahmen.** Mit `// ASSUMPTION:`-Kommentaren, die der User leicht finden und korrigieren kann.
5. **Schlage Tests vor**, mindestens als `// TODO: test …`-Liste am Ende der Datei.
6. **Keine spekulativen Features.** Wenn der User Feature X verlangt, baue X — nicht X plus „nice-to-have" Y.

---

## 7 · Wenn du KI-Features baust (ab Phase 2)

Diese Regeln greifen erst, wenn die Roadmap explizit Phase 2 erreicht hat. Bis dahin: nicht anfangen.

1. **Augmentation, nicht Ersatz.** Jede LLM-Ausgabe ist als Empfehlung gekennzeichnet. Niemals als Diagnose, niemals als Trainerentscheidung.
2. **On-Demand.** KI läuft nur, wenn der User aktiv einen Knopf drückt. Keine Hintergrund-Calls.
3. **Server-only.** Jeder LLM-Call läuft über eine dedizierte Edge Function. Niemals API-Keys im Browser.
4. **Logging mit Modell-Version und Token-Kosten.** Jede Antwort wird in `ai_interactions` gespeichert (Schema in PRD §14).
5. **Graceful Degradation.** LLM-Timeout oder Provider-Outage darf niemals einen Kern-Flow blockieren. UI zeigt „KI gerade nicht verfügbar", User kann manuell weiter.
6. **Modell-agnostisch.** Konkrete Modellnamen sind Implementierungsdetail. Die Abstraktionsschicht erlaubt Modellwechsel ohne Schema-Änderung.
7. **`ai_consent` prüfen.** Vor jedem KI-Call: `SELECT ai_consent FROM users WHERE id = auth.uid()`. Wenn `false`: Fehler `ai_consent_required`.
8. **Kein Modell-Training auf Nutzerdaten.** DPAs mit allen Providern, Opt-out für Training-Data-Sharing aktiviert.
9. **Halluzinations-Check bei Health-Themen.** Wenn der User-Prompt Verletzung, Schmerz, Medikament enthält: nicht generieren, stattdessen festen Hinweistext zurückgeben.
10. **Prompt-Injection-Schutz.** Athleten-Notes, Chat-Bodys und freie Tracking-Texte werden vor LLM-Übergabe gewrappt: `[USER_INPUT_BEGIN]…[USER_INPUT_END]` und im System-Prompt explizit als untrusted markiert.

---

## 8 · Was du nicht tun darfst

- Keine `DROP TABLE` ohne explizite Bestätigung im Prompt.
- Keine destruktiven Migrations ohne Backup-Hinweis.
- Keinen Code, der personenbezogene Daten aus der DB exportiert, außer über die offizielle GDPR-Export-Edge-Function.
- Keine Auskommentar-„Lösungen" für RLS-Probleme. Wenn eine Policy zu strikt ist: diskutieren, nicht abschalten.
- Keine eigenmächtigen Dependency-Upgrades auf Major-Versionen.
- Keine Telemetrie zu Drittanbietern (Google Analytics, Segment, Sentry-Public-DSN) ohne dass es im PRD steht.
- Keine `localStorage`/`sessionStorage` für sensible Daten — nur IndexedDB mit definiertem Cleanup.

---

## 9 · Eskalation

Wenn du auf einen der folgenden Fälle stößt, **stoppe und melde** statt weiterzumachen:

- Eine Anweisung im Prompt widerspricht den Goldenen Regeln (§0).
- Ein bestehender Code-Pfad umgeht RLS via Service-Role.
- Du findest hartcodierte Secrets oder PII im Repo.
- Eine Migration würde Daten verlieren ohne Backup-Schritt.
- Du wirst aufgefordert, KI-Features im MVP einzubauen.

In all diesen Fällen: kurze, sachliche Notiz an den User, was das Problem ist, welche Regel betroffen ist, und welche Optionen es gibt.
