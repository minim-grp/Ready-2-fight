import { useMemo, useState } from "react";
import { useProfile } from "../hooks/queries/useProfile";
import { useModeStore } from "../stores/mode";
import {
  useGenerateEngagementCode,
  type GeneratedCode,
} from "../hooks/queries/useGenerateEngagementCode";
import {
  DEFAULT_CODE_FORM,
  formatExpiresAt,
  hasErrors,
  mapRpcError,
  validateCodeForm,
  type CodeFormErrors,
  type CodeFormValues,
} from "../lib/engagementCode";

export function CodesPage() {
  const profile = useProfile();
  const mode = useModeStore((s) => s.mode);
  const role = profile.data?.role;
  const showForm = role === "coach" || (role === "both" && mode === "coach");

  const [values, setValues] = useState<CodeFormValues>(DEFAULT_CODE_FORM);
  const [touched, setTouched] = useState(false);
  const [generated, setGenerated] = useState<GeneratedCode | null>(null);

  const errors: CodeFormErrors = useMemo(() => validateCodeForm(values), [values]);
  const mutation = useGenerateEngagementCode();

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

  if (!showForm) {
    return (
      <section className="space-y-2">
        <h1 className="text-2xl font-semibold">Codes</h1>
        <p className="text-sm text-slate-500">
          Engagement-Codes koennen nur Coaches generieren. Wechsle in den Coach-Modus oder
          lege ein Coach-Profil an.
        </p>
      </section>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    if (hasErrors(errors)) return;
    try {
      const result = await mutation.mutateAsync({
        internalLabel: values.internalLabel,
        maxUses: Number(values.maxUses),
        validDays: Number(values.validDays),
      });
      setGenerated(result);
      setValues(DEFAULT_CODE_FORM);
      setTouched(false);
    } catch {
      // Fehler wird unten via mutation.error gerendert
    }
  };

  const update =
    (key: keyof CodeFormValues) => (e: React.ChangeEvent<HTMLInputElement>) => {
      setValues((v) => ({ ...v, [key]: e.target.value }));
    };

  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Codes</h1>
        <p className="text-sm text-slate-400">
          Generiere einen Einladungscode fuer einen Athleten. Der Code wird nur einmal
          angezeigt — teile ihn persoenlich.
        </p>
      </header>

      {generated && (
        <GeneratedCodeCard code={generated} onDismiss={() => setGenerated(null)} />
      )}

      <form
        onSubmit={(e) => {
          void submit(e);
        }}
        noValidate
        className="space-y-4"
      >
        <div>
          <label htmlFor="internal-label" className="mb-1 block text-sm font-medium">
            Internes Label <span className="text-slate-500">(optional)</span>
          </label>
          <input
            id="internal-label"
            type="text"
            value={values.internalLabel}
            onChange={update("internalLabel")}
            maxLength={60}
            aria-invalid={touched && !!errors.internalLabel}
            aria-describedby={
              errors.internalLabel ? "internal-label-error" : "internal-label-hint"
            }
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          {!errors.internalLabel && (
            <p id="internal-label-hint" className="mt-1 text-xs text-slate-500">
              Nur fuer dich sichtbar. Hilft beim Wiederfinden in der Code-Liste.
            </p>
          )}
          {touched && errors.internalLabel && (
            <p
              id="internal-label-error"
              role="alert"
              className="mt-1 text-xs text-red-400"
            >
              {errors.internalLabel}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="max-uses" className="mb-1 block text-sm font-medium">
            Anzahl Einloesungen
          </label>
          <input
            id="max-uses"
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={values.maxUses}
            onChange={update("maxUses")}
            aria-invalid={touched && !!errors.maxUses}
            aria-describedby={errors.maxUses ? "max-uses-error" : "max-uses-hint"}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          {!errors.maxUses && (
            <p id="max-uses-hint" className="mt-1 text-xs text-slate-500">
              Wie oft der Code eingeloest werden darf (1–10).
            </p>
          )}
          {touched && errors.maxUses && (
            <p id="max-uses-error" role="alert" className="mt-1 text-xs text-red-400">
              {errors.maxUses}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="valid-days" className="mb-1 block text-sm font-medium">
            Gueltigkeit in Tagen
          </label>
          <input
            id="valid-days"
            type="number"
            inputMode="numeric"
            min={1}
            max={30}
            value={values.validDays}
            onChange={update("validDays")}
            aria-invalid={touched && !!errors.validDays}
            aria-describedby={errors.validDays ? "valid-days-error" : "valid-days-hint"}
            className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
          />
          {!errors.validDays && (
            <p id="valid-days-hint" className="mt-1 text-xs text-slate-500">
              Nach Ablauf wird der Code automatisch ungueltig (1–30).
            </p>
          )}
          {touched && errors.validDays && (
            <p id="valid-days-error" role="alert" className="mt-1 text-xs text-red-400">
              {errors.validDays}
            </p>
          )}
        </div>

        {mutation.error && (
          <p role="alert" className="text-sm text-red-400">
            {mapRpcError(mutation.error)}
          </p>
        )}

        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-slate-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {mutation.isPending ? "Erstelle …" : "Code erstellen"}
        </button>
      </form>
    </section>
  );
}

type CardProps = {
  code: GeneratedCode;
  onDismiss: () => void;
};

function GeneratedCodeCard({ code, onDismiss }: CardProps) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      role="region"
      aria-label="Neuer Engagement-Code"
      className="rounded-md border border-emerald-800 bg-emerald-950/30 p-4"
    >
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-xs tracking-wide text-emerald-300 uppercase">
          Neuer Code
        </span>
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs text-emerald-400 hover:text-emerald-200"
          aria-label="Code-Anzeige schliessen"
        >
          schliessen
        </button>
      </div>
      <p className="mt-2 font-mono text-2xl tracking-widest text-emerald-100 select-all">
        {code.code}
      </p>
      <p className="mt-1 text-xs text-emerald-300">
        Gueltig bis{" "}
        <span className="tabular-nums">{formatExpiresAt(code.expiresAt)}</span>
      </p>
      <div className="mt-3 flex items-center gap-3">
        <button
          type="button"
          onClick={() => void copy()}
          className="rounded-md border border-emerald-700 px-3 py-1 text-xs text-emerald-100 hover:border-emerald-500"
        >
          {copied ? "Kopiert" : "Kopieren"}
        </button>
        <span className="text-xs text-emerald-400">
          Einmalig sichtbar — teile den Code persoenlich.
        </span>
      </div>
    </div>
  );
}
