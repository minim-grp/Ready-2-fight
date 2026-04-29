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
      className="fixed inset-0 z-50 flex items-center justify-center px-4"
      style={{ backgroundColor: "rgba(21, 20, 15, 0.55)" }}
    >
      <div
        className="w-full max-w-sm rounded-[28px] p-6"
        style={{
          backgroundColor: "var(--color-paper)",
          border: "1px solid var(--line)",
          boxShadow: "var(--shadow-3)",
        }}
      >
        <p
          className="mb-1 text-xs tracking-[0.18em] uppercase"
          style={{ fontFamily: "var(--font-mono)", color: "var(--color-accent-2)" }}
        >
          Bestaetigung
        </p>
        <h2
          id="reauth-title"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            letterSpacing: "-0.01em",
            color: "var(--color-ink)",
          }}
        >
          {title}
        </h2>
        <p className="mt-2 text-sm" style={{ color: "var(--color-ink-2)" }}>
          {description}
        </p>
        <form
          onSubmit={(e) => {
            void submit(e);
          }}
          noValidate
          className="mt-5 space-y-3"
        >
          <div>
            <label
              htmlFor="reauth-password"
              className="mb-1 block text-sm font-medium"
              style={{ color: "var(--color-ink)" }}
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
              className="w-full rounded-2xl px-4 py-3 text-sm outline-none"
              style={{
                backgroundColor: "var(--color-bg)",
                border: "1px solid var(--line)",
                color: "var(--color-ink)",
              }}
            />
            {error && (
              <p
                role="alert"
                className="mt-2 text-xs"
                style={{ color: "var(--color-accent-2)" }}
              >
                {error}
              </p>
            )}
          </div>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{ color: "var(--color-ink-2)", backgroundColor: "transparent" }}
            >
              Abbrechen
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="rounded-2xl px-4 py-2 text-sm disabled:opacity-40"
              style={{
                backgroundColor: "var(--color-accent)",
                color: "var(--color-on-night)",
              }}
            >
              {isSubmitting ? "Bestaetige …" : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
