import type { Mood } from "./trackingForm.logic";

type MoodOption = { value: Mood; emoji: string; label: string };

// 5-Phasen-Mond-Skala 🌑 → 🌕 aus dem Hi-fi-Mock. Reihenfolge schlecht → gut.
const MOODS: MoodOption[] = [
  { value: "sehr_schlecht", emoji: "🌑", label: "Sehr schlecht" },
  { value: "schlecht", emoji: "🌒", label: "Schlecht" },
  { value: "mittel", emoji: "🌓", label: "Neutral" },
  { value: "gut", emoji: "🌔", label: "Gut" },
  { value: "sehr_gut", emoji: "🌕", label: "Sehr gut" },
];

type Props = {
  label: string;
  value: Mood | "";
  onChange: (v: Mood) => void;
  required?: boolean;
};

export function MoodEmojiStrip({ label, value, onChange, required }: Props) {
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
      <div role="radiogroup" aria-label={label} className="grid grid-cols-5 gap-1.5">
        {MOODS.map((m) => {
          const active = value === m.value;
          return (
            <button
              key={m.value}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={m.label}
              onClick={() => onChange(m.value)}
              className="flex flex-col items-center gap-1 rounded-2xl px-1 py-3 transition"
              style={{
                backgroundColor: active
                  ? "var(--color-accent-soft)"
                  : "var(--color-paper)",
                border: active
                  ? "1px solid var(--color-accent)"
                  : "1px solid var(--line)",
              }}
            >
              <span
                aria-hidden
                style={{
                  fontSize: "1.5rem",
                  filter: active ? "none" : "grayscale(0.4)",
                }}
              >
                {m.emoji}
              </span>
              <span
                className="text-[10px] leading-tight"
                style={{
                  color: active ? "var(--color-accent-2)" : "var(--color-ink-3)",
                  fontWeight: active ? 600 : 400,
                }}
              >
                {m.label}
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
