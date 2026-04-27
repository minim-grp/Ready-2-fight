import { useState } from "react";
import { parseIsoDate, partsToIso, type BirthDateParts } from "../../lib/birthDate";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (iso: string) => void;
  error?: string;
  hint?: string;
  required?: boolean;
};

export function BirthDateField({
  id,
  label,
  value,
  onChange,
  error,
  hint,
  required,
}: Props) {
  const initial = parseIsoDate(value);
  const [day, setDay] = useState(initial.day);
  const [month, setMonth] = useState(initial.month);
  const [year, setYear] = useState(initial.year);

  function sanitize(raw: string, max: number): string {
    const digits = raw.replace(/\D/g, "");
    return digits.slice(0, max);
  }

  function emit(next: BirthDateParts) {
    onChange(partsToIso(next));
  }

  function handleDay(raw: string) {
    const clean = sanitize(raw, 2);
    setDay(clean);
    emit({ day: clean, month, year });
  }
  function handleMonth(raw: string) {
    const clean = sanitize(raw, 2);
    setMonth(clean);
    emit({ day, month: clean, year });
  }
  function handleYear(raw: string) {
    const clean = sanitize(raw, 4);
    setYear(clean);
    emit({ day, month, year: clean });
  }

  const describedBy = [error ? `${id}-error` : null, hint ? `${id}-hint` : null]
    .filter(Boolean)
    .join(" ");

  const inputClass =
    "w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-2 text-center text-sm tabular-nums outline-none focus:border-slate-500";

  return (
    <div
      role="group"
      aria-labelledby={`${id}-label`}
      aria-describedby={describedBy || undefined}
    >
      <span id={`${id}-label`} className="mb-1 block text-sm font-medium">
        {label}
      </span>
      <div className="flex items-center gap-2">
        <input
          id={`${id}-day`}
          aria-label="Tag"
          type="text"
          inputMode="numeric"
          autoComplete="bday-day"
          placeholder="TT"
          value={day}
          onChange={(e) => handleDay(e.target.value)}
          required={required}
          className={`${inputClass} w-14`}
        />
        <span aria-hidden="true" className="text-slate-500">
          .
        </span>
        <input
          id={`${id}-month`}
          aria-label="Monat"
          type="text"
          inputMode="numeric"
          autoComplete="bday-month"
          placeholder="MM"
          value={month}
          onChange={(e) => handleMonth(e.target.value)}
          required={required}
          className={`${inputClass} w-14`}
        />
        <span aria-hidden="true" className="text-slate-500">
          .
        </span>
        <input
          id={`${id}-year`}
          aria-label="Jahr"
          type="text"
          inputMode="numeric"
          autoComplete="bday-year"
          placeholder="JJJJ"
          value={year}
          onChange={(e) => handleYear(e.target.value)}
          required={required}
          className={`${inputClass} w-20`}
        />
      </div>
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
