import { useState } from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useRedeemEngagementCode } from "../hooks/queries/useRedeemEngagementCode";
import { mapRedeemError, normalizeCode, validateCodeInput } from "../lib/redeemCode";
import { EngagementsList } from "../components/engagements/EngagementsList";

const CARD_STYLE: React.CSSProperties = {
  backgroundColor: "var(--color-paper)",
  border: "1px solid var(--line)",
  boxShadow: "var(--shadow-1)",
};

export function EngagementsPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const showRedeem = role === "athlete" || (role === "both" && mode === "athlete");

  if (profile.isLoading) {
    return (
      <p role="status" className="text-sm" style={{ color: "var(--color-ink-3)" }}>
        Lade Profil …
      </p>
    );
  }

  if (profile.error) {
    return (
      <p role="alert" className="text-sm" style={{ color: "var(--color-accent-2)" }}>
        Profil konnte nicht geladen werden.
      </p>
    );
  }

  const isCoachView = role === "coach" || (role === "both" && mode === "coach");
  const title = isCoachView ? "Athleten" : "Coaches";
  const subtitle = isCoachView
    ? "Uebersicht aller aktiven und vergangenen Betreuungen."
    : "Du hast einen Code von deinem Coach bekommen? Hier einloesen.";
  const eyebrow = isCoachView ? "Engagements · Coach" : "Engagements · Athlet";
  const listTitle = isCoachView ? "Deine Athleten" : "Deine Engagements";

  return (
    <section className="space-y-6">
      <header className="space-y-1">
        <p
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {eyebrow}
        </p>
        <h1
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            letterSpacing: "-0.02em",
            color: "var(--color-ink)",
          }}
        >
          {title}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-ink-2)" }}>
          {subtitle}
        </p>
      </header>

      {showRedeem && <RedeemForm />}

      <section className="space-y-3">
        <h2
          className="text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          {listTitle}
        </h2>
        <EngagementsList />
      </section>
    </section>
  );
}

function RedeemForm() {
  const [value, setValue] = useState("");
  const [touched, setTouched] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const mutation = useRedeemEngagementCode();

  const validationError = validateCodeInput(value);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (validationError) return;
    setSuccess(null);
    try {
      const engagementId = await mutation.mutateAsync(normalizeCode(value));
      setSuccess(engagementId);
      setValue("");
      setTouched(false);
    } catch {
      // Fehler unten via mutation.error
    }
  };

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          void submit(e);
        }}
        noValidate
        className="rounded-[22px] p-5"
        style={CARD_STYLE}
      >
        <p
          className="mb-3 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-ink-3)" }}
        >
          Code einloesen
        </p>
        <label
          htmlFor="redeem-code"
          className="mb-1 block text-sm font-medium"
          style={{ color: "var(--color-ink)" }}
        >
          Engagement-Code
        </label>
        <input
          id="redeem-code"
          type="text"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="ABCD2345"
          maxLength={20}
          aria-invalid={touched && !!validationError}
          aria-describedby={
            touched && validationError ? "redeem-code-error" : "redeem-code-hint"
          }
          className="w-full rounded-2xl px-4 py-3 text-lg tracking-[0.18em] uppercase outline-none"
          style={{
            backgroundColor: "var(--color-bg)",
            border: "1px solid var(--line)",
            color: "var(--color-ink)",
            fontFamily: "var(--font-mono)",
          }}
        />
        {!(touched && validationError) && (
          <p
            id="redeem-code-hint"
            className="mt-2 text-xs"
            style={{ color: "var(--color-ink-3)" }}
          >
            8 Zeichen, Gross-/Kleinschreibung egal.
          </p>
        )}
        {touched && validationError && (
          <p
            id="redeem-code-error"
            role="alert"
            className="mt-2 text-xs"
            style={{ color: "var(--color-accent-2)" }}
          >
            {validationError}
          </p>
        )}

        {mutation.error && (
          <p
            role="alert"
            className="mt-3 text-sm"
            style={{ color: "var(--color-accent-2)" }}
          >
            {mapRedeemError(mutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="mt-4 w-full rounded-2xl px-5 py-3 text-sm font-medium disabled:opacity-40"
          style={{
            backgroundColor: "var(--color-accent)",
            color: "var(--color-on-night)",
          }}
        >
          {mutation.isPending ? "Loese ein …" : "Code einloesen"}
        </button>
      </form>

      {success && (
        <div
          role="status"
          aria-label="Code eingeloest"
          className="rounded-2xl p-4 text-sm"
          style={{
            backgroundColor: "var(--color-bone)",
            border: "1px solid var(--line)",
            color: "var(--color-ink)",
          }}
        >
          Code eingeloest. Dein Coach kann dich jetzt sehen.
        </div>
      )}
    </div>
  );
}
