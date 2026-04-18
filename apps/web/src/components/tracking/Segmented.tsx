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
      <legend className="mb-1 text-sm font-medium">
        {label}
        {required && <span className="ml-1 text-red-400">*</span>}
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
              className={`rounded-md border px-3 py-2 text-sm transition ${
                active
                  ? "border-slate-400 bg-slate-800"
                  : "border-slate-700 bg-slate-900 hover:border-slate-600"
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
