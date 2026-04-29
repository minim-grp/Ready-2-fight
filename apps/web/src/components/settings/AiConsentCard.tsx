import { useState } from "react";
import { useSetAiConsent } from "../../hooks/queries/useAiConsent";

type Props = {
  consent: boolean;
};

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function AiConsentCard({ consent }: Props) {
  const mutation = useSetAiConsent();
  const [error, setError] = useState<string | null>(null);

  async function toggle(next: boolean) {
    setError(null);
    try {
      await mutation.mutateAsync(next);
    } catch {
      setError("Aenderung konnte nicht gespeichert werden.");
    }
  }

  return (
    <section className="rounded-[22px] p-5" style={CARD_STYLE}>
      <p
        className="mb-1 text-xs tracking-[0.18em] uppercase"
        style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
      >
        Datenschutz
      </p>
      <h2
        className="mb-1"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "1.25rem",
          letterSpacing: "-0.01em",
          color: "var(--color-ink)",
        }}
      >
        KI-Verarbeitung
      </h2>
      <p className="mb-4 text-sm" style={{ color: "var(--color-ink-2)" }}>
        Im MVP nutzen wir noch keine KI. Diese Einwilligung ist die Grundlage fuer
        kuenftige Features wie automatische Score-Erklaerungen oder Plan-Vorschlaege.
      </p>
      <label
        className="flex items-start gap-3 text-sm"
        style={{ color: "var(--color-ink)" }}
      >
        <input
          type="checkbox"
          checked={consent}
          disabled={mutation.isPending}
          onChange={(e) => void toggle(e.target.checked)}
          className="mt-0.5 h-5 w-5 shrink-0"
          style={{ accentColor: "var(--color-accent)" }}
        />
        <span>
          Ich willige ein, dass meine Trainings- und Trackingdaten kuenftig fuer
          KI-gestuetzte Empfehlungen verarbeitet werden duerfen. Widerruf jederzeit
          moeglich.
        </span>
      </label>
      {error && (
        <p
          role="alert"
          className="mt-3 text-sm"
          style={{ color: "var(--color-accent-2)" }}
        >
          {error}
        </p>
      )}
    </section>
  );
}
