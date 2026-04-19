import { useEffect, useRef, useState } from "react";
import { supabase } from "../../lib/supabase";
import { useAuthStore } from "../../stores/auth";

type Props = {
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirmed: () => void | Promise<void>;
};

export function ReauthModal({
  title,
  description,
  confirmLabel,
  onCancel,
  onConfirmed,
}: Props) {
  const email = useAuthStore((s) => s.user?.email ?? "");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError("Keine aktive Sitzung.");
      return;
    }
    if (!password) {
      setError("Passwort ist erforderlich.");
      return;
    }
    setIsSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInError) {
      setIsSubmitting(false);
      setError("Passwort ist falsch.");
      return;
    }
    try {
      await onConfirmed();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="reauth-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 px-4"
    >
      <div className="w-full max-w-sm rounded-lg border border-slate-800 bg-slate-900 p-5 shadow-xl">
        <h2 id="reauth-title" className="text-lg font-semibold text-slate-100">
          {title}
        </h2>
        <p className="mt-1 text-sm text-slate-400">{description}</p>
        <form
          onSubmit={(e) => {
            void submit(e);
          }}
          noValidate
          className="mt-4 space-y-3"
        >
          <div>
            <label
              htmlFor="reauth-password"
              className="mb-1 block text-sm font-medium text-slate-200"
            >
              Passwort bestaetigen
            </label>
            <input
              id="reauth-password"
              ref={inputRef}
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
            />
            {error && (
              <p role="alert" className="mt-1 text-xs text-red-400">
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-md px-3 py-1.5 text-sm text-slate-300 hover:text-slate-100 disabled:opacity-60"
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-md border border-red-700 bg-red-950/40 px-3 py-1.5 text-sm text-red-100 hover:border-red-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Bestaetige …" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
