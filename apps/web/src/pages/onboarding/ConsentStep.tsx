import { useState } from "react";
import { toast } from "sonner";
import { useSetAiConsent } from "../../hooks/queries/useAiConsent";
import { logger } from "../../lib/logger";

type Props = {
  onContinue: () => void;
};

export function ConsentStep({ onContinue }: Props) {
  const aiConsentMutation = useSetAiConsent();
  // ASSUMPTION: Coach-Sichtbarkeit wird heute pro-Engagement+Permissions geregelt,
  // nicht user-weit. Marketing-Consent hat noch keine DB-Spalte.
  // Beide Toggles bleiben hier UI-Skelett (Default-State); Persistierung folgt mit
  // separater Migration (siehe Followups in ready2fight_sprint_state.md).
  const [coachVisibility, setCoachVisibility] = useState(true);
  const [aiConsent, setAiConsent] = useState(false);
  const [marketing, setMarketing] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleContinue() {
    setSubmitting(true);
    try {
      await aiConsentMutation.mutateAsync(aiConsent);
      onContinue();
    } catch (err) {
      logger.error("ai_consent_save_failed", err);
      toast.error("Einstellungen konnten nicht gespeichert werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-md space-y-6 px-6 py-10">
      <header>
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{
            fontFamily: "var(--font-mono)",
            color: "var(--color-ink-3)",
          }}
        >
          Datenschutz
        </p>
        <h1
          className="mt-2 text-3xl"
          style={{
            fontFamily: "var(--font-display)",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          Was teilst du{" "}
          <em style={{ fontStyle: "italic", color: "var(--color-accent)" }}>mit wem?</em>
        </h1>
        <p className="mt-3 text-sm" style={{ color: "var(--color-ink-2)" }}>
          Du kannst alles spaeter in den Einstellungen aendern. DSGVO-konform, gehostet in
          Frankfurt.
        </p>
      </header>

      <div
        className="space-y-3 rounded-[22px] p-5"
        style={{
          backgroundColor: "var(--color-paper)",
          boxShadow: "var(--shadow-1)",
          border: "1px solid var(--line)",
        }}
      >
        <ConsentToggle
          label="Coach-Sichtbarkeit"
          description="Coaches sehen erst nach explizitem Engagement deine Daten — und nur, was du je Permission freigibst."
          checked={coachVisibility}
          onChange={setCoachVisibility}
        />
        <Divider />
        <ConsentToggle
          label="KI-Verarbeitung"
          description="Anonyme Statistiken zur Score-Verbesserung. Aktuell deaktiviert (Phase 2)."
          checked={aiConsent}
          onChange={setAiConsent}
        />
        <Divider />
        <ConsentToggle
          label="Produkt-News per E-Mail"
          description="Hoechstens 1 Mail pro Monat. Kein Tracking-Pixel."
          checked={marketing}
          onChange={setMarketing}
        />
      </div>

      <button
        type="button"
        disabled={submitting}
        onClick={() => void handleContinue()}
        className="w-full rounded-2xl py-3.5 text-sm font-medium disabled:opacity-50"
        style={{
          backgroundColor: "var(--color-accent)",
          color: "var(--color-on-night)",
        }}
      >
        {submitting ? "Speichere …" : "Weiter"}
      </button>
    </div>
  );
}

function Divider() {
  return <div style={{ borderTop: "1px solid var(--line)" }} />;
}

type ToggleProps = {
  label: string;
  description: string;
  checked: boolean;
  onChange: (next: boolean) => void;
};

function ConsentToggle({ label, description, checked, onChange }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-4 py-2">
      <span className="flex flex-col">
        <span className="text-sm font-medium" style={{ color: "var(--color-ink)" }}>
          {label}
        </span>
        <span className="mt-1 text-xs" style={{ color: "var(--color-ink-3)" }}>
          {description}
        </span>
      </span>
      <span
        className="relative mt-0.5 inline-flex h-6 w-11 shrink-0 items-center rounded-full transition"
        style={{
          backgroundColor: checked ? "var(--color-accent)" : "var(--color-bg-3)",
        }}
      >
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span
          className="inline-block h-5 w-5 transform rounded-full bg-white shadow transition"
          style={{ transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </span>
    </label>
  );
}
