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

export function Field({
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
