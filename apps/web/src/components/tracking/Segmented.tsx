type Option<T extends string> = { value: T; label: string };

type Props<T extends string> = {
  label: string;
  name: string;
  options: Option<T>[];
  value: T | "";
  onChange: (v: T) => void;
  required?: boolean;
};

export function Segmented<T extends string>({
  label,
  name,
  options,
  value,
  onChange,
  required,
}: Props<T>) {
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium" style={{ color: "var(--color-ink)" }}>
        {label}
        {required && (
          <span className="ml-1" style={{ color: "var(--color-accent)" }}>
            *
          </span>
        )}
      </legend>
      <div
        role="radiogroup"
        aria-label={label}
        className="grid auto-cols-fr grid-flow-col gap-2"
      >
        {options.map((opt) => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => onChange(opt.value)}
              name={name}
              className="rounded-2xl px-3 py-2 text-sm transition"
              style={{
                backgroundColor: active
                  ? "var(--color-accent-soft)"
                  : "var(--color-paper)",
                border: active
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--line)",
                color: "var(--color-ink)",
                fontWeight: active ? 600 : 400,
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
