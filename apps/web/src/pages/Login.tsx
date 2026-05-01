import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";
import { Field } from "../components/form/Field";

type FieldErrors = Partial<Record<"email" | "password", string>>;

type LocationState = { from?: string } | null;

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (!email.trim()) next.email = "E-Mail ist erforderlich.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Bitte gib eine gueltige E-Mail-Adresse an.";
    if (!password) next.password = "Passwort ist erforderlich.";
    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    setIsSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setIsSubmitting(false);

    if (error) {
      logger.warn("signIn failed", error.message);
      const isUnconfirmed =
        // Supabase JS v2: error.code; Fallback: message-Match fuer aeltere Builds
        (error as { code?: string }).code === "email_not_confirmed" ||
        error.message.toLowerCase().includes("email not confirmed");
      if (isUnconfirmed) {
        toast.error("E-Mail noch nicht bestaetigt", {
          description: "Bitte oeffne den Bestaetigungslink in deinem Postfach.",
          action: {
            label: "Erneut senden",
            onClick: () => {
              void supabase.auth
                .resend({ type: "signup", email: email.trim() })
                .then(({ error: resendError }) => {
                  if (resendError) {
                    logger.warn("resend failed", resendError.message);
                    toast.error("Senden fehlgeschlagen", {
                      description: "Bitte spaeter erneut versuchen.",
                    });
                    return;
                  }
                  toast.success("Bestaetigungs-Mail versendet");
                });
            },
          },
        });
        return;
      }
      toast.error("Login fehlgeschlagen", {
        description: "E-Mail oder Passwort ist falsch.",
      });
      return;
    }

    const state = location.state as LocationState;
    const target = state?.from ?? "/app/dashboard";
    toast.success("Willkommen zurueck");
    void navigate(target, { replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-10 text-slate-100">
      <form
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="w-full max-w-sm space-y-5"
        aria-labelledby="login-title"
      >
        <div>
          <h1 id="login-title" className="text-2xl font-semibold">
            Einloggen
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Willkommen zurueck bei Ready 2 Fight.
          </p>
        </div>

        <Field
          id="email"
          label="E-Mail"
          type="email"
          autoComplete="email"
          value={email}
          onChange={setEmail}
          error={errors.email}
          required
        />

        <Field
          id="password"
          label="Passwort"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          required
        />

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-white py-2.5 font-medium text-slate-900 disabled:opacity-50"
        >
          {isSubmitting ? "Melde an …" : "Einloggen"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Noch kein Konto?{" "}
          <Link to="/register" className="font-medium text-white hover:underline">
            Konto erstellen
          </Link>
        </p>
      </form>
    </div>
  );
}
