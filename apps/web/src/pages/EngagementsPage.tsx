import { useState } from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import { useRedeemEngagementCode } from "../hooks/queries/useRedeemEngagementCode";
import { mapRedeemError, normalizeCode, validateCodeInput } from "../lib/redeemCode";
import { EngagementsList } from "../components/engagements/EngagementsList";

export function EngagementsPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const showRedeem = role === "athlete" || (role === "both" && mode === "athlete");

  if (profile.isLoading) {
    return (
      <p role="status" className="text-sm text-slate-500">
        Lade Profil …
      </p>
    );
  }

  if (profile.error) {
    return (
      <p role="alert" className="text-sm text-red-400">
        Profil konnte nicht geladen werden.
      </p>
    );
  }

  const isCoachView = role === "coach" || (role === "both" && mode === "coach");
  const title = isCoachView ? "Athleten" : "Coaches";
  const subtitle = isCoachView
    ? "Uebersicht aller aktiven und vergangenen Betreuungen."
    : "Du hast einen Code von deinem Coach bekommen? Hier einloesen.";

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="text-sm text-slate-400">{subtitle}</p>
      </header>
      {showRedeem && <RedeemForm />}
      <section className="space-y-2">
        <h2 className="text-lg font-semibold">
          {isCoachView ? "Deine Athleten" : "Deine Engagements"}
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
        className="space-y-3"
      >
        <div>
          <label htmlFor="redeem-code" className="mb-1 block text-sm font-medium">
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
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm tracking-widest uppercase outline-none focus:border-slate-500"
          />
          {!(touched && validationError) && (
            <p id="redeem-code-hint" className="mt-1 text-xs text-slate-500">
              8 Zeichen, Gross-/Kleinschreibung egal.
            </p>
          )}
          {touched && validationError && (
            <p id="redeem-code-error" role="alert" className="mt-1 text-xs text-red-400">
              {validationError}
            </p>
          )}
        </div>

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            {mapRedeemError(mutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Loese ein …" : "Code einloesen"}
        </button>
      </form>

      {success && (
        <div
          role="status"
          aria-label="Code eingeloest"
          className="rounded-md border border-emerald-800 bg-emerald-950/30 p-4 text-sm text-emerald-200"
        >
          Code eingeloest. Dein Coach kann dich jetzt sehen.
        </div>
      )}
    </div>
  );
}
