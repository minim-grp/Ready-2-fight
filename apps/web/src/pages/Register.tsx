import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from "../lib/supabase";
import { logger } from "../lib/logger";
import type { Database } from "../lib/database.types";

type UserRole = Database["public"]["Enums"]["user_role"];

const MIN_AGE_YEARS = 16;
const MIN_PASSWORD_LENGTH = 12;

type FieldErrors = Partial<
  Record<
    "email" | "password" | "passwordConfirm" | "displayName" | "birthDate" | "role",
    string
  >
>;

function yearsBetween(isoDate: string, ref: Date): number {
  const d = new Date(isoDate);
  let years = ref.getFullYear() - d.getFullYear();
  const monthDiff = ref.getMonth() - d.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && ref.getDate() < d.getDate())) years--;
  return years;
}

function roleFromChoice(isAthlete: boolean, isCoach: boolean): UserRole | null {
  if (isAthlete && isCoach) return "both";
  if (isAthlete) return "athlete";
  if (isCoach) return "coach";
  return null;
}

export function RegisterPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [isAthlete, setIsAthlete] = useState(true);
  const [isCoach, setIsCoach] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  const maxBirthDate = useMemo(() => {
    const d = new Date();
    d.setFullYear(d.getFullYear() - MIN_AGE_YEARS);
    return d.toISOString().slice(0, 10);
  }, []);

  function validate(): FieldErrors {
    const next: FieldErrors = {};

    if (!email.trim()) next.email = "E-Mail ist erforderlich.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "Bitte gib eine gueltige E-Mail-Adresse an.";

    if (!password) next.password = "Passwort ist erforderlich.";
    else if (password.length < MIN_PASSWORD_LENGTH)
      next.password = `Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`;

    if (password !== passwordConfirm)
      next.passwordConfirm = "Passwoerter stimmen nicht ueberein.";

    if (!displayName.trim()) next.displayName = "Anzeigename ist erforderlich.";
    else if (displayName.trim().length > 60) next.displayName = "Maximal 60 Zeichen.";

    if (!birthDate) {
      next.birthDate = "Geburtsdatum ist erforderlich.";
    } else {
      const age = yearsBetween(birthDate, new Date());
      if (age < MIN_AGE_YEARS) {
        next.birthDate = `Du musst mindestens ${MIN_AGE_YEARS} Jahre alt sein.`;
      } else if (age > 120) {
        next.birthDate = "Ungueltiges Geburtsdatum.";
      }
    }

    if (!isAthlete && !isCoach)
      next.role = "Waehle mindestens eine Rolle (Athlet oder Coach).";

    return next;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const validation = validate();
    setErrors(validation);
    if (Object.keys(validation).length > 0) return;

    const role = roleFromChoice(isAthlete, isCoach);
    if (!role) return;

    setIsSubmitting(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          display_name: displayName.trim(),
          role,
          birth_date: birthDate,
          locale: "de",
        },
      },
    });
    setIsSubmitting(false);

    if (error) {
      logger.warn("signUp failed", error.message);
      toast.error("Registrierung fehlgeschlagen", { description: error.message });
      return;
    }

    if (data.session) {
      toast.success("Konto erstellt", { description: "Willkommen bei Ready 2 Fight!" });
      void navigate("/app/dashboard", { replace: true });
    } else {
      toast.success("Konto erstellt", {
        description: "Bitte bestaetige deine E-Mail-Adresse.",
      });
      void navigate("/login", { replace: true });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-6 py-10 text-slate-100">
      <form
        onSubmit={(e) => void onSubmit(e)}
        noValidate
        className="w-full max-w-sm space-y-5"
        aria-labelledby="register-title"
      >
        <div>
          <h1 id="register-title" className="text-2xl font-semibold">
            Konto erstellen
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Du kannst Athlet, Coach oder beides gleichzeitig sein.
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
          id="displayName"
          label="Anzeigename"
          type="text"
          autoComplete="nickname"
          value={displayName}
          onChange={setDisplayName}
          error={errors.displayName}
          required
        />

        <Field
          id="birthDate"
          label="Geburtsdatum"
          type="date"
          value={birthDate}
          onChange={setBirthDate}
          max={maxBirthDate}
          error={errors.birthDate}
          hint={`Mindestalter ${MIN_AGE_YEARS} Jahre.`}
          required
        />

        <Field
          id="password"
          label="Passwort"
          type="password"
          autoComplete="new-password"
          value={password}
          onChange={setPassword}
          error={errors.password}
          hint={`Mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`}
          required
        />

        <Field
          id="passwordConfirm"
          label="Passwort bestaetigen"
          type="password"
          autoComplete="new-password"
          value={passwordConfirm}
          onChange={setPasswordConfirm}
          error={errors.passwordConfirm}
          required
        />

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Ich bin …</legend>
          <RoleCheckbox
            id="role-athlete"
            label="Athletin / Athlet"
            description="Training tracken, Coaches einladen."
            checked={isAthlete}
            onChange={setIsAthlete}
          />
          <RoleCheckbox
            id="role-coach"
            label="Coach"
            description="Athleten betreuen, Plaene vorschlagen."
            checked={isCoach}
            onChange={setIsCoach}
          />
          {errors.role && (
            <p className="text-xs text-red-400" role="alert">
              {errors.role}
            </p>
          )}
        </fieldset>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-md bg-white py-2.5 font-medium text-slate-900 disabled:opacity-50"
        >
          {isSubmitting ? "Registriere …" : "Konto erstellen"}
        </button>

        <p className="text-center text-sm text-slate-400">
          Schon registriert?{" "}
          <Link to="/login" className="font-medium text-white hover:underline">
            Einloggen
          </Link>
        </p>
      </form>
    </div>
  );
}

type FieldProps = {
  id: string;
  label: string;
  type: "text" | "email" | "password" | "date";
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  max?: string;
  error?: string;
  hint?: string;
  required?: boolean;
};

function Field({
  id,
  label,
  type,
  value,
  onChange,
  autoComplete,
  max,
  error,
  hint,
  required,
}: FieldProps) {
  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium">
        {label}
      </label>
      <input
        id={id}
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        autoComplete={autoComplete}
        max={max}
        required={required}
        aria-invalid={!!error}
        aria-describedby={describedBy || undefined}
        className="w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm outline-none focus:border-slate-500"
      />
      {hint && !error && (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-red-400" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

type RoleCheckboxProps = {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
};

function RoleCheckbox({ id, label, description, checked, onChange }: RoleCheckboxProps) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-md border px-3 py-2.5 text-sm transition ${
        checked
          ? "border-slate-400 bg-slate-800"
          : "border-slate-700 bg-slate-900 hover:border-slate-600"
      }`}
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 accent-white"
      />
      <span>
        <span className="block font-medium">{label}</span>
        <span className="block text-xs text-slate-400">{description}</span>
      </span>
    </label>
  );
}
