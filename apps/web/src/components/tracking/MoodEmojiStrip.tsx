import type { Quality } from "./trackingForm.logic";

type MoodOption = { value: Quality; emoji: string; label: string };

// ASSUMPTION: Backend-Enum sleep_quality hat 3 Werte (gut/mittel/schlecht).
// Hi-fi-Mock zeigt 5-Phasen-Mond — pragmatisch auf 3 Emojis reduziert,
// bis Migration ein erweitertes mood-Enum bringt (Followup).
const MOODS: MoodOption[] = [
  { value: "schlecht", emoji: "😞", label: "Schlecht" },
  { value: "mittel", emoji: "😐", label: "Neutral" },
  { value: "gut", emoji: "😊", label: "Gut" },
];

type Props = {
  label: string;
  value: Quality | "";
  onChange: (v: Quality) => void;
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
      <div role="radiogroup" aria-label={label} className="grid grid-cols-3 gap-2">
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
              className="flex flex-col items-center gap-1 rounded-2xl py-3 transition"
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
                  fontSize: "1.75rem",
                  filter: active ? "none" : "grayscale(0.4)",
                }}
              >
                {m.emoji}
              </span>
              <span
                className="text-xs"
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
